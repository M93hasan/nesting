import {readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../public/examples/test klasoru dxf/',import.meta.url));
const files=readdirSync(root,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&/\.dxf$/i.test(entry.name))
  .map(entry=>entry.name)
  .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
writeFileSync(join(root,'catalog.json'),JSON.stringify({files},null,2)+'\n');
console.log(`Generated Test DXF catalog with ${files.length} files.`);
