import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32'){console.log('SKIP: Windows desktop pipe integration.');process.exit(0);}
const root=dirname(fileURLToPath(import.meta.url)),base=await mkdtemp(join(tmpdir(),'monitor-runtime-'));
const id='00000000-0000-4000-8000-000000000001',turn='00000000-0000-4000-8000-000000000002';
const pipe='\\\\.\\pipe\\codex-monitor-test-'+process.pid+'-'+randomUUID(),origin='http://localhost:14000';
let replied=false,calls=0,child;const sockets=new Set();
const bridge=net.createServer(socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
 socket.on('data',part=>{
  buffer=Buffer.concat([buffer,part]);if(buffer.length<4||buffer.length<4+buffer.readUInt32LE(0))return;
  const request=JSON.parse(buffer.subarray(4,4+buffer.readUInt32LE(0)));calls++;
  assert.equal(request.params.tool,'read_thread');assert.equal(request.params.arguments.threadId,id);
  assert.equal(request.params.arguments.includeOutputs,false);assert.equal(request.params.arguments.maxOutputCharsPerItem,0);
  const items=[{type:'agentMessage',id:'question',text:'SECRET_QUESTION'}];
  if(replied)items.push({type:'userMessage',id:'reply',content:'SECRET_REPLY'});
  const body={thread:{id,hostId:'local',status:{type:'active',activeFlags:[]}},turns:[{id:turn,status:'inProgress',items}]};
  const data=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:request.id,result:{success:true,contentItems:[{type:'inputText',text:JSON.stringify(body)}]}}));
  const response=Buffer.alloc(data.length+4);response.writeUInt32LE(data.length);data.copy(response,4);socket.end(response);
 });
});
await new Promise((res,rej)=>{bridge.once('error',rej);bridge.listen(pipe,res);});
const reservation=http.createServer();await new Promise(res=>reservation.listen(0,'127.0.0.1',res));const port=reservation.address().port;await new Promise(res=>reservation.close(res));
const url='http://127.0.0.1:'+port,headers={Origin:origin,'Content-Type':'application/json'};
async function until(check){const deadline=Date.now()+12000;while(Date.now()<deadline){try{if(await check())return;}catch{}await new Promise(res=>setTimeout(res,100));}throw Error('Synthetic runtime transition timed out.');}
async function states(){return (await fetch(url+'/states',{headers})).json();}
try{
 await mkdir(join(base,'desktop-bridges'));await mkdir(join(base,'events'));
 await writeFile(join(base,'linked.json'),JSON.stringify({ids:[id]}));
 await writeFile(join(base,'states.json'),JSON.stringify({[id]:{sessionId:id,turnId:turn,at:1,status:'aguardando_resposta',questionPending:true,questionToolId:'question',approvalPending:false}}));
 await writeFile(join(base,'desktop-bridges',id+'.json'),JSON.stringify({pipe,threadId:id,turnId:turn}));
 await writeFile(join(base,'config.local.json'),JSON.stringify({port,origins:[origin]}));
 child=spawn(process.execPath,[join(root,'server.mjs')],{windowsHide:true,stdio:'ignore',env:{...process.env,CODEX_MONITOR_DATA:base,CODEX_MONITOR_CONFIG:join(base,'config.local.json'),CODEX_MONITOR_SETTINGS:join(base,'missing.json'),CODEX_MONITOR_PORT:String(port)}});
 await until(async()=>Boolean((await states()).instanceId));await until(()=>calls>0);
 assert.equal((await states()).states[id].status,'aguardando_resposta','Working while a question is open must not clear it.');
 replied=true;await until(async()=>(await states()).states[id].status==='processando');
 const state=(await states()).states[id];assert.equal(state.questionPending,false);assert.equal(state.lastEvent,'DesktopStatus');
 await writeFile(join(base,'events',Date.now()+'-'+randomUUID()+'.json'),JSON.stringify({sessionId:id,turnId:turn,event:'Stop',subagent:false,at:Date.now()}));
 await until(async()=>(await states()).states[id].status==='respondido');
 assert.ok(!(await readFile(join(base,'states.json'),'utf8')).includes('SECRET'));
 assert.ok((await readdir(base)).every(name=>!name.includes('transcript')));
 const current=await states();await fetch(url+'/shutdown',{method:'POST',headers,body:JSON.stringify({instanceId:current.instanceId})});
 await until(()=>child.exitCode!==null);
 console.log('PASS: automatic same-turn reply via desktop metadata, genuine pending question, linked-only query, final response, privacy and shutdown.');
}finally{
 if(child&&child.exitCode===null){child.kill();await until(()=>child.exitCode!==null);}
 for(const socket of sockets)socket.destroy();await new Promise(res=>bridge.close(res));
 const target=resolve(base);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-runtime-'));await rm(target,{recursive:true,force:true});
}
