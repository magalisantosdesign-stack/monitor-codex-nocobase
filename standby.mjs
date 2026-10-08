// Personal organization is separate from execution status and business data.
export function canStandby(state){
 return !state?.questionPending&&!state?.approvalPending&&['respondido','interrompido','sem_sinal'].includes(state?.status||'sem_sinal');
}
export function resumesStandby(marker,previous,next,event){
 if(!marker||next===previous||!next||event.subagent===true||event.at<marker.at)return false;
 if(event.event==='UserPromptSubmit')return true;
 if(!['PreToolUse','PermissionRequest','Stop'].includes(event.event)||event.subagent!==false)return false;
 return Boolean(next.turnId&&next.turnId!==marker.turnId)||['processando','aguardando_aprovacao','aguardando_resposta'].includes(next.status);
}
export function visibleStates(ids,states,standby){
 return Object.fromEntries(ids.filter(id=>states[id]||standby[id]).map(id=>[id,{...states[id],standby:Boolean(standby[id]),standbyAt:standby[id]?.at}]));
}
