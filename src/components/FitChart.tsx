'use client';
import {useId, useState} from 'react';
import type {Result, Sweep} from '@/lib/experiment';

export function FitChart({result}: {result: Result | null}) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const [showTruth, setShowTruth] = useState(true);
  const width = 760, height = 330, left = 49, right = 23, top = 18, bottom = 43;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (v: number) => left + v * plotWidth;
  const y = (v: number) => top + (1.7 - v) / 3.4 * plotHeight;
  const curve = result?.curve || [];
  const path = (key: 'fit' | 'truth') => curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(2)},${y(Math.max(-100, Math.min(100, p[key]))).toFixed(2)}`).join(' ');
  const clipped = curve.some(p => p.fit < -1.7 || p.fit > 1.7);
  const selected = hover === null ? null : curve[hover];
  return <div className="fit-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="拟合曲线：青绿色为训练点，珊瑚色为验证点，蓝线为模型，灰色虚线为真实函数">
      <defs><clipPath id={id}><rect x={left} y={top} width={plotWidth} height={plotHeight}/></clipPath></defs>
      {[-1.5, -0.75, 0, 0.75, 1.5].map(v => <g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="#e9ecf2" strokeDasharray={v === 0 ? '0' : '3 5'}/><text x={left-14} y={y(v)+4} textAnchor="end" className="axis-text">{v.toFixed(2)}</text></g>)}
      {[0, .2, .4, .6, .8, 1].map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={top} y2={height-bottom} stroke="#f0f2f6"/><text x={x(v)} y={height-bottom+23} textAnchor="middle" className="axis-text">{v.toFixed(1)}</text></g>)}
      <g clipPath={`url(#${id})`}>
        {showTruth && <path d={path('truth')} fill="none" stroke="#a9b0bc" strokeWidth="2" strokeDasharray="5 6"/>}
        {result?.validation.map((p,i) => <circle key={`v${i}`} cx={x(p.x)} cy={y(p.y)} r="3" fill="#e6a08b" fillOpacity=".6"/>)}
        {result?.train.map((p,i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r="4.6" fill="#359e94" fillOpacity=".86" stroke="white" strokeWidth="1.4"/>)}
        <path d={path('fit')} fill="none" stroke="#5163e5" strokeWidth="3" strokeLinecap="round"/>
        {selected && <><line x1={x(selected.x)} x2={x(selected.x)} y1={top} y2={height-bottom} stroke="#5163e5" strokeDasharray="3 4"/><circle cx={x(selected.x)} cy={y(selected.fit)} r="5" fill="#5163e5" stroke="white" strokeWidth="2"/></>}
      </g>
      <text x={width-right} y={height-4} textAnchor="end" className="axis-label">输入特征 x</text>
      <text x="15" y="17" className="axis-label">y</text>
      <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" onMouseMove={event => {const bounds=event.currentTarget.getBoundingClientRect(); setHover(Math.max(0,Math.min(curve.length-1,Math.round((event.clientX-bounds.left)/bounds.width*(curve.length-1)))));}} onMouseLeave={() => setHover(null)}/>
    </svg>
    {selected && <div className="chart-tooltip">x {selected.x.toFixed(2)}<span>预测 {selected.fit.toFixed(3)}</span><span>真实 {selected.truth.toFixed(3)}</span></div>}
    <div className="chart-legend"><span><i className="dot teal"/>训练样本</span><span><i className="dot coral"/>验证样本</span><span><i className="line blue"/>模型拟合</span><button className={!showTruth ? 'muted' : ''} onClick={() => setShowTruth(!showTruth)}><i className="line dashed"/>真实函数</button></div>
    {clipped && <p className="clipping-note">曲线超出当前纵轴范围，部分极值已裁切；误差仍由完整预测计算。</p>}
  </div>;
}

export function ErrorChart({data, current}: {data: Sweep; current: number}) {
  const width=600,height=160,left=45,top=15,pw=535,ph=111;
  const values=data.points.flatMap(p=>[p.train_mse,p.validation_mse]);
  const low=Math.min(...values.map(v=>Math.log10(Math.max(v,1e-7))))-.15;
  const high=Math.max(...values.map(v=>Math.log10(Math.max(v,1e-7))))+.15;
  const x=(degree:number)=>left+(degree-1)/14*pw;
  const y=(value:number)=>top+(high-Math.log10(Math.max(value,1e-7)))/(high-low)*ph;
  const path=(key:'train_mse'|'validation_mse')=>data.points.map((p,i)=>`${i?'L':'M'}${x(p.degree)},${y(p[key])}`).join(' ');
  return <svg className="error-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="不同模型阶数的训练与验证误差，纵轴为对数尺度">
    {[0,.5,1].map(f=><g key={f}><line x1={left} x2={left+pw} y1={top+f*ph} y2={top+f*ph} stroke="#e9ecf2"/><text x={left-9} y={top+f*ph+4} textAnchor="end" className="axis-text">{Math.pow(10,high-f*(high-low)).toPrecision(1)}</text></g>)}
    <line x1={x(current)} x2={x(current)} y1={top} y2={top+ph} stroke="#b9bfea" strokeDasharray="4 4"/>
    <path d={path('train_mse')} stroke="#359e94" strokeWidth="2" fill="none"/><path d={path('validation_mse')} stroke="#e29a6b" strokeWidth="2.5" fill="none"/>
    {data.points.map(p=><g key={p.degree}><circle cx={x(p.degree)} cy={y(p.validation_mse)} r={p.degree===current?4:2.5} fill="#e29a6b"/><text x={x(p.degree)} y={height-11} textAnchor="middle" className="axis-text">{p.degree}</text></g>)}
  </svg>;
}
