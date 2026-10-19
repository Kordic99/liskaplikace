import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { books } from "../../../db/schema";
import { and,eq } from "drizzle-orm";
import { bookSchema } from "../../model";
import { z } from "zod";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){const user=await getChatGPTUser();if(!user)return json({error:"Přihlas se pro přístup ke knihovně."},401);const rows=await getDb().select().from(books).where(eq(books.owner,user.userId));return json(rows.map(r=>({...JSON.parse(r.data),id:r.id,revision:r.revision})));}
export async function POST(req:Request){const user=await getChatGPTUser();if(!user)return json({error:"Nejsi přihlášen/a."},401);let body;try{body=await req.json()}catch{return json({error:"Neplatná data."},400)}const parsed=bookSchema.safeParse(body);if(!parsed.success)return json({error:parsed.error.issues[0]?.message},400);const id=crypto.randomUUID(),now=new Date().toISOString();await getDb().insert(books).values({id,owner:user.userId,data:JSON.stringify(parsed.data),createdAt:now,updatedAt:now});return json({...parsed.data,id,revision:0},201);}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Nejsi přihlášen/a."},401);
 let body;try{body=await req.json()}catch{return json({error:"Neplatná data."},400)}
 const parsed=bookSchema.safeParse(body);
 const meta=z.object({id:z.string().uuid(),revision:z.number().int().min(0)}).safeParse(body);
 if(!parsed.success||!meta.success)return json({error:!parsed.success?parsed.error.issues[0]?.message:"Neplatná verze knihy."},400);
 const {id,revision}=meta.data;
 const rows=await getDb().update(books).set({data:JSON.stringify(parsed.data),revision:revision+1,updatedAt:new Date().toISOString()}).where(and(eq(books.id,id),eq(books.owner,user.userId),eq(books.revision,revision))).returning({id:books.id});
 if(!rows.length)return json({error:"Kniha se mezitím změnila. Obnov stránku a zkus změnu znovu."},409);
 return json({...parsed.data,id,revision:revision+1});
}
export async function DELETE(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Nejsi přihlášen/a."},401);
 const params=new URL(req.url).searchParams,id=params.get("id"),rawRevision=params.get("revision"),revision=Number(rawRevision);
 if(!id||rawRevision===null||!Number.isInteger(revision)||revision<0)return json({error:"Chybí platná verze knihy."},400);
 const deleted=await getDb().delete(books).where(and(eq(books.id,id),eq(books.owner,user.userId),eq(books.revision,revision))).returning({id:books.id});
 if(!deleted.length)return json({error:"Kniha se mezitím změnila. Před odstraněním obnov knihovnu a zkontroluj její obsah."},409);
 return json({ok:true});
}
