import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative} from 'node:path';
import assert from 'node:assert/strict';
export const distributionRoot=dirname(fileURLToPath(import.meta.url));
export async function publicFiles(){
 const manifest=JSON.parse(await readFile(join(distributionRoot,'package.json'),'utf8'));
 const files=['package.json',...manifest.files];
 assert.equal(new Set(files).size,files.length,'Arquivo duplicado no manifesto.');
 for(const name of files){
  assert.ok(!name.includes('..')&&!/^(?:[a-z]:|[\\/])/i.test(name),'Somente arquivos relativos da distribuição.');
  assert.ok(!/(?:\.local|\.git\/|data\/|config\.local|\.env|backup|\.log$)/i.test(name),'Arquivo privado no manifesto.');
  assert.ok((await stat(join(distributionRoot,name))).isFile(),'O manifesto aceita arquivos explícitos.');
 }
 return files;
}
export async function checkDistribution(){
 const files=await publicFiles();
 for(const name of files){
  const text=await readFile(join(distributionRoot,name),'utf8');
  assert.ok(!/[a-z]:[\\/]Users[\\/][^\s"'\\/]+/i.test(text),'Caminho pessoal em '+name);
  assert.ok(!/[a-z]:[\\/]CodexHome\b/i.test(text),'Pasta pessoal do Codex em '+name);
  const ids=text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi)||[];
  assert.ok(ids.every(id=>/^00000000-0000-4000-8000-\d{12}$/.test(id)),'ID não fictício em '+name);
 }
 const panel=await readFile(join(distributionRoot,'panel.jsx'),'utf8');
 assert.ok(/demo:\s*true/.test(panel),'A distribuição deve iniciar em demonstração.');
 return files;
}
if(process.argv[1]&&relative(distributionRoot,process.argv[1])==='check-distribution.mjs'){
 try{console.log('PASS: '+(await checkDistribution()).length+' arquivos públicos; sem caminhos pessoais ou IDs reais.');}catch(error){console.error(error.message);process.exitCode=1;}
}
