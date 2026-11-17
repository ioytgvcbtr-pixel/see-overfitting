"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Archive,Download,Upload,RotateCcw,Undo2,LoaderCircle} from 'lucide-react';
import {api} from '@/lib/experiment';
import {collectLearningState,archiveNoticeKey,type ResetScope} from '@/lib/archive-storage';
import {activateArchive,downloadLearningArchive,type ArchivePackage,type ArchiveStatus,type ArchiveSummary,type ArchiveResult} from '@/lib/learning-archive';
import HelpHint from '../HelpHint';
export default function LearningArchive({onPrepare}:{onPrepare?:()=>Promise<void>}){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),file=useRef<HTMLInputElement>(null);
 const [status,setStatus]=useState<ArchiveStatus|null>(null),[mode,setMode]=useState<'reset'|'import'|'undo'|null>(null),[scope,setScope]=useState<ResetScope>('progress');
 const [pack,setPack]=useState<ArchivePackage|null>(null),[preview,setPreview]=useState<ArchiveSummary|null>(null),[filename,setFilename]=useState('');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{void api<ArchiveStatus>('/learning-archive/status').then(setStatus).catch(()=>{});const saved=sessionStorage.getItem(archiveNoticeKey);if(saved){setNotice(saved);sessionStorage.removeItem(archiveNoticeKey);}},[]);
 useEffect(()=>{if(mode&&!dialog.current?.open)dialog.current?.showModal();},[mode]);
 async function exportFile(){setBusy('正在整理完整学习档案');setError('');try{await onPrepare?.();const value=await api<ArchivePackage>('/learning-archive/export',{client_state:collectLearningState(localStorage)});downloadLearningArchive(value);setNotice('学习档案已下载。下次可在这里导入恢复。');}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function selectFile(selected:File){
  if(selected.size>32*1024*1024){setError('完整学习档案限32MB。');return;}setBusy('正在校验学习档案');setError('');
  try{let value:ArchivePackage;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await selected.arrayBuffer()));}catch{throw Error('文件无法读取，请选择JSON格式的学习档案。');}
   if(value?.format!=='modelplanet-learning-archive'||value.version!==1)throw Error('请选择“导出全部学习记录”生成的档案。旧版分项备份可在下方原入口导入。');
   await onPrepare?.();const checked=await api<{summary:ArchiveSummary}>('/learning-archive/preview',{archive:value});setPack(value);setPreview(checked.summary);setFilename(selected.name);setMode('import');
  }catch(e){setError((e as Error).message);}finally{setBusy('');}
 }
 async function confirm(){setBusy('正在切换学习档案，完成后自动打开学习记录');setError('');try{
  await onPrepare?.();const local=collectLearningState(localStorage);let result:ArchiveResult;
  if(mode==='reset')result=await api('/learning-archive/reset',{confirmed:true,scope,client_state:local});
  else if(mode==='undo')result=await api('/learning-archive/undo',{confirmed:true,current_client_state:local});
  else result=await api('/learning-archive/import',{confirmed:true,archive:pack,current_client_state:local});
  activateArchive(result,mode==='reset'?'学习进度已重置，可以重新开始。':'学习档案已恢复。模型实训记录可在打开时重新计算指标。');
 }catch(e){setError((e as Error).message);setBusy('');}}
 function open(next:'reset'|'undo'){setError('');setNotice('');setScope('progress');setMode(next);}
 return <section className="pp-learning-archive" aria-labelledby={id+'-heading'}><header><h2 id={id+'-heading'}><Archive size={23}/>学习档案</h2><HelpHint title="学习档案包含什么"><p>课程进度、首答、四站探索、模型实验、操作记录和本机学习草稿一起保存。API密钥、聊天和外观设置不进入档案。重置后已接触过的测试数据仍保留接触标记。</p></HelpHint></header>
  <div className="pp-archive-actions"><button type="button" className="pp-btn secondary" disabled={!!busy} onClick={()=>void exportFile()}><Download size={18}/>导出全部学习记录</button><button type="button" className="pp-btn secondary" disabled={!!busy} onClick={()=>{setError('');file.current?.click();}}><Upload size={18}/>导入学习档案</button><button type="button" className="pp-text-link" disabled={!!busy} onClick={()=>open('reset')}><RotateCcw size={18}/>重置学习进度</button>{status?.has_previous&&<button type="button" className="pp-text-link" disabled={!!busy} onClick={()=>open('undo')}><Undo2 size={18}/>撤销上次重置或导入</button>}</div>
  <input ref={file} type="file" accept=".json,application/json" hidden aria-label="选择学习档案文件" onChange={e=>{const selected=e.target.files?.[0];e.target.value='';if(selected)void selectFile(selected);}}/>
  {!mode&&busy&&<p className="pp-archive-feedback" role="status"><LoaderCircle className="spin" size={18}/>{busy}</p>}{!mode&&error&&<p className="pp-error" role="alert">{error}</p>}{notice&&<p className="pp-positive" role="status">{notice}</p>}
  <dialog ref={dialog} className="pp-archive-dialog" aria-labelledby={id+'-title'} aria-describedby={`${id}-description ${id}-feedback`} {...{closedby:busy?'none':'closerequest'}} onCancel={event=>{if(busy)event.preventDefault();}} onClose={()=>{dialog.current!.returnValue='';setMode(null);setError('');}}>
   <h2 id={id+'-title'}>{mode==='reset'?'重新开始学习？':mode==='undo'?'恢复上次操作前的档案？':'恢复这份学习档案？'}</h2>
   <p id={id+'-description'}>{mode==='reset'?'选择重置范围。操作前会自动保留一份可恢复的档案。':'课程、机制、模型实验和操作记录将恢复为档案中的状态；当前档案会先自动备份。'}</p>
   {mode==='reset'&&<fieldset className="pp-lab-choices" disabled={!!busy}><legend>重置范围</legend><div><label><input type="radio" name="reset-scope" checked={scope==='progress'} onChange={()=>setScope('progress')}/><span><strong>课程与四站进度</strong><small>已读、首答与完成标识归零，模型实训记录保留。</small></span></label><label><input type="radio" name="reset-scope" checked={scope==='all'} onChange={()=>setScope('all')}/><span><strong>全部学习记录</strong><small>课程、机制、模型实验、操作记录与学习草稿一起清空。</small></span></label></div></fieldset>}
   {mode==='import'&&preview&&<div className="pp-archive-preview"><p>{filename}</p><dl><div><dt>已完成课题</dt><dd>{preview.lessons_completed} / 18</dd></div><div><dt>完成的探索站</dt><dd>{preview.mechanisms_completed} / 4</dd></div><div><dt>模型实训</dt><dd>{preview.model_runs}份</dd></div></dl><p>首答和学习进度会重新核验；模型指标在打开记录时复算。</p></div>}
   <p id={id+'-feedback'} className="pp-archive-dialog-feedback" role={error?'alert':'status'}>{error||busy||'API配置与外观偏好保留。已打开的学习页面会同步刷新。'}</p>
   <div className="pp-archive-dialog-actions"><form method="dialog"><button className="pp-btn secondary" value="cancel" autoFocus disabled={!!busy}>取消</button></form><button type="button" className="pp-btn primary" disabled={!!busy} onClick={()=>void confirm()}>{busy?<LoaderCircle className="spin" size={18}/>:null}{mode==='reset'?'确认重置':mode==='undo'?'恢复上次档案':'恢复这份档案'}</button></div>
  </dialog>
 </section>;
}
