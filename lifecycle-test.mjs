import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import http from 'node:http';
import {root} from './config.mjs';
test('Manual disconnect exits its own process, persists data and can reconnect',async()=>{
 const base=await mkdtemp(join(tmpdir(),'monitor-control-test-'));
 const allocator=http.createServer();await new Promise(r=>allocator.listen(0,'127.0.0.1',r));const port=allocator.address().port;await new Promise(r=>allocator.close(r));
 const sentinel=http.createServer((req,res)=>res.end('unrelated service'));
 await new Promise(r=>sentinel.listen(0,'127.0.0.1',r));const sentinelPort=sentinel.address().port;
 const headers={Origin:'http://localhost:13000','Content-Type':'application/json'},url='http://127.0.0.1:'+port;
 const id='00000000-0000-4000-8000-000000000001';
 const env={...process.env,CODEX_MONITOR_DATA:base,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_SETTINGS:join(base,'missing.json')};
 let service;
 async function start(){
  service=spawn(process.execPath,[join(root,'server.mjs')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((r,j)=>{service.once('error',j);service.stdout.once('data',r);service.once('exit',c=>j(Error('early exit '+c)));});
 }
 async function post(path,values,expected=200){const response=await fetch(url+path,{method:'POST',headers,body:JSON.stringify(values)});assert.equal(response.status,expected);return response;}
 async function state(){return(await(await fetch(url+'/states',{headers})).json());}
 async function shutdown(instanceId){
  const exited=new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Process remained alive')),6000);service.once('exit',code=>{clearTimeout(timer);r(code);});});
  const response=await post('/shutdown',{instanceId});assert.equal((await response.json()).ok,true);
  assert.equal(await exited,0);await assert.rejects(fetch(url+'/states',{headers,signal:AbortSignal.timeout(1000)}));
 }
 try{
  await start();const first=await state();assert(first.instanceId);
  await post('/shutdown',{instanceId:'another-installation'},409);
  assert.equal((await fetch(url+'/shutdown',{method:'POST',headers:{...headers,Origin:'https://foreign.example'},body:JSON.stringify({instanceId:first.instanceId})})).status,403);
  assert.equal((await fetch(url+'/shutdown',{method:'POST',headers:{Origin:headers.Origin,'Content-Type':'text/plain'},body:'{}'})).status,415);
  await post('/linked',{ids:[id]});await post('/standby',{id,enabled:true});
  await writeFile(join(base,'service.pid'),String(service.pid));
  const at=Date.now();
  // A pending event is written without waiting for the collector's interval.
  await writeFile(join(base,'events',`${at}-00000001.json`),JSON.stringify({sessionId:id,turnId:'synthetic-turn',event:'Stop',at,subagent:false}));
  await shutdown(first.instanceId);
  assert.equal(JSON.parse(await readFile(join(base,'states.json'),'utf8'))[id].status,'respondido');
  await assert.rejects(readFile(join(base,'service.pid')),{code:'ENOENT'});
  assert.equal(await(await fetch('http://127.0.0.1:'+sentinelPort)).text(),'unrelated service');
  await start();const resumed=await state();assert.deepEqual(JSON.parse(await readFile(join(base,'linked.json'),'utf8')).ids,[id]);
  assert.equal(resumed.states[id].status,'respondido');
  await post('/standby',{id,enabled:true},409);
  const confirmedAt=Date.now();await writeFile(join(base,'events',`${confirmedAt}-00000002.json`),JSON.stringify({sessionId:id,turnId:'confirmed-turn',event:'Stop',at:confirmedAt,subagent:false}));
  await state();await post('/standby',{id,enabled:true});const marker=JSON.parse(await readFile(join(base,'standby.json'),'utf8'));
  await writeFile(join(base,'service.pid'),'123');await shutdown(resumed.instanceId);
  assert.equal(await readFile(join(base,'service.pid'),'utf8'),'123','Never remove PID file owned by another process');
  await start();assert.equal((await state()).states[id].standby,true);
  assert.deepEqual(JSON.parse(await readFile(join(base,'standby.json'),'utf8')),marker);
  await shutdown((await state()).instanceId);
 }finally{
  if(service?.exitCode===null){const ended=new Promise(r=>service.once('exit',r));service.kill();await ended;}
  await new Promise(r=>sentinel.close(r));
  const target=resolve(base);assert(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-control-test-'));
  await rm(target,{recursive:true,force:true});
 }
});
