import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { bookSchema, type Book } from "./model";
import { parseBackup, MAX_BACKUP_BYTES } from "./backup";
import { LibraryApiError, type LibraryTransport } from "./client-api";
import { localApi } from "./local";
import {defaultPreferences,preferencesSchema} from "./preferences";
import {releaseReadSchema,releaseAcknowledgementSchema} from "./releases";
import {COVER_BUCKET,ownedCover,validateCoverBlob} from "./cover-files";
import {restoreCoverBackup} from "./cover-backup";

const rowSchema=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative(),data:bookSchema});
function decode(row:unknown):Book{
 const result=rowSchema.safeParse(row);
 if(!result.success)throw new LibraryApiError("Uloženou knihu nelze přečíst. Data nebyla přepsána; zkus obnovit aplikaci.",500);
 return {...result.data.data,id:result.data.id,revision:result.data.revision};
}
function fail(error:{code?:string;message?:string}):never{
 if(error.code==="40001")throw new LibraryApiError("Kniha se mezitím změnila. Obnov knihovnu před uložením; rozepsaný text si nejdřív zkopíruj.",409);
 if(error.code==="42501"||error.code==="PGRST301")throw new LibraryApiError("Přihlášení vypršelo. Přihlas se znovu; rozepsaný text si předtím zkopíruj.",401);
 throw new LibraryApiError("Změnu se nepodařilo uložit. Zkontroluj připojení a zkus to znovu; rozepsaný text tu zůstává.",500);
}
export function supabaseLibrary(client:SupabaseClient,userId:string):LibraryTransport{
 const tables=["archive_books","archive_shopping"] as const;
 const tableFor=(book:{status:string})=>book.status==="shopping"?"archive_shopping":"archive_books";
 async function readRows(table:typeof tables[number],columns:string){
  const rows:any[]=[];
  for(let offset=0;;offset+=500){const {data,error}=await client.from(table).select(columns).eq("user_id",userId).order("id").range(offset,offset+499);if(error)fail(error);rows.push(...data??[]);if((data?.length??0)<500)break}
  return rows;
 }
 return async(path,method,body:any)=>{
  const url=new URL(path,"https://archive.invalid");
  if(url.pathname==="/api/covers"){
   if(method==="POST"){
    const blob=await validateCoverBlob(body),path=`${userId}/${crypto.randomUUID()}.jpg`;
    const {error}=await client.storage.from(COVER_BUCKET).upload(path,blob,{contentType:"image/jpeg",upsert:false,cacheControl:"3600"});
    if(error)fail(error);return {path};
   }
   const path=url.searchParams.get("path")??"";
   if(method!=="GET"||!ownedCover(path,userId))throw new LibraryApiError("Tato obálka nepatří k tvému účtu.",403);
   const {data,error}=await client.storage.from(COVER_BUCKET).download(path);if(error)fail(error);return data;
  }
  if(url.pathname==="/api/releases"){
   if(method==="GET"){
    const {data,error}=await client.from("archive_release_reads").select("last_seen_release").eq("user_id",userId).maybeSingle();
    if(error)fail(error);return releaseReadSchema.parse({lastSeenRelease:data?.last_seen_release??0});
   }
   if(method!=="PUT")throw new LibraryApiError("Neznámá operace.",400);
   const parsed=releaseAcknowledgementSchema.safeParse(body);
   if(!parsed.success)throw new LibraryApiError("Neplatné potvrzení novinek.",400);
   const {data,error}=await client.from("archive_release_reads").upsert({user_id:userId,last_seen_release:parsed.data.throughRelease},{onConflict:"user_id"}).select("last_seen_release").single();
   if(error)fail(error);return releaseReadSchema.parse({lastSeenRelease:data.last_seen_release});
  }
  if(url.pathname==="/api/preferences"){
   const decodePreference=(row:any)=>preferencesSchema.parse({themeId:row.theme_id,showSticker:row.show_sticker,revision:row.revision});
   if(method==="GET"){
    const {data,error}=await client.from("archive_preferences").select("theme_id,show_sticker,revision").eq("user_id",userId).maybeSingle();
    if(error)fail(error);return data?decodePreference(data):defaultPreferences();
   }
   if(method!=="PUT")throw new LibraryApiError("Neznámá operace.",400);
   const parsed=preferencesSchema.safeParse(body);
   if(!parsed.success)throw new LibraryApiError("Neplatné nastavení motivu.",400);
   const {themeId,showSticker,revision}=parsed.data;
   const table=client.from("archive_preferences");
   const query=revision===0?table.insert({user_id:userId,theme_id:themeId,show_sticker:showSticker,revision:1}):table.update({theme_id:themeId,show_sticker:showSticker,revision:revision+1}).eq("user_id",userId).eq("revision",revision);
   const {data,error}=await query.select("theme_id,show_sticker,revision").maybeSingle();
   if(error?.code==="23505"||!error&&!data)throw new LibraryApiError("Motiv se mezitím změnil na druhém zařízení. Načetli jsme aktuální nastavení; vyber motiv znovu.",409);
   if(error)fail(error);return decodePreference(data);
  }
  if(url.pathname==="/api/search")return localApi(path,"GET");
  if(url.pathname==="/api/import"&&method==="POST"){
   if(new TextEncoder().encode(JSON.stringify(body)).byteLength>MAX_BACKUP_BYTES)throw new LibraryApiError("Záloha může mít nejvýše 5 MB.",400);
   const books=parseBackup(body),unique=[...new Map(books.map(book=>[book.id,book])).values()],existing=new Set<string>();
   for(const rows of await Promise.all(tables.map(table=>readRows(table,"id"))))for(const row of rows)existing.add(row.id);
   const restored=await restoreCoverBackup(body,unique.filter(book=>!existing.has(book.id)),async blob=>{const path=`${userId}/${crypto.randomUUID()}.jpg`;const {error}=await client.storage.from(COVER_BUCKET).upload(path,blob,{contentType:"image/jpeg",upsert:false});if(error)fail(error);return {path}},path=>ownedCover(path,userId));
   let added=0;
   for(const table of tables)for(let i=0,books=restored.books.filter(book=>tableFor(book)===table);i<books.length;i+=25){
    const rows=books.slice(i,i+25).map(({id,revision,...data})=>({id,user_id:userId,revision:0,data}));
    const {data,error}=await client.from(table).upsert(rows,{onConflict:"user_id,id",ignoreDuplicates:true}).select("id");
    if(error)fail(error);added+=data?.length??0;
   }
   return {added,skipped:books.length-added,...(restored.missingCovers?{missingCovers:restored.missingCovers}:{})};
  }
  if(url.pathname!=="/api/books")throw new LibraryApiError("Neznámá operace.",400);
  if(method==="GET"){
   return (await Promise.all(tables.map(table=>readRows(table,"id,revision,data")))).flat().map(decode);
  }
  if(method==="DELETE"){
   const id=url.searchParams.get("id"),raw=url.searchParams.get("revision"),revision=Number(raw);
   if(!z.string().uuid().safeParse(id).success||raw===null||!Number.isSafeInteger(revision)||revision<0)throw new LibraryApiError("Chybí platná verze knihy.",400);
   const {data,error}=await client.rpc("archive_delete_book",{p_id:id,p_revision:revision});
   if(error)fail(error);if(!data)throw new LibraryApiError("Kniha se mezitím změnila. Obnov knihovnu před odstraněním.",409);
   return {ok:true};
  }
  const parsed=bookSchema.safeParse(body);
  if(!parsed.success)throw new LibraryApiError(parsed.error.issues[0]?.message??"Neplatné údaje o knize.",400);
  if(parsed.data.customCover&&!ownedCover(parsed.data.customCover,userId))throw new LibraryApiError("Vlastní obálka musí patřit k tvému účtu.",403);
  if(method==="POST"){
   const {data,error}=await client.from(tableFor(parsed.data)).insert({id:crypto.randomUUID(),user_id:userId,revision:0,data:parsed.data}).select("id,revision,data").single();
   if(error)fail(error);return decode(data);
  }
  if(method==="PUT"){
   if(!z.string().uuid().safeParse(body.id).success||!Number.isSafeInteger(body.revision)||body.revision<0)throw new LibraryApiError("Chybí platná verze knihy.",400);
   const {data,error}=await client.rpc("archive_save_book",{p_id:body.id,p_revision:body.revision,p_data:parsed.data}).single();
   if(error)fail(error);if(!data)throw new LibraryApiError("Kniha se změnila na druhém zařízení. Tvůj rozepsaný text zůstává otevřený; zkopíruj si ho a obnov knihovnu.",409);
   return decode(data);
  }
  throw new LibraryApiError("Neznámá operace.",400);
 };
}
