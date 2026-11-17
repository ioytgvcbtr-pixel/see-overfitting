"use client";
import {useEffect,useState} from 'react';
import {fmt,type Quiz} from '@/lib/planet';
export default function MechanismTransfer({quiz,busy,metric,onAnswer,onRecompute,onAgain}:{quiz:Quiz;busy:boolean;metric:string;onAnswer:(kind:'decision'|'answer',value:number)=>Promise<void>;onRecompute:()=>Promise<void>;onAgain:()=>Promise<void>}){
 const [choice,setChoice]=useState<number|null>(null),[reason,setReason]=useState<number|null>(null);useEffect(()=>{setChoice(null);setReason(null);},[quiz.id]);
 return <section className="pp-mechanism-transfer" aria-label="代表课新情境验证"><h3>把判断带到一个新情境</h3><p>新种子{quiz.before_spec.seed}。本题A与B只改变{quiz.change.label}：{String(quiz.change.from_value)} → {String(quiz.change.to_value)}。</p>
  {quiz.state==='restored'?<button className="pp-btn primary" disabled={busy} onClick={()=>void onRecompute()}>复算保留的迁移</button>:<>
   {!quiz.decision?<><p>先留下预期，锁定后再揭开本题实算读数。</p><fieldset><legend>{quiz.question}</legend><div className="pp-choice-row">{quiz.choices.map((c,i)=><button key={c} aria-pressed={choice===i} disabled={busy} onClick={()=>setChoice(i)}>{c}</button>)}</div></fieldset><button className="pp-btn primary" disabled={choice===null||busy} onClick={()=>void onAnswer('decision',choice!)}>锁定新情境判断</button></>:<>
    <p className="pp-positive">本题首答：{quiz.choices[quiz.decision.choice]}</p>{quiz.observations&&<div className="pp-transfer-readings"><span>A {metric}<strong>{fmt(quiz.observations.before)}</strong></span><span>B {metric}<strong>{fmt(quiz.observations.after)}</strong></span></div>}
    {!quiz.answer?<><fieldset><legend>结合这次证据，选择依据</legend><div className="pp-choice-stack">{quiz.reasons.map((c,i)=><button key={c} aria-pressed={reason===i} disabled={busy} onClick={()=>setReason(i)}>{c}</button>)}</div></fieldset><button className="pp-btn primary" disabled={reason===null||busy} onClick={()=>void onAnswer('answer',reason!)}>保存依据并核验</button></>:<><p role="status" className={quiz.answer.passed?'pp-positive':'pp-notice'}>{quiz.answer.passed?'新情境判断与依据通过':'本题首答已保留，回看证据后再试新情境'}</p><p>实际：{quiz.choices[quiz.answer.correct_choice!]}</p><p>{quiz.reasons[quiz.answer.correct_reason!]}</p><button className="pp-btn secondary" disabled={busy} onClick={()=>void onAgain()}>再试一个新情境</button></>}
   </>}
  </>}
 </section>;
}
