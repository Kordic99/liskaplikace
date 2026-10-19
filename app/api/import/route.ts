import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { books } from "../../../db/schema";
import { MAX_BACKUP_BYTES,parseBackup } from "../../backup";
export const dynamic="force-dynamic";
export async function POST(req:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"Přihlas se pro import knihovny."},{status:401});
 if(Number(req.headers.get("Content-Length")??0)>MAX_BACKUP_BYTES)return Response.json({error:"Záloha může mít nejvýše 5 MB."},{status:413});
 let incoming;
 try{
  const text=await req.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)return Response.json({error:"Záloha může mít nejvýše 5 MB."},{status:413});
  incoming=parseBackup(JSON.parse(text));
 }catch(e){return Response.json({error:e instanceof SyntaxError?"Soubor neobsahuje platný JSON.":(e as Error).message},{status:400})}
 const db=getDb(),now=new Date().toISOString();
 let added=0;
 const insert=(book:typeof incoming[number])=>{
  const {id,revision,...data}=book;
  return db.insert(books).values({id,owner:user.userId,data:JSON.stringify(data),revision:0,createdAt:now,updatedAt:now}).onConflictDoNothing().returning({id:books.id});
 };
 for(let i=0;i<incoming.length;i+=25){
  const chunk=incoming.slice(i,i+25);
  const results=await db.batch([insert(chunk[0]),...chunk.slice(1).map(insert)]);
  added+=results.reduce((sum,rows)=>sum+rows.length,0);
 }
 return Response.json({added,skipped:incoming.length-added},{headers:{"Cache-Control":"no-store"}});
}
