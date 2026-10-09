import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32'){console.log('SKIP: Windows usage integration.');process.exit(0);}
const root=dirname(fileURLToPath(import.meta.url)),base=await mkdtemp(join(tmpdir(),'monitor-usage-'));
const id='00000000-0000-4000-8000-000000000001',turn='00000000-0000-4000-8000-000000000002';
const pipe='\\\\.\\pipe\\monitor-usage-'+randomUUID(),origin='http://localhost:14000',sockets=new Set();let child,usageCalls=0;
const bridge=net.createServer(socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
 socket.on('data',part=>{
  buffer=Buffer.concat([buffer,part]);if(buffer.length<4||buffer.length<4+buffer.readUInt32LE())return;
  const request=JSON.parse(buffer.subarray(4,4+buffer.readUInt32LE()));
  let value;
  if(request.params.tool==='get_usage_limits'){
   usageCalls++;assert.deepEqual(request.params.arguments,{});assert.equal(request.params.threadId,id);assert.equal(request.params.turnId,turn);
   value={accountId:'SECRET_ACCOUNT',rateLimits:{limitId:'codex',planType:'pro',primary:{usedPercent:39,windowDurationMins:10080,resetsAt:2000000000},secondary:null},rateLimitResetCredits:{credits:[{id:'SECRET_RESET'}]}};
  }else{
   assert.equal(request.params.tool,'read_thread');value={thread:{id,hostId:'local',status:{type:'idle'}},turns:[{id:turn,status:'completed',items:[]}]};
  }
  const payload=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,result:{success:true,contentItems:[{type:'inputText',text:JSON.stringify(value)}]}}));const frame=Buffer.alloc(payload.length+4);frame.writeUInt32LE(payload.length);payload.copy(frame,4);socket.write(frame);
 });
});
try{
 await new Promise(resolve=>bridge.listen(pipe,resolve));
 const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const configPath=join(base,'config.local.json');await writeFile(configPath,JSON.stringify({port,origins:[origin],dataDir:base}));
 await mkdir(join(base,'desktop-bridges'));await writeFile(join(base,'linked.json'),JSON.stringify({ids:[id]}));await writeFile(join(base,'desktop-bridges',id+'.json'),JSON.stringify({pipe,threadId:id,turnId:turn}));
 const env={...process.env,CODEX_MONITOR_CONFIG:configPath,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_DATA:base,CODEX_MONITOR_SETTINGS:join(base,'missing-settings.json')};
 const serverPath=await (async()=>{try{await readFile(join(root,'server.mjs'));return join(root,'server.mjs');}catch{return join(root,'../src/server.mjs');}})();
 child=spawn(process.execPath,[serverPath],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',resolve);child.once('exit',code=>reject(new Error('server exited '+code)));});
 const url='http://127.0.0.1:'+port,headers={Origin:origin};
 assert.equal((await fetch(url+'/usage',{headers:{Origin:'http://evil.example'}})).status,403);assert.equal(usageCalls,0);
 const responses=await Promise.all([fetch(url+'/usage',{headers}),fetch(url+'/usage',{headers})]);
 const first=await responses[0].json(),second=await responses[1].json();
 assert.equal(first.confirmed,true);assert.equal(first.scope,'account');assert.equal(first.limits[0].windows[0].remainingPercent,61);assert.deepEqual(first,second);assert.equal(usageCalls,1);assert.ok(!JSON.stringify(first).includes('SECRET'));
 await fetch(url+'/usage',{headers});assert.equal(usageCalls,1);
 const states=await (await fetch(url+'/states',{headers})).json();assert.equal(states.service,'codex-monitor');assert.equal(states.instanceId,first.instanceId);
 const shutdown=await fetch(url+'/shutdown',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({instanceId:first.instanceId})});assert.equal(shutdown.status,200);
 await new Promise(resolve=>child.once('exit',resolve));child=null;
 assert.ok(!(await readdir(base)).some(name=>/usage/i.test(name)), 'Usage must not be persisted');
 console.log('PASS: isolated HTTP usage, CORS, account-only whitelist, concurrent cache, state endpoint and shutdown.');
}finally{
 if(child){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
 for(const socket of sockets)socket.destroy();await new Promise(resolve=>bridge.close(resolve));
 const resolved=resolve(base);assert.ok(resolved.startsWith(resolve(tmpdir())+sep));await rm(resolved,{recursive:true,force:true});
}
