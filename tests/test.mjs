import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalEvent,reduceState} from '../src/state.mjs';
import {reviewerFromSnapshot,reconcileApprovalReviewer} from '../src/permissions.mjs';
const id='00000000-0000-4000-8000-000000000001';
const event=(name,at,extra={})=>minimalEvent({session_id:id,turn_id:'t1',hook_event_name:name,...extra},at);
test('approval clears after tool; response never completes business task',()=>{
 let s=reduceState(null,event('UserPromptSubmit',1));assert.equal(s.status,'processando');
 s=reduceState(s,{...event('PermissionRequest',2),approvalReviewer:'user'});assert.equal(s.status,'aguardando_aprovacao');
 s=reduceState(s,event('PreToolUse',3));assert.equal(s.status,'aguardando_aprovacao');
 s=reduceState(s,event('PostToolUse',4));assert.equal(s.status,'processando');
 s=reduceState(s,event('Stop',5));assert.equal(s.status,'respondido');assert.equal(s.situacao,undefined);
});
test('async question stays pending until new user prompt',()=>{
 let s=reduceState(null,event('PreToolUse',1,{tool_name:'request_user_input_async'}));
 s=reduceState(s,event('PostToolUse',2,{tool_name:'request_user_input_async'}));
 s=reduceState(s,event('Stop',3));assert.equal(s.status,'aguardando_resposta');
 s=reduceState(s,event('UserPromptSubmit',4));assert.equal(s.status,'processando');
});
test('blocking question resumes when tool returns; stale event ignored',()=>{
 let s=reduceState(null,event('PreToolUse',1,{tool_name:'request_user_input',tool_use_id:'q'}));assert.equal(s.status,'aguardando_resposta');
 s=reduceState(s,event('PostToolUse',2,{tool_name:'request_user_input',tool_use_id:'q'}));assert.equal(s.status,'processando');
 s=reduceState(s,event('Interrupt',3));assert.equal(s.status,'interrompido');assert.equal(reduceState(s,event('Stop',2)).status,'interrompido');
});
test('old turn ignored and content discarded',()=>{
 const s=reduceState(null,event('UserPromptSubmit',5));assert.deepEqual(reduceState(s,{...event('Stop',6,{agent_id:'child'}),turnId:'old'}),s);
 const e=minimalEvent({session_id:id,turn_id:'t1',hook_event_name:'Stop',last_assistant_message:'SECRET',prompt:'SECRET',tool_input:{password:'SECRET'}},1);
 assert.equal(JSON.stringify(e).includes('SECRET'),false);assert.equal(minimalEvent({session_id:'bad',hook_event_name:'Stop'}),null);
});
test('root completion replaces an unanchored subagent turn, including legacy states',()=>{
 let s=reduceState(null,{...event('PostToolUse',1),turnId:'child',subagent:undefined});
 s=reduceState(s,{...event('Stop',2),turnId:'root'});
 assert.equal(s.status,'respondido');assert.equal(s.turnId,'root');
 assert.equal(reduceState(s,{...event('PostToolUse',3,{agent_id:'child'}),turnId:'child'}),s);
 const legacy={sessionId:id,turnId:'child',at:1,status:'processando',approvalPending:true};
 const completed=reduceState(legacy,{...event('Stop',2),turnId:'root'});
 assert.equal(completed.status,'respondido');assert.equal(completed.approvalPending,false);
});
test('late tool results never reopen a completed root turn',()=>{
 let s=reduceState(null,event('UserPromptSubmit',1));
 assert.equal(reduceState(s,{...event('PreToolUse',2,{agent_id:'child'}),turnId:'child'}),s);
 s=reduceState(s,event('Stop',3));
 assert.equal(reduceState(s,event('PostToolUse',4)),s);
 assert.equal(reduceState(s,event('UserPromptSubmit',5)).status,'processando');
});
test('automatic review remains processing and unknown reviewer never claims human approval',()=>{
 let s=reduceState(null,event('UserPromptSubmit',1));
 s=reduceState(s,{...event('PermissionRequest',2,{tool_name:'Bash'}),approvalReviewer:'auto_review'});
 assert.equal(s.status,'processando');assert.equal(s.approvalPending,false);
 s=reduceState(s,event('PermissionRequest',3,{tool_name:'Bash'}));assert.equal(s.status,'sem_sinal');
 s=reduceState(s,event('Stop',4));assert.equal(s.status,'respondido');
});
test('main thread starts without prompt hook, retires old turns and excludes children',()=>{
 let s=reduceState(null,event('UserPromptSubmit',1));s=reduceState(s,event('Stop',2));
 s=reduceState(s,event('PreToolUse',3,{turn_id:'t2',tool_name:'Bash'}));assert.equal(s.status,'processando');assert.equal(s.turnId,'t2');
 assert.equal(reduceState(s,event('Stop',4,{turn_id:'t1'})),s);
 assert.equal(reduceState(s,event('PermissionRequest',5,{turn_id:'child',agent_id:'a'})),s);
 s=reduceState(s,event('Stop',6,{turn_id:'t2'}));
 assert.equal(reduceState(s,event('PostToolUse',7,{turn_id:'t2'})),s);
 assert.equal(reduceState(s,event('PreToolUse',8,{turn_id:'child',agent_id:'a'})),s);
 assert.equal(reduceState(s,event('PreToolUse',9,{turn_id:'t1'})),s);
 s=reduceState(s,event('PreToolUse',10,{turn_id:'t3'}));assert.equal(s.status,'processando');
 s=reduceState(s,event('Stop',11,{turn_id:'t4'}));assert.equal(s.status,'respondido');assert.equal(s.turnId,'t4');
});
test('human approval is correlated by invocation; denial followed by final response cannot stay waiting',()=>{
 let s=reduceState(null,event('PreToolUse',1,{tool_name:'Bash',tool_use_id:'pending'}));
 s=reduceState(s,{...event('PermissionRequest',2,{tool_name:'Bash'}),approvalReviewer:'user'});
 s=reduceState(s,event('PostToolUse',3,{tool_name:'Bash',tool_use_id:'unrelated'}));assert.equal(s.status,'aguardando_aprovacao');
 s=reduceState(s,event('PostToolUse',4,{tool_name:'Bash',tool_use_id:'pending'}));assert.equal(s.status,'processando');
 s=reduceState(s,{...event('PermissionRequest',5,{tool_name:'Bash'}),approvalReviewer:'user'});
 s=reduceState(s,event('Stop',6));assert.equal(s.status,'respondido');assert.equal(s.approvalPending,false);
});
test('reviewer settings are per-chat, fail closed and reconcile only known automatic approval',()=>{
 const snapshot={'electron-persisted-atom-state':{'heartbeat-thread-permissions-by-id':{[id]:{approvalsReviewer:'auto_review',prompt:'SECRET'}}}};
 assert.equal(reviewerFromSnapshot(snapshot,id),'auto_review');assert.equal(reviewerFromSnapshot(snapshot,'other'),'unknown');
 assert.equal(reviewerFromSnapshot(null,id),'unknown');
 const old={sessionId:id,at:1,lastEvent:'PreToolUse',status:'aguardando_aprovacao',approvalPending:true};
 assert.equal(reconcileApprovalReviewer(old,'unknown'),old);assert.equal(reconcileApprovalReviewer(old,'user'),old);
 const fixed=reconcileApprovalReviewer(old,'auto_review');assert.equal(fixed.status,'processando');assert.equal(fixed.at,1);
 assert.equal(reconcileApprovalReviewer({...old,questionPending:true},'auto_review').status,'aguardando_resposta');
 assert.equal(JSON.stringify(fixed).includes('SECRET'),false);
});
