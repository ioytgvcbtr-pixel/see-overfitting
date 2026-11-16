"""Immutable classroom sources and strictly bounded CSV imports."""
import csv
import hashlib
import io
import json
from functools import lru_cache
from pathlib import Path
import numpy as np
from sklearn.datasets import make_multilabel_classification
from backend.datasets import LABELS

ROOT=Path(__file__).resolve().parents[1]
MISSING={'','?','na','nan','null','none','n/a'}


def canonical(value):
    s=str(value).strip()
    if s.lower() in MISSING:return None
    try:
        n=float(s)
        return float(n) if np.isfinite(n) else None
    except ValueError:return s


def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def finish(key,title,headers,rows,targets,task,source,license,kind,version,labels=None,categories=(),time_column=None,excluded=(),family=None):
    features=[h for h in headers if h not in targets and h not in excluded and h!=time_column]
    columns=[]
    for h in features:
        values=[canonical(r[headers.index(h)]) for r in rows]
        cat=h in categories or any(isinstance(v,str) for v in values if v is not None)
        columns.append({'id':h,'label':(labels or {}).get(h,h),'kind':'categorical' if cat else 'numeric',
            'missing':sum(v is None for v in values),'unique':len(set(json.dumps(v,ensure_ascii=False) for v in values if v is not None))})
    records=[]
    for i,row in enumerate(rows):
        record={h:canonical(row[j]) for j,h in enumerate(headers)}
        entity=digest({h:record[h] for h in features+([time_column] if time_column else [])})[:24]
        records.append({'id':str(i),'entity':entity,'exposure':digest(record)[:24],'values':record})
    target_meta=[{'id':t,'label':(labels or {}).get(t,t),'unit':'原始单位'} for t in targets]
    for t in target_meta:
        if task=='classification':t['classes']=sorted(set(str(r['values'][t['id']]) for r in records if r['values'][t['id']] is not None))
    return {'id':key,'title':title,'task':task,'kind':kind,'source':source,'license':license,'version':version,'family':family or key,
        'features':columns,'targets':target_meta,'records':records,'rows':len(rows),'time_column':time_column,'excluded':list(excluded),
        'duplicate_rows':len(records)-len({r['entity'] for r in records})}


@lru_cache(maxsize=20)
def builtin(key):
    original=ROOT/'data/public';extra=ROOT/'data/planet'
    if key in ('wine','auto','concrete'):
        manifest=json.loads((original/'manifest.json').read_text(encoding='utf-8'));m=next(v for v in manifest if v['id']==key)
        file=original/m['file'];raw=file.read_bytes();table=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))));h,rows=table[0],table[1:]
        meta=LABELS[key];labels=dict(zip(h[:-1],meta['features']));labels[h[-1]]=meta['target']
        d=finish(key,meta['title'],h,rows,[h[-1]],'regression',m['source'],m['license'],'公开实测',m['csv_sha256'],labels,
            categories=('origin',) if key=='auto' else (),family='uci-auto' if key=='auto' else key)
        d['targets'][0]['unit']=meta['unit']
    elif key in ('iris','seeds'):
        m=next(v for v in json.loads((original/'classification/manifest.json').read_text(encoding='utf-8')) if v['id']==key)
        raw=(original/'classification'/m['file']).read_bytes();table=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))));h,rows=table[0],table[1:]
        names=['萼片长','萼片宽','花瓣长','花瓣宽'] if key=='iris' else ['面积','周长','紧实度','籽粒长','籽粒宽','不对称系数','沟槽长']
        d=finish(key,'鸢尾花品种' if key=='iris' else '小麦籽粒品种',h,rows,[h[-1]],'classification',m['source'],m['license'],'公开实测',m['csv_sha256'],dict(zip(h,names+['品种'])))
    elif key=='labels':
        x,y=make_multilabel_classification(n_samples=360,n_features=6,n_classes=3,n_labels=2,allow_unlabeled=True,random_state=2026)
        h=[f'x{i+1}' for i in range(6)]+['标签A','标签B','标签C'];rows=np.column_stack([x,y]).tolist()
        d=finish(key,'星际样本多标签',h,rows,h[-3:],'classification','https://scikit-learn.org/stable/modules/generated/sklearn.datasets.make_multilabel_classification.html','教学生成','教学合成',digest(rows))
        return d
    else:
        m=next((v for v in json.loads((extra/'manifest.json').read_text(encoding='utf-8')) if v['id']==key),None)
        if not m:raise ValueError('数据集不存在。')
        raw=(extra/m['file']).read_bytes();table=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))));h,rows=table[0],table[1:]
        options={
            'penguins':('企鹅物种识别',['species'],'classification',('island','sex'),None,()),
            'banknote':('票据特征判别',['class'],'classification',(),None,()),
            'auto_raw':('汽车油耗·原始缺失版',['mpg'],'regression',('origin',),None,()),
            'energy':('建筑供暖与制冷',['heating','cooling'],'regression',('orientation','glazing_distribution'),None,()),
            'bike':('共享单车日需求',['cnt'],'regression',('season','yr','mnth','holiday','weekday','workingday','weathersit'),'dteday',('instant','casual','registered'))}
        title,targets,task,categories,time_column,excluded=options[key]
        labels={'species':'企鹅物种','island':'岛屿','bill_length_mm':'喙长(mm)','bill_depth_mm':'喙深(mm)','flipper_length_mm':'鳍长(mm)',
            'body_mass_g':'体重(g)','sex':'性别','year':'采集年份','class':'类别','heating':'供暖负荷','cooling':'制冷负荷','cnt':'每日租借数量',
            'variance':'小波方差','skewness':'偏度','curtosis':'峰度','entropy':'熵'}
        if key=='auto_raw':labels.update(dict(zip(h,LABELS['auto']['features']+['燃油经济性'])))
        d=finish(key,title,h,rows,targets,task,m['source'],m['license'],m['kind'],m['csv_sha256'],labels,categories,time_column,excluded,
            family='uci-auto' if key=='auto_raw' else key)
        if key=='auto_raw':d['targets'][0]['unit']='mpg'
        if key=='bike':d['targets'][0]['unit']='辆次';d['count_target']=True
    if hashlib.sha256(raw).hexdigest()!=m['csv_sha256']:raise ValueError('数据快照校验失败。')
    return d


BUILTINS=('penguins','banknote','iris','seeds','concrete','wine','auto_raw','auto','energy','bike','labels')


def public(d):return {k:v for k,v in d.items() if k!='records' and not k.startswith('_')}


def import_csv(name,text,targets,task,unit='原始单位',id_columns=(),time_column=None):
    if len(text.encode('utf-8'))>5*1024*1024:raise ValueError('CSV不能超过5MB。')
    if task not in ('classification','regression'):raise ValueError('请选择分类或回归。')
    try:dialect=csv.Sniffer().sniff(text[:8192],delimiters=',;\t')
    except csv.Error:dialect=csv.excel
    table=list(csv.reader(io.StringIO(text),dialect=dialect))
    if not table or len(table)<7:raise ValueError('至少需要表头和6条数据。')
    headers=[h.strip().lstrip('\ufeff') for h in table[0]];rows=table[1:]
    if len(headers)!=len(set(headers)) or any(not h for h in headers):raise ValueError('列名必须非空且不重复。')
    if len(rows)>5000 or len(headers)>55 or any(len(r)!=len(headers) for r in rows):raise ValueError('CSV限5000行、55列，每行列数需一致。')
    if not 1<=len(targets)<=5 or not set(targets)<=set(headers):raise ValueError('选择1～5个目标列。')
    if set(id_columns)&set(targets) or not set(id_columns)<=set(headers):raise ValueError('ID列不能同时是目标。')
    if time_column and time_column not in headers:raise ValueError('时间列不存在。')
    if len(set(headers)-set(targets)-set(id_columns)-({time_column} if time_column else set()))>50:raise ValueError('原始输入特征不能超过50。')
    version=digest({'headers':headers,'rows':rows,'targets':targets,'task':task,'unit':unit,'ids':list(id_columns),'time':time_column})
    d=finish('upload_'+version[:24],name[:80],headers,rows,targets,task,'用户本地CSV','用户提供','本地导入',version,
        time_column=time_column,excluded=id_columns,family='uploadsource_'+digest({'headers':headers,'rows':rows})[:24])
    for t in d['targets']:t['unit']=unit[:20]
    return d


def inspect(d,features=None):
    selected=features or [f['id'] for f in d['features']]
    columns=[f for f in d['features'] if f['id'] in selected]
    eligible=[r for r in d['records'] if all(r['values'][t['id']] is not None for t in d['targets'])]
    return {'dataset':public(d),'columns':columns,'eligible':len(eligible),'missing_targets':len(d['records'])-len(eligible),
        'duplicate_rows':d['duplicate_rows'],'note':'原始快照只读；目标缺失行不填造标签，单列为待预测样本。'}
