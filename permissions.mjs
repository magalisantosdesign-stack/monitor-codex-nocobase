import {config} from './config.mjs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';

// Read only the per-chat reviewer setting. This is a desktop settings snapshot,
// not a live approval queue. Missing/changed schemas must remain unknown.
export function reviewerFromSnapshot(snapshot,sessionId){
 const value=snapshot?.['electron-persisted-atom-state']?.['heartbeat-thread-permissions-by-id']?.[sessionId]?.approvalsReviewer;
 return value==='auto_review'||value==='user'?value:'unknown';
}
export async function readReviewerSettings(){
 const file=config.settingsFile;
 try {return JSON.parse(await readFile(file,'utf8'));}catch{return null;}
}
export function reconcileApprovalReviewer(state,reviewer){
 if(!state?.approvalPending||reviewer!=='auto_review')return state;
 return {...state,approvalReviewer:reviewer,approvalPending:false,approvalTool:undefined,approvalToolId:undefined,
  status:state.questionPending?'aguardando_resposta':'processando'};
}
