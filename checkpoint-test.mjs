import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {captureBeforeCompact,publishEvent} from './checkpoint.mjs';
import {minimalEvent,reduceState} from './state.mjs';
const id='00000000-0000-4000-8000-000000000001',turn='00000000-0000-4000-8000-000000000002';
const base=await mkdtemp(join(tmpdir(),'monitor-checkpoint-'));
const env={CODEX_APP_TOOLS_PIPE_PATH:'\\\\.\\pipe\\codex-checkpoint-test'};
const pre={sessionId:id,turnId:turn,event:'PreCompact',subagent:false,at:11};
const pending={sessionId:id,turnId:turn,status:'aguardando_resposta',at:10,questionPending:true,questionToolId:'q',approvalPending:false};
const proof={sessionId:id,turnId:turn,questionToolId:'q',questionResolved:true,turnStatus:'inProgress',at:12};
let calls=0;
try{
 await mkdir(join(base,'events'));await writeFile(join(base,'linked.json'),JSON.stringify({ids:[id]}));
 await writeFile(join(base,'states.json'),JSON.stringify({[id]:pending}));
 assert.equal(minimalEvent({session_id:id,turn_id:turn,hook_event_name:'PreCompact',transcript_path:'PRIVATE',prompt:'PRIVATE'},11).event,'PreCompact');
 assert.equal(minimalEvent({session_id:id,turn_id:turn,hook_event_name:'QuestionResolved'}),null,'Only internal confirmed metadata may emit receipts.');
 assert.equal(reduceState(pending,pre).status,'aguardando_resposta','Compaction does not prove a reply.');
 assert.equal(await captureBeforeCompact(base,pre,{env,query:async(bridge,ids,options)=>{
  calls++;assert.deepEqual(ids,[id]);assert.equal(bridge.threadId,id);assert.equal(options.timeoutMs,900);assert.equal(options.questionToolId,'q');return [proof];
 }}),true);
 const files=await readdir(join(base,'events'));assert.equal(files.length,1);
 const receipt=JSON.parse(await readFile(join(base,'events',files[0]),'utf8'));
 assert.deepEqual(Object.keys(receipt).sort(),['sessionId','turnId','event','at','subagent','toolId','turnStatus'].sort());
 assert.equal(receipt.event,'QuestionResolved');assert.ok(!JSON.stringify(receipt).includes('PRIVATE'));
 let restored=reduceState(pending,pre);restored=reduceState(restored,receipt);
 restored=reduceState(restored,{...pre,event:'PostCompact',at:13});
 assert.equal(restored.status,'processando');assert.equal(restored.questionPending,false);assert.equal(restored.questionResolvedToolId,'q');
 // The same durable receipt works after restarting the collector, even when
 // compacted desktop history no longer contains the question or reply IDs.
 assert.equal(reduceState(pending,receipt).status,'processando');
 assert.equal(reduceState({...pending,questionToolId:'new-question'},receipt).status,'aguardando_resposta');
 assert.equal(reduceState({...pending,turnId:'different-turn'},receipt).status,'aguardando_resposta');
 assert.equal(reduceState(pending,{...receipt,subagent:true}),pending);
 assert.equal(reduceState({...pending,at:20},receipt).status,'aguardando_resposta');
 assert.equal(reduceState(pending,{...receipt,turnStatus:'completed'}).status,'respondido');
 assert.equal(await captureBeforeCompact(base,pre,{env,query:async()=>[{...proof,questionResolved:false}]}),false);
 assert.equal(await captureBeforeCompact(base,pre,{env,query:async()=>[{...proof,questionToolId:'wrong'}]}),false);
 assert.equal(await captureBeforeCompact(base,pre,{env,query:async()=>[]}),false);
 assert.equal(await captureBeforeCompact(base,{...pre,subagent:true},{env,query:async()=>{throw Error('must not query child');}}),false);
 assert.equal(await captureBeforeCompact(base,{...pre,event:'PostCompact'},{env,query:async()=>{throw Error('too late');}}),false);
 // The question can still be queued rather than consumed by the server.
 await writeFile(join(base,'states.json'),'{}');
 await rm(join(base,'events'),{recursive:true});await mkdir(join(base,'events'));
 await publishEvent(base,{sessionId:id,turnId:turn,event:'PreToolUse',subagent:false,at:10,question:true,asyncQuestion:true,toolId:'q'});
 assert.equal(await captureBeforeCompact(base,pre,{env,query:async()=>[proof]}),true);
 await writeFile(join(base,'linked.json'),JSON.stringify({ids:[]}));
 assert.equal(await captureBeforeCompact(base,pre,{env,query:async()=>[proof]}),false,'Unlinking during a read must discard the receipt.');
 assert.equal(calls,1);
 console.log('PASS: pre-compaction receipt, durable restart, queued question, stale/wrong/child proof rejection, real pending preservation and privacy.');
}finally{
 const target=resolve(base);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.includes('monitor-checkpoint-'));
 await rm(target,{recursive:true,force:true});
}
