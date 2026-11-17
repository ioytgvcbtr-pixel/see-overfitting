"""Reconcile historical challenge role declarations without rewriting first answers."""
import json
from datetime import datetime,timezone
import numpy as np
from backend import planet_data as data,planet_engine as engine

KEY='challenge-role-audit-v2'
NOTE='历史迁移使用过重新划分的样本；保留原结果作为探索记录，可按封存角色复算核对。'

def reconcile(c):
    c.execute('CREATE TABLE IF NOT EXISTS planet_metadata(id TEXT PRIMARY KEY,content TEXT NOT NULL)')
    if c.execute('SELECT 1 FROM planet_metadata WHERE id=?',(KEY,)).fetchone():return
    affected=set();times={};audited=0;corrected=0;later=0
    def moment(value):
        try:
            stamp=datetime.fromisoformat(value.replace('Z','+00:00'))
            return (stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)).timestamp()
        except (ValueError,TypeError,AttributeError):return None
    for row in c.execute('SELECT content FROM planet_quizzes').fetchall():
        q=json.loads(row['content'])
        if q.get('split_protocol',1)>=2:continue
        source_row=c.execute('SELECT content FROM planet_runs WHERE id=?',(q['source_id'],)).fetchone()
        source=json.loads(source_row['content']) if source_row else None
        if not source:continue
        family=(source.get('result') or {}).get('dataset',{}).get('family');entries=[]
        try:
            d=data.builtin(q['before_spec']['dataset']);family=d['family'];before=engine.Spec.model_validate(q['before_spec']);sp=engine.split_rows(d,before)
            observed=q.get('observations')
            if observed and observed.get('signature')!=sp['signature']:raise ValueError('Historical signature requires conservative audit')
            for value in (q['before_spec'],q['after_spec']):
                s=engine.Spec.model_validate(value);indices=np.random.default_rng(s.seed+741).permutation(sp['roles']['training'])[:max(2,int(len(sp['roles']['training'])*s.training_fraction))]
                entries.extend((family,prefix+sp['rows'][int(i)][field],'legacy_fit') for i in indices for prefix,field in [('g:','entity'),('r:','exposure')])
            entries.extend((family,prefix+sp['rows'][i][field],'legacy_validation') for i in sp['roles']['validation'] for prefix,field in [('g:','entity'),('r:','exposure')])
            q['role_audit']='reconstructed'
        except (ValueError,KeyError,TypeError,StopIteration):
            # When a historic snapshot cannot be reconstructed, do not certify its holdout as untouched.
            sp=source.get('_split')
            if family and sp:entries.extend((family,prefix+sp['rows'][i][field],'legacy_uncertain') for i in sp['roles']['test'] for prefix,field in [('g:','entity'),('r:','exposure')])
            q['role_audit']='conservative'
        if family:
            c.executemany('INSERT OR IGNORE INTO planet_exposure(source,entity,kind) VALUES(?,?,?)',entries);affected.add(family)
            for _,entity,_ in entries:
                key=(family,entity);stamp=moment(q.get('created_at'))
                if key not in times or stamp is None or times[key] is not None and stamp<times[key]:times[key]=stamp
        q['split_protocol']=1;q['provenance_note']=NOTE
        c.execute('UPDATE planet_quizzes SET content=? WHERE id=?',(json.dumps(q,ensure_ascii=False),q['id']));audited+=1
    for row in c.execute('SELECT content FROM planet_runs').fetchall():
        r=json.loads(row['content']);final=r.get('final');result=r.get('result') or {};sp=r.get('_split');family=result.get('dataset',{}).get('family')
        if not final or not final.get('independent') or family not in affected or not sp:continue
        entities={prefix+sp['rows'][i][field] for i in sp['roles']['test'] for prefix,field in [('g:','entity'),('r:','exposure')]}
        touched={v[0] for v in c.execute("SELECT entity FROM planet_exposure WHERE source=? AND kind IN ('legacy_fit','legacy_validation','legacy_uncertain')",(family,))}
        if entities&touched:
            evaluated=moment(final.get('evaluated_at'));exposures=[times.get((family,e)) for e in entities&touched]
            if evaluated is not None and all(t is not None and t>evaluated for t in exposures):
                final['later_exposure_note']='这次首次评估之后，同一保留群体参与过探索；后续不能再次视为未接触。';later+=1
            else:
                final['previous_independence']={'independent':True,'note':final.get('note')};final['independent']=False;final['note']='历史迁移在本次评估前的接触已追溯，按探索性评估阅读；原指标保留。';corrected+=1
            c.execute('UPDATE planet_runs SET content=? WHERE id=?',(json.dumps(r,ensure_ascii=False),r['id']))
    c.execute('INSERT INTO planet_metadata(id,content) VALUES(?,?)',(KEY,json.dumps({'legacy_quizzes_audited':audited,'cached_independence_corrected':corrected,'later_exposure_noted':later})))
