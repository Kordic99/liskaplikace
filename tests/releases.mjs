import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('.sites-runtime',{recursive:true});
await build({entryPoints:['tests/releases.ts'],outfile:'.sites-runtime/test-releases.mjs',bundle:true,platform:'node',format:'esm'});
const result=spawnSync(process.execPath,['.sites-runtime/test-releases.mjs'],{stdio:'inherit'});
process.exitCode=result.status??1;
