import {api} from './experiment';
import type {Inspection} from './planet';
export async function cachedInspection(run:string,row?:string,target=0,feature=0,signal?:AbortSignal){
 const query=new URLSearchParams({target:String(target),feature:String(feature)});if(row)query.set('row',row);
 const value=await api<{available:boolean;inspection:Inspection|null}>(`/lab/runs/${run}/inspection?${query}`,undefined,signal);
 return value.available?value.inspection:null;
}
