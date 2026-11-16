"use client";
import {useId} from 'react';
export type PetMood='idle'|'wave'|'thinking'|'happy'|'feed'|'orbit'|'sleep';
export default function PetAvatar({mood='idle',motion=true}:{mood?:PetMood;motion?:boolean}){
 const id=useId().replaceAll(':','');
 return <svg className="pp-pet-avatar" data-mood={mood} data-motion={motion} viewBox="0 0 180 195" aria-hidden="true">
  <defs><radialGradient id={id+'face'} cx="36%" cy="25%" r="80%"><stop stopColor="#fff7e9"/><stop offset="1" stopColor="#e6c9ac"/></radialGradient><linearGradient id={id+'suit'} x2="1" y2="1"><stop stopColor="#e0f4e6"/><stop offset="1" stopColor="#83b7a8"/></linearGradient><radialGradient id={id+'glass'} cx="26%" cy="18%" r="88%"><stop stopColor="#fff" stopOpacity=".28"/><stop offset=".76" stopColor="#e3f4ff" stopOpacity=".03"/><stop offset="1" stopColor="#afbedf" stopOpacity=".42"/></radialGradient></defs>
  <ellipse className="pp-pet-shadow" cx="90" cy="180" rx="48" ry="7" fill="#182c39" opacity=".11"/>
  <g className="pp-pet-body">
   <path d="M123 140q33-8 22-26" stroke="#ead0b4" strokeWidth="15" strokeLinecap="round" fill="none"/>
   <rect x="53" y="111" width="76" height="51" rx="19" fill="#a89cc1"/>
   <g className="pp-pet-leg left"><path d="M63 151l-4 18q0 9 17 6l9-17" fill="#dfebd9"/><ellipse cx="68" cy="173" rx="17" ry="8" fill="#d7ad7e"/></g>
   <g className="pp-pet-leg right"><path d="M96 155l3 16q2 8 19 4l-2-23" fill="#dfebd9"/><ellipse cx="110" cy="173" rx="17" ry="8" fill="#d7ad7e"/></g>
   <path d="M58 115q32-18 65 0v35q-7 17-32 17-30-1-33-18Z" fill={`url(#${id}suit)`}/>
   <path d="M58 126h66" stroke="#f5f5e6" strokeWidth="9"/>
   <rect x="72" y="130" width="36" height="27" rx="9" fill="#fff9e7"/><path d="M81 147v-10l9 8 9-8v10" fill="none" stroke="#7d67a2" strokeWidth="3" strokeLinejoin="round"/><circle cx="112" cy="139" r="3" fill="#e2b665"/>
   <g className="pp-pet-arm left"><path d="M60 126q-17 8-20 24" fill="none" stroke="#a8cebc" strokeWidth="17" strokeLinecap="round"/><circle cx="39" cy="152" r="11" fill="#f2ddc3"/></g>
   <g className="pp-pet-arm right"><path d="M122 126q18 2 20-12" fill="none" stroke="#a8cebc" strokeWidth="17" strokeLinecap="round"/><circle cx="143" cy="112" r="11" fill="#f2ddc3"/></g>
   <g className="pp-pet-head">
    <path d="M85 16V7" stroke="#a99bbf" strokeWidth="3"/><circle cx="85" cy="6" r="5" fill="#e5bc70"/>
    <circle cx="89" cy="70" r="60" fill="#edf4fb" fillOpacity=".28" stroke="#cabfdb" strokeWidth="3"/>
    <path d="M46 65L44 29q2-10 25 8m43 0q23-18 25-8l-2 36" fill={`url(#${id}face)`}/>
    <path d="M50 48l1-13 13 9m54 0 12-9v13" fill="#e8b6a2"/>
    <ellipse cx="90" cy="75" rx="46" ry="40" fill={`url(#${id}face)`}/>
    <path d="M82 37l4 11m8-10 3 9" stroke="#deb18c" strokeWidth="4" strokeLinecap="round"/>
    <g className="pp-pet-eyes"><ellipse cx="74" cy="74" rx="5" ry="6" fill="#664c48"/><ellipse cx="107" cy="74" rx="5" ry="6" fill="#664c48"/><circle cx="75" cy="72" r="1.5" fill="white"/><circle cx="108" cy="72" r="1.5" fill="white"/></g>
    <g className="pp-pet-sleep-eyes" fill="none" stroke="#71554e" strokeWidth="3" strokeLinecap="round"><path d="M68 75q6 5 12 0m21 0q6 5 12 0"/></g>
    <ellipse cx="61" cy="88" rx="7" ry="4" fill="#e7ac9e" opacity=".62"/><ellipse cx="120" cy="88" rx="7" ry="4" fill="#e7ac9e" opacity=".62"/>
    <path d="M86 83q4-4 8 0l-4 4Z" fill="#a37b68"/><path className="pp-pet-mouth" d="M80 92q10 11 20 0" fill="none" stroke="#9b6c5c" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M43 82l-9-2m10 10-8 2m102-10 9-2m-10 10 8 2" stroke="#cba688" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="89" cy="70" r="60" fill={`url(#${id}glass)`}/><path d="M44 43q7-16 27-20" stroke="white" strokeOpacity=".7" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <rect x="27" y="65" width="13" height="30" rx="6" fill="#b8a9ca"/><rect x="137" y="65" width="13" height="30" rx="6" fill="#b8a9ca"/>
    <path d="M55 119q35 17 70 0" stroke="#b0c7bd" strokeWidth="8" fill="none" strokeLinecap="round"/>
   </g>
  </g>
  <g className="pp-pet-orbit" fill="none" stroke="#b5a3cd" opacity=".55"><ellipse cx="90" cy="176" rx="70" ry="13"/><circle cx="158" cy="172" r="4" fill="#e6c17f" stroke="none"/></g>
  <path className="pp-pet-star" d="M152 130l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#edc66b"/>
  <g className="pp-pet-thought" fill="#b4a2cf"><circle cx="145" cy="26" r="3"/><circle cx="155" cy="21" r="3"/><circle cx="165" cy="16" r="3"/></g>
 </svg>;
}
