import copy,time
import pytest
from fastapi.testclient import TestClient
from backend import main,planet_api
from test_planet_engine import spec_for


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'planet.sqlite');monkeypatch.setenv('AI_ENABLED','0')
    with TestClient(main.app) as c:yield c
    for event in planet_api.CANCEL.values():event.set()
    time.sleep(.5)


def post(c,path,body=None):
    r=c.post(path,json=body or {});assert r.status_code==200,r.text
    return r.json()


def done(c,job):
    deadline=time.monotonic()+40
    while time.monotonic()<deadline:
        r=c.get('/lab/runs/'+job['id']).json()
        if r['state'] in ('completed','failed','timeout','cancelled'):
            assert r['state']=='completed',r
            return r
        time.sleep(.15)
    raise AssertionError('Job did not settle')


def test_classroom_training_test_exposure_and_restore(client,tmp_path,monkeypatch):
    c=client;s=spec_for().model_dump()
    preview=post(c,'/lab/preview',s);assert sum(preview['counts'].values())==150
    a=done(c,post(c,'/lab/runs',{'spec':s}))
    assert a['result']['test_sealed'] and '_artifact' not in a
    assert len(a['result']['cleaning']['preview'])==6
    explanation=post(c,f"/lab/runs/{a['id']}/explain");assert explanation['mode']=='rules'
    report=c.get(f"/lab/runs/{a['id']}/report?format=md");assert report.status_code==200 and '模力星球' in report.text
    inspector=done(c,post(c,f"/lab/runs/{a['id']}/analysis/inspect"))
    assert inspector['result']['tree']
    final=done(c,post(c,f"/lab/runs/{a['id']}/final"))
    assert final['result']['independent'] is True
    repeat=post(c,f"/lab/runs/{a['id']}/final")
    assert repeat['result']['evaluated_at']==final['result']['evaluated_at']
    changed=copy.deepcopy(s);changed['seed']=314;changed['split']['keep_test']=False
    b=done(c,post(c,'/lab/runs',{'spec':changed}))
    compare=post(c,'/lab/compare',{'a':a['id'],'b':b['id']});assert not compare['comparable'] and compare['delta'] is None
    bfinal=done(c,post(c,f"/lab/runs/{b['id']}/final"));assert bfinal['result']['independent'] is False
    pack=c.get('/lab/backup').json();assert not pack['imports']
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'restored.sqlite')
    restored=post(c,'/lab/backup/restore',pack);assert restored['first_answers_preserved']
    assert c.get('/lab/runs/'+a['id']).json()['state']=='restored'
    rebuilt=done(c,post(c,f"/lab/runs/{a['id']}/recompute"))
    assert rebuilt['result']['validation_metrics']==a['result']['validation_metrics']


def test_binary_threshold_does_not_retrain_and_source_is_immutable(client):
    c=client;s=spec_for('banknote','logistic','classification').model_dump()
    a=done(c,post(c,'/lab/runs',{'spec':s}))
    changed=copy.deepcopy(s);changed['decision']['threshold']=.9
    b=done(c,post(c,'/lab/runs',{'spec':changed,'source_id':a['id']}))
    assert b['operation']=='decision' and b['result']['decision_note']
    assert b['result']['fit_ms']==a['result']['fit_ms']
    assert c.get('/lab/runs/'+a['id']).json()['spec']['decision']['threshold'] is None
    grid=done(c,post(c,f"/lab/runs/{b['id']}/analysis/surface",{'axes':[0,1]}))
    assert grid['result']['axis_kinds']==['numeric','numeric']
    final=done(c,post(c,f"/lab/runs/{b['id']}/final"));assert final['result']['metrics']['positive_class']==changed['decision']['positive_class']


def test_ai_experiment_and_two_step_new_challenge(client):
    c=client;a=done(c,post(c,'/lab/runs',{'spec':spec_for().model_dump()}))
    plan=post(c,'/lab/plans',{'run_id':a['id']});assert plan['mode']=='rules'
    b=done(c,post(c,f"/lab/plans/{plan['id']}/execute"))
    verification=c.get('/lab/plans/'+plan['id']).json()['execution'];assert verification['comparable'] and verification['verdict']=='observed'
    job=done(c,post(c,f"/lab/plans/{plan['id']}/challenge"));qid=job['result']['quiz_id']
    q=c.get('/lab/quizzes/'+qid).json();assert not q['reasons'] and '_truth' not in q and q['assisted']
    assert c.post('/lab/quizzes/'+qid+'/answer',json={'reason':0}).status_code==409
    q=post(c,'/lab/quizzes/'+qid+'/decision',{'choice':0});assert len(q['reasons'])==3
    assert c.post('/lab/quizzes/'+qid+'/decision',json={'choice':1}).status_code==409
    reason=next(i for i,r in enumerate(q['reasons']) if r.startswith('比较同一'))
    q=post(c,'/lab/quizzes/'+qid+'/answer',{'reason':reason})
    assert q['answer']['passed']==(q['answer']['correct_choice']==0)
    assert c.get('/lab/runs/'+a['id']).json()['spec']['prediction']==a['spec']['prediction']


def test_csv_import_and_cancel(client):
    c=client;csv='x,colour,target\n'+'\n'.join(f'{"?" if i%5==0 else i},'+('blue' if i%2 else 'red')+f',{i*2}' for i in range(40))
    d=post(c,'/lab/import',{'name':'课堂CSV','csv':csv,'targets':['target'],'task':'regression','unit':'分'})
    assert d['rows']==40 and '_import' not in d and any(f['missing'] for f in d['features'])
    s=spec_for('concrete','ridge','regression').model_dump();s.update(dataset=d['id'],features=['x','colour'],targets=['target'])
    job=post(c,'/lab/runs',{'spec':s});post(c,'/lab/runs/'+job['id']+'/cancel')
    for _ in range(80):
        r=c.get('/lab/runs/'+job['id']).json()
        if r['state']=='cancelled':break
        time.sleep(.1)
    assert r['state']=='cancelled'
    assert not c.get('/lab/backup').json()['imports']
    assert c.get('/lab/backup?include_uploads=true').json()['imports'][0]['csv']==csv
