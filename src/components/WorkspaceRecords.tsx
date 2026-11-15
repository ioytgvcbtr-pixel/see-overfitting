"use client";
import {useState} from "react";
import {BookOpen,Compass,History,RefreshCw,Sparkles,Target} from "lucide-react";
import {api} from "@/lib/experiment";
import type {WorkspaceEntry,WorkspaceOverview} from "@/lib/workspace";

type Proof={hypothesis:string;expected:string;mode:string;model:string|null;notice:string;context:string;baseline_parameters:unknown;target_parameters:unknown;proof:{before:number;after:number;metric:string;verdict:string}|null};
export default function WorkspaceRecords({overview,group,onOpen,onRefresh}:{overview:WorkspaceOverview|null;group:"learning"|"ai";onOpen:(entry:WorkspaceEntry,practice?:boolean)=>Promise<void>;onRefresh:()=>void}){
  const [filter,setFilter]=useState("all"),[limit,setLimit]=useState(20),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  const [proofs,setProofs]=useState<Record<string,Proof>>({});
  const entries=(overview?.items??[]).filter(e=>group==="learning"?e.kind==="course"||e.kind==="island":e.kind.endsWith("_ai"))
    .filter(e=>filter==="all"||filter==="pending"&&e.stage!=="complete"||filter==="review"&&e.needs_review);
  async function open(entry:WorkspaceEntry,practice=false){setBusy(entry.id);setError("");try{await onOpen(entry,practice);}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
  async function evidence(entry:WorkspaceEntry){setBusy(entry.id);setError("");try{const value=await api<Proof>(`/workspace/evidence/${entry.kind}/${entry.id}`);setProofs(old=>({...old,[entry.id]:value}));}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
  return <section className="workspace-records" aria-label={group==="learning"?"统一学习记录":"统一AI实验记录"}>
    <div className="workspace-record-toolbar"><div className="workspace-record-filters" aria-label="记录筛选">{[["all","全部"],["pending","待继续"],["review","需复盘"]].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setLimit(20);}}>{label}</button>)}</div><button className="text-button" onClick={onRefresh}><RefreshCw size={20}/>刷新记录</button></div>
    {error&&<p className="workspace-notice error" role="alert">{error}</p>}
    {!overview?<p>正在读取本机学习记录…</p>:!entries.length?<div className="workspace-empty"><Compass size={32}/><p>{filter==="all"?"开始一次学习后，首答与发现会出现在这里。":"当前没有这一类记录。"}</p></div>:
      <ol className="workspace-record-list">{entries.slice(0,limit).map(entry=>{
        const Icon=entry.kind==="course"?BookOpen:entry.kind==="island"?Compass:Sparkles;
        const proof=proofs[entry.id];
        return <li key={`${entry.kind}:${entry.id}`}><div className="workspace-record-row"><span className="workspace-record-icon"><Icon size={24}/></span><div className="workspace-record-copy"><h3>{entry.title}</h3><p>{entry.status}{entry.assisted?" · 有辅助记录":""}{entry.imported?" · 导入复算":""}</p><time dateTime={entry.updated_at}>{new Date(entry.updated_at).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</time></div>
          <div className="workspace-record-actions">{group==="learning"?<><button className="button secondary" disabled={!!busy} onClick={()=>void open(entry)}><History size={20}/>{entry.stage==="complete"?"回看":"继续"}</button>{entry.needs_review&&<button className="text-button" disabled={!!busy} onClick={()=>void open(entry,true)}><Target size={20}/>复练</button>}</>:<button className="button secondary" disabled={!!busy} onClick={()=>void evidence(entry)}>查看证据</button>}</div></div>
          {proof&&<div className="workspace-record-proof"><p>{proof.mode==="online"?`AI方案 · ${proof.model}`:"规则方案"} · {proof.context}</p><p>{proof.hypothesis}</p>{proof.proof?<><strong>{({supported:"支持原预期",not_supported:"不支持原预期",observed:"记录实际变化"})[proof.proof.verdict as "supported"]}</strong><p>{proof.proof.metric} <b>{(proof.proof.metric.includes("率")?`${(100*proof.proof.before).toFixed(1)}%`:proof.proof.before.toPrecision(5))}</b> → <b>{(proof.proof.metric.includes("率")?`${(100*proof.proof.after).toFixed(1)}%`:proof.proof.after.toPrecision(5))}</b></p></>:<p>方案尚未执行。</p>}<details><summary>实验条件</summary><pre>{JSON.stringify({before:proof.baseline_parameters,after:proof.target_parameters},null,2)}</pre></details><button className="text-button" onClick={()=>setProofs(old=>{const next={...old};delete next[entry.id];return next;})}>收起证据</button></div>}
        </li>;
      })}</ol>}
    {entries.length>limit&&<button className="button secondary" onClick={()=>setLimit(n=>n+20)}>再显示20条</button>}
  </section>;
}
