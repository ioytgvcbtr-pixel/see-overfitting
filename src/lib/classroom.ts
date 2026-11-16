import type {AppView} from './navigation';

export type ClassroomView='start'|'classification'|'regression'|'models'|'experiments'|'workbench'|'mechanisms'|'learning'|'settings';
export type LocationState={view:ClassroomView;section:AppView;lesson?:string;panel?:string};
export const workshopSections:{id:AppView;label:string}[]=[
 {id:'explore',label:'探索地图'},{id:'concepts',label:'概念工坊'},
 {id:'classification',label:'分类边界'},{id:'studio',label:'实验工作台'},
 {id:'path',label:'学习路径'},{id:'history',label:'学习档案'},
];
const legacySections=new Set(['explore','concepts','classification','studio','bench','datasets','path','learn','history','settings']);
export function readClassroomLocation(hash:string,initialMechanism=false):LocationState{
 const value=hash.replace(/^#/,'');
 if(value==='settings'||value==='mechanisms/settings')return {view:'settings',section:'explore'};
 if(value.startsWith('mechanisms/')){
  const [section,panel]=value.slice(11).split('/');return {view:'mechanisms',section:legacySections.has(section)?(section==='bench'||section==='learn'?'studio':section) as AppView:'explore',...(['error','sensitivity','regularization'].includes(panel)?{panel}:{})};
 }
 if(value.startsWith('classroom/')){
  const [view,lesson]=value.slice(10).split('/');return {...(view==='learning'&&/^[a-z0-9-]{1,60}$/.test(lesson||'')?{lesson}:{}),view:['start','classification','regression','models','experiments','workbench','learning','settings'].includes(view)?view as ClassroomView:'start',section:'explore'};
 }
 if(legacySections.has(value))return {view:'mechanisms',section:(value==='bench'||value==='learn'?'studio':value) as AppView};
 return {view:initialMechanism?'mechanisms':'start',section:'explore'};
}
export const classroomHash=(view:ClassroomView,section:AppView='explore',lesson:string|null=null,panel:string|null=null)=>view==='mechanisms'?`#mechanisms/${section}${panel?'/'+panel:''}`:`#classroom/${view}${view==='learning'&&lesson?'/'+lesson:''}`;

export const palettes={
 orchid:{name:'鸢尾紫',brand:'#7443a5',ink:'#2d243d',muted:'#6c6078',bg:'#f8f6fc',soft:'#eee6f6',nav:'#30223f'},
 lagoon:{name:'海湾青',brand:'#096e79',ink:'#193d43',muted:'#516d71',bg:'#f3faf9',soft:'#e0f2ef',nav:'#173e44'},
 apricot:{name:'杏子橙',brand:'#a64c22',ink:'#482f27',muted:'#786057',bg:'#fff9f2',soft:'#fbe9d6',nav:'#4b3028'},
 sky:{name:'晴空蓝',brand:'#315fa9',ink:'#24374f',muted:'#5b6b80',bg:'#f4f8fd',soft:'#e4edf9',nav:'#263b59'},
 meadow:{name:'森林绿',brand:'#2d714f',ink:'#253c30',muted:'#5b7063',bg:'#f5faf4',soft:'#e5f0df',nav:'#293f33'},
 indigo:{name:'星空靛',brand:'#5551a5',ink:'#2d2d48',muted:'#64637e',bg:'#f6f7fd',soft:'#e9e9f8',nav:'#2e2d50'},
} as const;
export type Palette=keyof typeof palettes;
export type PalettePreference='auto'|Palette;
export function readPalette(value:string|null):PalettePreference{return value&&Object.hasOwn(palettes,value)?value as Palette:'auto';}
export function contextPalette(view:ClassroomView,task?:string,step=0,section:AppView='explore'):Palette{
 if(view==='workbench')return step===1||step===2?'meadow':task==='classification'?'lagoon':'apricot';
 if(view==='classification')return 'lagoon';if(view==='regression')return 'apricot';
 if(view==='learning')return 'orchid';if(view==='models')return 'indigo';if(view==='experiments'||view==='settings')return 'sky';
 if(view==='mechanisms')return section==='classification'?'lagoon':section==='settings'||section==='history'?'sky':'meadow';
 return 'orchid';
}
