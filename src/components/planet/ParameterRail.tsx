"use client";
import {Minus,Plus} from 'lucide-react';
import type {Field,Value} from '@/lib/planet';
import {fromSlider,logarithmic,sliderDomain,toSlider} from '@/lib/parameter-scale';
export default function ParameterRail({field,value,onChange,suffix='调节',disabled=false}:{field:Field;value:Value|undefined;onChange:(v:string)=>void;suffix?:string;disabled?:boolean}){
 const n=Number(value);if(field.kind==='choice'||value===undefined||value===null||String(value).trim()===''||!Number.isFinite(n)||n<field.min!||n>field.max!)return null;
 const domain=sliderDomain(field),integer=field.kind==='integer';
 return <div className="pp-parameter-rail"><div>{integer&&<button type="button" className="pp-pet-icon-button" disabled={disabled||n<=field.min!} aria-label={`减小${field.label}`} onClick={()=>onChange(String(n-1))}><Minus size={18}/></button>}<input type="range" aria-label={field.label+suffix} aria-valuetext={String(n)} min={domain.min} max={domain.max} step={domain.step} value={toSlider(field,n)} disabled={disabled} onChange={e=>onChange(String(fromSlider(field,Number(e.target.value))))}/>{integer&&<button type="button" className="pp-pet-icon-button" disabled={disabled||n>=field.max!} aria-label={`增大${field.label}`} onClick={()=>onChange(String(n+1))}><Plus size={18}/></button>}</div>{logarithmic(field)&&<span>对数刻度 · 拖动一个数量级，数值变化10倍</span>}</div>;
}
