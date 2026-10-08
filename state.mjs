export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const events = new Set(['UserPromptSubmit','PreToolUse','PermissionRequest','PostToolUse','PreCompact','PostCompact','Stop','Interrupt','SessionEnd']);
export function minimalEvent(input, at=Date.now()) {
 if(!UUID.test(input.session_id||'')||!events.has(input.hook_event_name))return null;
 const tool=String(input.tool_name||'').toLowerCase();
 return {sessionId:input.session_id.toLowerCase(),turnId:String(input.turn_id||'').slice(0,100),event:input.hook_event_name,at,subagent:Boolean(input.agent_id),
 question:/(?:^|__|\.)request_user_input(?:_async)?$/.test(tool),asyncQuestion:/request_user_input_async$/.test(tool),toolId:String(input.tool_use_id||'').slice(0,100),tool:tool.slice(0,160)};
}
export function reduceState(previous,e) {
 if(e.subagent===true)return previous;
 if(previous&&e.at<previous.at)return previous;
 if(previous?.retiredTurns?.includes(e.turnId))return previous;
 const changedTurn=previous?.turnId&&e.turnId&&previous.turnId!==e.turnId;
 if(e.event==='PreCompact'||e.event==='PostCompact'){
  if(!previous||changedTurn||!e.turnId)return previous;
  return {...previous,at:e.at,lastEvent:e.event,[e.event==='PreCompact'?'preCompactAt':'postCompactAt']:e.at};
 }
 if(e.event==='QuestionResolved'){
  if(!previous?.questionPending||changedTurn||!e.turnId||!e.toolId||previous.questionToolId!==e.toolId||!['inProgress','completed'].includes(e.turnStatus))return previous;
  return {...previous,at:e.at,lastEvent:e.event,questionPending:false,questionToolId:undefined,
   questionResolvedToolId:e.toolId,questionResolvedAt:e.at,
   status:previous.approvalPending?'aguardando_aprovacao':e.turnStatus==='completed'?'respondido':'processando'};
 }
 const rootStart=e.subagent===false&&['PreToolUse','PermissionRequest','Stop'].includes(e.event);
 // Desktop may omit UserPromptSubmit. An explicit main-thread tool event can
 // start a new turn; subagents and results of retired turns cannot reopen it.
 if(e.event==='UserPromptSubmit'||(changedTurn&&rootStart)){
  const retiredTurns=[...new Set([...(previous?.retiredTurns||[]),...(changedTurn?[previous.turnId]:[])])].slice(-32);
  previous={sessionId:e.sessionId,turnId:e.turnId,startedByPrompt:e.event==='UserPromptSubmit',rootObserved:true,
   at:e.at,lastEvent:e.event,status:'processando',questionPending:false,approvalPending:false,retiredTurns};
  if(e.event==='UserPromptSubmit')return previous;
 }
 let s={...(previous||{}),sessionId:e.sessionId,at:e.at,lastEvent:e.event};
 // Hooks may attach midway through a run; subagents share the root session
 // ID, so a first child tool event must not veto the root's Stop.
 if(s.turnId&&e.turnId&&s.turnId!==e.turnId){
  if(e.event!=='Stop'||(e.subagent!==false&&s.startedByPrompt))return previous;
  s={sessionId:e.sessionId,turnId:e.turnId,at:e.at,lastEvent:e.event,status:'respondido',questionPending:false,approvalPending:false};
 }
 if(previous?.status==='respondido'&&e.event!=='SessionEnd')return previous;
 if(previous?.status==='interrompido'&&e.event!=='SessionEnd')return previous;
 if(e.turnId)s.turnId=e.turnId;
 if(e.subagent===false)s.rootObserved=true;
 if(e.event==='PermissionRequest'){
  s.approvalReviewer=e.approvalReviewer||'unknown';
  s.approvalPending=s.approvalReviewer==='user';
  s.approvalTool=s.approvalPending?e.tool:undefined;
  s.approvalToolId=s.approvalPending?(e.toolId||(s.lastPreTool===e.tool?s.lastPreToolId:undefined)):undefined;
  s.status=s.questionPending?'aguardando_resposta':s.approvalPending?'aguardando_aprovacao':s.approvalReviewer==='auto_review'?'processando':'sem_sinal';
 }
 if(e.event==='PreToolUse'){
  s.lastPreTool=e.tool;s.lastPreToolId=e.toolId;
  if(e.question){s.questionPending=true;s.questionToolId=e.toolId;}
  s.status=s.approvalPending?'aguardando_aprovacao':s.questionPending?'aguardando_resposta':'processando';
 }
 if(e.event==='PostToolUse'){
  const approvalMatches=s.approvalToolId?Boolean(e.toolId&&s.approvalToolId===e.toolId):(!s.approvalTool||s.approvalTool===e.tool);
  if(approvalMatches){s.approvalPending=false;s.approvalTool=undefined;s.approvalToolId=undefined;}
  if(e.question&&!e.asyncQuestion&&(!s.questionToolId||s.questionToolId===e.toolId))s.questionPending=false;
  s.status=s.approvalPending?'aguardando_aprovacao':s.questionPending?'aguardando_resposta':'processando';
 }
 if(e.event==='Stop'){s.approvalPending=false;s.approvalTool=undefined;s.approvalToolId=undefined;s.status=s.questionPending?'aguardando_resposta':'respondido';}
 if(e.event==='Interrupt'){s.status='interrompido';s.approvalPending=false;s.questionPending=false;}
 if(e.event==='SessionEnd'){s.sessionEnded=true;if(s.status==='processando')s.status='sem_sinal';}
 return s;
}
