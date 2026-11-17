"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,FlaskConical,LoaderCircle,Check,Flag} from 'lucide-react';
import {fmt,type Catalog,type Dataset,type Model} from '@/lib/planet';
import type {MechanismEvidence} from '@/lib/companion';
import {useMechanismExperiment,type Forecast} from '@/lib/use-mechanism-experiment';
import {mechanismControl,mechanismQuestion} from '@/lib/model-mechanism';
import {Mechanism} from './PlanetCharts';
import {ModelGlyph} from './PlanetArt';
import CanvasToolbar from './CanvasToolbar';
import LabChoices from './LabChoices';
import ParameterRail from './ParameterRail';
import {MechanismStarter,NeighborScene,CoefficientScene} from './MechanismScene';
import MechanismTransfer from './MechanismTransfer';

export default function ModelMechanism({model,dataset,catalog,onBack,backLabel,onPractice,onEvidence}:{model:Model;dataset:Dataset;catalog:Catalog;onBack:()=>void;backLabel:string;onPractice:()=>void;onEvidence:(v:MechanismEvidence)=>void}){
 const [canvas,setCanvas]=useState<'figure'|'readings'>('figure'),[showA,setShowA]=useState(true),bar=useRef<HTMLFormElement>(null),fieldId=useId();
 useEffect(()=>{const element=bar.current!,root=document.documentElement,old=root.style.getPropertyValue('--lab-sticky-height');const observer=new ResizeObserver(()=>root.style.setProperty('--lab-sticky-height',`${element.getBoundingClientRect().height}px`));observer.observe(element);return()=>{observer.disconnect();if(old)root.style.setProperty('--lab-sticky-height',old);else root.style.removeProperty('--lab-sticky-height');};},[]);
 const e=useMechanismExperiment(model,dataset,catalog),{draft,run,anchor,inspection,anchorInspection,comparison,quiz,busy,guided,dirty}=e;
 const control=mechanismControl(model),result=run?.result;
 useEffect(()=>onEvidence({model_id:model.id,run_id:run?.state==='completed'?run.id:null,row_id:inspection?.row||null,reference_run_id:anchor&&anchor.id!==run?.id?anchor.id:null,draft_changed:dirty,busy:!!busy}),[model.id,run?.id,anchor?.id,inspection?.row,dirty,busy,onEvidence]);
 const point=result?.validation.find(p=>p.row===inspection?.row)||result?.validation[0];
 const label=(v:number)=>model.task==='classification'?result?.classes[0]?.[v]??String(v):fmt(v);
 const metric=model.task==='classification'?'验证错误率':`验证RMSE · ${result?.targets[0]?.unit||dataset.targets[0]?.unit||'目标单位'}`;
 const reference=comparison?.comparable?anchorInspection:null;
 const diagnostic=result?.validation.find(p=>model.task==='classification'&&p.actual.some((v,i)=>v!==p.prediction[i]))||(model.task==='regression'?[...(result?.validation||[])].sort((a,b)=>Math.abs(b.actual[0]-b.prediction[0])-Math.abs(a.actual[0]-a.prediction[0]))[0]:undefined);
 const stages=['准备A','预测B','实算对照','新情境'];const completed=[!!anchor,!!comparison?.prediction,!!comparison?.prediction,!!quiz?.answer?.passed];
 const phase=!anchor?0:!comparison?.prediction?1:!quiz?2:3;
 const put=(v:string)=>e.setDraft(d=>({...d,parameters:{...d.parameters,[control.key]:v}}));
 return <article className="pp-model-lab" aria-label={`${model.title}机制实验`}>
  <button className="pp-text-link" onClick={onBack}><ArrowLeft size={18}/>{backLabel}</button>
  <header className="pp-model-lab-heading"><ModelGlyph kind={model.mechanism} size={64}/><div><span className="pp-breadcrumb">{model.task==='classification'?'分类':'回归'} · {guided?'代表课':'机制示例'}</span><h1>{model.title}</h1><p>{mechanismQuestion(model)}</p></div></header>
  {guided&&<ol className="pp-model-learning-steps" aria-label="代表课学习闭环">{stages.map((s,i)=><li key={s} data-done={completed[i]} aria-current={phase===i?'step':undefined}>{completed[i]?<Check size={17}/>:<span>{i+1}</span>}{s}</li>)}</ol>}
  <form ref={bar} className="pp-lab-command" aria-label="实验参数与预期" method="post" action="/api/lab/runs" onSubmit={event=>{event.preventDefault();void e.train();}}>
   <div className="pp-lab-parameter"><label htmlFor={fieldId}>{control.label}</label>{control.kind==='choice'?<select id={fieldId} name={control.key} value={String(draft.parameters[control.key])} required disabled={!!busy} onChange={event=>put(event.target.value)}>{control.options?.map(option=><option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>:<input id={fieldId} name={control.key} type="number" value={String(draft.parameters[control.key]??'')} min={control.min} max={control.max} step={control.kind==='integer'?1:'any'} required disabled={!!busy} onChange={event=>put(event.target.value)}/>}
   <ParameterRail field={control} value={draft.parameters[control.key]} onChange={put} disabled={!!busy}/></div>
   {guided&&anchor&&dirty&&<LabChoices legend="你预计验证误差会怎样？" choices={['降低','升高','近似不变']} name="parameter-forecast" value={e.forecast?(['lower','higher','same'] as Forecast[]).indexOf(e.forecast):null} onChange={n=>e.setForecast((['lower','higher','same'] as Forecast[])[n])} disabled={!!busy}/>}
   <div className="pp-lab-command-actions"><button type="submit" className="pp-btn primary" disabled={!!busy||guided&&!!anchor&&!dirty}><FlaskConical size={20}/>{guided&&anchor?'锁定预测并训练B':run?'按新设置重新训练':'训练机制示例'}</button>{!!busy&&<button type="button" className="pp-text-link" onClick={e.cancel}>停止计算</button>}</div>
  </form>
  {busy&&<p className="pp-lab-status" role="status"><LoaderCircle className="spin" size={18}/>{busy}</p>}{e.error&&<p className="pp-error" role="alert">{e.error}</p>}{e.notice&&<p className="pp-notice" role="status">{e.notice}</p>}
  <details className="pp-lab-more"><summary>固定条件与更多操作</summary><p>{dataset.title} · 请求比例60/20/20%，种子42；处理只在实际训练样本拟合，测试继续封存。示例记录与知识格子分别保存。</p><div>{model.parameters.filter(f=>f.key!==control.key).map(f=><span key={f.key}>{f.label}：{String(draft.parameters[f.key])}</span>)}</div><div>{run&&anchor?.id!==run.id&&<button type="button" className="pp-text-link" disabled={!!busy} onClick={e.pin}><Flag size={17}/>把当前运行定格A</button>}<button type="button" className="pp-text-link" onClick={onPractice}>自己配置一次<ArrowRight size={18}/></button></div></details>
  <div className="pp-model-lab-layout"><section className="pp-model-lab-evidence" aria-label="本模型实算机制">
   {!result?<MechanismStarter kind={model.mechanism}/>:<>
    <p className={dirty?'pp-notice':'pp-positive'} role="status">{dirty?'设置已修改；下方仍是上次已训练结果。':'当前展示这次真实训练的结果。'}</p>
    {result.warnings.length>0&&<details className="pp-details"><summary>本次训练提示</summary>{result.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
    <div className="pp-model-lab-readings"><div><span>{model.task==='classification'?'训练错误率':`训练RMSE · ${result.targets[0]?.unit||'目标单位'}`}</span><strong>{fmt(result.training_error)}</strong></div><div><span>{metric}</span><strong>{fmt(result.validation_error)}</strong></div>{point&&<div><span>所选样本预测 / 观测</span><strong>{label(point.prediction[0])} / {label(point.actual[0])}</strong></div>}</div>
    {comparison&&<section className="pp-mechanism-comparison" aria-label="机制受控对照"><h3>同一群体，比较A与B</h3>{!comparison.comparable&&<p>{comparison.note}</p>}{comparison.comparable&&<p>{metric}：<strong>{fmt(comparison.before)} → {fmt(comparison.after)}</strong> · 差值 {fmt(comparison.delta)}</p>}{comparison.prediction&&<p className={comparison.prediction.correct?'pp-positive':'pp-notice'} role="status">{comparison.prediction.correct?'预测与这次实算一致':'预测与这次实算不同，首答已保留'}。这只说明当前条件，下一站换个情境。</p>}</section>}
    <div className="pp-lab-probes"><label className="pp-probe-select">验证样本<select value={inspection?.row||point?.row||''} disabled={!!busy||dirty} onChange={event=>void e.selectRow(event.target.value)}>{result.validation.map((p,i)=><option key={p.row} value={p.row}>{i+1} · 样本{p.row}</option>)}</select></label>{guided&&<button className="pp-text-link pp-diagnostic-probe" disabled={!!busy||dirty||!diagnostic} onClick={()=>diagnostic&&void e.selectRow(diagnostic.row)}>{model.task==='classification'?(diagnostic?'观察一个错分点':'本次验证没有错分'):'观察偏差较大的验证点'}</button>}</div>
    {inspection&&<><CanvasToolbar view={canvas} onView={setCanvas} reference={showA} onReference={reference?()=>setShowA(v=>!v):undefined}/><div className="pp-lab-canvas" aria-live="off">{canvas==='readings'?<Mechanism inspection={inspection} result={result}/>:model.id==='knn_c'?<NeighborScene inspection={inspection} before={showA?reference:null} result={result}/>:model.id==='ridge'?<CoefficientScene inspection={inspection} before={showA?reference:null} result={result}/>:<Mechanism inspection={inspection} result={result}/>}</div></>}
    {guided&&comparison?.prediction&&!quiz&&<button className="pp-btn primary" disabled={!!busy} onClick={()=>void e.transfer()}>换个情境验证<ArrowRight size={18}/></button>}
    {quiz&&<MechanismTransfer quiz={quiz} busy={!!busy} metric={metric} onAnswer={e.answerTransfer} onRecompute={e.recomputeTransfer} onAgain={e.transfer}/>}
   </>}
  </section></div>
 </article>;
}