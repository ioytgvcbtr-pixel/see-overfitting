"""Version-four supervised learning: explicit decisions, train-only fitting."""
import hashlib
import json
import math
import time
import warnings
from datetime import datetime
from pathlib import Path
from typing import Literal
import joblib
import numpy as np
from pydantic import BaseModel,ConfigDict,Field
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler,MinMaxScaler,RobustScaler,OneHotEncoder,PolynomialFeatures
from sklearn.model_selection import train_test_split
from sklearn.metrics import (mean_squared_error,mean_absolute_error,r2_score,accuracy_score,balanced_accuracy_score,
    f1_score,precision_score,recall_score,confusion_matrix,roc_curve,precision_recall_curve,roc_auc_score,hamming_loss)
from backend import planet_models as models
from backend import planet_data as data


class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)


class Cleaning(Strict):
    numeric:Literal['keep','mean','median','constant']
    constant:float|None=None
    categorical:Literal['keep','mode','missing']
    scale:Literal['none','standard','minmax','robust']
    deduplicate:bool
    drop_missing:bool=False
    outlier:Literal['none','winsor','iqr_drop']='none'
    outlier_value:float|None=None
    polynomial_degree:int=Field(default=1,ge=1,le=6)
    missing_rate:float=Field(default=0,ge=0,le=.3)


class Split(Strict):
    train:int=Field(ge=20,le=90)
    validation:int=Field(ge=5,le=40)
    test:int=Field(ge=5,le=40)
    strategy:Literal['random','stratified','time']
    keep_test:bool=True


class Decision(Strict):
    positive_class:str|None=None
    threshold:float|None=Field(default=None,ge=0,le=1)


class Spec(Strict):
    workflow_version:Literal[4]=4
    dataset:str=Field(max_length=80)
    features:list[str]=Field(min_length=1,max_length=50)
    targets:list[str]=Field(min_length=1,max_length=5)
    task:Literal['classification','regression']
    feature_types:dict[str,Literal['numeric','categorical']]=Field(default_factory=dict)
    cleaning:Cleaning
    split:Split
    seed:int=Field(ge=0,le=999999)
    model:str=Field(max_length=40)
    parameters:dict
    training_fraction:float=Field(default=1,ge=.1,le=1)
    decision:Decision=Field(default_factory=Decision)
    prediction:str=Field(default='',max_length=500)
    session_id:str=Field(pattern=r'^[0-9a-f]{32}$')
    assisted:bool=False


def hash_config(value):return data.digest(value)[:24]


def safe_json(value):
    if isinstance(value,dict):return {str(k):safe_json(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [safe_json(v) for v in value]
    if isinstance(value,np.ndarray):return safe_json(value.tolist())
    if isinstance(value,(np.integer,)):return int(value)
    if isinstance(value,(float,np.floating)):return float(value) if math.isfinite(value) else None
    return value


def labels_and_rows(d,s):
    if s.task!=d['task'] or not set(s.targets)<={t['id'] for t in d['targets']}:raise ValueError('目标与所选任务不匹配。')
    if len(s.features)!=len(set(s.features)) or not set(s.features)<={f['id'] for f in d['features']}:raise ValueError('输入特征不合法，不能包含目标、ID或泄漏列。')
    if not set(s.feature_types)<={f['id'] for f in d['features']}:raise ValueError('特征类型设置含未知列。')
    rows=[r for r in d['records'] if all(r['values'][t] is not None for t in s.targets)]
    if len(rows)<12:raise ValueError('有效目标不足12条，请检查数据或目标。')
    classes=[]
    if s.task=='classification':
        classes=[sorted({str(r['values'][t]) for r in rows}) for t in s.targets]
        if any(not 2<=len(v)<=30 for v in classes):raise ValueError('每个分类目标需要2～30个类别，请核对任务类型。')
        if len(s.targets)>1 and any(len(v)!=2 for v in classes):raise ValueError('多标签课程要求每个目标都是二值标签。')
        if len(classes)==1 and len(classes[0])==2 and s.decision.positive_class not in classes[0]:raise ValueError('请明确本次二分类的正类。')
        y=np.asarray([[classes[j].index(str(r['values'][t])) for j,t in enumerate(s.targets)] for r in rows],dtype=int)
    else:
        try:y=np.asarray([[float(r['values'][t]) for t in s.targets] for r in rows])
        except (ValueError,TypeError):raise ValueError('回归目标必须是数值。')
        if not np.isfinite(y).all():raise ValueError('回归目标含无效数值。')
    if (s.task!='classification' or len(classes)!=1 or len(classes[0])!=2) and s.decision.threshold is not None:
        raise ValueError('概率阈值探究仅适用于二分类任务。')
    return rows,y,classes


def split_rows(d,s,anchor=None):
    if s.split.train+s.split.validation+s.split.test!=100:raise ValueError('训练、验证、测试比例合计必须100%。')
    rows,y,classes=labels_and_rows(d,s)
    groups=np.asarray([r['entity'] for r in rows]);unique=np.unique(groups)
    if len(unique)<8:raise ValueError('独立样本组太少，无法形成三份可评估的数据。')
    all_ids=np.arange(len(rows));chosen=None;offset=0
    def covered(parts):
        if any(len(p)<2 for p in parts):return False
        if s.task=='classification':
            return all(all(len(np.unique(y[p,j]))==len(classes[j]) for j in range(len(classes))) for p in parts)
        return True
    if s.split.strategy=='time':
        col=d.get('time_column')
        if not col:raise ValueError('该数据没有配置时间列，请使用随机或分层划分。')
        try:ordered=sorted(all_ids,key=lambda i:datetime.fromisoformat(str(rows[i]['values'][col])))
        except (TypeError,ValueError):raise ValueError('时间列需要有效ISO日期。')
        a=round(len(rows)*s.split.train/100);b=a+round(len(rows)*s.split.validation/100)
        chosen=[np.asarray(ordered[:a]),np.asarray(ordered[a:b]),np.asarray(ordered[b:])]
        if anchor and s.split.keep_test and set(anchor['test_entities'])!=set(groups[chosen[2]]):raise ValueError('时间划分已改变测试群体，请保留原划分或明确选择自由重划分。')
    else:
        if s.split.strategy=='stratified' and s.task!='classification':raise ValueError('分层按分类标签使用；回归请选择随机或时间顺序。')
        locked=set(anchor['test_entities']) if anchor and s.split.keep_test else None
        if locked and (anchor['dataset']!=s.dataset or anchor['test_ratio']!=s.split.test):raise ValueError('保留测试模式下测试比例和数据源需保持，或主动选择自由重划分。')
        best_cost=math.inf
        for attempt in range(40 if s.split.strategy=='stratified' else 1):
            rng=np.random.default_rng(s.seed+attempt*104729)
            if locked:
                test=all_ids[np.isin(groups,list(locked))];available=np.asarray([g for g in unique if g not in locked]);available=rng.permutation(available)
                val_count=max(1,round(len(available)*s.split.validation/(100-s.split.test)))
                val_groups=available[:val_count];train_groups=available[val_count:]
            else:
                shuffled=rng.permutation(unique);nt=max(1,round(len(unique)*s.split.test/100));nv=max(1,round(len(unique)*s.split.validation/100))
                test=all_ids[np.isin(groups,shuffled[:nt])];val_groups=shuffled[nt:nt+nv];train_groups=shuffled[nt+nv:]
            parts=[all_ids[np.isin(groups,train_groups)],all_ids[np.isin(groups,val_groups)],test]
            if not covered(parts):continue
            cost=sum(abs(len(p)/len(rows)-ratio/100) for p,ratio in zip(parts,[s.split.train,s.split.validation,s.split.test]))
            if s.task=='classification':
                for p in parts:
                    for j,cls in enumerate(classes):cost+=sum(abs(np.mean(y[p,j]==c)-np.mean(y[:,j]==c)) for c in range(len(cls)))
            if cost<best_cost:chosen=parts;best_cost=cost;offset=attempt
    if chosen is None or not covered(chosen):raise ValueError('当前比例/种子下样本或类别覆盖不足，请调整比例或种子。')
    sets=[set(groups[p]) for p in chosen]
    if sets[0]&sets[1] or sets[0]&sets[2] or sets[1]&sets[2]:raise ValueError('该划分会拆开相同实体，请调整划分。')
    roles=dict(zip(('training','validation','test'),[p.tolist() for p in chosen]))
    return {'rows':rows,'y':y,'classes':classes,'roles':roles,'selection_offset':offset,
        'anchor':{'dataset':s.dataset,'test_ratio':s.split.test,'test_entities':sorted(sets[2])},
        'signature':hash_config({'source':d['version'],'targets':s.targets,'validation':[rows[i]['id'] for i in roles['validation']]})}


def raw_matrix(rows,features,kinds):
    values=[];invalid=0
    for r in rows:
        line=[]
        for f,kind in zip(features,kinds):
            v=r['values'][f]
            if kind=='numeric':
                try:n=float(v) if v is not None else np.nan
                except (TypeError,ValueError):n=np.nan;invalid+=1
                line.append(n if np.isfinite(n) else np.nan)
            else:line.append(str(v) if v is not None else np.nan)
        values.append(line)
    return np.asarray(values,dtype=object),invalid


def prepare(d,s,split):
    rows,y=split['rows'],split['y'];roles=split['roles'];c=s.cleaning
    kinds=[s.feature_types.get(f,next(m['kind'] for m in d['features'] if m['id']==f)) for f in s.features]
    X,invalid=raw_matrix(rows,s.features,kinds)
    train=np.asarray(roles['training']);rng=np.random.default_rng(s.seed+741);train=rng.permutation(train)[:max(2,int(len(train)*s.training_fraction))]
    original_size=len(train);X=X.copy()
    if c.missing_rate:
        mask=rng.random((len(train),len(s.features)))<c.missing_rate
        selected=X[train].copy();selected[mask]=np.nan;X[train]=selected
    dropped=[]
    if c.drop_missing:
        mask=np.asarray([any(isinstance(v,float) and np.isnan(v) for v in line) for line in X[train]])
        dropped.extend(train[mask].tolist());train=train[~mask]
    if c.deduplicate:
        seen=set();kept=[]
        for i in train:
            key=hash_config({'x':safe_json(X[i]),'y':safe_json(y[i])})
            if key in seen:dropped.append(int(i))
            else:seen.add(key);kept.append(i)
        train=np.asarray(kept,dtype=int)
    numeric=[i for i,k in enumerate(kinds) if k=='numeric'];categorical=[i for i,k in enumerate(kinds) if k=='categorical']
    if len(train)<4:raise ValueError('清洗后训练数据不足4条。')
    limits=None
    if c.outlier!='none' and numeric:
        if c.outlier_value is None:raise ValueError('请填写异常值处理参数。')
        values=np.asarray(X[train][:,numeric],float)
        if c.outlier=='winsor':
            if not .01<=c.outlier_value<=.1:raise ValueError('截尾比例范围为0.01～0.1。')
            low,high=np.nanquantile(values,[c.outlier_value,1-c.outlier_value],axis=0)
            # Clip features using TRAIN-only boundaries, not evaluation targets/rows.
            X[:,numeric]=np.clip(np.asarray(X[:,numeric],float),low,high);limits={'low':low,'high':high}
        else:
            if not 1<=c.outlier_value<=3:raise ValueError('IQR倍数范围为1～3。')
            q1,q3=np.nanquantile(values,[.25,.75],axis=0);low=q1-(q3-q1)*c.outlier_value;high=q3+(q3-q1)*c.outlier_value
            mask=np.any((values<low)|(values>high),axis=1);dropped.extend(train[mask].tolist());train=train[~mask];limits={'low':low,'high':high}
    if len(train)<4:raise ValueError('处理后训练样本不足，请减少删除条件。')
    if s.task=='classification' and any(len(np.unique(y[train,j]))<len(split['classes'][j]) for j in range(y.shape[1])):raise ValueError('当前训练子集/清洗丢失了类别，请增加样本或调整策略。')
    p=models.parse_parameters(s.model,s.parameters,len(train),d['id'])
    if models.MODELS[s.model]['task']!=s.task:raise ValueError('模型与分类/回归任务不匹配。')
    if s.model=='poisson' and (np.any(y<0) or not np.all(y==np.floor(y))):raise ValueError('Poisson课程需要非负整数计数目标。')
    steps=[]
    if numeric:
        n=[]
        if c.numeric in ('mean','median') and any(np.isnan(np.asarray(X[train,i],float)).all() for i in numeric):
            raise ValueError('训练子集中有全缺失数值列，请删列或明确选择常量填补。')
        if c.numeric!='keep':
            if c.numeric=='constant' and c.constant is None:raise ValueError('请填写常量填补值。')
            n.append(('impute',SimpleImputer(strategy=c.numeric,fill_value=c.constant,keep_empty_features=True)))
        elif np.isnan(np.asarray(X[:,numeric],float)).any() and (s.model not in ('tree_c','tree_r','forest_c','forest_r') or c.polynomial_degree>1):
            raise ValueError('当前模型/特征变换不能保留缺失，请选择训练内填补。')
        if c.polynomial_degree>1:
            if math.comb(len(numeric)+c.polynomial_degree,c.polynomial_degree)-1>500:raise ValueError('多项式展开超过500列，请减少特征或阶数。')
            n.append(('polynomial',PolynomialFeatures(c.polynomial_degree,include_bias=False)))
        scaler={'standard':StandardScaler,'minmax':MinMaxScaler,'robust':RobustScaler}.get(c.scale)
        if scaler:n.append(('scale',scaler()))
        steps.append(('numeric',Pipeline(n) if n else 'passthrough',numeric))
    if categorical:
        cat=[]
        if c.categorical=='mode':
            if any(all(isinstance(v,float) and np.isnan(v) for v in X[train,i]) for i in categorical):raise ValueError('训练类别列全缺失，请选择显式缺失类别。')
            cat.append(('impute',SimpleImputer(strategy='most_frequent',keep_empty_features=True)))
        elif c.categorical=='missing':cat.append(('impute',SimpleImputer(strategy='constant',fill_value='(缺失)',keep_empty_features=True)))
        cat.append(('encode',OneHotEncoder(handle_unknown='ignore',sparse_output=False)))
        steps.append(('categories',Pipeline(cat),categorical))
    pre=ColumnTransformer(steps,verbose_feature_names_out=False)
    report={'training_pool':len(roles['training']),'requested_training':original_size,'actual_training':len(train),'dropped':len(dropped),
        'numeric_parse_failures':invalid,'polluted_copy':bool(c.missing_rate),'outlier_limits':safe_json(limits),
        'training_rows':[rows[i]['id'] for i in train],'fit_scope':'仅当前实际训练子集','feature_kinds':kinds}
    return X,y,train,pre,p,report


def regression_metrics(y,p,units):
    rows=[]
    for j in range(y.shape[1]):
        rows.append({'target':units[j]['label'],'unit':units[j]['unit'],'rmse':float(np.sqrt(mean_squared_error(y[:,j],p[:,j]))),
            'mae':float(mean_absolute_error(y[:,j],p[:,j])),'r2':float(r2_score(y[:,j],p[:,j])) if len(y)>1 and np.var(y[:,j])>0 else None})
    return rows


def classifier_prediction(model,X,classes,decision):
    pred=np.asarray(model.predict(X));pred=pred[:,None] if pred.ndim==1 else pred
    score=None;kind=None;prob=None
    if len(classes)==1 and len(classes[0])==2:
        positive=classes[0].index(decision.positive_class)
        if hasattr(model,'predict_proba'):
            proba=np.asarray(model.predict_proba(X));score=proba[:,positive];kind='probability';prob=proba
            if decision.threshold is not None:pred=np.where(score>=decision.threshold,positive,1-positive)[:,None]
        elif hasattr(model,'decision_function'):
            score=np.asarray(model.decision_function(X))*(1 if positive==1 else -1);kind='decision_score'
            if decision.threshold is not None:raise ValueError('该模型提供决策分数，不能套用0～1概率阈值。')
    return pred,score,kind,prob


def classification_metrics(y,p,classes,decision,score=None,score_kind=None):
    if y.shape[1]>1:
        return {'accuracy':float(accuracy_score(y,p)),'micro_f1':float(f1_score(y,p,average='micro',zero_division=0)),
            'macro_f1':float(f1_score(y,p,average='macro',zero_division=0)),'hamming_loss':float(hamming_loss(y,p)), 'multilabel':True}
    a,b=y[:,0],p[:,0]
    result={'accuracy':float(accuracy_score(a,b)),'balanced_accuracy':float(balanced_accuracy_score(a,b)),
        'macro_f1':float(f1_score(a,b,average='macro',zero_division=0)),
        'confusion':confusion_matrix(a,b,labels=list(range(len(classes[0])))).tolist(),
        'per_class':[{'label':name,'precision':float(precision_score(a,b,labels=[i],average=None,zero_division=0)[0]),
            'recall':float(recall_score(a,b,labels=[i],average=None,zero_division=0)[0])} for i,name in enumerate(classes[0])]}
    if len(classes[0])==2:
        positive=classes[0].index(decision.positive_class)
        result.update(positive_class=decision.positive_class,precision=float(precision_score(a,b,pos_label=positive,zero_division=0)),recall=float(recall_score(a,b,pos_label=positive,zero_division=0)))
        if score is not None and len(np.unique(a))==2:
            truth=(a==positive).astype(int);fpr,tpr,_=roc_curve(truth,score);pr,re,_=precision_recall_curve(truth,score)
            result.update(auc=float(roc_auc_score(truth,score)),score_kind=score_kind,
                roc=[[float(x),float(z)] for x,z in zip(fpr,tpr)],pr=[[float(x),float(z)] for x,z in zip(re,pr)])
    return result


def evaluate(model,X,y,task,classes,decision,target_meta,training_y):
    if task=='classification':
        p,score,kind,_=classifier_prediction(model,X,classes,decision)
        m=classification_metrics(y,p,classes,decision,score,kind)
        return m,p,1-(m['micro_f1'] if m.get('multilabel') else m['accuracy'])
    p=np.asarray(model.predict(X));p=p[:,None] if p.ndim==1 else p
    m=regression_metrics(y,p,target_meta)
    std=np.std(training_y,axis=0)
    error=m[0]['rmse'] if len(m)==1 else float(np.mean(np.sqrt(np.mean((y-p)**2,axis=0))/std)) if np.all(std>0) else None
    return {'targets':m,'normalized_rmse':error if len(m)>1 and np.all(std>0) else None},p,error


def fit_payload(payload,progress=None):
    started=time.perf_counter();d=payload['dataset'];s=Spec.model_validate(payload['spec']);split=payload['split']
    split['y']=np.asarray(split['y']);notify=progress or (lambda phase:None)
    notify('正在拟合训练内处理方案')
    X,y,train,pre,p,cleaning=prepare(d,s,split)
    val=np.asarray(split['roles']['validation']);target_meta=[next(t for t in d['targets'] if t['id']==k) for k in s.targets]
    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter('always');Xt=pre.fit_transform(X[train],y[train])
        if Xt.shape[1]>500:raise ValueError('编码后的输入超过500列，请排除ID/高基数列或减少特征。')
        if not np.isfinite(np.asarray(Xt,float)).all() and s.model not in ('tree_c','tree_r','forest_c','forest_r'):raise ValueError('处理后仍含缺失，请核对填补方案。')
        model=models.build(s.model,p,s.seed,len(s.targets))
        notify('正在训练模型');fit_started=time.perf_counter();model.fit(Xt,y[train,0] if y.shape[1]==1 else y[train]);fit_ms=(time.perf_counter()-fit_started)*1000
        notify('正在评估固定验证样本')
        tv=pre.transform(X[val]);tr_metrics,tr_pred,tr_error=evaluate(model,Xt,y[train],s.task,split['classes'],s.decision,target_meta,y[train])
        metrics,pred,error=evaluate(model,tv,y[val],s.task,split['classes'],s.decision,target_meta,y[train])
    def points(ids,ys,ps,limit):
        chosen=np.linspace(0,len(ids)-1,min(len(ids),limit)).astype(int)
        return [{'row':split['rows'][int(ids[k])]['id'],'actual':safe_json(ys[k]),'prediction':safe_json(ps[k]),
            'features':[split['rows'][int(ids[k])]['values'][f] for f in s.features]} for k in chosen]
    if s.task=='classification':
        baseline=np.asarray([np.bincount(y[train,j],minlength=len(split['classes'][j])).argmax() for j in range(y.shape[1])])
        bp=np.tile(baseline,(len(val),1));bm=classification_metrics(y[val],bp,split['classes'],s.decision);be=1-(bm['micro_f1'] if bm.get('multilabel') else bm['accuracy'])
    else:
        bp=np.tile(np.mean(y[train],axis=0),(len(val),1));bm={'targets':regression_metrics(y[val],bp,target_meta)}
        std=np.std(y[train],axis=0);be=float(np.sqrt(np.mean((y[val,0]-bp[:,0])**2))) if y.shape[1]==1 else float(np.mean(np.sqrt(np.mean((y[val]-bp)**2,axis=0))/std)) if np.all(std>0) else None
    stats={}
    if 'numeric' in pre.named_transformers_:
        n=pre.named_transformers_['numeric']
        if isinstance(n,Pipeline):
            if 'impute' in n.named_steps:stats['numeric_fill']=safe_json(n.named_steps['impute'].statistics_)
            if 'scale' in n.named_steps:
                sc=n.named_steps['scale'];stats['scaler']={k:safe_json(getattr(sc,k)) for k in ('mean_','scale_','data_min_','data_max_','center_') if hasattr(sc,k)}
    if 'categories' in pre.named_transformers_:stats['categories']=safe_json(pre.named_transformers_['categories'].named_steps['encode'].categories_)
    cleaning.update(learned=stats,processed_features=int(Xt.shape[1]))
    feature_names=[str(n) for n in pre.get_feature_names_out(s.features)]
    artifact={'preprocessor':pre,'model':model,'X':X,'y':y,'training':train,'validation':val,'split':split,'spec':s.model_dump(),
        'target_meta':target_meta,'feature_names':feature_names,'parameters':p,'cleaning':cleaning}
    result={'spec':s.model_dump(),'dataset':data.public(d),'model':{k:v for k,v in models.MODELS[s.model].items() if k!='constructor'},
        'task_kind':'multilabel' if s.task=='classification' and y.shape[1]>1 else 'multiclass' if s.task=='classification' and len(split['classes'][0])>2 else 'binary' if s.task=='classification' else 'multioutput' if y.shape[1]>1 else 'regression',
        'classes':split['classes'],'targets':target_meta,'parameters':p,'effective_parameters':{k:v for k,v in (getattr(model,'estimator',model)).get_params().items() if isinstance(v,(str,int,float,bool,type(None)))},'cleaning':cleaning,'training_metrics':tr_metrics,'validation_metrics':metrics,
        'validation_error':error,'training_error':tr_error,'baseline':{'metrics':bm,'error':be},
        'training':points(train,y[train],tr_pred,200),'validation':points(val,y[val],pred,300),'validation_total':len(val),
        'split':{k:len(v) for k,v in split['roles'].items()},'evaluation_signature':split['signature'],
        'warnings':list(dict.fromkeys(str(w.message)[:300] for w in captured)), 'fit_ms':round(fit_ms,2),'elapsed_ms':round((time.perf_counter()-started)*1000,2),'test_sealed':True}
    return safe_json(result),artifact
