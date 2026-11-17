"use client";
import {useEffect} from 'react';
import {enableFocusgroup} from '@/lib/focusgroup';
import {ChartNoAxesCombined,Table2,Layers2} from 'lucide-react';
export default function CanvasToolbar({view,onView,reference,onReference}:{view:'figure'|'readings';onView:(v:'figure'|'readings')=>void;reference?:boolean;onReference?:()=>void}){
 useEffect(()=>{void enableFocusgroup();},[]);
 return <div className="pp-canvas-toolbar" role="toolbar" aria-label="机制画布工具" {...{focusgroup:'toolbar wrap'}}><div role="group" aria-label="展示方式"><button type="button" aria-pressed={view==='figure'} onClick={()=>onView('figure')}><ChartNoAxesCombined size={18}/>图形</button><button type="button" aria-pressed={view==='readings'} onClick={()=>onView('readings')}><Table2 size={18}/>读数</button></div>{onReference&&<><span role="separator" aria-orientation="vertical"/><div role="group" aria-label="对照图层"><button type="button" aria-pressed={reference} onClick={onReference}><Layers2 size={18}/>A参考</button></div></>}</div>;
}
