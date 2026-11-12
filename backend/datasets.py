"""Versioned, attributed numeric snapshots of three UCI regression datasets."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

DIRECTORY = Path(__file__).resolve().parents[1] / 'data' / 'public'
LABELS = {
    'wine': {'title': '葡萄酒质量', 'subtitle': '理化指标能解释多少评分差异？', 'domain': '食品科学', 'target': '质量评分', 'unit': '分', 'color': 'wine',
             'features': ['固定酸度', '挥发酸度', '柠檬酸', '残糖', '氯化物', '游离二氧化硫', '总二氧化硫', '密度', 'pH', '硫酸盐', '酒精度'], 'categorical': []},
    'auto': {'title': '汽车油耗', 'subtitle': '同样的车型特征，模型如何泛化？', 'domain': '交通工程', 'target': '城市燃油经济性', 'unit': 'mpg', 'color': 'auto',
             'features': ['气缸数', '排量', '马力', '重量', '加速时间', '车型年份', '产地类别'], 'categorical': [6]},
    'concrete': {'title': '混凝土强度', 'subtitle': '材料配比与龄期中的非线性规律', 'domain': '材料科学', 'target': '抗压强度', 'unit': 'MPa', 'color': 'concrete',
                 'features': ['水泥', '矿渣', '粉煤灰', '水', '减水剂', '粗骨料', '细骨料', '龄期'], 'categorical': []},
}


@lru_cache(maxsize=3)
def load(dataset_id: str):
    if dataset_id not in LABELS:
        raise ValueError('Unknown dataset')
    manifest = json.loads((DIRECTORY / 'manifest.json').read_text(encoding='utf-8'))
    source = next(item for item in manifest if item['id'] == dataset_id)
    raw = (DIRECTORY / source['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != source['csv_sha256']:
        raise ValueError('Dataset snapshot checksum mismatch')
    matrix = np.loadtxt(DIRECTORY / source['file'], delimiter=',', skiprows=1)
    if not np.isfinite(matrix).all():
        raise ValueError('Dataset contains non-finite values')
    x, y = matrix[:, :-1], matrix[:, -1]
    _, groups = np.unique(x, axis=0, return_inverse=True)
    metadata = {**source, **LABELS[dataset_id], 'unique_feature_groups': int(groups.max()+1),
                'duplicate_feature_rows': int(len(groups)-len(np.unique(groups))),
                'target_min': float(y.min()), 'target_max': float(y.max()), 'version': source['csv_sha256'][:12]}
    return x, y, groups, metadata


def catalog():
    return [load(dataset_id)[3] for dataset_id in LABELS]
