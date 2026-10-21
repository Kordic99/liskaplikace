import {useRef,useState} from "react";
import {ImagePlus,LoaderCircle,RotateCcw} from "lucide-react";
import {prepareCover} from "./cover-files";
export default function CoverPicker({active,busy,onChange,onReset,onProcessing}:{active:boolean;busy:boolean;onChange:(blob:Blob)=>void;onReset:()=>void;onProcessing:(value:boolean)=>void}){
 const input=useRef<HTMLInputElement>(null),[processing,setProcessing]=useState(false),[error,setError]=useState("");
 return <div className="cover-picker"><input ref={input} className="cover-file-input" aria-label="Soubor vlastní obálky" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy||processing} onChange={async event=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;setProcessing(true);onProcessing(true);setError("");try{onChange(await prepareCover(file))}catch(e){setError((e as Error).message)}finally{setProcessing(false);onProcessing(false)}}}/>
 <button className="button subtle" type="button" disabled={busy||processing} onClick={()=>input.current?.click()}>{processing?<LoaderCircle size={15} className="spin"/>:<ImagePlus size={15}/>} {processing?"Připravuji obrázek…":"Nahrát vlastní obálku"}</button>
 {active&&<button className="text-button" type="button" disabled={busy||processing} onClick={()=>{setError("");onReset()}}><RotateCcw size={13}/> Použít původní obálku</button>}
 <small>JPG, PNG, WebP nebo HEIC · do 20 MB. Obrázek před uložením zmenšíme. Změna platí jen pro tvoji knihu.</small>{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
