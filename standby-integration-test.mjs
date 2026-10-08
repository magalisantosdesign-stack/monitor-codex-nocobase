import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readdir,unlink,rmdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url)),base=await mkdtemp(join(tmpdir(),'monitor-standby-test-'));
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const port=13192,url='http://127.0.0.1:'+port,headers={Origin:'http://localhost:13000','Content-Type':'application/json'};
const settings=join(base,'settings.json');await writeFile(settings,'{}');
const env={...process.env,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_DATA:base,CODEX_MONITOR_SETTINGS:settings};
let service,sequence=0;
async function start(){
 service=spawn(process.execPath,[join(root,'server.mjs')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{service.once('error',reject);service.stdout.once('data',resolve);service.once('exit',code=>reject(Error('Server exited: '+code)));});
}
async function stop(){if(service&&service.exitCode===null){const exited=new Promise(resolve=>service.once('exit',resolve));service.kill();await exited;}}
async function post(path,body,expected=200){const r=await fetch(url+path,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,expected);}
async function state(){return(await(await fetch(url+'/states',{headers})).json()).states;}
async function event(name,turn,extra={}){
 const at=Date.now();sequence++;
 await writeFile(join(base,'events',`${at}-${String(sequence).padStart(8,'0')}.json`),JSON.stringify({sessionId:id,event:name,turnId:turn,at,subagent:false,...extra}));
 return state();
}
try{
 await start();
 await post('/linked',{ids:[id]});
 await post('/standby',{id:other,enabled:true},404);
 await post('/standby',{id,enabled:'yes'},400);
 assert.equal((await fetch(url+'/standby',{method:'POST',headers:{...headers,Origin:'http://evil.example'},body:JSON.stringify({id,enabled:true})})).status,403);
 await event('UserPromptSubmit','first');await post('/standby',{id,enabled:true},409);
 await event('PreToolUse','first',{question:true,asyncQuestion:true,tool:'request_user_input_async'});
 await event('Stop','first');await post('/standby',{id,enabled:true},409);
 await event('UserPromptSubmit','second');await event('Stop','second');
 const original=(await state())[id];await post('/standby',{id,enabled:true});
 let s=(await state())[id];assert.equal(s.standby,true);assert.equal(s.status,'respondido');assert.equal(s.at,original.at);
 await stop();await start();assert.equal((await state())[id].standby,true);
 s=(await event('PreToolUse','child',{subagent:true}))[id];assert.equal(s.standby,true);
 s=(await event('Stop','first'))[id];assert.equal(s.standby,true);
 s=(await event('PostToolUse','second'))[id];assert.equal(s.standby,true);
 s=(await event('SessionEnd','second'))[id];assert.equal(s.standby,true);
 s=(await event('PreToolUse','third',{tool:'read'}))[id];assert.equal(s.standby,false);assert.equal(s.status,'processando');
 await event('Stop','third');await post('/standby',{id,enabled:true});await post('/standby',{id,enabled:false});
 assert.equal((await state())[id].standby,false);
 await post('/standby',{id,enabled:true});s=(await event('UserPromptSubmit','fourth'))[id];assert.equal(s.standby,false);
 await event('Stop','fourth');await post('/standby',{id,enabled:true});await post('/linked',{ids:[]});
 assert.deepEqual(await state(),{});assert.deepEqual(JSON.parse(await readFile(join(base,'standby.json'),'utf8')),{});
 console.log('PASS: Stand-by HTTP, persistence after restart, late/child events, new execution, manual resume, pending requests, CORS and unlink cleanup');
}finally{
 await stop();
 for(const name of await readdir(join(base,'events')).catch(e=>{if(e.code==='ENOENT')return[];throw e;}))await unlink(join(base,'events',name));
 await rmdir(join(base,'events')).catch(e=>{if(e.code!=='ENOENT')throw e;});
 for(const name of await readdir(base))await unlink(join(base,name));await rmdir(base);
}
