import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative} from 'node:path';
import assert from 'node:assert/strict';
export const distributionRoot=dirname(dirname(fileURLToPath(import.meta.url)));
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
  const bytes=await readFile(join(distributionRoot,name));
  if(name.endsWith('.png')){
   assert.ok(/^docs\/images\/[a-z0-9-]+\.png$/.test(name),'Imagem fora da pasta de documentação.');
   assert.ok(bytes.length>=33&&bytes.length<=10000000,'Tamanho inválido de PNG em '+name);
   assert.ok(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'Assinatura PNG inválida em '+name);
   assert.equal(bytes.toString('ascii',12,16),'IHDR','Cabeçalho PNG inválido em '+name);
   assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(16)<=4096&&bytes.readUInt32BE(20)>0&&bytes.readUInt32BE(20)<=12000,'Dimensões inválidas em '+name);
   let offset=8,ended=false;
   while(offset<bytes.length){
    assert.ok(offset+12<=bytes.length,'PNG incompleto em '+name);
    const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
    assert.ok(offset+size+12<=bytes.length,'Chunk PNG inválido em '+name);
    assert.ok(!['tEXt','iTXt','zTXt','eXIf'].includes(type),'Metadados não permitidos em '+name);
    offset+=size+12;
    if(type==='IEND'){ended=true;break;}
   }
   assert.ok(ended&&offset===bytes.length,'Final PNG inválido em '+name);
   // Pixel privacy is checked visually on captures made only from fictitious demos.
   continue;
  }
  const text=bytes.toString('utf8');
  assert.ok(!/[a-z]:[\\/]Users[\\/][^\s"'\\/]+/i.test(text),'Caminho pessoal em '+name);
  assert.ok(!/[a-z]:[\\/]CodexHome\b/i.test(text),'Pasta pessoal do Codex em '+name);
  const ids=text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi)||[];
  assert.ok(ids.every(id=>/^00000000-0000-4000-8000-\d{12}$/.test(id)),'ID não fictício em '+name);
 }
 const panel=await readFile(join(distributionRoot,'src/panel.jsx'),'utf8');
 assert.ok(/demo:\s*true/.test(panel),'A distribuição deve iniciar em demonstração.');
 const usagePanel=await readFile(join(distributionRoot,'src/panel-usage.jsx'),'utf8');
 assert.ok(/demo:\s*true/.test(usagePanel),'A página de uso deve iniciar em demonstração.');
 return files;
}
if(process.argv[1]&&relative(distributionRoot,process.argv[1]).replaceAll('\\','/')==='scripts/check-distribution.mjs'){
 try{console.log('PASS: '+(await checkDistribution()).length+' arquivos públicos; sem caminhos pessoais ou IDs reais.');}catch(error){console.error(error.message);process.exitCode=1;}
}
