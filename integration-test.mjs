import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const base=await mkdtemp(join(tmpdir(),'codex-monitor-test-'));
const id='00000000-0000-4000-8000-000000000001';
const port=13191,headers={Origin:'http://localhost:13000','Content-Type':'application/json'};
const settings=join(base,'settings.json');
const reviewerConfig=reviewer=>({'electron-persisted-atom-state':{'heartbeat-thread-permissions-by-id':{[id]:{approvalsReviewer:reviewer,prompt:'SECRET_MUST_NOT_PERSIST'}}}});
await writeFile(settings,JSON.stringify(reviewerConfig('user')));
const env={...process.env,CODEX_MONITOR_DATA:base,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_SETTINGS:settings};
const service=spawn(process.execPath,[join(root,'server.mjs')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{service.once('error',reject);service.stdout.once('data',resolve);service.once('exit',code=>reject(new Error('server exited '+code)));});
 const url='http://127.0.0.1:'+port;
 assert.equal((await fetch(url+'/states',{headers:{Origin:'http://evil.example'}})).status,403);
 assert.equal((await fetch(url+'/diagnostics',{headers:{Origin:'http://evil.example'}})).status,403);
 assert.equal((await fetch(url+'/linked',{method:'POST',headers,body:JSON.stringify({ids:[id]})})).status,200);
 async function hook(session,name,extra={}){
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'hook.mjs')],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
   child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('hook failed')));
   child.stdin.end(JSON.stringify({session_id:session,turn_id:'test-turn',hook_event_name:name,prompt:'SECRET_MUST_NOT_PERSIST',...extra}));});
 }
 await hook('00000000-0000-4000-8000-000000000002','UserPromptSubmit');
 assert.equal((await readdir(join(base,'events'))).length,0);
 await hook(id,'UserPromptSubmit');await hook(id,'PermissionRequest',{tool_name:'Bash'});
 let body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'aguardando_aprovacao');
 await hook(id,'PostToolUse',{tool_name:'Bash'});await hook(id,'Stop');
 body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'respondido');
 assert.equal((await readFile(join(base,'states.json'),'utf8')).includes('SECRET'),false);
 // Missing prompt hook: main-thread execution still starts automatically.
 await hook(id,'PreToolUse',{turn_id:'second-turn',tool_name:'Bash',tool_use_id:'pending'});
 body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'processando');
 await hook(id,'PermissionRequest',{turn_id:'second-turn',tool_name:'Bash'});
 await hook(id,'PostToolUse',{turn_id:'second-turn',tool_name:'Bash',tool_use_id:'other'});
 body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'aguardando_aprovacao');
 await hook(id,'Stop',{turn_id:'second-turn'});
 await hook(id,'PreToolUse',{turn_id:'child-turn',agent_id:'child',tool_name:'Bash'});
 body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'respondido');
 await writeFile(settings,JSON.stringify(reviewerConfig('auto_review')));
 await hook(id,'PreToolUse',{turn_id:'third-turn',tool_name:'Bash'});
 await hook(id,'PermissionRequest',{turn_id:'third-turn',tool_name:'Bash'});
 body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'processando');
 await hook(id,'Stop',{turn_id:'second-turn'});
 body=await (await fetch(url+'/states',{headers})).json();assert.equal(body.states[id].status,'processando');
 // Begin collecting halfway through a run, when a child tool is active.
 await fetch(url+'/linked',{method:'POST',headers,body:JSON.stringify({ids:[]})});
 await fetch(url+'/linked',{method:'POST',headers,body:JSON.stringify({ids:[id]})});
 await hook(id,'PostToolUse',{turn_id:'child-turn',agent_id:'child',tool_name:'Bash'});
 await hook(id,'Stop',{turn_id:'root-turn'});
 await hook(id,'PostToolUse',{turn_id:'child-turn',agent_id:'child',tool_name:'Bash'});
 body=await (await fetch(url+'/states',{headers})).json();
 assert.equal(body.states[id].status,'respondido');assert.equal(body.states[id].turnId,'root-turn');
 await fetch(url+'/states',{headers:{...headers,'User-Agent':'Mozilla/5.0 test-only'}});
 const diagnostics=await (await fetch(url+'/diagnostics',{headers})).json();
 assert.equal(diagnostics.browserPolls,1);assert.equal(diagnostics.lastBrowserPoll.states[id].status,'respondido');
 assert.equal(diagnostics.events.find(e=>e.event==='Stop').accepted,true);
 assert.equal(JSON.stringify(diagnostics).includes('SECRET'),false);
 await fetch(url+'/linked',{method:'POST',headers,body:JSON.stringify({ids:[]})});
 body=await (await fetch(url+'/states',{headers})).json();assert.deepEqual(body.states,{});
 console.log('PASS: local HTTP, CORS, linked-only capture, real hook process, states and removal');
}finally{
 service.kill();await new Promise(resolve=>service.once('exit',resolve));
 for(const name of await readdir(join(base,'events')))await unlink(join(base,'events',name));await rmdir(join(base,'events'));
 for(const name of await readdir(base))await unlink(join(base,name));await rmdir(base);
}
