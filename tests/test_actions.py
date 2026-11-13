import json
import pytest
from fastapi.testclient import TestClient

from backend import main, coach
from backend.experiments import Parameters, run
from backend.bench import BenchParameters, run as bench_run


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'actions.sqlite')
    monkeypatch.delenv('AI_API_KEY', raising=False)
    with TestClient(main.app) as value: yield value


def create(client, params=None, kind='synthetic'):
    response = client.post('/actions/plan', json={'kind': kind, 'parameters': (params or Parameters()).model_dump()})
    assert response.status_code == 200
    return response.json()


def test_unfavorable_result_is_not_reported_as_an_improvement(client, monkeypatch):
    async def suggestion(*args):
        return {'mode': 'online', 'model': 'test-model', 'notice': '', 'suggestion':
            {'candidate_id': 'degree-15', 'hypothesis': '测试假设：提高阶数是否降低验证误差。', 'expected': 'lower'}}
    monkeypatch.setattr(coach, 'suggest', suggestion)
    params = Parameters()
    plan = create(client, params)
    assert plan['mode'] == 'online' and plan['execution'] is None
    response = client.post(f"/actions/{plan['id']}/execute", json={'parameters': params.model_dump()})
    value = response.json()
    assert value['before']['metrics'] == run(params)['metrics']
    assert value['after']['metrics'] == run(params.model_copy(update={'degree': 15}))['metrics']
    assert value['verdict'] == 'not_supported' and value['delta'] > 0
    assert value['test_not_consulted'] is True
    repeated = client.post(f"/actions/{plan['id']}/execute", json={'parameters': params.model_dump()}).json()
    assert repeated == value
    assert client.get('/actions/history').json() == [value]
    report = client.post('/reports', json={'parameters': params.model_dump(), 'action_plan_ids': [plan['id']]}).json()
    assert client.get(report['json_url']).json()['verified_actions'] == [value]


@pytest.mark.parametrize('dataset', ['wine', 'auto', 'concrete'])
def test_real_data_action_changes_one_variable_and_is_recomputable(client, dataset):
    params = BenchParameters(dataset=dataset)
    plan = create(client, params, 'bench')
    assert plan['mode'] == 'rules'
    changed = [key for key in params.model_dump() if params.model_dump()[key] != plan['target_parameters'][key]]
    assert len(changed) == 1 and changed[0] in ['model', 'depth', 'alpha', 'fraction']
    result = client.post(f"/actions/{plan['id']}/execute", json={'parameters': params.model_dump()}).json()
    assert result['after']['metrics'] == bench_run(BenchParameters.model_validate(plan['target_parameters']))['metrics']
    assert result['before']['parameters']['seed'] == result['after']['parameters']['seed']
    assert 'test_rmse' not in result['after']['metrics']


def test_stale_plan_is_rejected_without_execution(client):
    params = Parameters()
    plan = create(client, params)
    response = client.post(f"/actions/{plan['id']}/execute", json={'parameters': params.model_copy(update={'seed': 43}).model_dump()})
    assert response.status_code == 409
    assert client.get('/actions/history').json() == []
    assert client.post('/actions/plan', json={'kind': 'synthetic', 'parameters': {'degree': 99}}).status_code == 422


def test_unlisted_model_action_becomes_explicit_rule_plan(client, monkeypatch):
    async def suggestion(*args):
        return {'mode': 'online', 'model': 'test-model', 'notice': '', 'suggestion':
            {'candidate_id': 'seed-999', 'hypothesis': '换一个种子来挑分数。', 'expected': 'lower'}}
    monkeypatch.setattr(coach, 'suggest', suggestion)
    value = create(client)
    assert value['mode'] == 'rules' and value['model'] is None
    assert '未通过' in value['notice']
    assert value['baseline_parameters']['seed'] == value['target_parameters']['seed']


def test_json_request_keeps_xhigh_and_bad_json_has_visible_fallback(client, monkeypatch):
    import httpx
    captured = {}
    class Provider:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, *args, **kwargs):
            captured.update(kwargs['json'])
            return httpx.Response(200, json={'choices': [{'message': {'content': ' '}}]})
    monkeypatch.setenv('AI_API_KEY', 'test-fixture')
    monkeypatch.setattr(coach.httpx, 'AsyncClient', Provider)
    value = create(client)
    assert captured['reasoning_effort'] == 'xhigh'
    assert captured['thinking']['type'] == 'enabled'
    assert captured['response_format'] == {'type': 'json_object'}
    assert value['mode'] == 'rules' and value['notice']
    assert 'test-fixture' not in json.dumps(value)
