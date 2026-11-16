export type TaskMeta={task:string;targets:{classes?:string[]}[];time_column?:string|null;count_target?:boolean};
export function taskKinds(d:TaskMeta):string[]{
 if(d.task==='classification')return [d.targets.length>1?'多标签':d.targets[0]?.classes?.length===2?'二分类':'多分类'];
 return [d.targets.length>1?'多目标':'单目标',...(d.time_column?['时间顺序']:[]),...(d.count_target?['计数']:[])];
}
export function taskKindLabel(d:TaskMeta):string{return d.task==='classification'?taskKinds(d)[0]:d.time_column?`时间顺序${d.count_target?' · 计数':''}`:d.count_target?'计数回归':d.targets.length>1?'多目标回归':'单目标回归';}
export function modelMatches(model:{id:string;title:string;family:string;summary:string},query:string){const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);const text=[model.id,model.title,model.family,model.summary].join(' ').toLocaleLowerCase();return terms.every(t=>text.includes(t));}
