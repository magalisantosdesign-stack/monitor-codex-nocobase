import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import http from 'node:http';
const root=new URL('..',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('extensions/chromium/manifest.json',root),'utf8'));
const id=[...createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32)].map(x=>String.fromCharCode(97+parseInt(x,16))).join('');
const origin='chrome-extension://'+id+'/';
test('Extension accepts only a fixed start action from its local top-level content script',async()=>{
 let listener,calls=0,replies=[];
 const chrome={runtime:{id,onMessage:{addListener:fn=>listener=fn},sendNativeMessage(name,message,reply){calls++;assert.equal(name,'local.codex_monitor');assert.equal(message.action,'start');reply({ok:true});}}};
 vm.runInNewContext(await fs.readFile(new URL('extensions/chromium/background.js',root),'utf8'),{chrome,URL,Set});
 const sender={id,url:'http://127.0.0.1:13000/admin/example',frameId:0};
 assert.equal(listener({action:'start'},sender,x=>replies.push(x)),true);assert.equal(calls,1);assert.equal(replies[0].ok,true);
 for(const [message,source] of [[{action:'start',command:'whoami'},sender],[{action:'stop'},sender],[{action:'start'},{...sender,url:'https://example.com/'}],[{action:'start'},{...sender,frameId:1}],[{action:'start'},{...sender,id:'other-extension'}]])assert.equal(listener(message,source,()=>assert.fail('untrusted reply')),false);
 assert.equal(calls,1);
});
function frame(value){const bytes=Buffer.from(JSON.stringify(value)),header=Buffer.alloc(4);header.writeUInt32LE(bytes.length);return Buffer.concat([header,bytes]);}
function host(script,caller,input,viaCmd=false){return new Promise((resolve,reject)=>{
 const executable=viaCmd?join(process.env.SystemRoot,'System32','cmd.exe'):join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const callers=Array.isArray(caller)?caller:[caller];
 const args=viaCmd?['/d','/s','/c','call "'+script+'" '+callers.map(x=>'"'+x+'"').join(' ')+' --parent-window=0']:['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',script,...callers];
 const child=spawn(executable,args,{windowsHide:true,windowsVerbatimArguments:viaCmd,stdio:['pipe','pipe','pipe']});
 const chunks=[];let stderr='';const timer=setTimeout(()=>{child.kill();reject(Error('Host timeout'));},35000);
 child.once('error',reject);child.stdout.on('data',x=>chunks.push(x));child.stderr.on('data',x=>stderr+=x);child.stdin.on('error',()=>{});child.stdin.end(input);
 child.once('exit',code=>{clearTimeout(timer);setTimeout(()=>{child.stdout.destroy();child.stderr.destroy();try{assert.equal(code,0,stderr);const output=Buffer.concat(chunks);assert(output.length>=4);assert.equal(output.readUInt32LE(0),output.length-4);resolve(JSON.parse(output.subarray(4).toString('utf8')));}catch(error){reject(error);}},25);});
 });}
test('PowerShell native host rejects commands, starts an isolated collector, then exits', {skip:process.platform!=='win32'},async()=>{
 const base=await fs.mkdtemp(join(tmpdir(),'monitor-native-')),install=join(base,"pacote com espacos e 'apostrofo'");await fs.mkdir(join(install,'extensions/chromium'),{recursive:true});await fs.mkdir(join(install,'extensions/firefox'));await fs.mkdir(join(install,'.local'));
 const files=['scripts/Chrome-Monitor.ps1','scripts/Iniciar-ForaDoJob.ps1','scripts/Iniciar-Monitor.mjs','src/server.mjs','src/config.mjs','src/state.mjs','src/standby.mjs','src/permissions.mjs','src/runtime.mjs','src/health.mjs','src/usage.mjs','src/tokens.mjs','extensions/chromium/manifest.json','extensions/firefox/manifest.json'];for(const file of files){await fs.mkdir(join(install,file,'..'),{recursive:true});await fs.copyFile(new URL(file,root),join(install,file));}
 const socket=http.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const data=join(base,'synthetic-data');await fs.writeFile(join(install,'config.local.json'),JSON.stringify({port,origins:['http://localhost:14000'],dataDir:data,settingsFile:join(base,'missing.json')}));
 await fs.writeFile(join(install,'.local','windows-launcher.json'),JSON.stringify({node:process.execPath,environment:{CODEX_HOME:join(base,'fake-codex'),CODEX_MONITOR_DATA:data,CODEX_MONITOR_SETTINGS:join(base,'missing.json'),CODEX_MONITOR_CONFIG:join(install,'config.local.json'),CODEX_MONITOR_PORT:String(port)}}));
 const script=join(install,'scripts/Chrome-Monitor.ps1');
 const launcher=join(install,'.local','chrome-native-host.cmd');
 await fs.writeFile(launcher,'@echo off\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\\scripts\\Chrome-Monitor.ps1" "%~1"\r\n','ascii');
 try {
  assert.equal((await host(script,'chrome-extension://wrong/',frame({action:'start'}))).code,'INVALID_ORIGIN');
  assert.equal((await host(script,origin,frame({action:'start',command:'whoami'}))).code,'INVALID_REQUEST');
  assert.equal((await host(script,origin,frame({action:'stop'}))).code,'INVALID_REQUEST');
  assert.equal((await host(launcher,origin,frame({action:'unsupported'}),true)).code,'INVALID_REQUEST');
  await assert.rejects(fs.readFile(join(data,'service.pid')),{code:'ENOENT'});
  const firefoxManifest=join(install,'.local','firefox-native-host.json');
  const firefoxId=JSON.parse(await fs.readFile(new URL('extensions/firefox/manifest.json',root),'utf8')).browser_specific_settings.gecko.id;
  const firefoxCmd=join(install,'.local','firefox-native-host.cmd');
  await fs.writeFile(firefoxManifest,JSON.stringify({name:'local.codex_monitor',path:firefoxCmd,type:'stdio',allowed_extensions:[firefoxId]}));
  await fs.writeFile(firefoxCmd,'@echo off\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\\scripts\\Chrome-Monitor.ps1" -NativeManifest "%~1" -FirefoxExtensionId "%~2"\r\n','ascii');
  assert.equal((await host(firefoxCmd,[firefoxManifest,'foreign-extension'],frame({action:'start'}),true)).code,'INVALID_ORIGIN');
  assert.equal((await host(firefoxCmd,[join(base,'foreign.json'),firefoxId],frame({action:'start'}),true)).code,'INVALID_ORIGIN');
  assert.equal((await host(firefoxCmd,[firefoxManifest,firefoxId],frame({action:'stop'}),true)).code,'INVALID_REQUEST');
  await assert.rejects(fs.readFile(join(data,'service.pid')),{code:'ENOENT'});
  const jobFixture=join(install,'firefox-job-fixture.ps1');
  await fs.writeFile(jobFixture,String.raw`param([string]$NativeManifest,[string]$FirefoxExtensionId)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CodexMonitorTestJob {
 [StructLayout(LayoutKind.Sequential)] struct Basic {public long processTime,jobTime;public uint flags;public UIntPtr minimum,maximum;public uint active;public UIntPtr affinity;public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct Io {public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes;}
 [StructLayout(LayoutKind.Sequential)] struct Limits {public Basic basic;public Io io;public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,IntPtr value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 static IntPtr owned;
 public static void Enter() {
  owned=CreateJobObject(IntPtr.Zero,null); if(owned==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  var limits=new Limits();limits.basic.flags=0x800|0x2000;
  int size=Marshal.SizeOf(limits);IntPtr memory=Marshal.AllocHGlobal(size);
  try {Marshal.StructureToPtr(limits,memory,false);if(!SetInformationJobObject(owned,9,memory,(uint)size)||!AssignProcessToJobObject(owned,GetCurrentProcess()))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());} finally {Marshal.FreeHGlobal(memory);}
  // Handle stays open until this process exits: closing the job kills children
  // that have not explicitly used CREATE_BREAKAWAY_FROM_JOB.
 }
}
'@
[CodexMonitorTestJob]::Enter()
& (Join-Path $PSScriptRoot 'scripts/Chrome-Monitor.ps1') -NativeManifest $NativeManifest -FirefoxExtensionId $FirefoxExtensionId
exit 0
`);
  assert.equal((await host(jobFixture,[firefoxManifest,firefoxId],frame({action:'start'}))).ok,true,'Firefox host must start outside its job');
  await new Promise(r=>setTimeout(r,200));
  const firefoxState=await (await fetch('http://127.0.0.1:'+port+'/states',{headers:{Origin:'http://localhost:14000'}})).json();
  assert.equal(firefoxState.service,'codex-monitor','Collector must survive native host/job exit');
  const firefoxPid=await fs.readFile(join(data,'service.pid'),'utf8');
  assert.equal((await host(firefoxCmd,[firefoxManifest,firefoxId],frame({action:'start'}),true)).ok,true);
  assert.equal(await fs.readFile(join(data,'service.pid'),'utf8'),firefoxPid,'Firefox reconnect must retain a single collector');
  const firefoxShutdown=await fetch('http://127.0.0.1:'+port+'/shutdown',{method:'POST',headers:{Origin:'http://localhost:14000','Content-Type':'application/json'},body:JSON.stringify({instanceId:firefoxState.instanceId})});assert(firefoxShutdown.ok);
  for(let n=0;n<20;n++){try{await fs.stat(join(data,'service.pid'));await new Promise(r=>setTimeout(r,100));}catch{break;}}
  await assert.rejects(fs.readFile(join(data,'service.pid')),{code:'ENOENT'});
  assert.equal((await host(launcher,origin,frame({action:'start'}),true)).ok,true);
  const state=await (await fetch('http://127.0.0.1:'+port+'/states',{headers:{Origin:'http://localhost:14000'}})).json();assert.equal(state.service,'codex-monitor');
  const pid=await fs.readFile(join(data,'service.pid'),'utf8');assert.equal((await host(script,origin,frame({action:'start'}))).ok,true);assert.equal(await fs.readFile(join(data,'service.pid'),'utf8'),pid);
  const shutdown=await fetch('http://127.0.0.1:'+port+'/shutdown',{method:'POST',headers:{Origin:'http://localhost:14000','Content-Type':'application/json'},body:JSON.stringify({instanceId:state.instanceId})});assert(shutdown.ok);
  for(let n=0;n<20;n++){try{await fs.stat(join(data,'service.pid'));await new Promise(r=>setTimeout(r,100));}catch{break;}}
  await assert.rejects(fs.readFile(join(data,'service.pid')),{code:'ENOENT'});
 } finally {
  try{process.kill(Number(await fs.readFile(join(data,'service.pid'),'utf8')),'SIGTERM');}catch{}
  const target=resolve(base);assert(target.startsWith(resolve(tmpdir())+sep));assert(target.includes('monitor-native-'));await fs.rm(target,{recursive:true,force:true});
 }
});


