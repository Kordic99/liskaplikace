import {build} from 'esbuild';
import {themeImageFiles} from './theme-assets.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]??path.join(root,'dist-local/index.html'));
const bundle=await build({entryPoints:[path.join(root,'tools/local-entry.tsx')],bundle:true,format:'iife',minify:true,target:'es2020',write:false,define:{__GOOGLE_BOOKS_KEY__:JSON.stringify(process.env.VITE_GOOGLE_BOOKS_API_KEY??'')}});
const image=await fs.readFile(path.join(root,'public/images/dragon-library.webp'));
const sticker=await fs.readFile(path.join(root,'public/images/reading-sticker.webp'));
let css=(await Promise.all(['archive.css','theme-palette.css','themes.css','catalog.css'].map(name=>fs.readFile(path.join(root,'app',name),'utf8')))).join('\n').replaceAll('/images/dragon-library.webp','data:image/webp;base64,'+image.toString('base64'));
let js=bundle.outputFiles[0].text.replaceAll('/images/reading-sticker.webp','data:image/webp;base64,'+sticker.toString('base64'));
for(const name of themeImageFiles){const data='data:image/webp;base64,'+(await fs.readFile(path.join(root,'public/images',name))).toString('base64');css=css.replaceAll('/images/'+name,data);js=js.replaceAll('/images/'+name,data)}
js=js.replaceAll('</script','<\\/script');
const html='<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="Soukromá čtenářská knihovna. Data se ukládají pouze v tomto prohlížeči."><title>Liškaplikace</title><style>'+css+'</style></head><body><div id="root"></div><script>'+js+'</script></body></html>';
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,html);
console.log('Standalone HTML: '+output);
