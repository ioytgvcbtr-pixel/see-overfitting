import {api} from './experiment';

export type Value=string|number|boolean|null;
export type Field={key:string;label:string;kind:'number'|'integer'|'choice';min?:number;max?:number;unit?:string;default?:Value;options?:{value:Value;label:string}[]};
export type Model={id:string;title:string;task:'classification'|'regression';family:string;summary:string;mechanism:string;parameters:Field[];advanced:Field[]};
export type Dataset={id:string;title:string;task:'classification'|'regression';kind:string;source:string;license:string;version:string;family:string;rows:number;duplicate_rows:number;time_column:string|null;count_target?:boolean;
 features:{id:string;label:string;kind:'numeric'|'categorical';missing:number;unique:number}[];targets:{id:string;label:string;unit:string;classes?:string[]}[];excluded:string[]};
export type Catalog={brand:string;models:Model[];datasets:Dataset[];limits:{rows:number;features:number;expanded_features:number;seconds:number}};
export type Cleaning={numeric:string;constant:number|null;categorical:string;encoding?:string;scale:string;deduplicate:boolean;drop_missing:boolean;outlier:string;outlier_value:number|null;polynomial_degree:number;missing_rate:number};
export type Spec={workflow_version:4;dataset:string;features:string[];targets:string[];task:'classification'|'regression';feature_types:Record<string,'numeric'|'categorical'>;cleaning:Cleaning;
 split:{train:number;validation:number;test:number;strategy:string;keep_test:boolean};seed:number;model:string;parameters:Record<string,Value>;training_fraction:number;
 decision:{positive_class:string|null;threshold:number|null};prediction:string;session_id:string;assisted:boolean};
export type Draft={dataset:string;features:string[];targets:string[];task:Spec['task'];featureTypes:Spec['feature_types'];cleaning:{numeric:string;constant:string;categorical:string;encoding:string;scale:string;deduplicate:string;drop_missing:boolean;outlier:string;outlier_value:string;degree:string;pollution:string};
 split:{train:string;validation:string;test:string;strategy:string;keep_test:boolean};seed:string;model:string;parameters:Record<string,Value>;fraction:string;positive:string;threshold?:string;prediction:string;session:string;assisted:boolean};
export type Metric={accuracy?:number;balanced_accuracy?:number;macro_f1?:number;micro_f1?:number;hamming_loss?:number;multilabel?:boolean;precision?:number;recall?:number;auc?:number;positive_class?:string;score_kind?:string;roc?:number[][];pr?:number[][];confusion?:number[][];per_class?:{label:string;precision:number;recall:number}[];
 targets?:{target:string;unit:string;rmse:number;mae:number;r2:number|null}[];normalized_rmse?:number|null};
export type Point={row:string;actual:number[];prediction:number[];features:(string|number|null)[];residual?:number[]|null};
export type Result={spec:Spec;dataset:Dataset;model:Model;task_kind:string;classes:string[][];targets:Dataset['targets'];parameters:Record<string,Value>;effective_parameters:Record<string,Value>;
 cleaning:{training_pool:number;requested_training:number;actual_training:number;dropped:number;numeric_parse_failures:number;polluted_copy:boolean;fit_scope:string;training_rows:string[];processed_features:number;learned:Record<string,unknown>;preview?:{row:string;before:Record<string,Value>;after:Record<string,Value>}[];preview_note?:string};
 training_metrics:Metric;validation_metrics:Metric;validation_error:number|null;training_error:number|null;baseline:{metrics:Metric;error:number|null};training:Point[];validation:Point[];validation_total:number;
 split:Record<string,number>;evaluation_signature:string;warnings:string[];fit_ms:number;elapsed_ms:number;test_sealed:boolean;inspection?:Inspection;decision_note?:string};
export type Inspection={row:string;actual:number[];prediction:number[];features:{name:string;value:number}[];target:number;mechanism?:string;
 kernel?:{gamma:number;total_support:number;points:{row:string;distance:number;similarity:number}[];note:string};
 coefficients?:{name:string;coefficient:number;contribution:number}[];intercept?:number;link?:string;neighbors?:{row:string;distance:number;weight:number;target:number[]}[];
 tree?:{id:number;parent:number|null;depth:number;visited:boolean;samples:number;label:string;threshold:number|null;value:number[][]}[];tree_note?:string;trees?:{tree:number;prediction:number|number[]}[];
 gaussian?:{feature:string;value:number;series:{class:string;mean:number;variance:number;points:number[][]}[]};stages?:{points:{stage:number;value:number}[];metric:string;note:string};probabilities?:number[];decision_score?:number|number[]};
export type Surface={available:boolean;categorical?:boolean;axis_kinds?:string[];xs:(number|string)[];ys:(number|string)[];values:number[];points:{row:string;x:number|string;y:number|string;role:string;actual:number;prediction:number}[];axes:string[];conditional:boolean;fixed:Record<string,Value>;note:string};
export type Final={metrics:Metric;error:number|null;samples:number;independent:boolean;evaluated_at:string;note:string};
export type Job={id:string;state:'queued'|'running'|'completed'|'failed'|'cancelled'|'timeout'|'restored';phase:string;operation:string;spec:Spec;dataset_title:string;created_at:string;source_id?:string;error?:string;result:Result|null;final?:Final;analyses?:Record<string,unknown>;imported?:boolean};
export type AnalysisJob=Omit<Job,'result'>&{result:unknown};
export type Plan={id:string;run_id:string;hypothesis:string;expected:string;mode:'online'|'rules';model:string|null;notice:string;target_spec:Spec;change:{label:string;control:string;from_value:Value;to_value:Value};execution_id?:string;execution_state?:string;execution?:{before:number|null;after:number|null;observed:string;comparable:boolean;verdict:string}};
export type Quiz={id:string;state:string;source_id:string;plan_id?:string;question:string;choices:string[];reasons:string[];before_spec:Spec;after_spec:Spec;change:Plan['change'];assisted:boolean;blind?:boolean;
 observations?:{before:number;after:number;before_training:number;after_training:number;seed:number};decision:{choice:number;submitted_at:string}|null;answer:{reason:number;passed?:boolean;correct_choice?:number;correct_reason?:number}|null};
export type Preview={counts:Record<string,number>;classes:string[][];distributions:Record<string,number[][]>;test_previously_seen_entities:number;training_preview:{id:string;values:Record<string,Value>}[];note:string;selection_offset:number};

export function freshDraft(d:Dataset):Draft{return{dataset:d.id,features:d.features.map(f=>f.id),targets:d.targets.map(t=>t.id),task:d.task,featureTypes:{},
 cleaning:{numeric:'',constant:'',categorical:d.features.some(f=>f.kind==='categorical')?'':'keep',encoding:'onehot',scale:'',deduplicate:'',drop_missing:false,outlier:'none',outlier_value:'',degree:'1',pollution:''},
 split:{train:'',validation:'',test:'',strategy:'',keep_test:true},seed:'',model:'',parameters:{},fraction:'',positive:'',prediction:'',session:crypto.randomUUID().replaceAll('-',''),assisted:false};}

function numeric(raw:unknown,label:string,min:number,max:number,integer=false){
 if(raw===null||raw===undefined||typeof raw==='boolean'||String(raw).trim()==='')throw Error(`请填写${label}。`);
 const v=Number(raw);if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(`${label}需为${min}～${max}${integer?'的整数':'的数值'}。`);return v;
}
export function buildSpec(d:Draft,models:Model[],stage='train'):Spec{
 if(!d.features.length||!d.targets.length)throw Error('请选择输入特征和目标。');
 if(!d.cleaning.numeric||!d.cleaning.categorical||!d.cleaning.scale||!d.cleaning.deduplicate)throw Error('请完成清洗方案的四项选择。');
 const train=numeric(d.split.train,'训练比例',20,90,true),val=numeric(d.split.validation,'验证比例',5,40,true),test=numeric(d.split.test,'测试比例',5,40,true);
 if(train+val+test!==100)throw Error('三份比例合计需要100%。');if(!d.split.strategy)throw Error('请选择划分方式。');
 const s:Spec={workflow_version:4,dataset:d.dataset,features:d.features,targets:d.targets,task:d.task,feature_types:d.featureTypes,
 cleaning:{numeric:d.cleaning.numeric,constant:d.cleaning.numeric==='constant'?numeric(d.cleaning.constant,'常量填补值',-1e9,1e9):null,
 categorical:d.cleaning.categorical,encoding:d.cleaning.encoding,scale:d.cleaning.scale,deduplicate:d.cleaning.deduplicate==='remove',drop_missing:d.cleaning.drop_missing,outlier:d.cleaning.outlier,
 outlier_value:d.cleaning.outlier==='none'?null:numeric(d.cleaning.outlier_value,'异常处理参数',d.cleaning.outlier==='winsor'?.01:1,d.cleaning.outlier==='winsor'?.1:3),
 polynomial_degree:numeric(d.cleaning.degree,'多项式阶数',1,6,true),missing_rate:d.cleaning.pollution?numeric(d.cleaning.pollution,'训练缺失比例',0,.3):0},
 split:{train,validation:val,test,strategy:d.split.strategy,keep_test:d.split.keep_test},seed:numeric(d.seed,'实验种子',0,999999,true),model:d.model,parameters:{...d.parameters},training_fraction:d.fraction?numeric(d.fraction,'训练池使用比例',.1,1):1,
 decision:{positive_class:d.positive||null,threshold:d.threshold?numeric(d.threshold,'概率阈值',0,1):null},prediction:d.prediction,session_id:d.session,assisted:d.assisted};
 if(stage==='train'){
  const m=models.find(m=>m.id===d.model);if(!m)throw Error('请选择模型。');
  for(const f of m.parameters){const v=d.parameters[f.key];if(f.kind==='choice'){if(v===undefined||v==='')throw Error(`请选择${f.label}。`);}else numeric(v,f.label,f.min!,f.max!,f.kind==='integer');}
  if(!d.prediction)throw Error('训练前请留下一个预期，也可以选择“不确定”。');
 }
 return s;
}
export function fromSpec(s:Spec):Draft{return{dataset:s.dataset,features:s.features,targets:s.targets,task:s.task,featureTypes:s.feature_types,
 cleaning:{numeric:s.cleaning.numeric,constant:s.cleaning.constant===null?'':String(s.cleaning.constant),categorical:s.cleaning.categorical,encoding:s.cleaning.encoding||'onehot',scale:s.cleaning.scale,deduplicate:s.cleaning.deduplicate?'remove':'keep',drop_missing:s.cleaning.drop_missing,outlier:s.cleaning.outlier,outlier_value:s.cleaning.outlier_value===null?'':String(s.cleaning.outlier_value),degree:String(s.cleaning.polynomial_degree),pollution:s.cleaning.missing_rate?String(s.cleaning.missing_rate):''},
 split:{train:String(s.split.train),validation:String(s.split.validation),test:String(s.split.test),strategy:s.split.strategy,keep_test:s.split.keep_test},seed:String(s.seed),model:s.model,parameters:s.parameters,fraction:s.training_fraction===1?'':String(s.training_fraction),positive:s.decision.positive_class||'',threshold:s.decision.threshold===null?'':String(s.decision.threshold),prediction:s.prediction,session:s.session_id,assisted:s.assisted};}
export function example(d:Dataset,m:Model):Draft{
 const v=freshDraft(d);v.cleaning={...v.cleaning,numeric:'median',categorical:'missing',scale:'standard',deduplicate:'keep'};v.split={train:'60',validation:'20',test:'20',strategy:d.time_column?'time':d.task==='classification'?'stratified':'random',keep_test:true};v.seed='42';v.model=m.id;v.assisted=true;
 const values:Record<string,Value>={C:'1',gamma:'.1',alpha:'1',max_iter:'300',max_depth:'4',min_samples_leaf:'2',n_estimators:'60',n_neighbors:'5',weights:'uniform',fit_intercept:'true',var_smoothing:'1e-9',l1_ratio:'.5',learning_rate:'.1',epsilon:'.1'};
 v.parameters=Object.fromEntries(m.parameters.map(f=>[f.key,values[f.key]]));v.positive=d.targets.length===1&&d.targets[0].classes?.length===2?d.targets[0].classes[1]:'';return v;
}
export const fmt=(v:number|null|undefined,digits=4)=>v===null||v===undefined?'—':!Number.isFinite(v)?'不可计算':v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>9999)?v.toExponential(2):v.toFixed(digits);
export function stableKey(v:unknown):string{return Array.isArray(v)?'['+v.map(stableKey).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stableKey(x)).join(',')+'}':JSON.stringify(v);}
export async function waitJob(job:AnalysisJob,onUpdate:(v:AnalysisJob)=>void,signal?:AbortSignal):Promise<AnalysisJob>{
 let value=job;
 while(['queued','running'].includes(value.state)){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');onUpdate(value);
  await new Promise(resolve=>setTimeout(resolve,300));value=await api<AnalysisJob>('/lab/runs/'+value.id,undefined,signal);
 }
 onUpdate(value);if(value.state!=='completed')throw Error(value.error||value.phase);return value;
}
