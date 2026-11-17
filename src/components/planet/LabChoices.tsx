"use client";
import {useId} from 'react';
export default function LabChoices({legend,choices,value,onChange,name,disabled=false}:{legend:string;choices:string[];value:number|null;onChange:(n:number)=>void;name:string;disabled?:boolean}){
 const id=useId();
 return <fieldset className="pp-lab-choices" disabled={disabled}><legend>{legend}</legend><div>{choices.map((text,i)=><label key={text} htmlFor={`${id}-${i}`}><input id={`${id}-${i}`} name={name} type="radio" value={i} required checked={value===i} onChange={()=>onChange(i)}/><span>{text}</span></label>)}</div></fieldset>;
}
