export type ResetScope='progress'|'all';
export const archiveGenerationKey='modelplanet-archive-generation-v1';
export const archiveChanging='modelplanet-archive-changing';
export const archiveNoticeKey='modelplanet-archive-notice-v1';
const exact=new Set(['modelplanet-draft-v1','modelplanet-last-run','modelplanet-last-quiz','modelplanet-pinned','modelplanet-practice-origin-v1','modelplanet-mechanism-return',
 'fitlab-classification-session-v1','fitlab-concept-session-v1','fitlab-bench-records','fitlab-bench-session-v1','fitlab-test-exposure','fitlab-current-scene-v1',
 'fitlab-learning-completed-v1','fitlab-learning-attempt-v1','fitlab-learning-draft-v1','fitlab-island-progress-v1','fitlab-island-intro-v13','fitlab-class-play-v1','fitlab-class-reference-v1']);
const patterns=[/^modelplanet-mechanism-[a-z0-9_]+-v1$/,/^modelplanet-scene-(neighbor|coefficient)-[a-z0-9_-]{1,150}$/,/^fitlab-island-(learning-v13|draft-v14)-[a-z0-9_-]{1,60}$/];
const modelKeys=new Set(['modelplanet-draft-v1','modelplanet-last-run','modelplanet-last-quiz','modelplanet-pinned','fitlab-bench-records','fitlab-bench-session-v1','fitlab-test-exposure']);
type Store=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
export const learningStorageKey=(key:string)=>exact.has(key)||patterns.some(p=>p.test(key));
function keys(storage:Store){return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((v):v is string=>v!==null);}
export function collectLearningState(storage:Store){return Object.fromEntries(keys(storage).filter(learningStorageKey).map(key=>[key,storage.getItem(key)!]));}
export function clearLearningState(storage:Store,scope:ResetScope){
 for(const key of keys(storage))if(learningStorageKey(key)&&(scope==='all'||!modelKeys.has(key)&&!/^modelplanet-(mechanism-[a-z0-9_]+-v1|scene-)/.test(key)))storage.removeItem(key);
 storage.removeItem('modelplanet-study-outbox-v1');
}
export function restoreLearningState(storage:Store,value:Record<string,string>){for(const [key,text] of Object.entries(value))if(learningStorageKey(key)&&typeof text==='string')storage.setItem(key,text);}
