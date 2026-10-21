import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('.sites-runtime',{recursive:true});
await build({entryPoints:['tests/own-catalog.ts'],outfile:'.sites-runtime/test-own-catalog.mjs',bundle:true,platform:'node',format:'esm'});
const result=spawnSync(process.execPath,['.sites-runtime/test-own-catalog.mjs'],{stdio:'inherit'});
process.exitCode=result.status??1;
