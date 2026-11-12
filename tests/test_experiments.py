import numpy as np
from fastapi.testclient import TestClient

from backend.experiments import Parameters, data_split, final_evaluation, run, sweep
from backend import main


def test_determinism_and_stable_evaluation_pool():
    p = Parameters()
    assert run(p) == run(p)
    changed = p.model_copy(update={'degree': 3, 'alpha': 1.0})
    assert run(p)['data_fingerprint'] == run(changed)['data_fingerprint']
    larger = p.model_copy(update={'samples': 80})
    for index in (1, 2):
        np.testing.assert_array_equal(data_split(p)[index][0], data_split(larger)[index][0])
        np.testing.assert_array_equal(data_split(p)[index][1], data_split(larger)[index][1])


def test_independent_splits_and_no_test_leak():
    p = Parameters()
    training, validation, test = data_split(p)
    assert not set(training[0]) & set(validation[0])
    assert not set(training[0]) & set(test[0])
    result = run(p)
    assert 'test_mse' not in result['metrics']
    assert result['split']['test_sealed'] is True
    assert final_evaluation(p)['test_mse'] >= 0


def test_sweep_chooses_validation_minimum():
    result = sweep(Parameters())
    assert len(result['points']) == 15
    assert result['best_degree'] == min(result['points'], key=lambda p: p['validation_mse'])['degree']


def test_api_validation_persistence_and_coach_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'test.sqlite')
    monkeypatch.delenv('AI_API_KEY', raising=False)
    with TestClient(main.app) as client:
        assert client.post('/experiments/run', json={'degree': 99}).status_code == 422
        assert client.post('/experiments/run', json={'alpha': -1}).status_code == 422
        params = Parameters().model_dump()
        created = client.post('/records', json={'parameters': params, 'title': '测试实验'}).json()
        saved = client.get('/records').json()
        assert saved[0]['id'] == created['id']
        assert saved[0]['result']['experiment_id'] == run(Parameters())['experiment_id']
        response = client.post('/coach', json={'parameters': params}).json()
        assert response['mode'] == 'rules'
        assert response['evidence']['metrics'] == run(Parameters())['metrics']
        assert 'AI_API_KEY' not in client.get('/health').text
