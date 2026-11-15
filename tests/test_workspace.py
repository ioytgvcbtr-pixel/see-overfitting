import copy
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend import islands, learning, main, workspace
from backend.experiments import Parameters


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DB_PATH', tmp_path/'workspace.sqlite')
    monkeypatch.setattr(workspace, 'ENV_PATH', tmp_path/'.env')
    monkeypatch.setattr(workspace, 'CONNECTION', {'state':'untested','checked_at':None,'notice':'','fingerprint':''})
    monkeypatch.setenv('AI_API_KEY', 'unit-test-token-12345')
    monkeypatch.setenv('AI_ENABLED', '1')
    with TestClient(main.app) as c: yield c


def island(c, mode='counterexample'):
    return c.post('/islands/tasks',json={'panel':'error','mode':mode}).json()


def predict(c, s):
    return c.post(f"/islands/attempts/{s['id']}/predict",json={'choice':0,'confidence':2,'reason':'开发验收'}).json()


def finish(c, s):
    s = predict(c,s)
    s = c.post(f"/islands/attempts/{s['id']}/observe",json={'parameters':s['task']['target_parameters']}).json()
    s = c.post(f"/islands/attempts/{s['id']}/transfer-task").json()
    t = s['transfer_task']; truth = islands.case(t['panel'],t['mode'],t['seed'])
    return c.post(f"/islands/attempts/{s['id']}/answer",json={'task_id':t['id'],'choice':truth['_proof']['choice'],'reason':truth['_reason']}).json()


def test_checkpoint_preserves_live_inputs_but_never_changes_locked_answers(client):
    s = predict(client,island(client)); p={**s['task']['before_parameters'],'intercept':-.35}
    payload={'stage':'experiment','parameters':p,'selected':2,'choice':2,'confidence':3,'reason':'不能覆盖首答'}
    assert client.post(f"/islands/attempts/{s['id']}/checkpoint",json=payload).status_code == 200
    restored=client.get(f"/islands/attempts/{s['id']}").json()
    assert restored['checkpoint']['parameters']['intercept'] == -.35
    assert restored['checkpoint']['selected']==2 and restored['prediction']==s['prediction']
    assert restored['checkpoint']['choice'] is None
    client.post(f"/islands/attempts/{s['id']}/observe",json={'parameters':s['task']['target_parameters']})
    assert client.post(f"/islands/attempts/{s['id']}/checkpoint",json=payload).status_code == 409
    assert client.post(f"/islands/attempts/{s['id']}/checkpoint",json={**payload,'score':100}).status_code == 422


def test_overview_and_targeted_practice_keep_original_history(client):
    s=finish(client,island(client))
    first=client.get('/workspace/overview').json()
    assert first['stats']['island_rounds']==1 and first['latest']['id']==s['id']
    new=client.post(f"/islands/attempts/{s['id']}/practice").json()
    assert new['practice_of']==s['id']
    assert new['task']['seed'] not in (s['task']['seed'],s['transfer_task']['seed'])
    assert new['practice_focus'] and new['observation'] is None
    assert client.get('/islands/attempts/'+s['id']).json()==s
    assert client.get('/workspace/overview').json()['latest']['id']==new['id']


def test_settings_are_write_only_keep_existing_key_and_apply_without_restart(client):
    cfg=client.get('/workspace/settings').json()
    assert cfg['key_configured'] and 'api_key' not in cfg
    response=client.post('/workspace/settings',json={'base_url':'https://api.example.org/v1','model':'example-model','enabled':False,'api_key':''})
    assert response.status_code==200 and response.json()['connection']['state']=='disabled'
    assert 'unit-test-token' not in response.text
    assert client.get('/health').json()['ai_configured'] is False
    assert client.post('/workspace/settings',json={'base_url':'http://public.example.org','model':'a'}).status_code==422
    assert client.post('/workspace/settings',json={'base_url':'https://user:pass@api.example.org','model':'a'}).status_code==422


def test_connection_test_never_returns_model_reasoning_or_key(client, monkeypatch):
    calls=[]
    class Fake:
        def __init__(self,**kwargs): pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,**kwargs):
            calls.append(kwargs['json'])
            return httpx.Response(200,json={'choices':[{'message':{'content':'OK','reasoning_content':'private reasoning'}}]})
    monkeypatch.setattr(workspace.httpx,'AsyncClient',Fake)
    result=client.post('/workspace/settings/test')
    assert result.json()['state']=='ok'
    assert 'private reasoning' not in result.text and 'unit-test-token' not in result.text
    assert calls[0]['reasoning_effort']=='xhigh' and calls[0]['thinking']['type']=='enabled'
    assert client.get('/health').json()['connection']['state']=='ok'


def test_connection_failure_is_distinct_from_configured(client, monkeypatch):
    class Fake:
        def __init__(self,**kwargs):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,*args,**kwargs):return httpx.Response(401,json={'error':'secret provider response'})
    monkeypatch.setattr(workspace.httpx,'AsyncClient',Fake)
    result=client.post('/workspace/settings/test').json()
    assert result['state']=='failed' and '401' in result['notice']
    assert 'secret provider' not in str(result)
    assert client.get('/workspace/settings').json()['key_configured'] is True


def complete_course(c):
    p=Parameters()
    s=c.post('/learning/attempts',json={'parameters':p.model_dump(),'choice':1,'confidence':2,'reason':'开发验收'}).json()
    control,values=learning.lesson(p)
    for value in values:
        s=c.post(f"/learning/attempts/{s['id']}/observe",json=p.model_copy(update={control:value}).model_dump()).json()['attempt']
    for wrong in [True,False]:
        task=s['task']; scores=[r['metrics']['validation_mse'] for r in task['rows']]
        correct=2 if scores[0]==scores[1] else scores.index(min(scores))
        s=c.post(f"/learning/attempts/{s['id']}/transfer",json={'task_id':task['id'],'choice':(correct+1)%3 if wrong else correct,'reason':0}).json()
        if wrong:s=c.post(f"/learning/attempts/{s['id']}/retry").json()
    return s


def test_backup_round_trip_recomputes_metrics_and_preserves_wrong_first_answer(client,tmp_path,monkeypatch):
    island_record=finish(client,island(client)); course=complete_course(client)
    package=client.get('/workspace/backup').json()
    download=client.get('/workspace/backup/file')
    assert 'attachment' in download.headers['content-disposition'] and download.json()['format']=='fitlab-learning'
    assert 'unit-test-token' not in json.dumps(package)
    for entry in package['entries']:
        if entry['table']=='island_attempts':
            entry['content']['observation']['before']=999
            entry['content']['transfer_answer']['passed']=False
            entry['content']['transfer_answer']['proof']['after']=999
        elif entry['table']=='learning_attempts':
            entry['content']['observations'][0]['metrics']['validation_mse']=999
            entry['content']['transfer_attempts'][0]['passed']=True
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'restored.sqlite')
    preview=client.post('/workspace/backup/preview',json=package)
    assert preview.status_code==200,preview.text
    assert preview.json()['new']==2 and client.get('/workspace/overview').json()['items']==[]
    result=client.post('/workspace/backup/restore',json=package)
    assert result.status_code==200,result.text
    restored=client.get('/islands/attempts/'+island_record['id']).json()
    assert restored['transfer_answer']['passed'] is True
    assert restored['transfer_answer']['proof']==island_record['transfer_answer']['proof']
    assert restored['prediction']==island_record['prediction'] and restored['imported_at']
    restored_course=client.get('/learning/attempts/'+course['id']).json()
    assert restored_course['transfer_attempts'][0]['passed'] is False
    assert restored_course['stage']=='complete'
    assert restored_course['observations'][0]['metrics']==course['observations'][0]['metrics']
    package['entries'][0]['content']['prediction']['choice']=2
    assert client.post('/workspace/backup/restore',json=package).json()['existing']==2
    assert client.get('/islands/attempts/'+island_record['id']).json()['prediction']==island_record['prediction']


def test_backup_bad_entry_is_atomic_and_unknown_config_is_rejected(client,tmp_path,monkeypatch):
    finish(client,island(client)); package=client.get('/workspace/backup').json()
    broken=copy.deepcopy(package)
    broken['entries'].append({'table':'settings','id':'key','content':{}})
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'empty.sqlite')
    assert client.post('/workspace/backup/restore',json=broken).status_code==422
    assert client.get('/workspace/overview').json()['items']==[]


def test_ai_backup_recomputes_both_archives_and_keeps_configuration_out(client,tmp_path,monkeypatch):
    async def rules(*args):return {'mode':'rules','model':None,'notice':'开发验收','suggestion':None}
    monkeypatch.setattr(islands.coach,'suggest',rules)
    s=finish(client,island(client))
    raw=s['task']['target_parameters']
    plan=client.post('/islands/actions/plan',json={'panel':'error','parameters':raw,'attempt_id':s['id']}).json()
    result=client.post(f"/islands/actions/{plan['id']}/execute",json={'parameters':raw}).json()
    old=client.post('/actions/plan',json={'kind':'synthetic','parameters':Parameters().model_dump()}).json()
    executed=client.post(f"/actions/{old['id']}/execute",json={'parameters':old['baseline_parameters']}).json()
    package=client.get('/workspace/backup').json()
    for entry in package['entries']:
        if entry['table']=='island_actions':entry['content']['execution']['after']=999
        if entry['table']=='action_plans':entry['content']['execution']['after']['metrics']['validation_mse']=999
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'ai-restored.sqlite')
    imported=client.post('/workspace/backup/restore',json=package)
    assert imported.status_code==200,imported.text
    a=client.get(f"/workspace/evidence/island_ai/{plan['id']}").json()
    b=client.get(f"/workspace/evidence/course_ai/{old['id']}").json()
    assert a['proof']['after']==result['execution']['after']
    assert b['proof']['after']==executed['after']['metrics']['validation_mse']
    assert a['imported_at'] and b['imported_at']


def test_older_checkpoint_cannot_overwrite_a_newer_input(client):
    s=predict(client,island(client));base=s['task']['before_parameters']
    newer={'stage':'experiment','parameters':{**base,'intercept':-.35},'selected':2,'client_updated_at':'2026-11-15T12:00:02.000Z'}
    older={**newer,'parameters':base,'client_updated_at':'2026-11-15T12:00:01.000Z'}
    assert client.post(f"/islands/attempts/{s['id']}/checkpoint",json=newer).json()['saved']
    assert client.post(f"/islands/attempts/{s['id']}/checkpoint",json=older).json()['stale']
    assert client.get('/islands/attempts/'+s['id']).json()['checkpoint']['parameters']['intercept']==-.35


def test_backup_also_seals_unsubmitted_grading_answers(client):
    island(client)
    p=Parameters()
    s=client.post('/learning/attempts',json={'parameters':p.model_dump(),'choice':1,'confidence':2,'reason':''}).json()
    control,values=learning.lesson(p)
    for value in values:client.post(f"/learning/attempts/{s['id']}/observe",json=p.model_copy(update={control:value}).model_dump())
    package=client.get('/workspace/backup').json()
    def keys(value):
        if isinstance(value,dict):return set(value)|set().union(*(keys(v) for v in value.values()))
        if isinstance(value,list):return set().union(*(keys(v) for v in value))
        return set()
    assert not {'_proof','_reason','_answer'} & keys(package)
