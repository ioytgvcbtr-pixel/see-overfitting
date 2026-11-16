"use client";
import {useEffect,useRef,useState} from 'react';
import {BookOpen,Compass,Database,FlaskConical,History,LoaderCircle,Menu,ArrowRight,Bird,Wheat,Wine,Car,Building2,Bike,Blocks,Stamp,Flower2,Shapes} from 'lucide-react';
import {api} from '@/lib/experiment';
import {buildSpec,freshDraft,fromSpec,waitJob,type AnalysisJob,type Catalog,type Dataset,type Draft,type Job,type Model} from '@/lib/planet';
import {PlanetLogo,PlanetMap,ModelGlyph,SmallGuide} from './PlanetArt';
import PlanetWorkbench from './PlanetWorkbench';
import PlanetHistory,{CsvImporter} from './PlanetHistory';
import HelpHint from '../HelpHint';

type View='start'|'classification'|'regression'|'models'|'experiments'|'workbench';
const navigation=[{id:'start',label:'开始学习',icon:Compass},{id:'classification',label:'分类任务',icon:Database},{id:'regression',label:'回归任务',icon:FlaskConical},{id:'models',label:'模型图鉴',icon:BookOpen},{id:'experiments',label:'我的实验',icon:History}] as const;
const STORE='modelplanet-draft-v1';
const datasetIcons:Record<string,typeof Bird>={penguins:Bird,banknote:Stamp,iris:Flower2,seeds:Wheat,concrete:Blocks,wine:Wine,auto_raw:Car,auto:Car,energy:Building2,bike:Bike,labels:Shapes};

export default function PlanetApp(){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[view,setView]=useState<View>('start'),[mobile,setMobile]=useState(false);
 const [draft,setDraft]=useState<Draft|null>(null),[step,setStep]=useState(0),[run,setRun]=useState<Job|null>(null),[job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(false),[pinned,setPinned]=useState<string|null>(null);
 const [health,setHealth]=useState<{ai_configured:boolean}|null>(null),[legacyCount,setLegacyCount]=useState(0),[importOpen,setImportOpen]=useState(false),[saved,setSaved]=useState(false),[filter,setFilter]=useState('all');
 const controller=useRef<AbortController|null>(null),generation=useRef(0),ready=useRef(false);
 function refresh(){void api<Catalog>('/lab/catalog').then(c=>{setCatalog(c);setError('');}).catch(e=>setError(e.message));}
 useEffect(()=>{
  const legacy=['explore','concepts','classification','studio','bench','datasets','path','learn','history','settings'];const h=location.hash.slice(1);
  if(legacy.includes(h)){location.replace('/mechanisms'+location.hash);return;}
  refresh();void api<{ai_configured:boolean}>('/health').then(setHealth).catch(()=>{});void api<{stats:{courses:number}}>('/workspace/overview').then(v=>setLegacyCount(v.stats.courses)).catch(()=>{});
  try{const seen=new Set<string>();for(const key of ['fitlab-bench-session-v1','fitlab-bench-records','fitlab-test-exposure','fitlab-class-session-v1']){const value=JSON.parse(localStorage.getItem(key)||'null');const rows=Array.isArray(value)?value:[value];for(const row of rows){const id=typeof row==='string'?row:row?.parameters?.dataset||row?.dataset;if(['wine','auto','concrete','iris','seeds'].includes(id))seen.add(id);}}if(seen.size)void api('/lab/legacy-exposure',{datasets:[...seen]}).catch(()=>{});}catch{}
  try{const d=JSON.parse(localStorage.getItem(STORE)||'null');if(d?.version===1&&d.draft&&Array.isArray(d.draft.features)&&d.draft.features.length<=50&&typeof d.draft.session==='string'){
    setDraft(d.draft);setStep(Math.max(0,Math.min(7,Number(d.step)||0)));setSaved(true);
  }setPinned(localStorage.getItem('modelplanet-pinned'));const id=localStorage.getItem('modelplanet-last-run');if(id&&/^[0-9a-f]{32}$/.test(id))void api<Job>('/lab/runs/'+id).then(async r=>{setRun(r);if(['queued','running'].includes(r.state)){const token=++generation.current;controller.current=new AbortController();setBusy(true);try{const done=await waitJob(r as AnalysisJob,v=>setJob(v as Job),controller.current.signal);if(token===generation.current)adopt(done as Job);}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}finally{if(token===generation.current)setBusy(false);}}}).catch(()=>{});
  }catch{}ready.current=true;return()=>controller.current?.abort();
 },[]);
 useEffect(()=>{if(ready.current&&draft)try{localStorage.setItem(STORE,JSON.stringify({version:1,draft,step}));setSaved(true);}catch{setError('浏览器草稿没有保存，服务端已完成运行仍可在档案找回。');}},[draft,step]);
 function navigate(v:View){setView(v);setMobile(false);setError('');setFilter('all');window.scrollTo({top:0,behavior:'instant'});}
 function start(d:Dataset,model?:Model){generation.current++;controller.current?.abort();setBusy(false);setJob(null);const next=freshDraft(d);if(model){next.model=model.id;next.parameters=Object.fromEntries(model.parameters.map(f=>[f.key,'']));}setDraft(next);setRun(null);setStep(0);navigate('workbench');}
 function pin(id:string){setPinned(id);localStorage.setItem('modelplanet-pinned',id);}
 function adopt(r:Job,takeDraft=false){setRun(r.result?{...r,spec:r.result.spec}:r);setJob(r);localStorage.setItem('modelplanet-last-run',r.id);if(takeDraft)setDraft(fromSpec(r.spec));}
 function load(r:Job){adopt(r,true);setStep(r.state==='completed'?5:4);navigate('workbench');}
 async function train(){
  if(!draft||!catalog)return;
  let spec;try{spec=buildSpec(draft,catalog.models);}catch(e){setError((e as Error).message);return;}
  const ticket=++generation.current;controller.current?.abort();controller.current=new AbortController();setBusy(true);setError('');
  try{const first=await api<Job>('/lab/runs',{spec,source_id:run?.id},controller.current.signal);setJob(first);localStorage.setItem('modelplanet-last-run',first.id);
   const done=await waitJob(first as AnalysisJob,v=>{if(ticket===generation.current)setJob(v as Job);},controller.current.signal);
   if(ticket===generation.current)adopt(done as Job);
  }catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}finally{if(ticket===generation.current)setBusy(false);}
 }
 function cancel(){if(job)void api('/lab/runs/'+job.id+'/cancel',{}).catch(e=>setError(e.message));}
 const activeDataset=catalog?.datasets.find(d=>d.id===draft?.dataset);
 function shelf(task:'classification'|'regression'){
  const data=catalog!.datasets.filter(d=>d.task===task);
  return <><header className="pp-page-heading"><span className="pp-breadcrumb">{task==='classification'?'给样本找类别':'预测一个数'}</span><h1>{task==='classification'?'从分类港，认出不同。':'去回归谷，预测未知。'}</h1><p>选一份数据，把清洗、划分和模型参数交给你自己决定。</p></header><div className="pp-task-grid">{data.map((d,i)=>{const TaskIcon=datasetIcons[d.id]||Database;return <button className="pp-task-card" key={d.id} onClick={()=>start(d)}><span className={`pp-task-art pp-art-${i%4}`}><TaskIcon size={80} strokeWidth={1.3} aria-hidden="true"/></span><h2>{d.title}</h2><p>{d.targets.map(t=>t.label).join('、')}</p><small>{d.rows}条 · {d.kind}</small><span className="pp-card-action">开始这堂实验<ArrowRight size={20}/></span></button>;})}</div><div className="pp-section-end"><p>也可以把自己的表格带进来，先明确目标、ID和时间角色。</p><button className="pp-btn secondary" onClick={()=>setImportOpen(v=>!v)}>导入一份CSV</button></div>{importOpen&&<CsvImporter onError={setError} onImported={d=>{refresh();start(d);setImportOpen(false);}}/>}</>;
 }
 return <div className="planet-app"><a className="pp-skip" href="#planet-content">跳到学习内容</a><aside className="pp-sidebar" data-open={mobile}><a href="/" className="pp-brand"><PlanetLogo/><span>模力星球<small>机器学习实验课堂</small></span></a><nav aria-label="模力星球主导航">{navigation.map(n=><button key={n.id} aria-current={view===n.id?'page':undefined} onClick={()=>navigate(n.id)}><n.icon size={21}/>{n.label}</button>)}</nav><div className="pp-sidebar-footer"><p>让每次选择，<br/>都看见结果。</p><a href="/mechanisms#explore">模型机制工坊<ArrowRight size={18}/></a><span>机制基础课 {legacyCount} / 3</span></div></aside>
 {mobile&&<button className="pp-nav-backdrop" aria-label="收起导航" onClick={()=>setMobile(false)}/>}
 <div className="pp-main-shell"><header className="pp-topbar"><button className="pp-mobile-menu" aria-label="展开导航" onClick={()=>setMobile(v=>!v)}><Menu size={22}/></button><strong>{view==='workbench'?'实验航线':navigation.find(n=>n.id===view)?.label}</strong><span className="pp-spacer"/><span className="pp-ai-mode">{health?.ai_configured?'AI已配置':'规则教练'}</span><HelpHint title="怎样开始"><p>选任务，明确目标，逐步填写数据处理、比例和参数。数字保持空白，只有你完成选择后才启动真实计算。</p></HelpHint><a className="pp-settings" href="/mechanisms#settings" aria-label="模型连接与数据设置">设置</a></header>
 <main id="planet-content" className="pp-content" tabIndex={-1}>
  {!catalog?<div className="pp-loading"><PlanetLogo/>{error?<><p role="alert">{error}</p><button className="pp-btn primary" onClick={refresh}>重试连接计算服务</button></>:<><LoaderCircle className="spin"/><p>正在准备课程与数据快照…</p></>}</div>:<>
   {error&&view!=='workbench'&&<p className="pp-error" role="alert">{error}</p>}
   {view==='start'&&<><section className="pp-home-hero"><div><span className="pp-breadcrumb">模力星球 · 机器学习实验课堂</span><h1>把模型，亲手跑明白。</h1><p>清洗数据、选择模型、填写参数。每一次选择，都用真实训练结果回答。</p><div className="pp-choice-row"><button className="pp-btn primary" onClick={()=>start(catalog.datasets.find(d=>d.id==='penguins')!)}>开始一次实验<ArrowRight size={20}/></button>{saved&&activeDataset&&draft&&<button className="pp-btn secondary" onClick={()=>navigate('workbench')}>继续 {activeDataset.title}</button>}</div></div><PlanetMap onSelect={navigate}/></section>
    <section className="pp-home-path"><h2>从问题到答案，一条完整航线。</h2><div>{['认识任务','体检与清洗','自己划分','模型与参数','真实训练','对照与验证'].map((s,i)=><span key={s}><b>{i+1}</b>{s}</span>)}</div></section><section className="pp-home-features"><article><h3>数字留给你填写</h3><p>范围和含义随时可查。先做判断，再试一次。</p></article><article><h3>图像跟着真实模型走</h3><p>邻居、树路径、系数和残差，都来自这次计算。</p></article><article><h3>把结果保存成自己的证据</h3><p>首答、辅助、参数与数据身份各自留存。</p></article></section><SmallGuide>不需要一开始就认识全部模型。先选一个问题，跟着它完成一堂实验。</SmallGuide></>}
   {(view==='classification'||view==='regression')&&shelf(view)}
   {view==='models'&&<><header className="pp-page-heading"><h1>每种模型，都有自己的判断方式。</h1><p>先认识机制，再选择一份数据亲自填写参数。分类、回归与进阶家族分别组织。</p></header><div className="pp-result-tabs" role="group" aria-label="模型方向筛选">{[['all','全部'],['classification','分类'],['regression','回归']].map(([v,l])=><button key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="pp-atlas">{catalog.models.filter(m=>filter==='all'||m.task===filter).map(m=><article key={m.id}><ModelGlyph kind={m.mechanism} size={60}/><div><small>{m.task==='classification'?'分类':'回归'} / {m.family}</small><h2>{m.title}</h2><p>{m.summary}</p><details><summary>认识核心设置</summary>{m.parameters.map(f=><p key={f.key}><strong>{f.label}</strong>：{f.kind==='choice'?f.options?.map(v=>v.label).join(' / '):`${f.min}～${f.max}${f.kind==='integer'?'，整数':''}`}。</p>)}<p>模型输入使用当前训练内处理链；不是所有设置增大都会更好。</p></details></div><button className="pp-btn secondary" onClick={()=>start(catalog.datasets.find(d=>m.id==='poisson'?d.id==='bike':d.task===m.task)!,m)}>用它做实验<ArrowRight size={18}/></button></article>)}</div></>}
   {view==='experiments'&&<PlanetHistory catalog={catalog} onLoad={load} onCatalog={refresh} onError={setError} legacyCount={legacyCount}/>}
   {view==='workbench'&&draft&&activeDataset&&<PlanetWorkbench catalog={catalog} draft={draft} setDraft={setDraft} step={step} setStep={setStep} run={run} job={job} busy={busy} error={error} onTrain={train} onCancel={cancel} onRun={adopt} onError={setError} pinned={pinned} onPin={pin}/>}
   {view==='workbench'&&(!draft||!activeDataset)&&<SmallGuide>先从分类港或回归谷选择一份数据。导入数据的备份未带CSV时，可重新导入原文件恢复。</SmallGuide>}
  </>}
 </main></div></div>;
}
