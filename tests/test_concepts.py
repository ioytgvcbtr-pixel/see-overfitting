import json
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.concepts import ConceptRequest, PointEdit, run, training_data
from backend.experiments import Parameters, run as lesson_run
from backend.main import app


def test_residual_geometry_and_loss_grid_are_real_calculations():
    params = ConceptRequest()
    result = run(params); line = result['linear']
    residuals = np.array([row['error'] for row in line['residuals']])
    assert line['sse'] == pytest.approx(float(np.sum(residuals**2)))
    assert line['train_mse'] == pytest.approx(line['sse']/params.samples)
    x, _, y, _ = training_data(params)
    assert line['surface']['values'][0] == pytest.approx(float(np.mean((-4*x+2-y)**2)))
    optimum = line['optimum']
    assert optimum['train_mse'] <= line['train_mse']
    for contour in line['surface']['contours']:
        slope, intercept = contour['points'][0]
        assert np.mean((slope*x+intercept-y)**2) == pytest.approx(contour['mse'], abs=1e-8)


def test_point_edit_keeps_x_and_validation_fixed_and_never_reveals_test():
    original = run(ConceptRequest())
    edited = run(ConceptRequest(edits=[PointEdit(index=0,y=2)]))
    assert original['validation'] == edited['validation']
    assert original['validation_fingerprint'] == edited['validation_fingerprint']
    assert [p['x'] for p in original['train']] == [p['x'] for p in edited['train']]
    assert edited['train'][0]['y'] == 2
    assert original['data_fingerprint'] != edited['data_fingerprint']
    assert 'test_mse' not in json.dumps(edited)
    assert edited['split']['test_sealed'] is True


def test_sensitivity_uses_paired_original_and_edited_models():
    unchanged = run(ConceptRequest(panel='sensitivity'))
    assert all(pair['shift_rms'] == 0 for pair in unchanged['pairs'])
    changed = run(ConceptRequest(panel='sensitivity',edits=[PointEdit(index=0,y=2)]))
    assert changed['label_shift_rms'] > 0
    for pair in changed['pairs']:
        delta = np.array(pair['edited']['curve'])-pair['baseline']['curve']
        assert pair['shift_rms'] == pytest.approx(float(np.sqrt(np.mean(delta**2))))
        assert pair['validation_delta'] == pytest.approx(pair['edited']['validation_mse']-pair['baseline']['validation_mse'])


@pytest.mark.parametrize('degree',[1,12,15])
def test_ridge_norm_path_and_objective_use_same_standardized_basis(degree):
    result = run(ConceptRequest(panel='regularization',degree=degree,alpha=1))['regularization']
    current = result['current']
    assert current['penalty'] == pytest.approx(current['alpha']*np.sum(np.array(current['weights'])**2))
    assert current['objective'] == pytest.approx(current['sse']+current['penalty'])
    assert current['weight_norm'] <= result['weak']['weight_norm']+1e-8
    norms = [row['norm'] for row in result['path']]
    assert all(b <= a+max(1e-8,abs(a)*1e-7) for a,b in zip(norms,norms[1:]))


def test_concept_api_rejects_ambiguous_or_invalid_interventions():
    with TestClient(app) as client:
        assert client.post('/concepts/run',json={'edits':[{'index':0,'y':2},{'index':0,'y':1}]}).status_code == 422
        assert client.post('/concepts/run',json={'edits':[{'index':12,'y':2}]}).status_code == 422
        assert client.post('/concepts/run',json={'slope':99}).status_code == 422
        assert client.post('/concepts/run',json={'seed':999}).status_code == 422
        assert client.post('/concepts/run',json={'metrics':{'train_mse':0}}).status_code == 422


def test_high_order_strong_regularization_does_not_get_green_balance_hint():
    result = lesson_run(Parameters(scene='regularization',degree=15,alpha=100))
    assert result['metrics']['train_mse'] > .1 and result['metrics']['validation_mse'] > .1
    assert result['diagnosis']['tone'] == 'warning'
    assert result['diagnosis']['label'] == '训练与验证误差均偏高'
