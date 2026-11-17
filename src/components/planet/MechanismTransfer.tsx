"use client";
import {useEffect,useRef,useState} from 'react';
import {fmt,type Quiz} from '@/lib/planet';
import LabChoices from './LabChoices';
export default function MechanismTransfer({quiz,busy,metric,onAnswer,onRecompute,onAgain}:{quiz:Quiz;busy:boolean;metric:string;onAnswer:(kind:'decision'|'answer',value:number,interpretation?:number)=>Promise<void>;onRecompute:()=>Promise<void>;onAgain:()=>Promise<void>}){
 const [choice,setChoice]=useState<number|null>(null),[reason,setReason]=useState<number|null>(null),[reading,setReading]=useState<number|null>(null),heading=useRef<HTMLHeadingElement>(null);
 const modern=quiz.assessment_version===2;
 useEffect(()=>{setChoice(null);setReason(null);setReading(null);},[quiz.id]);
 const revealed=!!quiz.decision,answered=!!quiz.answer;
 useEffect(()=>{if(revealed)heading.current?.focus({preventScroll:true});},[revealed,answered]);
 return <section className="pp-mechanism-transfer" aria-label="新情境迁移验证"><h3>把判断带到一个新情境</h3><p>新种子{quiz.before_spec.seed}。本题A与B只改变{quiz.change.label}：{String(quiz.change.from_value)} → {String(quiz.change.to_value)}。</p>
  {quiz.provenance_note&&<p className="pp-notice">{quiz.provenance_note}</p>}
  {quiz.state==='restored'?<button type="button" className="pp-btn primary" disabled={busy} onClick={()=>void onRecompute()}>复算保留的迁移</button>:<>
   {!quiz.decision?<form aria-label="新情境预测" method="post" action={`/api/lab/quizzes/${quiz.id}/decision`} onSubmit={e=>{e.preventDefault();if(choice!==null)void onAnswer('decision',choice);}}><p>先留下预期，再揭开本题实算读数。</p><LabChoices legend={quiz.question} choices={quiz.choices} value={choice} onChange={setChoice} name="forecast" disabled={busy}/><button type="submit" className="pp-btn primary" disabled={busy}>锁定新情境判断</button></form>:<>
    <p>本题首答：<strong>{quiz.choices[quiz.decision.choice]}</strong></p>
    {quiz.observations&&<div className="pp-transfer-readings"><span>A {metric}<strong>{fmt(quiz.observations.before,8)}</strong><small>训练误差 {fmt(quiz.observations.before_training,8)}</small></span><span>B {metric}<strong>{fmt(quiz.observations.after,8)}</strong><small>训练误差 {fmt(quiz.observations.after_training,8)}</small></span></div>}
    <h4 ref={heading} tabIndex={-1}>{quiz.answer?'这次理解检查':'读完证据，再解释一次'}</h4>
    {!quiz.answer?<form aria-label="实算证据理解检查" method="post" action={`/api/lab/quizzes/${quiz.id}/answer`} onSubmit={e=>{e.preventDefault();if(reason!==null)void onAnswer('answer',reason,reading??undefined);}}>
     {modern&&<LabChoices legend="根据实算读数，哪组验证误差更低？" choices={quiz.choices.slice(0,3)} value={reading} onChange={setReading} name="interpretation" disabled={busy}/>}
     <LabChoices legend={quiz.reason_question||'结合这次证据，选择依据'} choices={quiz.reasons} value={reason} onChange={setReason} name="reason" disabled={busy}/><button type="submit" className="pp-btn primary" disabled={busy}>保存依据并核验</button>
    </form>:<><p role="status" className={quiz.answer.passed?'pp-positive':'pp-notice'}>{modern?(quiz.answer.passed?'证据阅读与解释通过':'已保存理解检查，回看读数后可再试新情境'):(quiz.answer.passed?'本次判断与依据通过':'本次首答已保留')}</p>{modern&&<p>{quiz.answer.prediction_matched===null?'原预测保留为不确定':quiz.answer.prediction_matched?'原预测与这次实算一致':'原预测与这次实算不同'}；{quiz.answer.interpretation_correct?'读数结论正确':'读数结论需要复核'}，{quiz.answer.reason_correct?'解释正确':'解释需要复核'}。</p>}<p>实际：{quiz.choices[quiz.answer.correct_choice!]}</p><p>{quiz.reasons[quiz.answer.correct_reason!]}</p><button type="button" className="pp-btn secondary" disabled={busy} onClick={()=>void onAgain()}>再试一个新情境</button></>}
   </>}
   {quiz.split_protocol===1&&<button type="button" className="pp-text-link" disabled={busy} onClick={()=>void onRecompute()}>按封存角色复算，保留原始记录</button>}
  </>}
 </section>;
}
