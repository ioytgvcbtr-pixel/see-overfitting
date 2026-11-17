import {api} from './experiment';
import {archiveChanging,archiveGenerationKey,archiveNoticeKey,clearLearningState,restoreLearningState,type ResetScope} from './archive-storage';
export type ArchiveSummary={lessons_started:number;lessons_completed:number;mechanisms_completed:number;model_runs:number;events:number};
export type ArchiveStatus={generation:string;scope:ResetScope;has_previous:boolean};
export type ArchivePackage={format:'modelplanet-learning-archive';version:1;created_at:string;client_state:Record<string,string>;knowledge:unknown;models:unknown;mechanisms:unknown};
export type ArchiveResult={generation:string;scope:ResetScope;summary:ArchiveSummary;client_state:Record<string,string>;recompute_required:boolean};
export function activateArchive(result:ArchiveResult,notice:string){
 window.dispatchEvent(new Event(archiveChanging));
 clearLearningState(localStorage,result.scope);restoreLearningState(localStorage,result.client_state);
 sessionStorage.setItem(archiveNoticeKey,notice);localStorage.setItem(archiveGenerationKey,result.generation);
 location.hash='#classroom/experiments';location.reload();
}
export function installArchiveSync(){
 let live=true;
 void api<ArchiveStatus>('/learning-archive/status').then(status=>{if(!live)return;const old=localStorage.getItem(archiveGenerationKey);
  if(old&&old!==status.generation){window.dispatchEvent(new Event(archiveChanging));clearLearningState(localStorage,status.scope);localStorage.setItem(archiveGenerationKey,status.generation);location.reload();}
  else localStorage.setItem(archiveGenerationKey,status.generation);
 }).catch(()=>{});
 const changed=(event:StorageEvent)=>{if(event.key===archiveGenerationKey&&event.oldValue&&event.newValue!==event.oldValue){window.dispatchEvent(new Event(archiveChanging));location.reload();}};
 window.addEventListener('storage',changed);return()=>{live=false;window.removeEventListener('storage',changed);};
}
export function downloadLearningArchive(value:ArchivePackage){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`模力星球-学习档案-${new Date().toLocaleDateString('sv-SE')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
