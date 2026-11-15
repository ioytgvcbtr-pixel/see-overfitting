"""Versioned learning backups: merge, preserve first answers, recompute evidence."""
import json
import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend import actions, experiments, islands, learning

TABLES = ('learning_attempts', 'island_attempts', 'action_plans', 'island_actions', 'records')
MAX_BYTES = 16 * 1024 * 1024


def without_hidden_answers(value):
    if isinstance(value, dict):
        return {k:without_hidden_answers(v) for k,v in value.items() if k not in ('_proof','_reason','_answer')}
    if isinstance(value, list): return [without_hidden_answers(v) for v in value]
    return value


class Entry(BaseModel):
    model_config = ConfigDict(extra='forbid')
    table: Literal['learning_attempts', 'island_attempts', 'action_plans', 'island_actions', 'records']
    id: str = Field(max_length=40)
    content: dict


class Package(BaseModel):
    model_config = ConfigDict(extra='forbid')
    format: Literal['fitlab-learning']
    version: Literal[1]
    created_at: str = Field(max_length=40)
    entries: list[Entry] = Field(max_length=2000)


def identity(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9a-f]{32}', value): raise ValueError('记录标识不合法。')
    return value


def stamp(value):
    if not isinstance(value, str) or len(value) > 40: raise ValueError('记录时间不合法。')
    datetime.fromisoformat(value)
    return value


def prediction(raw):
    return islands.Predict.model_validate({k: raw[k] for k in ('choice', 'confidence', 'reason')})


def rebuild_task(raw):
    panel, mode = raw['panel'], raw['mode']
    if panel not in islands.NAMES or mode not in ('discovery', 'counterexample'): raise ValueError('未知岛屿任务。')
    before = islands.params(panel, raw['before_parameters']).model_dump()
    target = islands.params(panel, raw['target_parameters']).model_dump()
    control = raw['control']
    allowed = {'error': ('slope', 'intercept'), 'sensitivity': ('edits',), 'regularization': ('alpha',), 'forest': ('model',)}
    changed = [k for k in before if before[k] != target[k]]
    if control not in allowed[panel] or changed != [control]: raise ValueError('任务不符合单变量协议。')
    task = islands.package(panel, mode, before, target, control, raw.get('row'))
    p = task['_proof']
    if panel == 'forest' and not p['fixed']: raise ValueError('固定样本并未被纠正。')
    if mode == 'counterexample':
        valid = (p['after_train'] < p['before_train'] and p['after'] > p['before'] if panel == 'error' else
                 p['after_norm'] < p['before_norm'] and p['after'] > p['before'] if panel == 'regularization' else
                 p['after'] > p['before']*1.1 and p['b_validation'] < p['a_validation']*.95 if panel == 'sensitivity' else p['after'] <= p['before'])
        if not valid: raise ValueError('反例条件未通过复算。')
    return task


def rebuild_island(raw):
    task = rebuild_task(raw['_case'])
    s = {'id': identity(raw['id']), 'created_at': stamp(raw['created_at']), 'updated_at': learning.now(),
         'panel': task['panel'], 'mode': task['mode'], 'protocol_version': 2, '_case': task, '_transfer': None,
         'stage': 'predict', 'prediction': None, 'observation': None, 'transfer_answer': None,
         'hints_used': int(raw.get('hints_used', 0)),
         'ai_before_transfer': [identity(v) for v in raw.get('ai_before_transfer', [])[:100]], 'imported_at': learning.now()}
    if not 0 <= s['hints_used'] <= 2: raise ValueError('提示层级不合法。')
    if raw.get('prediction'):
        p = prediction(raw['prediction'])
        s['prediction'] = p.model_dump() | {'submitted_at': stamp(raw['prediction']['submitted_at'])}
        s['stage'] = 'experiment'
    if raw.get('observation'):
        if not s['prediction']: raise ValueError('实验缺少首次预测。')
        s['observation'] = task['_proof'] | {'matched': task['_proof']['choice'] == s['prediction']['choice'],
            'conclusion': task['reasons'][task['_reason']], 'observed_at': stamp(raw['observation']['observed_at'])}
        s['stage'] = 'review'
    if raw.get('_transfer'):
        transfer = rebuild_task(raw['_transfer'])
        if not s['observation'] or transfer['panel'] != s['panel'] or transfer['seed'] == task['seed']:
            raise ValueError('迁移条件不符合本轮协议。')
        s.update(_transfer=transfer, _transfer_id=identity(raw['_transfer_id']), stage='transfer')
    if raw.get('transfer_answer'):
        a = islands.Answer.model_validate({k: raw['transfer_answer'][k] for k in ('task_id', 'choice', 'reason')})
        transfer = s['_transfer']
        if not transfer or a.task_id != s['_transfer_id']: raise ValueError('迁移作答与题目不匹配。')
        proof = transfer['_proof']
        s['transfer_answer'] = a.model_dump() | {'passed': a.choice == proof['choice'] and a.reason == transfer['_reason'],
            'choice_correct': a.choice == proof['choice'], 'reason_correct': a.reason == transfer['_reason'],
            'correct_reason': transfer['_reason'], 'proof': proof, 'assisted': bool(s['hints_used'] or s['ai_before_transfer']),
            'submitted_at': stamp(raw['transfer_answer']['submitted_at'])}
        s.update(stage='complete', completed_at=stamp(raw.get('completed_at', raw['transfer_answer']['submitted_at'])))
    cp = raw.get('checkpoint')
    if cp and cp.get('stage') == s['stage']:
        s['checkpoint'] = islands.checkpoint_value(s, islands.Checkpoint.model_validate({k:v for k,v in cp.items() if k != 'updated_at'}))
    if raw.get('practice_of'): s['practice_of'] = identity(raw['practice_of'])
    return s


def rebuild_course(raw):
    p = prediction(raw['prediction'])
    s = learning.start(experiments.Parameters.model_validate(raw['parameters']), p.choice, p.confidence, p.reason)
    s.update(id=identity(raw['id']), created_at=stamp(raw['created_at']), imported_at=learning.now())
    s['prediction']['submitted_at'] = stamp(raw['prediction']['submitted_at'])
    for row in raw['observations']:
        learning.observe(s, experiments.Parameters.model_validate(row['parameters']))
        for new in s['observations']:
            if new['index'] == row['index']: new['observed_at'] = stamp(row['observed_at'])
    for i, answer in enumerate(raw['transfer_attempts']):
        if i: learning.retry_transfer(s)
        task = s['_task']
        if not task or task['seed'] != answer['task']['seed']: raise ValueError('课程迁移种子不符合协议。')
        task['id'] = identity(answer['task']['id'])
        a = islands.Answer.model_validate({'task_id': task['id'], 'choice': answer['choice'], 'reason': answer['reason']})
        learning.grade(s, a.task_id, a.choice, a.reason)
        s['transfer_attempts'][-1]['submitted_at'] = stamp(answer['submitted_at'])
    old_task = raw.get('_task')
    if old_task and s['_task']:
        if old_task['seed'] != s['_task']['seed']: learning.retry_transfer(s)
        if old_task['seed'] != s['_task']['seed']: raise ValueError('课程待答迁移题无法恢复。')
        s['_task']['id'] = identity(old_task['id'])
    if raw.get('last_parameters'):
        last = experiments.Parameters.model_validate(raw['last_parameters'])
        if not learning.matches(s, last): raise ValueError('课程当前条件不一致。')
        s['last_parameters'] = last.model_dump()
    if s.get('completed_at'): s['completed_at'] = stamp(raw.get('completed_at', s['completed_at']))
    return s


def rebuild_action(raw, island=False):
    panel = raw.get('panel')
    kind = raw.get('kind')
    if island:
        before = islands.params(panel, raw['baseline_parameters']).model_dump()
        target = islands.params(panel, raw['target_parameters']).model_dump()
        options = islands.ai_options(panel, before)
    else:
        if kind not in ('synthetic', 'bench'): raise ValueError('未知实验类别。')
        p = actions.parameters(kind, raw['baseline_parameters'])
        before, target = p.model_dump(), actions.parameters(kind, raw['target_parameters']).model_dump()
        options = actions.candidates_for(kind, p)
    candidate = next((c for c in options if c['control'] == raw['change']['control'] and c['to_value'] == raw['change']['to_value']), None)
    if not candidate or {**before, candidate['control']: candidate['to_value']} != target: raise ValueError('AI方案不在合法候选中。')
    suggestion = actions.Suggestion.model_validate({'candidate_id':candidate['id'], 'hypothesis':raw['hypothesis'], 'expected':raw['expected']})
    s = {'id':identity(raw['id']), 'created_at':stamp(raw['created_at']), 'updated_at':learning.now(), 'imported_at':learning.now(),
         'mode':raw['mode'] if raw.get('mode') in ('online','rules') else 'rules', 'model':str(raw.get('model') or '')[:100] or None,
         'notice':'由学习备份恢复，数值已重新计算。', 'reasoning_effort':'xhigh', 'usage':{}, 'change':candidate,
         'hypothesis':suggestion.hypothesis, 'expected':suggestion.expected, 'baseline_parameters':before, 'target_parameters':target, 'execution':None}
    if island:
        s.update(panel=panel, attempt_id=identity(raw['attempt_id']))
        a, b = islands.calculate(panel, before), islands.calculate(panel, target)
        x, y = islands.error_metric(panel, a), islands.error_metric(panel, b)
        observed = ('lower','higher','unchanged')[islands.direction(x,y)]
        if raw.get('execution'):
            s['execution'] = {'before':x, 'after':y, 'delta':y-x, 'observed':observed,
                'verdict':'observed' if s['expected']=='uncertain' else 'supported' if s['expected']==observed else 'not_supported',
                'metric':'验证错误率' if panel=='forest' else '验证MSE', 'validation_fingerprint':a['validation_fingerprint'],
                'before_fingerprint':a.get('data_fingerprint',a.get('fingerprint')), 'after_fingerprint':b.get('data_fingerprint',b.get('fingerprint')),
                'executed_at':learning.now(), 'test_sealed':True, 'imported_at':s['imported_at']}
    else:
        s.update(kind=kind, learning_attempt_id=identity(raw['learning_attempt_id']) if raw.get('learning_attempt_id') else None,
                 learning_prediction=None, test_previously_viewed=bool(raw.get('test_previously_viewed')))
        base = actions.calculate(kind, actions.parameters(kind, before))
        s['baseline_fingerprint'] = base.get('data_fingerprint', base.get('fingerprint'))
        if raw.get('execution'): s['execution'] = actions.execute(s) | {'imported_at':s['imported_at']}
    return s


def rebuild(entry):
    raw = entry.content
    if entry.table == 'learning_attempts': value = rebuild_course(raw)
    elif entry.table == 'island_attempts': value = rebuild_island(raw)
    elif entry.table in ('island_actions','action_plans'): value = rebuild_action(raw, entry.table == 'island_actions')
    else:
        if not entry.id.isdecimal(): raise ValueError('实验标识不合法。')
        p = experiments.Parameters.model_validate(raw['result']['parameters'])
        value = {'id':int(entry.id), 'title':str(raw['title'])[:80], 'note':str(raw.get('note',''))[:1000],
                 'prediction':str(raw.get('prediction',''))[:200], 'created_at':stamp(raw['created_at']), 'result':experiments.run(p)}
    if str(value['id']) != entry.id: raise ValueError('备份内记录标识不一致。')
    return value


def make_router(connect):
    router = APIRouter(prefix='/workspace')

    @router.get('/backup')
    def export():
        entries = []
        with connect() as connection:
            for table in TABLES:
                for row in connection.execute(f'SELECT * FROM {table}').fetchall():
                    if table == 'records':
                        content = dict(row); content['result'] = json.loads(content['result'])
                    else: content = json.loads(row['content'])
                    if table == 'island_attempts' and not content.get('prediction') and content.get('protocol_version',1) < 2:
                        continue
                    entries.append({'table':table, 'id':str(row['id']), 'content':without_hidden_answers(content)})
        package = {'format':'fitlab-learning', 'version':1, 'created_at':learning.now(), 'entries':entries}
        if len(entries)>2000 or len(json.dumps(package,ensure_ascii=False).encode())>MAX_BYTES:
            raise HTTPException(413,'记录超过当前备份容量，请先单独保存所需实验记录。')
        return package

    @router.get('/backup/file')
    def download():
        return Response(json.dumps(export(),ensure_ascii=False),media_type='application/json',
                        headers={'Content-Disposition':'attachment; filename="fitlab-learning.json"','Cache-Control':'no-store'})

    async def parse(request):
        raw = await request.body()
        if len(raw) > MAX_BYTES: raise HTTPException(413, '备份超过16MB，请使用较小的学习备份。')
        try:
            package = Package.model_validate_json(raw)
            seen, values = set(), []
            for entry in package.entries:
                key = (entry.table, entry.id)
                if key in seen: raise ValueError('备份包含重复标识。')
                seen.add(key)
                values.append((entry, rebuild(entry)))
        except (ValidationError, ValueError, KeyError, TypeError, StopIteration, IndexError):
            raise HTTPException(422, '备份格式或学习条件未通过校验，未写入任何记录。')
        return values

    def merge(values, write):
        counts = {'new':0, 'existing':0, 'by_type':{}, 'recomputed':True}
        with connect() as connection:
            if write: connection.execute('BEGIN IMMEDIATE')
            for entry, value in values:
                old = connection.execute(f'SELECT * FROM {entry.table} WHERE id=?',(entry.id,)).fetchone()
                if old:
                    counts['existing'] += 1
                    continue
                counts['new'] += 1
                counts['by_type'][entry.table] = counts['by_type'].get(entry.table,0)+1
                if write:
                    if entry.table == 'records':
                        connection.execute('INSERT INTO records(id,title,note,prediction,created_at,result) VALUES (?,?,?,?,?,?)',
                            (value['id'],value['title'],value['note'],value['prediction'],value['created_at'],json.dumps(value['result'],ensure_ascii=False)))
                    else:
                        connection.execute(f'INSERT INTO {entry.table}(id,content) VALUES (?,?)',(entry.id,json.dumps(value,ensure_ascii=False)))
        return counts

    @router.post('/backup/preview')
    async def preview(request: Request): return merge(await parse(request), False)

    @router.post('/backup/restore')
    async def restore(request: Request): return merge(await parse(request), True)

    return router
