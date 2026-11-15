import copy
import json

import pytest
from fastapi.testclient import TestClient
from backend import islands, main, pedagogy


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'teaching.sqlite')
    with TestClient(main.app) as c: yield c


def post(c, path, body=None):
    r=c.post(path,json=body or {})
    assert r.status_code==200,r.text
    return r.json()


@pytest.mark.parametrize('seed',[2026,314,2718])
@pytest.mark.parametrize('form',['comparison','model_selection','controlled_design'])
def test_garden_questions_have_real_observations_and_rebuildable_grading(seed,form):
    from backend.backup import rebuild_task, without_hidden_answers
    t=pedagogy.upgrade(islands.case('regularization','counterexample',seed),form)
    public=islands.descriptor(t)
    assert '_reason' not in json.dumps(public) and '_proof' not in public
    assert len(public['assessment']['rows'])==(3 if form=='model_selection' else 2)
    if form=='model_selection':
        rows=t['assessment']['rows']; expected=min(range(3),key=lambda i:rows[i]['values'][1])
        assert t['_proof']['choice']==expected
        assert t['_proof']['after']==rows[expected]['values'][1]
    raw=without_hidden_answers(t)
    raw['assessment']['rows'][0]['values']=[999,999,999]
    raw['reasons']=['伪造']*3
    rebuilt=rebuild_task(raw)
    assert rebuilt==t  # charts, reasons and keys all recomputed


def test_autonomous_counterexample_keeps_first_prediction_and_failed_trials(client,tmp_path,monkeypatch):
    a=post(client,'/islands/tasks',{'panel':'regularization','autonomous':True})
    key=a['id']; base=a['task']['before_parameters']
    assert a['task']['target_parameters']==base
    assert not a['task']['reasons'] and 'assessment' not in a['task']
    assert client.post(f'/islands/attempts/{key}/predict',json={'choice':0,'confidence':2}).status_code==422
    a=post(client,f'/islands/attempts/{key}/predict',{'choice':0,'confidence':2,'planned_alpha':.1})
    # Cannot jump past the locked first operation, or change two factors.
    assert client.post(f'/islands/attempts/{key}/observe',json={'parameters':{**base,'alpha':100}}).status_code==409
    assert client.post(f'/islands/attempts/{key}/observe',json={'parameters':{**base,'alpha':.1,'degree':3}}).status_code==409
    a=post(client,f'/islands/attempts/{key}/observe',{'parameters':{**base,'alpha':.1}})
    assert a['trials'][0]['proof']['choice']==0
    assert a['stage']=='experiment' and a['observation'] is None
    again=post(client,f'/islands/attempts/{key}/observe',{'parameters':{**base,'alpha':.1}})
    assert len(again['trials'])==1
    a=post(client,f'/islands/attempts/{key}/observe',{'parameters':{**base,'alpha':100}})
    assert a['stage']=='review' and a['observation']['goal_met']
    assert a['observation']['matched'] and a['observation']['first_choice']==0
    assert a['observation']['choice']==1 and len(a['trials'])==2
    package=client.get('/workspace/backup').json()
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'restored.sqlite')
    post(client,'/workspace/backup/restore',package)
    restored=client.get(f'/islands/attempts/{key}').json()
    assert restored['prediction']==a['prediction']
    assert restored['trials']==a['trials'] and restored['observation']==a['observation']


def test_wrong_submitted_reason_reaches_ai_and_uncertain_is_observation(client,monkeypatch):
    captured={}
    async def suggest(evidence,candidates):
        captured.update(evidence)
        return {'mode':'rules','model':None,'notice':'离线验收','suggestion':{'candidate_id':candidates[0]['id'],'hypothesis':'比较这项单变量操作。','expected':'uncertain'}}
    monkeypatch.setattr(islands.coach,'suggest',suggest)
    a=post(client,'/islands/tasks',{'panel':'regularization'})
    key=a['id']
    post(client,f'/islands/attempts/{key}/predict',{'choice':0,'confidence':2})
    post(client,f'/islands/attempts/{key}/observe',{'parameters':a['task']['target_parameters']})
    a=post(client,f'/islands/attempts/{key}/transfer-task')
    transfer=a['transfer_task']
    t=pedagogy.upgrade(islands.case('regularization',transfer['mode'],transfer['seed']))
    wrong=next(i for i,v in enumerate(t['_reason_tags']) if v=='norm_as_validation')
    a=post(client,f'/islands/attempts/{key}/answer',{'task_id':transfer['id'],'choice':t['_proof']['choice'],'reason':wrong})
    p=post(client,'/islands/actions/plan',{'panel':'regularization','attempt_id':key,'parameters':transfer['target_parameters']})
    context=captured['learning_context']['diagnosis']
    assert context['tag']=='norm_as_validation'
    assert context['submitted_answer']['reason']==transfer['reasons'][wrong]
    assert p['learning_focus']['label']=='区分系数收缩与验证表现'
    p=post(client,f"/islands/actions/{p['id']}/execute",{'parameters':p['baseline_parameters']})
    assert p['execution']['verdict']=='observed'


def test_old_question_is_not_rewritten_on_restore():
    from backend.backup import rebuild_task,without_hidden_answers
    old=islands.case('regularization','counterexample',2026)
    assert rebuild_task(without_hidden_answers(old))==old
