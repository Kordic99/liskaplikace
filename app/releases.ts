import {z} from "zod";
import history from "./releases.json";
export const releaseSchema=z.object({id:z.number().int().positive(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),title:z.string().min(1),changes:z.array(z.string().min(1)).min(1)});
export type Release=z.infer<typeof releaseSchema>;
export const releaseHistorySchema=z.array(releaseSchema).min(1).refine(entries=>entries.every((entry,index)=>entry.id===index+1),"Neplatné pořadí aktualizací.");
export const releases=releaseHistorySchema.parse(history);
export const currentRelease=releases[releases.length-1].id;
export const releaseReadSchema=z.object({lastSeenRelease:z.number().int().min(0).max(2147483647)});
export type ReleaseRead=z.infer<typeof releaseReadSchema>;
export const releaseAcknowledgementSchema=z.object({throughRelease:z.number().int().min(1).max(2147483647)});
export function unseenReleases(lastSeenRelease:number,history:readonly Release[]=releases){return history.filter(release=>release.id>lastSeenRelease)}
export function releaseSnapshot(lastSeenRelease:number,history:readonly Release[],openSnapshot:readonly Release[]){return unseenReleases(lastSeenRelease,openSnapshot.length?openSnapshot:history)}
export const changeCount=(history:readonly Release[])=>history.reduce((total,release)=>total+release.changes.length,0);
export function releaseCounts(history:readonly Release[]){
 const count=changeCount(history),updates=history.length;
 return `${count} ${count===1?"novinka":count<5?"novinky":"novinek"} · ${updates} ${updates===1?"aktualizace":updates<5?"aktualizace":"aktualizací"}`;
}
