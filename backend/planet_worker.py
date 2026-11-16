"""One cancellable CPU process per classroom job. No untrusted model upload."""
import traceback
import joblib
from backend import planet_engine as engine,planet_analysis as analysis


def work(payload,path,queue,operation='train',extra=None):
    try:
        def notify(value):queue.put(('phase',value))
        extra=extra or {}
        if operation=='train':
            result,artifact=engine.fit_payload(payload,notify)
            result['inspection']=analysis.inspect(artifact)
            joblib.dump(artifact,path)
        else:
            notify('读取当前运行的训练模型')
            a=joblib.load(path)
            if operation=='final':notify('评估保留测试样本');result=analysis.final(a)
            elif operation=='inspect':result=analysis.inspect(a,extra.get('row'),extra.get('target',0),extra.get('feature',0))
            elif operation=='surface':result=analysis.surface(a,extra.get('axes'),extra.get('target',0))
            elif operation=='learning':
                result={'points':[],'note':'每个子集重新拟合完整处理链，验证群体保持不变。'}
                for f in (.1,.25,.5,.75,1):
                    notify(f'实际拟合训练池的{f:.0%}')
                    spec=dict(payload['spec']);spec['training_fraction']=f
                    try:r,_=engine.fit_payload({**payload,'spec':spec});result['points'].append({'fraction':f,'samples':r['cleaning']['actual_training'],'training':r['training_error'],'validation':r['validation_error']})
                    except ValueError as e:result['points'].append({'fraction':f,'unavailable':str(e)})
            elif operation=='scan':
                field=extra.get('field');values=extra.get('values',[])
                if not isinstance(field,str) or not 2<=len(values)<=5:raise ValueError('参数扫描需要2～5个候选值。')
                if field not in {f['key'] for f in __import__('backend.planet_models',fromlist=['MODELS']).MODELS[a['spec']['model']]['parameters'] if f['kind']!='choice'}:raise ValueError('请选择数值型核心参数。')
                result={'field':field,'points':[],'note':'同一划分和处理方案，每个点均实际重新拟合。'}
                for value in values:
                    notify('实际拟合参数候选')
                    spec=engine.Spec.model_validate(payload['spec']);spec.parameters[field]=value
                    try:r,_=engine.fit_payload({**payload,'spec':spec.model_dump()});result['points'].append({'value':value,'training':r['training_error'],'validation':r['validation_error']})
                    except ValueError as e:result['points'].append({'value':value,'unavailable':str(e)})
            elif operation=='stability':
                values=[];used_fit=set();used_val=set()
                for i in range(3):
                    notify(f'实际复核第{i+1}个划分')
                    spec=engine.Spec.model_validate(payload['spec']);spec.seed=(spec.seed+i*101)%1000000;spec.split.keep_test=True
                    sp=engine.split_rows(payload['dataset'],spec,payload['split']['anchor'])
                    try:
                        r,_=engine.fit_payload({'dataset':payload['dataset'],'spec':spec.model_dump(),'split':engine.safe_json(sp)})
                        values.append({'seed':spec.seed,'training':r['training_error'],'validation':r['validation_error']})
                        used_fit.update(sp['roles']['training']);used_val.update(sp['roles']['validation'])
                    except ValueError as e:values.append({'seed':spec.seed,'unavailable':str(e)})
                observed=[v['validation'] for v in values if v.get('validation') is not None]
                np=__import__('numpy');result={'points':values,'mean':float(np.mean(observed)) if observed else None,'std':float(np.std(observed,ddof=1)) if len(observed)>1 else None,
                    '_fit':list(used_fit),'_validation':list(used_val),'note':'固定测试角色，三个训练/验证划分的描述性均值和样本标准差，不是置信区间。'}
            elif operation=='decision':
                s=engine.Spec.model_validate(payload['spec']);a['spec']=s.model_dump()
                ids=a['validation'];metrics,p,error=engine.evaluate(a['model'],analysis.transform(a,a['X'][ids]),a['y'][ids],s.task,a['split']['classes'],s.decision,a['target_meta'],a['y'][a['training']])
                tr_metrics,tr_pred,tr_error=engine.evaluate(a['model'],analysis.transform(a,a['X'][a['training']]),a['y'][a['training']],s.task,a['split']['classes'],s.decision,a['target_meta'],a['y'][a['training']])
                result=payload['base_result'];result.update(spec=s.model_dump(),validation_metrics=metrics,validation_error=error,training_metrics=tr_metrics,training_error=tr_error,
                    decision_note='只重算决策规则，模型未重新拟合。')
                for key,indices,predicted in [('validation',a['validation'],p),('training',a['training'],tr_pred)]:
                    mapping={a['split']['rows'][int(i)]['id']:predicted[j].tolist() for j,i in enumerate(indices)}
                    for point in result[key]:point['prediction']=mapping[point['row']]
                result['inspection']=analysis.inspect(a)
                joblib.dump(a,extra['_destination'])
            elif operation=='challenge':
                before=engine.Spec.model_validate(extra['before']);after=engine.Spec.model_validate(extra['after'])
                sp=engine.split_rows(payload['dataset'],before)
                notify('在新条件下实际拟合A')
                first,_=engine.fit_payload({'dataset':payload['dataset'],'spec':before.model_dump(),'split':engine.safe_json(sp)})
                notify('保持同一验证样本实际拟合B')
                last,_=engine.fit_payload({'dataset':payload['dataset'],'spec':after.model_dump(),'split':engine.safe_json(sp)})
                result={'before':first['validation_error'],'after':last['validation_error'],'before_training':first['training_error'],
                    'after_training':last['training_error'],'signature':first['evaluation_signature'],'seed':before.seed}
            else:raise ValueError('未知运行操作。')
        queue.put(('result',engine.safe_json(result)))
    except Exception as e:
        message=str(e) if isinstance(e,(ValueError,TypeError)) else '计算未完成，请核对数据、参数或重新训练。'
        queue.put(('error',message[:500]))
