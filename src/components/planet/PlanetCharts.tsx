"use client";
import {fmt,type Result,type Point,type Surface,type Inspection} from '@/lib/planet';

export function ResultScatter({result,mode,target,feature,onSelect}:{result:Result;mode:'parity'|'residual'|'feature';target:number;feature:number;onSelect:(row:string)=>void}){
 const validation=result.validation;const points=validation.filter(p=>mode!=='feature'||typeof p.features[feature]==='number');
 const gx=(p:Point)=>mode==='parity'?p.actual[target]:mode==='residual'?p.prediction[target]:Number(p.features[feature]);
 const gy=(p:Point)=>mode==='residual'?p.residual?.[target]??0:mode==='feature'?p.actual[target]:p.prediction[target];
 let xs=points.map(gx),ys=points.map(gy);
 if(!points.length)return <p className="pp-note">这个坐标没有可绘制的数值，换一项特征查看。</p>;
 if(mode==='parity'){const both=[...xs,...ys];xs=both;ys=both;}
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const dx=Math.max(maxX-minX,.1),dy=Math.max(maxY-minY,.1),loX=minX-dx*.08,hiX=maxX+dx*.08,loY=minY-dy*.08,hiY=maxY+dy*.08,x=(v:number)=>50+490*(v-loX)/(hiX-loX),y=(v:number)=>280-240*(v-loY)/(hiY-loY);
 const unit=result.targets[target]?.unit;
 return <figure className="pp-chart"><svg viewBox="0 0 580 330" role="img" aria-label={mode==='parity'?'真实值与预测值对照':mode==='residual'?'预测值与真实残差':'输入特征与目标关系'}>
  {[0,.5,1].map(v=><g key={v}><path d={`M50 ${40+240*v}H540`} stroke="#ece9f1"/><text x="43" y={44+240*v} textAnchor="end">{fmt(hiY-(hiY-loY)*v,2)}</text><text x={50+490*v} y="300" textAnchor="middle">{fmt(loX+(hiX-loX)*v,2)}</text></g>)}
  {mode==='parity'&&<path d={`M${x(minX)} ${y(minX)}L${x(maxX)} ${y(maxX)}`} stroke="#c0b4d4" strokeDasharray="6 5"/>}
  {mode==='residual'&&<path d={`M50 ${y(0)}H540`} stroke="#b8abc9" strokeDasharray="5 4"/>}
  {points.map(p=><circle key={p.row} cx={x(gx(p))} cy={y(gy(p))} r="4" fill="#fff" stroke="#bb6c43" strokeWidth="1.5" onClick={()=>onSelect(p.row)}><title>{`样本${p.row}；实际${fmt(p.actual[target])}；预测${fmt(p.prediction[target])}`}</title></circle>)}
  <text x="290" y="322" textAnchor="middle">{mode==='parity'?`真实值 · ${unit}`:mode==='residual'?`预测值 · ${unit}`:result.dataset.features.find(f=>f.id===result.spec.features[feature])?.label}</text>
  <text x="56" y="20">{mode==='residual'?'残差：真实 − 预测':mode==='feature'?`目标值 · ${unit}`:`预测值 · ${unit}`}</text>
 </svg><figcaption>显示{points.length}/{result.validation_total}个验证点，指标按全部验证样本计算。点击或选择样本核对预测。</figcaption></figure>;
}

export function Confusion({result,onSelect}:{result:Result;onSelect:(row:string)=>void}){
 const m=result.validation_metrics;
 if(!m.confusion)return <div className="pp-note">多标签任务逐个目标核对标签组合；全对率、Micro-F1和Hamming loss分别衡量不同表现。</div>;
 const names=result.classes[0],max=Math.max(...m.confusion.flat(),1);
 return <div className="pp-table-scroll"><table className="pp-confusion"><caption>行是真实类别，列是模型预测。点击非空格定位一个验证样本。</caption><thead><tr><th>真实 / 预测</th>{names.map(n=><th key={n}>{n}</th>)}</tr></thead><tbody>{m.confusion.map((row,i)=><tr key={i}><th>{names[i]}</th>{row.map((value,j)=><td key={j}><button style={{background:`rgba(120,69,181,${.05+.35*value/max})`}} disabled={!value} onClick={()=>{const p=result.validation.find(p=>p.actual[0]===i&&p.prediction[0]===j);if(p)onSelect(p.row);}} aria-label={`真实${names[i]}预测${names[j]}，${value}条`}>{value}</button></td>)}</tr>)}</tbody></table></div>;
}

export function SeriesChart({series,label}:{series:{name:string;points:{x:number;y:number|null}[];color:string}[];label:string}){
 const all=series.flatMap(s=>s.points.filter(p=>p.y!==null));if(!all.length)return <p>没有可用的比较点。</p>;
 const lx=Math.min(...all.map(p=>p.x)),hx=Math.max(...all.map(p=>p.x)),ly=Math.min(0,...all.map(p=>p.y!)),hy=Math.max(...all.map(p=>p.y!));
 const x=(v:number)=>48+(v-lx)/Math.max(hx-lx,1e-10)*480,y=(v:number)=>250-(v-ly)/Math.max(hy-ly,1e-10)*210;
 return <figure className="pp-chart"><svg viewBox="0 0 580 300" role="img" aria-label={label}>{[0,.5,1].map(v=><g key={v}><path d={`M48 ${40+210*v}H528`} stroke="#e8e4ef"/><text x="42" y={45+210*v} textAnchor="end">{fmt(hy-(hy-ly)*v,2)}</text></g>)}{series.map(s=><g key={s.name}><path d={s.points.filter(p=>p.y!==null).map((p,i)=>`${i?'L':'M'}${x(p.x)} ${y(p.y!)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="3"/>{s.points.filter(p=>p.y!==null).map((p,i)=><g key={i}><circle cx={x(p.x)} cy={y(p.y!)} r="4" fill={s.color}/><title>{`${s.name}：${p.x} → ${p.y}`}</title></g>)}</g>)}<text x="48" y="280">{fmt(lx,2)}</text><text x="528" y="280" textAnchor="end">{fmt(hx,2)}</text></svg><figcaption>{label} · {series.map(s=><span key={s.name} style={{color:s.color}}>━ {s.name}　</span>)}</figcaption></figure>;
}

export function SurfaceChart({surface,classification,onSelect}:{surface:Surface;classification:boolean;onSelect:(row:string)=>void}){
 if(!surface.available)return <p>{surface.note}</p>;
 const palette=['#b5dfd6','#d8c7ed','#f0c7a9','#b8cfee','#edd4a2'];const max=Math.max(...surface.values),min=Math.min(...surface.values);
 const width=480/surface.xs.length,height=260/surface.ys.length;
 function color(v:number){if(classification)return palette[Math.round(v)%palette.length];const t=(v-min)/Math.max(max-min,1e-8);return `rgb(${Math.round(229-105*t)},${Math.round(237-120*t)},${Math.round(244-50*t)})`;}
 const numberIndex=(value:number|string,axis:(number|string)[],i:number)=>surface.axis_kinds?.[i]==='categorical'?axis.indexOf(value):((Number(value)-Number(axis[0]))/Math.max(Number(axis.at(-1))-Number(axis[0]),1e-10))*(axis.length-1);
 return <figure className="pp-chart"><svg viewBox="0 0 580 330" role="img" aria-label={surface.note}><g>{surface.values.map((v,i)=><rect key={i} x={50+i%surface.xs.length*width} y={25+(surface.ys.length-1-Math.floor(i/surface.xs.length))*height} width={width+.4} height={height+.4} fill={color(v)}/>)}</g>{surface.points.filter(p=>p.x!==null&&p.y!==null&&!(surface.axis_kinds?.[0]==='categorical'&&!surface.xs.includes(p.x))&&!(surface.axis_kinds?.[1]==='categorical'&&!surface.ys.includes(p.y))).map(p=><circle key={`${p.role}${p.row}`} cx={50+(numberIndex(p.x,surface.xs,0)+.5)*width} cy={25+(surface.ys.length-numberIndex(p.y,surface.ys,1)-.5)*height} r="3.5" fill={p.role==='training'?'#435868':'white'} stroke={classification&&p.actual!==p.prediction?'#bc4c46':'#6d707b'} onClick={()=>{if(p.role==='validation')onSelect(p.row);}}><title>{`${p.role}样本${p.row}`}</title></circle>)}<text x="50" y="300">{String(surface.xs[0])}</text><text x="530" y="300" textAnchor="end">{typeof surface.xs.at(-1)==='number'?fmt(Number(surface.xs.at(-1)),2):String(surface.xs.at(-1))}</text><text x="290" y="328" textAnchor="middle">{surface.axes[0]}</text><text x="52" y="16">{surface.axes[1]}</text></svg><figcaption>{surface.note}。实心=训练、空心=验证。缺失或未展示类别的点不绘制。样本位置是投影，切片色块不替代其完整输入预测。{classification?'红边表示当前分类错误。':`预测色阶 ${fmt(min,2)}～${fmt(max,2)}`}</figcaption>{surface.conditional&&<details><summary>固定的其他输入</summary><pre>{JSON.stringify(surface.fixed,null,2)}</pre></details>}</figure>;
}

export function Mechanism({inspection,result}:{inspection:Inspection;result:Result}){
 const names=result.classes[inspection.target]||[];const label=(v:number)=>result.spec.task==='classification'?names[Math.round(v)]||String(v):fmt(v);
 return <section className="pp-mechanism"><h3>这个样本怎样得到预测？</h3><p>验证样本 {inspection.row} · 目标 {result.targets[inspection.target]?.label}</p>
  {inspection.coefficients&&<><p>{inspection.link}；截距 {fmt(inspection.intercept)}。特征位于训练内处理后的空间。</p><div className="pp-coefficient-bars">{[...inspection.coefficients].sort((a,b)=>Math.abs(b.coefficient)-Math.abs(a.coefficient)).slice(0,12).map(c=><div key={c.name}><span>{c.name}</span><i><b style={{width:`${100*Math.abs(c.coefficient)/Math.max(...inspection.coefficients!.map(v=>Math.abs(v.coefficient)),1e-10)}%`,background:c.coefficient<0?'#9971c1':'#428d79'}}/></i><strong>{fmt(c.coefficient)}</strong><small>本点贡献 {fmt(c.contribution)}</small></div>)}</div></>}
   {inspection.kernel&&<><p>{inspection.kernel.note}</p><p>γ {fmt(inspection.kernel.gamma)} · 共{inspection.kernel.total_support}个支持向量，展示距离最近的{inspection.kernel.points.length}个。</p><div className="pp-kernel-bars">{inspection.kernel.points.map(p=><div key={p.row}><span>{p.row}</span><i><b style={{width:`${p.similarity*100}%`}}/></i><strong>{fmt(p.similarity)}</strong><small>距离 {fmt(p.distance)}</small></div>)}</div></>}
   {inspection.neighbors&&<div className="pp-table-scroll"><table><caption>邻居由模型的全部处理后输入计算；二维图中的投影距离不能代替该距离。</caption><thead><tr><th>训练样本</th><th>距离</th><th>权重</th><th>目标</th></tr></thead><tbody>{inspection.neighbors.map(n=><tr key={n.row}><td>{n.row}</td><td>{fmt(n.distance)}</td><td>{fmt(n.weight)}</td><td>{n.target.map(label).join('、')}</td></tr>)}</tbody></table></div>}
  {inspection.tree&&<><p>{inspection.tree_note}</p><div className="pp-tree-nodes">{inspection.tree.map(n=><div key={n.id} data-visited={n.visited} style={{marginLeft:`${n.depth*14}px`}}><span>节点{n.id} · {n.samples}条训练样本</span><strong>{n.label}{n.threshold!==null?` ≤ ${fmt(n.threshold)}`:''}</strong>{n.visited&&<small>当前样本经过</small>}</div>)}</div></>}
  {inspection.trees&&<div className="pp-tree-votes">{inspection.trees.map(t=><div key={t.tree}><span>树{t.tree}</span><b>{Array.isArray(t.prediction)?t.prediction.map(label).join('、'):label(t.prediction)}</b></div>)}<p>只展示真实森林中的前{inspection.trees.length}棵树，最终结果由全部树集成。</p></div>}
  {inspection.gaussian&&<><p>{inspection.gaussian.feature} · 处理后数值 {fmt(inspection.gaussian.value)}</p><SeriesChart label="训练按类得到的高斯密度示意" series={inspection.gaussian.series.map((s,i)=>({name:`类别${s.class}`,points:s.points.map(([x,y])=>({x,y})),color:['#7845b5','#388f7b','#b76535'][i%3]}))}/></>}
  {inspection.stages&&<><SeriesChart label={inspection.stages.metric} series={[{name:'实际集成阶段',points:inspection.stages.points.map(p=>({x:p.stage,y:p.value})),color:'#7845b5'}]}/><p>{inspection.stages.note}</p></>}
  {inspection.probabilities&&<p>模型概率估计：{inspection.probabilities.map((v,i)=>`${names[i]} ${fmt(v,3)}`).join('；')}</p>}
  {inspection.decision_score!==undefined&&<p>模型决策分数：{JSON.stringify(inspection.decision_score)}。{Array.isArray(inspection.decision_score)?`按 ${names.join('、')} 类标顺序`:`分数增大对应本次正类 ${result.spec.decision.positive_class}`}，不是概率。</p>}
 </section>;
}
