import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('panel.jsx',import.meta.url),'utf8');
const begin=source.indexOf(' function reconnect(event){'),end=source.indexOf(' async function bind(){',begin);
assert(begin>=0&&end>begin);
function fixture(){
 const timers=[],updates=[],clears=[],mounted={current:true},reconnectTimer={current:null};
 const sandbox={mounted,reconnectTimer,reconnecting:false,paused:{current:false},connectionEpoch:{current:0},MONITOR_CONFIG:{demo:false},setReconnecting:value=>updates.push(['busy',value]),setReconnectError:value=>updates.push(['message',value]),
  window:{setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},clearTimeout:value=>clears.push(value)}};
 const context=vm.createContext(sandbox);vm.runInContext(source.slice(begin,end),context);
 return{context,timers,updates,clears,mounted,click:()=>vm.runInContext("reconnect({currentTarget:{getAttribute:()=> 'ready'}})",context)};
}
test('Reconnect starts polling after the installed bridge receives the click',()=>{
 const f=fixture();f.click();assert.deepEqual(f.updates,[]);assert.equal(f.timers[0].delay,0);
 f.timers[0].fn();assert.deepEqual(f.updates,[['message',''],['busy',true]]);assert.equal(f.timers[1].delay,45000);
 f.timers[1].fn();assert.deepEqual(f.updates[2],['busy',false]);assert.match(f.updates[3][1],/Instalar-Ponte-Navegadores.ps1/);
});
test('Reconnect cancels deferred work after unmount and ignores repeated busy clicks',()=>{
 const f=fixture();f.click();f.mounted.current=false;f.timers[0].fn();assert.deepEqual(f.updates,[]);assert.equal(f.timers.length,1);
 f.context.reconnecting=true;f.click();assert.equal(f.timers.length,1);
});

test('Missing browser bridge reports setup without a fake connection attempt',()=>{const f=fixture();vm.runInContext('reconnect({currentTarget:{getAttribute:()=>null}})',f.context);assert.equal(f.timers.length,0);assert.match(f.updates[0][1],/NAVEGADORES.md/);});
