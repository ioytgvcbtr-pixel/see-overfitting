/** Original decorative scenes. Geometry never encodes experiment scores. */
export default function DatasetScene({id}:{id:string}){
 const type=id==='auto_raw'?'auto':id;
 return <svg className={`pp-dataset-scene scene-${type}`} viewBox="0 0 280 160" aria-hidden="true">
  <ellipse cx="142" cy="130" rx="100" ry="13" fill="currentColor" opacity=".09"/>
  <path d="M31 54q45-42 91-20t100 1q43 20 18 57t-99 30q-100 14-110-68" fill="currentColor" opacity=".055"/>
  <ellipse cx="141" cy="86" rx="108" ry="40" transform="rotate(-14 141 86)" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".18"/><g className="pp-scene-spark" stroke="currentColor" strokeWidth="2" opacity=".4"><path d="M36 35v10m-5-5h10M235 65v10m-5-5h10"/><circle cx="221" cy="26" r="4" fill="none"/><circle cx="49" cy="103" r="3" fill="none"/></g>
  {type==='penguins'?<>
   <path d="M66 123l25-15 95 2 30 15-71 14Z" fill="#d4ecea"/>
   {[105,168].map((x,i)=><g key={x} transform={`translate(${x} ${i?15:0})`}><ellipse cx="0" cy="77" rx="24" ry="39" fill="#304959"/><ellipse cx="0" cy="87" rx="17" ry="28" fill="#fffefa"/><ellipse cx="-8" cy="60" rx="7" ry="10" fill="#fffefa"/><ellipse cx="8" cy="60" rx="7" ry="10" fill="#fffefa"/><circle cx="-7" cy="61" r="2" fill="#304959"/><circle cx="7" cy="61" r="2" fill="#304959"/><path d="M-5 68H5L0 74Z" fill="#edb66c"/><path d="M-20 112h15m10 0h15" stroke="#edb66c" strokeWidth="6" strokeLinecap="round"/><path d="M-22 72l-12 23m56-23 12 23" stroke="#304959" strokeWidth="8" strokeLinecap="round"/></g>)}
  </>:type==='iris'||type==='seeds'?<>
   <path d="M98 125Q91 72 113 45M141 128V31M180 125q-5-61-16-75" stroke="#4e8873" fill="none" strokeWidth="5" strokeLinecap="round"/>
   {type==='iris'?[113,141,167].map((x,i)=><g key={x} transform={`translate(${x} ${i===1?40:66})`} fill={i===1?'#ba92d0':'#d0b7e1'}>{[0,72,144,216,288].map(a=><ellipse key={a} cy="-12" rx="10" ry="16" transform={`rotate(${a})`}/>)}<circle r="7" fill="#f4cb77"/></g>):[113,141,164].map((x,i)=><g key={x} transform={`translate(${x} ${i===1?39:57})`} fill="#d4ad66">{[0,1,2,3].map(j=><g key={j}><ellipse cx="-7" cy={j*13} rx="5" ry="10" transform={`rotate(-30 -7 ${j*13})`}/><ellipse cx="7" cy={j*13} rx="5" ry="10" transform={`rotate(30 7 ${j*13})`}/></g>)}</g>)}
   <path d="M99 110q-32-25-37-8 1 18 39 18m43-27q27-27 38-12-7 23-38 23" fill="#92b99d"/>
  </>:type==='banknote'?<>
   <rect x="65" y="49" width="154" height="81" rx="14" fill="#d1e7d7" transform="rotate(-8 140 90)"/><rect x="56" y="36" width="154" height="81" rx="14" fill="#f5fbf3" stroke="currentColor" strokeWidth="2"/><rect x="67" y="47" width="132" height="59" rx="9" fill="none" stroke="currentColor" opacity=".3" strokeDasharray="3 4"/><circle cx="132" cy="77" r="21" fill="currentColor" opacity=".12"/><path d="M85 64h12m-12 24h12m68-24h12m-12 24h12" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M124 77l6 6 12-14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </>:type==='wine'?<>
   <path d="M93 32h20v24q0 10 13 20v50H80V76q13-10 13-20Z" fill="#5d536b"/><rect x="91" y="23" width="24" height="14" rx="4" fill="#b99473"/><rect x="87" y="84" width="32" height="30" rx="4" fill="#f5eee0"/><path d="M160 47h39v31q-1 18-20 18t-19-18Zm19 50v28m-14 0h28" fill="#fffafc" stroke="#baa4b2" strokeWidth="3"/><path d="M162 69h35v10q-2 14-18 14-16-1-17-14Z" fill="#bc8095"/>
   <g fill="#a397bc">{[[221,98],[211,106],[231,108],[220,117]].map(([x,y])=><circle key={x+':'+y} cx={x} cy={y} r="7"/>)}</g><path d="M218 90q-2-14 14-14-2 15-14 14" fill="#96b98d"/>
  </>:type==='auto'?<>
   <path d="M43 126h194" stroke="currentColor" strokeWidth="2" opacity=".18" strokeDasharray="12 7"/><path d="M67 95l18-33q5-8 17-8h60q11 0 18 11l17 26 19 10v22H61v-21Z" fill="#b6cddb"/><path d="M101 61h25v31H83Zm33 0h26q8 1 12 8l13 23h-51Z" fill="#f2f9fb"/><circle cx="94" cy="120" r="15" fill="#4b596b"/><circle cx="183" cy="120" r="15" fill="#4b596b"/><circle cx="94" cy="120" r="7" fill="#dfe9ef"/><circle cx="183" cy="120" r="7" fill="#dfe9ef"/><path d="M70 105h10m116 0h10" stroke="#fff7da" strokeWidth="5" strokeLinecap="round"/>
  </>:type==='bike'?<>
   <g stroke="#596b78" strokeWidth="4" fill="none"><circle cx="87" cy="108" r="28"/><circle cx="194" cy="108" r="28"/></g><path d="M87 108l27-47 31 47H87l48-43h39l20 43M106 60h23m40 5-7-26h22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/><circle cx="144" cy="108" r="7" fill="#f2c87c"/>
  </>:type==='energy'?<>
   <path d="M72 123V69l62-41 65 41v54Z" fill="#f5e6c9"/><path d="M60 72l74-51 77 51" fill="none" stroke="#7a9cac" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/><rect x="124" y="91" width="24" height="33" rx="4" fill="#b39c8b"/>{[91,161].map(x=><g key={x}><rect x={x} y="76" width="21" height="22" rx="4" fill="#abcbd1"/><path d={`M${x+10} 77V97M${x} 87H${x+20}`} stroke="#f9fbf7" strokeWidth="2"/></g>)}<circle cx="220" cy="35" r="13" fill="#f0cd82"/><path d="M56 126q-17-34-25-20t25 20m150 0q24-40 33-23t-33 23" fill="#91b89a"/>
  </>:type==='concrete'?<>
   {[[83,102],[139,102],[111,62]].map(([x,y],i)=><g key={x+':'+y}><path d={`M${x} ${y-20}l25 13v33l-25 13-25-13v-33Z`} fill={i===2?'#c4d4d5':'#d9dfd8'}/><path d={`M${x-25} ${y-7}l25 13 25-13m-25 13v33`} fill="none" stroke="#91a8aa" strokeWidth="2"/></g>)}<path d="M195 114l15-44 17 44Z" fill="#dbab7e"/><path d="M202 96h18m-24 19h31" stroke="#fff8e7" strokeWidth="5"/>
  </>:<>
   {[[85,66],[153,47],[187,109]].map(([x,y],i)=><g key={x}><rect x={x-20} y={y-20} width="40" height="40" rx="13" fill={['#b6d9d2','#cbb9e6','#edc8a9'][i]}/><path d={`M${x-9} ${y}l6 6 12-13`} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"/></g>)}<path d="M106 65l25-12m24 14 21 24m-68-10 59 23" fill="none" stroke="currentColor" strokeDasharray="4 5" opacity=".4"/>
  </>}
 </svg>;
}
