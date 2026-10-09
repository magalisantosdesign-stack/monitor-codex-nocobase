import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readdir,readFile} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const base=await mkdtemp(join(tmpdir(),'monitor-tokens-http-')),origin='http://localhost:14000',id='00000000-0000-4000-8000-000000000001';
let child,exited;
try{
 const db=new DatabaseSync(join(base,'state_5.sqlite'));db.exec('CREATE TABLE threads(id TEXT PRIMARY KEY,tokens_used INTEGER,updated_at INTEGER);');db.prepare('INSERT INTO threads VALUES (?,?,?)').run(id,765432,1900000000);db.close();
 const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const configPath=join(base,'config.local.json');await writeFile(configPath,JSON.stringify({port,origins:[origin],dataDir:base,codexHome:base,codexExecutable:join(base,'absent.exe')}));await writeFile(join(base,'linked.json'),JSON.stringify({ids:[id]}));
 child=spawn(process.execPath,[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],{env:{...process.env,CODEX_MONITOR_CONFIG:configPath,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_DATA:base,CODEX_HOME:base,CODEX_MONITOR_SETTINGS:join(base,'missing-settings.json'),CODEX_MONITOR_CODEX_EXECUTABLE:join(base,'absent.exe')},windowsHide:true,stdio:['ignore','pipe','pipe']});
 exited=new Promise(resolve=>child.once('exit',resolve));
 await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',resolve);child.once('exit',code=>reject(new Error('server exited '+code)));});
 const url='http://127.0.0.1:'+port,headers={Origin:origin};
 assert.equal((await fetch(url+'/tokens',{headers:{Origin:'http://evil.example'}})).status,403);
 const response=await fetch(url+'/tokens',{headers});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),origin);
 const value=await response.json();assert.equal(value.scope,'tokens');assert.equal(value.account.confirmed,false);assert.equal(value.account.lifetimeTokens,null);assert.equal(value.threads.rows[0].totalTokens,765432);
 await fetch(url+'/linked',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({ids:[]})});assert.deepEqual((await (await fetch(url+'/tokens',{headers})).json()).threads.rows,[]);
 const shutdown=await fetch(url+'/shutdown',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({instanceId:value.instanceId})});assert.equal(shutdown.status,200);await exited;child=null;
 assert.ok(!(await readdir(base)).some(name=>/tokens|usage/.test(name)),'No token report persisted');
 const check=new DatabaseSync(join(base,'state_5.sqlite'),{readOnly:true});assert.equal(check.prepare('SELECT tokens_used FROM threads WHERE id=?').get(id).tokens_used,765432);check.close();
 console.log('PASS: HTTP tokens CORS, no-store, unavailable account vs local tokens, immediate unlink pruning, database unchanged and shutdown.');
}finally{if(child){child.kill();await exited;}assert.ok(resolve(base).startsWith(resolve(tmpdir())+sep));await rm(base,{recursive:true,force:true});}
