import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const webRoot=fileURLToPath(new URL('../',import.meta.url));
const inputs=[
  'wasm/Cargo.toml',
  'wasm/Cargo.lock',
  'wasm/rust-toolchain.toml',
  'wasm/src',
  'wasm/examples',
  'scripts/build-wasm.mjs',
  'scripts/rayon-helpers.js',
];

const files=[];
function collect(path){
  const full=resolve(webRoot,path);
  const stat=statSync(full);
  if(stat.isDirectory()){
    for(const name of readdirSync(full).sort())collect(path+'/'+name);
  }else{
    files.push(path.replaceAll('\\','/'));
  }
}
for(const input of inputs)collect(input);
files.sort();

const hash=createHash('sha256');
for(const path of files){
  const full=resolve(webRoot,path);
  hash.update(relative(webRoot,full).replaceAll('\\','/'));
  hash.update('\0');
  hash.update(readFileSync(full));
  hash.update('\0');
}
process.stdout.write(hash.digest('hex')+'\n');
