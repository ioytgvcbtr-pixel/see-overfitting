import Image from 'next/image';

const artwork:Record<string,string>={classification:'classification',regression:'regression',mechanisms:'mechanisms',error:'error',sensitivity:'sensitivity',regularization:'regularization',forest:'forest'};

/** Frozen decorative artwork; the adjacent HTML supplies the name and action. */
export default function PlanetPortal({variant='mechanisms',className='',priority=false,sizes='(max-width:650px) 160px, 240px'}:{variant?:string;className?:string;priority?:boolean;sizes?:string}){
 const key=artwork[variant]||'mechanisms';
 return <span className={`pp-portal-art pp-generated-art ${className}`} aria-hidden="true" data-art={key}><Image src={`/illustrations/planet-v18/${key}.png`} alt="" fill sizes={sizes} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} draggable={false} style={{objectFit:'contain'}}/></span>;
}
