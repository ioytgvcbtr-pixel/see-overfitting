import pytest
import numpy as np
from backend import planet_data as data,planet_models as models,planet_engine as engine


def spec_for(dataset='iris',model='tree_c',task='classification'):
    d=data.builtin(dataset)
    values={'C':'1','gamma':'.1','alpha':'.1','max_iter':'300','max_depth':'4','min_samples_leaf':'2','n_estimators':'20',
            'n_neighbors':'5','weights':'uniform','fit_intercept':True,'var_smoothing':'1e-9','l1_ratio':'.5','learning_rate':'.1','epsilon':'.1'}
    params={f['key']:values[f['key']] for f in models.MODELS[model]['parameters']}
    return engine.Spec(dataset=dataset,features=[f['id'] for f in d['features']],targets=[t['id'] for t in d['targets']],task=task,
        cleaning=dict(numeric='median',categorical='missing',scale='standard',deduplicate=False),
        split=dict(train=60,validation=20,test=20,strategy='stratified' if task=='classification' else 'time' if dataset=='bike' else 'random'),
        seed=42,model=model,parameters=params,decision=dict(positive_class=d['targets'][0].get('classes',[None])[-1]),session_id='a'*32)


@pytest.mark.parametrize('model',list(models.MODELS))
def test_registered_models_fit_real_numeric_results(model):
    m=models.MODELS[model];dataset='bike' if model=='poisson' else 'iris' if m['task']=='classification' else 'concrete'
    d=data.builtin(dataset);s=spec_for(dataset,model,m['task']);sp=engine.split_rows(d,s)
    result,artifact=engine.fit_payload({'dataset':d,'spec':s.model_dump(),'split':engine.safe_json(sp)})
    assert np.isfinite(result['validation_error']) and result['test_sealed']
    assert not any(k.startswith('test_') for k in result['validation_metrics'])
    assert artifact['preprocessor'].n_features_in_==len(s.features)
    assert result['cleaning']['actual_training']>0
    from backend.planet_analysis import inspect
    inspection=inspect(artifact)
    key={'linear':'coefficients','neighbors':'neighbors','boundary':'kernel','tree':'tree','forest':'trees','gaussian':'gaussian','boosting':'stages'}[m['mechanism']]
    assert inspection['mechanism']==model and inspection[key]
    assert inspection['prediction']==pytest.approx(result['validation'][0]['prediction'])
    if key=='kernel':
        assert inspection['kernel']['total_support']==len(artifact['model'].support_)
        assert all(p['similarity']==pytest.approx(np.exp(-inspection['kernel']['gamma']*p['distance']**2)) for p in inspection['kernel']['points'])


@pytest.mark.parametrize('dataset,model,task',[('energy','ridge','regression'),('labels','logistic','classification'),('penguins','forest_c','classification'),('auto_raw','ridge','regression')])
def test_missing_categorical_multioutput_and_multilabel(dataset,model,task):
    d=data.builtin(dataset);s=spec_for(dataset,model,task);sp=engine.split_rows(d,s)
    result,a=engine.fit_payload({'dataset':d,'spec':s.model_dump(),'split':engine.safe_json(sp)})
    assert len(result['targets'])==len(d['targets'])
    assert all(len(p['prediction'])==len(d['targets']) for p in result['validation'])
    train=set(sp['roles']['training']);val=set(sp['roles']['validation']);test=set(sp['roles']['test'])
    assert not (train&val or train&test or val&test)
    if dataset=='auto_raw':assert any(f['missing'] for f in d['features'])


def test_blank_fields_and_subset_only_fitting():
    with pytest.raises(ValueError,match='填写'):models.parse_parameters('ridge',{'alpha':'','fit_intercept':True},50)
    d=data.builtin('auto_raw');s=spec_for('auto_raw','ridge','regression');s.training_fraction=.25
    sp=engine.split_rows(d,s);r,a=engine.fit_payload({'dataset':d,'spec':s.model_dump(),'split':engine.safe_json(sp)})
    assert r['cleaning']['actual_training']<len(sp['roles']['training'])
    numeric=[i for i,k in enumerate(r['cleaning']['feature_kinds']) if k=='numeric']
    expected=np.nanmedian(np.asarray(a['X'][a['training']][:,numeric],float),axis=0)
    assert np.allclose(r['cleaning']['learned']['numeric_fill'],expected)


def test_group_anchor_and_ratio_validation():
    d=data.builtin('wine');s=spec_for('wine','tree_r','regression');sp=engine.split_rows(d,s)
    s.seed=314
    second=engine.split_rows(d,s,sp['anchor'])
    assert second['anchor']['test_entities']==sp['anchor']['test_entities']
    s.split.test=30;s.split.train=50
    with pytest.raises(ValueError,match='测试比例'):engine.split_rows(d,s,sp['anchor'])


def test_model_parameter_change_preserves_both_validation_and_test():
    d=data.builtin('iris');s=spec_for();first=engine.split_rows(d,s)
    s.parameters['max_depth']='8';second=engine.split_rows(d,s,first['anchor'])
    assert second['roles']==first['roles']
    assert second['signature']==first['signature']
