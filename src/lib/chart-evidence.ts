export type SeriesPoint={x:number;y:number|null};
export function plotDomain(values:number[],includeZero=false):[number,number]{
 const valid=values.filter(Number.isFinite);if(includeZero)valid.push(0);if(!valid.length)return [0,1];
 const lo=Math.min(...valid),hi=Math.max(...valid),pad=Math.max(hi-lo,Math.abs(lo)*.05,.1)*.08;
 return [lo-pad,hi+pad];
}
export function seriesPath(points:SeriesPoint[],x:(v:number)=>number,y:(v:number)=>number,sortX=false){
 let connected=false;return (sortX?[...points].sort((a,b)=>a.x-b.x):points).map(p=>{if(!Number.isFinite(p.x)||p.y===null||!Number.isFinite(p.y)){connected=false;return '';}
  const segment=`${connected?'L':'M'}${x(p.x)} ${y(p.y)}`;connected=true;return segment;
 }).filter(Boolean).join(' ');
}
