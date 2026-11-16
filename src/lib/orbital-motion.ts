export type PlanetMood='idle'|'wave'|'thinking'|'happy'|'feed'|'orbit'|'sleep';
export const orbitCenter={x:100,y:115,rx:78,ry:24};
export function orbitalFrame(phase:number,clock:number,mood:PlanetMood,age:number){
 const a=((phase%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
 const base=Math.sin(clock*1.2)*2.2;
 const envelope=Math.exp(-Math.max(0,age)*1.2);
 return {x:orbitCenter.x+orbitCenter.rx*Math.cos(a),y:orbitCenter.y+orbitCenter.ry*Math.sin(a),front:Math.sin(a)>=0,
  bob:mood==='sleep'?base*.4:mood==='happy'?base-4*Math.sin(age*8)**2*envelope:base,
  roll:mood==='wave'?Math.sin(age*6)*3*envelope:mood==='thinking'?-2+Math.sin(clock)*.7:mood==='sleep'?3:0,
  scale:mood==='happy'?1+.025*Math.sin(age*8)**2*envelope:1,
  blink:(()=>{const p=(clock%6.2)/6.2;return p>.91&&p<.96?1-.94*Math.sin((p-.91)/.05*Math.PI):1;})(),
  feed:Math.min(1,Math.max(0,age/1.4))};
}
export const orbitSpeed=(mood:PlanetMood)=>mood==='orbit'?3.2:mood==='thinking'?1.35:mood==='sleep'?.3:1;
