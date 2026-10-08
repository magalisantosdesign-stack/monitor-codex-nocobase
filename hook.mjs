import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {minimalEvent} from './state.mjs';
import {bridgeFromHook} from './runtime.mjs';
import {captureBeforeCompact} from './checkpoint.mjs';
try {
 const {config}=await import('./config.mjs');
 const base=config.dataDir;
 const raw=readFileSync(0,'utf8');if(raw.length>2_000_000)throw new Error('oversized');
 const e=minimalEvent(JSON.parse(raw));
 if(e){const registry=JSON.parse(readFileSync(join(base,'linked.json'),'utf8'));
  if((registry.ids||[]).includes(e.sessionId)){
   const dir=join(base,'events');mkdirSync(dir,{recursive:true});
   const target=join(dir,`${e.at}-${randomUUID()}.json`),temporary=target+'.tmp';
   writeFileSync(temporary,JSON.stringify(e),{flag:'wx'});renameSync(temporary,target);
   const bridge=bridgeFromHook(e);
   if(bridge){const bridges=join(base,'desktop-bridges');mkdirSync(bridges,{recursive:true});const tmp=join(bridges,`${randomUUID()}.tmp`);writeFileSync(tmp,JSON.stringify(bridge),{flag:'wx'});renameSync(tmp,join(bridges,e.sessionId+'.json'));}
   if(e.event==='PreCompact')await captureBeforeCompact(base,e);
  }
 }
}catch{ /* Monitor failure must never block Codex. */ }
process.stdout.write('{}\n');
