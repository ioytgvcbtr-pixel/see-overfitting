"use client";
import {useEffect,useId,useRef,type ReactNode,type HTMLAttributes} from 'react';
import {enableFocusgroup} from '@/lib/focusgroup';
export default function ResultTabs({tabs,value,onChange,children}:{tabs:{id:string;label:string}[];value:string;onChange:(id:string)=>void;children:(id:string)=>ReactNode}){
 const id=useId(),root=useRef<HTMLDivElement>(null),list=useRef<HTMLDivElement>(null);
 useEffect(()=>{void enableFocusgroup();},[]);
 useEffect(()=>{
  const panels=root.current!,reveal=(e:Event)=>{const panel=(e.target as HTMLElement).closest<HTMLElement>('[data-result-panel]');if(panel)onChange(panel.dataset.resultPanel!);};
  panels.addEventListener('beforematch',reveal);return()=>panels.removeEventListener('beforematch',reveal);
 },[onChange]);
 useEffect(()=>{
  const bar=list.current!,reveal=()=>{const tab=bar.querySelector<HTMLElement>('[aria-selected=true]');if(!tab)return;const a=tab.getBoundingClientRect(),b=bar.getBoundingClientRect();if(a.left<b.left+8)bar.scrollLeft+=a.left-b.left-8;else if(a.right>b.right-8)bar.scrollLeft+=a.right-b.right+8;};
  reveal();const resize=new ResizeObserver(reveal);resize.observe(bar);return()=>resize.disconnect();
 },[value]);
 return <div ref={root} className="pp-result-views"><div ref={list} className="pp-result-tabs" role="tablist" aria-label="结果视图" {...{focusgroup:'tablist nomemory'}}>{tabs.map(tab=><button type="button" key={tab.id} id={`${id}-${tab.id}`} role="tab" aria-selected={value===tab.id} {...(value===tab.id?{focusgroupstart:''}:{})} onClick={()=>onChange(tab.id)}>{tab.label}</button>)}</div><div className="pp-result-panels">{tabs.map(tab=><div key={tab.id} role="tabpanel" data-result-panel={tab.id} aria-labelledby={`${id}-${tab.id}`} {...({hidden:value===tab.id?undefined:'until-found'} as unknown as HTMLAttributes<HTMLDivElement>)} tabIndex={value===tab.id?0:undefined}><div>{children(tab.id)}</div></div>)}</div></div>;
}
