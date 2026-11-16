"""Four-island learning: immutable predictions, numerical counterexamples and transfer."""
import asyncio
import copy
import json
import math
import uuid
from datetime import datetime
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend import classification, coach, concepts, learning, pedagogy
from backend.actions import Suggestion

Panel = Literal['error', 'sensitivity', 'regularization', 'forest']
Mode = Literal['discovery', 'counterexample']
NAMES = {'error': '误差湖', 'sensitivity': '曲线山', 'regularization': '约束花园', 'forest': '边界森林'}
LABELS = {'slope': '船帆斜率a', 'intercept': '船身截距b', 'alpha': '正则化α', 'degree': '模型B阶数',
          'edits': '训练路钉', 'model': '分类模型', 'depth': '最大树深'}
REASONS = {
    'error': ['训练目标和验证目标不同，要分别计算', '训练误差降低就保证验证误差降低', '只要小船更接近一个点就足够'],
    'sensitivity': ['RMS衡量曲线变化，验证MSE衡量预测误差，需要分别核对', '阶数更大就必然变化更大', 'RMS越大就代表验证误差越小'],
    'regularization': ['系数收缩与验证误差是两个量，需要分别核对', '枝条越短就一定预测越准', '只要训练误差更低就应继续加大α'],
    'forest': ['单点纠正与全体验证表现要分别比较', '纠正一个样本就保证整体变好', '只看训练准确率就能判断新样本'],
}


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Prepare(Strict):
    panel: Panel
    mode: Mode = 'discovery'
    avoid_seed: int = 0
    autonomous: bool = False
    content_version: Literal[2,3] = 3


class Predict(Strict):
    choice: int = Field(ge=0, le=2)
    confidence: int = Field(ge=1, le=3)
    reason: str = Field(default='', max_length=500)
    planned_alpha: float | None = None


class Input(Strict):
    parameters: dict


class Answer(Strict):
    task_id: str = Field(max_length=40)
    choice: int = Field(ge=0, le=2)
    reason: int = Field(ge=0, le=2)


class Decision(Strict):
    task_id: str = Field(max_length=40)
    choice: int = Field(ge=0, le=2)


class Checkpoint(Strict):
    stage: Literal['predict', 'experiment', 'transfer']
    parameters: dict
    selected: int = Field(default=0, ge=0, le=299)
    choice: int | None = Field(default=None, ge=0, le=2)
    confidence: int = Field(default=2, ge=1, le=3)
    reason: str = Field(default='', max_length=500)
    planned_alpha: float | None = None
    transfer_choice: int | None = Field(default=None, ge=0, le=2)
    transfer_reason: int | None = Field(default=None, ge=0, le=2)
    client_updated_at: str = Field(default='', max_length=40)


def checkpoint_value(saved, request):
    if saved['stage'] != request.stage:
        raise ValueError('学习阶段已更新，旧草稿不会覆盖已提交答案。')
    current = params(saved['panel'], request.parameters).model_dump()
    if request.client_updated_at: datetime.fromisoformat(request.client_updated_at)
    if saved['panel'] != 'forest' and request.selected >= current['samples']:
        raise ValueError('选点不在当前训练样本中。')
    value = request.model_dump() | {'parameters': current, 'updated_at': learning.now()}
    if request.stage != 'predict':
        value.update(choice=None, confidence=2, reason='', planned_alpha=None)
    elif request.planned_alpha is not None and request.planned_alpha not in concepts.ALPHAS:
        raise ValueError('首轮α不在候选范围中。')
    if request.stage != 'transfer':
        value.update(transfer_choice=None, transfer_reason=None)
    elif saved.get('transfer_decision'):
        value['transfer_choice']=saved['transfer_decision']['choice']
    return value


class AIRequest(Input):
    panel: Panel
    attempt_id: str = Field(max_length=40)


def params(panel, raw):
    value = (classification.ClassificationParameters if panel == 'forest' else concepts.ConceptRequest).model_validate(raw)
    if panel != 'forest' and value.panel != panel:
        raise ValueError('参数与当前岛屿不一致')
    return value


def calculate(panel, raw):
    p = params(panel, raw)
    return classification.run(p) if panel == 'forest' else concepts.run(p)


def direction(a, b):
    return 2 if math.isclose(a, b, rel_tol=1e-7, abs_tol=1e-10) else (0 if b < a else 1)


def evidence(panel, before, after, row=None, mode='discovery'):
    if before['validation_fingerprint'] != after['validation_fingerprint']:
        raise ValueError('验证数据已改变，不能比较')
    if panel == 'forest':
        a, b = before['metrics'], after['metrics']
        first = next(p for p in before['validation'] if p['row'] == row)
        last = next(p for p in after['validation'] if p['row'] == row)
        return {'before': a['validation_accuracy'], 'after': b['validation_accuracy'], 'metric': '验证准确率',
                'choice': direction(1-a['validation_accuracy'], 1-b['validation_accuracy']),
                'before_train': a['train_accuracy'], 'after_train': b['train_accuracy'],
                'before_mistakes': a['mistakes'], 'after_mistakes': b['mistakes'],
                'row': row, 'before_prediction': first['prediction'], 'prediction': last['prediction'],
                'label': last['label'], 'fixed': not first['correct'] and last['correct'],
                'validation_fingerprint': after['validation_fingerprint']}
    if panel == 'sensitivity':
        a, b = after['pairs']
        return {'before': a['shift_rms'], 'after': b['shift_rms'], 'metric': '曲线变化RMS（A / B）',
                'choice': (direction(a['edited']['validation_mse'], b['edited']['validation_mse']) if mode == 'counterexample'
                           else direction(a['shift_rms'], b['shift_rms'])),
                'a_validation': a['edited']['validation_mse'], 'b_validation': b['edited']['validation_mse'],
                'validation_fingerprint': after['validation_fingerprint']}
    a = before['linear'] if panel == 'error' else before['regularization']['current']
    b = after['linear'] if panel == 'error' else after['regularization']['current']
    return {'before': a['validation_mse'], 'after': b['validation_mse'], 'metric': '验证MSE',
            'choice': direction(a['validation_mse'], b['validation_mse']),
            'before_train': a['train_mse'], 'after_train': b['train_mse'],
            **({'before_norm': a['weight_norm'], 'after_norm': b['weight_norm']} if panel == 'regularization' else {}),
            'validation_fingerprint': after['validation_fingerprint']}


def package(panel, mode, before, after, control, row=None):
    a, b = calculate(panel, before), calculate(panel, after)
    proof = evidence(panel, a, b, row, mode)
    choices = ['降低', '升高', '几乎不变']
    question = '完成这项操作后，验证MSE会怎样变化？'
    if panel == 'sensitivity':
        choices = ['A变化更大', 'B变化更大', '近似相同']
        question = '同一枚路钉移动后，哪条道路的变化RMS更大？'
        if mode == 'counterexample':
            choices = ['B验证MSE更低', 'A验证MSE更低', '近似相同']
            question = '这次B的曲线变化更大，它与A的验证MSE谁更低？'
    elif panel == 'forest':
        choices = ['整体更好', '整体更差', '基本相同']
        question = f'切换模型救回第{row+1}件包裹后，全体验证表现会怎样？'
    if control == 'edits':
        edit = after['edits'][0]
        operation = f"把训练点{edit['index']+1}移到 y={edit['y']:.3f}"
    else:
        def label(value):
            return classification.MODELS.get(value, value) if isinstance(value, str) else f'{value:g}'
        operation = f'{LABELS[control]}：{label(before[control])} → {label(after[control])}'
    reason_index = (before['seed'] + list(NAMES).index(panel)) % 3
    reasons = REASONS[panel][1:]
    reasons.insert(reason_index, REASONS[panel][0])
    context = ('XOR合成数据；相同训练与验证划分' if panel == 'forest' else
               f"A为3阶，B为{before['degree']}阶；共同α={before['alpha']:g}" if panel == 'sensitivity' else
               f"{before['degree']}阶多项式；{before['samples']}个训练样本" if panel == 'regularization' else
               f"斜率a={before['slope']:g}；{before['samples']}个训练样本")
    return {'panel': panel, 'mode': mode, 'title': NAMES[panel] + (' · 反例挑战' if mode == 'counterexample' else ' · 一次发现'),
            'context': context,
            'question': question, 'choices': choices, 'reasons': reasons, 'operation': operation,
            'control': control, 'before_parameters': before, 'target_parameters': after,
            'focus': ('map' if panel == 'forest' else 'shift' if panel == 'sensitivity' and mode == 'discovery' else 'validation'),
            'row': row, 'selected': after['edits'][0]['index'] if panel == 'sensitivity' else 0,
            'seed': before['seed'], '_proof': proof, '_reason': reason_index}


@lru_cache(maxsize=24)
def case(panel, mode, seed):
    if panel == 'forest':
        base = classification.ClassificationParameters(dataset='xor', seed=seed).model_dump()
        if mode == 'discovery':
            after = {**base, 'model': 'svm'}
            a, b = calculate(panel, base), calculate(panel, after)
            row = next(p['row'] for p, q in zip(a['validation'], b['validation']) if not p['correct'] and q['correct'])
            return package(panel, mode, base, after, 'model', row)
        for depth in (4, 2, 8):
            variants = [{**base, 'depth': depth, 'model': name} for name in ('logistic', 'svm', 'tree', 'knn')]
            results = [calculate(panel, p) for p in variants]
            for i, a in enumerate(results):
                for j, b in enumerate(results):
                    if i == j or b['metrics']['validation_accuracy'] > a['metrics']['validation_accuracy'] + 1e-10: continue
                    row = next((p['row'] for p, q in zip(a['validation'], b['validation']) if not p['correct'] and q['correct']), None)
                    if row is not None: return package(panel, mode, variants[i], variants[j], 'model', row)
    else:
        base = concepts.ConceptRequest(panel=panel, seed=seed, slope=0, intercept=.8).model_dump()
        if panel == 'error':
            if mode == 'discovery': return package(panel, mode, base, {**base, 'intercept': 0}, 'intercept')
            for slope in (0, .5, -1, 1, -2, 2):
                for index in range(-15, 16):
                    first = {**base, 'slope': slope, 'intercept': round(index/10, 3)}
                    for delta in (.1, -.1):
                        last = {**first, 'intercept': round(first['intercept']+delta, 3)}
                        proof = evidence(panel, calculate(panel, first), calculate(panel, last))
                        if proof['after_train'] < proof['before_train']-1e-6 and proof['choice'] == 1:
                            return package(panel, mode, first, last, 'intercept')
        elif panel == 'regularization':
            base['alpha'] = .01
            if mode == 'discovery': return package(panel, mode, base, {**base, 'alpha': .1}, 'alpha')
            for initial, target in ((.01, 100), (.1, 100), (1e-6, 100), (.01, 10)):
                first, last = {**base, 'alpha': initial}, {**base, 'alpha': target}
                proof = evidence(panel, calculate(panel, first), calculate(panel, last))
                if proof['after_norm'] < proof['before_norm'] and proof['choice'] == 1:
                    return package(panel, mode, first, last, 'alpha')
        else:
            for alpha in ((1e-6,) if mode == 'discovery' else (1e-6, 1e-4, .01, .1, 1)):
                for degree in ((12,) if mode == 'discovery' else (4, 6, 8, 12, 15)):
                    first = {**base, 'alpha': alpha, 'degree': degree}
                    actual = calculate(panel, first)
                    for index in ((5,) if mode == 'discovery' else range(12)):
                        value = round(min(3, actual['train'][index]['original_y']+.2), 2)
                        last = {**first, 'edits': [{'index': index, 'y': value}]}
                        proof = evidence(panel, actual, calculate(panel, last))
                        if mode == 'discovery' or (proof['after'] > proof['before']*1.1 and proof['b_validation'] < proof['a_validation']*.95):
                            return package(panel, mode, first, last, 'edits')
    raise ValueError('在限定候选中没有找到满足条件的实例，请换一种挑战。')


def descriptor(task):
    return {k: copy.deepcopy(v) for k, v in task.items() if not k.startswith('_')}


def seen_case(records, task):
    for s in records:
        if s['panel'] != task['panel']: continue
        for old, viewed in ((s.get('_case'), bool(s.get('prediction'))), (s.get('_transfer'), bool(s.get('transfer_answer')))):
            if old and viewed and old['mode'] == task['mode'] and old['before_parameters'] == task['before_parameters'] and old['target_parameters'] == task['target_parameters']:
                return True
    return False


def public(saved):
    value = {k: copy.deepcopy(v) for k, v in saved.items() if not k.startswith('_')}
    value['task'] = descriptor(saved['_case'])
    if not saved.get('observation') and saved['_case'].get('content_version',1) >= 2:
        value['task'].pop('assessment', None)
        value['task']['reasons'] = []
    value['transfer_task'] = descriptor(saved['_transfer']) | {'id': saved['_transfer_id']} if saved.get('_transfer') else None
    if value['transfer_task'] and saved['_transfer'].get('content_version')==3 and not saved.get('transfer_decision'):
        value['transfer_task']['reasons']=[]
    return value


def ai_options(panel, raw):
    p = params(panel, raw).model_dump()
    settings = ([('model', v) for v in classification.MODELS] if panel == 'forest' else
                [('intercept', v) for v in (-.5, 0, .5)] + [('slope', v) for v in (-1, 0, 1)] if panel == 'error' else
                [('alpha', v) for v in concepts.ALPHAS] + ([('degree', v) for v in (3, 6, 12, 15)] if panel == 'sensitivity' else []))
    return [{'id': f'{key}-{value}', 'control': key, 'label': LABELS[key], 'from_value': p[key], 'to_value': value}
            for key, value in settings if p[key] != value]


def error_metric(panel, result):
    if panel == 'forest': return 1-result['metrics']['validation_accuracy']
    if panel == 'sensitivity': return result['pairs'][1]['edited']['validation_mse']
    return result['linear']['validation_mse'] if panel == 'error' else result['regularization']['current']['validation_mse']


def make_router(connect):
    router = APIRouter(prefix='/islands')

    def load(connection, table, key):
        row = connection.execute(f'SELECT content FROM {table} WHERE id=?', (key,)).fetchone()
        if not row: raise HTTPException(404, '学习记录不存在，请新建挑战。')
        return json.loads(row['content'])

    def save(connection, table, item):
        item['updated_at'] = learning.now()
        connection.execute(f'INSERT OR REPLACE INTO {table}(id,content) VALUES (?,?)', (item['id'], json.dumps(item, ensure_ascii=False)))

    @router.post('/tasks')
    def prepare(request: Prepare):
        seeds = (42, 43, 44) if request.panel == 'forest' else (2026, 314, 2718)
        seed = next(s for s in seeds if s != request.avoid_seed)
        if request.autonomous and request.panel != 'regularization':
            raise HTTPException(422, '自主反例目前位于约束花园。')
        try:
            task=(pedagogy.version3(request.panel,request.mode,seed,autonomous=request.autonomous) if request.content_version==3 else
                  pedagogy.investigation(seed) if request.autonomous else pedagogy.upgrade(case(request.panel,request.mode,seed)))
        except ValueError as error: raise HTTPException(409, str(error))
        saved = {'id': uuid.uuid4().hex, 'created_at': learning.now(), 'panel': request.panel, 'mode': request.mode,
                 'protocol_version': request.content_version,
                 'stage': 'predict', 'prediction': None, 'observation': None, 'transfer_answer': None,
                 'hints_used': 0, 'ai_before_transfer': [], '_case': task, '_transfer': None}
        with connect() as connection:
            records = [json.loads(row['content']) for row in connection.execute('SELECT content FROM island_attempts').fetchall()]
            saved['mode'] = task['mode']
            saved['transfer_variant'] = sum(s['panel']==request.panel and bool(s.get('prediction')) for s in records) % 3
            saved['trials'] = []
            saved['repeated_case'] = seen_case(records, task)
            save(connection, 'island_attempts', saved)
        return public(saved)

    @router.get('/history')
    def history():
        with connect() as connection:
            rows = connection.execute('SELECT content FROM island_attempts ORDER BY rowid DESC LIMIT 60').fetchall()
        return [{k: s.get(k) for k in ('id', 'created_at', 'panel', 'mode', 'stage', 'prediction', 'hints_used', 'transfer_answer', 'ai_before_transfer')}
                for row in rows if (s := json.loads(row['content'])).get('prediction') or s.get('transfer_only')]

    @router.get('/actions')
    def action_history(attempt_id: str):
        with connect() as connection:
            load(connection, 'island_attempts', attempt_id)
            rows = connection.execute("SELECT content FROM island_actions WHERE json_extract(content,'$.attempt_id')=? ORDER BY rowid DESC LIMIT 12", (attempt_id,)).fetchall()
        return [json.loads(row['content']) for row in rows]

    @router.get('/attempts/{key}')
    def restore(key: str):
        with connect() as connection: return public(load(connection, 'island_attempts', key))

    @router.post('/attempts/{key}/checkpoint')
    def checkpoint(key: str, request: Checkpoint):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_attempts', key)
            try: value = checkpoint_value(saved, request)
            except (ValidationError, ValueError) as error: raise HTTPException(409, str(error))
            previous = (saved.get('checkpoint') or {}).get('client_updated_at', '')
            if previous and request.client_updated_at and request.client_updated_at < previous:
                return {'saved':False, 'stale':True}
            saved['checkpoint'] = value
            save(connection, 'island_attempts', saved)
        return {'saved': True, 'updated_at': value['updated_at']}

    @router.post('/attempts/{key}/practice')
    def practice(key: str):
        with connect() as connection:
            original = load(connection, 'island_attempts', key)
            if not original['transfer_answer']:
                raise HTTPException(409, '先完成本轮迁移，再开始针对性复练。')
            previous = original['_transfer']
            seeds = (42, 43, 44) if original['panel'] == 'forest' else (2026, 314, 2718)
            seed = next(s for s in seeds if s not in (original['_case']['seed'], previous['seed']))
            task = (pedagogy.version3(original['panel'],previous['mode'],seed) if original['_case'].get('content_version')==3 else
                    pedagogy.upgrade(case(original['panel'],previous['mode'],seed)))
            older = [json.loads(r['content']) for r in connection.execute('SELECT content FROM island_attempts').fetchall()]
            repeated = seen_case(older, task)
            saved = {'id': uuid.uuid4().hex, 'created_at': learning.now(), 'panel': original['panel'], 'mode': task['mode'],
                     'protocol_version': task.get('content_version',2), 'stage': 'predict', 'prediction': None, 'observation': None,
                     'transfer_answer': None, 'hints_used': 0, 'ai_before_transfer': [], '_case': task, '_transfer': None,
                     'practice_of': key, 'practice_focus': REASONS[original['panel']][0], 'repeated_case': repeated,
                     'transfer_variant': (original.get('transfer_variant',0)+1)%3, 'trials': []}
            save(connection, 'island_attempts', saved)
        return public(saved)

    @router.post('/attempts/{key}/predict')
    def predict(key: str, request: Predict):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_attempts', key)
            if saved['prediction']:
                if any(saved['prediction'].get(k) != v for k, v in request.model_dump().items()):
                    raise HTTPException(409, '首次预测已锁定，请完成本轮或新建练习。')
            else:
                if saved['_case'].get('investigation'):
                    if request.planned_alpha not in concepts.ALPHAS or request.planned_alpha <= saved['_case']['before_parameters']['alpha']:
                        raise HTTPException(422, '先选择第一次实验的α，再锁定预测。')
                saved['prediction'] = request.model_dump() | {'submitted_at': learning.now()}
                saved['stage'] = 'experiment'
                save(connection, 'island_attempts', saved)
        return public(saved)

    @router.post('/attempts/{key}/observe')
    def observe(key: str, request: Input):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_attempts', key)
            task = saved['_case']
            if not saved['prediction']: raise HTTPException(409, '请先留下预测。')
            try: current = params(saved['panel'], request.parameters).model_dump()
            except (ValidationError, ValueError): raise HTTPException(422, '实验参数不合法。')
            if task.get('investigation') and not saved['observation']:
                trials = saved.setdefault('trials', [])
                if not trials and current['alpha'] != saved['prediction']['planned_alpha']:
                    raise HTTPException(409, '先核验预测时锁定的第一次α，再继续寻找。')
                try: proof = pedagogy.trial(task,current)
                except ValueError as error: raise HTTPException(409,str(error))
                if not any(t['parameters']==current for t in trials):
                    trials.append({'parameters':current, 'proof':proof, 'observed_at':learning.now()})
                if proof['goal_met']:
                    task['target_parameters'] = current
                    task['_proof'] = proof
                    saved['observation'] = proof | {'matched':trials[0]['proof']['choice']==saved['prediction']['choice'],
                        'first_choice':trials[0]['proof']['choice'], 'conclusion':'找到一个实算反例：系数收缩与验证误差降低不是同一个目标。',
                        'observed_at':learning.now()}
                    saved['stage'] = 'review'
                save(connection,'island_attempts',saved)
                return public(saved)
            if current != task['target_parameters']: raise HTTPException(409, '请保持其他条件不变，完成任务中的操作后再核验。')
            if not saved['observation']:
                proof = evidence(saved['panel'], calculate(saved['panel'], task['before_parameters']), calculate(saved['panel'], current), task['row'], task['mode'])
                saved['observation'] = proof | {'matched': proof['choice'] == saved['prediction']['choice'],
                                                'conclusion': task['reasons'][task['_reason']],
                                                'observed_at': learning.now()}
                saved['stage'] = 'review'
                save(connection, 'island_attempts', saved)
        return public(saved)

    @router.post('/attempts/{key}/hint')
    def hint(key: str):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_attempts', key)
            if saved['stage'] != 'experiment': raise HTTPException(409, '当前阶段没有实验提示。')
            saved['hints_used'] = min(2, saved['hints_used']+1)
            save(connection, 'island_attempts', saved)
        return public(saved)

    @router.post('/attempts/{key}/transfer-task')
    def transfer_task(key: str):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_attempts', key)
            if not saved['observation']: raise HTTPException(409, '先核验本轮实验。')
            if not saved.get('_transfer'):
                seeds = (42, 43, 44) if saved['panel'] == 'forest' else (2026, 314, 2718)
                seed = next(s for s in seeds if s != saved['_case']['seed'])
                mode = 'discovery' if saved['mode'] == 'counterexample' else 'counterexample'
                form = ('comparison','model_selection','controlled_design')[saved.get('transfer_variant',0)] if saved['panel']=='regularization' else 'comparison'
                try: saved['_transfer'] = (pedagogy.version3(saved['panel'],mode,seed,form,saved.get('transfer_variant',0)) if saved['_case'].get('content_version')==3 else
                                          pedagogy.upgrade(case(saved['panel'], mode, seed), form))
                except ValueError as error: raise HTTPException(409, str(error))
                saved['_transfer_id'] = uuid.uuid4().hex
                saved['stage'] = 'transfer'
                save(connection, 'island_attempts', saved)
        return public(saved)

    @router.post('/attempts/{key}/decision')
    def decision(key: str, request: Decision):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved=load(connection,'island_attempts',key)
            if not saved.get('_transfer') or request.task_id!=saved.get('_transfer_id'):
                raise HTTPException(409,'请先进入本轮迁移题。')
            old=saved.get('transfer_decision')
            if old:
                if any(old[k]!=v for k,v in request.model_dump().items()): raise HTTPException(409,'首次判断已锁定，请继续选择依据。')
            else:
                if saved['stage']!='transfer': raise HTTPException(409,'本轮已提交。')
                saved['transfer_decision']=request.model_dump()|{'submitted_at':learning.now()}
                save(connection,'island_attempts',saved)
        return public(saved)

    @router.post('/attempts/{key}/answer')
    def answer(key: str, request: Answer):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_attempts', key)
            if not saved.get('_transfer') or request.task_id != saved['_transfer_id']:
                raise HTTPException(409, '请先进入本轮迁移题。')
            old = saved['transfer_answer']
            if old:
                if any(old[k] != v for k, v in request.model_dump().items()): raise HTTPException(409, '本题首次作答已保留，请新建练习。')
            else:
                task = saved['_transfer']
                if task.get('content_version')==3 and (not saved.get('transfer_decision') or saved['transfer_decision']['choice']!=request.choice):
                    raise HTTPException(409,'先锁定判断，再选择依据；首次判断不能改写。')
                proof = task['_proof']
                passed = request.choice == proof['choice'] and request.reason == task['_reason']
                saved['transfer_answer'] = request.model_dump() | {'passed': passed, 'choice_correct': request.choice == proof['choice'],
                    'reason_correct': request.reason == task['_reason'], 'correct_reason': task['_reason'], 'proof': proof,
                    'assisted': bool(saved['hints_used'] or saved['ai_before_transfer']), 'submitted_at': learning.now()}
                saved['stage'], saved['completed_at'] = 'complete', learning.now()
                save(connection, 'island_attempts', saved)
        return public(saved)

    @router.post('/actions/plan')
    async def plan(request: AIRequest):
        with connect() as connection: attempt = load(connection, 'island_attempts', request.attempt_id)
        if attempt['panel'] != request.panel or attempt['stage'] not in ('review', 'complete'):
            raise HTTPException(409, '请先核验观察；迁移作答期间暂停AI探索。')
        try: current = params(request.panel, request.parameters).model_dump()
        except (ValidationError, ValueError): raise HTTPException(422, '实验参数不合法。')
        result = await asyncio.to_thread(calculate, request.panel, current)
        options = ai_options(request.panel, current)
        focus = pedagogy.diagnosis(attempt)
        response = await coach.suggest({'parameters': current, 'metric': '验证错误率' if request.panel == 'forest' else '验证MSE',
            'value': error_metric(request.panel, result), 'learning_context': {'prediction': attempt['prediction'], 'observation': attempt['observation'],
                'diagnosis':focus, 'instruction':'围绕已提交依据中的待检验线索选择单变量操作，提出可用验证误差方向核验的假设；不确定时使用uncertain。'}}, options)
        try:
            selection = Suggestion.model_validate(response['suggestion'])
            selected = next(v for v in options if v['id'] == selection.candidate_id)
        except (ValidationError, StopIteration):
            selected = options[0]
            selection = Suggestion(candidate_id=selected['id'], expected='uncertain', hypothesis=f"围绕“{focus['label']}”，保持数据与其余条件不变，比较这项单变量操作前后的验证表现。")
            response['mode'], response['model'] = 'rules', None
            response['notice'] = response.get('notice') or '模型候选未通过校验，使用规则方案。'
        target = params(request.panel, {**current, selected['control']: selected['to_value']}).model_dump()
        saved = {'id': uuid.uuid4().hex, 'attempt_id': attempt['id'], 'panel': request.panel, 'created_at': learning.now(),
                 'baseline_parameters': current, 'target_parameters': target, 'change': selected,
                 'mode': response['mode'], 'model': response['model'], 'notice': response['notice'], 'usage': response.get('usage', {}),
                 'reasoning_effort': coach.ai_status()['reasoning_effort'], 'hypothesis': selection.hypothesis,
                 'expected': selection.expected, 'execution': None, 'learning_focus':focus}
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            latest = load(connection, 'island_attempts', attempt['id'])
            save(connection, 'island_actions', saved)
            if not latest['transfer_answer'] and saved['id'] not in latest['ai_before_transfer']:
                latest['ai_before_transfer'].append(saved['id'])
                save(connection, 'island_attempts', latest)
        return saved

    @router.post('/actions/{key}/execute')
    def execute(key: str, request: Input):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            saved = load(connection, 'island_actions', key)
            attempt = load(connection, 'island_attempts', saved['attempt_id'])
            if attempt['stage'] not in ('review', 'complete'): raise HTTPException(409, '迁移作答期间暂停AI探索。')
            try: current = params(saved['panel'], request.parameters).model_dump()
            except (ValidationError, ValueError): raise HTTPException(422, '实验参数不合法。')
            if current != saved['baseline_parameters']: raise HTTPException(409, '参数已变化，请重新生成AI方案。')
            if not saved['execution']:
                a, b = calculate(saved['panel'], current), calculate(saved['panel'], saved['target_parameters'])
                if a['validation_fingerprint'] != b['validation_fingerprint']: raise HTTPException(409, '验证划分不一致。')
                first, last = error_metric(saved['panel'], a), error_metric(saved['panel'], b)
                observed = ('lower', 'higher', 'unchanged')[direction(first, last)]
                saved['execution'] = {'before': first, 'after': last, 'delta': last-first, 'observed': observed,
                    'verdict': 'observed' if saved['expected'] == 'uncertain' else 'supported' if saved['expected'] == observed else 'not_supported',
                    'metric': '验证错误率' if saved['panel'] == 'forest' else '验证MSE', 'validation_fingerprint': a['validation_fingerprint'],
                    'before_fingerprint': a.get('data_fingerprint', a.get('fingerprint')), 'after_fingerprint': b.get('data_fingerprint', b.get('fingerprint')),
                    'executed_at': learning.now(), 'test_sealed': True,
                    'observations':pedagogy.action_observations(saved['panel'],a,b)}
                save(connection, 'island_actions', saved)
                if not attempt['transfer_answer'] and saved['id'] not in attempt['ai_before_transfer']:
                    attempt['ai_before_transfer'].append(saved['id'])
                    save(connection, 'island_attempts', attempt)
        return saved

    return router
