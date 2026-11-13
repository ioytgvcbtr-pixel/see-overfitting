"""Numerical evidence for direct manipulation; no learning records or test metrics."""
import hashlib
import json
import time
from functools import lru_cache
from typing import Literal

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from backend.experiments import Parameters, data_split, truth

ALPHAS = [1e-8, 1e-6, 1e-4, .01, .1, 1, 10, 100]
GRID = np.linspace(0, 1, 161)


class PointEdit(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    index: int = Field(ge=0, le=59)
    y: float = Field(ge=-3, le=3)


class ConceptRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    panel: Literal['error', 'sensitivity', 'regularization'] = 'error'
    seed: Literal[2026, 314, 2718] = 2026
    samples: int = Field(default=12, ge=12, le=60)
    noise: float = Field(default=.22, ge=0, le=.6)
    degree: int = Field(default=12, ge=1, le=15)
    alpha: float = Field(default=.000001, ge=1e-8, le=100)
    slope: float = Field(default=.5, ge=-4, le=4)
    intercept: float = Field(default=0, ge=-2, le=2)
    edits: list[PointEdit] = Field(default_factory=list, max_length=60)

    @model_validator(mode='after')
    def check_edits(self):
        indices = [edit.index for edit in self.edits]
        if len(set(indices)) != len(indices) or any(index >= self.samples for index in indices):
            raise ValueError('样本编号必须唯一，且位于当前训练样本中。')
        self.edits = sorted(self.edits, key=lambda edit: edit.index)
        return self


def training_data(params):
    source = Parameters(seed=params.seed, samples=params.samples, noise=params.noise)
    (x, y), validation, _ = data_split(source)
    original = y.copy()
    y = y.copy()
    for edit in params.edits: y[edit.index] = edit.y
    return x, original, y, validation


def mse(actual, predicted):
    return float(np.mean((actual - predicted) ** 2))


def polynomial(x, y, validation, degree, alpha):
    model = make_pipeline(PolynomialFeatures(degree, include_bias=False), StandardScaler(), Ridge(alpha=alpha, solver='svd'))
    model.fit(x[:, None], y)
    predicted = model.predict(x[:, None])
    validation_predicted = model.predict(validation[0][:, None])
    curve = model.predict(GRID[:, None])
    weights = model.named_steps['ridge'].coef_
    sse = float(np.sum((y - predicted) ** 2))
    norm_squared = float(np.dot(weights, weights))
    return {'degree': degree, 'alpha': alpha, 'train_mse': mse(y, predicted),
            'validation_mse': mse(validation[1], validation_predicted), 'curve': curve.tolist(),
            'weights': weights.tolist(), 'weight_norm': float(np.sqrt(norm_squared)),
            'sse': sse, 'penalty': float(alpha * norm_squared), 'objective': sse + alpha * norm_squared}


def linear_geometry(params, x, y, validation):
    design = np.column_stack([x, np.ones(len(x))])
    optimum = np.linalg.lstsq(design, y, rcond=None)[0]
    predicted = params.slope * x + params.intercept
    residuals = y - predicted
    a = np.linspace(-4, 4, 41)
    b = np.linspace(2, -2, 41)
    weights = np.stack(np.meshgrid(a, b), axis=-1)
    grid = np.mean((weights[:, :, 0, None] * x + weights[:, :, 1, None] - y) ** 2, axis=-1)
    minimum = mse(y, design @ optimum)
    eigenvalues, vectors = np.linalg.eigh(design.T @ design / len(x))
    angles = np.linspace(0, 2*np.pi, 121)
    unit = np.stack([np.cos(angles), np.sin(angles)])
    contours = []
    for offset in (.05, .15, .4, 1, 2, 4):
        radii = np.sqrt(offset / np.maximum(eigenvalues, 1e-12))
        points = optimum[:, None] + vectors @ (radii[:, None] * unit)
        contours.append({'mse': minimum + offset, 'points': points.T.tolist()})
    return {'slope': params.slope, 'intercept': params.intercept,
            'train_mse': mse(y, predicted), 'validation_mse': mse(validation[1], params.slope * validation[0] + params.intercept),
            'sse': float(np.sum(residuals ** 2)), 'curve': (params.slope * GRID + params.intercept).tolist(),
            'residuals': [{'predicted': float(p), 'error': float(e), 'squared': float(e*e)} for p, e in zip(predicted, residuals)],
            'optimum': {'slope': float(optimum[0]), 'intercept': float(optimum[1]), 'train_mse': minimum,
                        'in_view': bool(-4 <= optimum[0] <= 4 and -2 <= optimum[1] <= 2)},
            'surface': {'columns': 41, 'rows': 41, 'values': grid.flatten().tolist(),
                        'minimum': float(grid.min()), 'maximum': float(grid.max()), 'contours': contours}}


@lru_cache(maxsize=96)
def _run(serialized):
    started = time.perf_counter()
    params = ConceptRequest.model_validate_json(serialized)
    x, original, y, validation = training_data(params)
    data = {'x': x.tolist(), 'y': y.tolist(), 'validation_x': validation[0].tolist(), 'validation_y': validation[1].tolist()}
    result = {'parameters': params.model_dump(),
              'train': [{'x': float(a), 'y': float(b), 'original_y': float(c)} for a, b, c in zip(x, y, original)],
              'validation': [{'x': float(a), 'y': float(b)} for a, b in zip(*validation)],
              'grid_x': GRID.tolist(), 'truth': truth(GRID).tolist(),
              'y_extent': max(3., float(np.ceil(max(np.max(np.abs(original)), np.max(np.abs(validation[1]))) + .25))),
              'data_fingerprint': hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16],
              'validation_fingerprint': hashlib.sha256(json.dumps({'x':data['validation_x'], 'y':data['validation_y']}, sort_keys=True).encode()).hexdigest()[:16],
              'split': {'training': len(x), 'validation': len(validation[0]), 'test_sealed': True},
              'protocol': '探索沙盒；只编辑训练标签；验证集合固定；预处理仅拟合训练X；不计入学习轮次。'}
    if params.panel == 'error':
        result['linear'] = linear_geometry(params, x, y, validation)
    elif params.panel == 'sensitivity':
        pairs = []
        for degree in (3, params.degree):
            baseline = polynomial(x, original, validation, degree, params.alpha)
            edited = polynomial(x, y, validation, degree, params.alpha)
            difference = np.asarray(edited['curve']) - baseline['curve']
            pairs.append({'baseline': baseline, 'edited': edited, 'difference': difference.tolist(),
                          'shift_rms': float(np.sqrt(np.mean(difference**2))),
                          'validation_delta': edited['validation_mse'] - baseline['validation_mse']})
        result['pairs'] = pairs
        result['max_shift'] = max(max(abs(v) for v in pair['difference']) for pair in pairs)
        result['label_shift_rms'] = float(np.sqrt(np.mean((y-original)**2)))
    else:
        weak = polynomial(x, y, validation, params.degree, ALPHAS[0])
        current = polynomial(x, y, validation, params.degree, params.alpha)
        path = [polynomial(x, y, validation, params.degree, alpha) for alpha in ALPHAS]
        result['regularization'] = {'weak': weak, 'current': current,
            'path': [{'alpha': item['alpha'], 'norm': item['weight_norm'], 'train_mse': item['train_mse'],
                      'validation_mse': item['validation_mse']} for item in path],
            'basis': '训练X标准化后的多项式特征；截距不进入L2惩罚；不同α使用相同特征基。',
            'objective_definition': 'SSE + alpha * sum(weight**2)'}
    result['elapsed_ms'] = round((time.perf_counter()-started)*1000, 2)
    return result


def run(params):
    return json.loads(json.dumps(_run(params.model_dump_json())))


router = APIRouter(prefix='/concepts')


@router.post('/run')
def experiment(params: ConceptRequest):
    return run(params)
