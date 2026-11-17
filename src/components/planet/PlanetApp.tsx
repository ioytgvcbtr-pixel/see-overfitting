"use client";
import {useEffect,useRef,useState,useCallback,type CSSProperties} from 'react';
import dynamic from 'next/dynamic';
import PlanetPortal from './PlanetPortal';
import {readClassroomLocation,classroomHash,workshopSections,palettes,readPalette,contextPalette,type ClassroomView,type PalettePreference} from '@/lib/classroom';
import type {AppView} from '@/lib/navigation';
import {Palette as PaletteIcon,Lightbulb,Leaf,ArrowLeft,Settings2} from 'lucide-react';
import {BookOpen,Compass,Database,FlaskConical,History,LoaderCircle,Menu,ArrowRight,Bird,Wheat,Wine,Car,Building2,Bike,Blocks,Stamp,Flower2,Shapes} from 'lucide-react';
import {api} from '@/lib/experiment';
import {buildSpec,freshDraft,fromSpec,waitJob,stableKey,type AnalysisJob,type Catalog,type Dataset,type Draft,type Job,type Model} from '@/lib/planet';
import {PlanetLogo,PlanetMap,ModelGlyph,SmallGuide} from './PlanetArt';
import PlanetWorkbench from './PlanetWorkbench';
import PlanetHistory from './PlanetHistory';
import LearningPath from './LearningPath';
import MechanismMap from './MechanismMap';
import {useStudyJournal,type StudyOverview,type Lesson} from '@/lib/study';
import type {WorkspaceEntry} from '@/lib/workspace';
import type {ConceptPanel} from '@/lib/concepts';
import HelpHint from '../HelpHint';
import DatasetScene from './DatasetScene';
import {modelMatches,taskKinds,taskKindLabel} from '@/lib/learning-flow';
import {Search,X} from 'lucide-react';
import PlanetSettings from './PlanetSettings';
import ModelMechanism from './ModelMechanism';
import {mechanismDataset} from '@/lib/model-mechanism';
import PetCompanion from './PetCompanion';
import {defaultCompanion,companionPreferences,type CompanionPreferences,type PetAction,type PetContext,type MechanismEvidence} from '@/lib/companion';

type View=ClassroomView;
const MechanismLab=dynamic(()=>import('../LegacyLab'),{loading:()=> <div className="pp-loading" role="status">正在准备机制实验…</div>});
const navigation=[{id:'start',label:'开始学习',icon:Compass},{id:'learning',label:'学习航线',icon:BookOpen},{id:'classification',label:'分类任务',icon:Database},{id:'regression',label:'回归任务',icon:FlaskConical},{id:'models',label:'模型图鉴',icon:BookOpen},{id:'mechanisms',label:'模型机制工坊',icon:Lightbulb},{id:'experiments',label:'我的学习记录',icon:History},{id:'settings',label:'设置',icon:Settings2}] as const;
const STORE='modelplanet-draft-v1';
const datasetIcons:Record<string,typeof Bird>={penguins:Bird,banknote:Stamp,iris:Flower2,seeds:Wheat,concrete:Blocks,wine:Wine,auto_raw:Car,auto:Car,energy:Building2,bike:Bike,labels:Shapes};

export default function PlanetApp({initialMechanism=false}:{initialMechanism?:boolean}){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[view,setView]=useState<View>(initialMechanism?'mechanisms':'start'),[mobile,setMobile]=useState(false);
 const [draft,setDraft]=useState<Draft|null>(null),[step,setStep]=useState(0),[run,setRun]=useState<Job|null>(null),[job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(false),[pinned,setPinned]=useState<string|null>(null);
 const [health,setHealth]=useState<{ai_configured:boolean}|null>(null),[saved,setSaved]=useState(false),[filter,setFilter]=useState('all');
 const [mechanism,setMechanism]=useState<AppView>('explore'),[mechanismVisited,setMechanismVisited]=useState(initialMechanism),[palettePreference,setPalettePreference]=useState<PalettePreference>('auto');
 const [study,setStudy]=useState<StudyOverview|null>(null),[selectedLesson,setSelectedLesson]=useState<string|null>(null),[topicRequest,setTopicRequest]=useState<{panel:ConceptPanel;serial:number}|null>(null),[resumeRequest,setResumeRequest]=useState<{entry:WorkspaceEntry;serial:number}|null>(null);
 const [mechanismEvidence,setMechanismEvidence]=useState<MechanismEvidence|null>(null);const receiveMechanismEvidence=useCallback((v:MechanismEvidence)=>setMechanismEvidence(v),[]);
 const [mechanismModel,setMechanismModel]=useState<string|null>(null);const mechanismReturn=useRef<View>('models');
 const [recordTab,setRecordTab]=useState('knowledge'),[practiceOrigin,setPracticeOrigin]=useState<string|null>(null),[dataKind,setDataKind]=useState('全部'),[modelQuery,setModelQuery]=useState('');
 useEffect(()=>{const value=localStorage.getItem('modelplanet-practice-origin-v1');if(value&&/^[a-z0-9-]{1,60}$/.test(value))setPracticeOrigin(value);const back=localStorage.getItem('modelplanet-mechanism-return');if(['learning','models','workbench'].includes(back||''))mechanismReturn.current=back as View;},[]);
 function rememberOrigin(id:string|null){setPracticeOrigin(id);if(id)localStorage.setItem('modelplanet-practice-origin-v1',id);else localStorage.removeItem('modelplanet-practice-origin-v1');}
 const [petPreferences,setPetPreferences]=useState<CompanionPreferences>(defaultCompanion),[petOpen,setPetOpen]=useState(false);
 const previousPage=useRef<{view:View;section:AppView;lesson:string|null}>({view:'learning',section:'explore',lesson:null});
 function changePetPreferences(p:CompanionPreferences){setPetPreferences(p);try{localStorage.setItem('modelplanet-companion-v1',JSON.stringify(p));localStorage.setItem('fitlab-companion-motion-v1',p.motion&&!p.quiet?'on':'off');window.dispatchEvent(new Event('fitlab-companion-preference'));}catch{}if(!p.enabled)setPetOpen(false);}
 function refreshHealth(){void api<{ai_configured:boolean}>('/health').then(setHealth).catch(()=>{});}
 const journal=useStudyJournal();
 function refreshStudy(){void api<StudyOverview>('/study/overview').then(setStudy).catch(e=>setError(e.message));}
 useEffect(()=>{refreshStudy();const changed=()=>refreshStudy();window.addEventListener('modelplanet-study-changed',changed);window.addEventListener('fitlab-workspace-changed',changed);return()=>{window.removeEventListener('modelplanet-study-changed',changed);window.removeEventListener('fitlab-workspace-changed',changed);};},[view]);
 const controller=useRef<AbortController|null>(null),generation=useRef(0),ready=useRef(false);
 function refresh(){void api<Catalog>('/lab/catalog').then(c=>{setCatalog(c);setError('');}).catch(e=>setError(e.message));}
 useEffect(()=>{
  const applyLocation=()=>{const state=readClassroomLocation(location.hash,initialMechanism);setView(state.view==='mechanisms'&&state.section==='history'?'experiments':state.view);if(state.section!=='history')setMechanism(state.section);setSelectedLesson(state.lesson||null);setMechanismModel(state.model||null);if(state.panel)setTopicRequest({panel:state.panel as ConceptPanel,serial:Date.now()});setMobile(false);if(state.view==='mechanisms')setMechanismVisited(true);};
  applyLocation();window.addEventListener('popstate',applyLocation);window.addEventListener('hashchange',applyLocation);
  setPalettePreference(readPalette(localStorage.getItem('modelplanet-palette-v1')));setPetPreferences(companionPreferences(localStorage.getItem('modelplanet-companion-v1')));
  refresh();void api<{ai_configured:boolean}>('/health').then(setHealth).catch(()=>{});
  try{const seen=new Set<string>();for(const key of ['fitlab-bench-session-v1','fitlab-bench-records','fitlab-test-exposure','fitlab-classification-session-v1']){const value=JSON.parse(localStorage.getItem(key)||'null');const rows=Array.isArray(value)?value:[value];for(const row of rows){const id=typeof row==='string'?row:row?.parameters?.dataset||row?.dataset;if(['wine','auto','concrete','iris','seeds'].includes(id))seen.add(id);}}if(seen.size)void api('/lab/legacy-exposure',{datasets:[...seen]}).catch(()=>{});}catch{}
  try{const d=JSON.parse(localStorage.getItem(STORE)||'null');if(d?.version===1&&d.draft&&Array.isArray(d.draft.features)&&d.draft.features.length<=50&&typeof d.draft.session==='string'){
    setDraft(d.draft);setStep(Math.max(0,Math.min(7,Number(d.step)||0)));setSaved(true);
  }setPinned(localStorage.getItem('modelplanet-pinned'));const id=localStorage.getItem('modelplanet-last-run');if(id&&/^[0-9a-f]{32}$/.test(id))void api<Job>('/lab/runs/'+id).then(async r=>{setRun(r);if(['queued','running'].includes(r.state)){const token=++generation.current;controller.current=new AbortController();setBusy(true);try{const done=await waitJob(r as AnalysisJob,v=>setJob(v as Job),controller.current.signal);if(token===generation.current)adopt(done as Job);}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}finally{if(token===generation.current)setBusy(false);}}}).catch(()=>{});
  }catch{}ready.current=true;return()=>{controller.current?.abort();window.removeEventListener('popstate',applyLocation);window.removeEventListener('hashchange',applyLocation);};
 },[]);
 useEffect(()=>{if(ready.current&&draft)try{localStorage.setItem(STORE,JSON.stringify({version:1,draft,step}));setSaved(true);}catch{setError('浏览器草稿没有保存，服务端已完成运行仍可在档案找回。');}},[draft,step]);
 function navigate(v:View,section:AppView=mechanism,lesson:string|null=null,panel:string|null=null,modelId:string|null=null){journal.flush();if(v==='settings')setPetOpen(false);if(v==='settings'&&view!=='settings')previousPage.current={view,section:mechanism,lesson:selectedLesson};setView(v);setMobile(false);setError('');setFilter('all');setDataKind('全部');setModelQuery('');if(v==='learning')setSelectedLesson(lesson);if(v==='mechanisms'){setMechanism(section);setMechanismVisited(true);}if(v==='model-mechanism')setMechanismModel(modelId);const hash=classroomHash(v,section,lesson,panel,modelId);if(location.hash!==hash)history.pushState(null,'',hash);window.scrollTo({top:0,behavior:'instant'});}
 function openMechanism(section:AppView='explore'){if(section==='settings'){navigate('settings');return;}if(section==='history'){setRecordTab('mechanisms');navigate('experiments');return;}navigate('mechanisms',section);}
 function openModelMechanism(id:string){const back=view==='workbench'?'workbench':view==='learning'?'learning':'models';mechanismReturn.current=back;localStorage.setItem('modelplanet-mechanism-return',back);if(back==='learning')rememberOrigin(selectedLesson);navigate('model-mechanism','explore',null,null,id);}
 function openLesson(id:string|null){navigate('learning',mechanism,id);}
 function openStation(id:string,entry?:WorkspaceEntry|null){if(entry){setResumeRequest({entry,serial:Date.now()});navigate('mechanisms',entry.kind==='course'||entry.kind==='saved'?'studio':id==='forest'?'classification':'concepts');}else if(id==='forest')navigate('mechanisms','classification');else{setTopicRequest({panel:id as ConceptPanel,serial:Date.now()});navigate('mechanisms','concepts',null,id);}}
 function practice(p:NonNullable<Lesson['practice']>){if(p.mechanism_model){openModelMechanism(p.mechanism_model);}else if(p.dataset){const d=catalog?.datasets.find(d=>d.id===p.dataset);if(d)start(d,catalog?.models.find(m=>m.id===p.model),selectedLesson);}else if(p.panel){rememberOrigin(selectedLesson);openStation(p.panel);}else navigate('models');}
 function changeDraft(next:Draft){if(draft&&draft.dataset===next.dataset)journal.edits(draft,next);setDraft(next);}
 function changeStep(n:number){if(draft)journal.step(draft,n);setStep(n);}
 function choosePalette(value:PalettePreference){setPalettePreference(value);try{localStorage.setItem('modelplanet-palette-v1',value);}catch{}}
 const lessonChapter=study?.chapters.find(c=>c.id===study.lessons.find(l=>l.id===selectedLesson)?.chapter);
 const currentPalette=palettePreference==='auto'?(view==='learning'&&lessonChapter&&Object.hasOwn(palettes,lessonChapter.palette)?lessonChapter.palette as keyof typeof palettes:contextPalette(view,draft?.task,step,mechanism)):palettePreference;
 const palette=palettes[currentPalette];
 const paletteStyle={'--pp-brand':palette.brand,'--pp-ink':palette.ink,'--pp-muted':palette.muted,'--pp-bg':palette.bg,'--pp-soft':palette.soft,'--pp-nav':palette.nav} as CSSProperties;

 function start(d:Dataset,model?:Model,origin:string|null=null){rememberOrigin(origin);generation.current++;controller.current?.abort();setBusy(false);setJob(null);const next=freshDraft(d);if(model){next.model=model.id;next.parameters=Object.fromEntries(model.parameters.map(f=>[f.key,'']));}setDraft(next);setRun(null);setStep(0);journal.step(next,0);navigate('workbench');}
 function pin(id:string){setPinned(id);localStorage.setItem('modelplanet-pinned',id);}
 function adopt(r:Job,takeDraft=false){setRun(r.result?{...r,spec:r.result.spec}:r);setJob(r);localStorage.setItem('modelplanet-last-run',r.id);if(takeDraft)setDraft(fromSpec(r.spec));}
 function load(r:Job){rememberOrigin(null);adopt(r,true);setStep(r.state==='completed'?5:4);navigate('workbench');}
 async function train(){
  if(!draft||!catalog)return;
  journal.flush();
  let spec;try{spec=buildSpec(draft,catalog.models);}catch(e){setError((e as Error).message);return;}
  const ticket=++generation.current;controller.current?.abort();controller.current=new AbortController();setBusy(true);setError('');
  try{const first=await api<Job>('/lab/runs',{spec,source_id:run?.id},controller.current.signal);setJob(first);localStorage.setItem('modelplanet-last-run',first.id);
   const done=await waitJob(first as AnalysisJob,v=>{if(ticket===generation.current)setJob(v as Job);},controller.current.signal);
   if(ticket===generation.current)adopt(done as Job);
  }catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}finally{if(ticket===generation.current)setBusy(false);}
 }
 function cancel(){if(job)void api('/lab/runs/'+job.id+'/cancel',{}).catch(e=>setError(e.message));}
 let petDraftChanged=false;
 if(view==='workbench'&&run?.result&&draft&&catalog){try{const plan=(spec:typeof run.spec)=>{const {prediction:_p,assisted:_a,session_id:_s,...conditions}=spec;return conditions;};petDraftChanged=stableKey(plan(buildSpec(draft,catalog.models)))!==stableKey(plan(run.result.spec));}catch{petDraftChanged=true;}}
 const activeDataset=catalog?.datasets.find(d=>d.id===draft?.dataset)||(run?.spec.dataset===draft?.dataset?run?.result?.dataset:undefined);
 const activeCatalog=catalog&&activeDataset&&!catalog.datasets.some(d=>d.id===activeDataset.id)?{...catalog,datasets:[...catalog.datasets,activeDataset]}:catalog;
 function shelf(task:'classification'|'regression'){
  const available=catalog!.datasets.filter(d=>d.task===task);const data=available.filter(d=>dataKind==='全部'||taskKinds(d).includes(dataKind));const kinds=task==='classification'?['全部','二分类','多分类','多标签']:['全部','单目标','多目标','时间顺序','计数'];
  return <><header className="pp-page-heading pp-shelf-heading"><div><span className="pp-breadcrumb">{task==='classification'?'给样本找类别':'预测一个数'}</span><h1>{task==='classification'?'从分类港，认出不同。':'去回归谷，预测未知。'}</h1><p>选一份数据，把清洗、划分和模型参数交给你自己决定。</p></div><PlanetPortal variant={task} className="pp-shelf-planet"/></header><div className="pp-task-filters" role="group" aria-label="课例类型">{kinds.map(k=><button key={k} aria-pressed={dataKind===k} onClick={()=>setDataKind(k)}>{k}</button>)}</div><div className="pp-task-grid">{data.map((d,i)=>{const TaskIcon=datasetIcons[d.id]||Database;return <button className="pp-task-card" key={d.id} onClick={()=>start(d)}><span className={`pp-task-art pp-art-${i%4}`}><DatasetScene id={d.id}/></span><span className="pp-task-kind">{taskKindLabel(d)}</span><h2>{d.title}</h2><p>{d.targets.map(t=>t.label).join('、')}</p><small>{d.rows}条 · {d.kind}</small><span className="pp-card-action">开始这堂实验<ArrowRight size={20}/></span></button>;})}</div></>;
 }
 const originLesson=study?.lessons.find(l=>l.id===practiceOrigin);
 const selectedModel=catalog?.models.find(m=>m.id===mechanismModel);
 const pageName=view==='learning'&&selectedLesson?study?.lessons.find(l=>l.id===selectedLesson)?.title:view==='model-mechanism'?selectedModel?.title:view==='workbench'?activeDataset?.title:undefined;
 const browserTitle=pageName||navigation.find(n=>n.id===view)?.label||'机器学习实验课堂';
 useEffect(()=>{document.title=`${browserTitle} · 模力星球`;},[browserTitle]);
 const visibleModels=catalog?.models.filter(m=>(filter==='all'||m.task===filter)&&modelMatches(m,modelQuery))||[];
 return <div className="planet-app" data-palette={currentPalette} data-pet-open={petOpen} data-pet-enabled={petPreferences.enabled} data-reader-size={petPreferences.reader_size} style={paletteStyle}><a className="pp-skip" href="#planet-content">跳到学习内容</a><aside className="pp-sidebar" data-open={mobile}><button onClick={()=>navigate('start')} className="pp-brand" aria-label="模力星球首页"><PlanetLogo/><span>模力星球<small>机器学习实验课堂</small></span></button><nav aria-label="模力星球主导航">{navigation.map(n=><button key={n.id} aria-current={view===n.id||n.id==='models'&&view==='model-mechanism'?'page':undefined} onClick={()=>navigate(n.id)}><n.icon size={21}/>{n.label}</button>)}</nav><div className="pp-sidebar-footer" data-pet={petPreferences.enabled}><span>{petPreferences.enabled?'和小模一起，探索下一站。':'让每次选择，都看见结果。'}</span></div></aside>
 {mobile&&<button className="pp-nav-backdrop" aria-label="收起导航" onClick={()=>setMobile(false)}/>}
 <div className="pp-main-shell"><header className="pp-topbar"><button className="pp-mobile-menu" aria-label="展开导航" onClick={()=>{setPetOpen(false);setMobile(v=>!v);}}><Menu size={22}/></button><strong>{view==='workbench'?'实验航线':view==='model-mechanism'?'模型机制实验':navigation.find(n=>n.id===view)?.label}</strong><span className="pp-spacer"/><span className="pp-ai-mode">{health?.ai_configured?'AI已配置':'规则教练'}</span><div className="pp-desktop-help"><HelpHint title="怎样开始"><p>选任务，明确目标，逐步填写数据处理、比例和参数。数字保持空白，只有你完成选择后才启动真实计算。</p></HelpHint></div>{petPreferences.enabled&&<PetCompanion open={petOpen} onOpen={setPetOpen} preferences={petPreferences} configured={!!health?.ai_configured} training={busy||view==='model-mechanism'&&!!mechanismEvidence?.busy} context={{view,lesson_id:view==='learning'?selectedLesson:null,model_id:view==='model-mechanism'?mechanismModel:null,run_id:view==='workbench'?run?.id||null:view==='model-mechanism'&&mechanismEvidence?.model_id===mechanismModel?mechanismEvidence.run_id:null,row_id:view==='model-mechanism'&&mechanismEvidence?.model_id===mechanismModel?mechanismEvidence.row_id:null,reference_run_id:view==='model-mechanism'&&mechanismEvidence?.model_id===mechanismModel?mechanismEvidence.reference_run_id:null,draft_changed:view==='model-mechanism'?!!mechanismEvidence?.draft_changed:petDraftChanged} as PetContext} onShare={v=>changePetPreferences({...petPreferences,share_context:v})} onSettings={()=>navigate('settings')} onAction={(a:PetAction)=>{if(a.type==='lesson')openLesson(a.id);else if(run?.id===a.id){navigate('workbench');changeStep(5);}else void api<Job>('/lab/runs/'+a.id).then(load).catch(e=>setError(e.message));}}/>}<details className="pp-palette-menu" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label="外观配色"><PaletteIcon size={20}/><span>外观</span></summary><div><strong>选择你喜欢的课堂颜色</strong><button className="pp-auto-palette" aria-pressed={palettePreference==='auto'} onClick={()=>choosePalette('auto')}>跟随学习场景</button><div className="pp-palette-swatches">{Object.entries(palettes).map(([id,p])=><button key={id} aria-pressed={palettePreference===id} onClick={()=>choosePalette(id as PalettePreference)}><i style={{background:p.brand}}/>{p.name}</button>)}</div><p>图表中数据角色的颜色保持一致。</p></div></details><button className="pp-settings" onClick={()=>navigate('settings')} aria-label="设置与数据">设置</button></header>
 <main id="planet-content" className="pp-content" tabIndex={-1} onBlur={()=>journal.flush()}>
  {!catalog?<div className="pp-loading"><PlanetLogo/>{error?<><p role="alert">{error}</p><button className="pp-btn primary" onClick={refresh}>重试连接计算服务</button></>:<><LoaderCircle className="spin"/><p>正在准备课程与数据快照…</p></>}</div>:<>
   {error&&view!=='workbench'&&<p className="pp-error" role="alert">{error}</p>}
   {view==='start'&&<><section className="pp-home-hero"><div><span className="pp-breadcrumb">模力星球 · 机器学习实验课堂</span><h1><span>把模型，</span><span>亲手跑明白。</span></h1><p>清洗数据、选择模型、填写参数。每一次选择，都用真实训练结果回答。</p><div className="pp-home-learning-action"><button className="pp-btn primary" onClick={()=>study?.all_complete?navigate('learning'):openLesson(study?.resume_id||'ml-intro')}>{study?.all_complete?'回顾学习航线':study&&Object.keys(study.progress).length?'继续知识学习':'从机器学习入门'}<ArrowRight size={20}/></button><span>{study?.all_complete?'回看你的知识与实验发现':study?.lessons.find(l=>l.id===(study.resume_id||'ml-intro'))?.title||'什么是机器学习？'}</span></div></div><div className="pp-home-free"><h2>自由实验</h2><PlanetMap onSelect={navigate}/></div></section>{saved&&activeDataset&&draft&&<aside className="pp-home-resume"><span><FlaskConical size={20}/>上次的实验仍在这里</span><button className="pp-text-link" onClick={()=>navigate('workbench')}>继续 {activeDataset.title}<ArrowRight size={18}/></button></aside>}
    <section className="pp-home-path"><h2>从问题到答案，一条完整航线。</h2><div>{['认识任务','体检与清洗','自己划分','模型与参数','真实训练','对照与验证'].map((s,i)=><span key={s}><b>{i+1}</b>{s}</span>)}</div></section><section className="pp-home-features"><article><h3>数字留给你填写</h3><p>范围和含义随时可查。先做判断，再试一次。</p></article><article><h3>图像跟着真实模型走</h3><p>邻居、树路径、系数和残差，都来自这次计算。</p></article><article><h3>把结果保存成自己的证据</h3><p>首答、辅助、参数与数据身份各自留存。</p></article></section><SmallGuide>不需要一开始就认识全部模型。先选一个问题，跟着它完成一堂实验。</SmallGuide></>}
   {(view==='classification'||view==='regression')&&shelf(view)}
   {view==='models'&&<><header className="pp-page-heading"><h1>每种模型，都有自己的判断方式。</h1><p>先认识机制，再选择一份数据亲自填写参数。分类、回归与进阶家族分别组织。</p></header><div className="pp-result-tabs" role="group" aria-label="模型方向筛选">{[['all','全部'],['classification','分类'],['regression','回归']].map(([v,l])=><button key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="pp-model-search"><label><Search size={20}/><input type="search" aria-label="搜索模型" value={modelQuery} placeholder="搜索模型、家族或关键词" onChange={e=>setModelQuery(e.target.value)}/></label><span>{visibleModels.length}个模型</span></div>{!visibleModels.length&&<div className="pp-search-empty"><p>没有找到对应模型，可以试试“树”“KNN”或“Ridge”。</p><button className="pp-btn secondary" onClick={()=>setModelQuery('')}>清除搜索</button></div>}<div className="pp-atlas">{visibleModels.map(m=><article key={m.id}><ModelGlyph kind={m.mechanism} size={60}/><div><small>{m.task==='classification'?'分类':'回归'} / {m.family}</small><h2>{m.title}</h2><p>{m.summary}</p><details><summary>认识核心设置</summary>{m.parameters.map(f=><p key={f.key}><strong>{f.label}</strong>：{f.kind==='choice'?f.options?.map(v=>v.label).join(' / '):`${f.min}～${f.max}${f.kind==='integer'?'，整数':''}`}。</p>)}<p>模型输入使用当前训练内处理链；不是所有设置增大都会更好。</p></details></div><div className="pp-model-actions"><button className="pp-btn secondary" onClick={()=>start(catalog.datasets.find(d=>m.id==='poisson'?d.id==='bike':d.task===m.task)!,m)}>用它做实验<ArrowRight size={18}/></button><button className="pp-text-link" onClick={()=>openModelMechanism(m.id)}>先看预测机制<Lightbulb size={16}/></button></div></article>)}</div></>}
   {view==='model-mechanism'&&(selectedModel?<ModelMechanism onEvidence={receiveMechanismEvidence} key={selectedModel.id} model={selectedModel} dataset={mechanismDataset(catalog,selectedModel)} catalog={catalog} backLabel={mechanismReturn.current==='workbench'?'返回当前实验':mechanismReturn.current==='learning'?'返回原知识课':'返回模型图鉴'} onBack={()=>navigate(mechanismReturn.current,mechanism,mechanismReturn.current==='learning'?practiceOrigin:null)} onPractice={()=>start(mechanismDataset(catalog,selectedModel),selectedModel)}/>:<SmallGuide>没有找到对应模型。<button className="pp-text-link" onClick={()=>navigate('models')}>返回模型图鉴</button></SmallGuide>)}
   {view==='settings'&&<PlanetSettings preferences={petPreferences} onPreferences={changePetPreferences} palette={palettePreference} onPalette={choosePalette} onBack={()=>navigate(previousPage.current.view,previousPage.current.section,previousPage.current.lesson)} onRecords={()=>navigate('experiments')} onSaved={refreshHealth}/>}
   {view==='learning'&&<LearningPath overview={study} selected={selectedLesson} onSelect={openLesson} onPractice={practice} onError={setError}/>}
   {view==='experiments'&&<PlanetHistory initialTab={recordTab} onTabChange={setRecordTab} overview={study} onMechanism={openStation} catalog={catalog} onLoad={load} onRefresh={refreshStudy} onError={setError} onLesson={id=>openLesson(id)}/>}
   {originLesson&&['workbench','mechanisms','model-mechanism'].includes(view)&&<aside className="pp-practice-ribbon" aria-label="课题实践"><BookOpen size={21}/><span>正在实践<strong>{originLesson.title}</strong></span><button className="pp-text-link" onClick={()=>openLesson(originLesson.id)}>回到原课题<ArrowLeft size={17}/></button><button className="pp-pet-icon-button" aria-label="退出课题实践" onClick={()=>rememberOrigin(null)}><X size={18}/></button></aside>}
   {mechanismVisited&&<section className="pp-workshop" hidden={view!=='mechanisms'} aria-label="模型机制工坊"><nav className="pp-workshop-tabs" aria-label="机制学习导航">{workshopSections.map(n=><button key={n.id} aria-current={mechanism===n.id?'page':undefined} onClick={()=>openMechanism(n.id)}>{n.label}</button>)}</nav><div hidden={mechanism==='explore'}><MechanismLab embedded section={mechanism} onSectionChange={openMechanism} topicRequest={topicRequest} resumeRequest={resumeRequest}/></div>{mechanism==='explore'&&<MechanismMap overview={study} onOpen={openStation} onRecords={()=>{setRecordTab('mechanisms');navigate('experiments');}}/> }{!['settings','history','explore'].includes(mechanism)&&<aside className="pp-lesson-bridge"><div><Lightbulb size={26}/><span><strong>把刚才的直觉，带进真实数据。</strong><small>机制草稿会保留，完成任务后可以回来继续。</small></span></div><button className="pp-btn secondary" onClick={()=>navigate(mechanism==='classification'?'classification':'regression')}>选择一个{mechanism==='classification'?'分类':'回归'}任务<ArrowRight size={18}/></button></aside>}</section>}

   {view==='workbench'&&journal.warning&&<p className="pp-notice" role="status">{journal.warning}</p>}
   {view==='workbench'&&draft&&activeDataset&&<PlanetWorkbench catalog={activeCatalog!} draft={draft} setDraft={changeDraft} step={step} setStep={changeStep} run={run} job={job} busy={busy} error={error} onTrain={train} onCancel={cancel} onRun={adopt} onError={setError} pinned={pinned} onPin={pin} onMechanism={openModelMechanism}/>}
   {view==='workbench'&&(!draft||!activeDataset)&&<SmallGuide>先从分类港或回归谷选择一份数据。请从内置课例中开始新的实验。</SmallGuide>}
  </>}
 </main></div></div>;
}
