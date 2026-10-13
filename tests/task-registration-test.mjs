import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source=await readFile(new URL('../src/panel.jsx',import.meta.url),'utf8');
const cut=source.indexOf(' const grouped=new Map();');
assert.ok(cut>0);
const executable=source.slice(0,cut)+`
 return {createTask,openTask,cancelTask,reload,bind,setTaskTitle,setTaskProject,setTaskLink,setSelected,setLink,
 taskForm,taskTitle,taskProject,taskLink,taskError,taskNotice,creatingTask,bindings};
}
globalThis.renderMonitor=()=>Monitor();
globalThis.config=MONITOR_CONFIG;
`;
const chat='00000000-0000-4000-8000-000000000001';
function harness({demo=false,offline=false,readError=false,createError=false}={}){
 const slots=[],stored=[],writes=[],messages=[];let cursor=0,gate;
 const React={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=value;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useEffect(){cursor++;},
 };
 const ctx={libs:{React,antd:{theme:{useToken:()=>({token:{}})}}},message:Object.fromEntries(['info','warning','success','error'].map(kind=>[kind,text=>messages.push({kind,text})])),makeResource(){
  assert.equal(demo,false,'Demo must never access NocoBase');
  let collection;
  return {
   setResourceName(value){collection=value;},setPageSize(){},setAppends(){},setPage(){},
   async refresh(){if(readError)throw Error('Read denied');},getData:()=>stored.map(row=>({...row})),getTotalPage:()=>1,
   async create(values,options){
    writes.push({collection,values:JSON.parse(JSON.stringify(values)),options});
    if(gate)await gate;
    if(createError)throw Error('Create denied');
    stored.push({id:stored.length+1,...JSON.parse(JSON.stringify(values))});
   },
   async update(id,values){Object.assign(stored.find(row=>row.id===id),values);},
  };
 }};
 const requests=[];
 const window={AbortSignal,fetch:async(url,options)=>{
  assert.equal(demo,false,'Demo must never use network');requests.push({url,options});
  if(offline)throw Error('Collector offline');
  return {ok:true,json:async()=>({service:'codex-monitor',instanceId:'synthetic-instance',states:{}})};
 }};
 const context=vm.createContext({ctx,window});vm.runInContext(executable,context);context.config.demo=demo;
 const h={stored,writes,requests,messages,config:context.config,
  render(){cursor=0;return context.renderMonitor();},
  fill({title='',project='',link=''}={}){const p=h.render();p.setTaskTitle(title);p.setTaskProject(project);p.setTaskLink(link);p.openTask();return h.render();},
  gate(promise){gate=promise;},
 };
 return h;
}

test('Empty install: create without a chat, reopen, select and link the saved task',async()=>{
 const h=harness();await h.render().reload();assert.equal(h.render().bindings.length,0);
 await h.fill({title:' Tarefa fictícia ',project:' Projeto de exemplo '}).createTask();
 assert.deepEqual(h.stored,[{id:1,title:'Tarefa fictícia',project:'Projeto de exemplo',linkCodex:''}]);
 assert.equal(h.render().taskForm,false);assert.equal(h.render().taskTitle,'');
 await h.render().reload();let panel=h.render();assert.equal(panel.bindings.length,1);
 assert.equal(panel.bindings[0].chat,null);assert.equal(panel.bindings[0].title,'Tarefa fictícia');
 panel.setSelected(panel.bindings[0].key);panel.setLink(chat);await h.render().bind();
 assert.equal(h.stored[0].linkCodex,'codex://threads/'+chat);
 assert.equal(h.render().bindings[0].chat,chat);
});

test('Create and link in one save, including when the collector is offline',async()=>{
 const h=harness({offline:true});await h.fill({title:'Exemplo',link:'codex://threads/'+chat+'?view=review'}).createTask();
 assert.equal(h.writes.length,1);assert.equal(h.stored[0].linkCodex,'codex://threads/'+chat);
 assert.equal(h.render().bindings[0].chat,chat);assert.equal(h.render().taskForm,false);
 assert.match(h.render().taskNotice,/cadastrada com o chat vinculado/);assert.equal(h.render().taskError,'');
});

test('Invalid or oversized input never creates a record',async()=>{
 for(const input of [{title:'  '},{title:'x'.repeat(201)},{title:'Exemplo',project:'x'.repeat(121)},{title:'Exemplo',link:'https://example.invalid/share/not-a-local-chat'}]){
  const h=harness();await h.fill(input).createTask();assert.equal(h.writes.length,0);assert.equal(h.stored.length,0);assert.ok(h.render().taskError);
 }
});

test('Creation is locked synchronously against duplicate submission and cancellation',async()=>{
 const h=harness();let release;h.gate(new Promise(resolve=>{release=resolve;}));
 let panel=h.fill({title:'Exemplo'});const pending=panel.createTask();await panel.createTask();
 panel=h.render();panel.cancelTask();assert.equal(h.render().taskForm,true);assert.equal(h.writes.length,1);
 release();await pending;assert.equal(h.stored.length,1);assert.equal(h.render().creatingTask,false);
});

test('Permission failure keeps inputs and explains uncertain transport outcomes',async()=>{
 const h=harness({createError:true});await h.fill({title:'Exemplo',project:'Projeto fictício'}).createTask();
 const panel=h.render();assert.equal(h.stored.length,0);assert.equal(panel.taskForm,true);assert.equal(panel.taskTitle,'Exemplo');
 assert.match(panel.taskError,/confirmar o cadastro/);assert.match(panel.taskError,/procure a tarefa antes de tentar novamente/);assert.equal(panel.creatingTask,false);
});

test('A read failure after confirmed creation is not reported as a failed save',async()=>{
 const h=harness({readError:true});await h.fill({title:'Exemplo'}).createTask();
 assert.equal(h.stored.length,1);assert.equal(h.render().taskForm,false);assert.equal(h.render().taskError,'');assert.match(h.render().taskNotice,/Tarefa cadastrada/);
});

test('Demo and disabled/unmapped creation cannot write or contact the collector',async()=>{
 const demo=harness({demo:true});await demo.fill({title:'Exemplo',link:chat}).createTask();await demo.render().reload();
 assert.equal(demo.render().taskForm,true);assert.equal(demo.writes.length,0);assert.equal(demo.requests.length,0);
 for(const settings of [false,{collection:'missing',titleField:'title',linkField:'linkCodex'}]){
  const h=harness();h.config.taskCreation=settings;await h.fill({title:'Exemplo'}).createTask();assert.equal(h.writes.length,0);assert.ok(h.render().taskError);
 }
});

test('The packaged model supplies all fields written and read by both default panels',async()=>{
 const schema=JSON.parse(await readFile(new URL('../config/nocobase-tasks.json',import.meta.url),'utf8'));
 const h=harness();const creation=h.config.taskCreation,fields=new Map(schema.fields.map(field=>[field.name,field]));
 assert.equal(schema.name,creation.collection);assert.equal(schema.template,'general');assert.equal(schema.replaceFields,undefined);
 assert.equal(fields.has('id'),false,'System primary key must be created by the template');
 for(const key of ['titleField','projectField','linkField'])assert.equal(fields.get(creation[key])?.interface,'input');
 assert.ok(fields.get(creation.titleField).validation.rules.some(rule=>rule.name==='required'));
 const usage=await readFile(new URL('../src/panel-usage.jsx',import.meta.url),'utf8');
 assert.ok(usage.includes("collection: '"+schema.name+"'"));
 for(const key of ['titleField','linkField'])assert.ok(usage.includes(key+": '"+creation[key]+"'"));
});
