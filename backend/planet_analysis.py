"""Honest views of a fitted estimator, using its TRAIN-only transformations."""
import math
import numpy as np
from backend import planet_engine as engine


def transform(a,X):
    X=np.asarray(X,dtype=object).copy();limits=a['cleaning'].get('outlier_limits')
    if limits and a['spec']['cleaning']['outlier']=='winsor':
        numeric=[i for i,k in enumerate(a['cleaning']['feature_kinds']) if k=='numeric']
        X[:,numeric]=np.clip(np.asarray(X[:,numeric],float),limits['low'],limits['high'])
    return a['preprocessor'].transform(X)


def first_estimator(a,target):
    m=a['model']
    return m.estimators_[target] if len(a['spec']['targets'])>1 else m


def inspect(a,row=None,target=0,feature=0):
    valid=a['validation'];rows=a['split']['rows'];index=next((i for i in valid if rows[int(i)]['id']==str(row)),int(valid[0]))
    target=max(0,min(target,a['y'].shape[1]-1));T=transform(a,a['X'][[index]]);m=first_estimator(a,target)
    pred=np.asarray(a['model'].predict(T)).reshape(-1).tolist()
    result={'row':rows[int(index)]['id'],'actual':a['y'][index].tolist(),'prediction':pred,'mechanism':a['spec']['model'],
        'features':[{'name':name,'value':float(v)} for name,v in zip(a['feature_names'],T[0])],'target':target}
    if hasattr(m,'coef_'):
        co=np.asarray(m.coef_);co=co[None,:] if co.ndim==1 else co
        inter=np.asarray(getattr(m,'intercept_',0)).reshape(-1)
        result['coefficients']=[{'name':name,'coefficient':float(w),'contribution':float(w*x)}
            for name,w,x in zip(a['feature_names'],co[0],T[0])]
        result['intercept']=float(inter[0])
        result['link']='对数链接的线性预测子' if a['spec']['model']=='poisson' else '分类决策的线性部分' if a['spec']['task']=='classification' else '贡献项加截距构成预测'
    if hasattr(m,'kneighbors'):
        distances,indices=m.kneighbors(T)
        ds=distances[0];weights=np.ones(len(ds))
        if m.weights=='distance':weights=(ds==0).astype(float) if np.any(ds==0) else 1/ds
        weights=weights/weights.sum()
        result['neighbors']=[{'row':rows[int(a['training'][j])]['id'],'distance':float(dist),'weight':float(w),'target':a['y'][a['training'][j]].tolist()}
            for j,dist,w in zip(indices[0],ds,weights)]
    tree=m if hasattr(m,'tree_') else m.estimators_[0] if a['spec']['model'].startswith('forest') else None
    if tree is not None:
        visited=set(tree.decision_path(T).indices.tolist());nodes=[];todo=[(0,0,None)]
        while todo:
            i,depth,parent=todo.pop(0);f=int(tree.tree_.feature[i]);leaf=f<0
            nodes.append({'id':i,'parent':parent,'depth':depth,'visited':i in visited,'samples':int(tree.tree_.n_node_samples[i]),
                'label':('叶节点' if leaf else a['feature_names'][f]),'threshold':None if leaf else float(tree.tree_.threshold[i]),
                'value':engine.safe_json(tree.tree_.value[i])})
            if not leaf and depth<2:todo.extend([(int(tree.tree_.children_left[i]),depth+1,i),(int(tree.tree_.children_right[i]),depth+1,i)])
        result['tree']=nodes;result['tree_note']='显示实际树的前三层；阈值位于处理后的特征空间。'
    if a['spec']['model'].startswith('forest'):
        result['trees']=[{'tree':i+1,'prediction':engine.safe_json(est.predict(T)[0])} for i,est in enumerate(m.estimators_[:5])]
    if hasattr(m,'theta_'):
        f=max(0,min(feature,len(a['feature_names'])-1));means=m.theta_[:,f];variances=m.var_[:,f]
        lo=float(np.min(means-3*np.sqrt(variances)));hi=float(np.max(means+3*np.sqrt(variances)));grid=np.linspace(lo,hi,60)
        result['gaussian']={'feature':a['feature_names'][f],'value':float(T[0,f]),'series':[
            {'class':str(c),'mean':float(mu),'variance':float(v),'points':[[float(x),float(np.exp(-.5*(x-mu)**2/max(v,1e-15))/np.sqrt(2*np.pi*max(v,1e-15)))] for x in grid]}
            for c,mu,v in zip(m.classes_,means,variances)]}
    if hasattr(m,'staged_predict'):
        valX=transform(a,a['X'][a['validation']]);ys=a['y'][a['validation'],target];points=[]
        for i,p in enumerate(m.staged_predict(valX)):
            if i%max(1,m.n_estimators//10)==0 or i==m.n_estimators-1:
                value=float(np.mean(p==ys)) if a['spec']['task']=='classification' else float(np.sqrt(np.mean((p-ys)**2)))
                points.append({'stage':i+1,'value':value})
        result['stages']={'points':points,'metric':'验证准确率' if a['spec']['task']=='classification' else '验证RMSE','note':'来自已训练集成的实际阶段输出，不是伪造实时训练轮数。'}
    if a['spec']['task']=='classification' and a['y'].shape[1]==1:
        if hasattr(m,'predict_proba'):result['probabilities']=engine.safe_json(m.predict_proba(T)[0])
        elif hasattr(m,'decision_function'):result['decision_score']=engine.safe_json(m.decision_function(T)[0])
    return engine.safe_json(result)


def surface(a,axes=None,target=0):
    s=a['spec'];kinds=a['cleaning']['feature_kinds'];numeric=[i for i,k in enumerate(kinds) if k=='numeric']
    selected=axes or numeric[:2]
    if len(selected)<2:selected=list(range(min(2,len(s['features']))))
    if len(selected)<2:return {'available':False,'note':'至少选择两个输入特征，或使用预测/残差视图。'}
    xaxis,yaxis=selected[:2]
    if min(selected)<0 or max(selected)>=len(s['features']):raise ValueError('展示坐标不在当前训练输入中。')
    defaults=[]
    for i,kind in enumerate(kinds):
        values=a['X'][a['training'],i]
        if kind=='numeric':defaults.append(float(np.nanmedian(np.asarray(values,float))))
        else:
            vals=[v for v in values if isinstance(v,str)];defaults.append(max(set(vals),key=vals.count) if vals else np.nan)
    categorical=kinds[xaxis]=='categorical' or kinds[yaxis]=='categorical'
    def domain(i):
        if kinds[i]=='categorical':return sorted({str(v) for v in a['X'][a['training'],i] if isinstance(v,str)})[:12]
        values=np.asarray(a['X'][np.r_[a['training'],a['validation']],i],float);lo,hi=np.nanmin(values),np.nanmax(values);pad=max((hi-lo)*.08,.01)
        return np.linspace(lo-pad,hi+pad,10 if categorical else 55).tolist()
    xs,ys=domain(xaxis),domain(yaxis);inputs=[]
    for vy in ys:
        for vx in xs:
            v=list(defaults);v[xaxis]=vx;v[yaxis]=vy;inputs.append(v)
    pred=np.asarray(a['model'].predict(transform(a,inputs)));pred=pred[:,None] if pred.ndim==1 else pred
    target=max(0,min(target,pred.shape[1]-1))
    points=[]
    for role,ids in [('training',a['training']),('validation',a['validation'])]:
        subset=ids[np.linspace(0,len(ids)-1,min(250,len(ids))).astype(int)]
        p=np.asarray(a['model'].predict(transform(a,a['X'][subset])));p=p[:,None] if p.ndim==1 else p
        for i,idx in enumerate(subset):
            points.append({'row':a['split']['rows'][int(idx)]['id'],'x':engine.safe_json(a['X'][idx,xaxis]),'y':engine.safe_json(a['X'][idx,yaxis]),
                'role':role,'actual':float(a['y'][idx,target]),'prediction':float(p[i,target])})
    return engine.safe_json({'available':True,'categorical':categorical,'xs':xs,'ys':ys,'values':pred[:,target], 'points':points,
        'axes':[s['features'][xaxis],s['features'][yaxis]],'conditional':len(s['features'])>2,
        'fixed':{name:engine.safe_json(v) for i,(name,v) in enumerate(zip(s['features'],defaults)) if i not in selected},
        'note':'合法类别组合的预测网格' if categorical else '条件切片：其余输入固定为训练中位数/众数' if len(s['features'])>2 else '使用这两个输入训练的真实决策/预测区域'})


def final(a):
    s=engine.Spec.model_validate(a['spec']);ids=np.asarray(a['split']['roles']['test'])
    metrics,p,error=engine.evaluate(a['model'],transform(a,a['X'][ids]),a['y'][ids],s.task,a['split']['classes'],s.decision,a['target_meta'],a['y'][a['training']])
    return engine.safe_json({'metrics':metrics,'error':error,'samples':len(ids),
        'predictions':[{'row':a['split']['rows'][int(i)]['id'],'actual':a['y'][i].tolist(),'prediction':p[j].tolist()} for j,i in enumerate(ids)]})
