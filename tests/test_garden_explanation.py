import numpy as np
import pytest
from backend import concepts


@pytest.mark.parametrize('alpha',concepts.ALPHAS)
def test_contributions_reconstruct_curve_and_validation_error(alpha):
    r=concepts.run(concepts.ConceptRequest(panel='regularization',seed=314,alpha=alpha))
    m=r['regularization']['current'];e=m['explanation']
    assert np.allclose(np.sum([t['curve'] for t in e['terms']],axis=0)+e['intercept'],m['curve'],rtol=1e-8,atol=1e-8)
    reconstructed=np.sum([t['validation'] for t in e['terms']],axis=0)+e['intercept']
    assert np.allclose(reconstructed,[p['predicted'] for p in e['residuals']],rtol=1e-8,atol=1e-8)
    assert np.mean([p['squared'] for p in e['residuals']])==pytest.approx(m['validation_mse'])
    assert all(p['error']==pytest.approx(p['observed']-p['predicted']) for p in e['residuals'])
    assert all(p['observed']==q['y'] for p,q in zip(e['residuals'],r['validation']))


def test_contributions_keep_training_only_basis_and_no_test_observations():
    a=concepts.run(concepts.ConceptRequest(panel='regularization',alpha=.01))
    b=concepts.run(concepts.ConceptRequest(panel='regularization',alpha=100))
    assert a['validation_fingerprint']==b['validation_fingerprint']
    assert a['split']['test_sealed'] and b['split']['test_sealed']
    assert 'explanation' not in a['regularization']['weak']
