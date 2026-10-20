import {Check,History,LoaderCircle,Sparkles} from "lucide-react";
import {useEffect,useState} from "react";
import Modal from "./Modal";
import {releaseCounts,type Release} from "./releases";

export type ReleaseNoticeProps={entries:readonly Release[];history?:boolean;initial?:boolean;saving?:boolean;error?:string;requiresReload?:boolean;onClose:()=>void;onDefer?:()=>void};
export function AutomaticReleaseNotice({ready,...props}:ReleaseNoticeProps&{ready:boolean}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!ready||open)return;
  const check=()=>{if(!document.querySelector('[role="dialog"]'))setOpen(true)};
  check();const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[ready,open]);
 return ready&&open?<ReleaseNotice {...props}/>:null;
}
export default function ReleaseNotice({entries,history=false,initial=false,saving=false,error="",requiresReload=false,onClose,onDefer}:ReleaseNoticeProps){
 return <Modal wide title={history?"Historie aktualizací":"Co je nového v Liškaplikaci"} subtitle={history?"Všechny novinky na jednom místě.":initial?"Tady začíná přehled novinek k tvému účtu. Příště uvidíš jen další změny.":"Všechno, co přibylo od tvého posledního potvrzení."} onClose={()=>{if(!saving)onClose()}}>
  <div className="release-intro"><span className="release-emblem">{history?<History size={23}/>:<Sparkles size={23}/>}</span><div><strong>{releaseCounts(entries)}</strong><p>{history?"Můžeš se sem kdykoli vrátit z Nastavení.":"Jen novinky, které patří do tvého přehledu."}</p></div></div>
  <div className="release-list" tabIndex={0} role="region" aria-label="Přehled změn">{[...entries].reverse().map(release=><section className="release-entry" key={release.id}>
   <time dateTime={release.date}>{new Date(release.date+"T12:00:00Z").toLocaleDateString("cs-CZ",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Prague"})}</time>
   <h3>{release.title}</h3><ul>{release.changes.map(change=><li key={change}>{change}</li>)}</ul>
  </section>)}</div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="form-actions release-actions">{error&&onDefer&&<button className="button subtle" disabled={saving} onClick={onDefer}>Připomenout příště</button>}<button className="button gold-button" disabled={saving} onClick={onClose}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} {history?"Zavřít přehled":saving?"Ukládám potvrzení…":requiresReload?"Rozumím, načíst novou verzi":"Rozumím, jdeme číst"}</button></div>
 </Modal>;
}
