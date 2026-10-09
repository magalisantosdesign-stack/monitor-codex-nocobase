import {spawn} from 'node:child_process';
import {access,readdir,stat} from 'node:fs/promises';
import {join,isAbsolute,delimiter} from 'node:path';
import {UUID} from './state.mjs';

const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function selectAccountTokens(value){
 if(!value||typeof value!=='object')return null;
 const lifetimeTokens=count(value.summary?.lifetimeTokens);
 const days=new Map();
 for(const row of Array.isArray(value.dailyUsageBuckets)?value.dailyUsageBuckets:[]){
  try{if(date(row.startDate)&&count(row.tokens)!==null){if(days.has(row.startDate))return null;days.set(row.startDate,{date:row.startDate,tokens:row.tokens});}}catch{}
 }
 const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
 return lifetimeTokens===null&&!daily.length?null:{lifetimeTokens,daily,source:'codex-app-server'};
}

export async function resolveCodexExecutable(explicit){
 if(explicit){if(!isAbsolute(explicit))throw new Error('absolute executable required');await access(explicit);return explicit;}
 const name=process.platform==='win32'?'codex.exe':'codex';
 for(const dir of (process.env.PATH||'').split(delimiter).filter(Boolean)){const path=join(dir,name);try{await access(path);return path;}catch{}}
 if(process.platform==='win32'&&process.env.LOCALAPPDATA){
  const root=join(process.env.LOCALAPPDATA,'OpenAI','Codex','bin');
  const candidates=[];
  try{for(const entry of await readdir(root,{withFileTypes:true})){if(entry.isDirectory()){const path=join(root,entry.name,name);try{candidates.push({path,mtime:(await stat(path)).mtimeMs});}catch{}}}}catch{}
  candidates.sort((a,b)=>b.mtime-a.mtime);if(candidates.length)return candidates[0].path;
 }
 throw new Error('codex unavailable');
}

// Only initialize and account/usage/read are sent. This process never loads a chat.
export async function queryAccountTokens({executable,codexHome,signal,timeoutMs=15000,spawnProcess=spawn}){
 const binary=await resolveCodexExecutable(executable);
 if(signal?.aborted)throw new Error('stopped');
 const child=spawnProcess(binary,['app-server','--listen','stdio://','-c','mcp_servers={}','-c','analytics.enabled=false'],{env:{...process.env,CODEX_HOME:codexHome},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let buffer='',bytes=0,sequence=0,failed=false;
 const pending=new Map();
 let closed=false;
 const exited=new Promise(resolve=>child.once('close',()=>{closed=true;resolve();}));
 const fail=()=>{failed=true;for(const task of pending.values())task.reject(new Error('token read unavailable'));pending.clear();child.kill();};
 child.on('error',fail);child.on('exit',()=>{failed=true;for(const task of pending.values())task.reject(new Error('token source exited'));pending.clear();});
 child.stdout.setEncoding('utf8');
 child.stderr.on('data',()=>{});
 child.stdout.on('data',chunk=>{
  bytes+=chunk.length;buffer+=chunk.toString();if(bytes>5000000||buffer.length>2000000){fail();return;}
  let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let value;try{value=JSON.parse(line);}catch{continue;}const task=pending.get(value.id);if(task){pending.delete(value.id);value.error?task.reject(new Error('token method unavailable')):task.resolve(value.result);}}
 });
 child.stdin.on('error',fail);
 const timer=setTimeout(fail,timeoutMs);
 signal?.addEventListener('abort',fail,{once:true});
 function call(method,params){if(failed) return Promise.reject(new Error('token source exited'));const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});try{child.stdin.write(JSON.stringify({id,method,params})+'\n');}catch{fail();}});}
 try{
  await call('initialize',{clientInfo:{name:'monitor_codex_tokens',version:'0.8.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  return selectAccountTokens(await call('account/usage/read',{}));
 }finally{
  clearTimeout(timer);signal?.removeEventListener('abort',fail);child.stdin.end();if(!closed)child.kill();
  const waitExit=()=>Promise.race([exited,new Promise(resolve=>{const t=setTimeout(resolve,2000);t.unref();})]);
  await waitExit();
  if(!closed){child.kill('SIGKILL');await waitExit();if(!closed)throw new Error('owned token process exit not confirmed');}
 }
}

// Read only numeric metadata for linked IDs; no transcript or database export.
export async function readLinkedTokens({codexHome,ids}){
 const selected=[...new Set(ids.filter(id=>typeof id==='string'&&UUID.test(id)).map(id=>id.toLowerCase()))];
 if(!selected.length)return [];
 const {DatabaseSync}=await import('node:sqlite');
 const db=new DatabaseSync(join(codexHome,'state_5.sqlite'),{readOnly:true});
 try{
  db.exec('PRAGMA query_only = ON; PRAGMA busy_timeout = 1000;');
  const columns=db.prepare('PRAGMA table_info(threads)').all().map(row=>row.name);
  if(!['id','tokens_used','updated_at'].every(key=>columns.includes(key)))throw new Error('unsupported metadata');
  const query=db.prepare('SELECT tokens_used, updated_at FROM threads WHERE id = ?');
  return selected.map(id=>{const row=query.get(id);return {id,totalTokens:count(row?.tokens_used),updatedAt:count(row?.updated_at),confirmed:count(row?.tokens_used)!==null};});
 }finally{db.close();}
}

export function createTokenReader({codexHome,executable,ids,accountRead=queryAccountTokens,linkedRead=readLinkedTokens,now=Date.now,cacheMs=60000}){
 const controller=new AbortController();let lastAttempt=0,cached=null,inFlight=null,stopped=false;
 async function refresh(){
  const selected=[...ids()];
  const [account,threads]=await Promise.allSettled([accountRead({codexHome,executable,signal:controller.signal}),linkedRead({codexHome,ids:selected})]);
  const at=now();lastAttempt=at;
  cached={service:'codex-monitor',scope:'tokens',at,
   account:account.status==='fulfilled'&&account.value?{...account.value,confirmed:true,at}:{...(cached?.account||{lifetimeTokens:null,daily:[]}),confirmed:false},
   threads:threads.status==='fulfilled'?{source:'codex-local-metadata',confirmed:true,at,rows:threads.value}:{...(cached?.threads||{source:'codex-local-metadata',rows:[]}),confirmed:false}};
 }
 const read=async()=>{
  if(stopped)throw new Error('stopped');
  if(!cached||now()-lastAttempt>=cacheMs){if(!inFlight)inFlight=refresh().finally(()=>{inFlight=null;});await inFlight;}
  const allowed=new Set(ids());return {...cached,threads:{...cached.threads,rows:cached.threads.rows.filter(row=>allowed.has(row.id))}};
 };
 read.stop=async()=>{stopped=true;controller.abort();await inFlight;};
 return read;
}
