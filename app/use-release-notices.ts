import {useCallback,useEffect,useRef,useState} from "react";
import {api} from "./client-api";
import {assetHref} from "./local";
import {currentRelease,releases,releaseHistorySchema,releaseReadSchema,unseenReleases,releaseSnapshot,type Release} from "./releases";

export function useReleaseNotices(enabled:boolean){
 const [lastSeen,setLastSeen]=useState<number|null>(null),[pending,setPending]=useState<Release[]>([]),[saving,setSaving]=useState(false),[error,setError]=useState(""),[deferred,setDeferred]=useState(false);
 const [available,setAvailable]=useState(releases);
 const active=useRef(false),writing=useRef(false),generation=useRef(0),snapshot=useRef<Release[]>([]),seen=useRef(0);
 const readHistory=async()=>{
  try{
   const response=await fetch(`${assetHref("/releases.json")}?check=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error();
   const latest=releaseHistorySchema.parse(await response.json());
   return latest.at(-1)!.id>=currentRelease?latest:releases;
  }catch{return releases}
 };
 const refresh=useCallback(async()=>{
  if(!enabled||writing.current)return;
  const version=generation.current;
  try{
   const [raw,history]=await Promise.all([api("/api/releases"),readHistory()]);
   const state=releaseReadSchema.parse(raw);
   if(active.current&&version===generation.current){
    seen.current=Math.max(seen.current,state.lastSeenRelease);setLastSeen(seen.current);setAvailable(history);
    // Freeze an open notice: an update arriving mid-read must never be silently acknowledged.
    snapshot.current=releaseSnapshot(seen.current,history,snapshot.current);
    setPending(snapshot.current);
   }
  }
  catch{/* A failed check never records unseen changes as read. Retry on focus/online or the next visit. */}
 },[enabled]);
 useEffect(()=>{
  active.current=true;if(enabled)void refresh();
  const check=()=>{if(document.visibilityState!=="hidden")void refresh()};
  for(const event of ["focus","online","liskaplikace:releases-changed"])window.addEventListener(event,check);
  document.addEventListener("visibilitychange",check);
  return()=>{active.current=false;generation.current++;for(const event of ["focus","online","liskaplikace:releases-changed"])window.removeEventListener(event,check);document.removeEventListener("visibilitychange",check)};
 },[enabled,refresh]);
 const acknowledge=async()=>{
  if(writing.current)return;
  const throughRelease=snapshot.current.at(-1)?.id;if(!throughRelease)return;
  writing.current=true;generation.current++;setSaving(true);setError("");
  try{
   const state=releaseReadSchema.parse(await api("/api/releases","PUT",{throughRelease}));
   if(state.lastSeenRelease<throughRelease)throw new Error("Potvrzení novinek se nepodařilo uložit.");
   if(active.current){seen.current=Math.max(seen.current,state.lastSeenRelease);setLastSeen(seen.current);snapshot.current=unseenReleases(seen.current,snapshot.current);setPending(snapshot.current);if(throughRelease>currentRelease)window.location.reload()}
  }catch{if(active.current)setError("Potvrzení se nepodařilo uložit. Zkus to znovu; novinky ti připomeneme i při příští návštěvě.")}
  finally{writing.current=false;if(active.current)setSaving(false)}
 };
 return {pending,history:available,initial:lastSeen===0,saving,error,acknowledge,deferred,defer:()=>setDeferred(true),requiresReload:(pending.at(-1)?.id??0)>currentRelease};
}
