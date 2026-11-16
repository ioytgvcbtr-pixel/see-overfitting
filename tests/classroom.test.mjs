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
