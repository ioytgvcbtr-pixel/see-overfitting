export type NumericField={key:string;min?:number;max?:number;kind:string};
export function logarithmic(field:NumericField){return ['alpha','gamma','C','var_smoothing'].includes(field.key)&&!!field.min&&field.min>0&&!!field.max&&field.max/field.min>=1000;}
export function sliderDomain(field:NumericField){return logarithmic(field)?{min:Math.log10(field.min!),max:Math.log10(field.max!),step:.01}:{min:field.min!,max:field.max!,step:field.kind==='integer'?1:(field.max!-field.min!)/1000};}
export function toSlider(field:NumericField,value:number){return logarithmic(field)?Math.log10(value):value;}
export function fromSlider(field:NumericField,value:number){const n=logarithmic(field)?10**value:value;return Math.min(field.max!,Math.max(field.min!,field.kind==='integer'?Math.round(n):Number(n.toPrecision(7))));}
