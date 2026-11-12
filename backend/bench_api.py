import asyncio
from fastapi import APIRouter
from pydantic import Field

from backend.bench import BenchParameters, compare, final, learning, run, stability
from backend.coach import explain
from backend.datasets import catalog

router = APIRouter()


@router.get('/datasets')
def datasets():
    return catalog()


@router.post('/bench/run')
def experiment(params: BenchParameters):
    return run(params)


@router.post('/bench/compare')
def comparison(params: BenchParameters):
    return compare(params)


@router.post('/bench/learning')
def learning_curve(params: BenchParameters):
    return learning(params)


@router.post('/bench/stability')
def repeated_splits(params: BenchParameters):
    return stability(params)


@router.post('/bench/final')
def final_evaluation(params: BenchParameters):
    return final(params)


class BenchCoachRequest(BenchParameters):
    question: str = Field(default='解释这次真实数据实验，并建议下一步验证。', max_length=500)
    with_comparison: bool = False
    with_stability: bool = False
    test_previously_viewed: bool = False


@router.post('/bench/coach')
async def bench_coach(request: BenchCoachRequest):
    params = BenchParameters.model_validate(request.model_dump(exclude={'question', 'with_comparison', 'with_stability', 'test_previously_viewed'}))
    result = await asyncio.to_thread(run, params)
    evidence = {key: result[key] for key in ('parameters', 'model_name', 'metrics', 'split', 'protocol', 'fingerprint')}
    evidence['parameters'] = {key: value for key, value in params.model_dump().items()
                              if key not in ({'depth'} if params.model == 'ridge' else {'alpha'})}
    evidence['available_controls'] = ['model', 'fraction', 'seed', 'alpha' if params.model == 'ridge' else 'depth']
    evidence['dataset'] = {key: result['dataset'][key] for key in ('title', 'unit', 'features', 'source', 'version')}
    evidence['browser_declared_test_exposure'] = request.test_previously_viewed
    if request.with_comparison:
        evidence['comparison'] = await asyncio.to_thread(compare, params)
        evidence['comparison_settings'] = {'ridge_alpha': params.alpha, 'tree_and_forest_depth': params.depth, 'forest_estimators': 60}
    if request.with_stability: evidence['stability'] = await asyncio.to_thread(stability, params)
    fallback = f"训练RMSE为{result['metrics']['train_rmse']:.3f}，验证RMSE为{result['metrics']['validation_rmse']:.3f}。保持数据与划分不变，比较模型复杂度；再用配对种子复核。独立测试应留到最后。"
    return await explain(evidence, request.question, fallback)
