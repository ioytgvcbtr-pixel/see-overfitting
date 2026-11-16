"use client";
import {useEffect,useId,useRef} from 'react';
import {orbitalFrame,orbitSpeed,type PlanetMood} from '@/lib/orbital-motion';
export type PetMood=PlanetMood;
export default function PetAvatar({mood='idle',motion=true}:{mood?:PetMood;motion?:boolean}){
 const id=useId().replaceAll(':',''),root=useRef<SVGSVGElement|null>(null),rig=useRef<SVGGElement|null>(null),front=useRef<SVGGElement|null>(null),back=useRef<SVGGElement|null>(null),eyes=useRef<SVGGElement|null>(null),starlight=useRef<SVGGElement|null>(null);
 const paint=useRef<()=>void>(()=>{});
 const state=useRef({phase:0,clock:0,speed:1,mood,age:0});
 useEffect(()=>{state.current.mood=mood;state.current.age=0;paint.current();},[mood]);
 useEffect(()=>{
  let frame=0,last:number|null=null;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function draw(){const s=state.current,animated=root.current?.getAttribute('data-animating')==='true',f=orbitalFrame(s.phase,s.clock,s.mood,s.age);rig.current?.setAttribute('transform',animated?`translate(0 ${f.bob}) rotate(${f.roll} 100 103) translate(100 103) scale(${f.scale}) translate(-100 -103)`: "");
   front.current?.setAttribute('transform',`translate(${f.x} ${f.y})`);back.current?.setAttribute('transform',`translate(${f.x} ${f.y})`);
   if(front.current)front.current.style.opacity=f.front?'1':'0';if(back.current)back.current.style.opacity=f.front?'0':'1';
   eyes.current?.setAttribute('transform',animated?`translate(100 97) scale(1 ${f.blink}) translate(-100 -97)`:"");
   const p=1-(1-f.feed)**2;starlight.current?.setAttribute('transform',`translate(${168-64*p} ${48+47*p-18*Math.sin(p*Math.PI)}) scale(${1-.6*p})`);
   if(starlight.current)starlight.current.style.opacity=s.mood==='feed'?String(Math.sin(f.feed*Math.PI)): '0';
  }
  function tick(now:number){const dt=last===null?0:Math.min((now-last)/1000,.04);last=now;const s=state.current;s.clock+=dt;s.age+=dt;s.speed+=(orbitSpeed(s.mood)-s.speed)*Math.min(1,dt*3);s.phase+=dt*s.speed*Math.PI*2/8;draw();frame=requestAnimationFrame(tick);}
  function update(){cancelAnimationFrame(frame);last=null;const active=motion&&!reduce.matches&&!document.hidden;root.current?.setAttribute('data-animating',String(active));if(active)frame=requestAnimationFrame(tick);else{draw();rig.current?.setAttribute('transform','');eyes.current?.setAttribute('transform','');}}
  paint.current=draw;update();reduce.addEventListener('change',update);document.addEventListener('visibilitychange',update);return()=>{cancelAnimationFrame(frame);reduce.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
 },[motion]);
 const satellite=<><circle r="9" fill="#efcd87"/><circle cx="-2" cy="-2" r="5" fill="#fff1ca" opacity=".5"/><path d="M-3-3v6l3-2 3 2v-6Z" fill="none" stroke="#8a78ac" strokeWidth="1.4" strokeLinejoin="round"/></>;
 return <svg ref={root} className="pp-pet-avatar pp-learning-planet" data-mood={mood} data-motion={motion} viewBox="0 0 200 210" aria-hidden="true">
 <defs><radialGradient id={id+'globe'} cx="30%" cy="20%" r="82%"><stop stopColor="#f3efff"/><stop offset=".48" stopColor="#c6bfe7"/><stop offset="1" stopColor="#8a86be"/></radialGradient><radialGradient id={id+'light'}><stop stopColor="#ecd08b" stopOpacity=".34"/><stop offset="1" stopColor="#ecd08b" stopOpacity="0"/></radialGradient><clipPath id={id+'disc'}><circle cx="100" cy="103" r="56"/></clipPath></defs>
 <ellipse cx="100" cy="184" rx="47" ry="6" fill="#263743" opacity=".10"/>
 <g ref={rig} className="pp-orb-rig">
  <circle className="pp-orb-halo" cx="100" cy="103" r="80" fill={`url(#${id}light)`}/>
  <g transform="rotate(-14 100 115)"><ellipse cx="100" cy="115" rx="78" ry="24" fill="none" stroke="#b6a6d5" strokeWidth="6"/><g ref={back} transform="translate(178 115)" opacity="0">{satellite}</g></g>
  <circle cx="100" cy="103" r="56" fill={`url(#${id}globe)`}/>
  <g clipPath={`url(#${id}disc)`}><path d="M44 70q26-27 47-10t35-11q31-18 43 16-26 20-41 5T80 82Q60 95 44 70M47 137q32-26 46-8t43-3q24-10 24 19-25 31-60 19t-53-27" fill="#c8ddd1" opacity=".62"/><path d="M51 66q10-15 27-17" stroke="#fff9ff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".65"/><ellipse cx="128" cy="70" rx="9" ry="6" fill="#827eaf" opacity=".18"/><ellipse cx="128" cy="68" rx="7" ry="4" fill="#ede8fb" opacity=".52"/><circle cx="61" cy="116" r="5" fill="#7978a5" opacity=".14"/><circle cx="116" cy="146" r="7" fill="#7978a5" opacity=".14"/></g>
  <g ref={eyes} className="pp-orb-eyes"><ellipse cx="83" cy="97" rx="4.5" ry="6" fill="#48445f"/><ellipse cx="117" cy="97" rx="4.5" ry="6" fill="#48445f"/><circle cx="84" cy="95" r="1.4" fill="white"/><circle cx="118" cy="95" r="1.4" fill="white"/></g>
  <g className="pp-orb-closed-eyes" fill="none" stroke="#555067" strokeWidth="2.8" strokeLinecap="round"><path d="M77 99q6 5 12 0m22 0q6 5 12 0"/></g>
  <ellipse cx="73" cy="109" rx="7" ry="3.5" fill="#e3b8bd" opacity=".65"/><ellipse cx="127" cy="109" rx="7" ry="3.5" fill="#e3b8bd" opacity=".65"/>
  <path className="pp-orb-smile" d="M91 112q9 10 18 0" fill="none" stroke="#696078" strokeWidth="2.6" strokeLinecap="round"/>
  <ellipse className="pp-orb-thinking-mouth" cx="101" cy="114" rx="3" ry="3.8" fill="#77708b"/>
  <g transform="rotate(-14 100 115)"><path d="M22 115A78 24 0 0 0 178 115" fill="none" stroke="#ecc6ab" strokeWidth="7" strokeLinecap="round"/><path d="M31 124q65 32 131 0" fill="none" stroke="#fff0da" opacity=".38" strokeWidth="2"/><g ref={front} transform="translate(178 115)">{satellite}</g></g>
  <g className="pp-orb-signal" fill="#b5a3cd"><circle cx="89" cy="29" r="3"/><circle cx="101" cy="25" r="3"/><circle cx="113" cy="29" r="3"/></g>
  <path className="pp-orb-spark" d="M49 47l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#e8c57c"/>
  <g ref={starlight} opacity="0"><path d="M0-10l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#edce87"/></g>
 </g></svg>;
}
