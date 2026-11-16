import json,uuid
from contextlib import closing
import httpx,pytest
from fastapi.testclient import TestClient
from backend import main,workspace,coach,deepseek

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DB_PATH',tmp_path/'pet.sqlite');monkeypatch.setattr(workspace,'ENV_PATH',tmp_path/'.env')
    monkeypatch.setenv('AI_BASE_URL',deepseek.BASE_URL);monkeypatch.setenv('AI_MODEL','deepseek-flash');monkeypatch.setenv('AI_ENABLED','0');monkeypatch.setenv('AI_API_KEY','fixture-private-token');monkeypatch.setenv('AI_REASONING_EFFORT','xhigh')
    with TestClient(main.app) as c:yield c

def ask(c,**values):
    body={'id':uuid.uuid4().hex,'session_id':'a'*32,'question':'什么是过拟合？',**values};r=c.post('/pet/ask',json=body);assert r.status_code==200,r.text;return body,r.json()

@pytest.mark.parametrize('depth',['none','low','high','max','xhigh'])
def test_deepseek_only_settings_apply_depth_to_real_request_and_never_echo_key(client,monkeypatch,depth):
    c=client;calls=[]
    class Fake:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*a):pass
        async def post(self,url,**kw):
            assert url=='https://api.deepseek.com/v1/chat/completions';calls.append(kw['json'])
            return httpx.Response(200,json={'model':'deepseek-flash','choices':[{'message':{'content':'模型在训练集表现好，并不保证验证表现。','reasoning_content':'private-thought'}}],'usage':{'total_tokens':23}})
    monkeypatch.setattr(httpx,'AsyncClient',Fake)
    r=c.post('/workspace/settings',json={'model':'deepseek-flash','enabled':True,'reasoning_effort':depth,'api_key':''});assert r.status_code==200 and 'fixture-private' not in r.text
    assert c.post('/workspace/settings/test').json()['state']=='ok'
    b,a=ask(c);assert a['mode']=='online' and a['usage']['total_tokens']==23
    assert calls[-1]['reasoning_effort']==depth and calls[-1]['thinking']['type']==('disabled' if depth=='none' else 'enabled')
    assert calls[0]['reasoning_effort']==depth
    assert 'private-thought' not in json.dumps(a) and 'fixture-private' not in json.dumps(c.get('/pet/sessions/'+b['session_id']).json())
    assert a['provider_effort']==('high' if depth=='xhigh' else depth)

def test_settings_refuse_other_hosts_models_and_validation_does_not_return_key(client):
    c=client
    for host in ['https://example.org/v1','https://api.deepseek.com.evil.org','https://api.deepseek.com@evil.org/v1','http://api.deepseek.com','https://api.deepseek.com/v1?token=x']:
        assert c.post('/workspace/settings',json={'base_url':host}).status_code==422
    assert c.post('/workspace/settings',json={'model':'other-provider'}).status_code==422
    bad='sensitive-key\nnew-line';r=c.post('/workspace/settings',json={'api_key':bad});assert r.status_code==422 and bad not in r.text and 'sensitive-key' not in r.text
    r=c.post('/workspace/settings',json={'api_key':'new-fake-test-token','reasoning_effort':'low'});assert r.status_code==200 and 'new-fake' not in r.text
    c.post('/workspace/settings',json={'remove_key':True});assert not c.get('/workspace/settings').json()['key_configured']
    assert 'AI_API_KEY' not in workspace.ENV_PATH.read_text()

def test_pet_offline_history_idempotency_and_no_learning_award(client):
    c=client;b,a=ask(c);assert a['mode']=='rules' and '过拟合' in a['answer']
    assert c.post('/pet/ask',json=b).json()==a
    assert len(c.get('/pet/sessions/'+b['session_id']).json())==1
    assert c.get('/study/overview').json()['completed']==0
    ask(c,save_history=False,question='分类和回归怎么选？',recent=[{'question':'预测企鹅物种','answer':'类别预测'}]);assert len(c.get('/pet/sessions/'+b['session_id']).json())==1

def test_pet_preserves_unsubmitted_knowledge_answers_and_omits_private_context(client,monkeypatch):
    c=client;c.post('/study/lessons/ml-intro/open');c.post('/study/lessons/ml-intro/read')
    b,a=ask(c,question='这道题选哪个选项？',context={'view':'learning','lesson_id':'ml-intro'})
    assert a['mode']=='guided' and '不直接指出' in a['answer']
    assert '输入信息与要预测的目标' not in a['answer']
    assert not c.get('/study/lessons/ml-intro').json()['progress']['attempts']
    assert ask(c,question='这题答案是哪个？',context={'view':'learning','lesson_id':'ml-intro'},share_context=False)[1]['mode']=='guided'
    calls=[]
    class Fake:
        def __init__(self,**k):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*a):pass
        async def post(self,url,**kw):calls.append(kw['json']);return httpx.Response(200,json={'choices':[{'message':{'content':'从规律学习的概念解释。'}}]})
    monkeypatch.setattr(httpx,'AsyncClient',Fake);monkeypatch.setenv('AI_ENABLED','1')
    ask(c,question='介绍一下这个概念',context={'view':'learning','lesson_id':'ml-intro'})
    wire=json.dumps(calls[-1]);payload=json.loads(calls[-1]['messages'][1]['content']);assert '_answer' not in payload['context'].get('lesson',{}) and '_explanation' not in payload['context'].get('lesson',{}) and 'fixture-private' not in wire
    ask(c,question='什么是模型',share_context=False,context={'view':'learning','lesson_id':'ml-intro'})
    assert 'sections' not in json.dumps(calls[-1])

def test_pet_experiment_context_uses_actual_snapshot_without_data_rows_or_test(client,monkeypatch):
    from backend import planet_data,planet_engine
    from test_planet_engine import spec_for
    c=client;c.get('/lab/runs');s=spec_for();d=planet_data.builtin('iris');split=planet_engine.split_rows(d,s)
    result,_=planet_engine.fit_payload({'dataset':d,'spec':s.model_dump(),'split':planet_engine.safe_json(split)})
    run_id=uuid.uuid4().hex
    with closing(main.connect()) as db:
        db.execute('INSERT INTO planet_runs(id,content) VALUES(?,?)',(run_id,json.dumps({'id':run_id,'state':'completed','operation':'train','spec':s.model_dump(),'result':result})));db.commit()
    calls=[]
    class Fake:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*a):pass
        async def post(self,url,**kw):calls.append(kw['json']);return httpx.Response(200,json={'choices':[{'message':{'content':'按这份验证证据进行比较。'}}]})
    monkeypatch.setattr(httpx,'AsyncClient',Fake);monkeypatch.setenv('AI_ENABLED','1')
    _,a=ask(c,question='怎样理解这次验证？',context={'view':'workbench','run_id':run_id,'draft_changed':True})
    evidence=json.loads(calls[-1]['messages'][1]['content'])['context']['experiment']
    assert evidence['validation_metrics']==result['validation_metrics'] and evidence['draft_changed']
    assert not {'training','validation','test','records','final'} & set(evidence)
    assert 'training_rows' not in evidence['cleaning']
    assert a['actions'][0]['id']==run_id
