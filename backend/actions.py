"""One-variable experiment plans. Model hypotheses never become numerical evidence."""
import asyncio
import json
import math
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend import bench, coach, experiments, learning


class PlanRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['synthetic', 'bench']
    parameters: dict
    test_previously_viewed: bool = False
    learning_attempt_id: str | None = Field(default=None, max_length=40)


class ExecuteRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    parameters: dict


class Suggestion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    candidate_id: str = Field(max_length=60)
    hypothesis: str = Field(min_length=3, max_length=400)
    expected: Literal['lower', 'higher', 'uncertain']


LABELS = {'degree': '模型阶数', 'samples': '训练样本量', 'alpha': '正则化强度',
          'depth': '最大树深', 'fraction': '训练池使用比例', 'model': '模型'}


def parameters(kind, raw):
    return (experiments.Parameters if kind == 'synthetic' else bench.BenchParameters).model_validate(raw)


def calculate(kind, params):
    return experiments.run(params) if kind == 'synthetic' else bench.run(params)


def candidates_for(kind, params):
    if kind == 'synthetic':
        control, values = learning.lesson(params)
        preferred = {'degree': 4, 'samples': 120, 'alpha': 0.01}[control]
        settings = [(control, value) for value in sorted(values, key=lambda value: value != preferred)]
    else:
        control, values = ('alpha', [0.01, 1, 100]) if params.model == 'ridge' else ('depth', [2, 5, 12])
        settings = [(control, value) for value in values]
        settings += [('fraction', value) for value in (0.25, 0.5, 1)]
        settings += [('model', value) for value in ('ridge', 'tree', 'forest')]
    return [{'id': f'{control}-{value}', 'control': control, 'label': LABELS[control],
             'from_value': getattr(params, control), 'to_value': value}
            for control, value in settings if getattr(params, control) != value]


async def plan(request, learning_context=None):
    params = parameters(request.kind, request.parameters)
    baseline = await asyncio.to_thread(calculate, request.kind, params)
    options = candidates_for(request.kind, params)
    evidence = {'parameters': params.model_dump(), 'metrics': baseline['metrics'],
                'dataset': '合成余弦数据' if request.kind == 'synthetic' else baseline['dataset']['title'],
                'test_previously_viewed': request.test_previously_viewed}
    if learning_context: evidence['learning_context'] = learning_context
    response = await coach.suggest(evidence, options)
    try:
        selection = Suggestion.model_validate(response['suggestion'])
        selected = next(item for item in options if item['id'] == selection.candidate_id)
    except (ValidationError, StopIteration):
        selected = options[0]
        selection = Suggestion(candidate_id=selected['id'], expected='lower',
            hypothesis='保持数据划分和其他条件不变，检验这项单变量调整能否降低验证误差；结果也可能不支持预期。')
        if response['mode'] == 'online':
            response['notice'] = '模型建议未通过单变量候选校验，已使用规则方案。'
        response['mode'], response['model'] = 'rules', None
    target = params.model_copy(update={selected['control']: selected['to_value']})
    parameters(request.kind, target.model_dump())
    return {'id': uuid.uuid4().hex, 'kind': request.kind, 'created_at': learning.now(),
            'mode': response['mode'], 'model': response['model'], 'notice': response['notice'],
            'reasoning_effort': coach.ai_status()['reasoning_effort'], 'usage': response.get('usage', {}),
            'hypothesis': selection.hypothesis, 'expected': selection.expected, 'change': selected,
            'baseline_parameters': params.model_dump(), 'target_parameters': target.model_dump(),
            'baseline_fingerprint': baseline.get('data_fingerprint', baseline.get('fingerprint')),
            'learning_attempt_id': request.learning_attempt_id,
            'learning_prediction': learning_context['prediction']['label'] if learning_context else None,
            'test_previously_viewed': request.test_previously_viewed, 'execution': None}


def execute(saved):
    before = calculate(saved['kind'], parameters(saved['kind'], saved['baseline_parameters']))
    after = calculate(saved['kind'], parameters(saved['kind'], saved['target_parameters']))
    metric_name = 'validation_mse' if saved['kind'] == 'synthetic' else 'validation_rmse'
    a, b = before['metrics'][metric_name], after['metrics'][metric_name]
    delta = b - a
    observed = 'unchanged' if math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12) else ('lower' if b < a else 'higher')
    verdict = 'observed' if saved['expected'] == 'uncertain' else ('supported' if observed == saved['expected'] else 'not_supported')
    return {'id': saved['id'], 'kind': saved['kind'], 'executed_at': learning.now(),
            'mode': saved['mode'], 'model': saved['model'], 'reasoning_effort': saved['reasoning_effort'],
            'learning_prediction': saved.get('learning_prediction'),
            'change': saved['change'], 'hypothesis': saved['hypothesis'], 'expected': saved['expected'],
            'before': before, 'after': after, 'metric': metric_name, 'delta': delta,
            'observed': observed, 'verdict': verdict, 'test_not_consulted': True,
            'note': ('本次仅核验当前固定条件下的验证误差，不证明普遍改善。'
                     + ('本浏览器声明此前已查看测试结果，后续调参属于探索。' if saved['test_previously_viewed'] else '独立测试未参与本次计算。'))}


def make_router(connect):
    router = APIRouter(prefix='/actions')

    @router.post('/plan')
    async def create(request: PlanRequest):
        context = None
        try:
            if request.learning_attempt_id:
                current = parameters(request.kind, request.parameters)
                with connect() as connection:
                    row = connection.execute('SELECT content FROM learning_attempts WHERE id=?', (request.learning_attempt_id,)).fetchone()
                if not row: raise HTTPException(404, '本轮学习记录不存在')
                attempt = json.loads(row['content'])
                if request.kind != 'synthetic' or not learning.matches(attempt, current):
                    raise HTTPException(409, '学习预测与当前固定条件不一致，请重新预测。')
                visible = learning.public(attempt)
                context = {key: visible[key] for key in ('prediction', 'prediction_review') if key in visible}
                context['transfer_feedback'] = [{'passed': item['passed'], 'selected_reason': item['task']['reasons'][item['reason']]}
                                                for item in visible['transfer_attempts']]
            saved = await plan(request, context)
        except ValidationError: raise HTTPException(422, '实验参数不符合当前课程约束')
        with connect() as connection:
            connection.execute('INSERT INTO action_plans(id,content) VALUES (?,?)', (saved['id'], json.dumps(saved, ensure_ascii=False)))
        return saved

    @router.get('/history')
    def history():
        with connect() as connection:
            rows = connection.execute('SELECT content FROM action_plans ORDER BY rowid DESC LIMIT 30').fetchall()
        return [{**saved['execution'], 'mode': saved['mode'], 'model': saved['model']}
                for row in rows if (saved := json.loads(row['content']))['execution']]

    @router.post('/{plan_id}/execute')
    def run_plan(plan_id: str, request: ExecuteRequest):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT content FROM action_plans WHERE id=?', (plan_id,)).fetchone()
            if not row: raise HTTPException(404, '实验方案不存在')
            saved = json.loads(row['content'])
            try: current = parameters(saved['kind'], request.parameters).model_dump()
            except ValidationError: raise HTTPException(422, '当前参数不符合约束')
            if current != saved['baseline_parameters']:
                raise HTTPException(409, '实验条件已改变，请重新生成建议。')
            if saved['execution'] is None:
                saved['execution'] = execute(saved)
                connection.execute('UPDATE action_plans SET content=? WHERE id=?', (json.dumps(saved, ensure_ascii=False), plan_id))
        return saved['execution']

    return router
