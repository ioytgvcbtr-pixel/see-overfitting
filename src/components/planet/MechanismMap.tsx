"use client";
import Image from 'next/image';
import {ArrowRight,CheckCircle2,Compass,Flag,Play} from 'lucide-react';
import type {StudyOverview} from '@/lib/study';
import type {WorkspaceEntry} from '@/lib/workspace';
import LearningGrid from './LearningGrid';
const stations=[
 {id:'error',name:'误差湖',question:'预测离真实值有多远？',topic:'残差与平方损失',art:'error'},
 {id:'sensitivity',name:'曲线山',question:'一个样本能牵动多远？',topic:'复杂度与样本扰动',art:'sensitivity'},
 {id:'regularization',name:'约束花园',question:'给模型一点约束会怎样？',topic:'系数与泛化',art:'regularization'},
 {id:'forest',name:'边界森林',question:'模型把谁看错了？',topic:'类别、边界与错分',art:'classification'},
];
export default function MechanismMap({overview,onOpen,onRecords}:{overview:StudyOverview|null;onOpen:(id:string,entry?:WorkspaceEntry|null)=>void;onRecords:()=>void}){
 return <div className="pp-mechanism-map"><header className="pp-learning-hero"><div><span className="pp-breadcrumb">机制星球 · 四个探索站</span><h1>把一个概念，亲手试明白。</h1><p>先猜一次，动手改变，再去新情境验证。走完一站，就点亮一格。</p></div><Image src="/illustrations/planet-v11/mechanisms-v1.png" alt="机制星球的湖泊、曲线山、花园和森林" width={220} height={220}/></header>
 <LearningGrid label="机制探索进度" cells={stations.map(s=>({id:s.id,title:s.name,completed:!!overview?.mechanisms.find(m=>m.id===s.id)?.completed,started:overview?.mechanisms.find(m=>m.id===s.id)?.started}))}/>
 <div className="pp-station-grid">{stations.map((s,i)=>{const p=overview?.mechanisms.find(m=>m.id===s.id);return <button key={s.id} className="pp-station-card" data-complete={p?.completed||false} onClick={()=>onOpen(s.id,p?.entry)}><div className="pp-station-art"><Image src={`/illustrations/world-v09/island-${s.art}-v1.png`} alt="" width={180} height={130}/><span>{i+1}</span></div><div><span className="pp-breadcrumb">{s.topic}</span><h2>{s.name}</h2><p>{s.question}</p></div><div className="pp-station-foot"><span>{p?.completed?<><CheckCircle2 size={18}/>流程已完成</>:p?.started?<><Compass size={18}/>继续探索</>:<><Play size={18}/>从猜想出发</>}</span><ArrowRight size={19}/></div></button>;})}</div><div className="pp-section-end"><p>每次判断、实验与迁移都能回看。</p><button className="pp-btn secondary" onClick={onRecords}><Flag size={18}/>查看机制学习记录</button></div></div>;
}
