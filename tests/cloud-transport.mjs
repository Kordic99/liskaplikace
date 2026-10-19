import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('.sites-runtime',{recursive:true});
await build({entryPoints:['tests/cloud-transport.ts'],outfile:'.sites-runtime/test-cloud.cjs',bundle:true,platform:'node',format:'cjs'});
const result=spawnSync(process.execPath,['.sites-runtime/test-cloud.cjs'],{stdio:'inherit'});
process.exitCode=result.status??1;
