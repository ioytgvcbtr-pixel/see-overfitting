import test from 'node:test';
import assert from 'node:assert/strict';
import {readClassroomLocation,classroomHash,palettes,readPalette,contextPalette} from '../src/lib/classroom.ts';
import {mechanismControl,mechanismDataset,mechanismQuestion} from '../src/lib/model-mechanism.ts';
import {fromSlider,toSlider,sliderDomain,logarithmic} from '../src/lib/parameter-scale.ts';
import {floatingPosition} from '../src/lib/companion.ts';

test('the movable companion keeps its close controls inside the viewport',()=>{
 assert.deepEqual(floatingPosition(-100,-100,380,660,1366,900),{x:8,y:76});
 assert.deepEqual(floatingPosition(3000,3000,380,660,1366,900),{x:978,y:232});
});

test('positive wide-range parameters retain useful small values on a logarithmic rail',()=>{
 const alpha={key:'alpha',kind:'number',min:.000001,max:1000};assert.ok(logarithmic(alpha));assert.equal(sliderDomain(alpha).min,-6);assert.equal(sliderDomain(alpha).max,3);
 assert.equal(fromSlider(alpha,-2),.01);assert.equal(fromSlider(alpha,-1),.1);assert.equal(toSlider(alpha,.01),-2);
 const k={key:'n_neighbors',kind:'integer',min:1,max:51};assert.ok(!logarithmic(k));assert.equal(sliderDomain(k).step,1);assert.equal(fromSlider(k,7.6),8);assert.equal(fromSlider(k,100),51);
});

test('each model mechanism has a refreshable identity and retains the atlas palette',()=>{
 for(const id of ['logistic','knn_c','svc','tree_r','poisson'])assert.deepEqual(readClassroomLocation(classroomHash('model-mechanism','explore',null,null,id)),{view:'model-mechanism',section:'explore',model:id});
 assert.equal(readClassroomLocation('#classroom/model-mechanism/../../settings').view,'start');
 assert.equal(contextPalette('model-mechanism'),'indigo');
});

test('mechanism controls and datasets follow the actual model rather than only its task',()=>{
 const catalog={datasets:[{id:'iris'},{id:'concrete'},{id:'bike'}]};
 const svc={id:'svc',task:'classification',mechanism:'boundary',parameters:[{key:'C'},{key:'gamma'}]};
 assert.equal(mechanismControl(svc).key,'gamma');assert.equal(mechanismDataset(catalog,svc).id,'iris');assert.match(mechanismQuestion(svc),/支持向量/);
 assert.equal(mechanismDataset(catalog,{id:'poisson',task:'regression'}).id,'bike');assert.equal(mechanismDataset(catalog,{id:'ridge',task:'regression'}).id,'concrete');
});
test('old mechanism links and new task links remain distinguishable and roundtrip',()=>{
 assert.deepEqual(readClassroomLocation('#classification'),{view:'mechanisms',section:'classification'});
 assert.deepEqual(readClassroomLocation('#classroom/classification'),{view:'classification',section:'explore'});
 for(const section of ['explore','concepts','classification','studio','datasets','path','history'])assert.deepEqual(readClassroomLocation(classroomHash('mechanisms',section)),{view:'mechanisms',section});
 assert.equal(readClassroomLocation('',true).view,'mechanisms');assert.equal(readClassroomLocation('#mechanisms/bogus').section,'explore');
});
test('classroom palette follows the learning context without changing a stored fixed preference',()=>{
 assert.equal(contextPalette('classification'),'lagoon');assert.equal(contextPalette('regression'),'apricot');assert.equal(contextPalette('workbench','classification',2),'meadow');
 assert.equal(readPalette('sky'),'sky');assert.equal(readPalette('invalid'),'auto');
});
function lum(hex){const v=hex.match(/[0-9a-f]{2}/gi).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function contrast(a,b){return(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);}
test('every palette retains readable body, secondary text and primary button text',()=>{
 for(const [id,p] of Object.entries(palettes)){
  for(const [fg,bg] of [[p.ink,p.bg],[p.muted,p.bg],[p.brand,'#ffffff'],['#ffffff',p.nav]])assert.ok(contrast(fg,bg)>=4.5,`${id}: ${fg} on ${bg}`);
 }
});

test('knowledge and mechanism deep links keep a specific lesson or station',()=>{
 assert.deepEqual(readClassroomLocation('#classroom/learning/ml-intro'),{view:'learning',section:'explore',lesson:'ml-intro'});
 assert.equal(classroomHash('learning','explore','ml-intro'),'#classroom/learning/ml-intro');
 assert.deepEqual(readClassroomLocation('#mechanisms/concepts/regularization'),{view:'mechanisms',section:'concepts',panel:'regularization'});
});


test('settings has an independent route and compatible old bookmarks',()=>{
 for(const hash of ['#settings','#mechanisms/settings','#classroom/settings'])assert.deepEqual(readClassroomLocation(hash),{view:'settings',section:'explore'});
 assert.equal(classroomHash('settings'),'#classroom/settings');
});

import {companionPreferences,defaultCompanion} from '../src/lib/companion.ts';
test('companion preferences preserve typed choices and ignore unknown input',()=>{
 assert.deepEqual(companionPreferences(null),defaultCompanion);
 assert.deepEqual(companionPreferences('{bad'),defaultCompanion);
 const p=companionPreferences(JSON.stringify({enabled:false,motion:false,quiet:true,share_context:false,save_history:false,answer_style:'detailed',reader_size:'large',secret:'do not retain'}));
 assert.equal(p.enabled,false);assert.equal(p.answer_style,'detailed');assert.equal(p.reader_size,'large');assert.ok(!('secret' in p));
 assert.equal(companionPreferences('{"motion":"yes","reader_size":"tiny"}').motion,true);
});

import {orbitalFrame,orbitCenter,orbitSpeed} from '../src/lib/orbital-motion.ts';
import {taskKinds,taskKindLabel,modelMatches} from '../src/lib/learning-flow.ts';
test('planet satellite stays on one continuous ellipse with correct front depth',()=>{
 for(let i=0;i<720;i++){const phase=i*Math.PI/180;const f=orbitalFrame(phase,i/60,'idle',0);const ellipse=((f.x-orbitCenter.x)/orbitCenter.rx)**2+((f.y-orbitCenter.y)/orbitCenter.ry)**2;assert.ok(Math.abs(ellipse-1)<1e-10);assert.ok(f.x-9>0&&f.x+9<200&&f.y>0&&f.y<210);assert.ok(f.blink>0&&f.blink<=1);if(Math.abs(Math.sin(phase))>1e-10)assert.equal(f.front,Math.sin(phase)>0);}
 const a=orbitalFrame(0,0,'idle',0),b=orbitalFrame(2*Math.PI,0,'idle',0);assert.equal(a.x,b.x);assert.equal(a.y,b.y);
});
test('planet response poses stay bounded and preserve the same orbit geometry',()=>{
 for(const mood of ['idle','wave','thinking','happy','feed','orbit','sleep'])for(let i=0;i<100;i++){const f=orbitalFrame(i/10,i/60,mood,i/30);assert.ok(Number.isFinite(f.bob)&&Math.abs(f.roll)<=4&&f.scale>=1&&f.scale<1.03);assert.ok(f.feed>=0&&f.feed<=1);}
 assert.ok(orbitSpeed('sleep')<orbitSpeed('idle'));assert.ok(orbitSpeed('orbit')>orbitSpeed('idle'));
});
test('dataset task filters reflect targets and time/count roles',()=>{
 assert.deepEqual(taskKinds({task:'classification',targets:[{classes:['0','1']}]}),['二分类']);
 assert.deepEqual(taskKinds({task:'classification',targets:[{},{}]}),['多标签']);
 const bike={task:'regression',targets:[{}],time_column:'date',count_target:true};assert.deepEqual(taskKinds(bike),['单目标','时间顺序','计数']);assert.equal(taskKindLabel(bike),'时间顺序 · 计数');
 assert.equal(taskKindLabel({task:'regression',targets:[{},{}]}),'多目标回归');
});
test('model search supports ids, names and combined keywords',()=>{
 const ridge={id:'ridge',title:'岭回归',family:'正则化线性',summary:'观察约束与验证误差'};
 assert.ok(modelMatches(ridge,'  RIDGE '));assert.ok(modelMatches(ridge,'正则 验证'));assert.ok(!modelMatches(ridge,'KNN'));assert.ok(modelMatches(ridge,''));
});


import {plotDomain,seriesPath} from '../src/lib/chart-evidence.ts';
test('residual domains include a visible zero for one-sided errors and constant values',()=>{
 for(const values of [[2,4,7],[-7,-4,-2],[0,0],[9,9]]){const [lo,hi]=plotDomain(values,true);assert.ok(lo<0&&hi>0);assert.ok(values.every(v=>v>lo&&v<hi));}
 assert.deepEqual(plotDomain([NaN,Infinity]),[0,1]);
});
test('failed or nonfinite fits leave a real break in a plotted series',()=>{
 const points=[{x:1,y:2},{x:2,y:null},{x:3,y:4},{x:4,y:5},{x:5,y:NaN},{x:6,y:8}];
 assert.equal(seriesPath(points,v=>v,v=>v),'M1 2 M3 4 L4 5 M6 8');
 assert.equal(seriesPath([{x:1,y:0},{x:2,y:1}],v=>v,v=>v),'M1 0 L2 1');
});
test('parameter scans follow numerical coordinates and retain missing values',()=>{
 assert.equal(seriesPath([{x:10,y:3},{x:1,y:4},{x:5,y:null}],v=>v,v=>v,true),'M1 4 M10 3');
});

import {collectLearningState,clearLearningState,restoreLearningState} from '../src/lib/archive-storage.ts';
function archiveStore(entries){const values=new Map(entries);return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('learning exports include drafts and exclude credentials, appearance and chat',()=>{
 const store=archiveStore([['modelplanet-draft-v1','draft'],['fitlab-learning-completed-v1','progress'],['modelplanet-palette-v1','orchid'],['modelplanet-companion-v1','prefs'],['modelplanet-pet-session-v1','chat'],['provider-api-key','local-only']]);
 assert.deepEqual(collectLearningState(store),{'modelplanet-draft-v1':'draft','fitlab-learning-completed-v1':'progress'});
});
test('progress reset keeps model drafts while dropping course state and unsent events',()=>{
 const store=archiveStore([['modelplanet-draft-v1','draft'],['modelplanet-last-run','run'],['fitlab-island-progress-v1','old'],['fitlab-learning-completed-v1','done'],['modelplanet-study-outbox-v1','pending'],['modelplanet-palette-v1','sky']]);
 clearLearningState(store,'progress');assert.equal(store.getItem('modelplanet-draft-v1'),'draft');assert.equal(store.getItem('modelplanet-last-run'),'run');assert.equal(store.getItem('fitlab-island-progress-v1'),null);assert.equal(store.getItem('modelplanet-study-outbox-v1'),null);assert.equal(store.getItem('modelplanet-palette-v1'),'sky');
});
test('full learning restoration cannot overwrite unrelated settings',()=>{
 const store=archiveStore([['modelplanet-draft-v1','new'],['modelplanet-palette-v1','sky'],['provider-api-key','kept']]);clearLearningState(store,'all');
 restoreLearningState(store,{'modelplanet-draft-v1':'restored','modelplanet-palette-v1':'changed','provider-api-key':'changed'});
 assert.equal(store.getItem('modelplanet-draft-v1'),'restored');assert.equal(store.getItem('modelplanet-palette-v1'),'sky');assert.equal(store.getItem('provider-api-key'),'kept');
});
