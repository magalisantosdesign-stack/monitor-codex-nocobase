import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const source=await readFile(new URL('../src/panel-tasks.jsx',import.meta.url),'utf8');
const cut=source.indexOf(' const projects=');assert.ok(cut>0);
function harness({demo=false,seed=[],failWrite=false,failRead=false}={}){
 const stored=structuredClone(seed),slots=[],writes=[];let cursor=0,page=1,gate,readGate,reading=0,maxReading=0;
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial){return slots[cursor++]??={current:initial};},useEffect(){cursor++;}};
 const resource={setResourceName(){},setPageSize(){},setAppends(){},setPage(value){page=value;},async refresh(){reading++;maxReading=Math.max(maxReading,reading);try{if(readGate)await readGate;if(failRead)throw Error('read denied');}finally{reading--;}},getData:()=>structuredClone(stored.slice((page-1)*200,page*200)),getTotalPage:()=>Math.max(1,Math.ceil(stored.length/200)),
  async create(values){writes.push({action:'create',values:structuredClone(values)});if(gate)await gate;if(failWrite)throw Error('denied');stored.push({id:stored.length+1,...structuredClone(values)});},
  async update(id,values){writes.push({action:'update',id,values:structuredClone(values)});if(gate)await gate;if(failWrite)throw Error('denied');Object.assign(stored.find(row=>row.id===id),structuredClone(values));},
 };
 const ctx={libs:{React,antd:{theme:{useToken:()=>({token:{}})}}},makeResource(){assert.equal(demo,false);return resource;}};
 const context=vm.createContext({ctx,window:{fetch(){throw Error('Tasks must never contact the collector');}}});
 const code=source.slice(0,cut).replace('demo:true','demo:'+demo)+`
 return {reload,openTask,closeTask,saveTask,changeStatus,setDraft,rows,opened,draft,formError,error,notice,saving};
 }
 globalThis.renderTasks=()=>Tasks();globalThis.validate=taskValues;globalThis.status=taskStatus;`;
 vm.runInContext(code,context);
 const h={stored,writes,validate:context.validate,status:context.status,render(){cursor=0;return context.renderTasks();},draft(value){h.render().setDraft({title:'Exemplo',project:'',link:'',status:'nao_iniciado',...value});return h.render();},gate(value){gate=value;},readGate(value){readGate=value;},get maxReading(){return maxReading;}};return h;
}
const chat='codex://threads/00000000-0000-4000-8000-000000000001';
test('Task without chat remains in the board after create, reload and reopen',async()=>{
 const h=harness();h.render().openTask();await h.draft({title:' Planejar exemplo ',project:' Projeto fictício '}).saveTask();
 assert.deepEqual(h.stored,[{id:1,title:'Planejar exemplo',project:'Projeto fictício',linkCodex:'',status:'nao_iniciado'}]);
 await h.render().reload();assert.equal(h.render().rows.length,1);assert.equal(h.render().opened,false);
 h.render().openTask(h.render().rows[0]);assert.equal(h.render().draft.title,'Planejar exemplo');
});
test('Business conclusion only changes status, preserving the link and task',async()=>{
 const h=harness({seed:[{id:1,title:'Exemplo',linkCodex:chat,status:'em_andamento'}]});await h.render().reload();
 await h.render().changeStatus(h.render().rows[0],'concluido');
 assert.deepEqual(h.writes,[{action:'update',id:1,values:{status:'concluido'}}]);assert.equal(h.stored[0].linkCodex,chat);assert.equal(h.render().rows[0].status,'concluido');
});
test('Edit can change or remove the chat link without deleting the task',async()=>{
 const h=harness({seed:[{id:1,title:'Exemplo',project:'Projeto fictício',linkCodex:chat,status:'aguardando'}]});await h.render().reload();h.render().openTask(h.render().rows[0]);
 await h.draft({title:'Exemplo revisado',status:'aguardando',link:''}).saveTask();assert.equal(h.stored.length,1);assert.equal(h.stored[0].linkCodex,'');assert.equal(h.stored[0].title,'Exemplo revisado');
});
test('Empty names, long fields, invalid links and unsupported situations block writes',async()=>{
 for(const input of [{title:''},{title:'a'.repeat(201)},{project:'a'.repeat(121)},{link:'https://example.invalid/share/chat'},{status:'respondido'}]){const h=harness();await h.draft(input).saveTask();assert.equal(h.writes.length,0);assert.ok(h.render().formError);}
});
test('Failed write preserves form and a failed move does not change the card',async()=>{
 const h=harness({failWrite:true,seed:[{id:1,title:'Exemplo',status:'nao_iniciado'}]});await h.render().reload();h.render().openTask();await h.draft({title:'Não perder texto'}).saveTask();assert.equal(h.render().opened,true);assert.equal(h.render().draft.title,'Não perder texto');assert.ok(h.render().formError);
 await h.render().changeStatus(h.stored[0],'concluido');assert.equal(h.render().rows[0].status,'nao_iniciado');assert.ok(h.render().error);
});
test('Duplicate save and close while saving cannot lose the submitted form',async()=>{
 const h=harness();let release;h.gate(new Promise(resolve=>{release=resolve;}));h.render().openTask();const p=h.draft({title:'Exemplo'}),saving=p.saveTask();await p.saveTask();h.render().closeTask();assert.equal(h.render().opened,true);assert.equal(h.writes.length,1);release();await saving;assert.equal(h.stored.length,1);
});
test('Pagination is serialized and includes records after the first 200',async()=>{
 const seed=Array.from({length:205},(_,i)=>({id:i+1,title:'Exemplo '+i,status:'nao_iniciado'})),h=harness({seed});let release;h.readGate(new Promise(resolve=>{release=resolve;}));const p=h.render(),a=p.reload(),b=p.reload();release();await Promise.all([a,b]);assert.equal(h.maxReading,1);assert.equal(h.render().rows.length,205);
});
test('Demo can open forms but cannot create, edit, move or access any resource',async()=>{
 const h=harness({demo:true});await h.render().reload();assert.equal(h.render().rows.length,5);h.render().openTask(h.render().rows[0]);await h.draft({title:'Exemplo'}).saveTask();await h.render().changeStatus(h.render().rows[0],'concluido');assert.equal(h.writes.length,0);
});
test('Older empty status defaults for display; unknown statuses are not discarded',()=>{
 const h=harness();assert.equal(h.status({}), 'nao_iniciado');assert.equal(h.status({status:'legacy_value'}),'legacy_value');assert.match(source,/Situação não reconhecida/);
});
test('Schema migration adds only the task status; enum matches both panels',async()=>{
 const schema=JSON.parse(await readFile(new URL('../config/nocobase-tasks.json',import.meta.url),'utf8')),migration=JSON.parse(await readFile(new URL('../config/nocobase-task-status.json',import.meta.url),'utf8'));
 assert.equal(migration.collectionName,schema.name);assert.equal(migration.name,'status');assert.equal(migration.interface,'select');assert.equal(migration.fields,undefined);assert.equal(migration.replaceFields,undefined);assert.equal(migration.enum.length,5);
 for(const choice of migration.enum){assert.ok(choice.label&&choice.color);assert.ok(source.includes("value:'"+choice.value+"'"));}
 const monitor=await readFile(new URL('../src/panel.jsx',import.meta.url),'utf8');assert.match(monitor,/values\[creation.statusField\]='nao_iniciado'/);assert.match(monitor,/<Drawer title="Nova tarefa"/);assert.match(monitor,/>Cadastrar nova tarefa<\/Button>/);
});
