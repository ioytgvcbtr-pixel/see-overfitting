"use client";
import {useId,useMemo,useState} from 'react';
import type {ConceptResult} from '@/lib/concepts';
import {conceptNumber} from '@/lib/concepts';
import {SceneHandle} from './IslandControls';
import HelpHint from './HelpHint';

export default function GardenCausalPlot({result,term,pending,explainResult}:{result:ConceptResult;term:number|null;pending:boolean;explainResult:boolean}){
  const [probe,setProbe]=useState(0);
  const clip=useId().replace(/:/g,'');
  const model=result.regularization!.current,explain=model.explanation;
  const order=useMemo(()=>result.validation.map((p,i)=>({x:p.x,i})).sort((a,b)=>a.x-b.x),[result.validation_fingerprint]);
  if(!explain)return null;
  const item=order[Math.min(probe,order.length-1)],point=result.validation[item.i],e=explain.residuals[item.i];
  const part=term===null?null:explain.terms[term];
  const x=(n:number)=>28+404*n,y=(n:number)=>146-35*n;
  const path=(values:number[])=>values.map((v,i)=>`${i?'L':'M'}${x(result.grid_x[i]).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const outside=[model.curve,result.regularization!.weak.curve,...(part?[part.curve]:[])].some(values=>values.some(v=>Math.abs(v)>3));
  return <section className="garden-causal" aria-label="系数到预测的实算联动" aria-busy={pending}>
    <header><strong>{part?`第${part.power}项怎样影响曲线`:'模型怎样预测新样本'}</strong><HelpHint title="从系数到误差"><p>点击左侧枝条看标准化多项式项的贡献。各项贡献加截距等于紫色预测曲线。空心点是固定验证观测；移动探针核对单点残差。图窗固定±3，超窗曲线被裁切；总验证MSE仍用全部真实数值计算。</p></HelpHint></header>
    <svg viewBox="0 0 460 270" role="group" aria-label="固定验证点、真实拟合曲线与残差探针">
      <defs><clipPath id={clip}><rect x="28" y="41" width="404" height="210"/></clipPath></defs>
      {[-3,0,3].map(v=><g key={v}><path d={`M28 ${y(v)}H432`} stroke="#e4e3e9" strokeDasharray={v?'3 5':undefined}/><text x="18" y={y(v)+4} textAnchor="end">{v}</text></g>)}
      <g clipPath={`url(#${clip})`}>
        <path d={path(result.regularization!.weak.curve)} fill="none" stroke="#9297a4" strokeDasharray="4 5" strokeWidth="1.5"/>
        {part&&<path d={path(part.curve)} fill="none" stroke="#237d92" strokeWidth="2" strokeDasharray="6 3"/>}
        <path d={path(model.curve)} fill="none" stroke="#7845bb" strokeWidth="2.8"/>
        {result.train.map((p,i)=><circle key={`t${i}`} cx={x(p.x)} cy={y(p.y)} r="3" fill="#358c71"/>)}
        {result.validation.map((p,i)=><circle key={`v${i}`} cx={x(p.x)} cy={y(p.y)} r="2.6" fill="white" stroke="#b66336" strokeWidth="1.2" opacity={.7}/>)}
        <path d={`M${x(point.x)} ${y(e.observed)}V${y(e.predicted)}`} stroke="#c65d44" strokeWidth="3"/>
        <circle cx={x(point.x)} cy={y(e.predicted)} r="4" fill="#7845bb"/>
      </g>
      <g onKeyDownCapture={event=>{const change=event.key==='ArrowRight'||event.key==='ArrowUp'?1:event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:0;if(change||event.key==='Home'||event.key==='End'){event.preventDefault();event.stopPropagation();setProbe(event.key==='Home'?0:event.key==='End'?order.length-1:Math.max(0,Math.min(order.length-1,probe+change)));}}}>
      <SceneHandle label="验证探针位置" value={point.x} min={0} max={1} step={.01} x={x(point.x)} y={y(Math.max(-3,Math.min(3,e.observed)))} start={28} end={432} axis="x"
        onChange={value=>setProbe(order.reduce((best,p,i)=>Math.abs(p.x-value)<Math.abs(order[best].x-value)?i:best,0))} onDrag={()=>{}}>
        <circle cx={x(point.x)} cy={y(Math.max(-3,Math.min(3,e.observed)))} r="34" fill="transparent"/>
        <circle cx={x(point.x)} cy={y(Math.max(-3,Math.min(3,e.observed)))} r="7" fill="white" stroke="#b66336" strokeWidth="2.5"/>
      </SceneHandle></g>
      <text x="230" y="267" textAnchor="middle">x · 固定验证样本</text>
      {outside&&<text x="430" y="28" textAnchor="end">部分曲线超出±3窗口</text>}
    </svg>
    <div className="garden-curve-key"><span>━ 当前预测</span><span>┄ 弱约束参照</span>{part&&<span>┄ 所选项贡献</span>}</div>
    <label className="garden-probe-selector">验证点<select aria-label="选择验证探针" value={probe} onChange={ev=>setProbe(Number(ev.target.value))}>{order.map((p,i)=><option value={i} key={p.i}>{i+1} · x={p.x.toFixed(3)}</option>)}</select></label>
    <div className="garden-probe-readout" data-pending={pending}><span>观测 y<b>{pending?'—':conceptNumber(e.observed)}</b></span><span>预测 ŷ<b>{pending?'—':conceptNumber(e.predicted)}</b></span><span>该点 e²<b>{pending?'—':conceptNumber(e.squared)}</b></span></div>
    {part&&<p className="garden-contribution-value">第{part.power}项在该点贡献 {pending?'—':conceptNumber(part.validation[item.i])}</p>}
    {explainResult&&!pending&&result.regularization?.observation&&<p className="garden-observation">{result.regularization.observation.text}</p>}
  </section>;
}
