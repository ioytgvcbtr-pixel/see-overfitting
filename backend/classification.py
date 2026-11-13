"""Two-feature classification with grouped holdouts and honest decision regions."""
import hashlib
import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sklearn.datasets import make_circles, make_moons
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

DIRECTORY = Path(__file__).resolve().parents[1] / 'data' / 'public' / 'classification'
SYNTHETIC = ('moons', 'circles', 'xor')
MODELS = {'logistic': '逻辑回归', 'knn': 'K近邻', 'svm': 'RBF SVM', 'tree': '决策树', 'forest': '随机森林'}
DATASETS = {
    'moons': {'title': '交错月牙', 'question': '一条直线能分开弯曲的类别吗？', 'features': ['特征 x₁', '特征 x₂'], 'classes': ['月牙A', '月牙B']},
    'circles': {'title': '同心圆', 'question': '同一邻域大小，能分清内圈和外圈吗？', 'features': ['特征 x₁', '特征 x₂'], 'classes': ['外圈', '内圈']},
    'xor': {'title': '交错象限', 'question': '为什么线性边界难以处理XOR？', 'features': ['特征 x₁', '特征 x₂'], 'classes': ['异号象限', '同号象限']},
    'iris': {'title': '鸢尾花', 'question': '只看花瓣，哪些品种仍容易混淆？', 'features': ['花瓣长（cm）', '花瓣宽（cm）'], 'classes': ['山鸢尾', '变色鸢尾', '维吉尼亚鸢尾'], 'columns': [2, 3]},
    'seeds': {'title': '小麦籽粒', 'question': '仅靠面积和沟槽长，能分清三个品种吗？', 'features': ['籽粒面积（原始单位）', '沟槽长（原始单位）'], 'classes': ['Kama', 'Rosa', 'Canadian'], 'columns': [0, 6]},
}


class PositionEdit(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    row: int = Field(ge=0, le=299)
    x: float = Field(ge=-3, le=3)
    y: float = Field(ge=-3, le=3)


class ClassificationParameters(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    dataset: Literal['moons', 'circles', 'xor', 'iris', 'seeds'] = 'moons'
    model: Literal['logistic', 'knn', 'svm', 'tree', 'forest'] = 'logistic'
    seed: Literal[42, 43, 44] = 42
    noise: float = Field(default=.15, ge=0, le=.45)
    fraction: float = Field(default=.75, ge=.25, le=1)
    neighbors: int = Field(default=7, ge=1, le=21)
    c: float = Field(default=1, ge=.01, le=100)
    gamma: float = Field(default=1, ge=.03, le=10)
    depth: int = Field(default=4, ge=1, le=12)
    edits: list[PositionEdit] = Field(default_factory=list, max_length=180)

    @model_validator(mode='after')
    def check_edits(self):
        if self.dataset not in SYNTHETIC and self.edits:
            raise ValueError('公开数据保持原样，只允许编辑合成训练点。')
        if len({edit.row for edit in self.edits}) != len(self.edits):
            raise ValueError('同一训练点只能出现一次。')
        self.edits = sorted(self.edits, key=lambda edit: edit.row)
        return self


@lru_cache(maxsize=2)
def public_data(name):
    manifest = json.loads((DIRECTORY / 'manifest.json').read_text(encoding='utf-8'))
    metadata = next(row for row in manifest if row['id'] == name)
    raw = (DIRECTORY / metadata['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != metadata['csv_sha256']:
        raise ValueError('分类数据快照校验失败。')
    data = np.loadtxt(DIRECTORY / metadata['file'], delimiter=',', skiprows=1)
    if not np.isfinite(data).all():
        raise ValueError('分类数据包含非有限数值。')
    return data[:, DATASETS[name]['columns']], data[:, -1].astype(int), metadata


def source_data(params):
    if params.dataset not in SYNTHETIC:
        return public_data(params.dataset)
    if params.dataset == 'moons':
        x, y = make_moons(n_samples=300, noise=params.noise, random_state=params.seed)
        x = (x - [.5, .25]) * 1.35
    elif params.dataset == 'circles':
        x, y = make_circles(n_samples=300, noise=params.noise, factor=.45, random_state=params.seed)
        x = x * 1.8
    else:
        rng = np.random.default_rng(params.seed)
        x = rng.uniform(-2, 2, (300, 2))
        y = (x[:, 0]*x[:, 1] >= 0).astype(int)
        x = x + rng.normal(0, params.noise, x.shape)
    return x, y, {'id': params.dataset, 'rows': 300, 'features': 2, 'source': 'https://scikit-learn.org/stable/datasets/sample_generators.html', 'license': '合成数据', 'transformation': 'Deterministic geometry; noise perturbs features, not labels.'}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:16]


def partition(params):
    x, labels, metadata = source_data(params)
    _, groups = np.unique(x, axis=0, return_inverse=True)
    folds = list(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=params.seed).split(x, labels, groups))
    test, validation = folds[0][1], folds[1][1]
    pool = np.setdiff1d(np.arange(len(x)), np.r_[test, validation])
    rng = np.random.default_rng(params.seed + 700)
    queues = [rng.permutation(pool[labels[pool] == value]).tolist() for value in np.unique(labels)]
    ordered = [queue[i] for i in range(max(map(len, queues))) for queue in queues if i < len(queue)]
    training = np.asarray(ordered[:max(24, int(len(pool)*params.fraction))], dtype=int)
    edited = x.copy()
    for edit in params.edits:
        if edit.row not in training:
            raise ValueError('只能移动当前训练集中的点；改变数据条件后请重置编辑。')
        edited[edit.row] = [edit.x, edit.y]
    return x, edited, labels, training, validation, test, pool, groups, metadata


def estimator(params, name=None):
    name = name or params.model
    if name == 'logistic': model = LogisticRegression(C=params.c, max_iter=1500, random_state=params.seed)
    elif name == 'knn': model = KNeighborsClassifier(n_neighbors=params.neighbors, weights='uniform', n_jobs=1)
    elif name == 'svm': model = SVC(C=params.c, gamma=params.gamma, kernel='rbf')
    elif name == 'tree': model = DecisionTreeClassifier(max_depth=params.depth, random_state=params.seed)
    elif name == 'forest': model = RandomForestClassifier(n_estimators=60, max_depth=params.depth, n_jobs=1, random_state=params.seed)
    else: model = DummyClassifier(strategy='most_frequent')
    return make_pipeline(StandardScaler(), model)


def scores(labels, predicted):
    return {'accuracy': float(accuracy_score(labels, predicted)), 'balanced_accuracy': float(balanced_accuracy_score(labels, predicted))}


@lru_cache(maxsize=64)
def _run(serialized):
    started = time.perf_counter()
    p = ClassificationParameters.model_validate_json(serialized)
    original, x, y, train, val, test, pool, _, metadata = partition(p)
    model = estimator(p)
    model.fit(x[train], y[train])
    training_prediction, validation_prediction = model.predict(x[train]), model.predict(x[val])
    # Plot range never reads the sealed test features and stays fixed while dragging.
    if p.dataset in SYNTHETIC: bounds = [-3., 3., -3., 3.]
    else:
        visible = original[np.r_[pool, val]]
        low, high = visible.min(axis=0), visible.max(axis=0)
        margin = np.maximum((high-low)*.08, .01)
        bounds = [float(low[0]-margin[0]), float(high[0]+margin[0]), float(low[1]-margin[1]), float(high[1]+margin[1])]
    columns, rows = 160, 120
    grid_x = bounds[0] + (np.arange(columns)+.5)/columns*(bounds[1]-bounds[0])
    grid_y = bounds[3] - (np.arange(rows)+.5)/rows*(bounds[3]-bounds[2])
    mesh = np.stack(np.meshgrid(grid_x, grid_y), axis=-1).reshape(-1, 2)
    def points(indices, predictions):
        return [{'row': int(i), 'x': float(x[i, 0]), 'y': float(x[i, 1]), 'original_x': float(original[i, 0]), 'original_y': float(original[i, 1]),
                 'label': int(y[i]), 'prediction': int(pred), 'correct': bool(y[i] == pred)} for i, pred in zip(indices, predictions)]
    train_score, val_score = scores(y[train], training_prediction), scores(y[val], validation_prediction)
    fingerprint = digest({'training_rows': train.tolist(), 'training_x': x[train].tolist(), 'training_y': y[train].tolist(), 'validation_rows': val.tolist(), 'validation_x': x[val].tolist(), 'validation_y': y[val].tolist()})
    return {'parameters': p.model_dump(), 'dataset': {**metadata, **DATASETS[p.dataset], 'synthetic': p.dataset in SYNTHETIC},
            'model_name': MODELS[p.model], 'training': points(train, training_prediction), 'validation': points(val, validation_prediction),
            'metrics': {'train_accuracy': train_score['accuracy'], 'validation_accuracy': val_score['accuracy'], 'balanced_accuracy': val_score['balanced_accuracy'],
                        'gap': train_score['accuracy']-val_score['accuracy'], 'mistakes': int(np.sum(y[val] != validation_prediction))},
            'confusion': confusion_matrix(y[val], validation_prediction, labels=np.arange(len(DATASETS[p.dataset]['classes']))).tolist(),
            'region': {'columns': columns, 'rows': rows, 'bounds': bounds, 'labels': model.predict(mesh).astype(int).tolist()},
            'fingerprint': fingerprint, 'validation_fingerprint': digest({'rows': val.tolist(), 'x': x[val].tolist(), 'y': y[val].tolist()}),
            'split': {'training': len(train), 'training_pool': len(pool), 'validation': len(val), 'test': len(test), 'test_sealed': True},
            'protocol': '按原始二维特征分层分组五折划分；两折分别为验证与封存测试，其余为训练池，实际比例近似60/20/20。编辑训练点不重分组，验证身份固定；标准化只拟合当前训练，分类图只使用标注的两个特征。',
            'elapsed_ms': round((time.perf_counter()-started)*1000, 2)}


def run(params):
    return json.loads(json.dumps(_run(params.model_dump_json())))


def compare(params):
    _, x, y, train, val, _, _, _, _ = partition(params)
    rows = []
    for name in ['majority', *MODELS]:
        model = estimator(params, name)
        model.fit(x[train], y[train])
        tr, va = scores(y[train], model.predict(x[train])), scores(y[val], model.predict(x[val]))
        rows.append({'model': name, 'name': MODELS.get(name, '多数类基线'), 'train_accuracy': tr['accuracy'], 'validation_accuracy': va['accuracy'], 'balanced_accuracy': va['balanced_accuracy']})
    best = max(row['validation_accuracy'] for row in rows)
    return {'models': rows, 'best': [row['model'] for row in rows if abs(row['validation_accuracy']-best) < 1e-12],
            'fingerprint': run(params)['fingerprint'], 'test_sealed': True,
            'note': '同一训练/验证划分、同一二维特征；各算法采用当前对应参数，未逐一调到最优；只说明本次条件。'}


router = APIRouter(prefix='/classification')


@router.post('/run')
def experiment(params: ClassificationParameters):
    try: return run(params)
    except ValueError as error: raise HTTPException(status_code=422, detail=str(error)) from error


@router.post('/compare')
def comparison(params: ClassificationParameters):
    try: return compare(params)
    except ValueError as error: raise HTTPException(status_code=422, detail=str(error)) from error
