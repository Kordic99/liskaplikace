import {Star} from "lucide-react";

const steps=Array.from({length:11},(_,index)=>index/2);
const format=(value:number)=>value.toLocaleString("cs-CZ");

function RatingStar({fill,size}:{fill:number;size:number}){
 return <span className="rating-glyph" style={{width:size,height:size}} aria-hidden="true">
  <Star size={size} className="rating-glyph-outline"/>
  <span className="rating-glyph-fill" style={{width:`${fill*100}%`}}><Star size={size} fill="currentColor"/></span>
 </span>;
}

export default function StarRating({value,onChange,disabled=false}:{value:number;onChange?:(value:number)=>void;disabled?:boolean}){
 const stars=[1,2,3,4,5],label=value?`${format(value)} / 5`:"Zatím bez hodnocení";
 return <div className="stars rating" role="group" aria-label={`Hodnocení ${format(value)} z 5`}>
  <div className="rating-icons">{stars.map(star=>{
   const icon=<RatingStar fill={Math.max(0,Math.min(1,value-star+1))} size={onChange?22:16}/>;
   return onChange?<button key={star} className="rating-star-button" type="button" disabled={disabled} aria-label={`Hodnotit ${star} z 5`} aria-pressed={value===star} onClick={()=>onChange(value===star?0:star)}>{icon}</button>:<span key={star}>{icon}</span>;
  })}</div>
  {onChange?<label className="rating-select"><span>Po půl hvězdičce</span><select aria-label="Hodnocení po půl hvězdičce" value={value} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}>
   {steps.map(step=><option key={step} value={step}>{step?`${format(step)} / 5`:"Bez hodnocení"}</option>)}
   {!steps.includes(value)&&<option value={value}>{label}</option>}
  </select></label>:<span className="rating-value">{label}</span>}
 </div>;
}
