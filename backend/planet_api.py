"""Model Planet classroom API and bounded, cancellable training jobs."""
import copy
import hashlib
import json
import multiprocessing
import queue
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime,timezone
from pathlib import Path
from fastapi import APIRouter,HTTPException,Request
from fastapi.responses import Response
from pydantic import BaseModel,Field,ValidationError
from backend import planet_data as data,planet_models as models,planet_engine as engine
from backend.planet_worker import work
from backend import coach

ARTIFACTS=Path(__file__).resolve().parents[1]/'artifacts/local/modelplanet'
GATE=threading.Semaphore(1)
CANCEL={}


def now():return datetime.now(timezone.utc).isoformat()


class RunRequest(engine.Strict):
    spec:engine.Spec
    source_id:str|None=Field(default=None,pattern=r'^[0-9a-f]{32}$')


class ImportRequest(engine.Strict):
    name:str=Field(min_length=1,max_length=80)
    csv:str=Field(max_length=5*1024*1024)
    targets:list[str]
    task:str
    unit:str='原始单位'
    id_columns:list[str]=Field(default_factory=list)
    time_column:str|None=None


def make_router(connect):
    router=APIRouter(prefix='/lab')
    @contextmanager
    def db():
        with connect() as c:
            for table in ('planet_runs','planet_sessions','planet_imports','planet_plans','planet_quizzes'):
                c.execute(f'CREATE TABLE IF NOT EXISTS {table}(id TEXT PRIMARY KEY,content TEXT NOT NULL)')
            c.execute('CREATE TABLE IF NOT EXISTS planet_exposure(source TEXT,entity TEXT,kind TEXT,PRIMARY KEY(source,entity,kind))')
            yield c
    def save(c,table,item):c.execute(f'INSERT OR REPLACE INTO {table}(id,content) VALUES(?,?)',(item['id'],json.dumps(engine.safe_json(item),ensure_ascii=False,allow_nan=False)))
    def load(c,table,key):
        r=c.execute(f'SELECT content FROM {table} WHERE id=?',(key,)).fetchone()
        if not r:raise HTTPException(404,'记录不存在，请从实验档案恢复。')
        return json.loads(r['content'])
    def dataset(key):
        if key.startswith('upload_'):
            with db() as c:return load(c,'planet_imports',key)
        try:return data.builtin(key)
        except (ValueError,KeyError,StopIteration):raise HTTPException(404,'数据快照不存在，请重新导入相同CSV。')
    def public(run):return {k:v for k,v in run.items() if not k.startswith('_')}
    def update(key,**values):
        with db() as c:
            run=load(c,'planet_runs',key);run.update(values,updated_at=now());save(c,'planet_runs',run)
    def mark(c,d,rows,ids,kind):
        c.executemany('INSERT OR IGNORE INTO planet_exposure(source,entity,kind) VALUES(?,?,?)',
            [(d['family'],prefix+rows[int(i)][key],kind) for i in ids for prefix,key in [('g:','entity'),('r:','exposure')]])
    def exposed(c,d,entities):
        known={r['entity'] for r in c.execute('SELECT entity FROM planet_exposure WHERE source=?',(d['family'],))}
        return len(known&set(entities))
    def split(s,d,commit_anchor=False):
        with db() as c:
            r=c.execute('SELECT content FROM planet_sessions WHERE id=?',(s.session_id,)).fetchone();session=json.loads(r['content']) if r else None
            anchor=session.get('anchor') if session else None
            sp=engine.split_rows(d,s,anchor if anchor and s.split.keep_test else None)
            if commit_anchor and not session:
                save(c,'planet_sessions',{'id':s.session_id,'created_at':now(),'basis_spec':s.model_dump(),'anchor':sp['anchor']})
        return sp
    def artifact_for(run):
        key=run.get('_artifact',run['id'])
        if len(key)!=32 or any(c not in '0123456789abcdef' for c in key):raise HTTPException(409,'模型缓存标识无效，请重新训练。')
        path=ARTIFACTS/f'{key}.joblib'
        if not path.exists():raise HTTPException(409,'本机模型缓存尚未恢复，请用此配置重新训练。')
        return path

    def launch(s,d,sp,operation='train',source=None,extra=None,existing_id=None):
        if sum(1 for e in CANCEL.values() if not e.is_set())>8:raise HTTPException(429,'等待的实验较多，请先取消不需要的运行。')
        key=existing_id or uuid.uuid4().hex;extra=extra or {}
        path=ARTIFACTS/f'{key}.joblib' if operation=='train' else artifact_for(source)
        ARTIFACTS.mkdir(parents=True,exist_ok=True)
        fit_spec=s.model_dump();fit_spec.pop('decision',None);fit_spec.pop('prediction',None);fit_spec.pop('assisted',None)
        run={'id':key,'created_at':now(),'updated_at':now(),'state':'queued','phase':'等待计算资源','operation':operation,
            'spec':s.model_dump(),'dataset_title':d['title'],'dataset_version':d['version'],'source_id':source['id'] if source else None,
            'fit_fingerprint':engine.hash_config(fit_spec),'result':None,'error':None,'_split':engine.safe_json(sp),
            '_artifact':key if operation in ('train','decision') else source.get('_artifact',source['id'])}
        event=threading.Event();CANCEL[key]=event
        with db() as c:
            old=c.execute('SELECT content FROM planet_runs WHERE id=?',(key,)).fetchone()
            session=c.execute('SELECT content FROM planet_sessions WHERE id=?',(s.session_id,)).fetchone()
            if (old and json.loads(old['content']).get('imported')) or (source and source.get('imported')) or (session and json.loads(session['content']).get('imported')):run['imported']=True
            save(c,'planet_runs',run)
        payload={'dataset':d,'spec':s.model_dump(),'split':engine.safe_json(sp)}
        if operation=='decision':
            payload['base_result']=source['result'];extra['_destination']=str(ARTIFACTS/f'{key}.joblib')
        def execute():
            with GATE:
                if event.is_set():update(key,state='cancelled',phase='已取消');return
                if operation in ('train','learning','challenge'):
                    ids=sp['roles']['training']
                    if operation in ('train','challenge'):ids=__import__('numpy').random.default_rng(s.seed+741).permutation(ids)[:max(2,int(len(ids)*s.training_fraction))].tolist()
                    with db() as c:mark(c,d,sp['rows'],ids,'fit')
                independent=None
                if operation=='final':
                    with db() as c:
                        entities=[prefix+sp['rows'][i][field] for i in sp['roles']['test'] for prefix,field in [('g:','entity'),('r:','exposure')]]
                        independent=exposed(c,d,entities)==0 and not source.get('imported') and (not d.get('time_column') or s.split.strategy=='time')
                        mark(c,d,sp['rows'],sp['roles']['test'],'test')
                context=multiprocessing.get_context('spawn');out=context.Queue();process=context.Process(target=work,args=(payload,str(path),out,operation,extra),daemon=True)
                try:
                    process.start();start=time.monotonic();update(key,state='running',phase='校验并建立训练流水线')
                    while True:
                        if event.is_set():process.terminate();process.join(2);update(key,state='cancelled',phase='已停止本次计算');break
                        if time.monotonic()-start>30:process.terminate();process.join(2);update(key,state='timeout',phase='达到30秒课堂预算',error='请减少模型规模或训练样本后再试。');break
                        try:kind,value=out.get(timeout=.2)
                        except queue.Empty:
                            if not process.is_alive():
                                try:kind,value=out.get(timeout=1)
                                except queue.Empty:update(key,state='failed',phase='计算进程未完成',error='请重新训练或核对配置。');break
                            else:continue
                        if kind=='phase':
                            update(key,phase=value)
                            if '验证样本' in value:
                                with db() as c:mark(c,d,sp['rows'],sp['roles']['validation'],'validation')
                        elif kind=='error':update(key,state='failed',phase='需要调整这组配置',error=value);break
                        elif kind=='result':
                            if operation=='stability':
                                with db() as c:
                                    mark(c,d,sp['rows'],value.pop('_fit',[]),'fit');mark(c,d,sp['rows'],value.pop('_validation',[]),'validation')
                            if operation=='challenge':
                                quiz=extra['_quiz'];a,b=value['before'],value['after']
                                if a is None or b is None:raise ValueError('新情境缺少可比较的汇总指标。')
                                truth=2 if abs(a-b)<=1e-8+abs(a)*1e-6 else 0 if a<b else 1
                                quiz.update(observations=value,_truth=truth,state='ready')
                                if quiz.get('answer'):
                                    quiz['answer'].update(passed=quiz['decision']['choice']==truth and quiz['answer']['reason']==quiz['_reason'],correct_choice=truth,correct_reason=quiz['_reason'])
                                with db() as c:
                                    mark(c,d,sp['rows'],sp['roles']['validation'],'validation');save(c,'planet_quizzes',quiz)
                                value={'quiz_id':quiz['id'],'state':'ready'}
                            if operation=='final':value.update(independent=independent,evaluated_at=now(),note='本平台流程中的独立留出评估' if independent else '已参与学习/诊断的数据，结果为探索性重评')
                            update(key,state='completed',phase='计算完成',result=value)
                            if source and operation not in ('train','decision'):
                                with db() as c:
                                    parent=load(c,'planet_runs',source['id'])
                                    if operation=='final':parent['final']=value
                                    elif operation in ('learning','surface','scan','stability'):parent.setdefault('analyses',{})[operation]=value
                                    save(c,'planet_runs',parent)
                            break
                except Exception:
                    update(key,state='failed',phase='计算未启动',error='本次计算未完成，请重试或检查本机服务。')
                finally:
                    if process.is_alive():process.join(.5)
                    if process.is_alive():process.terminate();process.join(2)
                    out.close();event.set()
        threading.Thread(target=execute,daemon=True).start()
        return public(run)

    @router.get('/catalog')
    def catalog():
        datasets=[data.public(data.builtin(k)) for k in data.BUILTINS]
        with db() as c:datasets.extend(data.public(json.loads(r['content'])) for r in c.execute('SELECT content FROM planet_imports'))
        return {'brand':'模力星球','models':models.catalog(),'datasets':datasets,'limits':{'rows':5000,'features':50,'expanded_features':500,'seconds':30}}

    @router.post('/import')
    def import_data(request:ImportRequest):
        try:d=data.import_csv(request.name,request.csv,request.targets,request.task,request.unit,request.id_columns,request.time_column)
        except (ValueError,TypeError) as e:raise HTTPException(422,str(e))
        d['_import']=request.model_dump()
        with db() as c:save(c,'planet_imports',d)
        return data.public(d)

    @router.post('/import/inspect')
    def import_inspect(request:dict):
        text=request.get('csv','')
        if not isinstance(text,str) or len(text.encode())>5*1024*1024:raise HTTPException(413,'CSV限5MB。')
        import csv,io
        try:
            try:dialect=csv.Sniffer().sniff(text[:8192],delimiters=',;\t')
            except csv.Error:dialect=csv.excel
            rows=list(csv.reader(io.StringIO(text),dialect));headers=[h.strip().lstrip('\ufeff') for h in rows[0]]
            if not headers or len(headers)>55 or len(rows)>5001 or len(headers)!=len(set(headers)) or any(not h for h in headers) or any(len(r)!=len(headers) for r in rows):raise ValueError()
        except (ValueError,IndexError,csv.Error):raise HTTPException(422,'CSV表头/行列格式不正确。')
        return {'headers':headers,'rows':len(rows)-1}

    @router.get('/datasets/{key}')
    def inspect_data(key:str):return data.inspect(dataset(key))

    @router.post('/legacy-exposure')
    def legacy_exposure(request:dict):
        keys=request.get('datasets',[])
        if not isinstance(keys,list) or len(keys)>5 or not set(keys)<={'wine','auto','concrete','iris','seeds'}:raise HTTPException(422,'旧课例来源不合法。')
        with db() as c:
            for key in keys:
                d=dataset(key);mark(c,d,d['records'],range(len(d['records'])),'legacy')
        return {'recorded':keys,'note':'旧机制探索未逐行记录，保守标记来源已探索，不能重置为未知测试。'}

    @router.post('/preview')
    def preview(s:engine.Spec):
        d=dataset(s.dataset)
        try:sp=split(s,d,True)
        except (ValueError,IndexError) as e:raise HTTPException(422,str(e))
        samples=sp['roles']['training'][:12]
        with db() as c:
            mark(c,d,sp['rows'],samples,'diagnostic')
            seen=exposed(c,d,[prefix+sp['rows'][i][field] for i in sp['roles']['test'] for prefix,field in [('g:','entity'),('r:','exposure')]])
        return {'counts':{k:len(v) for k,v in sp['roles'].items()},'requested':s.split.model_dump(),'selection_offset':sp['selection_offset'],
            'classes':sp['classes'],'distributions':{role:[[int(__import__('numpy').sum(sp['y'][ids,j]==i)) for i in range(len(cls))] for j,cls in enumerate(sp['classes'])] for role,ids in sp['roles'].items()},
            'test_previously_seen_entities':seen,'evaluation_signature':sp['signature'],'training_preview':[sp['rows'][i] for i in samples],
            'note':'显示实际行数；分组可能使实际比例略有差异。仅预览训练行，目标缺失行未加入监督评分。'}

    @router.post('/runs')
    def train(request:RunRequest):
        s=request.spec;d=dataset(s.dataset)
        try:
            sp=split(s,d,True);engine.prepare(d,s,sp)
        except (ValueError,TypeError,IndexError) as e:raise HTTPException(422,str(e))
        source=None;operation='train'
        if request.source_id:
            with db() as c:source=load(c,'planet_runs',request.source_id)
            old=copy.deepcopy(source['spec']);new=s.model_dump()
            for v in (old,new):v.pop('decision',None);v.pop('prediction',None);v.pop('assisted',None)
            if old==new and source['state']=='completed' and source['operation'] in ('train','decision'):operation='decision'
        return launch(s,d,sp,operation,source)

    @router.get('/runs')
    def history():
        with db() as c:rows=c.execute('SELECT content FROM planet_runs ORDER BY rowid DESC LIMIT 150').fetchall()
        return [{k:r.get(k) for k in ('id','created_at','updated_at','state','phase','operation','spec','dataset_title','source_id','error','final','imported')}
            for row in rows if (r:=json.loads(row['content']))['operation'] in ('train','decision')]

    @router.get('/runs/{key}')
    def get_run(key:str):
        with db() as c:
            run=load(c,'planet_runs',key)
            if run['state'] in ('queued','running') and (key not in CANCEL or CANCEL[key].is_set()):
                run.update(state='failed',phase='上次计算被服务重启中断',error='可以保留这份配置重新训练。');save(c,'planet_runs',run)
            return public(run)

    @router.post('/runs/{key}/cancel')
    def cancel(key:str):
        with db() as c:r=load(c,'planet_runs',key)
        if key in CANCEL and r['state'] in ('queued','running'):CANCEL[key].set()
        return {'requested':True,'state':r['state']}

    @router.post('/runs/{key}/analysis/{kind}')
    def analyze(key:str,kind:str,request:dict=None):
        if kind not in ('inspect','surface','learning','scan','stability'):raise HTTPException(404,'分析视图不存在。')
        with db() as c:r=load(c,'planet_runs',key)
        if r['state']!='completed' or r['operation'] not in ('train','decision'):raise HTTPException(409,'先完成一组训练。')
        s=engine.Spec.model_validate(r['spec']);return launch(s,dataset(s.dataset),r['_split'],kind,r,request or {})

    @router.post('/runs/{key}/final')
    def final(key:str):
        with db() as c:r=load(c,'planet_runs',key)
        if r.get('final'):return {'id':key,'state':'completed','operation':'final','result':r['final'],'phase':'回看首次测试记录'}
        if r['state']!='completed':raise HTTPException(409,'先完成并锁定这组训练。')
        s=engine.Spec.model_validate(r['spec']);return launch(s,dataset(s.dataset),r['_split'],'final',r)

    @router.post('/compare')
    def compare(request:dict):
        with db() as c:a=load(c,'planet_runs',request.get('a',''));b=load(c,'planet_runs',request.get('b',''))
        if a['state']!='completed' or b['state']!='completed' or not a.get('result') or not b.get('result'):raise HTTPException(409,'选择两组已完成的训练。')
        ar,br=a['result'],b['result']
        if 'validation_metrics' not in ar or 'validation_metrics' not in br:raise HTTPException(409,'请选择训练运行进行比较。')
        comparable=ar['evaluation_signature']==br['evaluation_signature'] and a['spec']['targets']==b['spec']['targets']
        def changes(x,y,prefix=''):
            values=[]
            for k in set(x)|set(y):
                if k in ('prediction','session_id','assisted'):continue
                f=f'{prefix}.{k}' if prefix else k
                if isinstance(x.get(k),dict) and isinstance(y.get(k),dict):values+=changes(x[k],y[k],f)
                elif x.get(k)!=y.get(k):values.append({'field':f,'before':x.get(k),'after':y.get(k)})
            return values
        diff=changes(a['spec'],b['spec']);first,last=ar['validation_error'],br['validation_error']
        return {'comparable':comparable,'changes':diff,'before':first,'after':last,'delta':last-first if comparable and first is not None and last is not None else None,
            'note':'同一评估群体上的实际变化' if comparable else '评估样本不同，仅并列观察，不直接判断胜负', 'single_change':len(diff)==1}

    def candidates(run):
        s=run['spec'];m=models.MODELS[s['model']];options=[];actual=run['result']['parameters']
        for f in m['parameters']+m['advanced']:
            value=actual[f['key']]
            if f['kind']=='choice':values=[o['value'] for o in f['options'] if o['value']!=value]
            else:
                values=[min(f['max'],max(f['min'],value*2)),min(f['max'],max(f['min'],value/2))]
                if f['kind']=='integer':values=[int(round(v)) for v in values]
            for target in values:
                if target==value:continue
                options.append({'id':f"p-{len(options)}",'control':f"parameters.{f['key']}",'label':f['label'],'from_value':value,'to_value':target})
        for scale in ('none','standard','minmax','robust'):
            if scale!=s['cleaning']['scale']:options.append({'id':f'p-{len(options)}','control':'cleaning.scale','label':'数值缩放','from_value':s['cleaning']['scale'],'to_value':scale})
        legal=[]
        for option in options:
            try:
                proposed=target_spec(run,option);stored=copy.deepcopy(run['_split']);stored['y']=__import__('numpy').asarray(stored['y'])
                engine.prepare(dataset(proposed.dataset),proposed,stored)
                legal.append(option)
            except ValueError:continue
        return legal
    def target_spec(run,candidate):
        value=copy.deepcopy(run['spec']);section,field=candidate['control'].split('.')
        value[section][field]=candidate['to_value'];value['assisted']=True
        return engine.Spec.model_validate(value)
    def plan_public(plan):
        value=copy.deepcopy(plan)
        if plan.get('execution_id'):
            with db() as c:r=load(c,'planet_runs',plan['execution_id'])
            value['execution_state']=r['state'];value['execution_error']=r.get('error')
            if r['state']=='completed':
                a,b=plan['before'],r['result']['validation_error'];same=plan['signature']==r['result']['evaluation_signature']
                observed='uncertain' if a is None or b is None or not same else 'unchanged' if abs(a-b)<=1e-8+abs(a)*1e-6 else 'lower' if b<a else 'higher'
                value['execution']={'before':a,'after':b,'observed':observed,'comparable':same,
                    'verdict':'observed' if plan['expected']=='uncertain' or observed=='uncertain' else 'supported' if plan['expected']==observed else 'not_supported'}
        return value

    @router.post('/plans')
    async def plan(request:dict):
        with db() as c:r=load(c,'planet_runs',request.get('run_id',''))
        if r['state']!='completed' or r['operation'] not in ('train','decision'):raise HTTPException(409,'先完成一组训练。')
        options=candidates(r)
        if not options:raise HTTPException(409,'当前配置没有可执行的单项变化，请先调整任务。')
        evidence={'parameters':r['spec'],'metric':'验证错误率' if r['spec']['task']=='classification' else '验证误差',
            'value':r['result']['validation_error'],'learning_context':{'prediction':r['spec']['prediction'],'training':r['result']['training_metrics'],
                'validation':r['result']['validation_metrics'],'cleaning':r['result']['cleaning']}}
        response=await coach.suggest(evidence,options)
        proposal=response.get('suggestion') or {};selected=next((v for v in options if v['id']==proposal.get('candidate_id')),options[0])
        expected=proposal.get('expected');expected=expected if expected in ('lower','higher','uncertain') else 'uncertain'
        hypothesis=str(proposal.get('hypothesis') or '固定评估样本，只改变这一项，核对真实验证表现。')[:500]
        target=target_spec(r,selected);target.prediction=hypothesis
        value={'id':uuid.uuid4().hex,'created_at':now(),'run_id':r['id'],'change':selected,'target_spec':target.model_dump(),
            'hypothesis':hypothesis,'expected':expected,'mode':response['mode'],'model':response.get('model'),'notice':response.get('notice',''),
            'reasoning_effort':coach.ai_status()['reasoning_effort'],'before':r['result']['validation_error'],'signature':r['result']['evaluation_signature']}
        with db() as c:save(c,'planet_plans',value)
        return value

    @router.post('/runs/{key}/explain')
    async def explain_config(key:str):
        with db() as c:r=load(c,'planet_runs',key)
        if r['state']!='completed' or r['operation'] not in ('train','decision'):raise HTTPException(409,'先完成一组真实训练。')
        result=r['result'];evidence={'dataset':result['dataset']['title'],'parameters':r['spec'],
            'training':result['training_metrics'],'validation':result['validation_metrics'],
            'actual_training':result['cleaning']['actual_training'],'processed_features':result['cleaning']['processed_features'],
            'available_controls':candidates(r)}
        fallback=f"本次使用{result['dataset']['title']}，实际训练{result['cleaning']['actual_training']}条，处理后{result['cleaning']['processed_features']}列。填补、缩放和编码仅从这批训练数据学习。验证结果用于探索；保持评估群体，只修改一项处理或参数再比较。具体误差请核对本页实际指标，不能据训练表现推断测试成绩。"
        return await coach.explain(evidence,'解释这份配置各项选择的作用，并根据实际训练与验证证据指出一个可核验的下一步。',fallback)

    @router.get('/plans/{key}')
    def get_plan(key:str):
        with db() as c:p=load(c,'planet_plans',key)
        return plan_public(p)

    @router.post('/plans/{key}/execute')
    def execute_plan(key:str):
        with db() as c:p=load(c,'planet_plans',key);r=load(c,'planet_runs',p['run_id'])
        if p.get('execution_id'):return get_run(p['execution_id'])
        s=engine.Spec.model_validate(p['target_spec']);d=dataset(s.dataset)
        try:sp=split(s,d);engine.prepare(d,s,sp)
        except ValueError as e:raise HTTPException(422,str(e))
        result=launch(s,d,sp,'train',r)
        with db() as c:p['execution_id']=result['id'];save(c,'planet_plans',p)
        return result

    def quiz_public(q):
        v={k:value for k,value in q.items() if not k.startswith('_')}
        if not q.get('decision'):v['reasons']=[]
        return v
    def create_quiz(source,plan_id=None):
        d=dataset(source['spec']['dataset']);option=candidates(source)[0]
        for step in range(1,21):
            before=engine.Spec.model_validate(source['spec']);before.seed=(before.seed+step*9973)%1000000;before.split.keep_test=True
            if before.split.strategy=='time':before.training_fraction=.75
            after=target_spec({'spec':before.model_dump()},option)
            try:sp=engine.split_rows(d,before,source['_split']['anchor']);engine.prepare(d,before,sp);engine.prepare(d,after,sp);break
            except ValueError:
                if step==20:raise HTTPException(422,'当前条件无法形成有效新情境，请调整模型或样本量。')
        reason=int(hashlib.sha256(f'{before.seed}:{before.model}'.encode()).hexdigest()[:8],16)%3
        reasons=['比较训练误差，以对已见样本的拟合作为新样本表现依据。','比较模型复杂程度，以模型能力作为本次验证表现依据。']
        reasons.insert(reason,'比较同一验证群体的实算误差，把训练表现与模型复杂度另作解释。')
        q={'id':uuid.uuid4().hex,'created_at':now(),'source_id':source['id'],'plan_id':plan_id,'state':'preparing','before_spec':before.model_dump(),'after_spec':after.model_dump(),
            'change':option,'question':'在这组新条件下，哪一组的验证误差更低？','choices':['A更低','B更低','近似相同'],'reasons':reasons,
            'decision':None,'answer':None,'assisted':bool(plan_id or before.assisted),'_reason':reason}
        with db() as c:save(c,'planet_quizzes',q)
        job=launch(before,d,sp,'challenge',source,{'before':before.model_dump(),'after':after.model_dump(),'_quiz':q})
        with db() as c:q['job_id']=job['id'];save(c,'planet_quizzes',q)
        return job

    @router.post('/runs/{key}/challenge')
    def challenge(key:str):
        with db() as c:r=load(c,'planet_runs',key)
        if r['state']!='completed' or r['operation'] not in ('train','decision'):raise HTTPException(409,'先完成训练，再创建新情境。')
        return create_quiz(r)

    @router.post('/plans/{key}/challenge')
    def ai_challenge(key:str):
        with db() as c:p=load(c,'planet_plans',key)
        if not p.get('execution_id'):raise HTTPException(409,'先执行这项方案。')
        with db() as c:r=load(c,'planet_runs',p['execution_id'])
        if r['state']!='completed':raise HTTPException(409,'等待实际训练完成，再进入新情境。')
        return create_quiz(r,key)

    @router.get('/quizzes/{key}')
    def get_quiz(key:str):
        with db() as c:return quiz_public(load(c,'planet_quizzes',key))

    @router.get('/quizzes')
    def quiz_history():
        with db() as c:rows=c.execute('SELECT content FROM planet_quizzes ORDER BY rowid DESC LIMIT 100').fetchall()
        return [quiz_public(json.loads(r['content'])) for r in rows]

    @router.post('/quizzes/{key}/decision')
    def quiz_decision(key:str,request:dict):
        choice=request.get('choice')
        if type(choice) is not int or not 0<=choice<=2:raise HTTPException(422,'选择一项判断。')
        with db() as c:
            q=load(c,'planet_quizzes',key)
            if q.get('state')!='ready':raise HTTPException(409,'先等待新情境实算完成。')
            if q['decision'] and q['decision']['choice']!=choice:raise HTTPException(409,'首次判断已锁定。')
            if not q['decision']:q['decision']={'choice':choice,'submitted_at':now()};save(c,'planet_quizzes',q)
        return quiz_public(q)

    @router.post('/quizzes/{key}/answer')
    def quiz_answer(key:str,request:dict):
        reason=request.get('reason')
        if type(reason) is not int or not 0<=reason<=2:raise HTTPException(422,'选择一项依据。')
        with db() as c:
            q=load(c,'planet_quizzes',key)
            if not q.get('decision') or '_truth' not in q:raise HTTPException(409,'先锁定判断。')
            if q['answer'] and q['answer']['reason']!=reason:raise HTTPException(409,'首次依据已保留。')
            if not q['answer']:
                q['answer']={'reason':reason,'submitted_at':now(),'passed':q['decision']['choice']==q['_truth'] and reason==q['_reason'],
                    'correct_choice':q['_truth'],'correct_reason':q['_reason']};save(c,'planet_quizzes',q)
        return quiz_public(q)

    @router.get('/backup')
    def backup(include_uploads:bool=False):
        with db() as c:
            runs=[json.loads(r['content']) for r in c.execute('SELECT content FROM planet_runs')]
            sessions=[json.loads(r['content']) for r in c.execute('SELECT content FROM planet_sessions')]
            imports=[json.loads(r['content'])['_import'] for r in c.execute('SELECT content FROM planet_imports')] if include_uploads else []
            exposures=[dict(r) for r in c.execute('SELECT source,entity,kind FROM planet_exposure')]
            quizzes=[{k:v for k,v in json.loads(r['content']).items() if k not in ('_truth','_reason','reasons')} for r in c.execute('SELECT content FROM planet_quizzes')]
        out={'format':'modelplanet-lab','version':1,'created_at':now(),'sessions':sessions,'imports':imports,'exposures':exposures,
            'runs':[{k:r[k] for k in ('id','created_at','spec','dataset_version','source_id') if k in r} for r in runs if r['operation'] in ('train','decision')],
            'quizzes':quizzes,'note':'只保存配置与真实首答；恢复后重新计算指标。自导CSV仅在主动选择时包含。'}
        return out

    @router.get('/backup/file')
    def backup_file(include_uploads:bool=False):
        return Response(json.dumps(backup(include_uploads),ensure_ascii=False),media_type='application/json',headers={'Content-Disposition':'attachment; filename="modelplanet-lab.json"'})

    @router.post('/backup/restore')
    async def restore(request:Request):
        raw=await request.body()
        if len(raw)>16*1024*1024:raise HTTPException(413,'备份限16MB。')
        try:
            pack=json.loads(raw)
            if pack.get('format')!='modelplanet-lab' or pack.get('version')!=1:raise ValueError()
            if len(pack.get('runs',[]))>1000 or len(pack.get('exposures',[]))>100000:raise ValueError()
            imported=[data.import_csv(v['name'],v['csv'],v['targets'],v['task'],v.get('unit','原始单位'),v.get('id_columns',[]),v.get('time_column')) for v in pack.get('imports',[])]
            for d,v in zip(imported,pack.get('imports',[])):d['_import']=v
            imports_map={d['id']:d for d in imported}
            def valid_id(key):
                if not isinstance(key,str) or len(key)!=32 or any(c not in '0123456789abcdef' for c in key):raise ValueError()
                return key
            sessions=[]
            for item in pack.get('sessions',[]):
                key=valid_id(item['id']);s=engine.Spec.model_validate(item['basis_spec'])
                try:d=imports_map.get(s.dataset) or dataset(s.dataset);sp=engine.split_rows(d,s);anchor=sp['anchor']
                except HTTPException:anchor=None
                sessions.append({'id':key,'basis_spec':s.model_dump(),'anchor':anchor,'imported':True})
            runs=[]
            for item in pack.get('runs',[]):
                key=valid_id(item['id']);s=engine.Spec.model_validate(item['spec'])
                if s.model not in models.MODELS:raise ValueError()
                models.parse_parameters(s.model,s.parameters,5000,s.dataset)
                runs.append({'id':key,'created_at':str(item['created_at'])[:40],'updated_at':now(),'spec':s.model_dump(),'state':'restored','phase':'配置已恢复，等待复算',
                    'operation':'train','dataset_version':str(item['dataset_version'])[:64],'dataset_title':s.dataset,'result':None,'source_id':item.get('source_id'),'imported':True})
            exposures=[]
            for v in pack.get('exposures',[]):
                if v['kind'] not in ('fit','validation','diagnostic','test','legacy') or len(v['source'])>100 or len(v['entity'])>100:raise ValueError()
                exposures.append((v['source'],v['entity'],v['kind']))
            quizzes=[]
            for q in pack.get('quizzes',[]):
                valid_id(q['id']);before=engine.Spec.model_validate(q['before_spec']);after=engine.Spec.model_validate(q['after_spec'])
                a=before.model_dump();b=after.model_dump()
                for v in (a,b):v.pop('assisted',None);v.pop('prediction',None)
                diff=[]
                for section in set(a)|set(b):
                    if isinstance(a.get(section),dict) and isinstance(b.get(section),dict):
                        diff.extend(f'{section}.{k}' for k in set(a[section])|set(b[section]) if a[section].get(k)!=b[section].get(k))
                    elif a.get(section)!=b.get(section):diff.append(section)
                if len(diff)!=1 or not (diff[0].startswith('parameters.') or diff[0]=='cleaning.scale'):raise ValueError()
                models.parse_parameters(before.model,before.parameters,5000,before.dataset);models.parse_parameters(after.model,after.parameters,5000,after.dataset)
                reasons=['比较训练误差，以对已见样本的拟合作为新样本表现依据。','比较模型复杂程度，以模型能力作为本次验证表现依据。']
                index=int(hashlib.sha256(f'{before.seed}:{before.model}'.encode()).hexdigest()[:8],16)%3
                reasons.insert(index,'比较同一验证群体的实算误差，把训练表现与模型复杂度另作解释。')
                decision=q.get('decision');answer=q.get('answer')
                if decision and (type(decision.get('choice')) is not int or not 0<=decision['choice']<=2):raise ValueError()
                if answer and (not decision or type(answer.get('reason')) is not int or not 0<=answer['reason']<=2):raise ValueError()
                quizzes.append({'id':q['id'],'created_at':str(q['created_at'])[:40],'source_id':valid_id(q['source_id']),'plan_id':q.get('plan_id'),
                    'before_spec':before.model_dump(),'after_spec':after.model_dump(),'decision':decision,'answer':({'reason':answer['reason'],'submitted_at':str(answer['submitted_at'])[:40]} if answer else None),
                    'state':'restored','assisted':bool(q.get('assisted')),'reasons':reasons,'_reason':index,'question':'在这组新条件下，哪一组的验证误差更低？','choices':['A更低','B更低','近似相同'],'change':q.get('change',{})})
        except (ValueError,KeyError,TypeError,ValidationError):raise HTTPException(422,'备份格式或配置不合法，未写入记录。')
        added=0
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            for table,items in [('planet_imports',imported),('planet_sessions',sessions),('planet_runs',runs),('planet_quizzes',quizzes)]:
                for item in items:
                    if c.execute(f'SELECT id FROM {table} WHERE id=?',(item['id'],)).fetchone():continue
                    save(c,table,item);added+=1
            c.executemany('INSERT OR IGNORE INTO planet_exposure(source,entity,kind) VALUES(?,?,?)',exposures)
        return {'new':added,'recompute_required':True,'first_answers_preserved':True}

    @router.post('/runs/{key}/recompute')
    def recompute(key:str):
        with db() as c:r=load(c,'planet_runs',key)
        if r['state']!='restored':return public(r)
        s=engine.Spec.model_validate(r['spec']);d=dataset(s.dataset)
        if d['version']!=r['dataset_version']:raise HTTPException(409,'需要同一版本数据才能复算。')
        try:sp=split(s,d);engine.prepare(d,s,sp)
        except ValueError as e:raise HTTPException(422,str(e))
        return launch(s,d,sp,existing_id=key)

    @router.post('/quizzes/{key}/recompute')
    def recompute_quiz(key:str):
        with db() as c:q=load(c,'planet_quizzes',key);source=load(c,'planet_runs',q['source_id'])
        before=engine.Spec.model_validate(q['before_spec']);d=dataset(before.dataset)
        if source['state']!='completed':raise HTTPException(409,'请先从档案复算对应的原始运行。')
        sp=engine.split_rows(d,before,source['_split']['anchor'])
        return launch(before,d,sp,'challenge',source,{'before':q['before_spec'],'after':q['after_spec'],'_quiz':q})

    @router.get('/runs/{key}/report')
    def report(key:str,format:str='json'):
        with db() as c:r=load(c,'planet_runs',key)
        if r['state']!='completed' or r['operation'] not in ('train','decision'):raise HTTPException(409,'先完成这次训练。')
        if format not in ('json','md'):raise HTTPException(422,'请选择JSON或Markdown。')
        result=r['result'];value={'format':'modelplanet-report','version':1,'run_id':key,'created_at':r['created_at'],
            'spec':r['spec'],'dataset':result['dataset'],'parameters':result['effective_parameters'],'training':result['training_metrics'],
            'validation':result['validation_metrics'],'split':result['split'],'cleaning':result['cleaning'],'dependencies':result.get('dependencies'),
            'prediction':r['spec']['prediction'],'final':r.get('final'),'imported':bool(r.get('imported'))}
        content=json.dumps(value,ensure_ascii=False,indent=2)
        if format=='md':content='# 模力星球 · 实验记录\n\n'+result['dataset']['title']+' · '+result['model']['title']+'\n\n配置与真实评估：\n\n```json\n'+content+'\n```\n'
        return Response(content,media_type='application/json' if format=='json' else 'text/markdown; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="modelplanet-{key}.{format}"'})

    return router
