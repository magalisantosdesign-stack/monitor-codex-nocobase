import {readFile,readdir,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {reduceState} from './state.mjs';
import {bridgeFromHook,queryRuntime} from './runtime.mjs';

export async function publishEvent(base,event){
 const dir=join(base,'events');await mkdir(dir,{recursive:true});
 const target=join(dir,`${event.at}-${randomUUID()}.json`),tmp=target+'.tmp';
 await writeFile(tmp,JSON.stringify(event),{flag:'wx'});await rename(tmp,target);
}
async function pendingState(base,event){
 let state;
 try{state=JSON.parse(await readFile(join(base,'states.json'),'utf8'))[event.sessionId];}catch{}
 const events=[];
 for(const name of (await readdir(join(base,'events'))).filter(name=>/^\d+-[0-9a-f-]+\.json$/.test(name))){
  try{const queued=JSON.parse(await readFile(join(base,'events',name),'utf8'));if(queued.sessionId===event.sessionId)events.push(queued);}catch{}
 }
 for(const queued of events.sort((a,b)=>a.at-b.at))state=reduceState(state,queued);
 // The collector saves states before removing consumed queue files. Re-read
 // once so a concurrent consume cannot hide an event between the two reads.
 try{const latest=JSON.parse(await readFile(join(base,'states.json'),'utf8'))[event.sessionId];if(latest&&(!state||latest.at>state.at))state=latest;}catch{}
 return state;
}
export async function captureBeforeCompact(base,event,{query=queryRuntime,env=process.env}={}){
 if(event.event!=='PreCompact'||event.subagent)return false;
 const bridge=bridgeFromHook(event,env);if(!bridge)return false;
 const state=await pendingState(base,event);
 if(!state?.questionPending||!state.questionToolId||state.turnId!==event.turnId)return false;
 // The Codex process waits for PreCompact. Keep the optional read bounded;
 // failure never blocks or prevents compaction, and never proves a reply.
 const rows=await query(bridge,[event.sessionId],{questionToolId:state.questionToolId,timeoutMs:900});
 const proof=rows.find(row=>row.sessionId===event.sessionId&&row.turnId===event.turnId&&row.questionToolId===state.questionToolId&&row.questionResolved===true&&row.at>=state.at&&['inProgress','completed'].includes(row.turnStatus));
 if(!proof)return false;
 const registry=JSON.parse(await readFile(join(base,'linked.json'),'utf8'));
 if(!registry.ids?.includes(event.sessionId))return false;
 await publishEvent(base,{sessionId:event.sessionId,turnId:event.turnId,event:'QuestionResolved',at:proof.at,subagent:false,toolId:state.questionToolId,turnStatus:proof.turnStatus});
 return true;
}
