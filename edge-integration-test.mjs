import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const sourceRoot=fileURLToPath(new URL('.',import.meta.url));
const edge=join(process.env['ProgramFiles(x86)'],'Microsoft','Edge','Application','msedge.exe');
try { await fs.access(edge); } catch { console.log('SKIP: Edge não instalado neste Windows; teste real não executado.'); process.exit(0); }
const base=await fs.mkdtemp(join(tmpdir(),'monitor-edge-test-'));
const install=join(base,'synthetic-monitor');await fs.mkdir(join(install,'.local'),{recursive:true});await fs.mkdir(join(install,'chrome-extension'));
let edgeProcess,cdp,instanceId,installed=false;
let browserError='';
const port=async()=>{const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const value=server.address().port;await new Promise(r=>server.close(r));return value;};
const servicePort=await port(),debugPort=await port();
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><button data-codex-monitor-control="connect" style="position:absolute;left:20px;top:20px;width:200px;height:60px">Conectar teste</button>');});
await new Promise(r=>fixture.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+fixture.address().port;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(action,limit=30000){const deadline=Date.now()+limit;let error;while(Date.now()<deadline){try{const value=await action();if(value)return value;}catch(e){error=e;}await delay(200);}throw error||Error('Timed out');}
function runPs(file,args=[]){return new Promise((res,rej)=>{const child=spawn(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',file,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.once('error',rej);child.once('close',code=>code===0?res():rej(Error(output)));});}
const registration=join(base,'test-registry.ps1');
await fs.writeFile(registration,String.raw`param([string]$Manifest,[switch]$Remove)
$ErrorActionPreference='Stop'
$taskKey='HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\local.codex_monitor_edge_test'
if($Remove) {
 if(Test-Path -LiteralPath $taskKey) {
  if((Get-Item -LiteralPath $taskKey).GetValue('') -ne $Manifest){throw 'Foreign test entry preserved'}
  Remove-Item -LiteralPath $taskKey
 }
} else {
 if(Test-Path -LiteralPath $taskKey){throw 'Existing test entry preserved'}
 New-Item -Path $taskKey -Force | Out-Null
 Set-Item -LiteralPath $taskKey -Value $Manifest
}
`);
const nativeManifest=join(install,'.local','chrome-native-host.json');
try{
 for(const file of ['Chrome-Monitor.ps1','Iniciar-Monitor.mjs','server.mjs','config.mjs','state.mjs','standby.mjs','permissions.mjs','runtime.mjs','health.mjs','chrome-extension/manifest.json','chrome-extension/background.js','chrome-extension/content.js'])await fs.copyFile(join(sourceRoot,file),join(install,file));
 const manifest=JSON.parse(await fs.readFile(join(install,'chrome-extension/manifest.json'),'utf8'));
 manifest.name='Monitor Codex — TESTE ISOLADO';manifest.content_scripts[0].matches=[origin+'/*'];
 await fs.writeFile(join(install,'chrome-extension/manifest.json'),JSON.stringify(manifest));
 let background=await fs.readFile(join(install,'chrome-extension/background.js'),'utf8');background=background.replaceAll('http://127.0.0.1:13000',origin).replaceAll('http://localhost:13000',origin).replaceAll('local.codex_monitor','local.codex_monitor_edge_test').replace("() => ({ok: false, code: 'BRIDGE_UNAVAILABLE'})","error => ({ok: false, code: String(error.message)})").replace("code: 'BRIDGE_UNAVAILABLE'}); return;","code: monitorRuntime.lastError.message}); return;");await fs.writeFile(join(install,'chrome-extension/background.js'),background);
 const cmd=join(install,'.local','chrome-native-host.cmd');
 await fs.writeFile(cmd,'@echo off\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\\Chrome-Monitor.ps1" -ExtensionOrigin "%~1"\r\n','ascii');
 await fs.writeFile(nativeManifest,JSON.stringify({name:'local.codex_monitor_edge_test',description:'Host de teste isolado',path:cmd,type:'stdio',allowed_origins:['chrome-extension://lpheelcigldjemiadkmgobngfiiafkia/']}));
 const data=join(base,'synthetic-data'),config=join(install,'config.local.json');
 await fs.writeFile(config,JSON.stringify({port:servicePort,origins:[origin],dataDir:data,settingsFile:join(base,'no-settings.json')}));
 await fs.writeFile(join(install,'.local','windows-launcher.json'),JSON.stringify({node:process.execPath,environment:{CODEX_HOME:join(base,'no-codex'),CODEX_MONITOR_CONFIG:config,CODEX_MONITOR_DATA:data,CODEX_MONITOR_PORT:String(servicePort),CODEX_MONITOR_SETTINGS:join(base,'no-settings.json')}}));
 await runPs(registration,['-Manifest',nativeManifest]);installed=true;
 edgeProcess=spawn(edge,['--headless=new','--no-first-run','--no-default-browser-check','--user-data-dir='+join(base,'isolated-edge-profile'),'--remote-debugging-port='+debugPort,'--load-extension='+join(install,'chrome-extension'),'--disable-extensions-except='+join(install,'chrome-extension'),origin],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 edgeProcess.stderr.on('data',x=>browserError+=x);
 const page=await until(async()=>{const pages=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();return pages.find(x=>x.type==='page'&&x.url.startsWith(origin));});
 cdp=new WebSocket(page.webSocketDebuggerUrl);await new Promise((res,rej)=>{cdp.addEventListener('open',res,{once:true});cdp.addEventListener('error',rej,{once:true});});
 let sequence=0;const requests=new Map();
 cdp.addEventListener('message',event=>{const response=JSON.parse(event.data);if(response.id&&requests.has(response.id)){const call=requests.get(response.id);requests.delete(response.id);clearTimeout(call.timer);response.error?call.reject(Error(response.error.message)):call.resolve(response.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{requests.delete(id);reject(Error('CDP timeout '+method));},5000);requests.set(id,{resolve,reject,timer});cdp.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 await until(async()=>await evaluate('document.querySelector("button").getAttribute("data-codex-monitor-bridge")')==='ready',12000);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:90,y:50,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:90,y:50,button:'left',clickCount:1});
 await until(async()=>{const result=await evaluate('document.querySelector("button").getAttribute("data-codex-monitor-result")');if(result&&result!=='pending'&&result!=='started')throw Error(result);return result==='started';},8000);
 const state=await(await fetch('http://127.0.0.1:'+servicePort+'/states',{headers:{Origin:origin}})).json();assert.equal(state.service,'codex-monitor');instanceId=state.instanceId;
 await delay(300);assert.equal((await fetch('http://127.0.0.1:'+servicePort+'/states',{headers:{Origin:origin}})).ok,true);
 const response=await fetch('http://127.0.0.1:'+servicePort+'/shutdown',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({instanceId})});assert(response.ok);
 await until(async()=>{try{await fs.stat(join(data,'service.pid'));return false;}catch{return true;}});
 console.log('PASS: Edge real em perfil isolado: extensão carregada, clique confiável, CMD/PowerShell nativo, Node em segundo plano e desligamento confirmado.');
 try{await send('Browser.close');}catch{}
}catch(error){console.error('Falha no teste Edge isolado: '+error.message);process.exitCode=1;}
finally{
 try{const state=await(await fetch('http://127.0.0.1:'+servicePort+'/states',{headers:{Origin:origin}})).json();await fetch('http://127.0.0.1:'+servicePort+'/shutdown',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({instanceId:state.instanceId})});}catch{}
 if(cdp?.readyState===WebSocket.OPEN){try{cdp.send(JSON.stringify({id:9999,method:'Browser.close'}));}catch{}cdp.close();}
 if(edgeProcess&&edgeProcess.exitCode===null)await new Promise(r=>{const timer=setTimeout(()=>{edgeProcess.kill();r();},4000);edgeProcess.once('exit',()=>{clearTimeout(timer);r();});});
 if(installed)await runPs(registration,['-Manifest',nativeManifest,'-Remove']);
 await new Promise(r=>fixture.close(r));
 await delay(300);
 const target=resolve(base);assert(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-edge-test-'));await fs.rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}


