import {useCallback,useEffect,useRef,useState} from "react";
import {api} from "./client-api";
import {localApi} from "./local";
import {defaultPreferences,preferencesSchema,themes,type Preferences} from "./preferences";

export function usePreferences(cloud:boolean) {
 const [value,setValue]=useState(defaultPreferences),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const pending=useRef(false),generation=useRef(0),alive=useRef(true);
 const transport=useCallback((method:string,body?:unknown)=>cloud?api("/api/preferences",method,body):localApi("/api/preferences",method,body),[cloud]);
 const refresh=useCallback(async()=>{
  if(pending.current)return;
  const version=generation.current;
  try{const next=preferencesSchema.parse(await transport("GET"));if(alive.current&&version===generation.current&&!pending.current){setValue(current=>next.revision>=current.revision?next:current);setError("")}}
  catch(e){if(alive.current&&version===generation.current)setError((e as Error).message)}
  finally{if(alive.current)setLoading(false)}
 },[transport]);
 useEffect(()=>{
  alive.current=true;void refresh();
  const tick=()=>{if(document.visibilityState!=="hidden")void refresh()};
  const timer=setInterval(tick,15000);
  for(const event of ["focus","online","storage","liskaplikace:preferences-changed"])window.addEventListener(event,tick);
  document.addEventListener("visibilitychange",tick);
  return()=>{alive.current=false;clearInterval(timer);for(const event of ["focus","online","storage","liskaplikace:preferences-changed"])window.removeEventListener(event,tick);document.removeEventListener("visibilitychange",tick);delete document.documentElement.dataset.theme;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",themes[0].background)};
 },[refresh]);
 useEffect(()=>{document.documentElement.dataset.theme=value.themeId;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",themes.find(t=>t.id===value.themeId)!.background)},[value.themeId]);
 const save=async(patch:Partial<Pick<Preferences,"themeId"|"showSticker">>)=>{
  if(pending.current||loading)return;
  pending.current=true;generation.current++;setSaving(true);setError("");
  try{const next=preferencesSchema.parse(await transport("PUT",{...value,...patch}));if(alive.current)setValue(next)}
  catch(e){if(alive.current){setError((e as Error).message);try{setValue(preferencesSchema.parse(await transport("GET")))}catch{/* Keep the last acknowledged preference. */}}}
  finally{pending.current=false;generation.current++;if(alive.current)setSaving(false)};
 };
 return {value,loading,saving,error,save,refresh};
}
