import copy
import json

import pytest
from fastapi.testclient import TestClient

from backend import islands, main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'islands.sqlite')
    with TestClient(main.app) as value:
        yield value


def begin(client, panel='error', mode='discovery'):
    response = client.post('/islands/tasks', json={'panel': panel, 'mode': mode})
    assert response.status_code == 200, response.text
    return response.json()


def predict(client, task, choice=0):
    response = client.post(f"/islands/attempts/{task['id']}/predict", json={'choice': choice, 'confidence': 2, 'reason': '开发验收'})
    assert response.status_code == 200
    return response.json()


def observe(client, task):
    response = client.post(f"/islands/attempts/{task['id']}/observe", json={'parameters': task['task']['target_parameters']})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize('panel', list(islands.NAMES))
@pytest.mark.parametrize('mode', ['discovery', 'counterexample'])
def test_four_islands_keep_prediction_and_transfer_answers_sealed(client, panel, mode):
    task = begin(client, panel, mode)
    assert task['stage'] == 'predict' and task['observation'] is None
    assert task['transfer_task'] is None and task['prediction'] is None
    assert '_proof' not in json.dumps(task) and '_reason' not in task['task']
    assert 'validation_mse' not in json.dumps(task) and 'validation_accuracy' not in json.dumps(task)
    assert client.post(f"/islands/attempts/{task['id']}/observe", json={'parameters':task['task']['target_parameters']}).status_code == 409
    task = predict(client, task)
    assert task['observation'] is None
    task = observe(client, task)
    proof = islands.case(panel, mode, task['task']['seed'])['_proof']
    assert task['observation']['before'] == proof['before']
    assert task['observation']['after'] == proof['after']
    response = client.post(f"/islands/attempts/{task['id']}/transfer-task")
    assert response.status_code == 200, response.text
    task = response.json()
    transfer = task['transfer_task']
    assert transfer['seed'] != task['task']['seed']
    assert '_proof' not in json.dumps(transfer) and '_reason' not in transfer
    assert task['transfer_answer'] is None
    assert transfer['mode'] != mode
    actual = islands.case(panel, transfer['mode'], transfer['seed'])
    payload = {'task_id':transfer['id'], 'choice':actual['_proof']['choice'], 'reason':actual['_reason']}
    result = client.post(f"/islands/attempts/{task['id']}/answer", json=payload).json()
    assert result['transfer_answer']['passed'] is True
    assert result['transfer_answer']['assisted'] is False
    assert result['stage'] == 'complete'
    assert client.post(f"/islands/attempts/{task['id']}/answer", json=payload).json() == result
    assert client.get(f"/islands/attempts/{task['id']}").json() == result


def test_first_answers_are_immutable_and_parameters_must_match(client):
    task = predict(client, begin(client))
    assert client.post(f"/islands/attempts/{task['id']}/predict", json={'choice':1,'confidence':2,'reason':'开发验收'}).status_code == 409
    changed = {**task['task']['target_parameters'], 'samples':24}
    assert client.post(f"/islands/attempts/{task['id']}/observe", json={'parameters':changed}).status_code == 409
    assert client.post(f"/islands/attempts/{task['id']}/transfer-task").status_code == 409
    task = observe(client, task)
    task = client.post(f"/islands/attempts/{task['id']}/transfer-task").json()
    transfer = task['transfer_task']; actual = islands.case('error',transfer['mode'],transfer['seed'])
    wrong = {'task_id':transfer['id'], 'choice':(actual['_proof']['choice']+1)%3, 'reason':actual['_reason']}
    result = client.post(f"/islands/attempts/{task['id']}/answer", json=wrong).json()
    assert result['transfer_answer']['passed'] is False
    assert client.post(f"/islands/attempts/{task['id']}/answer", json={**wrong,'choice':actual['_proof']['choice']}).status_code == 409
    assert client.get('/islands/history').json()[0]['transfer_answer']['passed'] is False


@pytest.mark.parametrize('seed', [2026,314,2718])
def test_counterexamples_have_meaningful_numerical_conditions(seed):
    proof = islands.case('error','counterexample',seed)['_proof']
    assert proof['after_train'] < proof['before_train'] and proof['after'] > proof['before']
    proof = islands.case('regularization','counterexample',seed)['_proof']
    assert proof['after_norm'] < proof['before_norm'] and proof['after'] > proof['before']
    proof = islands.case('sensitivity','counterexample',seed)['_proof']
    assert proof['after'] > proof['before']*1.1 and proof['b_validation'] < proof['a_validation']*.95
    assert proof['choice'] == 0


@pytest.mark.parametrize('seed', [42,43,44])
def test_forest_counterexample_fixes_one_point_without_improving_all(seed):
    proof = islands.case('forest','counterexample',seed)['_proof']
    assert proof['fixed'] and proof['after'] <= proof['before']


def test_hints_remain_visible_as_assistance(client):
    task = predict(client, begin(client))
    for _ in range(3):
        task = client.post(f"/islands/attempts/{task['id']}/hint").json()
    assert task['hints_used'] == 2
    task = observe(client, task)
    task = client.post(f"/islands/attempts/{task['id']}/transfer-task").json()
    transfer = task['transfer_task']; actual = islands.case('error',transfer['mode'],transfer['seed'])
    result = client.post(f"/islands/attempts/{task['id']}/answer", json={'task_id':transfer['id'],'choice':actual['_proof']['choice'],'reason':actual['_reason']}).json()
    assert result['transfer_answer']['passed'] and result['transfer_answer']['assisted']


@pytest.mark.parametrize('panel', list(islands.NAMES))
def test_ai_actions_are_single_variable_verified_and_stale_safe(client, monkeypatch, panel):
    async def suggestion(evidence, candidates):
        return {'mode':'online','model':'test-model','notice':'','suggestion':{'candidate_id':candidates[0]['id'],'hypothesis':'开发验收：测试这次调整','expected':'higher'}}
    monkeypatch.setattr(islands.coach,'suggest',suggestion)
    task = begin(client, panel)
    raw = task['task']['target_parameters']
    request = {'panel':panel,'parameters':raw,'attempt_id':task['id']}
    assert client.post('/islands/actions/plan',json=request).status_code == 409
    task = observe(client, predict(client, task))
    response = client.post('/islands/actions/plan',json=request)
    assert response.status_code == 200, response.text
    plan = response.json()
    assert plan['mode'] == 'online' and plan['execution'] is None
    assert len([k for k in raw if raw[k] != plan['target_parameters'][k]]) == 1
    stale = copy.deepcopy(raw); stale['seed'] = 43 if panel == 'forest' else 314
    assert client.post(f"/islands/actions/{plan['id']}/execute",json={'parameters':stale}).status_code == 409
    executed = client.post(f"/islands/actions/{plan['id']}/execute",json={'parameters':raw}).json()
    proof = executed['execution']
    assert proof['test_sealed'] is True
    assert proof['before'] == islands.error_metric(panel, islands.calculate(panel, raw))
    assert proof['after'] == islands.error_metric(panel, islands.calculate(panel, plan['target_parameters']))
    assert proof['verdict'] in ('supported','not_supported')
    assert client.post(f"/islands/actions/{plan['id']}/execute",json={'parameters':raw}).json() == executed
    restored = client.get(f"/islands/attempts/{task['id']}").json()
    assert restored['ai_before_transfer'] == [plan['id']]
    client.post(f"/islands/attempts/{task['id']}/transfer-task")
    assert client.post('/islands/actions/plan',json=request).status_code == 409
    assert client.post(f"/islands/actions/{plan['id']}/execute",json={'parameters':raw}).status_code == 409


def test_invalid_ai_candidate_has_explicit_rule_mode(client, monkeypatch):
    async def invalid(*args): return {'mode':'online','model':'test-model','notice':'','suggestion':{'candidate_id':'run-code','hypothesis':'开发验收','expected':'lower'}}
    monkeypatch.setattr(islands.coach,'suggest',invalid)
    task = observe(client, predict(client, begin(client)))
    plan = client.post('/islands/actions/plan', json={'panel':'error','parameters':task['task']['target_parameters'],'attempt_id':task['id']}).json()
    assert plan['mode'] == 'rules' and plan['model'] is None and plan['notice']
    assert plan['expected'] == 'uncertain'
