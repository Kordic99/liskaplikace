import {useEffect,useState,type FormEvent} from "react";
import {createClient,type Session,type SupabaseClient} from "@supabase/supabase-js";
import {LockKeyhole,LoaderCircle} from "lucide-react";
import Archive from "./Archive";
import AppLogo from "./AppLogo";
import {configureLibraryTransport} from "./client-api";
import {supabaseLibrary} from "./supabase-library";
import {enableStaticRouting} from "./local";

declare const __SUPABASE_URL__:string;
declare const __SUPABASE_KEY__:string;
declare const __BASE_PATH__:string;
enableStaticRouting(__BASE_PATH__);
const client=__SUPABASE_URL__&&__SUPABASE_KEY__?createClient(__SUPABASE_URL__,__SUPABASE_KEY__,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const returnUrl=()=>new URL(__BASE_PATH__,location.origin).href;
const readableError=(error:{message:string})=>{
 if(/invalid login credentials/i.test(error.message))return "E-mail nebo heslo nesouhlasí.";
 if(/email not confirmed/i.test(error.message))return "Nejdřív potvrď e-mail od Liškaplikace a potom se přihlas.";
 if(/rate limit|too many|security purposes/i.test(error.message))return "Požadavků je teď příliš mnoho. Chvíli počkej a zkus to znovu.";
 if(/already registered/i.test(error.message))return "Tento účet už existuje. Zkus se přihlásit nebo obnovit heslo.";
 return "Požadavek se nepodařilo dokončit. Zkontroluj připojení a zkus to znovu.";
};
function Gate({children}:{children:React.ReactNode}){return <main className="cloud-gate"><section className="cloud-card"><div className="cloud-emblem"><AppLogo/></div><div className="eyebrow">TVÁ OSOBNÍ KNIHOVNA</div><h1>Liškaplikace<span className="gold">.</span></h1>{children}</section></main>}
export default function CloudApp(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[recovery,setRecovery]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  if(!client){setLoading(false);return}
  let active=true;
  const {data:{subscription}}=client.auth.onAuthStateChange((event,value)=>{if(active){setSession(value);setLoading(false);if(event==="PASSWORD_RECOVERY")setRecovery(true)}});
  void client.auth.getSession().then(({data,error})=>{if(active){if(error)setError(readableError(error));setSession(data.session);setLoading(false)}}).catch(()=>{if(active){setError("Přihlášení se nepodařilo načíst. Obnov stránku a zkus to znovu.");setLoading(false)}});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 if(!client)return <Gate><p>Online připojení ještě není nastavené. Zkus aplikaci otevřít později.</p></Gate>;
 if(loading)return <Gate><p className="cloud-loading"><LoaderCircle className="spin" size={18}/> Otevírám bránu do archivu…</p></Gate>;
 if(recovery&&session)return <AuthForm client={client} recovery onRecovered={()=>setRecovery(false)}/>;
 if(!session)return <AuthForm client={client} initialError={error}/>;
 return <SignedLibrary key={session.user.id} client={client} session={session}/>;
}
function SignedLibrary({client,session}:{client:SupabaseClient;session:Session}){
 const [ready,setReady]=useState(false),[signingOut,setSigningOut]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  configureLibraryTransport(supabaseLibrary(client,session.user.id));setReady(true);
  const channel=client.channel(`archive:${session.user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"archive_books",filter:`user_id=eq.${session.user.id}`},()=>window.dispatchEvent(new Event("archive:changed"))).on("postgres_changes",{event:"*",schema:"public",table:"archive_preferences",filter:`user_id=eq.${session.user.id}`},()=>window.dispatchEvent(new Event("liskaplikace:preferences-changed"))).on("postgres_changes",{event:"*",schema:"public",table:"archive_release_reads",filter:`user_id=eq.${session.user.id}`},()=>window.dispatchEvent(new Event("liskaplikace:releases-changed"))).subscribe();
  return()=>{configureLibraryTransport(undefined);void client.removeChannel(channel)};
 },[client,session.user.id]);
 const signOut=async()=>{setSigningOut(true);setError("");try{const {error}=await client.auth.signOut({scope:"local"});if(error)throw error}catch{setError("Odhlášení se nepodařilo. Zkontroluj připojení a zkus to znovu.")}finally{setSigningOut(false)}};
 if(!ready)return <Gate><p className="cloud-loading"><LoaderCircle className="spin" size={18}/> Načítám tvoji knihovnu…</p></Gate>;
 const bookId=new URLSearchParams(location.search).get("book")??undefined;
 return <><Archive bookId={bookId} account={{email:session.user.email??"Tvůj účet",onSignOut:signOut,busy:signingOut}}/>{error&&<div className="toast" role="alert">{error}</div>}</>;
}
function AuthForm({client,recovery=false,onRecovered,initialError=""}:{client:SupabaseClient;recovery?:boolean;onRecovered?:()=>void;initialError?:string}){
 const [mode,setMode]=useState<"login"|"signup"|"reset">("login"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(initialError),[message,setMessage]=useState("");
 const changeMode=(next:typeof mode)=>{setMode(next);setError("");setMessage("");setPassword("")};
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   if(recovery){const {error}=await client.auth.updateUser({password});if(error)throw error;onRecovered?.();return}
   if(mode==="login"){const {error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error}
   if(mode==="signup"){const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:returnUrl()}});if(error)throw error;if(!data.session)setMessage("Zkontroluj e-mail a potvrď vytvoření účtu. Potom se zde přihlas.")}
   if(mode==="reset"){const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:returnUrl()});if(error)throw error;setMessage("Pokud účet existuje, přijde ti e-mail s odkazem pro nové heslo.")}
  }catch(error){setError(readableError(error as Error))}finally{setBusy(false)}
 };
 return <Gate><p className="cloud-intro">{recovery?"Zvol si nové heslo ke svému archivu.":mode==="signup"?"Vytvoř si jeden účet pro svou knihovnu.":mode==="reset"?"Pošleme ti odkaz pro obnovení hesla.":"Přihlas se ke svým příběhům."}</p><form className="cloud-form" onSubmit={submit}>
 {!recovery&&<label>E-mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} disabled={busy}/></label>}
 {(recovery||mode!=="reset")&&<label>{recovery?"Nové heslo":"Heslo"}<input type="password" autoComplete={!recovery&&mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={recovery||mode==="signup"?8:1} maxLength={128} disabled={busy}/>{(recovery||mode==="signup")&&<small>Alespoň 8 znaků.</small>}</label>}
 {error&&<p className="cloud-error" role="alert">{error}</p>}{message&&<p className="cloud-message" role="status">{message}</p>}
 <button className="button primary full" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Chvilku strpení…</>:recovery?"Uložit nové heslo":mode==="signup"?"Vytvořit účet":mode==="reset"?"Poslat odkaz":"Vstoupit do archivu"}</button>
 </form>{!recovery&&<div className="cloud-links"><button className="text-button" disabled={busy} onClick={()=>changeMode(mode==="signup"?"login":"signup")}>{mode==="signup"?"Už mám účet – přihlásit se":"Jsem tu poprvé – vytvořit účet"}</button><button className="text-button" disabled={busy} onClick={()=>changeMode(mode==="reset"?"login":"reset")}>{mode==="reset"?"Zpět na přihlášení":"Zapomenuté heslo"}</button></div>}<p className="cloud-privacy"><LockKeyhole size={13}/> Knihy a zápisky jsou přístupné pouze tvému účtu.</p><p className="cloud-device-tip">Na PC i telefonu použij stejný e-mail a heslo aplikace.</p></Gate>;
}
