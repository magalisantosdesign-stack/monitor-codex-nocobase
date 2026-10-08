import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('..',import.meta.url);
const chromium=JSON.parse(await fs.readFile(new URL('extensions/chromium/manifest.json',root),'utf8'));
const firefox=JSON.parse(await fs.readFile(new URL('extensions/firefox/manifest.json',root),'utf8'));
test('Chromium and Firefox packages retain narrow permissions and synchronized logic',async()=>{
 for(const manifest of [chromium,firefox]){
  assert.deepEqual(manifest.permissions,['nativeMessaging']);
  assert.deepEqual(manifest.content_scripts[0].matches,['http://127.0.0.1:13000/*','http://localhost:13000/*']);
  assert.equal(manifest.version,'0.6.0');assert.equal(manifest.externally_connectable,undefined);
 }
 assert.equal(chromium.background.service_worker,'background.js');assert.equal(firefox.background.service_worker,undefined);
 assert.deepEqual(firefox.background.scripts,['background.js']);assert.equal(firefox.key,undefined);
 assert.equal(firefox.browser_specific_settings.gecko.id,'monitor-codex@local.invalid');
 for(const file of ['background.js','content.js'])assert.equal(await fs.readFile(new URL('extensions/chromium/'+file,root),'utf8'),await fs.readFile(new URL('extensions/firefox/'+file,root),'utf8'));
});
test('Firefox promise API preserves replies and rejects untrusted pages',async()=>{
 let listener,calls=0,fail=false;
 const browser={runtime:{id:firefox.browser_specific_settings.gecko.id,onMessage:{addListener:fn=>listener=fn},sendNativeMessage(name,msg){calls++;assert.equal(name,'local.codex_monitor');assert.deepEqual(msg.action,'start');return fail?Promise.reject(Error('unavailable')):Promise.resolve({ok:true});}}};
 vm.runInNewContext(await fs.readFile(new URL('extensions/firefox/background.js',root),'utf8'),{browser,URL,Set});
 const sender={id:browser.runtime.id,url:'http://localhost:13000/admin/example',frameId:0};
 assert.equal((await listener({action:'start'},sender,()=>assert.fail('must return Promise'))).ok,true);
 fail=true;assert.equal((await listener({action:'start'},sender,()=>assert.fail())).code,'BRIDGE_UNAVAILABLE');
 for(const source of [{...sender,frameId:1},{...sender,id:'foreign'},{...sender,url:'http://localhost:13001/'},{...sender,url:'https://example.com/'}])assert.equal(listener({action:'start'},source,()=>assert.fail()),false);
 assert.equal(listener({action:'start',command:'whoami'},sender,()=>assert.fail()),false);assert.equal(calls,2);
});
for(const promises of [false,true])test('Content script only forwards trusted connect clicks ('+(promises?'Firefox':'Chromium')+')',async()=>{
 let click,calls=0,fail=false;
 const attributes=new Map();const button={disabled:false,setAttribute:(name,value)=>attributes.set(name,value),getAttribute:name=>attributes.get(name)};
 const runtime={sendMessage(msg,reply){calls++;assert.equal(msg.action,'start');if(promises)return fail?Promise.reject(Error()):Promise.resolve({ok:true});reply({ok:true});}};
 const document={documentElement:{},querySelectorAll:()=>[button],addEventListener:(type,fn)=>click=fn};
 const context={document,MutationObserver:class{observe(){}},[promises?'browser':'chrome']:{runtime}};
 vm.runInNewContext(await fs.readFile(new URL('extensions/chromium/content.js',root),'utf8'),context);
 assert.equal(attributes.get('data-codex-monitor-bridge'),'ready');
 const event={isTrusted:true,target:{closest:()=>button}};
 click({...event,isTrusted:false});assert.equal(calls,0);
 button.disabled=true;click(event);assert.equal(calls,0);button.disabled=false;
 attributes.set('data-codex-monitor-demo','true');click(event);assert.equal(calls,0);attributes.delete('data-codex-monitor-demo');
 click(event);await Promise.resolve();assert.equal(calls,1);assert.equal(attributes.get('data-codex-monitor-result'),'started');
 attributes.set('data-codex-monitor-result','pending');click(event);assert.equal(calls,1);attributes.delete('data-codex-monitor-result');
 if(promises){fail=true;click(event);await Promise.resolve();assert.equal(attributes.get('data-codex-monitor-result'),'BRIDGE_UNAVAILABLE');}
});
test('Windows browser installer is validated with synthetic files and memory-only registry',{skip:process.platform!=='win32'},async()=>{
 const base=await fs.mkdtemp(join(tmpdir(),'monitor-browsers-'));const install=join(base,"install with spaces and 'quote'");
 try{
  await fs.mkdir(join(install,'.local'),{recursive:true});
  for(const file of ['scripts/Instalar-Ponte-Navegadores.ps1','scripts/Remover-Ponte-Navegadores.ps1','scripts/Instalar-Ponte-Chrome.ps1','extensions/chromium/manifest.json','extensions/firefox/manifest.json']){
   await fs.mkdir(join(install,file.split('/').slice(0,-1).join('/')),{recursive:true});await fs.copyFile(new URL(file,root),join(install,file));
  }
  await fs.writeFile(join(install,'.local','windows-launcher.json'),JSON.stringify({node:process.execPath,environment:{}}));
  const child=spawn(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('tests/browser-install-test.ps1',root)),'-InstallRoot',install],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
  await new Promise((res,rej)=>{child.on('error',rej);child.on('close',code=>{try{assert.equal(code,0,output);assert.match(output,/PASS:/);res();}catch(e){rej(e);}});});
 }finally{const target=resolve(base);assert(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-browsers-'));await fs.rm(target,{recursive:true,force:true});}
});
