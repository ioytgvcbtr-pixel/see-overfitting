"use client";
import {useEffect,useRef,useState} from 'react';
import {api} from './experiment';
import {archiveChanging} from './archive-storage';
import type {Draft,Job} from './planet';
import type {WorkspaceEntry} from './workspace';
export type LessonMeta={id:string;title:string;chapter:string;goal:string;visual:string;version:number};
export type KnowledgeAttempt={id:string;choice:string;quiz_version:number;choice_text:string;question_text:string;correct:boolean;submitted_at:string};
export type LessonProgress={id:string;status:'unseen'|'opened'|'read'|'completed';completed:boolean;first_opened_at?:string;last_opened_at?:string;read_at?:string;completed_at?:string;explanation?:string;imported?:boolean;attempts:KnowledgeAttempt[];first_answer:KnowledgeAttempt|null};
export type Chapter={id:string;title:string;subtitle:string;palette:string;icon:string};
export type MechanismProgress={id:string;title:string;completed:boolean;started:boolean;entry:WorkspaceEntry|null};
export type StudyOverview={chapters:Chapter[];lessons:LessonMeta[];progress:Record<string,LessonProgress>;mechanisms:MechanismProgress[];completed:number;total:number;all_complete:boolean;next_id:string|null;resume_id:string|null;experiment_count:number;event_count:number};
export type Lesson=LessonMeta&{sections:{title:string;text:string}[];quiz:{question:string;choices:{id:string;text:string}[]};sources:{title:string;url:string}[];practice?:{mechanism_model?:string;label?:string;dataset?:string;model?:string;section?:string;panel?:string}|null};
export type LessonResponse={lesson:Lesson;progress:LessonProgress};
export type StudyRecord={id:string;kind:string;category:'knowledge'|'experiments'|'mechanisms';created_at:string;title:string;lesson_id?:string;dataset?:string;dataset_title?:string;model?:string;state?:string;step?:number;run_id?:string;error?:string;changes?:Edit[];entry?:WorkspaceEntry;imported?:boolean;evidence?:{kind:'course_ai'|'island_ai';id:string}};
export type RecordPage={items:StudyRecord[];total:number;offset:number;limit:number};
export type Edit={field:string;before:string;after:string};
export const studyChanged=()=>window.dispatchEvent(new Event('modelplanet-study-changed'));
export function draftChanges(before:Draft,after:Draft):Edit[]{
 const result:Edit[]=[];
 const text=(v:unknown)=>v===undefined||v===null||v===''?'未填写':Array.isArray(v)?v.join('、'):String(v);
 function walk(a:Record<string,unknown>,b:Record<string,unknown>,prefix=''){
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
   if(['session','dataset'].includes(key))continue;const x=a[key],y=b[key],field=prefix?prefix+'.'+key:key;
   if(JSON.stringify(x)===JSON.stringify(y))continue;
   if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y))walk(x as Record<string,unknown>,y as Record<string,unknown>,field);
   else result.push({field,before:text(x).slice(0,250),after:text(y).slice(0,250)});
  }
 }
 walk(before as unknown as Record<string,unknown>,after as unknown as Record<string,unknown>);return result.slice(0,50);
}
export function editLabel(field:string){const names:Record<string,string>={features:'输入特征',targets:'预测目标',task:'任务类型',model:'模型',seed:'实验种子',prediction:'训练前的预期',positive:'正类',threshold:'概率阈值',fraction:'训练池使用比例',assisted:'使用辅助','split.train':'训练比例','split.validation':'验证比例','split.test':'测试比例','split.strategy':'划分方式','split.keep_test':'保留测试角色','cleaning.numeric':'数值缺失处理','cleaning.constant':'常量填补值','cleaning.categorical':'类别缺失处理','cleaning.encoding':'类别编码','cleaning.scale':'缩放方式','cleaning.deduplicate':'训练内去重','cleaning.degree':'多项式阶数','cleaning.outlier':'异常处理','cleaning.outlier_value':'异常处理参数','cleaning.drop_missing':'训练缺失行筛选','cleaning.pollution':'教学扰动比例',
 'parameters.max_depth':'最大树深','parameters.min_samples_leaf':'叶节点最少样本','parameters.n_neighbors':'邻居数K','parameters.n_estimators':'树/阶段数量','parameters.alpha':'正则化α','parameters.C':'惩罚C','parameters.gamma':'核影响γ','parameters.max_iter':'迭代上限','parameters.weights':'邻居权重','parameters.fit_intercept':'拟合截距','parameters.epsilon':'不敏感带ε','parameters.learning_rate':'学习率','parameters.var_smoothing':'方差平滑','parameters.l1_ratio':'L1占比'};return names[field]||field.replace('featureTypes.','输入类型 · ').replace('parameters.','参数 · ');}

type JournalEvent={id:string;kind:'config_change'|'step_open';session_id:string;dataset:string;model:string;step?:number;changes:Edit[]};
const OUTBOX='modelplanet-study-outbox-v1';
export function useStudyJournal(){
 const outbox=useRef<JournalEvent[]>([]),pending=useRef<{draft:Draft;changes:Map<string,Edit>}|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),inflight=useRef<Promise<void>|null>(null),paused=useRef(false);
 const [warning,setWarning]=useState('');
 function persist(){try{localStorage.setItem(OUTBOX,JSON.stringify(outbox.current));}catch{setWarning('操作记录暂存未完成，请保持页面打开并检查浏览器存储。');}}
 function drain():Promise<void>{
  if(paused.current)return Promise.resolve();if(inflight.current)return inflight.current;
  const work=(async()=>{let saved=false;try{while(!paused.current&&outbox.current.length){const e=outbox.current[0];await api('/study/events',e);if(paused.current)return;saved=true;outbox.current=outbox.current.filter(v=>v.id!==e.id);persist();}setWarning('');}catch{if(!paused.current)setWarning('操作记录等待同步；连接恢复后会补记。');}finally{if(saved&&!paused.current)window.dispatchEvent(new Event('modelplanet-journal-saved'));}})();
  inflight.current=work;void work.finally(()=>{if(inflight.current===work)inflight.current=null;});return work;
 }
 function add(e:JournalEvent){if(paused.current)return;outbox.current.push(e);persist();void drain();}
 function flush(){if(timer.current)clearTimeout(timer.current);timer.current=null;const p=pending.current;pending.current=null;if(p?.changes.size)add({id:crypto.randomUUID().replaceAll('-',''),kind:'config_change',session_id:p.draft.session,dataset:p.draft.dataset,model:p.draft.model,changes:[...p.changes.values()]});return drain();}
 async function prepareArchive(){await flush();if(outbox.current.length)throw Error('学习操作还在等待同步，请连接恢复后重试档案操作。');}
 function edits(before:Draft,after:Draft){if(paused.current)return;if(pending.current&&pending.current.draft.session!==after.session)flush();const changes=draftChanges(before,after);if(!changes.length)return;const p=pending.current||{draft:after,changes:new Map<string,Edit>()};p.draft=after;for(const e of changes){const old=p.changes.get(e.field);p.changes.set(e.field,{...e,before:old?.before??e.before});}pending.current=p;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(flush,750);}
 function step(d:Draft,n:number){flush();add({id:crypto.randomUUID().replaceAll('-',''),kind:'step_open',session_id:d.session,dataset:d.dataset,model:d.model,step:n,changes:[]});}
 useEffect(()=>{const stop=()=>{paused.current=true;if(timer.current)clearTimeout(timer.current);timer.current=null;pending.current=null;outbox.current=[];localStorage.removeItem(OUTBOX);};window.addEventListener(archiveChanging,stop);try{const saved=JSON.parse(localStorage.getItem(OUTBOX)||'[]');if(Array.isArray(saved))outbox.current=saved.filter(e=>typeof e.id==='string'&&['config_change','step_open'].includes(e.kind));}catch{}void drain();const online=()=>void drain();const hide=()=>{if(paused.current)return;flush();for(const e of outbox.current.slice(0,10))void fetch('/api/study/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e),keepalive:true}).catch(()=>{});};window.addEventListener('online',online);window.addEventListener('pagehide',hide);const repeat=setInterval(online,15000);return()=>{flush();clearInterval(repeat);window.removeEventListener(archiveChanging,stop);window.removeEventListener('online',online);window.removeEventListener('pagehide',hide);};},[]);
 return {edits,step,flush,prepareArchive,warning};
}
