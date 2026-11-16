import json
import pytest
from fastapi.testclient import TestClient
from backend import islands,main,pedagogy
from backend.backup import rebuild_task,without_hidden_answers


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'v3.sqlite')
    with TestClient(main.app) as c: yield c


def post(c,path,body=None):
    r=c.post(path,json=body or {});assert r.status_code==200,r.text
    return r.json()


def transfer(c):
    a=post(c,'/islands/tasks',{'panel':'regularization'})
    post(c,f"/islands/attempts/{a['id']}/predict",{'choice':0,'confidence':2})
    post(c,f"/islands/attempts/{a['id']}/observe",{'parameters':a['task']['target_parameters']})
    return post(c,f"/islands/attempts/{a['id']}/transfer-task")


@pytest.mark.parametrize('variant',[0,1,2])
def test_model_positions_are_balanced_real_unique_and_reconstructable(variant):
    winners=[];best_alphas=[]
    for seed in (2026,314,2718):
        t=pedagogy.version3('regularization','counterexample',seed,'model_selection',variant)
        rows=t['assessment']['rows'];winner=t['_proof']['choice'];winners.append(winner)
        assert winner==min(range(3),key=lambda i:rows[i]['values'][1])
        assert all(rows[i]['values'][1]>rows[winner]['values'][1]+1e-10 for i in range(3) if i!=winner)
        assert t['target_parameters']==rows[winner]['parameters']
        best_alphas.append(t['target_parameters']['alpha'])
        raw=without_hidden_answers(t);raw['reasons']=['篡改']*3;raw['assessment']['rows'][0]['values']=[999]*3
        assert rebuild_task(raw)==t
        assert not any(f'模型{letter}' in r for r in t['reasons'] for letter in 'ABC')
    assert sorted(winners)==[0,1,2]
    assert len(set(best_alphas))>=2


def test_reasons_require_immutable_first_decision_and_survive_backup(client,tmp_path,monkeypatch):
    a=transfer(client);key=a['id'];t=a['transfer_task']
    assert t['content_version']==3 and not t['reasons']
    assert client.post(f'/islands/attempts/{key}/answer',json={'task_id':t['id'],'choice':0,'reason':0}).status_code==409
    a=post(client,f'/islands/attempts/{key}/decision',{'task_id':t['id'],'choice':0})
    assert len(a['transfer_task']['reasons'])==3
    assert client.post(f'/islands/attempts/{key}/decision',json={'task_id':t['id'],'choice':1}).status_code==409
    assert client.post(f'/islands/attempts/{key}/answer',json={'task_id':t['id'],'choice':1,'reason':0}).status_code==409
    package=client.get('/workspace/backup').json()
    assert '_reason_tags' not in json.dumps(package)
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'restored.sqlite')
    post(client,'/workspace/backup/restore',package)
    restored=client.get(f'/islands/attempts/{key}').json()
    assert restored['transfer_decision']==a['transfer_decision']
    assert restored['transfer_task']==a['transfer_task']
    a=post(client,f'/islands/attempts/{key}/answer',{'task_id':t['id'],'choice':0,'reason':0})
    assert a['transfer_answer']['choice']==0
