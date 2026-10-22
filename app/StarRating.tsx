import {useState} from "react";
import {Star} from "lucide-react";

const format=(value:number)=>value.toLocaleString("cs-CZ");

function RatingStar({fill,size}:{fill:number;size:number}){
 return <span className="rating-glyph" style={{width:size,height:size}} aria-hidden="true">
  <Star size={size} className="rating-glyph-outline"/>
  <span className="rating-glyph-fill" style={{width:`${fill*100}%`}}><Star size={size} fill="currentColor"/></span>
 </span>;
}

export default function StarRating({value,onChange,disabled=false}:{value:number;onChange?:(value:number)=>void;disabled?:boolean}){
 const [preview,setPreview]=useState<number|null>(null);
 const stars=[1,2,3,4,5],label=value?`${format(value)} / 5`:"Zatím bez hodnocení";
 return <div className="stars rating" role="group" aria-label={`Hodnocení ${format(value)} z 5`} aria-disabled={onChange?disabled:undefined}>
  <div className="rating-icons" onPointerLeave={()=>setPreview(null)}>{stars.map(star=>{
   const icon=<RatingStar fill={Math.max(0,Math.min(1,(preview??value)-star+1))} size={onChange?22:16}/>;
   return onChange?<span className="rating-star-control" key={star}>
    {[star-0.5,star].map((rating,half)=><button key={rating} className={`rating-half-button ${half===0?"left":"right"}`} type="button" disabled={disabled} aria-label={`Hodnotit ${format(rating)} z 5`} aria-pressed={value===rating} title={`${format(rating)} / 5`} onPointerEnter={event=>{if(!disabled&&event.pointerType!=="touch")setPreview(rating)}} onFocus={()=>{if(!disabled)setPreview(rating)}} onBlur={()=>setPreview(null)} onClick={()=>{setPreview(null);onChange(value===rating?0:rating)}}/>)}
    {icon}
   </span>:<span key={star}>{icon}</span>;
  })}</div>
  <span className="rating-value" role="status">{label}</span>
 </div>;
}
