export type CompanionPreferences={enabled:boolean;motion:boolean;quiet:boolean;share_context:boolean;save_history:boolean;answer_style:'concise'|'detailed';reader_size:'normal'|'large'};
export const defaultCompanion:CompanionPreferences={enabled:true,motion:true,quiet:false,share_context:true,save_history:true,answer_style:'concise',reader_size:'normal'};
export function companionPreferences(value:string|null):CompanionPreferences{
 try{const p=JSON.parse(value||'{}');return {...defaultCompanion,...Object.fromEntries(Object.keys(defaultCompanion).filter(k=>typeof defaultCompanion[k as keyof CompanionPreferences]==='boolean'?typeof p[k]==='boolean':k==='answer_style'?['concise','detailed'].includes(p[k]):k==='reader_size'?['normal','large'].includes(p[k]):false).map(k=>[k,p[k]]))};}catch{return {...defaultCompanion};}
}
export type PetContext={view:string;lesson_id:string|null;run_id:string|null;draft_changed:boolean};
export type PetAction={type:'lesson'|'run';id:string;label:string};
export type PetMessage={id:string;session_id:string;question:string;answer:string|null;state:string;created_at:string;completed_at?:string;mode?:'online'|'rules'|'guided';notice?:string;model?:string;context_label:string;actions?:PetAction[];reasoning_effort?:string;provider_effort?:string;usage?:{total_tokens?:number}};
