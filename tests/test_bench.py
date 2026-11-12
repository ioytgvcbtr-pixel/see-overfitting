import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.bench import BenchParameters, compare, final, learning, model_for, partition, run, stability
from backend.datasets import catalog, load
from backend import coach as coach_service
from backend.main import app


@pytest.mark.parametrize('dataset', ['wine', 'auto', 'concrete'])
def test_snapshot_grouped_holdout_and_stable_validation(dataset):
    params = BenchParameters(dataset=dataset)
    x, y, train, validation, test, metadata, pool = partition(params)
    groups = load(dataset)[2]
    assert not set(groups[train]) & set(groups[validation])
    assert not set(groups[train]) & set(groups[test])
    assert not set(groups[validation]) & set(groups[test])
    other = partition(params.model_copy(update={'fraction': 1.0, 'model': 'ridge'}))
    np.testing.assert_array_equal(validation, other[3])
    np.testing.assert_array_equal(test, other[4])
    assert metadata['license'] == 'CC BY 4.0'
    assert len(y) == metadata['rows']
    result = run(params)
    assert np.isfinite(result['metrics']['validation_rmse'])
    assert 'test_rmse' not in result['metrics']


def test_matched_comparison_and_learning_curve():
    p = BenchParameters(dataset='auto')
    comparison = compare(p)
    assert len(comparison['models']) == 4
    assert comparison['fingerprint'] == run(p)['fingerprint']
    curve = learning(p)
    assert [point['samples'] for point in curve['points']] == sorted(point['samples'] for point in curve['points'])
    assert curve['test_sealed']
    repeated = stability(p)
    assert len(repeated['runs']) == 3
    for summary in repeated['summary']:
        values = [next(m['validation_rmse'] for m in row['models'] if m['model']==summary['model']) for row in repeated['runs']]
        assert summary['std'] == pytest.approx(np.std(values, ddof=1))


def test_real_data_preprocessing_uses_training_only():
    p = BenchParameters(dataset='auto', model='ridge')
    x,y,train,*_ = partition(p)
    model = model_for(p); model.fit(x[train], y[train])
    numeric = [0,1,2,3,4,5]
    np.testing.assert_allclose(model.steps[0][1].named_transformers_['numeric'].mean_, x[train][:,numeric].mean(axis=0))
    assert final(p)['test_samples'] > 0


def test_dataset_routes_and_input_validation():
    with TestClient(app) as client:
        assert len(client.get('/datasets').json()) == 3
        assert client.post('/bench/run', json={'dataset':'unknown'}).status_code == 422
        assert client.post('/bench/run', json={'depth':500}).status_code == 422
        assert client.post('/bench/run', json={}).json()['split']['test_sealed'] is True


def test_thinking_request_uses_xhigh_and_keeps_reasoning_private(monkeypatch):
    import httpx
    captured = {}
    class Provider:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            captured.update(kwargs['json'])
            return httpx.Response(200, json={'model':'deepseek-flash','choices':[{'message':{'content':'实际指标说明','reasoning_content':'private reasoning'}}]})
    monkeypatch.setenv('AI_API_KEY','test-fixture')
    monkeypatch.setenv('AI_REASONING_EFFORT','xhigh')
    monkeypatch.setattr(coach_service.httpx, 'AsyncClient', Provider)
    with TestClient(app) as client:
        response = client.post('/coach',json={'parameters':{}}).json()
    assert captured['reasoning_effort'] == 'xhigh'
    assert captured['thinking']['type'] == 'enabled'
    assert response['provider_effort'] == 'high'
    assert 'private reasoning' not in str(response)
