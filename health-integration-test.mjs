import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32'){console.log('SKIP: Windows health integration.');process.exit(0);}
const root=dirname(fileURLToPath(import.meta.url)),base=await mkdtemp(join(tmpdir(),'monitor-health-'));
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',turn='00000000-0000-4000-8000-000000000003',newTurn='00000000-0000-4000-8000-000000000004',unlinked='00000000-0000-4000-8000-000000000005';
const pipe='\\\\.\\pipe\\monitor-health-'+randomUUID(),origin='http://localhost:14000';
const modes={[id]:'missing',[other]:'normal'},calls=[];let child;const sockets=new Set();
const bridge=net.createServer(socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
 socket.on('data',part=>{
  buffer=Buffer.concat([buffer,part]);if(buffer.length<4||buffer.length<4+buffer.readUInt32LE(0))return;
  const request=JSON.parse(buffer.subarray(4,4+buffer.readUInt32LE(0)));const target=request.params.arguments.threadId;calls.push(target);
  assert.ok([id,other].includes(target));assert.equal(request.params.tool,'read_thread');assert.equal(request.params.arguments.includeOutputs,false);assert.equal(request.params.arguments.maxOutputCharsPerItem,0);
  const mode=modes[target],items=mode==='missing'?[{id:'compact',type:'contextCompaction',text:'PRIVATE_TEXT'}]:[{id:'q',type:'agentMessage',text:'PRIVATE_QUESTION'}];
  if(mode==='reply')items.push({id:'reply',type:'userMessage',content:'PRIVATE_REPLY'});
  const body={thread:{id:target,hostId:'local',status:{type:'active',activeFlags:mode==='approval'?['waitingOnApproval']:[]}},turns:[{id:mode==='newTurn'?newTurn:turn,status:'inProgress',items}]};
  const data=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:request.id,result:{success:mode!=='unavailable',contentItems:[{type:'inputText',text:JSON.stringify(body)}]}}));const frame=Buffer.alloc(data.length+4);frame.writeUInt32LE(data.length);data.copy(frame,4);socket.end(frame);
 });
});
await new Promise((res,rej)=>{bridge.once('error',rej);bridge.listen(pipe,res);});
const reservation=http.createServer();await new Promise(res=>reservation.listen(0,'127.0.0.1',res));const port=reservation.address().port;await new Promise(res=>reservation.close(res));
const url='http://127.0.0.1:'+port,headers={Origin:origin,'Content-Type':'application/json'};
async function until(check){const deadline=Date.now()+12000;while(Date.now()<deadline){try{if(await check())return;}catch{}await new Promise(res=>setTimeout(res,100));}throw Error('Health transition timed out.');}
async function current(){return(await fetch(url+'/states',{headers})).json();}
async function start(){child=spawn(process.execPath,[join(root,'server.mjs')],{windowsHide:true,stdio:'ignore',env:{...process.env,CODEX_MONITOR_DATA:base,CODEX_MONITOR_CONFIG:join(base,'config.local.json'),CODEX_MONITOR_SETTINGS:join(base,'settings.json'),CODEX_MONITOR_PORT:String(port)}});await until(async()=>Boolean((await current()).instanceId));}
async function stop(){const data=await current();await fetch(url+'/shutdown',{method:'POST',headers,body:JSON.stringify({instanceId:data.instanceId})});await until(()=>child.exitCode!==null);}
try{
 await mkdir(join(base,'events'));await mkdir(join(base,'desktop-bridges'));
 await writeFile(join(base,'linked.json'),JSON.stringify({ids:[id,other]}));
 await writeFile(join(base,'states.json'),JSON.stringify({[id]:{sessionId:id,turnId:turn,status:'aguardando_resposta',questionPending:true,questionToolId:'q',at:1},[other]:{sessionId:other,turnId:turn,status:'aguardando_aprovacao',approvalPending:true,at:1}}));
 await writeFile(join(base,'desktop-bridges',id+'.json'),JSON.stringify({pipe:pipe+'-closed',threadId:id,turnId:turn}));
 await writeFile(join(base,'desktop-bridges',other+'.json'),JSON.stringify({pipe,threadId:other,turnId:turn}));
 await writeFile(join(base,'desktop-bridges',unlinked+'.json'),JSON.stringify({pipe,threadId:unlinked,turnId:turn}));
 await writeFile(join(base,'config.local.json'),JSON.stringify({port,origins:[origin]}));
 await writeFile(join(base,'settings.json'),JSON.stringify({'electron-persisted-atom-state':{'heartbeat-thread-permissions-by-id':{[id]:{approvalsReviewer:'user'}}}}));
 await start();assert.equal((await current()).states[id].displayStatus,'nao_confirmado');
 await until(async()=>(await current()).states[other].displayStatus==='processando');
 await until(async()=>(await current()).states[id].verification.reason==='question_unconfirmed');
 assert.equal((await current()).states[id].questionPending,true);
 const instanceId=(await current()).instanceId;
 assert.equal((await fetch(url+'/recheck',{method:'POST',headers:{...headers,Origin:'http://evil.invalid'},body:JSON.stringify({id,instanceId})})).status,403);
 assert.equal((await fetch(url+'/recheck',{method:'POST',headers,body:JSON.stringify({id,instanceId:'wrong'})})).status,409);
 assert.equal((await fetch(url+'/recheck',{method:'POST',headers,body:JSON.stringify({id:unlinked,instanceId})})).status,404);
 modes[id]='reply';assert.equal((await fetch(url+'/recheck',{method:'POST',headers,body:JSON.stringify({id,instanceId})})).status,202);
 await until(async()=>(await current()).states[id].displayStatus==='processando');assert.equal((await current()).states[id].questionPending,false);
 modes[id]='approval';await until(async()=>(await current()).states[id].displayStatus==='aguardando_aprovacao');
 await stop();modes[id]='unavailable';await start();assert.equal((await current()).states[id].displayStatus,'nao_confirmado','Restart does not revive an unverified approval.');
 modes[id]='normal';await until(async()=>(await current()).states[id].displayStatus==='processando');assert.equal((await current()).states[id].approvalPending,false);
 modes[id]='newTurn';await until(async()=>(await current()).states[id].turnId===newTurn);assert.equal((await current()).states[id].displayStatus,'processando','A missed start hook recovers from latest-turn metadata.');
 await stop();assert.ok(!(await readFile(join(base,'states.json'),'utf8')).includes('PRIVATE'));assert.ok(!calls.includes(unlinked));
 console.log('PASS: automatic fallback/recovery, compacted question uncertainty, panel retry API, stale approval after restart, missed turn, linked-only privacy and shutdown.');
}finally{
 if(child&&child.exitCode===null){child.kill();await until(()=>child.exitCode!==null);}
 for(const socket of sockets)socket.destroy();await new Promise(res=>bridge.close(res));
 const target=resolve(base);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-health-'));await rm(target,{recursive:true,force:true});
}
