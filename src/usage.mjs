import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {validBridge} from './runtime.mjs';

// Account limits and available reset count only; never read auth or redeem resets.
export function selectUsage(result,at=Date.now()){
 if(result?.success!==true||!Array.isArray(result.contentItems))return null;
 for(const item of result.contentItems){
  if(item.type!=='inputText'||typeof item.text!=='string')continue;
  let value;try{value=JSON.parse(item.text);}catch{continue;}
  const source=value?.rateLimitsByLimitId;
  const buckets=source&&typeof source==='object'&&!Array.isArray(source)?Object.values(source):[value?.rateLimits];
  const limits=[];
  for(const bucket of buckets.slice(0,20)){
   if(!bucket||typeof bucket!=='object')continue;
   const windows=[];
   for(const key of ['primary','secondary']){
    const row=bucket[key];
    if(!row||!Number.isFinite(row.usedPercent)||row.usedPercent<0||row.usedPercent>100||!Number.isSafeInteger(row.windowDurationMins)||row.windowDurationMins<=0||!Number.isSafeInteger(row.resetsAt)||row.resetsAt<=0)continue;
    windows.push({key,usedPercent:row.usedPercent,remainingPercent:100-row.usedPercent,windowDurationMins:row.windowDurationMins,resetsAt:row.resetsAt});
   }
   if(windows.length)limits.push({label:typeof bucket.limitName==='string'?bucket.limitName.slice(0,100):typeof bucket.limitId==='string'?bucket.limitId.slice(0,100):'Codex',plan:typeof bucket.planType==='string'?bucket.planType.slice(0,30):null,windows});
  }
  const count=value?.rateLimitResetCredits?.availableCount;
  const availableResets=Number.isSafeInteger(count)&&count>=0?count:null;
  if(limits.length||availableResets!==null)return {at,scope:'account',limits,availableResets};
 }
 return null;
}

export function queryUsage(bridge,{timeoutMs=1500,connect=net.createConnection,now=Date.now}={}){
 if(!validBridge(bridge))return Promise.resolve(null);
 return new Promise(resolve=>{
  let socket,buffer=Buffer.alloc(0),done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);socket?.destroy();resolve(value);};
  const timer=setTimeout(()=>finish(null),timeoutMs);
  try{
   socket=connect(bridge.pipe);
   socket.on('error',()=>finish(null));socket.on('end',()=>finish(null));
   socket.on('connect',()=>{
    const request={jsonrpc:'2.0',id:1,method:'tools/call',params:{arguments:{},callerSource:'codex',callId:randomUUID(),namespace:'codex_app',threadId:bridge.threadId,tool:'get_usage_limits',turnId:bridge.turnId}};
    const payload=Buffer.from(JSON.stringify(request)),frame=Buffer.alloc(payload.length+4);frame.writeUInt32LE(payload.length);payload.copy(frame,4);socket.write(frame);
   });
   socket.on('data',part=>{
    if(done)return;buffer=Buffer.concat([buffer,part]);if(buffer.length>200004)return finish(null);
    if(buffer.length<4)return;const length=buffer.readUInt32LE();if(length>200000)return finish(null);if(buffer.length<length+4)return;
    try{const response=JSON.parse(buffer.subarray(4,4+length));finish(response.id===1?selectUsage(response.result,now()):null);}catch{finish(null);}
   });
  }catch{finish(null);}
 });
}

export function createUsageReader({bridges,query=queryUsage,now=Date.now,maxAgeMs=60000}){
 let pending=null,lastAttempt=0,snapshot=null,confirmed=false;
 function view(){return {service:'codex-monitor',confirmed,at:snapshot?.at||null,scope:'account',limits:snapshot?.limits||[],availableResets:snapshot?.availableResets??null};}
 return async()=>{
  if(pending){await pending;return view();}
  if(lastAttempt&&now()-lastAttempt<maxAgeMs)return view();
  lastAttempt=now();
  pending=(async()=>{
   confirmed=false;
   try{for(const bridge of (await bridges()).filter(validBridge).slice(0,3)){
    const next=await query(bridge);if(next){snapshot=next;confirmed=true;break;}
   }}catch{/* unavailable is never zero consumption */}
  })();
  try{await pending;return view();}finally{pending=null;}
 };
}
