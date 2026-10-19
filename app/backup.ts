import { z } from "zod";
import { bookSchema, type Book } from "./model";
export const MAX_BACKUP_BYTES=5*1024*1024;
const backupSchema=z.object({format:z.literal("draci-archiv-v1"),books:z.array(bookSchema.and(z.object({id:z.string().uuid().optional()}))).max(1000)});
export function parseBackup(input:unknown):Book[]{
 const result=backupSchema.safeParse(input);
 if(!result.success)throw new Error("Tohle není platná záloha Dračího archivu. Použij JSON stažený přes Zálohovat knihovnu (nejvýše 1 000 knih).");
 return result.data.books.map(book=>({...book,id:book.id??crypto.randomUUID(),revision:0}));
}
export function mergeBackup(existing:Book[],incoming:Book[]){
 const ids=new Set(existing.map(b=>b.id));
 const added:Book[]=[];
 for(const book of incoming){if(!ids.has(book.id)){ids.add(book.id);added.push(book)}}
 return {books:[...existing,...added],added:added.length,skipped:incoming.length-added.length};
}
