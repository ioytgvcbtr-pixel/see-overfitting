"""Evidence-backed learning attempts, with sealed transfer answers."""
import copy
import math
import uuid
from datetime import datetime, timezone

from backend.experiments import Parameters, run


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


def lesson(params):
    if params.scene == 'samples':
        return 'samples', [12, 60, 120]
    if params.scene == 'regularization':
        return 'alpha', [1e-8, 0.01, 1]
    return 'degree', [1, 4, 15]


def label(control, value):
    if control == 'samples': return f'{value} 个样本'
    if control == 'degree': return f'{value} 阶模型'
    return f'α = {value:g}'


def matches(attempt, params):
    baseline = Parameters.model_validate(attempt['parameters'])
    control, _ = lesson(baseline)
    return all(value == params.model_dump()[key] for key, value in baseline.model_dump().items() if key != control)


def start(params, choice, confidence, reason):
    control, values = lesson(params)
    return {'id': uuid.uuid4().hex, 'created_at': now(), 'parameters': params.model_dump(),
            'control': control, 'stage': 'experiment', 'prediction': {
                'choice': choice, 'value': values[choice], 'label': label(control, values[choice]),
                'confidence': confidence, 'reason': reason, 'submitted_at': now()},
            'observations': [], 'transfer_attempts': [], '_task': None}


def transfer_task(attempt):
    base = Parameters.model_validate(attempt['parameters'])
    control, _ = lesson(base)
    pairs = {'degree': (3, 12), 'samples': (24, 100), 'alpha': (0.0001, 0.1)}
    transfer_seed = (base.seed + 137 * (len(attempt['transfer_attempts']) + 1)) % 1000000
    rows = []
    for name, value in zip(('A', 'B'), pairs[control]):
        params = base.model_copy(update={control: value, 'seed': transfer_seed})
        result = run(params)
        rows.append({'name': name, 'label': label(control, value), 'parameters': params.model_dump(),
                     'metrics': {key: float(f'{number:.6g}') for key, number in result['metrics'].items()},
                     'data_fingerprint': result['data_fingerprint']})
    a, b = [row['metrics']['validation_mse'] for row in rows]
    answer = 2 if a == b else (0 if a < b else 1)
    return {'id': uuid.uuid4().hex, 'seed': transfer_seed, 'rows': rows,
            'question': '换一批数据后，按表中的验证误差，哪组更值得保留作最后评估？',
            'options': ['保留 A', '保留 B', '两组验证误差相同'],
            'reasons': ['用验证误差比较，独立测试留到选参结束后', '只选训练误差最低的组', '反复看测试误差，再挑最低的一组'],
            '_answer': answer, 'created_at': now()}


def observe(attempt, params):
    if not matches(attempt, params):
        raise ValueError('固定条件已改变，请为新一轮重新提交预测。')
    result = run(params)
    attempt['last_parameters'] = params.model_dump()
    control, values = lesson(params)
    value = getattr(params, control)
    if value in values:
        index = values.index(value)
        if not any(item['index'] == index for item in attempt['observations']):
            attempt['observations'].append({'index': index, 'label': label(control, value), 'value': value,
                'parameters': params.model_dump(), 'metrics': result['metrics'],
                'data_fingerprint': result['data_fingerprint'], 'observed_at': now()})
    if len(attempt['observations']) == 3 and attempt['_task'] is None:
        attempt['_task'] = transfer_task(attempt)
        attempt['stage'] = 'transfer'
    return result


def grade(attempt, task_id, choice, reason):
    if len(attempt['observations']) != 3 or not attempt['_task']:
        raise ValueError('请先完成本轮三个条件的实际对照。')
    previous = next((item for item in attempt['transfer_attempts'] if item['task']['id'] == task_id), None)
    if previous:
        return previous  # Repeated network requests cannot count as extra attempts.
    task = attempt['_task']
    if task_id != task['id'] or attempt['stage'] == 'complete':
        raise ValueError('迁移题已更新，请读取当前题目。')
    passed = choice == task['_answer'] and reason == 0
    public_task = {key: value for key, value in task.items() if not key.startswith('_')}
    feedback = {'task': public_task, 'choice': choice, 'reason': reason, 'passed': passed,
                'correct_choice': task['_answer'], 'submitted_at': now(),
                'explanation': '本表中' + task['options'][task['_answer']].replace('保留 ', '') +
                    '对应较低或相同的验证误差。训练误差不能替代验证比较；一次划分不证明普遍最优。'}
    attempt['transfer_attempts'].append(feedback)
    if passed:
        attempt['stage'] = 'complete'
        attempt['completed_at'] = now()
    return feedback


def retry_transfer(attempt):
    if attempt['stage'] != 'transfer' or not attempt['transfer_attempts'] or attempt['transfer_attempts'][-1]['passed']:
        raise ValueError('仅在迁移验证未通过后可换一组新题。')
    if attempt['transfer_attempts'][-1]['task']['id'] != attempt['_task']['id']:
        raise ValueError('当前已有一组新的迁移题。')
    attempt['_task'] = transfer_task(attempt)


def public(attempt):
    result = {key: copy.deepcopy(value) for key, value in attempt.items() if not key.startswith('_')}
    task = attempt.get('_task')
    result['task'] = {key: copy.deepcopy(value) for key, value in task.items() if not key.startswith('_')} if task else None
    if len(attempt['observations']) == 3:
        lowest = min(item['metrics']['validation_mse'] for item in attempt['observations'])
        best = [item for item in attempt['observations'] if math.isclose(item['metrics']['validation_mse'], lowest, rel_tol=1e-9, abs_tol=1e-12)]
        result['prediction_review'] = {
            'matched': any(item['index'] == attempt['prediction']['choice'] for item in best),
            'best_labels': [item['label'] for item in best],
            'note': '只比较本轮固定条件下的三次实际验证误差，不推断所有数据的最优参数。'}
    return result
