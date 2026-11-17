import copy,json,sqlite3
import joblib
import pytest
from backend import transfer_assessment as assessment,planet_data,planet_engine,planet_analysis,planet_worker,legacy_roles
from test_planet_engine import spec_for

def question(i=1):
    return {'id':f'{i:032x}','assessment_version':2,'before_spec':{'seed':42,'model':'knn_c'},'change':{'label':'邻居数K'},
        'observations':{'before':.2,'after':.1,'before_training':.05,'after_training':.08},'_truth':1,'decision':{'choice':0},'answer':None}

def test_correct_understanding_can_pass_with_an_inaccurate_or_uncertain_forecast():
    for forecast in (0,3):
        q=question();q['decision']['choice']=forecast;assessment.prepare(q)
        q['answer']={'reason':q['_reason'],'interpretation':1,'submitted_at':'original'};assessment.grade(q)
        assert q['answer']['passed'] and q['answer']['understanding_passed']
        assert q['answer']['prediction_matched'] is (False if forecast==0 else None)
        assert q['decision']['choice']==forecast and q['answer']['submitted_at']=='original'
        q['answer']['interpretation']=0;assessment.grade(q);assert not q['answer']['passed']

def test_legacy_grade_and_question_remain_legacy():
    q=question();q.pop('assessment_version');assessment.prepare(q);texts=copy.deepcopy(q['reasons'])
    q['answer']={'reason':q['_reason']};assessment.grade(q)
    assert not q['answer']['passed'] and 'understanding_passed' not in q['answer']
    assessment.prepare(q);assert q['reasons']==texts

def test_contextual_reason_checks_vary_without_always_using_the_longest_answer():
    longest=0;shortest=0;variants=set();slots=set()
    for i in range(1,121):
        q=question(i);assessment.prepare(q);texts=q['reasons'];right=texts[q['_reason']]
        variants.add(q['reason_variant']);slots.add(q['_reason'])
        longest+=all(len(right)>len(v) for j,v in enumerate(texts) if j!=q['_reason'])
        shortest+=all(len(right)<len(v) for j,v in enumerate(texts) if j!=q['_reason'])
        if q['reason_variant']==0:assert '训练误差升高，验证误差降低' in right
        assert len(set(texts))==3
    assert variants==slots=={0,1,2} and longest<60 and shortest<60

def test_actual_transfer_worker_uses_locked_test_roles(tmp_path):
    d=planet_data.builtin('iris');s=spec_for('iris','knn_c');original=planet_engine.split_rows(d,s)
    _,a=planet_engine.fit_payload({'dataset':d,'spec':s.model_dump(),'split':planet_engine.safe_json(original)})
    path=tmp_path/'trusted.joblib';joblib.dump(a,path)
    before=s.model_copy(deep=True);before.seed=10015;after=before.model_copy(deep=True);after.parameters['n_neighbors']=11
    locked=planet_engine.split_rows(d,before,original['anchor']);events=[]
    class Sink:
        def put(self,item):events.append(item)
    planet_worker.work({'dataset':d,'spec':before.model_dump(),'split':planet_engine.safe_json(locked)},str(path),Sink(),'challenge',{'before':before.model_dump(),'after':after.model_dump()})
    assert not [v for k,v in events if k=='error']
    value=next(v for k,v in events if k=='result');used={locked['rows'][i]['entity'] for i in value['_fit']+value['_validation']}
    assert not used&set(original['anchor']['test_entities'])
    assert value['signature']==locked['signature']

def test_legacy_role_audit_preserves_choices_metrics_and_temporal_independence():
    d=planet_data.builtin('iris');s=spec_for('iris','knn_c');original=planet_engine.split_rows(d,s)
    result,a=planet_engine.fit_payload({'dataset':d,'spec':s.model_dump(),'split':planet_engine.safe_json(original)})
    before=s.model_copy(deep=True);before.seed=10015;after=before.model_copy(deep=True);after.parameters['n_neighbors']=11
    old=planet_engine.split_rows(d,before);assert set(original['roles']['test'])&set(old['roles']['training'])
    q={'id':'c'*32,'source_id':'a'*32,'created_at':'2026-11-16T02:00:00+00:00','before_spec':before.model_dump(),'after_spec':after.model_dump(),'decision':{'choice':0},'answer':{'reason':1},'observations':{'signature':old['signature']}}
    cached=planet_analysis.final(a);cached.update(independent=True,evaluated_at='2026-11-16T03:00:00+00:00',note='原首次结论')
    r={'id':'a'*32,'spec':s.model_dump(),'result':result,'_split':planet_engine.safe_json(original),'final':cached}
    early=copy.deepcopy(r);early['id']='b'*32;early['final']['evaluated_at']='2026-11-16T01:00:00+00:00'
    with sqlite3.connect(':memory:') as c:
        c.row_factory=sqlite3.Row
        for table in ['planet_runs','planet_quizzes']:c.execute(f'CREATE TABLE {table}(id TEXT PRIMARY KEY,content TEXT)')
        c.execute('CREATE TABLE planet_exposure(source TEXT,entity TEXT,kind TEXT,PRIMARY KEY(source,entity,kind))')
        for value,table in [(r,'planet_runs'),(early,'planet_runs'),(q,'planet_quizzes')]:c.execute(f'INSERT INTO {table} VALUES(?,?)',(value['id'],json.dumps(value)))
        legacy_roles.reconcile(c)
        changed=json.loads(c.execute('SELECT content FROM planet_runs WHERE id=?',(r['id'],)).fetchone()[0])
        kept=json.loads(c.execute('SELECT content FROM planet_runs WHERE id=?',(early['id'],)).fetchone()[0])
        history=json.loads(c.execute('SELECT content FROM planet_quizzes').fetchone()[0])
        assert not changed['final']['independent'] and changed['final']['metrics']==cached['metrics']
        assert changed['final']['previous_independence']['independent']
        assert kept['final']['independent'] and kept['final']['later_exposure_note']
        assert history['decision']==q['decision'] and history['answer']==q['answer'] and history['observations']==q['observations']
        count=c.execute('SELECT count(*) FROM planet_exposure').fetchone()[0];legacy_roles.reconcile(c)
        assert c.execute('SELECT count(*) FROM planet_exposure').fetchone()[0]==count
