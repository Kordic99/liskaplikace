import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {validateReleaseHistory} from './release-validation.mjs';
const entries=JSON.parse(await fs.readFile('app/releases.json','utf8'));let previous,sameBuild=false;
if(process.argv.includes('--require-new')){
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GH_TOKEN;
 if(process.env.GITHUB_ACTIONS==='true'){
  if(!repo||!token)throw new Error('Missing release-verification environment');
  const get=async(route,allowMissing=false)=>{const response=await fetch('https://api.github.com/repos/'+repo+'/'+route,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});if(response.status===404&&allowMissing)return null;if(!response.ok)throw new Error('Cannot verify last deployment: '+response.status);return response.json()};
  const runs=await get('actions/workflows/pages.yml/runs?status=success&branch=main&per_page=1');
  let sha=runs?.workflow_runs?.[0]?.head_sha;
  // A TEST workflow also publishes the unchanged PROD build. Use what is actually
  // live as the baseline even when an earlier main workflow was cancelled.
  const live=await fetch('https://kordic99.github.io/liskaplikace/deployment.json?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(live.ok){const deployment=await live.json();if(deployment.environment!=='production'||typeof deployment.commit!=='string')throw new Error('Invalid live production manifest');sha=deployment.commit}
  else if(live.status!==404)throw new Error('Cannot verify live production version: '+live.status);
  if(sha){
   if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Invalid deployment reference');
   sameBuild=sha===(process.env.PRODUCTION_SHA??process.env.GITHUB_SHA);
   const file=await get('contents/app/releases.json?ref='+sha,true);
   if(file)previous=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  }
 }else{
  execFileSync('git',['rev-parse','--verify','HEAD^'],{stdio:'pipe'});
  const existed=execFileSync('git',['ls-tree','--name-only','HEAD^','app/releases.json'],{encoding:'utf8'}).trim();
  if(existed)previous=JSON.parse(execFileSync('git',['show','HEAD^:app/releases.json'],{encoding:'utf8'}));
 }
}
validateReleaseHistory(entries,previous,{sameBuild});
console.log('PASS release history: '+entries.length+' immutable updates, latest '+entries.at(-1).id);
