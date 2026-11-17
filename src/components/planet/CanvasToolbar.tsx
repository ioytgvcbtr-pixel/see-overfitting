"use client";
import {useEffect,useRef} from 'react';
import {ChartNoAxesCombined,Table2,Layers2} from 'lucide-react';
export default function CanvasToolbar({view,onView,reference,onReference}:{view:'figure'|'readings';onView:(v:'figure'|'readings')=>void;reference?:boolean;onReference?:()=>void}){
 const ref=useRef<HTMLDivElement>(null),hasReference=onReference!==undefined;
 useEffect(()=>{
  if('focusGroup' in HTMLElement.prototype)return;
  const bar=ref.current!,items=Array.from(bar.querySelectorAll<HTMLButtonElement>('button'));
  items.forEach((b,i)=>b.tabIndex=i?-1:0);
  const focus=(event:FocusEvent)=>{if(items.includes(event.target as HTMLButtonElement))items.forEach(b=>b.tabIndex=b===event.target?0:-1);};
  const key=(event:KeyboardEvent)=>{const index=items.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;const rtl=getComputedStyle(bar).direction==='rtl';let next:number;
   if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=(index+(event.key==='ArrowRight'?1:-1)*(rtl?-1:1)+items.length)%items.length;else return;
   event.preventDefault();items[next].focus();};
  bar.addEventListener('focusin',focus);bar.addEventListener('keydown',key);return()=>{bar.removeEventListener('focusin',focus);bar.removeEventListener('keydown',key);};
 },[hasReference]);
 return <div ref={ref} className="pp-canvas-toolbar" role="toolbar" aria-label="机制画布工具" {...{focusgroup:'toolbar wrap'}}><div role="group" aria-label="展示方式"><button type="button" aria-pressed={view==='figure'} onClick={()=>onView('figure')}><ChartNoAxesCombined size={18}/>图形</button><button type="button" aria-pressed={view==='readings'} onClick={()=>onView('readings')}><Table2 size={18}/>读数</button></div>{onReference&&<><span role="separator" aria-orientation="vertical"/><div role="group" aria-label="对照图层"><button type="button" aria-pressed={reference} onClick={onReference}><Layers2 size={18}/>A参考</button></div></>}</div>;
}
