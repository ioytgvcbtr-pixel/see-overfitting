import test from 'node:test';
import assert from 'node:assert/strict';
import {readClassroomLocation,classroomHash,palettes,readPalette,contextPalette} from '../src/lib/classroom.ts';
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
