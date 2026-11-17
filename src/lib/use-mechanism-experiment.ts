"use client";
import {useEffect,useRef,useState} from 'react';
import {api} from './experiment';
import {cachedInspection} from './inspection';
import {buildSpec,example,fromSpec,waitJob,type AnalysisJob,type Catalog,type Dataset,type Draft,type Inspection,type Job,type Model,type Quiz} from './planet';

export type Forecast='lower'|'higher'|'same';
export type MechanismComparison={comparable:boolean;single_change:boolean;before:number|null;after:number|null;delta:number|null;note:string;prediction:{choice:Forecast;observed:Forecast;correct:boolean;run_id:string}|null};
export function useMechanismExperiment(model:Model,dataset:Dataset,catalog:Catalog){
 const [draft,setDraft]=useState<Draft>(()=>{const d=example(dataset,model);d.prediction='机制示例：观察真实模型的内部结果';return d;});
 const [run,setRun]=useState<Job|null>(null),[anchor,setAnchor]=useState<Job|null>(null),[inspection,setInspection]=useState<Inspection|null>(null),[anchorInspection,setAnchorInspection]=useState<Inspection|null>(null);
 const [comparison,setComparison]=useState<MechanismComparison|null>(null),[quiz,setQuiz]=useState<Quiz|null>(null),[forecast,setForecast]=useState<Forecast|''>('');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');const controller=useRef<AbortController|null>(null),ticket=useRef(0),active=useRef<string|null>(null);
 const store=`modelplanet-mechanism-${model.id}-v1`,guided=['knn_c','ridge'].includes(model.id);
 const persist=(r:Job,a:Job,q:Quiz|null,row=inspection?.row)=>{try{localStorage.setItem(store,JSON.stringify({run:r.id,anchor:a.id,quiz:q?.id||null,row}));}catch{}};
 const valid=(r:Job)=>r.state==='completed'&&!!r.result&&r.spec.model===model.id&&r.spec.dataset===dataset.id;
 useEffect(()=>{let live=true;const id=++ticket.current;let saved:{run:string;anchor:string;quiz?:string;row?:string}|null=null;
  try{const raw=localStorage.getItem(store);saved=raw&&/^[0-9a-f]{32}$/.test(raw)?{run:raw,anchor:raw}:raw?JSON.parse(raw):null;}catch{}
  if(saved&&/^[0-9a-f]{32}$/.test(saved.run)&&/^[0-9a-f]{32}$/.test(saved.anchor)){const s=saved;controller.current=new AbortController();const signal=controller.current.signal;setBusy('恢复本模型的实验');void Promise.all([api<Job>('/lab/runs/'+s.run),api<Job>('/lab/runs/'+s.anchor)]).then(async([r,a])=>{
   if(!live||id!==ticket.current||!valid(r)||!valid(a))return;
   const c=r.id===a.id?null:await api<MechanismComparison>('/lab/compare',{a:a.id,b:r.id});
   const q=s.quiz?await api<Quiz>('/lab/quizzes/'+s.quiz).catch(()=>null):null;
   const row=r.result!.validation.some(p=>p.row===s.row)?s.row:r.result!.validation[0].row;const current=await inspect(r,row!,id,signal);const prior=c?.comparable?await inspect(a,row!,id,signal):null;
   if(live&&id===ticket.current){setRun(r);setAnchor(a);setInspection(current);setAnchorInspection(prior);setDraft(fromSpec(r.result!.spec));setComparison(c);if(q?.source_id===r.id)setQuiz(q);if(s.row&&row!==s.row)setNotice('原样本不在当前验证群体，已选择首个公开样本。');}
  }).catch(()=>{}).finally(()=>{if(live&&id===ticket.current)setBusy('');});}
  return()=>{live=false;ticket.current++;controller.current?.abort();if(active.current)void api('/lab/runs/'+active.current+'/cancel',{}).catch(()=>{});};
 },[model.id,dataset.id,store]);
 async function job(path:string,body:unknown,id:number,signal:AbortSignal){
  const first=await api<AnalysisJob>(path,body,signal);if(id!==ticket.current)throw new DOMException('Aborted','AbortError');active.current=first.id;
  return waitJob(first,v=>{if(id===ticket.current)setBusy(v.phase);},signal);
 }
 async function inspect(r:Job,row:string,id:number,signal:AbortSignal):Promise<Inspection>{const cached=await cachedInspection(r.id,row,0,0,signal);if(cached)return cached;const done=await job(`/lab/runs/${r.id}/analysis/inspect`,{row},id,signal);return done.result as Inspection;}
 async function perform(work:(id:number,signal:AbortSignal)=>Promise<void>){
  const id=++ticket.current;controller.current?.abort();controller.current=new AbortController();setBusy('准备实际计算');setError('');
  try{await work(id,controller.current.signal);}catch(e){if(id===ticket.current&&(e as Error).name!=='AbortError')setError((e as Error).message);}
  finally{if(id===ticket.current){active.current=null;setBusy('');}}
 }
 function cancel(){controller.current?.abort();if(active.current)void api('/lab/runs/'+active.current+'/cancel',{}).catch(()=>{});ticket.current++;active.current=null;setBusy('');setError('已停止等待；原有运行与首答仍保留。');}
 const dirty=!!run&&Object.entries(draft.parameters).some(([k,v])=>String(v)!==String(run.spec.parameters[k]));
 async function train(){
  if(guided&&anchor&&(!dirty||!forecast)){setError('先改变一个设置，再留下你的预期。');return;}
  await perform(async(id,signal)=>{
   const spec=buildSpec({...draft,prediction:guided&&anchor?'mechanism:'+forecast:draft.prediction},catalog.models);
   const r=await job('/lab/runs',{spec,source_id:anchor?.id||null},id,signal) as Job;
   const a=anchor||r,c=anchor?await api<MechanismComparison>('/lab/compare',{a:a.id,b:r.id},signal):null;
   const previous=inspection?.row,row=r.result!.validation.some(p=>p.row===previous)?previous!:r.result!.validation[0].row;const current=await inspect(r,row,id,signal),prior=c?.comparable?await inspect(a,row,id,signal):current;
   if(id===ticket.current){setRun(r);setAnchor(a);setInspection(current);setAnchorInspection(prior);setComparison(c);setQuiz(null);setForecast('');setNotice(previous&&previous!==row?'原样本不在当前验证群体，已选择首个公开样本。':'');persist(r,a,null,row);}
  });
 }
 async function selectRow(row:string){if(!run)return;await perform(async(id,signal)=>{
  const current=await inspect(run,row,id,signal);
  const before=anchor&&anchor.id!==run.id&&comparison?.comparable?await inspect(anchor,row,id,signal):current;
  if(id===ticket.current){setInspection(current);setAnchorInspection(before);setNotice('');persist(run,anchor||run,quiz,row);}
 });}
 function pin(){if(!run)return;setAnchor(run);setAnchorInspection(inspection);setComparison(null);setQuiz(null);setForecast('');persist(run,run,null);}
 async function transfer(){if(!run)return;await perform(async(id,signal)=>{
  const result=await job(`/lab/runs/${run.id}/challenge`,{blind:true},id,signal);const q=await api<Quiz>('/lab/quizzes/'+(result.result as {quiz_id:string}).quiz_id,undefined,signal);
  if(id===ticket.current){setQuiz(q);persist(run,anchor||run,q);}
 });}
 async function answerTransfer(kind:'decision'|'answer',value:number,interpretation?:number){if(!quiz||!run)return;await perform(async(id,signal)=>{
  const q=await api<Quiz>(`/lab/quizzes/${quiz.id}/${kind}`,kind==='decision'?{choice:value}:{reason:value,interpretation},signal);if(id===ticket.current){setQuiz(q);persist(run,anchor||run,q);}
 });}
 async function recomputeTransfer(){if(!quiz||!run)return;await perform(async(id,signal)=>{await job(`/lab/quizzes/${quiz.id}/recompute`,{},id,signal);const q=await api<Quiz>('/lab/quizzes/'+quiz.id,undefined,signal);if(id===ticket.current){setQuiz(q);persist(run,anchor||run,q);}});}
 return {draft,setDraft,run,anchor,inspection,anchorInspection,comparison,quiz,forecast,setForecast,busy,error,notice,guided,dirty,train,selectRow,pin,transfer,answerTransfer,recomputeTransfer,cancel};
}
