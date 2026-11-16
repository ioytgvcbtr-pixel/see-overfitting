import copy
import pytest
from fastapi.testclient import TestClient
from backend import main,islands,pedagogy


@pytest.mark.parametrize('panel',['error','sensitivity','regularization','forest'])
def test_ai_followup_is_new_marked_idempotent_and_preserves_first_answers(tmp_path,monkeypatch,panel):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'followup.sqlite')
    async def suggest(evidence,candidates):
        return {'mode':'rules','model':None,'notice':'验收规则模式','suggestion':{'candidate_id':candidates[0]['id'],'hypothesis':'保持其他条件，核对这次单变量操作。','expected':'uncertain'}}
    monkeypatch.setattr(islands.coach,'suggest',suggest)
    with TestClient(main.app) as c:
        def post(path,body=None):
            r=c.post(path,json=body or {});assert r.status_code==200,r.text
            return r.json()
        a=post('/islands/tasks',{'panel':panel});key=a['id']
        post(f'/islands/attempts/{key}/predict',{'choice':0,'confidence':2})
        post(f'/islands/attempts/{key}/observe',{'parameters':a['task']['target_parameters']})
        a=post(f'/islands/attempts/{key}/transfer-task');t=a['transfer_task']
        post(f'/islands/attempts/{key}/decision',{'task_id':t['id'],'choice':0})
        original=post(f'/islands/attempts/{key}/answer',{'task_id':t['id'],'choice':0,'reason':0})
        p=post('/islands/actions/plan',{'panel':panel,'attempt_id':key,'parameters':t['target_parameters']})
        assert c.post(f"/islands/actions/{p['id']}/transfer-task").status_code==409
        p=post(f"/islands/actions/{p['id']}/execute",{'parameters':p['baseline_parameters']})
        child=post(f"/islands/actions/{p['id']}/transfer-task")
        assert child['transfer_only'] and child['prediction'] is None and child['observation'] is None
        assert child['ai_origin']['attempt_id']==key and child['ai_origin']['action_id']==p['id']
        assert child['transfer_task']['seed'] not in (a['task']['seed'],t['seed'])
        assert not child['transfer_task']['reasons']
        assert post(f"/islands/actions/{p['id']}/transfer-task")['id']==child['id']
        ct=child['transfer_task'];truth=pedagogy.version3(panel,ct['mode'],ct['seed'],ct['question_kind'],ct['variant'])
        post(f"/islands/attempts/{child['id']}/decision",{'task_id':ct['id'],'choice':truth['_proof']['choice']})
        package=c.get('/workspace/backup').json()
        monkeypatch.setattr(main,'DB_PATH',tmp_path/'restored.sqlite')
        post('/workspace/backup/restore',package)
        assert post(f"/islands/actions/{p['id']}/transfer-task")['id']==child['id']
        finished=post(f"/islands/attempts/{child['id']}/answer",{'task_id':ct['id'],'choice':truth['_proof']['choice'],'reason':truth['_reason']})
        assert finished['transfer_answer']['passed'] and finished['transfer_answer']['assisted']
        parent=c.get(f'/islands/attempts/{key}').json()
        assert parent['transfer_answer']==original['transfer_answer']
        assert parent['prediction']==original['prediction']
        assert any(r['id']==child['id'] for r in c.get('/islands/history').json())
        assert any('AI后验证' in r['title'] for r in c.get('/workspace/overview').json()['items'])
        package=c.get('/workspace/backup').json()
        monkeypatch.setattr(main,'DB_PATH',tmp_path/'finished.sqlite')
        post('/workspace/backup/restore',package)
        assert c.get(f"/islands/attempts/{child['id']}").json()['transfer_answer']==finished['transfer_answer']
