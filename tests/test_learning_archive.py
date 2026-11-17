import copy,json,uuid
import pytest
from fastapi.testclient import TestClient
from backend import main,curriculum,learning_archive,planet_api
from test_planet_engine import spec_for
from test_planet_api import done,post
from test_workspace import island,finish

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'learning.sqlite')
    monkeypatch.setattr(learning_archive,'ARCHIVE_DIR',tmp_path/'private-archives')
    monkeypatch.setenv('AI_API_KEY','kept-locally')
    monkeypatch.setenv('AI_ENABLED','0')
    with TestClient(main.app,headers={'X-ModelPlanet-Archive':'1'}) as c:yield c
    for event in planet_api.CANCEL.values():event.set()

def learn(c,complete=True):
    l=curriculum.LESSONS[0];post(c,f"/study/lessons/{l['id']}/open");post(c,f"/study/lessons/{l['id']}/read")
    wrong=next(v['id'] for v in l['quiz']['choices'] if v['id']!=l['_answer'])
    first=post(c,f"/study/lessons/{l['id']}/answer",{'id':uuid.uuid4().hex,'choice':wrong})['first_answer']
    if complete:post(c,f"/study/lessons/{l['id']}/answer",{'id':uuid.uuid4().hex,'choice':l['_answer']})
    return first

def test_export_reset_and_restore_preserve_original_answers_and_all_domains(client):
    c=client;first=learn(c);finish(c,island(c));run=done(c,post(c,'/lab/runs',{'spec':spec_for().model_dump()}))
    local={'modelplanet-draft-v1':'{"version":1}','fitlab-learning-completed-v1':'["complexity"]'}
    pack=post(c,'/learning-archive/export',{'client_state':local})
    assert 'kept-locally' not in json.dumps(pack) and pack['client_state']==local
    preview=post(c,'/learning-archive/preview',{'archive':pack})
    assert preview['summary']['lessons_completed']==1 and preview['summary']['mechanisms_completed']==1
    assert preview['summary']['model_runs']==1
    old_generation=c.get('/learning-archive/status').json()['generation']
    reset=post(c,'/learning-archive/reset',{'scope':'all','confirmed':True,'client_state':local})
    assert reset['generation']!=old_generation and reset['summary']['lessons_started']==reset['summary']['model_runs']==0
    assert c.get('/study/overview').json()['completed']==0 and c.get('/lab/runs/'+run['id']).status_code==404
    restored=post(c,'/learning-archive/import',{'archive':pack,'confirmed':True})
    assert restored['summary']==preview['summary'] and restored['client_state']==local
    assert c.get('/study/lessons/ml-intro').json()['progress']['first_answer']==first
    assert c.get('/study/overview').json()['mechanisms'][0]['completed']
    assert c.get('/lab/runs/'+run['id']).json()['state']=='restored'
    again=done(c,post(c,'/lab/runs/'+run['id']+'/recompute'))
    assert again['result']['validation_metrics']==run['result']['validation_metrics']

def test_progress_only_reset_preserves_model_experiments_and_can_be_undone(client):
    c=client;first=learn(c);run=done(c,post(c,'/lab/runs',{'spec':spec_for().model_dump()}))
    reset=post(c,'/learning-archive/reset',{'scope':'progress','confirmed':True})
    assert reset['summary']['lessons_completed']==0 and reset['summary']['model_runs']==1
    assert c.get('/lab/runs/'+run['id']).json()['state']=='completed'
    assert c.get('/learning-archive/status').json()['has_previous']
    undo=post(c,'/learning-archive/undo',{'confirmed':True})
    assert undo['summary']['lessons_completed']==1 and undo['summary']['model_runs']==1
    assert c.get('/study/lessons/ml-intro').json()['progress']['first_answer']==first

def test_invalid_restore_is_atomic_and_imported_grades_are_recomputed(client):
    c=client;first=learn(c,False);pack=post(c,'/learning-archive/export',{})
    before=c.get('/study/lessons/ml-intro').json();generation=c.get('/learning-archive/status').json()['generation']
    broken=copy.deepcopy(pack);broken['models']['version']=999
    assert c.post('/learning-archive/import',json={'archive':broken,'confirmed':True}).status_code==422
    assert c.get('/study/lessons/ml-intro').json()==before
    assert c.get('/learning-archive/status').json()['generation']==generation
    pack['knowledge']['progress'][0]['attempts'][0]['correct']=True
    pack['knowledge']['progress'][0]['completed']=True
    answer=post(c,'/learning-archive/import',{'archive':pack,'confirmed':True})
    assert answer['summary']['lessons_completed']==0
    assert c.get('/study/lessons/ml-intro').json()['progress']['first_answer']==first

def test_reset_retains_test_exposure_and_rejects_accidental_or_busy_requests(client):
    c=client
    assert c.post('/learning-archive/reset',json={}).status_code==422
    assert c.post('/learning-archive/reset',json={'scope':'all','confirmed':True},headers={'X-ModelPlanet-Archive':''}).status_code==403
    job=post(c,'/lab/runs',{'spec':spec_for().model_dump()})
    assert c.post('/learning-archive/reset',json={'scope':'all','confirmed':True}).status_code==409
    run=done(c,job);done(c,post(c,f"/lab/runs/{run['id']}/final"))
    with main.connect() as db:count=db.execute('SELECT count(*) FROM planet_exposure').fetchone()[0]
    post(c,'/learning-archive/reset',{'scope':'all','confirmed':True})
    with main.connect() as db:assert db.execute('SELECT count(*) FROM planet_exposure').fetchone()[0]>=count
    assert c.post('/learning-archive/export',json={'client_state':{'modelplanet-companion-v1':'private preference'}}).status_code==422
    assert c.get('/workspace/settings').json()['key_configured']
