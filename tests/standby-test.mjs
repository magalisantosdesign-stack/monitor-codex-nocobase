import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canStandby,resumesStandby,visibleStates} from '../src/standby.mjs';
import {reduceState} from '../src/state.mjs';
test('Stand-by preserves execution state and excludes unlinked chats',()=>{
 for(const status of ['respondido','interrompido','sem_sinal'])assert.equal(canStandby({status}),true);
 for(const status of ['processando','aguardando_resposta','aguardando_aprovacao'])assert.equal(canStandby({status}),false);
 assert.equal(canStandby({status:'respondido',questionPending:true}),false);
 assert.equal(canStandby({status:'sem_sinal',approvalPending:true}),false);
 const states={linked:{status:'respondido',at:10},other:{status:'processando',at:20}};
 assert.deepEqual(visibleStates(['linked'],states,{linked:{at:30}}),{linked:{status:'respondido',at:10,standby:true,standbyAt:30}});
 assert.deepEqual(states.linked,{status:'respondido',at:10});
});
test('Only accepted new root execution resumes Stand-by',()=>{
 const marker={at:100,turnId:'old'},previous={status:'respondido',at:90,turnId:'old'};
 for(const event of ['UserPromptSubmit','PreToolUse','PermissionRequest','Stop']){
  const e={event,at:110,turnId:'new',sessionId:'example',subagent:false};
  const next=reduceState(previous,e);
  assert.equal(resumesStandby(marker,previous,next,e),true,event);
 }
 for(const e of [
  {event:'Stop',turnId:'old',at:110,subagent:false},
  {event:'PreToolUse',turnId:'new',at:110,subagent:true},
  {event:'UserPromptSubmit',turnId:'new',at:80,subagent:false},
  {event:'PostToolUse',turnId:'new',at:110,subagent:false},
  {event:'SessionEnd',turnId:'old',at:110,subagent:false},
 ])assert.equal(resumesStandby(marker,previous,reduceState(previous,e),e),false,JSON.stringify(e));
});
