import Image from 'next/image';

export function PlanetLogo(){return <svg viewBox="0 0 64 64" role="img" aria-label="模力星球标识"><circle cx="32" cy="32" r="23" fill="#ede3fb"/><ellipse cx="32" cy="33" rx="30" ry="10" transform="rotate(-28 32 33)" fill="none" stroke="#a28acc" strokeWidth="2"/><path d="M19 41V24L32 36 45 24V41" fill="none" stroke="#7845b5" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/><circle cx="9" cy="42" r="4" fill="#eeb16b"/><circle cx="49" cy="15" r="4" fill="#65ad9a"/></svg>;}

export function ModelGlyph({kind,size=46}:{kind:string;size?:number}){
 return <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden="true" className={`pp-model-glyph glyph-${kind}`}><rect width="60" height="60" rx="18" fill="currentColor" opacity=".09"/>
 {kind==='linear'?<><path d="M12 45L48 16" stroke="currentColor" strokeWidth="3"/><circle cx="17" cy="36" r="3" fill="currentColor"/><circle cx="32" cy="33" r="3" fill="currentColor"/><circle cx="44" cy="18" r="3" fill="currentColor"/></>:
 kind==='neighbors'?<><circle cx="30" cy="30" r="16" fill="none" stroke="currentColor" strokeDasharray="4 3"/>{[[30,30],[20,24],[37,21],[38,38],[20,40]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i?3:5} fill="currentColor" opacity={i?.6:1}/>)}</>:
 kind==='gaussian'?<path d="M9 45C19 45 19 16 30 16S41 45 51 45M10 47H50" fill="none" stroke="currentColor" strokeWidth="3"/>:
 kind==='boundary'?<><path d="M12 44C40 47 15 13 48 16" stroke="currentColor" strokeWidth="3" fill="none"/>{[[18,17],[19,28],[42,33],[44,44]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4" fill="currentColor" opacity={i<2?.4:1}/>)}</>:
 <><path d={kind==='forest'?'M18 45V27M43 45V23M9 27L18 12 28 27ZM33 25L43 9 53 25Z':kind==='boosting'?'M10 45H21V32H32V23H43V12H52':'M30 12V26M14 45V34L30 26 46 34V45'} stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>{kind==='tree'&&[14,46,30].map((x,i)=><circle key={x} cx={x} cy={i===2?12:45} r="4" fill="currentColor"/>)}</>}
 </svg>;
}

export function PlanetMap({onSelect}:{onSelect:(task:'classification'|'regression')=>void}){
 return <div className="pp-world" aria-label="两条机器学习探索航线"><svg className="pp-world-orbit" viewBox="0 0 640 380" aria-hidden="true"><ellipse cx="320" cy="210" rx="270" ry="122" fill="#eef4f2"/><path d="M83 266C192 42 423 365 561 116" stroke="#d6c5e8" strokeWidth="3" fill="none" strokeDasharray="6 9"/>{[[73,81],[579,311],[431,44],[310,327]].map(([x,y],i)=><path key={i} d={`M${x-5} ${y}h10M${x} ${y-5}v10`} stroke="#c2b3dc" strokeWidth="2"/>)}<path d="M290 220q30 -50 60 0q-30 18 -60 0" fill="#ddd2eb"/></svg>
 <button className="pp-island pp-classify" onClick={()=>onSelect('classification')}><Image src="/illustrations/world-v09/island-classification-v1.png" alt="边界森林与分类港" width={240} height={180} priority/><strong>分类港</strong><span>给样本找类别</span></button>
 <button className="pp-island pp-regress" onClick={()=>onSelect('regression')}><Image src="/illustrations/world-v09/island-regularization-v1.png" alt="系数花园与回归谷" width={240} height={180} priority/><strong>回归谷</strong><span>预测一个数</span></button>
 <span className="pp-map-note">从一个决定，走到一次真实训练。</span></div>;
}

export function SmallGuide({children}:{children:React.ReactNode}){return <div className="pp-guide"><Image src="/illustrations/companion-v12/guide-thinking-v1.png" alt="小模学习向导" width={68} height={68}/><p>{children}</p></div>;}
