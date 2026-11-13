import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.classification import (
    ClassificationParameters as P, PositionEdit, MODELS, DATASETS, _run,
    compare, estimator, partition, public_data, run,
)
from backend.main import app


@pytest.mark.parametrize('dataset', list(DATASETS))
@pytest.mark.parametrize('seed', [42, 43, 44])
def test_grouped_partitions_keep_classes_and_external_identity(dataset, seed):
    base = P(dataset=dataset, seed=seed)
    _, _, y, train, val, test, pool, groups, _ = partition(base)
    assert set(groups[pool]).isdisjoint(groups[val])
    assert set(groups[pool]).isdisjoint(groups[test])
    assert set(groups[val]).isdisjoint(groups[test])
    assert set(y[train]) == set(y[val]) == set(y[test]) == set(y)
    smaller = partition(base.model_copy(update={'fraction': .25}))
    assert np.array_equal(smaller[3], train[:len(smaller[3])])
    assert np.array_equal(smaller[4], val) and np.array_equal(smaller[5], test)


@pytest.mark.parametrize('name', list(MODELS))
def test_metrics_confusion_and_grid_are_actual_model_predictions(name):
    p = P(dataset='circles', model=name)
    result = run(p)
    _, x, y, train, val, *_ = partition(p)
    model = estimator(p)
    model.fit(x[train], y[train])
    prediction = model.predict(x[val])
    assert result['metrics']['validation_accuracy'] == pytest.approx(np.mean(prediction == y[val]))
    matrix = np.array(result['confusion'])
    assert matrix.sum() == len(val)
    assert matrix.trace()/len(val) == pytest.approx(result['metrics']['validation_accuracy'])
    grid = result['region']
    a,b,c,d = grid['bounds']
    indices = [0, 30, 990, len(grid['labels'])-1]
    xy = [[a+(i%grid['columns']+.5)/grid['columns']*(b-a), d-(i//grid['columns']+.5)/grid['rows']*(d-c)] for i in indices]
    assert model.predict(xy).tolist() == [grid['labels'][i] for i in indices]
    assert 'test_accuracy' not in json.dumps(result)
    assert result['split']['test_sealed'] is True


def test_training_drag_preserves_validation_and_rejects_other_points():
    p = P()
    before = run(p)
    edited = p.model_copy(update={'edits': [PositionEdit(row=before['training'][0]['row'], x=2, y=-2)]})
    after = run(edited)
    assert after['validation_fingerprint'] == before['validation_fingerprint']
    assert after['fingerprint'] != before['fingerprint']
    assert [(v['row'],v['x'],v['y'],v['label']) for v in after['validation']] == [(v['row'],v['x'],v['y'],v['label']) for v in before['validation']]
    assert after['training'][0]['x'] == 2 and after['training'][0]['y'] == -2
    with pytest.raises(ValueError):
        run(p.model_copy(update={'edits': [PositionEdit(row=before['validation'][0]['row'], x=0,y=0)]}))


def test_comparison_has_baseline_ties_and_same_fingerprint():
    p = P(dataset='iris')
    result = compare(p)
    assert len(result['models']) == 6
    best = max(row['validation_accuracy'] for row in result['models'])
    assert set(result['best']) == {row['model'] for row in result['models'] if abs(row['validation_accuracy']-best)<1e-12}
    assert result['fingerprint'] == run(p)['fingerprint']
    assert len({run(p.model_copy(update={'model': model}))['fingerprint'] for model in MODELS}) == 1


def test_public_snapshots_preserve_original_dimensions_and_two_feature_scope():
    for name, rows, features in [('iris',150,4), ('seeds',210,7)]:
        x, y, metadata = public_data(name)
        assert x.shape == (rows,2) and len(y) == rows
        assert metadata['features'] == features and metadata['license'] == 'CC BY 4.0'


def test_preprocessing_is_fitted_only_on_edited_training(monkeypatch):
    from sklearn.preprocessing import StandardScaler
    p = P(dataset='seeds', fraction=.25)
    _, x, _, training, *_ = partition(p)
    seen = []
    original_fit = StandardScaler.fit
    def observed(self, values, *args, **kwargs):
        seen.append(np.array(values))
        return original_fit(self, values, *args, **kwargs)
    monkeypatch.setattr(StandardScaler, 'fit', observed)
    _run.cache_clear()
    run(p)
    assert len(seen) == 1
    assert np.array_equal(seen[0], x[training])


def test_api_rejects_invalid_or_public_edits_and_supplied_metrics():
    with TestClient(app) as client:
        for body in [{'dataset':'iris','edits':[{'row':0,'x':0,'y':0}]},
                     {'neighbors':0}, {'c':0}, {'seed':-1}, {'metrics':{'accuracy':1}},
                     {'edits':[{'row':0,'x':0,'y':0},{'row':0,'x':1,'y':1}]}]:
            assert client.post('/classification/run',json=body).status_code == 422
