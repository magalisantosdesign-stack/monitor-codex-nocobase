import {spawn} from 'node:child_process';
import {mkdir,open,stat,rmdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let config;
async function probe(){
 try{
  const response=await fetch(`http://127.0.0.1:${config.port}/states`,{headers:{Origin:config.origins[0]},signal:AbortSignal.timeout(1500)});
  if(!response.ok)return 'occupied';
  let result;
  try{result=await response.json();}catch{return 'occupied';}
  return result.service==='codex-monitor'&&result.instanceId===config.instanceId?'connected':'occupied';
 }catch(error){return error.cause?.code==='ECONNREFUSED'?'stopped':'unknown';}
}
function failure(code){return Object.assign(new Error(code),{code});}
async function start(){
 const data=config.dataDir,lock=path.join(data,'startup.lock');
 await mkdir(data,{recursive:true});
 const initial=await probe();
 if(initial==='connected')return 'already_running';
 if(initial==='occupied')throw failure('PORT_OCCUPIED');
 const deadline=Date.now()+15000;
 while(true){
  try{await mkdir(lock);break;}
  catch(error){
   if(error.code!=='EEXIST')throw failure('LOCK_UNAVAILABLE');
   if(await probe()==='connected')return 'already_running';
   try{if(Date.now()-(await stat(lock)).mtimeMs>45000){await rmdir(lock);continue;}}
   catch(error){if(error.code==='ENOENT')continue;throw failure('LOCK_UNAVAILABLE');}
   if(Date.now()>deadline)throw failure('START_IN_PROGRESS');
   await delay(300);
  }
 }
 let output,errors;
 try{
  const before=await probe();
  if(before==='connected')return 'already_running';
  if(before==='occupied')throw failure('PORT_OCCUPIED');
  output=await open(path.join(data,'service.log'),'a');errors=await open(path.join(data,'service-error.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',output.fd,errors.fd]});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(failure('SPAWN_FAILED')));});
  child.unref();await writeFile(path.join(data,'service.pid'),String(child.pid)+'\n');
  const readyBy=Date.now()+25000;
  while(Date.now()<readyBy){
   if(await probe()==='connected')return 'started';
   if(child.exitCode!==null)throw failure('SERVER_EXITED');
   await delay(250);
  }
  throw failure('START_TIMEOUT');
 }finally{
  await output?.close();await errors?.close();
  try{await rmdir(lock);}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
// Minimal local diagnostics: no chat data, command arguments or web URI text.
async function report(status,code){
 const folder=path.join(root,'.local');await mkdir(folder,{recursive:true});
 await writeFile(path.join(folder,'startup-result.json'),JSON.stringify({at:new Date().toISOString(),status,code,port:config?.port??null}));
}
try{
 try{({config}=await import('./config.mjs'));}catch{throw failure('CONFIG_INVALID');}
 const result=await start();await report('ok',result);
 console.log(result==='started'?'Monitor Codex iniciado em segundo plano.':'Monitor Codex já está em execução.');
}catch(error){
 const known=new Set(['CONFIG_INVALID','PORT_OCCUPIED','LOCK_UNAVAILABLE','START_IN_PROGRESS','SPAWN_FAILED','SERVER_EXITED','START_TIMEOUT']);
 const code=known.has(error.code)?error.code:'START_FAILED';
 try{await report('error',code);}catch{}
 console.error('Falha ao iniciar o monitor: '+code+'. Execute Diagnosticar-Monitor.cmd.');process.exitCode=1;
}
