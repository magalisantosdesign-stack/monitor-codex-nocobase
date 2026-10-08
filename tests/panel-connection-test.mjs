import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source=await readFile(new URL('../src/panel.jsx',import.meta.url),'utf8');
const cut=source.indexOf(' const grouped=new Map();');
assert.ok(cut>0,'A lógica de conexão deve preceder a renderização JSX.');
assert.match(source,/<Button disabled=\{disconnecting\|\|reconnecting\} onClick=\{refresh\}>Atualizar<\/Button>/);
const executable=source.slice(0,cut)+`
 return {poll,reload,refresh,recheck,reconnect,disconnect,paused,connectionEpoch};
}
globalThis.renderMonitor=()=>Monitor();
globalThis.useRealData=()=>{MONITOR_CONFIG.demo=false;};
`;
function harness(){
 const slots=[],requests=[],messages=[];let cursor=0,running=true,shutdownGate;
 const React={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=value;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useEffect(){cursor++;},
 };
 const response=data=>({ok:true,json:async()=>data});
 let nextStates;
 const window={AbortSignal,clearTimeout(){},setTimeout(fn){queueMicrotask(fn);return 1;},fetch:async(url,options={})=>{
  requests.push({url,...options});
  if(url.endsWith('/shutdown')){
   assert.equal(JSON.parse(options.body).instanceId,'synthetic-instance');
   if(shutdownGate)await shutdownGate;
   running=false;return response({ok:true});
  }
  if(!running)throw Error('Coletor encerrado');
  if(url.endsWith('/linked'))return response({ok:true});
  if(url.endsWith('/recheck')){assert.equal(JSON.parse(options.body).instanceId,'synthetic-instance');return response({ok:true});}
  assert.ok(url.endsWith('/states'),'Nenhum comando ou serviço externo é permitido.');
  if(nextStates){const deferred=nextStates;nextStates=null;return deferred;}
  return response({service:'codex-monitor',instanceId:'synthetic-instance',states:{}});
 }};
 const ctx={libs:{React,antd:{theme:{useToken:()=>({token:{}})}}},message:{success:x=>messages.push(x),error:x=>messages.push(x)},makeResource:()=>({setResourceName(){},setPageSize(){},setAppends(){},setPage(){},async refresh(){},getData:()=>[],getTotalPage:()=>1})};
 const context=vm.createContext({ctx,window,document:{querySelector:()=>null}});
 vm.runInContext(executable,context);
 return {slots,requests,messages,response,
  render(){cursor=0;return context.renderMonitor();},
  real(){context.useRealData();},
  start(){running=true;},
  deferStates(promise){nextStates=promise;},
  gateShutdown(promise){shutdownGate=promise;},
 };
}

test('Sem extensão: desconectar, iniciar manualmente e Atualizar retomam a observação',async()=>{
 const h=harness();h.real();let panel=h.render();
 await panel.poll();assert.equal(h.slots[2],true);
 await panel.disconnect();assert.equal(h.slots[2],false);assert.equal(panel.paused.current,true);
 h.start();const count=h.requests.length;
 await panel.poll();await panel.reload();
 assert.equal(h.requests.slice(count).filter(r=>r.url.endsWith('/states')).length,0,'O temporizador não reativa consultas pausadas.');
 panel=h.render();await panel.refresh();assert.equal(h.slots[2],true);assert.equal(panel.paused.current,false);
 assert.equal(h.requests.filter(r=>r.url.endsWith('/shutdown')).length,1);
});

test('Atualizar invalida uma resposta antiga que terminou após a nova consulta',async()=>{
 const h=harness();h.real();const panel=h.render();let resolveOld;
 h.deferStates(new Promise(resolve=>{resolveOld=resolve;}));
 const stalePoll=panel.poll();
 await panel.refresh();assert.equal(h.slots[2],true);
 resolveOld(h.response({service:'codex-monitor',instanceId:'old',states:{old:{status:'respondido'}}}));
 await stalePoll;assert.equal(Object.keys(h.slots[1]).length,0,'Resposta antiga não substitui o estado atual.');
});

test('Atualizar não interfere em um encerramento pendente',async()=>{
 const h=harness();h.real();let panel=h.render();await panel.poll();let release;
 h.gateShutdown(new Promise(resolve=>{release=resolve;}));
 const disconnect=panel.disconnect();panel=h.render();const count=h.requests.length;
 await panel.refresh();assert.equal(h.requests.length,count);assert.equal(panel.paused.current,true);
 release();await disconnect;assert.equal(h.slots[2],false);
});

test('Conectar sem ponte explica o caminho manual e não executa comandos',()=>{
 const h=harness();h.real();h.render().reconnect({currentTarget:{getAttribute:()=>null}});
 assert.equal(h.requests.length,0);assert.ok(h.slots.some(value=>typeof value==='string'&&value.includes('Iniciar-Monitor.cmd')&&value.includes('Atualizar')));
});

test('Atualizar na demonstração permanece sem rede',async()=>{
 const h=harness();await h.render().refresh();assert.equal(h.requests.length,0);assert.equal(h.slots[2],true);
});

test('Tentar novamente solicita apenas leitura do chat vinculado, sem reiniciar o coletor',async()=>{
 const h=harness();h.real();await h.render().poll();await h.render().recheck('00000000-0000-4000-8000-000000000001');
 assert.equal(h.requests.filter(r=>r.url.endsWith('/recheck')).length,1);
 assert.equal(h.requests.filter(r=>r.url.endsWith('/shutdown')).length,0);
 assert.ok(h.messages.some(message=>message.includes('continua automático')));
});

test('Tentar novamente na demonstração permanece sem rede',async()=>{
 const h=harness();await h.render().poll();await h.render().recheck('00000000-0000-4000-8000-000000000001');assert.equal(h.requests.length,0);
});
