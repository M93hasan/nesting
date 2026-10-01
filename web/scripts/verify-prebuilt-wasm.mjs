import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const webRoot=fileURLToPath(new URL('../',import.meta.url));
const expected=execFileSync(process.execPath,['scripts/wasm-fingerprint.mjs'],{cwd:webRoot,encoding:'utf8'}).trim();
const hashPath=fileURLToPath(new URL('../wasm/prebuilt.sha256',import.meta.url));
const actual=existsSync(hashPath)?readFileSync(hashPath,'utf8').trim():'';
if(expected!==actual){
  console.error('Prebuilt WASM is stale. Run npm run wasm:build and refresh wasm/prebuilt.sha256.');
  process.exit(1);
}
for(const dir of ['pkg','pkg-threads','pkg-nosimd','pkg-threads-nosimd']){
  const path=fileURLToPath(new URL(`../wasm/${dir}/`,import.meta.url));
  if(!existsSync(path)||!readdirSync(path).some(name=>name.endsWith('.wasm'))){
    console.error(`Missing prebuilt WASM package: wasm/${dir}`);
    process.exit(1);
  }
}
console.log('Prebuilt WASM verified.');
