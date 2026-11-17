"""Durable knowledge progress, mechanism grids and local experiment journals."""
import copy,json,uuid
from contextlib import contextmanager
from datetime import datetime,timezone
from typing import Literal
from fastapi import APIRouter,HTTPException,Request
from fastapi.responses import Response
from pydantic import BaseModel,ConfigDict,Field
from backend.curriculum import CHAPTERS,LESSONS,BY_ID,public_lesson,quiz_revision,checked_attempt
from backend.planet_api import CANCEL


def now():return datetime.now(timezone.utc).isoformat()
class Strict(BaseModel):model_config=ConfigDict(extra='forbid')
class Answer(Strict):
    id:str=Field(pattern=r'^[0-9a-f]{32}$')
    choice:str=Field(max_length=80)
class Change(Strict):
    field:str=Field(min_length=1,max_length=80)
    before:str=Field(max_length=250)
    after:str=Field(max_length=250)
class Event(Strict):
    id:str=Field(pattern=r'^[0-9a-f]{32}$')
    kind:Literal['config_change','step_open']
    session_id:str=Field(pattern=r'^[0-9a-f]{32}$')
    dataset:str=Field(max_length=80)
    model:str=Field(default='',max_length=80)
    step:int|None=Field(default=None,ge=0,le=7)
    changes:list[Change]=Field(default_factory=list,max_length=50)

PANELS={'error':'误差湖','sensitivity':'曲线山','regularization':'约束花园','forest':'边界森林'}
OPERATIONS={'train':'训练模型','decision':'调整分类阈值','inspect':'核对样本预测机制','surface':'计算条件切片','learning':'计算学习曲线','scan':'扫描模型参数','stability':'复核稳定性','final':'评估测试集','challenge':'计算迁移情境'}
STAGES=['认识任务','数据体检','清洗方案','划分数据','模型参数','训练验证','对照解释','测试迁移']


def make_router(connect,archive_services=None):
    router=APIRouter(prefix='/study')
    @contextmanager
    def db():
        c=connect()
        try:
            with c:
                c.execute('CREATE TABLE IF NOT EXISTS study_progress(id TEXT PRIMARY KEY,content TEXT NOT NULL)')
                c.execute('CREATE TABLE IF NOT EXISTS study_events(id TEXT PRIMARY KEY,content TEXT NOT NULL)')
                yield c
        finally:c.close()
    def put(c,table,item):c.execute(f'INSERT OR REPLACE INTO {table}(id,content) VALUES(?,?)',(item['id'],json.dumps(item,ensure_ascii=False)))
    def load(c,key):
        r=c.execute('SELECT content FROM study_progress WHERE id=?',(key,)).fetchone()
        return json.loads(r['content']) if r else {'id':key,'version':BY_ID[key]['version'],'attempts':[]}
    def known(key):
        if key not in BY_ID:raise HTTPException(404,'课题不存在，请返回学习航线。')
        return BY_ID[key]
    def state_public(value):
        result=copy.deepcopy(value);lesson=BY_ID[value['id']]
        result['attempts']=[checked_attempt(lesson,a,value.get('version',1)) for a in value['attempts']]
        result['completed']=any(a['correct'] for a in result['attempts'])
        result['status']='completed' if result['completed'] else 'read' if value.get('read_at') else 'opened' if value.get('first_opened_at') else 'unseen'
        result['first_answer']=result['attempts'][0] if result['attempts'] else None
        if result['attempts']:result['explanation']=quiz_revision(lesson,result['attempts'][-1]['quiz_version'])['explanation']
        return result
    def states(c):return {r['id']:state_public(json.loads(r['content'])) for r in c.execute('SELECT id,content FROM study_progress') if r['id'] in BY_ID}
    def mechanisms(c):
        rows=[json.loads(r['content']) for r in c.execute('SELECT content FROM island_attempts')]
        out=[]
        for panel,title in PANELS.items():
            items=sorted([r for r in rows if r.get('panel')==panel],key=lambda r:r.get('updated_at') or r.get('created_at',''),reverse=True)
            latest=items[0] if items else None
            out.append({'id':panel,'title':title,'completed':any(r.get('stage')=='complete' for r in items),'started':bool(items),
                'entry':{'kind':'island','id':latest['id'],'title':title,'panel':panel,'stage':latest['stage'],'status':'已完成' if latest['stage']=='complete' else '继续探索',
                    'updated_at':latest.get('updated_at') or latest['created_at'],'needs_review':bool((latest.get('transfer_answer') or {}).get('passed') is False)} if latest else None})
        return out
    def event(c,kind,title,lesson_id=None):
        item={'id':uuid.uuid4().hex,'kind':kind,'title':title,'created_at':now(),'lesson_id':lesson_id}
        put(c,'study_events',item)
    @router.get('/overview')
    def overview():
        with db() as c:
            progress=states(c);islands=mechanisms(c)
            opened=sorted(progress.values(),key=lambda x:x.get('last_opened_at',''),reverse=True)
            total_events=c.execute('SELECT count(*) FROM study_events').fetchone()[0]
            has_runs=c.execute("SELECT 1 FROM sqlite_master WHERE name='planet_runs'").fetchone()
            runs=c.execute("SELECT count(*) FROM planet_runs WHERE json_extract(content,'$.operation') IN ('train','decision')").fetchone()[0] if has_runs else 0
            runs+=c.execute('SELECT count(*) FROM records').fetchone()[0]
        done=sum(p['completed'] for p in progress.values());next_id=next((l['id'] for l in LESSONS if not progress.get(l['id'],{}).get('completed')),None)
        return {'chapters':CHAPTERS,'lessons':[{'id':l['id'],'title':l['title'],'chapter':l['chapter'],'goal':l['goal'],'visual':l['visual'],'version':l['version']} for l in LESSONS],
            'progress':progress,'mechanisms':islands,'completed':done,'total':len(LESSONS),'all_complete':done==len(LESSONS),'next_id':next_id,
            'resume_id':next((p['id'] for p in opened if not p['completed']),next_id),'experiment_count':runs,'event_count':total_events}
    @router.get('/lessons/{key}')
    def get_lesson(key:str):
        l=known(key)
        with db() as c:return {'lesson':public_lesson(l),'progress':state_public(load(c,key))}
    @router.post('/lessons/{key}/open')
    def open_lesson(key:str):
        l=known(key)
        with db() as c:
            value=load(c,key);stamp=now();value.setdefault('first_opened_at',stamp);value['last_opened_at']=stamp;put(c,'study_progress',value)
            # One durable visit marker per lesson, without inflating completion.
            if not c.execute('SELECT 1 FROM study_events WHERE id=?',('open-'+key,)).fetchone():put(c,'study_events',{'id':'open-'+key,'kind':'lesson_open','title':'开始学习 · '+l['title'],'created_at':stamp,'lesson_id':key})
            return {'lesson':public_lesson(l),'progress':state_public(value)}
    @router.post('/lessons/{key}/read')
    def read_lesson(key:str):
        l=known(key)
        with db() as c:
            value=load(c,key)
            if not value.get('first_opened_at'):raise HTTPException(409,'请先打开并阅读这个课题。')
            if not value.get('read_at'):value['read_at']=now();put(c,'study_progress',value);event(c,'lesson_read','读完课题 · '+l['title'],key)
            return state_public(value)
    @router.post('/lessons/{key}/answer')
    def answer(key:str,request:Answer):
        l=known(key)
        with db() as c:
            c.execute('BEGIN IMMEDIATE');value=load(c,key)
            if not value.get('read_at'):raise HTTPException(409,'请先读完课题，再进行检查。')
            old=next((a for a in value['attempts'] if a['id']==request.id),None)
            if old:
                if old['choice']!=request.choice:raise HTTPException(409,'这次首答已经保存，复练请使用新的尝试。')
                return state_public(value)
            if request.choice not in {v['id'] for v in l['quiz']['choices']}:raise HTTPException(422,'题目或选项已更新，请重新打开本课再作答。')
            if len(value['attempts'])>=40:raise HTTPException(409,'本课已保留40次检查，可直接复习内容与原始答案。')
            a={'id':request.id,'choice':request.choice,'quiz_version':l['version'],'correct':request.choice==l['_answer'],'submitted_at':now()};value['attempts'].append(a)
            if a['correct']:value.setdefault('completed_at',a['submitted_at'])
            put(c,'study_progress',value);event(c,'lesson_check',('检查通过 · ' if a['correct'] else '复习课题 · ')+l['title'],key)
            return state_public(value)
    @router.post('/events')
    def record(request:Event):
        item=request.model_dump();item['created_at']=now()
        with db() as c:c.execute('INSERT OR IGNORE INTO study_events(id,content) VALUES(?,?)',(item['id'],json.dumps(item,ensure_ascii=False)))
        return {'saved':True,'id':item['id']}
    @router.get('/records')
    def records(kind:str='all',offset:int=0,limit:int=40):
        if kind not in ('all','knowledge','experiments','mechanisms') or offset<0 or not 1<=limit<=100:raise HTTPException(422,'记录筛选或页数不合法。')
        with db() as c:
            items=[json.loads(r['content']) for r in c.execute('SELECT content FROM study_events')]
            for i in items:
                if i['kind']=='config_change':i['title']='修改实验配置'
                if i['kind']=='step_open':i['title']='进入'+STAGES[i.get('step') or 0]
                i['category']='knowledge' if i['kind'].startswith('lesson_') else 'experiments'
            if c.execute("SELECT 1 FROM sqlite_master WHERE name='planet_runs'").fetchone():
                rows=c.execute("SELECT id,json_extract(content,'$.created_at') stamp,json_extract(content,'$.operation') op,json_extract(content,'$.state') state,json_extract(content,'$.dataset_title') dataset,json_extract(content,'$.source_id') parent,json_extract(content,'$.error') error,json_extract(content,'$.spec.model') model_id FROM planet_runs")
                for r in rows:
                    run_state='unfinished' if r['state'] in ('queued','running') and (r['id'] not in CANCEL or CANCEL[r['id']].is_set()) else r['state']
                    items.append({'id':r['id'],'created_at':r['stamp'],'kind':r['op'],'category':'experiments','title':OPERATIONS.get(r['op'],'实验操作'),
                    'dataset_title':r['dataset'],'model':r['model_id'],'state':run_state,'run_id':r['id'] if r['op'] in ('train','decision') else r['parent'],'error':r['error']})
            for s in c.execute('SELECT content FROM island_attempts'):
                v=json.loads(s['content']);panel=v.get('panel')
                if panel in PANELS:items.append({'id':v['id'],'created_at':v.get('updated_at') or v['created_at'],'kind':'mechanism','category':'mechanisms','title':PANELS[panel],
                    'state':v['stage'],'entry':{'id':v['id'],'kind':'island','panel':panel,'title':PANELS[panel],'stage':v['stage'],'status':'继续探索','updated_at':v.get('updated_at') or v['created_at'],'needs_review':False}})
            names={'complexity':'模型复杂度','samples':'训练样本量','regularization':'正则化'}
            for row in c.execute('SELECT content FROM learning_attempts'):
                v=json.loads(row['content']);scene=v.get('parameters',{}).get('scene')
                if scene in names:
                    stamp=v.get('completed_at') or v.get('created_at');entry={'id':v['id'],'kind':'course','scene':scene,'title':names[scene],'stage':v['stage'],'status':'基础实验','updated_at':stamp,'needs_review':False}
                    items.append({'id':'course-'+v['id'],'created_at':stamp,'kind':'foundation','category':'mechanisms','title':'基础实验 · '+names[scene],'state':v['stage'],'entry':entry})
            for row in c.execute('SELECT id,title,created_at FROM records'):
                items.append({'id':'saved-'+str(row['id']),'created_at':row['created_at'],'kind':'saved','category':'experiments','title':row['title'],'state':'saved',
                    'entry':{'id':str(row['id']),'kind':'saved','title':row['title'],'stage':'complete','status':'已保存实验','updated_at':row['created_at'],'needs_review':False}})
        if kind!='all':items=[i for i in items if i['category']==kind]
        items.sort(key=lambda x:x['created_at'],reverse=True)
        return {'items':items[offset:offset+limit],'total':len(items),'offset':offset,'limit':limit}
    @router.get('/backup/file')
    def backup():
        with db() as c:value={'format':'modelplanet-study','version':1,'progress':[json.loads(r['content']) for r in c.execute('SELECT content FROM study_progress')],
            'events':[json.loads(r['content']) for r in c.execute('SELECT content FROM study_events')]}
        return Response(json.dumps(value,ensure_ascii=False),media_type='application/json',headers={'Content-Disposition':'attachment; filename="modelplanet-study.json"'})
    @router.post('/backup/restore')
    async def restore(request:Request):
        raw=await request.body()
        if len(raw)>8*1024*1024:raise HTTPException(413,'学习备份限8MB。')
        try:
            pack=json.loads(raw);assert isinstance(pack,dict);assert pack.get('format')=='modelplanet-study' and pack.get('version')==1
            progress=pack.get('progress',[]);events=pack.get('events',[]);assert isinstance(progress,list) and isinstance(events,list) and len(progress)<=18 and len(events)<=10000
            rebuilt=[]
            for original in progress:
                assert isinstance(original,dict)
                l=known(original['id']);assert quiz_revision(l,original['version']);value={'id':l['id'],'version':original['version'],'attempts':[],'imported':True}
                for key in ('first_opened_at','last_opened_at','read_at'):
                    if original.get(key):datetime.fromisoformat(original[key]);value[key]=original[key]
                assert len(original['attempts'])<=40
                for a in original['attempts']:
                    checked=Answer.model_validate({'id':a['id'],'choice':a['choice']});version=a.get('quiz_version',original['version']);revision=quiz_revision(l,version)
                    assert revision and checked.choice in {v['id'] for v in revision['quiz']['choices']};datetime.fromisoformat(a['submitted_at'])
                    value['attempts'].append({'id':checked.id,'choice':checked.choice,'quiz_version':version,'correct':checked.choice==revision['answer'],'submitted_at':a['submitted_at']})
                good=next((a for a in value['attempts'] if a['correct']),None)
                if good:value['completed_at']=good['submitted_at']
                rebuilt.append(value)
            accepted=[]
            for e in events:
                assert isinstance(e,dict)
                if e.get('kind') in ('config_change','step_open'):
                    checked=Event.model_validate({k:e[k] for k in Event.model_fields if k in e});datetime.fromisoformat(e['created_at']);accepted.append({**checked.model_dump(),'created_at':e['created_at'],'imported':True})
                elif e.get('lesson_id') in BY_ID and e.get('kind') in ('lesson_open','lesson_read','lesson_check'):
                    datetime.fromisoformat(e['created_at']);accepted.append({'id':str(e['id'])[:80],'kind':e['kind'],'lesson_id':e['lesson_id'],'title':'导入的课题记录 · '+BY_ID[e['lesson_id']]['title'],'created_at':e['created_at'],'imported':True})
        except (ValueError,TypeError,KeyError,AssertionError):raise HTTPException(422,'学习备份格式、课题版本或选项不合法。')
        with db() as c:
            for v in rebuilt:
                existing=load(c,v['id']);known_ids={a['id'] for a in existing['attempts']}
                existing['attempts']=(existing['attempts']+[a for a in v['attempts'] if a['id'] not in known_ids])[:40]
                for key in ('first_opened_at','last_opened_at','read_at'):
                    if not existing.get(key) and v.get(key):existing[key]=v[key]
                good=next((a for a in existing['attempts'] if a['correct']),None)
                if good:existing.setdefault('completed_at',good['submitted_at'])
                existing['imported']=True;put(c,'study_progress',existing)
            for e in accepted:c.execute('INSERT OR IGNORE INTO study_events(id,content) VALUES(?,?)',(e['id'],json.dumps(e,ensure_ascii=False)))
        return {'restored':True,'first_answers_preserved':True,'progress_recomputed':True}
    if archive_services is not None:archive_services.update(export=backup,restore=restore)
    return router
