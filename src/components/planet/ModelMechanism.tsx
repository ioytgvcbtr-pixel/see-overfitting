"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,FlaskConical,LoaderCircle} from 'lucide-react';
import {api} from '@/lib/experiment';
import {buildSpec,example,fmt,fromSpec,waitJob,type AnalysisJob,type Catalog,type Dataset,type Draft,type Inspection,type Job,type Model} from '@/lib/planet';
import {mechanismControl,mechanismQuestion} from '@/lib/model-mechanism';
import {Mechanism} from './PlanetCharts';
import {ModelGlyph,SmallGuide} from './PlanetArt';
import {FormField} from './PlanetWorkbench';

export default function ModelMechanism({model,dataset,catalog,onBack,backLabel,onPractice}:{model:Model;dataset:Dataset;catalog:Catalog;onBack:()=>void;backLabel:string;onPractice:()=>void}){
 const [draft,setDraft]=useState<Draft>(()=>{const d=example(dataset,model);d.prediction='机制示例：观察真实模型的内部结果';return d;});
 const [run,setRun]=useState<Job|null>(null),[inspection,setInspection]=useState<Inspection|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),ticket=useRef(0),activeJob=useRef<string|null>(null);
 const control=mechanismControl(model),result=run?.result,store=`modelplanet-mechanism-${model.id}-v1`;
 useEffect(()=>{let live=true;const id=++ticket.current;let saved:string|null=null;try{saved=localStorage.getItem(store);}catch{}
  if(saved&&/^[0-9a-f]{32}$/.test(saved)){setBusy('恢复该模型的示例');void api<Job>('/lab/runs/'+saved).then(r=>{if(live&&id===ticket.current&&r.result&&r.spec.model===model.id&&r.spec.dataset===dataset.id){setRun(r);setInspection(r.result.inspection||null);setDraft(fromSpec(r.result.spec));}}).catch(()=>{}).finally(()=>{if(live&&id===ticket.current)setBusy('');});}
  return()=>{live=false;ticket.current++;controller.current?.abort();if(activeJob.current)void api('/lab/runs/'+activeJob.current+'/cancel',{}).catch(()=>{});};
 },[model.id,dataset.id,store]);
 async function calculate(kind:'train'|'inspect',row?:string){
  const id=++ticket.current;controller.current?.abort();controller.current=new AbortController();setBusy('准备实际计算');setError('');
  try{const spec=buildSpec(draft,catalog.models);const first=await api<AnalysisJob>(kind==='train'?'/lab/runs':`/lab/runs/${run!.id}/analysis/inspect`,kind==='train'?{spec,source_id:run?.id}:{row},controller.current.signal);
   if(id!==ticket.current)return;activeJob.current=first.id;
   const done=await waitJob(first,v=>{if(id===ticket.current)setBusy(v.phase);},controller.current.signal);
   if(id===ticket.current){if(kind==='train'){const r=done as Job;setRun(r);setInspection(r.result?.inspection||null);try{localStorage.setItem(store,r.id);}catch{}}else setInspection(done.result as Inspection);}
  }catch(e){if(id===ticket.current&&(e as Error).name!=='AbortError')setError((e as Error).message);}
  finally{if(id===ticket.current){activeJob.current=null;setBusy('');}}
 }
 function cancel(){controller.current?.abort();if(activeJob.current)void api('/lab/runs/'+activeJob.current+'/cancel',{}).catch(()=>{});ticket.current++;activeJob.current=null;setBusy('');setError('本次计算已停止，原有结果仍可查看。');}
 const dirty=!!run&&Object.entries(draft.parameters).some(([k,v])=>String(v)!==String(run.spec.parameters[k]));
 const point=result?.validation.find(p=>p.row===inspection?.row)||result?.validation[0];
 const label=(value:number)=>model.task==='classification'?result?.classes[0]?.[value]??String(value):fmt(value);
 return <article className="pp-model-lab" aria-label={`${model.title}机制实验`}>
  <button className="pp-text-link" onClick={onBack}><ArrowLeft size={18}/>{backLabel}</button>
  <header className="pp-model-lab-heading"><ModelGlyph kind={model.mechanism} size={64}/><div><span className="pp-breadcrumb">{model.task==='classification'?'分类':'回归'} · 机制示例</span><h1>{model.title}</h1><p>{mechanismQuestion(model)}</p></div></header>
  <div className="pp-model-lab-layout"><aside className="pp-model-lab-controls"><h2>改变一个设置</h2><p>{dataset.title} · 示例条件已明确给出。</p>
   <fieldset disabled={!!busy}><FormField label={control.label} value={draft.parameters[control.key]} onChange={v=>setDraft(d=>({...d,parameters:{...d.parameters,[control.key]:v}}))} options={control.kind==='choice'?control.options?.map(o=>({value:String(o.value),label:o.label})):undefined} range={control.kind==='choice'?undefined:`${control.min}～${control.max}${control.kind==='integer'?' · 整数':''}`}/></fieldset>
   <button className="pp-btn primary" disabled={!!busy} onClick={()=>void calculate('train')}><FlaskConical size={20}/>{run?'按新设置重新训练':'训练机制示例'}</button>
   {!!busy&&<><p role="status"><LoaderCircle className="spin" size={18}/>{busy}</p><button className="pp-text-link" onClick={cancel}>停止计算</button></>}
   {error&&<p className="pp-error" role="alert">{error}</p>}
   <details className="pp-details"><summary>示例固定条件</summary><p>训练/验证/测试60/20/20%，种子42；处理只在实际训练样本拟合。该示例标记为辅助，不增加课程完成。</p>{model.parameters.filter(f=>f.key!==control.key).map(f=><p key={f.key}>{f.label}：{String(draft.parameters[f.key])}</p>)}<p>独立测试保持封存。</p></details>
   <button className="pp-text-link" onClick={onPractice}>自己配置一次<ArrowRight size={18}/></button>
  </aside><section className="pp-model-lab-evidence" aria-label="本模型实算机制">
   {!result?<SmallGuide>先训练这份明确标记的机制示例，再选一条验证样本，查看它怎样得到预测。</SmallGuide>:<>
    <p className={dirty?'pp-notice':'pp-positive'} role="status">{dirty?'设置已修改；下方仍是上次已训练结果。':'当前展示这次真实训练的结果。'}</p>
    {result.warnings.length>0&&<details className="pp-details"><summary>本次训练提示</summary>{result.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
    <div className="pp-model-lab-readings"><div><span>{model.task==='classification'?'训练错误率':`训练RMSE · ${result.targets[0]?.unit||'目标单位'}`}</span><strong>{fmt(result.training_error)}</strong></div><div><span>{model.task==='classification'?'验证错误率':`验证RMSE · ${result.targets[0]?.unit||'目标单位'}`}</span><strong>{fmt(result.validation_error)}</strong></div>{point&&<div><span>所选样本预测 / 观测</span><strong>{label(point.prediction[0])} / {label(point.actual[0])}</strong></div>}</div>
    <label className="pp-probe-select">验证样本<select value={inspection?.row||point?.row||''} disabled={!!busy||dirty} onChange={e=>void calculate('inspect',e.target.value)}>{result.validation.map((p,i)=><option key={p.row} value={p.row}>{i+1} · {p.row}</option>)}</select></label>
    {inspection&&<Mechanism inspection={inspection} result={result}/>}
   </>}
  </section></div>
 </article>;
}
