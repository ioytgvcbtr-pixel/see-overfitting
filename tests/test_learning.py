import json
import pytest
from fastapi.testclient import TestClient

from backend import main
from backend.experiments import Parameters, run
from backend.learning import lesson


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'learning.sqlite')
    with TestClient(main.app) as value:
        yield value


def begin(client, params=None):
    params = params or Parameters()
    response = client.post('/learning/attempts', json={'parameters': params.model_dump(), 'choice': 1,
        'confidence': 2, 'reason': '开发验收：中等复杂度可能更适合验证数据。'})
    assert response.status_code == 200
    return response.json()


def finish_observation(client, attempt, params):
    control, values = lesson(params)
    for value in values:
        selected = params.model_copy(update={control: value})
        response = client.post(f"/learning/attempts/{attempt['id']}/observe", json=selected.model_dump())
        assert response.status_code == 200
        body = response.json()
        assert body['result']['metrics'] == run(selected)['metrics']
        attempt = body['attempt']
    return attempt


def test_prediction_does_not_reveal_results_or_transfer_answer(client):
    attempt = begin(client)
    assert attempt['observations'] == [] and attempt['task'] is None
    assert 'prediction_review' not in attempt
    assert '_answer' not in json.dumps(attempt)
    early = client.post(f"/learning/attempts/{attempt['id']}/transfer", json={'task_id': 'none', 'choice': 0, 'reason': 0})
    assert early.status_code == 409
    assert client.post('/learning/attempts', json={'parameters': {}, 'choice': 3}).status_code == 422


@pytest.mark.parametrize('scene', ['complexity', 'samples', 'regularization'])
def test_fresh_transfer_is_graded_from_actual_validation_data(client, scene):
    params = Parameters(scene=scene)
    attempt = finish_observation(client, begin(client, params), params)
    task = attempt['task']
    assert attempt['stage'] == 'transfer'
    assert task['seed'] != params.seed
    assert '_answer' not in json.dumps(task)
    assert 'correct_choice' not in json.dumps(attempt)
    for row in task['rows']:
        actual = run(Parameters.model_validate(row['parameters']))
        assert row['metrics']['validation_mse'] == float(f"{actual['metrics']['validation_mse']:.6g}")
        assert 'test_mse' not in actual['metrics']
    values = [row['metrics']['validation_mse'] for row in task['rows']]
    choice = 2 if values[0] == values[1] else values.index(min(values))
    result = client.post(f"/learning/attempts/{attempt['id']}/transfer", json={'task_id': task['id'], 'choice': choice, 'reason': 0}).json()
    assert result['stage'] == 'complete'
    assert result['transfer_attempts'][0]['passed'] is True
    restored = client.get(f"/learning/attempts/{attempt['id']}").json()
    assert restored == result


def test_changed_fixed_conditions_cannot_reuse_prediction(client):
    params = Parameters()
    attempt = begin(client, params)
    invalid = client.post(f"/learning/attempts/{attempt['id']}/observe", json=params.model_copy(update={'noise': .3}).model_dump())
    assert invalid.status_code == 409
    restored = client.get(f"/learning/attempts/{attempt['id']}").json()
    assert restored['observations'] == [] and restored['prediction'] == attempt['prediction']


def test_failure_is_preserved_and_retry_uses_another_task(client):
    attempt = finish_observation(client, begin(client), Parameters())
    task = attempt['task']
    url = f"/learning/attempts/{attempt['id']}"
    failed = client.post(url + '/transfer', json={'task_id': task['id'], 'choice': 0, 'reason': 2}).json()
    assert failed['stage'] == 'transfer' and failed['transfer_attempts'][0]['passed'] is False
    repeated = client.post(url + '/transfer', json={'task_id': task['id'], 'choice': 1, 'reason': 0}).json()
    assert repeated['transfer_attempts'] == failed['transfer_attempts']
    retried = client.post(url + '/retry', json={}).json()
    assert retried['task']['id'] != task['id'] and retried['task']['seed'] != task['seed']
    assert retried['transfer_attempts'][0] == failed['transfer_attempts'][0]
    assert '_answer' not in json.dumps(retried)


def test_report_uses_saved_learning_evidence_and_rejects_mixed_context(client):
    params = Parameters()
    attempt = finish_observation(client, begin(client), params)
    response = client.post('/reports', json={'parameters': params.model_dump(), 'learning_attempt_id': attempt['id']}).json()
    report = client.get(response['json_url']).json()
    assert report['learning_attempt'] == attempt and report['final_evaluation'] is None
    assert '_answer' not in json.dumps(report)
    assert client.post('/reports', json={'parameters': params.model_copy(update={'noise': .3}).model_dump(), 'learning_attempt_id': attempt['id']}).status_code == 409
