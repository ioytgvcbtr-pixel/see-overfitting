"""Deterministic teaching experiments with independent, stable data streams."""
import hashlib
import json
import time
from functools import lru_cache
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler


class Parameters(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    scene: Literal['complexity', 'samples', 'regularization'] = 'complexity'
    degree: int = Field(default=4, ge=1, le=15)
    samples: int = Field(default=12, ge=12, le=160)
    noise: float = Field(default=0.22, ge=0, le=0.6)
    alpha: float = Field(default=0.00000001, ge=0.00000001, le=100)
    seed: int = Field(default=42, ge=0, le=999999)


def truth(x):
    return np.cos(1.5 * np.pi * x)


def data_split(params: Parameters):
    # Independent streams: training size cannot alter evaluation samples.
    streams = np.random.SeedSequence(params.seed).spawn(3)
    output = []
    for stream, count in zip(streams, (160, 80, 120)):
        rng = np.random.default_rng(stream)
        x = rng.uniform(0, 1, count)
        eps = rng.normal(0, 1, count)
        y = truth(x) + params.noise * eps
        output.append((x, y))
    xt, yt = output[0]
    return (xt[:params.samples], yt[:params.samples]), output[1], output[2]


def fit(params: Parameters):
    train, valid, test = data_split(params)
    model = make_pipeline(
        PolynomialFeatures(params.degree, include_bias=False),
        StandardScaler(),
        Ridge(alpha=params.alpha, solver='svd'),
    )
    model.fit(train[0].reshape(-1, 1), train[1])
    return model, train, valid, test


def points(data):
    return [{'x': round(float(x), 7), 'y': round(float(y), 7)} for x, y in zip(*data)]


@lru_cache(maxsize=256)
def _run(serialized: str):
    started = time.perf_counter()
    params = Parameters.model_validate_json(serialized)
    model, train, valid, _ = fit(params)
    train_mse = float(mean_squared_error(train[1], model.predict(train[0].reshape(-1, 1))))
    valid_mse = float(mean_squared_error(valid[1], model.predict(valid[0].reshape(-1, 1))))
    x_grid = np.linspace(0, 1, 241)
    predictions = model.predict(x_grid.reshape(-1, 1))
    noise_floor = params.noise ** 2
    if valid_mse > max(train_mse * 2.8, noise_floor * 2.3, 0.025) and params.degree >= 5:
        diagnosis = {'label': '出现过拟合信号', 'tone': 'warning', 'description': '训练误差较低，验证误差明显更高。试试降低复杂度、增加样本或加强正则化。'}
    elif train_mse > max(noise_floor * 2.2, 0.09) and params.degree <= 3:
        diagnosis = {'label': '可能欠拟合', 'tone': 'warning', 'description': '模型尚未充分捕捉曲线形状。可以增加复杂度，再比较验证误差。'}
    else:
        diagnosis = {'label': '泛化表现较平衡', 'tone': 'success', 'description': '当前训练与验证表现相对接近。继续比较相邻参数，避免仅凭一次结果下结论。'}
    dataset_text = json.dumps({'train': points(train), 'validation': points(valid)}, sort_keys=True)
    result = {
        'parameters': params.model_dump(),
        'metrics': {'train_mse': train_mse, 'validation_mse': valid_mse, 'gap': valid_mse - train_mse},
        'diagnosis': diagnosis,
        'train': points(train), 'validation': points(valid),
        'curve': [{'x': round(float(x), 7), 'fit': float(y), 'truth': float(t)} for x, y, t in zip(x_grid, predictions, truth(x_grid))],
        'data_fingerprint': hashlib.sha256(dataset_text.encode()).hexdigest()[:16],
        'experiment_id': hashlib.sha256(serialized.encode()).hexdigest()[:16],
        'elapsed_ms': round((time.perf_counter() - started) * 1000, 2),
        'split': {'training': len(train[0]), 'validation': len(valid[0]), 'test': 120, 'test_sealed': True},
        'method': 'PolynomialFeatures → StandardScaler → Ridge (SVD); preprocessing fitted on training only',
    }
    return result


def run(params: Parameters):
    # Return a fresh structure to prevent mutation of the cache.
    return json.loads(json.dumps(_run(params.model_dump_json())))


def sweep(params: Parameters):
    results = []
    for degree in range(1, 16):
        result = run(params.model_copy(update={'degree': degree}))
        results.append({'degree': degree, **result['metrics']})
    best = min(results, key=lambda item: item['validation_mse'])
    return {'points': results, 'best_degree': best['degree'], 'selection_basis': 'validation_mse', 'test_sealed': True}


def final_evaluation(params: Parameters):
    model, _, _, test = fit(params)
    mse = float(mean_squared_error(test[1], model.predict(test[0].reshape(-1, 1))))
    return {'test_mse': mse, 'test_samples': len(test[0]), 'experiment_id': run(params)['experiment_id'], 'note': '独立测试用于最后一次评估。若据此继续调参，该测试集已参与选择，需要新的独立数据。'}
