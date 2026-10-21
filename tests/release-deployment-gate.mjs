import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const history=JSON.parse(fs.readFileSync('app/releases.json','utf8')),old=history.slice(0,-1);
for(const scenario of ['new-release','same-live-build','missing-note','live-unavailable','first-manifest']){
 const same=scenario==='same-live-build',previous=same||scenario==='missing-note'?history:old;
 const source=`process.argv.push('--require-new');process.env.GITHUB_ACTIONS='true';process.env.GITHUB_REPOSITORY='fixture/app';process.env.GH_TOKEN='fixture-token';process.env.GITHUB_SHA='${'3'.repeat(40)}';process.env.PRODUCTION_SHA='${same?'2'.repeat(40):'3'.repeat(40)}';
 globalThis.fetch=async(url)=>{if(url.includes('github.io'))return ${scenario==='live-unavailable'?"{ok:false,status:503}":scenario==='first-manifest'?"{ok:false,status:404}":`{ok:true,json:async()=>({environment:'production',commit:'${'2'.repeat(40)}'})}`};if(url.includes('/runs?'))return {ok:true,json:async()=>({workflow_runs:[{head_sha:'${'1'.repeat(40)}'}]})};if(url.includes('contents/')){if(!url.includes('ref=${scenario==='first-manifest'?'1'.repeat(40):'2'.repeat(40)}'))throw new Error('Wrong production baseline');return {ok:true,json:async()=>({content:'${Buffer.from(JSON.stringify(previous)).toString('base64')}'})}}throw new Error('Unexpected request')};await import('./tools/check-releases.mjs');`;
 const result=spawnSync(process.execPath,['--input-type=module'],{input:source,encoding:'utf8'});
 if(scenario==='missing-note'){assert.notEqual(result.status,0);assert.match(result.stderr,/append/)}
 else if(scenario==='live-unavailable'){assert.notEqual(result.status,0);assert.match(result.stderr,/Cannot verify live production version/)}
 else assert.equal(result.status,0,result.stderr);
}
console.log('PASS deployment gate uses live PROD, permits TEST redeploys and rejects missing notes/unverifiable live state');
