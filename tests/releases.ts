import assert from "node:assert/strict";
import {supabaseLibrary} from "../app/supabase-library";
import {changeCount,currentRelease,releases,releaseHistorySchema,releaseSnapshot,unseenReleases} from "../app/releases";
import {validateReleaseHistory} from "../tools/release-validation.mjs";

const reads=new Map<string,number>();let failedWrite=false,writeAttempts=0;
function client(user:string):any{return {from(table:string){
 assert.equal(table,"archive_release_reads");let operation="get",values:any,owner:string|undefined;
 const query:any={select(){return query},eq(key:string,value:string){assert.equal(key,"user_id");owner=value;return query},upsert(value:any,options:any){assert.deepEqual(options,{onConflict:"user_id"});operation="save";values=value;return query},single:run,maybeSingle:run};
 async function run(){
  if(operation==="get"){assert.equal(owner,user,"Reads must explicitly target the authenticated account");return {data:reads.has(user)?{last_seen_release:reads.get(user)}:null,error:null}}
  assert.equal(values.user_id,user,"Acknowledgement ownership must come from the session");writeAttempts++;
  if(failedWrite){failedWrite=false;return {data:null,error:{code:"NETWORK"}}}
  // Database contract, independently verified by tests/release-reads-rls.sql.
  const saved=Math.max(reads.get(user)??0,values.last_seen_release);reads.set(user,saved);return {data:{last_seen_release:saved},error:null};
 }
 return query;
}}}
const pc=supabaseLibrary(client("reader-a"),"reader-a"),phone=supabaseLibrary(client("reader-a"),"reader-a"),other=supabaseLibrary(client("reader-b"),"reader-b");
const history=[
 {id:1,date:"2026-10-19",title:"První vydání",changes:["První změna"]},
 {id:2,date:"2026-10-20",title:"Druhé vydání",changes:["Druhá změna","Třetí změna"]},
 {id:3,date:"2026-10-20",title:"Třetí vydání",changes:["Čtvrtá změna"]},
];

assert.equal((await pc("/api/releases","GET")).lastSeenRelease,0);
assert.equal(writeAttempts,0,"Logging in/checking updates must not mark anything as read");
reads.set("reader-b",1);
const a=unseenReleases((await pc("/api/releases","GET")).lastSeenRelease,history);
const b=unseenReleases((await other("/api/releases","GET")).lastSeenRelease,history);
assert.deepEqual(a.map(release=>release.id),[1,2,3]);assert.deepEqual(b.map(release=>release.id),[2,3]);
assert.equal(changeCount(a),4);assert.equal(changeCount(b),3);
console.log("PASS different accounts receive different cumulative updates and change counts");

const snapshot=unseenReleases(0,history);
const future=[...history,{id:4,date:"2026-10-21",title:"Další aktualizace",changes:["Později vydaná změna"]}];
assert.deepEqual(releaseSnapshot(0,future,snapshot).map(release=>release.id),[1,2,3]);
assert.deepEqual(releaseSnapshot(3,future,snapshot),[]);
assert.deepEqual(releaseSnapshot(3,future,[]).map(release=>release.id),[4]);
await phone("/api/releases","PUT",{throughRelease:snapshot.at(-1)!.id,user_id:"reader-b"});
assert.deepEqual(unseenReleases((await pc("/api/releases","GET")).lastSeenRelease,history),[]);
assert.equal((await other("/api/releases","GET")).lastSeenRelease,1);
assert.equal(changeCount(unseenReleases((await pc("/api/releases","GET")).lastSeenRelease,future)),1);
console.log("PASS acknowledgement syncs PC/phone and only covers the displayed snapshot");

await phone("/api/releases","PUT",{throughRelease:currentRelease+10});
assert.equal((await pc("/api/releases","PUT",{throughRelease:1})).lastSeenRelease,currentRelease+10);
assert.equal((await pc("/api/releases","GET")).lastSeenRelease,currentRelease+10);
await assert.rejects(()=>pc("/api/releases","PUT",{throughRelease:-1}),{status:400});
await assert.rejects(()=>pc("/api/releases","PUT",{throughRelease:1.5}),{status:400});
await assert.rejects(()=>pc("/api/releases","PUT",{throughRelease:2147483648}),{status:400});
await assert.rejects(()=>pc("/api/releases","DELETE"),{status:400});
assert.equal(releaseHistorySchema.safeParse([{...releases[0],id:8}]).success,false);
console.log("PASS stale clients cannot undo newer acknowledgements; input is validated");

failedWrite=true;await assert.rejects(()=>other("/api/releases","PUT",{throughRelease:currentRelease}));
assert.equal((await other("/api/releases","GET")).lastSeenRelease,1);
await other("/api/releases","PUT",{throughRelease:currentRelease});
assert.equal((await other("/api/releases","GET")).lastSeenRelease,currentRelease);
console.log("PASS failed confirmation keeps changes unread and can be retried");

validateReleaseHistory(releases);
const nextPublished=[...releases,{id:currentRelease+1,date:releases.at(-1)!.date,title:"Další verze",changes:["Nová změna"]}];
validateReleaseHistory(nextPublished,releases);
validateReleaseHistory(releases,releases,{sameBuild:true});
assert.throws(()=>validateReleaseHistory(releases,releases),/append/);
assert.throws(()=>validateReleaseHistory([{...releases[0],title:"Změněná historie"},...releases.slice(1),nextPublished.at(-1)!],releases),/unchanged/);
assert.throws(()=>validateReleaseHistory([{...releases[0],id:2}]),/consecutive/);
assert.throws(()=>validateReleaseHistory([{...releases[0],date:"2026-02-30"}]),/valid/);
console.log("PASS deployment guard requires new notes and preserves published history");
