import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,mkdir,writeFile,readFile,utimes,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import http from 'node:http';
import {root} from '../src/config.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function run(exe,args,env){return new Promise((resolve,reject)=>{
 const child=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 child.once('error',reject);child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
 // PowerShell descendants can retain inherited pipe handles after its exit.
 // Wait for the launcher process, then close only this test's output streams.
 child.once('exit',code=>setTimeout(()=>{child.stdout.destroy();child.stderr.destroy();resolve({code,stdout,stderr});},50));
});}
async function fixture(){
 const base=await mkdtemp(join(tmpdir(),'monitor-startup-'));
 const install=join(base,"pacote com espacos e 'apostrofo'");await mkdir(install);
 for(const file of ['scripts/Iniciar-Monitor.mjs','src/server.mjs','src/config.mjs','src/state.mjs','src/standby.mjs','src/permissions.mjs','src/runtime.mjs','src/health.mjs','src/usage.mjs','src/tokens.mjs','scripts/Diagnosticar-Monitor.mjs','scripts/Reconectar-Monitor.ps1','scripts/Instalar-Reconexao.ps1','scripts/Remover-Integracao-Windows.ps1']){await mkdir(join(install,file,'..'),{recursive:true});await cp(join(root,file),join(install,file));}
 const socket=http.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 await writeFile(join(install,'config.local.json'),JSON.stringify({port,origins:['http://localhost:14000']}));
 const env={...process.env,CODEX_HOME:join(base,'fake-codex'),CODEX_MONITOR_SETTINGS:join(base,'missing.json')};
 for(const name of ['CODEX_MONITOR_DATA','CODEX_MONITOR_CONFIG','CODEX_MONITOR_PORT'])delete env[name];
 const data=join(install,'.local','data'),url='http://127.0.0.1:'+port;
 async function stop(){
  try{const pid=Number(await readFile(join(data,'service.pid'),'utf8'));process.kill(pid,'SIGTERM');}
  catch(error){if(!['ENOENT','ESRCH'].includes(error.code))throw error;}
  for(let n=0;n<40;n++){
   try{await fetch(url+'/states',{headers:{Origin:'http://localhost:14000'},signal:AbortSignal.timeout(250)});await delay(100);}
   catch{return;}
  }
  throw new Error('Servidor isolado nao encerrou.');
 }
 async function cleanup(){await stop();const target=resolve(base);assert(target.startsWith(resolve(tmpdir())+sep));assert(target.includes('monitor-startup-'));await rm(target,{recursive:true,force:true});}
 return{base,install,port,env,data,url,stop,cleanup,
  launch:()=>run(process.execPath,[join(install,'scripts/Iniciar-Monitor.mjs')],env),
  result:async()=>JSON.parse(await readFile(join(install,'.local','startup-result.json'),'utf8')),
  states:async()=>await(await fetch(url+'/states',{headers:{Origin:'http://localhost:14000'}})).json()};
}
test('concurrent launches, restart and stale lock preserve an isolated installation',async()=>{
 const f=await fixture();
 try{
  const launches=await Promise.all([f.launch(),f.launch()]);for(const result of launches)assert.equal(result.code,0,result.stderr);
  const pid=await readFile(join(f.data,'service.pid'),'utf8');assert.equal((await f.result()).status,'ok');
  assert.equal((await f.launch()).code,0);assert.equal(await readFile(join(f.data,'service.pid'),'utf8'),pid);
  const id='00000000-0000-4000-8000-000000000001';
  const headers={Origin:'http://localhost:14000','Content-Type':'application/json'};
  await fetch(f.url+'/linked',{method:'POST',headers,body:JSON.stringify({ids:[id]})});
  await f.stop();
  await writeFile(join(f.data,'states.json'),JSON.stringify({[id]:{status:'respondido',at:123}}));
  await mkdir(join(f.data,'startup.lock'));const old=new Date(0);await utimes(join(f.data,'startup.lock'),old,old);
  assert.equal((await f.launch()).code,0);const restored=(await f.states()).states[id];
  assert.equal(restored.status,'respondido');assert.equal(restored.at,123);assert.equal(restored.standby,false);
  assert.equal(restored.displayStatus,'nao_confirmado');assert.equal(restored.verification.confirmed,false,'Restored history is preserved but requires fresh verification.');
  assert.deepEqual(JSON.parse(await readFile(join(f.data,'linked.json'),'utf8')).ids,[id]);
  const diagnosis=await run(process.execPath,[join(f.install,'scripts/Diagnosticar-Monitor.mjs')],f.env);
  assert.equal(diagnosis.code,0);assert.match(diagnosis.stdout,/Coletor conectado/);assert(!diagnosis.stdout.includes(id));
 }finally{await f.cleanup();}
});
test('occupied port and bad configuration produce useful diagnostics',async()=>{
 const f=await fixture();const other=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end('{"service":"another"}');});
 try{
  await new Promise(resolve=>other.listen(f.port,'127.0.0.1',resolve));
  assert.equal((await f.launch()).code,1);assert.equal((await f.result()).code,'PORT_OCCUPIED');
  await new Promise(resolve=>other.close(resolve));
  await writeFile(join(f.install,'config.local.json'),'INVALID');
  assert.equal((await f.launch()).code,1);assert.equal((await f.result()).code,'CONFIG_INVALID');
 }finally{if(other.listening)await new Promise(resolve=>other.close(resolve));await f.cleanup();}
});
test('Windows wrapper starts from saved Node without PATH and installer preview does not write', {skip:process.platform!=='win32'},async()=>{
 const f=await fixture(),ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 try{
  const preview=await run(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'tests/windows-install-test.ps1'),'-InstallRoot',f.install,'-OnlyPreview'],{...f.env,CODEX_MONITOR_NODE:process.execPath});
  assert.equal(preview.code,0,preview.stderr);assert.equal(JSON.parse(preview.stdout.replace(/^\uFEFF/, '')).Mode,'preview');
  await assert.rejects(readFile(join(f.install,'.local','windows-launcher.json')),{code:'ENOENT'});
  await mkdir(join(f.install,'.local'));
  await writeFile(join(f.install,'.local','windows-launcher.json'),JSON.stringify({node:process.execPath,environment:{CODEX_HOME:f.env.CODEX_HOME,CODEX_MONITOR_SETTINGS:f.env.CODEX_MONITOR_SETTINGS}}));
  const isolated={...f.env,PATH:join(process.env.SystemRoot,'System32')};
  const wrapped=await run(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(f.install,'scripts/Reconectar-Monitor.ps1'),'-Quiet'],isolated);
  assert.equal(wrapped.code,0,wrapped.stderr);assert.equal((await f.result()).status,'ok');
  const pid=await readFile(join(f.data,'service.pid'),'utf8');
  const second=await run(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(f.install,'scripts/Reconectar-Monitor.ps1'),'-Quiet'],isolated);
  assert.equal(second.code,0);assert.equal(await readFile(join(f.data,'service.pid'),'utf8'),pid);
  await f.stop();await writeFile(join(f.install,'.local','windows-launcher.json'),JSON.stringify({node:join(f.base,'missing-node.exe')}));
  const missing=await run(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(f.install,'scripts/Reconectar-Monitor.ps1'),'-Quiet'],isolated);
  assert.equal(missing.code,1);assert.match(await readFile(join(f.install,'.local','windows-launcher.log'),'utf8'),/Node instalado nao foi encontrado/);
  const registry=await run(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'tests/windows-install-test.ps1'),'-InstallRoot',f.install],{...f.env,CODEX_MONITOR_NODE:process.execPath});
  assert.equal(registry.code,0,registry.stderr);assert.match(registry.stdout,/memory-only registry/);
 }finally{await f.cleanup();}
});


