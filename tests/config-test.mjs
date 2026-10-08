import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,stat,readdir,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {root} from '../src/config.mjs';
import {mergeHooks,hookCommand} from '../scripts/Install-Hooks.mjs';
function run(file,args,env,input=''){
 return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,file),...args],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  child.once('error',reject);child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  child.once('close',code=>resolve({code,stdout,stderr}));child.stdin.end(input);});
}
test('hook merge preserves other handlers and repeated installation does not duplicate',()=>{
 const other={type:'command',command:'unrelated-tool'};
 const existing={hooks:{PreToolUse:[{matcher:'Bash',hooks:[other]}]}};
 const once=mergeHooks(existing,'monitor-command'),twice=mergeHooks(once,'monitor-command');
 assert.deepEqual(once,twice);assert.deepEqual(existing.hooks.PreToolUse[0].hooks,[other]);
 assert.equal(twice.hooks.PreToolUse[0].hooks[0].command,'unrelated-tool');
 const legacy=mergeHooks({hooks:{PreToolUse:[{hooks:[other,{type:'command',command:'old-fixed-command'}]}]}},'new-fixed-command',{legacyCommand:'old-fixed-command'});
 assert.equal(legacy.hooks.PreToolUse[0].hooks[0].command,'unrelated-tool');
 assert.equal(legacy.hooks.PreToolUse.flatMap(group=>group.hooks).some(handler=>handler.command==='old-fixed-command'),false);
 const migrated=mergeHooks({hooks:{Stop:[{hooks:[other,{type:'command',command:'same-installation-old-layout'}]}]}},'new-layout',{legacyCommands:['same-installation-old-layout']});
 assert.deepEqual(migrated.hooks.Stop.flatMap(group=>group.hooks).map(handler=>handler.command),['unrelated-tool','new-layout']);
 assert.deepEqual(mergeHooks(migrated,'new-layout',{legacyCommands:['same-installation-old-layout']}),migrated);
 assert.throws(()=>hookCommand('node','invalid%path','win32'));assert.equal(hookCommand('node','a b','win32'),'"node" "a b"');
});
test('custom configuration, hook preview and installation use only a synthetic home',async()=>{
 const base=await mkdtemp(join(tmpdir(),'monitor-package-'));
 const cfg=join(base,'config.json'),home=join(base,'codex');
 const env={...process.env,CODEX_HOME:home,CODEX_MONITOR_CONFIG:cfg,CODEX_MONITOR_DATA:join(base,'data'),CODEX_MONITOR_SETTINGS:join(base,'missing-settings.json')};
 delete env.CODEX_MONITOR_PORT;
 try{
  await writeFile(cfg,JSON.stringify({port:13215,origins:['http://localhost:14000']}));
  const preview=await run('scripts/Install-Hooks.mjs',[],env);assert.equal(preview.code,0);assert.equal(JSON.parse(preview.stdout).mode,'prévia');
  await assert.rejects(stat(home),{code:'ENOENT'});
  const installed=await run('scripts/Install-Hooks.mjs',['--apply'],env);assert.equal(installed.code,0,installed.stderr);
  const hooks=JSON.parse(await readFile(join(home,'hooks.json'),'utf8'));assert.equal(Object.keys(hooks.hooks).length,9);
  assert.equal(hooks.hooks.PreCompact[0].matcher,'manual|auto');assert.equal(hooks.hooks.PostCompact[0].matcher,'manual|auto');
  assert.equal(hooks.hooks.PreToolUse[0].hooks[0].timeout,3);
  const input=JSON.stringify({session_id:'00000000-0000-4000-8000-000000000001',hook_event_name:'Stop'});
  await writeFile(cfg,'INVALID_JSON');
  const hook=await run('src/hook.mjs',[],env,input);assert.equal(hook.code,0);assert.equal(hook.stdout.trim(),'{}');
  await writeFile(cfg,JSON.stringify({origins:['*']}));
  const rejected=await run('src/server.mjs',[],env);assert.notEqual(rejected.code,0);assert.match(rejected.stderr,/origens locais/);
 }finally{
  // Exact files created by this test; never remove the real Codex home.
  try{await unlink(join(home,'hooks.json'));await rmdir(home);}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const name of await readdir(base))await unlink(join(base,name));await rmdir(base);
 }
});
