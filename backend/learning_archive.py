"""One validated learning archive, reversible reset, and atomic restoration."""
import asyncio
import json
import re
import sqlite3
import tempfile
import threading
import uuid
from contextlib import contextmanager,closing
from datetime import datetime,timezone
from pathlib import Path

from fastapi import APIRouter,HTTPException,Depends
from fastapi.responses import Response
from starlette.requests import Request
from backend import backup,planet_api,study_api

ARCHIVE_DIR=Path(__file__).resolve().parents[1]/'artifacts/local/learning-archives'
MAX_BYTES=32*1024*1024
FORMAT='modelplanet-learning-archive'
PROGRESS=('study_progress','learning_attempts','island_attempts','action_plans','island_actions')
TABLES=PROGRESS+('study_events','records','planet_runs','planet_sessions','planet_imports','planet_plans','planet_quizzes','planet_metadata')
CLIENT_EXACT={'modelplanet-draft-v1','modelplanet-last-run','modelplanet-last-quiz','modelplanet-pinned','modelplanet-practice-origin-v1','modelplanet-mechanism-return',
 'fitlab-classification-session-v1','fitlab-concept-session-v1','fitlab-bench-records','fitlab-bench-session-v1','fitlab-test-exposure','fitlab-current-scene-v1',
 'fitlab-learning-completed-v1','fitlab-learning-attempt-v1','fitlab-learning-draft-v1','fitlab-island-progress-v1','fitlab-island-intro-v13','fitlab-class-play-v1','fitlab-class-reference-v1'}
CLIENT_PATTERNS=(r'modelplanet-mechanism-[a-z0-9_]+-v1',r'modelplanet-scene-(?:neighbor|coefficient)-[a-z0-9_-]{1,150}',r'fitlab-island-(?:learning-v13|draft-v14)-[a-z0-9_-]{1,60}')

def client_state(value):
    if not isinstance(value,dict) or len(value)>120:raise HTTPException(422,'本机学习草稿格式不合法。')
    out={}
    for key,text in value.items():
        if key not in CLIENT_EXACT and not any(re.fullmatch(p,key) for p in CLIENT_PATTERNS):raise HTTPException(422,'档案包含不支持的本机设置。')
        if not isinstance(text,str) or len(text.encode('utf-8'))>512*1024:raise HTTPException(422,'单项学习草稿超过容量。')
        out[key]=text
    return out

def encoded(value):
    try:raw=json.dumps(value,ensure_ascii=False,allow_nan=False).encode('utf-8')
    except (ValueError,TypeError,RecursionError):raise HTTPException(422,'学习档案不是有效的JSON数据。') from None
    if len(raw)>MAX_BYTES:raise HTTPException(413,'完整学习档案限32MB。')
    return raw

class ArchiveGate:
    def __init__(self):self.lock=threading.Lock();self.active=0;self.exclusive=False
    def enter(self):
        with self.lock:
            if self.exclusive:return False
            self.active+=1;return True
    def leave(self):
        with self.lock:self.active-=1
    @contextmanager
    def reserve(self,connect):
        with self.lock:
            if self.exclusive or self.active>1:raise HTTPException(409,'还有保存或计算正在进行，请完成后重试档案操作。')
            self.exclusive=True
        acquired=False
        try:
            with closing(connect()) as c,c:
                if exists(c,'planet_runs') and c.execute("SELECT 1 FROM planet_runs WHERE json_extract(content,'$.state') IN ('queued','running') LIMIT 1").fetchone():
                    raise HTTPException(409,'有排队或运行中的实验，请完成或停止后重试。')
            # A completed worker may still be closing its process and model cache.
            acquired=planet_api.GATE.acquire(timeout=3)
            if not acquired:raise HTTPException(409,'计算资源尚未释放，请稍后重试档案操作。')
            yield
        finally:
            if acquired:planet_api.GATE.release()
            with self.lock:self.exclusive=False

gate=ArchiveGate()

class SnapshotConnection(sqlite3.Connection):
    def __exit__(self,*args):
        try:return super().__exit__(*args)
        finally:self.close()

def exists(c,table):return bool(c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(table,)).fetchone())
def meta(c):
    c.execute('CREATE TABLE IF NOT EXISTS learning_archive_meta(id TEXT PRIMARY KEY,content TEXT NOT NULL)')
    row=c.execute("SELECT content FROM learning_archive_meta WHERE id='current'").fetchone()
    if row:return json.loads(row['content'])
    value={'generation':uuid.uuid4().hex,'scope':'all','backup':None}
    c.execute("INSERT INTO learning_archive_meta VALUES('current',?)",(json.dumps(value),));return value

def services(connect):
    out={}
    for name,factory in [('knowledge',study_api.make_router),('models',planet_api.make_router),('mechanisms',backup.make_router)]:
        out[name]={};factory(connect,archive_services=out[name])
    return out

def package(svc,local):
    value={'format':FORMAT,'version':1,'created_at':datetime.now(timezone.utc).isoformat(),'client_state':client_state(local)}
    for name,domain in svc.items():
        result=domain['export']();value[name]=json.loads(result.body) if isinstance(result,Response) else result
    encoded(value);return value

def summary(value):
    progress=value['knowledge']['progress'];entries=value['mechanisms']['entries']
    complete={e['content'].get('panel') for e in entries if e['table']=='island_attempts' and e['content'].get('stage')=='complete'}
    return {'lessons_started':len(progress),'lessons_completed':sum(any(a.get('correct') for a in p.get('attempts',[])) for p in progress),
            'mechanisms_completed':len(complete),'model_runs':len(value['models']['runs']),'events':len(value['knowledge']['events'])}

@contextmanager
def snapshot(connect):
    ARCHIVE_DIR.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='stage-',dir=ARCHIVE_DIR) as folder:
        work=Path(folder).resolve()
        if not work.is_relative_to(ARCHIVE_DIR.resolve()):raise RuntimeError('Archive staging path is outside its private root')
        path=work/'learning.sqlite'
        with closing(connect()) as source,closing(sqlite3.connect(path)) as dest:source.backup(dest)
        def staging():
            c=sqlite3.connect(path,factory=SnapshotConnection);c.row_factory=sqlite3.Row;return c
        svc=services(staging)
        # Materialize trusted application schemas in the private copy.
        package(svc,{})
        yield staging,svc

async def restore_domain(fn,value):
    raw=encoded(value)
    async def receive():return {'type':'http.request','body':raw,'more_body':False}
    return await fn(Request({'type':'http','method':'POST','path':'/archive-validation','headers':[]},receive))

def rebuild(staging,svc,value):
    encoded(value)
    try:
        if value.get('format')!=FORMAT or value.get('version')!=1:raise ValueError()
        datetime.fromisoformat(value['created_at']);local=client_state(value.get('client_state',{}))
        with staging() as c:
            for table in TABLES:
                if exists(c,table):c.execute(f'DELETE FROM {table}')
        async def restore_all():
            for name in ('models','mechanisms','knowledge'):await restore_domain(svc[name]['restore'],value[name])
        asyncio.run(restore_all())
        rebuilt=package(svc,local);rebuilt['created_at']=value['created_at']
        return rebuilt
    except HTTPException:raise
    except (ValueError,TypeError,KeyError,OverflowError,sqlite3.Error,RecursionError):
        raise HTTPException(422,'档案未通过校验，当前学习记录没有改变。') from None

def save_before(value):
    key=uuid.uuid4().hex;path=(ARCHIVE_DIR/(key+'.json')).resolve()
    if not path.is_relative_to(ARCHIVE_DIR.resolve()):raise RuntimeError('Archive path is outside its private root')
    path.write_bytes(encoded(value));return key

def apply(connect,staging,before,scope):
    backup_id=save_before(before)
    with staging() as src,closing(connect()) as dest,dest:
        dest.execute('BEGIN IMMEDIATE')
        for table in TABLES:
            if not exists(src,table):continue
            if not exists(dest,table):dest.execute(src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",(table,)).fetchone()[0])
            columns=[r['name'] for r in src.execute(f'PRAGMA table_info({table})')]
            dest.execute(f'DELETE FROM {table}')
            rows=src.execute(f'SELECT * FROM {table}').fetchall()
            dest.executemany(f"INSERT INTO {table}({','.join(columns)}) VALUES({','.join('?' for _ in columns)})",[tuple(r) for r in rows])
        # Learning can restart, but previously encountered test identities stay encountered.
        if exists(src,'planet_exposure'):
            dest.execute('CREATE TABLE IF NOT EXISTS planet_exposure(source TEXT,entity TEXT,kind TEXT,PRIMARY KEY(source,entity,kind))')
            dest.executemany('INSERT OR IGNORE INTO planet_exposure VALUES(?,?,?)',[tuple(r) for r in src.execute('SELECT source,entity,kind FROM planet_exposure')])
        state=meta(dest);state.update(generation=uuid.uuid4().hex,scope=scope,backup=backup_id)
        dest.execute("UPDATE learning_archive_meta SET content=? WHERE id='current'",(json.dumps(state),))
    return state

def archive_request(request:Request):
    if request.method=='POST' and request.headers.get('x-modelplanet-archive')!='1':
        raise HTTPException(403,'请从网页的学习档案入口执行此操作。')

def make_router(connect):
    router=APIRouter(prefix='/learning-archive',dependencies=[Depends(archive_request)])
    @router.get('/status')
    def status():
        with closing(connect()) as c,c:state=meta(c)
        return {'generation':state['generation'],'scope':state['scope'],'has_previous':bool(state.get('backup'))}
    @router.post('/export')
    def export(request:dict):
        with gate.reserve(connect),snapshot(connect) as (_stage,svc):return package(svc,request.get('client_state',{}))
    @router.post('/preview')
    def preview(request:dict):
        with gate.reserve(connect),snapshot(connect) as (stage,svc):
            value=rebuild(stage,svc,request.get('archive',{}));return {'summary':summary(value),'created_at':value['created_at']}
    def import_value(value,local):
        with snapshot(connect) as (stage,svc):
            before=package(svc,local);rebuilt=rebuild(stage,svc,value);state=apply(connect,stage,before,'all')
            return {'generation':state['generation'],'scope':'all','summary':summary(rebuilt),'client_state':rebuilt['client_state'],'recompute_required':True}
    @router.post('/import')
    def import_archive(request:dict):
        if request.get('confirmed') is not True:raise HTTPException(422,'请先确认恢复这份学习档案。')
        with gate.reserve(connect):return import_value(request.get('archive',{}),client_state(request.get('current_client_state',{})))
    @router.post('/reset')
    def reset(request:dict):
        scope=request.get('scope','progress')
        if request.get('confirmed') is not True or scope not in ('progress','all'):raise HTTPException(422,'请选择并确认重置范围。')
        with gate.reserve(connect),snapshot(connect) as (stage,svc):
            before=package(svc,request.get('client_state',{}))
            with stage() as c:
                for table in TABLES if scope=='all' else PROGRESS:c.execute(f'DELETE FROM {table}')
                if scope=='progress':c.execute("DELETE FROM study_events WHERE json_extract(content,'$.kind') IN ('lesson_open','lesson_read','lesson_check')")
            state=apply(connect,stage,before,scope)
            return {'generation':state['generation'],'scope':scope,'summary':summary(package(svc,{})),'client_state':{},'recompute_required':False}
    @router.post('/undo')
    def undo(request:dict):
        if request.get('confirmed') is not True:raise HTTPException(422,'请确认恢复上次操作前的档案。')
        with gate.reserve(connect):
            with closing(connect()) as c,c:key=meta(c).get('backup')
            if not key or not re.fullmatch(r'[0-9a-f]{32}',key):raise HTTPException(404,'还没有可恢复的上次档案。')
            path=ARCHIVE_DIR/(key+'.json')
            if not path.is_file():raise HTTPException(404,'上次档案不在本机，请使用已导出的学习档案。')
            return import_value(json.loads(path.read_bytes()),client_state(request.get('current_client_state',{})))
    return router
