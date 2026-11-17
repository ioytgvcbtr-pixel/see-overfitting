"use client";
import {useId,useState} from 'react';
import {api} from '@/lib/experiment';
import type {StudyRecord} from '@/lib/study';

type Proof={hypothesis:string;mode:string;model:string|null;notice:string;context:string;baseline_parameters:unknown;target_parameters:unknown;proof:{before:number;after:number;metric:string;verdict:string}|null};
export default function ExperimentEvidence({source}:{source:NonNullable<StudyRecord['evidence']>}){
 const [proof,setProof]=useState<Proof|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),id=useId();
 async function load(){setBusy(true);setError('');try{setProof(await api<Proof>(`/workspace/evidence/${source.kind}/${source.id}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const number=(n:number,label:string)=>label.includes('率')?`${(n*100).toFixed(1)}%`:n.toPrecision(5);
 return <div className="pp-record-evidence">{!proof?<button type="button" className="pp-text-link" disabled={busy} onClick={()=>void load()}>{busy?'正在读取证据…':'查看核验证据'}</button>:<section aria-label="实验核验证据"><p>{proof.mode==='online'?`AI方案 · ${proof.model}`:'规则方案'} · {proof.context}</p><p>{proof.hypothesis}</p>{proof.proof?<><strong>{({supported:'支持原预期',not_supported:'不支持原预期',observed:'记录实际变化'} as Record<string,string>)[proof.proof.verdict]||'核验已保存'}</strong><p className="pp-evidence-reading">{proof.proof.metric}<b>{number(proof.proof.before,proof.proof.metric)}</b><span aria-label="变为">→</span><b>{number(proof.proof.after,proof.proof.metric)}</b></p></>:<p>方案尚未执行。</p>}<details className="pp-details"><summary>查看实验条件</summary><pre id={id} tabIndex={0} role="region" aria-label="执行前后参数"><code>{JSON.stringify({before:proof.baseline_parameters,after:proof.target_parameters},null,2)}</code></pre></details><button type="button" className="pp-text-link" onClick={()=>setProof(null)}>收起证据</button></section>}{error&&<p className="pp-error" role="alert">{error}</p>}</div>;
}
