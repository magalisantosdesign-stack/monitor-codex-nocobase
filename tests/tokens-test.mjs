import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {selectAccountTokens,readLinkedTokens,createTokenReader,queryAccountTokens} from '../src/tokens.mjs';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
assert.equal(selectAccountTokens({summary:{lifetimeTokens:null},dailyUsageBuckets:[]}),null);
const selected=selectAccountTokens({account:'SECRET',summary:{lifetimeTokens:0,password:'SECRET'},dailyUsageBuckets:[{startDate:'2026-10-02',tokens:45,prompt:'SECRET'},{startDate:'2026-10-01',tokens:0},{startDate:'2026-02-31',tokens:12},{startDate:'2026-10-03',tokens:-1}]});
assert.equal(selected.lifetimeTokens,0);assert.deepEqual(selected.daily,[{date:'2026-10-01',tokens:0},{date:'2026-10-02',tokens:45}]);assert.ok(!JSON.stringify(selected).includes('SECRET'));
assert.equal(selectAccountTokens({dailyUsageBuckets:[{startDate:'2026-10-01',tokens:1},{startDate:'2026-10-01',tokens:1}]}),null);
const base=await mkdtemp(join(tmpdir(),'monitor-tokens-'));
try{
 const db=new DatabaseSync(join(base,'state_5.sqlite'));
 db.exec('CREATE TABLE threads (id TEXT PRIMARY KEY,tokens_used INTEGER,updated_at INTEGER,prompt TEXT);');
 const insert=db.prepare('INSERT INTO threads VALUES (?,?,?,?)');insert.run(id,123456,1900000000,'SECRET');insert.run(other,888,1900000001,'SECRET');db.close();
 const rows=await readLinkedTokens({codexHome:base,ids:[id,id]});assert.deepEqual(rows,[{id,totalTokens:123456,updatedAt:1900000000,confirmed:true}]);assert.ok(!JSON.stringify(rows).includes('SECRET'));
 const missing=await readLinkedTokens({codexHome:base,ids:['00000000-0000-4000-8000-000000000003']});assert.equal(missing[0].totalTokens,null);assert.equal(missing[0].confirmed,false);
 await assert.rejects(readLinkedTokens({codexHome:join(base,'absent'),ids:[id]}));
 let time=100000,ids=[id],calls=0,fail=false;
 const reader=createTokenReader({codexHome:base,ids:()=>ids,now:()=>time,accountRead:async()=>{calls++;if(fail)throw new Error('SECRET');await new Promise(resolve=>setTimeout(resolve,10));return selected;},linkedRead:readLinkedTokens});
 const [a,b]=await Promise.all([reader(),reader()]);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.account.confirmed,true);
 ids=[];assert.deepEqual((await reader()).threads.rows,[]);assert.equal(calls,1);
 ids=[id];time+=60001;fail=true;const old=await reader();assert.equal(old.account.confirmed,false);assert.equal(old.account.at,a.account.at);assert.equal(old.account.lifetimeTokens,0);assert.equal(old.threads.confirmed,true);assert.equal(calls,2);await reader.stop();await assert.rejects(reader());
}finally{assert.ok(resolve(base).startsWith(resolve(tmpdir())+sep));await rm(base,{recursive:true,force:true});}

let killed=0,methods=[];
function fakeSpawn(mode){return (_binary,args,options)=>{
 assert.ok(args.includes('app-server'));assert.equal(options.windowsHide,true);
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{killed++;queueMicrotask(()=>{child.emit('exit',0);child.emit('close',0);});return true;};
 let input='';child.stdin.on('data',part=>{input+=part;let n;while((n=input.indexOf('\n'))>=0){const message=JSON.parse(input.slice(0,n));input=input.slice(n+1);methods.push(message.method);if(mode==='hang')continue;if(message.id){const result=message.method==='initialize'?{}:{summary:{lifetimeTokens:42},dailyUsageBuckets:[],secret:'SECRET'};queueMicrotask(()=>child.stdout.write(JSON.stringify({id:message.id,result})+'\n'));}}});return child;
};}
const result=await queryAccountTokens({executable:process.execPath,codexHome:base,spawnProcess:fakeSpawn('normal')});assert.equal(result.lifetimeTokens,42);assert.ok(!JSON.stringify(result).includes('SECRET'));assert.deepEqual(methods,['initialize','initialized','account/usage/read']);assert.equal(killed,1);
await assert.rejects(queryAccountTokens({executable:process.execPath,codexHome:base,timeoutMs:25,spawnProcess:fakeSpawn('hang')}));assert.ok(killed>=2);
const abort=new AbortController();const waiting=queryAccountTokens({executable:process.execPath,codexHome:base,signal:abort.signal,spawnProcess:fakeSpawn('hang')});setTimeout(()=>abort.abort(),25);await assert.rejects(waiting);
console.log('PASS: token allowlist, zero vs unavailable, dates, linked-only read-only metadata, concurrent cache, stale reads, unlink pruning, RPC scope, timeout and owned child cancellation.');
