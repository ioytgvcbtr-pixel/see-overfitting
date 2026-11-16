import json,uuid
import pytest
from fastapi.testclient import TestClient
from backend import main,curriculum

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'study.sqlite')
    with TestClient(main.app) as c:yield c

def answer(c,l,correct=True,id=None):
    choice=l['_answer'] if correct else next(v['id'] for v in l['quiz']['choices'] if v['id']!=l['_answer'])
    r=c.post(f"/study/lessons/{l['id']}/answer",json={'id':id or uuid.uuid4().hex,'choice':choice});assert r.status_code==200,r.text
    return r.json()

def test_curriculum_has_a_complete_basic_to_frontier_path(client):
    v=client.get('/study/overview').json();assert len(v['chapters'])==6 and len(v['lessons'])==18 and v['completed']==0
    positions=[]
    for l in curriculum.LESSONS:
        p=client.get('/study/lessons/'+l['id']).json()
        assert '_answer' not in p['lesson'] and 'explanation' not in p['progress']
        assert len(l['sections'])==3 and sum(len(x['text']) for x in l['sections'])>130
        positions.append(next(i for i,x in enumerate(l['quiz']['choices']) if x['id']==l['_answer']))
    assert len(set(positions))==3 and max(positions.count(i) for i in range(3))<12

def test_progress_is_one_cell_per_passed_lesson_with_first_answer_preserved(client):
    c=client;l=curriculum.LESSONS[0]
    for _ in range(3):assert c.post('/study/lessons/'+l['id']+'/open').status_code==200
    assert c.get('/study/overview').json()['completed']==0
    assert c.post('/study/lessons/'+l['id']+'/read').status_code==200
    token=uuid.uuid4().hex;first=answer(c,l,False,token)
    assert not first['completed'] and first['first_answer']['correct'] is False
    assert answer(c,l,False,token)==first
    assert c.post('/study/lessons/'+l['id']+'/answer',json={'id':token,'choice':l['_answer']}).status_code==409
    second=answer(c,l);assert second['completed'] and second['first_answer']==first['first_answer']
    for item in curriculum.LESSONS[1:]:
        c.post('/study/lessons/'+item['id']+'/open');c.post('/study/lessons/'+item['id']+'/read');answer(c,item)
    v=c.get('/study/overview').json();assert v['completed']==v['total']==18 and v['all_complete'] and v['next_id'] is None
    assert not any(p['completed'] for p in v['mechanisms'])

def test_journal_is_idempotent_and_cannot_award_progress(client):
    c=client;e={'id':uuid.uuid4().hex,'kind':'config_change','session_id':'a'*32,'dataset':'iris','changes':[{'field':'seed','before':'','after':'42'}]}
    assert c.post('/study/events',json=e).status_code==200
    assert c.post('/study/events',json=e).status_code==200
    rows=c.get('/study/records?kind=experiments').json();assert rows['total']==1 and rows['items'][0]['changes']==e['changes']
    assert c.post('/study/events',json={**e,'completed':True}).status_code==422
    assert c.get('/study/overview').json()['completed']==0
    with main.connect() as db:
        db.execute('INSERT INTO learning_attempts(id,content) VALUES(?,?)',('legacy-course',json.dumps({'id':'legacy-course','parameters':{'scene':'complexity'},'stage':'complete','created_at':'2026-11-16T01:00:00+00:00'})))
        db.execute('INSERT INTO records(title,created_at) VALUES(?,?)',('原有实验','2026-11-16T01:00:00+00:00'))
    assert any(r.get('entry',{}).get('kind')=='course' for r in c.get('/study/records?kind=mechanisms').json()['items'])
    assert any(r.get('entry',{}).get('kind')=='saved' for r in c.get('/study/records?kind=experiments').json()['items'])
    assert c.get('/study/overview').json()['completed']==0

def test_backups_recompute_choices_and_merge_without_overwriting_first_answer(client,tmp_path,monkeypatch):
    c=client;l=curriculum.LESSONS[0];c.post('/study/lessons/'+l['id']+'/open');c.post('/study/lessons/'+l['id']+'/read');first=answer(c,l,False)
    pack=c.get('/study/backup/file').json();pack['progress'][0]['completed']=True;pack['progress'][0]['attempts'][0]['correct']=True
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'restored.sqlite')
    assert c.post('/study/backup/restore',json=pack).status_code==200
    v=c.get('/study/lessons/'+l['id']).json()['progress'];assert not v['completed'] and v['first_answer']==first['first_answer']
    answer(c,l);new=c.get('/study/backup/file').json()
    assert c.post('/study/backup/restore',json=new).status_code==200
    assert c.get('/study/lessons/'+l['id']).json()['progress']['first_answer']==first['first_answer']
    assert c.post('/study/backup/restore',json=None).status_code==422
