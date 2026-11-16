"""Model/parameter contracts shared by the classroom UI and numerical workers."""
import math
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso, ElasticNet, PoissonRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.multioutput import MultiOutputClassifier, MultiOutputRegressor

MODELS = {}


def number(key, label, low, high, integer=False, unit='', default=None):
    return dict(key=key,label=label,kind='integer' if integer else 'number',min=low,max=high,unit=unit,default=default)


def choice(key,label,options,default=None):
    return dict(key=key,label=label,kind='choice',options=[dict(value=v,label=t) for v,t in options],default=default)


def register(key, title, task, family, summary, mechanism, parameters, constructor, advanced=None):
    if key in MODELS:raise ValueError('Duplicate model registration')
    MODELS[key]=dict(id=key,title=title,task=task,family=family,summary=summary,mechanism=mechanism,
        parameters=parameters,advanced=advanced or [],constructor=constructor)


C=number('C','误分/拟合惩罚 C',.001,1000)
G=number('gamma','核影响范围 γ',.00001,100)
ALPHA=number('alpha','正则化强度 α',.000001,1000)
DEPTH=number('max_depth','最大树深',1,20,True)
LEAF=number('min_samples_leaf','叶节点最少样本',1,50,True)
TREES=number('n_estimators','树的数量',10,200,True)
K=number('n_neighbors','邻居数 K',1,51,True)
WEIGHTS=choice('weights','邻居权重',[('uniform','均匀'),('distance','距离越近权重越大')])
INTERCEPT=choice('fit_intercept','是否拟合截距',[(True,'拟合截距'),(False,'不拟合截距')])
CLASS_WEIGHT=choice('class_weight','类别权重',[(None,'按原样本权重'),('balanced','按训练类别数量平衡')],None)
METRIC=choice('metric','距离度量',[('minkowski','欧氏距离'),('manhattan','曼哈顿距离')],'minkowski')

register('logistic','逻辑回归','classification','线性判别','用线性分界预测类别，C控制约束强度。','linear',
    [C,number('max_iter','最大迭代次数',50,2000,True)],LogisticRegression,[CLASS_WEIGHT])
register('gaussian_nb','高斯朴素贝叶斯','classification','概率生成','比较训练样本按类得到的统计，理解条件独立假设。','gaussian',
    [number('var_smoothing','方差平滑',1e-12,.01)],GaussianNB)
register('knn_c','K近邻分类','classification','邻近方法','让实际邻居投票，观察局部噪声与距离。','neighbors',[K,WEIGHTS],KNeighborsClassifier,[METRIC])
register('svc','RBF SVM','classification','核方法','用C和γ改变非线性分界；决策分数不冒充概率。','boundary',[C,G],SVC,[CLASS_WEIGHT])
register('tree_c','决策树分类','classification','树模型','沿真实分裂路径判断类别，观察复杂度。','tree',[DEPTH,LEAF],DecisionTreeClassifier,
    [choice('criterion','分裂指标',[('gini','Gini'),('entropy','信息熵')],'gini')])
register('forest_c','随机森林分类','classification','集成','查看多棵真实树的投票和泛化表现。','forest',[TREES,DEPTH,LEAF],RandomForestClassifier,[CLASS_WEIGHT])
register('linear','普通线性回归','regression','线性关系','从系数、截距和残差理解预测。','linear',[INTERCEPT],LinearRegression)
register('ridge','岭回归','regression','正则化线性','观察约束、系数与验证误差的关系。','linear',[ALPHA,INTERCEPT],Ridge)
register('knn_r','K近邻回归','regression','邻近方法','用实际邻居的目标值形成局部预测。','neighbors',[K,WEIGHTS],KNeighborsRegressor,[METRIC])
register('svr','RBF SVR','regression','核方法','观察C、γ和带目标单位的ε。','boundary',[C,G,number('epsilon','不敏感带 ε',0,20)],SVR)
register('tree_r','决策树回归','regression','树模型','用分段预测理解树深与泛化。','tree',[DEPTH,LEAF],DecisionTreeRegressor)
register('forest_r','随机森林回归','regression','集成','比较单树预测与多树平均。','forest',[TREES,DEPTH,LEAF],RandomForestRegressor)
register('lasso','Lasso回归','regression','稀疏线性','让部分系数归零，观察变量选择。','linear',[ALPHA,INTERCEPT],Lasso)
register('elastic','ElasticNet回归','regression','稀疏线性','在收缩与稀疏之间选择。','linear',[ALPHA,number('l1_ratio','L1占比',0,1)],ElasticNet)
for task,ctor in [('classification',GradientBoostingClassifier),('regression',GradientBoostingRegressor)]:
    register('boost_c' if task=='classification' else 'boost_r','梯度提升分类' if task=='classification' else '梯度提升回归',task,'提升集成',
        '逐步修正前面阶段的误差；阶段曲线来自实际已训练模型。','boosting',
        [number('n_estimators','提升阶段数',10,200,True),number('learning_rate','学习率',.01,.3),number('max_depth','单树最大深度',1,5,True)],ctor)
register('poisson','Poisson计数回归','regression','计数目标','用于非负计数目标，观察正则化与偏差。','linear',
    [number('alpha','正则化强度 α',.000001,1000),number('max_iter','最大迭代次数',50,1000,True)],PoissonRegressor)


def catalog():
    return [{k:v for k,v in m.items() if k!='constructor'} for m in MODELS.values()]


def parse_parameters(model_id, raw, training_size, dataset_id=''):
    m=MODELS.get(model_id)
    if not m:raise ValueError('请选择可用模型。')
    fields={f['key']:f for f in m['parameters']+m['advanced']}
    if set(raw)-set(fields):raise ValueError('参数中包含该模型没有开放的字段。')
    result={}
    for f in m['parameters']+m['advanced']:
        core=f in m['parameters'];value=raw.get(f['key'],None if core else f['default'])
        if f['kind']=='choice':
            valid=[o['value'] for o in f['options']]
            if isinstance(value,str) and value in ('true','false','null'):
                value={'true':True,'false':False,'null':None}[value]
            if not any(type(value) is type(v) and value==v for v in valid):raise ValueError(f"请为“{f['label']}”选择一个值。")
        else:
            if value is None or isinstance(value,bool) or (isinstance(value,str) and not value.strip()):raise ValueError(f"请填写“{f['label']}”。")
            try:value=float(value)
            except (ValueError,TypeError):raise ValueError(f"“{f['label']}”需要有效数值。")
            if not math.isfinite(value) or not f['min']<=value<=f['max']:raise ValueError(f"“{f['label']}”范围为{f['min']:g}～{f['max']:g}。")
            if f['kind']=='integer':
                if not value.is_integer():raise ValueError(f"“{f['label']}”需要整数。")
                value=int(value)
        result[f['key']]=value
    if 'n_neighbors' in result and result['n_neighbors']>training_size:raise ValueError('K不能超过实际训练样本数。')
    if model_id=='svr':
        cap={'wine':3,'auto':10,'auto_raw':10}.get(dataset_id,20)
        if result['epsilon']>cap:raise ValueError(f'该任务ε的课堂范围为0～{cap}，单位与目标一致。')
    return result


def build(model_id, parameters, seed, outputs=1):
    m=MODELS[model_id];p=dict(parameters);ctor=m['constructor']
    available=ctor().get_params()
    if 'random_state' in available:p['random_state']=seed
    if 'n_jobs' in available:p['n_jobs']=1
    if model_id=='ridge':p['solver']='svd'
    if model_id in ('lasso','elastic'):p['max_iter']=5000
    if model_id in ('svc','svr'):p['max_iter']=20000
    model=ctor(**p)
    if outputs>1:
        model=MultiOutputClassifier(model,n_jobs=1) if m['task']=='classification' else MultiOutputRegressor(model,n_jobs=1)
    return model
