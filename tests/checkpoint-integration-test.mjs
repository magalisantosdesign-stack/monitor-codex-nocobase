import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32'){console.log('SKIP: Windows PreCompact hook pipe integration.');process.exit(0);}
const root=dirname(dirname(fileURLToPath(import.meta.url))),base=await mkdtemp(join(tmpdir(),'monitor-precompact-'));
const id='00000000-0000-4000-8000-000000000001',turn='00000000-0000-4000-8000-000000000002';
const pipe='\\\\.\\pipe\\codex-precompact-test-'+process.pid+'-'+randomUUID(),origin='http://localhost:14000';
let hasIDs=true,child,calls=0;const sockets=new Set();
const bridge=net.createServer(socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
 socket.on('data',part=>{
  buffer=Buffer.concat([buffer,part]);if(buffer.length<4||buffer.length<4+buffer.readUInt32LE(0))return;
  const request=JSON.parse(buffer.subarray(4,4+buffer.readUInt32LE(0)));calls++;
  assert.equal(request.params.tool,'read_thread');assert.equal(request.params.arguments.threadId,id);
  assert.equal(request.params.arguments.includeOutputs,false);assert.equal(request.params.arguments.maxOutputCharsPerItem,0);
  const items=hasIDs?[{type:'agentMessage',id:'q',text:'SECRET_QUESTION'},{type:'userMessage',id:'reply',content:'SECRET_REPLY'}]:[{type:'contextCompaction',id:'compact'}];
  const body={thread:{id,hostId:'local',status:{type:'active',activeFlags:[]}},turns:[{id:turn,status:'inProgress',items}]};
  const data=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:request.id,result:{success:true,contentItems:[{type:'inputText',text:JSON.stringify(body)}]}}));
  const response=Buffer.alloc(data.length+4);response.writeUInt32LE(data.length);data.copy(response,4);socket.end(response);
 });
});
await new Promise((res,rej)=>{bridge.once('error',rej);bridge.listen(pipe,res);});
const reservation=http.createServer();await new Promise(res=>reservation.listen(0,'127.0.0.1',res));const port=reservation.address().port;await new Promise(res=>reservation.close(res));
const env={...process.env,CODEX_MONITOR_DATA:base,CODEX_MONITOR_CONFIG:join(base,'config.json'),CODEX_MONITOR_SETTINGS:join(base,'missing.json'),CODEX_MONITOR_PORT:String(port),CODEX_APP_TOOLS_PIPE_PATH:pipe};
const url='http://127.0.0.1:'+port,headers={Origin:origin,'Content-Type':'application/json'};
async function until(check){const deadline=Date.now()+10000;while(Date.now()<deadline){try{if(await check())return;}catch{}await new Promise(res=>setTimeout(res,100));}throw Error('PreCompact fixture timed out.');}
async function state(){return(await fetch(url+'/states',{headers})).json();}
function hook(event){return new Promise((res,rej)=>{
 const process=spawn(globalThis.process.execPath,[join(root,'src/hook.mjs')],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
 process.once('error',rej);process.stdout.on('data',data=>stdout+=data);process.stderr.on('data',data=>stderr+=data);
 process.once('close',code=>res({code,stdout,stderr}));process.stdin.end(JSON.stringify({session_id:id,turn_id:turn,hook_event_name:event,transcript_path:'SECRET_PATH'}));
});}
try{
 await mkdir(join(base,'events'));await writeFile(join(base,'config.json'),JSON.stringify({port,origins:[origin]}));
 await writeFile(join(base,'linked.json'),JSON.stringify({ids:[id]}));
 await writeFile(join(base,'states.json'),JSON.stringify({[id]:{sessionId:id,turnId:turn,at:1,status:'aguardando_resposta',questionPending:true,questionToolId:'q',approvalPending:false}}));
 const before=await hook('PreCompact');assert.equal(before.code,0,before.stderr);assert.equal(before.stdout.trim(),'{}');assert.equal(calls,1);
 const queue=await Promise.all((await readdir(join(base,'events'))).filter(name=>name.endsWith('.json')).map(async name=>JSON.parse(await readFile(join(base,'events',name),'utf8'))));
 assert.ok(queue.some(event=>event.event==='QuestionResolved'));
 assert.ok(!JSON.stringify(queue).includes('SECRET'));
 // Remove both IDs before starting the collector: only the durable event can
 // resolve this state. No process was kept running by the hook.
 hasIDs=false;
 child=spawn(process.execPath,[join(root,'src/server.mjs')],{env,windowsHide:true,stdio:'ignore'});
 await until(async()=>(await state()).states[id]?.status==='processando');
 assert.equal((await state()).states[id].questionPending,false);
 assert.equal((await state()).states[id].questionResolvedToolId,'q');
 const after=await hook('PostCompact');assert.equal(after.code,0,after.stderr);assert.equal(after.stdout.trim(),'{}');
 await until(async()=>Boolean((await state()).states[id].postCompactAt));assert.equal((await state()).states[id].status,'processando');
 assert.equal(calls,1,'PostCompact must not read deleted history.');
 const current=await state();await fetch(url+'/shutdown',{method:'POST',headers,body:JSON.stringify({instanceId:current.instanceId})});await until(()=>child.exitCode!==null);
 console.log('PASS: real hook process captures reply before compaction; collector starts afterward, restores receipt without IDs, preserves state and saves no contents.');
}finally{
 if(child&&child.exitCode===null){child.kill();await until(()=>child.exitCode!==null);}
 for(const socket of sockets)socket.destroy();await new Promise(res=>bridge.close(res));
 const target=resolve(base);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-precompact-'));await rm(target,{recursive:true,force:true});
}
