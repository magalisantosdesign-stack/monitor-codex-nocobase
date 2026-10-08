import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {UUID} from './state.mjs';

// This optional desktop bridge is version dependent. Only read-only status
// and input item metadata are used; message content is never accessed/saved.
export function validBridge(value){
 return value&&typeof value.pipe==='string'&&/^\\\\\.\\pipe\\[a-z0-9_.-]{1,180}$/i.test(value.pipe)&&UUID.test(value.threadId||'')&&UUID.test(value.turnId||'');
}
export function bridgeFromHook(event,env=process.env){
 if(event.subagent||!validBridge({pipe:env.CODEX_APP_TOOLS_PIPE_PATH,threadId:event.sessionId,turnId:event.turnId}))return null;
 return {pipe:env.CODEX_APP_TOOLS_PIPE_PATH,threadId:event.sessionId,turnId:event.turnId};
}
export function runtimePlans(ids,bridges,states={}){
 const groups=new Map();
 for(const id of ids){
  // The app forbids wait_threads on its own caller. Use a genuine context
  // captured from a different linked chat; never invent a caller identity.
  const bridge=bridges.find(value=>validBridge(value)&&(value.threadId!==id||states[id]?.questionPending));
  if(!bridge)continue;
  let group=groups.get(bridge.threadId);if(!group){group={bridge,ids:[]};groups.set(bridge.threadId,group);}group.ids.push(id);
 }
 // wait_threads wakes on the first ready target and can omit the others.
 // Snapshot each ID separately so a completed chat cannot starve active ones.
 return [...groups.values()].flatMap(group=>group.ids.map(id=>({bridge:group.bridge,ids:[id]})));
}
export function runtimeCandidates(id,bridges,states={}){
 return bridges.filter(value=>validBridge(value)).sort((a,b)=>
  Number(b.turnId===states[b.threadId]?.turnId)-Number(a.turnId===states[a.threadId]?.turnId)||Number(b.threadId===id)-Number(a.threadId===id)
 ).slice(0,3);
}
export function selectRuntime(result,ids,at,{questionToolId,metadata=false}={}){
 const permitted=new Set(ids),selected=[];
 if(!result?.success||!Array.isArray(result.contentItems))return selected;
 for(const item of result.contentItems){
  if(item.type!=='inputText'||typeof item.text!=='string')continue;
  let body;try{body=JSON.parse(item.text);}catch{continue;}
  let polls=body.polls||[];
  if((questionToolId||metadata)&&body.thread&&Array.isArray(body.turns)){
   polls=body.turns.slice(0,1).map(turn=>{
    const items=Array.isArray(turn.items)?turn.items:[],questionIndex=items.findIndex(item=>item.id===questionToolId);
    // Access IDs and item types only. Never inspect text/content/arguments.
    const questionResolved=questionIndex>=0&&items.slice(questionIndex+1).some(item=>item.type==='userMessage');
    return {thread:body.thread,latestTurn:turn,questionResolved,questionToolId,questionPresent:questionIndex>=0,currentTurn:metadata};
   });
  }
  if(!Array.isArray(polls))continue;
  for(const poll of polls){
   const id=poll.thread?.id,status=poll.thread?.status,turn=poll.latestTurn;
   if(!permitted.has(id)||poll.thread.hostId!=='local'||!UUID.test(turn?.id||''))continue;
   if(!['active','idle','systemError','notLoaded'].includes(status?.type))continue;
   if(status.type==='active'&&(!Array.isArray(status.activeFlags)||status.activeFlags.some(flag=>!['waitingOnApproval','waitingOnUserInput'].includes(flag))))continue;
   if(!['inProgress','completed','interrupted','failed'].includes(turn.status))continue;
   const observation={sessionId:id,turnId:turn.id,type:status.type,flags:status.activeFlags||[],turnStatus:turn.status,at};
   if(questionToolId){observation.questionToolId=questionToolId;observation.questionResolved=poll.questionResolved===true;observation.questionPresent=poll.questionPresent===true;}
   if(metadata&&poll.currentTurn===true)observation.currentTurn=true;
   selected.push(observation);
  }
 }
 return selected;
}
export function queryRuntime(bridge,ids,{timeoutMs=5000,connect=net.createConnection,now=Date.now,questionToolId,metadata=false}={}){
 if(!validBridge(bridge)||!ids.length||ids.length>8||(!questionToolId&&!metadata&&ids.includes(bridge.threadId))||ids.some(id=>!UUID.test(id)))return Promise.resolve([]);
 if((questionToolId||metadata)&&ids.length!==1)return Promise.resolve([]);
 const at=now();
 return new Promise(resolve=>{
  let socket,buffer=Buffer.alloc(0),done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);socket?.destroy();resolve(value);};
  const timer=setTimeout(()=>finish([]),timeoutMs);
  try{
   socket=connect(bridge.pipe);
   socket.on('error',()=>finish([]));socket.on('end',()=>finish([]));
   socket.on('connect',()=>{
    const args=questionToolId||metadata?{threadId:ids[0],hostId:'local',turnLimit:1,includeOutputs:false,maxOutputCharsPerItem:0}:{targets:ids.map(threadId=>({threadId,hostId:'local'})),timeoutMs:0};
    const request={jsonrpc:'2.0',id:1,method:'tools/call',params:{arguments:args,callerSource:'codex',callId:randomUUID(),namespace:'codex_app',threadId:bridge.threadId,tool:questionToolId||metadata?'read_thread':'wait_threads',turnId:bridge.turnId}};
    const payload=Buffer.from(JSON.stringify(request)),frame=Buffer.alloc(payload.length+4);frame.writeUInt32LE(payload.length);payload.copy(frame,4);socket.write(frame);
   });
   socket.on('data',part=>{
    if(done)return;buffer=Buffer.concat([buffer,part]);if(buffer.length>2_000_004)return finish([]);
    if(buffer.length<4)return;const length=buffer.readUInt32LE(0);if(length>2_000_000)return finish([]);if(buffer.length<4+length)return;
    try{const response=JSON.parse(buffer.subarray(4,4+length).toString());finish(response.id===1?selectRuntime(response.result,ids,at,{questionToolId,metadata}):[]);}catch{finish([]);}
   });
  }catch{finish([]);}
 });
}
export function reconcileRuntime(previous,observation){
 if(observation.at<(previous?.at||0)||previous?.retiredTurns?.includes(observation.turnId))return previous;
 if(observation.type==='notLoaded')return previous;
 // A validated latest-turn read can recover a missed start hook. Old retired
 // turns, in-flight snapshots and generic wait results cannot replace it.
 if(observation.currentTurn===true&&(!previous||previous.turnId!==observation.turnId)){
  previous={sessionId:observation.sessionId,turnId:observation.turnId,at:observation.at,rootObserved:true,questionPending:false,approvalPending:false,
   retiredTurns:[...new Set([...(previous?.retiredTurns||[]),...(previous?.turnId?[previous.turnId]:[])])].slice(-32)};
 }
 if(!previous)return previous;
 // Hooks anchor the turn. Never replace a newer run with a snapshot of another.
 if(previous.turnId!==observation.turnId||observation.type==='notLoaded')return previous;
 // A running agent can do independent work while an asynchronous question is
 // still open. Empty runtime flags alone do not prove a human reply.
 const unresolvedQuestion=previous.questionPending&&previous.questionToolId&&!(observation.questionResolved===true&&observation.questionToolId===previous.questionToolId);
 let status;
 if(observation.type==='active')status=observation.flags.includes('waitingOnUserInput')?'aguardando_resposta':observation.flags.includes('waitingOnApproval')?observation.approvalReviewer==='user'?'aguardando_aprovacao':observation.approvalReviewer==='auto_review'?'processando':'sem_sinal':'processando';
 else if(observation.type==='systemError'||observation.turnStatus==='failed')status='sem_sinal';
 else if(observation.turnStatus==='completed')status='respondido';
 else if(observation.turnStatus==='interrupted')status='interrompido';
 else return previous;
 if(unresolvedQuestion&&status!=='interrompido')status='aguardando_resposta';
 const questionPending=status==='aguardando_resposta',approvalPending=status==='aguardando_aprovacao';
 if(previous.status===status&&previous.questionPending===questionPending&&previous.approvalPending===approvalPending)return previous;
 return {...previous,status,questionPending,approvalPending,questionToolId:questionPending?previous.questionToolId:undefined,approvalTool:approvalPending?previous.approvalTool:undefined,approvalToolId:approvalPending?previous.approvalToolId:undefined,at:observation.at,lastEvent:'DesktopStatus'};
}
