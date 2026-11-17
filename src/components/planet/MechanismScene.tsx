"use client";
import {useEffect,useState} from 'react';
import {fmt,type Inspection,type Result} from '@/lib/planet';
import PlanetPortal from './PlanetPortal';

export function MechanismStarter({kind}:{kind:string}){
 return <figure className="pp-mechanism-starter"><PlanetPortal variant={kind==='neighbors'?'classification':kind==='linear'?'regression':'mechanisms'}/><figcaption><strong>{kind==='neighbors'?'近处的样本，怎样一起投票？':kind==='linear'?'每个特征，怎样组成一次预测？':'从输入到预测，看看模型怎样判断。'}</strong><p>模型结构示意 · 训练后显示本次真实计算。</p></figcaption></figure>;
}

function useSceneFocus(key:string,values:string[]){
 const [selected,setSelected]=useState(''),[notice,setNotice]=useState('');const identity=JSON.stringify(values);
 useEffect(()=>{let saved='';try{saved=localStorage.getItem(key)||'';}catch{}const available=JSON.parse(identity) as string[];const next=available.includes(saved)?saved:available[0]||'';setSelected(next);setNotice(saved&&!available.includes(saved)?'原观察项已不在当前结果中，已选取首项。':'');try{localStorage.setItem(key,next);}catch{}},[key,identity]);
 function select(value:string){setSelected(value);setNotice('');try{localStorage.setItem(key,value);}catch{}}
 return {selected:values.includes(selected)?selected:values[0]||'',select,notice};
}
function focusScope(result:Result,kind:string){return `modelplanet-scene-${kind}-${result.spec.dataset}-${result.spec.model}-${result.spec.session_id}`;}
function includeSelected<T extends {row:string}>(values:T[],row:string){const shown=values.slice(0,12),found=values.find(v=>v.row===row);if(found&&!shown.includes(found))shown[shown.length-1]=found;return shown;}
function orbitAngle(row:string){let hash=2166136261;for(const c of row)hash=Math.imul(hash^c.charCodeAt(0),16777619);hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);return ((hash^(hash>>>16))>>>0)/4294967296*Math.PI*2;}

export function NeighborScene({inspection,before,result}:{inspection:Inspection;before:Inspection|null;result:Result}){
 const all=inspection.neighbors||[],focus=useSceneFocus(focusScope(result,'neighbor'),all.map(n=>n.row)),selected=focus.selected;
 const visible=includeSelected(all,selected),reference=includeSelected(before?.neighbors||[],selected);
 const max=Math.max(...all.map(n=>n.distance),...(before?.neighbors||[]).map(n=>n.distance),1e-9);
 const point=(row:string,d:number)=>{const angle=orbitAngle(row),r=24+90*d/max;return{x:200+Math.cos(angle)*r,y:145+Math.sin(angle)*r};};
 const colors=['#6b65b8','#208a7c','#c77c43','#4f80af'];const current=all.find(n=>n.row===selected)||all[0];
 return <section className="pp-neighbor-scene" aria-label="真实邻居距离轨道"><h3>同一条样本，谁参与了投票？</h3><svg viewBox="0 0 400 290" role="img" aria-label="半径从内圈零点表示完整处理空间距离，角度仅为排布">
  {[24,69,114].map((r,i)=><g key={r}><circle cx="200" cy="145" r={r} fill={i===0?'#f3f1fa':'none'} stroke="#dcd6e8" strokeDasharray={i?'4 7':undefined}/>{i>0&&<text x="203" y={145-r-5} fill="#81728f" fontSize="10">{fmt(max*i/2,2)}</text>}</g>)}
  {reference.map(n=>{const p=point(n.row,n.distance);return <circle key={n.row} cx={p.x} cy={p.y} r="9" fill="none" stroke="#a1a0aa" strokeWidth="1.6" strokeDasharray="3 3"/>;})}
  {visible.map(n=>{const p=point(n.row,n.distance),fresh=before&&!before.neighbors?.some(a=>a.row===n.row);return <g key={n.row} data-new={!!fresh} data-row={n.row} data-focused={n.row===selected}><line x1="200" y1="145" x2={p.x} y2={p.y} stroke="#d4cfdf" opacity=".5"/><circle cx={p.x} cy={p.y} r={n.row===selected?9:6} fill={colors[Math.round(n.target[0])%colors.length]} stroke={fresh?'#e3b35e':'white'} strokeWidth={fresh?3:2}/>{n.row===selected&&<text x={p.x} y={p.y-14} textAnchor="middle" fill="#51435e" fontSize="12">样本{n.row}</text>}</g>;})}
  <circle cx="200" cy="145" r="15" fill="#bdb0dd"/><circle cx="195" cy="143" r="1.7" fill="#51435e"/><circle cx="205" cy="143" r="1.7" fill="#51435e"/><path d="M196 149q4 4 8 0" fill="none" stroke="#51435e" strokeWidth="1.4"/>
 </svg><p className="pp-scene-caption">角度仅为排布；距内圈的半径表示真实距离。显示{visible.length}/{all.length}个邻居（优先近邻，并保留所选项），投票使用全部{all.length}个。{before?'虚线为定格A，金边为新邻居。':''}</p>
 {focus.notice&&<p className="pp-note" role="status">{focus.notice}</p>}<label className="pp-probe-select">观察训练邻居<select value={current?.row||''} onChange={e=>focus.select(e.target.value)}>{all.map(n=><option key={n.row} value={n.row}>样本{n.row}</option>)}</select></label>{current&&<p>完整空间距离 {fmt(current.distance)} · 投票权重 {fmt(current.weight,3)} · 类别 {result.classes[0]?.[Math.round(current.target[0])]}</p>}
 {inspection.probabilities&&<div className="pp-vote-summary" aria-label="完整邻居投票"><div>{inspection.probabilities.map((v,i)=><span key={i} style={{width:`${v*100}%`,background:colors[i%colors.length]}}/>)}</div><p>{inspection.probabilities.map((v,i)=>`类别${result.classes[0]?.[i]} ${(100*v).toFixed(1)}%`).join(' · ')}</p></div>}
 </section>;
}

export function CoefficientScene({inspection,before,result}:{inspection:Inspection;before:Inspection|null;result:Result}){
 const coefficients=inspection.coefficients||[],focus=useSceneFocus(focusScope(result,'coefficient'),coefficients.map(c=>c.name)),selected=coefficients.findIndex(c=>c.name===focus.selected);
 const current=coefficients[selected]||coefficients[0],shown=coefficients.slice(0,12);if(current&&!shown.includes(current))shown[shown.length-1]=current;
 const scale=Math.max(...shown.map(c=>Math.abs(c.coefficient)),...(before?.coefficients||[]).map(c=>Math.abs(c.coefficient)),1e-9),feature=inspection.features.find(f=>f.name===current?.name);
 return <section className="pp-coefficient-scene" aria-label="同尺度系数与预测联动"><h3>让系数的变化，回到一次预测。</h3><svg viewBox="0 0 600 270" role="img" aria-label="当前与定格A共享零点和系数刻度">
  <ellipse cx="300" cy="224" rx="263" ry="20" fill="#e8efe7"/><path d="M32 135H568" stroke="#b9afca" strokeWidth="1.5"/>
  {shown.map((c,i)=>{const x=50+i*500/Math.max(1,shown.length-1),old=before?.coefficients?.find(v=>v.name===c.name),y=135-90*c.coefficient/scale;return <g key={c.name} data-feature={c.name} data-focused={c.name===current?.name}>
   {old&&<line x1={x-6} y1="135" x2={x-6} y2={135-90*old.coefficient/scale} stroke="#a2a0aa" strokeWidth="5" strokeDasharray="4 3"/>}
   <line x1={x} y1="135" x2={x} y2={y} stroke={c.coefficient<0?'#bf8658':'#4b9885'} strokeWidth={c.name===current?.name?6:4} strokeLinecap="round"/><ellipse cx={x} cy={y} rx={c.name===current?.name?11:8} ry="5" fill={c.coefficient<0?'#e5bd91':'#8dbba5'} transform={`rotate(-22 ${x} ${y})`}/><text x={x} y="252" textAnchor="middle" fontSize="12" fill="#71627e">{coefficients.indexOf(c)+1}</text>
  </g>;})}<text x="34" y="22" fontSize="12" fill="#71627e">共用刻度 ±{fmt(scale)}</text><text x="567" y="130" textAnchor="end" fontSize="11" fill="#71627e">0</text>
 </svg><p className="pp-scene-caption">实线当前 · 虚线定格A。正负号与条长共同表示处理后系数，所有系数与截距共同组成预测。</p>
 {focus.notice&&<p className="pp-note" role="status">{focus.notice}</p>}<label className="pp-probe-select">观察一个特征<select value={current?.name||''} onChange={e=>focus.select(e.target.value)}>{coefficients.map((c,i)=><option key={c.name} value={c.name}>{i+1} · {c.name}</option>)}</select></label>
 {current&&<div className="pp-term-equation"><span>系数 <strong>{fmt(current.coefficient)}</strong></span><b>×</b><span>处理后输入 <strong>{fmt(feature?.value)}</strong></span><b>=</b><span>本项贡献 <strong>{fmt(current.contribution)}</strong></span></div>}
 <p className="pp-prediction-equation">截距 {fmt(inspection.intercept)} ＋ 全部特征贡献 ＝ 本样本预测 <strong>{fmt(inspection.prediction[0])} {result.targets[0]?.unit}</strong></p>
 </section>;
}
