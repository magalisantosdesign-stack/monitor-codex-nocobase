// Freshness is a display concern. Never fabricate completion or resolve a
// pending question because its verification expired or a read failed.
export const CONFIRMATION_TTL=30000;
export function hookConfirmation(previous,next,event,now=Date.now()){
 if(next===previous||event.subagent||['PreCompact','PostCompact'].includes(event.event))return null;
 if(next?.questionPending&&!(event.question&&event.event==='PreToolUse'))return null;
 return {turnId:next.turnId,verifiedAt:now,source:'hook',reason:null,forceUnknown:false};
}
export function runtimeConfirmation(state,observation,now=Date.now()){
 if(!state||state.turnId!==observation.turnId||observation.type==='notLoaded')return null;
 if(observation.type==='systemError'||observation.turnStatus==='failed')return {turnId:state.turnId,reason:'read_failed',forceUnknown:true,attemptAt:now};
 if((observation.flags||[]).includes('waitingOnApproval')&&!observation.flags.includes('waitingOnUserInput')&&!['user','auto_review'].includes(observation.approvalReviewer))return {turnId:state.turnId,reason:'approval_unconfirmed',forceUnknown:true,attemptAt:now};
 if(state.questionPending&&state.questionToolId&&observation.questionToolId===state.questionToolId&&observation.questionPresent!==true&&!(observation.flags||[]).includes('waitingOnUserInput')){
  return {turnId:state.turnId,reason:'question_unconfirmed',forceUnknown:true,attemptAt:now};
 }
 return {turnId:state.turnId,verifiedAt:now,source:'desktop',reason:null,forceUnknown:false};
}
export function displayState(state,health,now=Date.now()){
 if(!state)return state;
 const fresh=health?.turnId===state.turnId&&!health.forceUnknown&&Number.isFinite(health.verifiedAt)&&now-health.verifiedAt<=CONFIRMATION_TTL;
 const reason=fresh?null:health?.reason||'checking';
 return {...state,displayStatus:fresh?state.status:'nao_confirmado',verification:{confirmed:fresh,verifiedAt:health?.verifiedAt||null,reason,retrying:Boolean(health?.retrying)}};
}
