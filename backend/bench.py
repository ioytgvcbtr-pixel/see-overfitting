"""Real-data experiments with grouped holdouts and matched comparisons."""
import hashlib
import json
import time
from functools import lru_cache
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeRegressor

from backend.datasets import load

MODEL_NAMES = {'ridge': '岭回归', 'tree': '决策树', 'forest': '随机森林', 'mean': '均值基线'}


class BenchParameters(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    dataset: Literal['wine', 'auto', 'concrete'] = 'concrete'
    model: Literal['ridge', 'tree', 'forest'] = 'tree'
    fraction: float = Field(default=0.5, ge=0.1, le=1)
    depth: int = Field(default=5, ge=1, le=15)
    alpha: float = Field(default=1, ge=0.000001, le=1000)
    seed: int = Field(default=42, ge=0, le=999999)


def partition(params: BenchParameters):
    x, y, groups, metadata = load(params.dataset)
    unique = np.unique(groups)
    rng = np.random.default_rng(params.seed)
    shuffled = rng.permutation(unique)
    n_test = max(1, round(len(unique)*0.2))
    n_validation = max(1, round(len(unique)*0.2))
    test_groups, val_groups, train_groups = shuffled[:n_test], shuffled[n_test:n_test+n_validation], shuffled[n_test+n_validation:]
    train = np.concatenate([np.flatnonzero(groups == group) for group in train_groups])
    validation = np.flatnonzero(np.isin(groups, val_groups))
    test = np.flatnonzero(np.isin(groups, test_groups))
    count = max(12, int(len(train)*params.fraction))
    return x, y, train[:count], validation, test, metadata, train


def model_for(params: BenchParameters, name=None):
    name = name or params.model
    metadata = load(params.dataset)[3]
    categorical = metadata['categorical']
    numerical = [index for index in range(len(metadata['features'])) if index not in categorical]
    transformations = [('numeric', StandardScaler(), numerical)]
    if categorical:
        transformations.append(('categories', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical))
    preprocessing = ColumnTransformer(transformations)
    if name == 'ridge':
        estimator = Ridge(alpha=params.alpha, solver='svd')
    elif name == 'tree':
        estimator = DecisionTreeRegressor(max_depth=params.depth, random_state=params.seed)
    elif name == 'forest':
        estimator = RandomForestRegressor(n_estimators=60, max_depth=params.depth, random_state=params.seed, n_jobs=1)
    else:
        estimator = DummyRegressor(strategy='mean')
    return make_pipeline(preprocessing, estimator)


def metrics(actual, predicted):
    return {'rmse': float(np.sqrt(mean_squared_error(actual, predicted))), 'r2': float(r2_score(actual, predicted))}


@lru_cache(maxsize=160)
def _run(serialized):
    started = time.perf_counter()
    params = BenchParameters.model_validate_json(serialized)
    x, y, training, validation, _, metadata, pool = partition(params)
    model = model_for(params)
    model.fit(x[training], y[training])
    training_prediction = model.predict(x[training]); validation_prediction = model.predict(x[validation])
    train_metrics, validation_metrics = metrics(y[training], training_prediction), metrics(y[validation], validation_prediction)
    baseline = float(np.sqrt(mean_squared_error(y[validation], np.full(len(validation), y[training].mean()))))
    fingerprint = hashlib.sha256(json.dumps({'version': metadata['version'], 'training': training.tolist(), 'validation': validation.tolist()}, sort_keys=True).encode()).hexdigest()[:16]
    def predictions(indices, predicted, limit=None):
        selected = np.arange(len(indices)) if not limit or len(indices)<=limit else np.linspace(0, len(indices)-1, limit).astype(int)
        return [{'row': int(indices[i]), 'actual': float(y[indices[i]]), 'prediction': float(predicted[i]),
                 'residual': float(y[indices[i]]-predicted[i]), 'features': x[indices[i]].tolist()} for i in selected]
    return {'parameters': params.model_dump(), 'dataset': metadata, 'model_name': MODEL_NAMES[params.model],
            'metrics': {'train_rmse': train_metrics['rmse'], 'validation_rmse': validation_metrics['rmse'], 'validation_r2': validation_metrics['r2'],
                        'gap': validation_metrics['rmse']-train_metrics['rmse'], 'baseline_rmse': baseline},
            'training_predictions': predictions(training, training_prediction, 200),
            'validation_predictions': predictions(validation, validation_prediction),
            'fingerprint': fingerprint,
            'split': {'training': len(training), 'training_pool': len(pool), 'validation': len(validation), 'test': len(x)-len(pool)-len(validation),
                      'test_sealed': True, 'grouped_by_features': True},
            'protocol': 'Grouped 60/20/20 holdout; identical feature rows stay in one split; preprocessing fitted on training only.',
            'elapsed_ms': round((time.perf_counter()-started)*1000, 2)}


def run(params):
    return json.loads(json.dumps(_run(params.model_dump_json())))


def compare(params):
    x, y, training, validation, _, _, _ = partition(params)
    rows = []
    for name in ('mean', 'ridge', 'tree', 'forest'):
        model = model_for(params, name); model.fit(x[training], y[training])
        train = metrics(y[training], model.predict(x[training])); val = metrics(y[validation], model.predict(x[validation]))
        rows.append({'model': name, 'name': MODEL_NAMES[name], 'train_rmse': train['rmse'], 'validation_rmse': val['rmse'], 'validation_r2': val['r2']})
    return {'models': rows, 'best': min(rows, key=lambda row: row['validation_rmse'])['name'], 'fingerprint': run(params)['fingerprint'], 'test_sealed': True}


def learning(params):
    rows = []
    for fraction in (0.1, 0.25, 0.5, 0.75, 1):
        result = run(params.model_copy(update={'fraction': fraction}))
        rows.append({'fraction': fraction, 'samples': result['split']['training'], 'train_rmse': result['metrics']['train_rmse'], 'validation_rmse': result['metrics']['validation_rmse']})
    return {'points': rows, 'test_sealed': True}


def stability(params):
    rows = []
    for offset in range(3):
        seed = (params.seed+offset)%1000000
        comparison = compare(params.model_copy(update={'seed': seed}))
        rows.append({'seed': seed, 'best': comparison['best'], 'models': comparison['models']})
    summary = []
    for model in ('ridge', 'tree', 'forest'):
        values = [next(item['validation_rmse'] for item in row['models'] if item['model']==model) for row in rows]
        summary.append({'model': model, 'name': MODEL_NAMES[model], 'mean': float(np.mean(values)), 'std': float(np.std(values, ddof=1))})
    return {'runs': rows, 'summary': summary, 'ranking_agrees': len({row['best'] for row in rows})==1,
            'note': '三个配对随机划分的描述性复核；均值±样本标准差，不是置信区间。', 'test_sealed': True}


def final(params):
    x, y, training, _, test, _, _ = partition(params)
    model = model_for(params); model.fit(x[training], y[training])
    return {'test_rmse': metrics(y[test], model.predict(x[test]))['rmse'], 'test_r2': float(r2_score(y[test], model.predict(x[test]))),
            'test_samples': len(test), 'fingerprint': run(params)['fingerprint'],
            'note': '查看后，本数据集的测试信息已参与探索；继续据此调参不再构成未见测试。严格终评应使用独立新数据。'}
