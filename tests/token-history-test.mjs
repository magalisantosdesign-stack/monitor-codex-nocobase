import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {calendarDate,createTokenHistory} from '../src/token-history.mjs';
import {createTokenReader} from '../src/tokens.mjs';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const root=await mkdtemp(join(tmpdir(),'monitor-token-history-'));
const stamp=value=>Date.parse(value),row=totalTokens=>({id,totalTokens,confirmed:true,prompt:'SECRET'});
try{
 assert.equal(calendarDate(stamp('2026-10-10T02:59:59Z'),'America/Sao_Paulo'),'2026-10-09');
 assert.equal(calendarDate(stamp('2026-10-10T03:00:00Z'),'America/Sao_Paulo'),'2026-10-10');
 let history=await createTokenHistory({dataDir:root,timeZone:'America/Sao_Paulo'});
 await history.capture([row(1000)],stamp('2026-10-09T20:00:00Z'));
 await history.capture([row(1050)],stamp('2026-10-09T20:01:00Z'));
 await history.capture([row(1050)],stamp('2026-10-09T20:01:00Z'));
 await history.labels([{id,title:'Tarefa fictícia'},{id:other,title:'FORBIDDEN'}],[id]);
 let saved=history.snapshot([id]);assert.equal(saved.rows.length,1);assert.equal(saved.rows[0].daily[0].tokens,50);assert.equal(saved.rows[0].title,'Tarefa fictícia');
 await history.capture([{id,totalTokens:9999,confirmed:false}],stamp('2026-10-09T20:02:00Z'));
 assert.equal(history.snapshot([id]).rows[0].lastTotal,1050);
 // A change across midnight stays undated instead of being charged to the new day.
 await history.capture([row(1100)],stamp('2026-10-10T03:00:00Z'));
 saved=history.snapshot([id]).rows[0];assert.equal(saved.unallocatedTokens,50);assert.equal(saved.daily[1].tokens,0);assert.equal(saved.daily[1].partial,true);
 await history.capture([row(1120)],stamp('2026-10-10T03:01:00Z'));
 await history.capture([row(5)],stamp('2026-10-10T03:02:00Z'));
 await history.capture([row(15)],stamp('2026-10-10T03:03:00Z'));
 saved=history.snapshot([]).rows[0];assert.equal(saved.daily[1].tokens,30);assert.equal(saved.active,false);assert.equal(saved.lastTotal,15);
 // Reopening preserves historical records and their original timezone.
 history=await createTokenHistory({dataDir:root,timeZone:'UTC'});assert.equal(history.snapshot([]).timeZone,'America/Sao_Paulo');assert.equal(history.snapshot([]).rows[0].title,'Tarefa fictícia');
 await Promise.all([history.capture([row(20)],stamp('2026-10-10T03:04:00Z')),history.capture([row(25)],stamp('2026-10-10T03:05:00Z'))]);
 assert.equal(history.snapshot([id]).rows[0].daily[1].tokens,40);
 let time=stamp('2026-10-10T03:06:00Z'),ids=[id],calls=0,total=30;
 const reader=createTokenReader({codexHome:root,ids:()=>ids,history,now:()=>time,accountRead:async()=>{calls++;return null;},linkedRead:async()=>[row(total)]});
 await reader.sample();assert.equal(calls,0,'Background sampling never queries the account');
 await reader();assert.equal(calls,1);ids=[];
 const detached=await reader();assert.equal(detached.threads.rows.length,0);assert.equal(detached.history.rows.length,1);assert.equal(detached.history.rows[0].active,false);
 ids=[id];time+=60001;total=35;await reader.sample();await reader.stop();
 assert.equal(history.snapshot([]).rows[0].daily[1].tokens,50);
 await history.sync([]);await history.sync([id]);
 await history.capture([row(135)],time+60002);
 assert.equal(history.snapshot([id]).rows[0].daily[1].tokens,50,'Relinking never assigns paused usage to the current period');
 assert.equal(history.snapshot([id]).rows[0].unallocatedTokens,150);
 // View preferences never change counters, links, tracking or daily history.
 const original=history.snapshot([id]).rows[0];
 assert.equal(original.category,'unclassified');assert.equal(original.usageArchived,false);
 assert.equal(await history.preferences(id,{category:'personal',archived:true}),true);
 let organized=history.snapshot([id]).rows[0];
 assert.equal(organized.category,'personal');assert.equal(organized.usageArchived,true);
 assert.deepEqual(organized.daily,original.daily);assert.equal(organized.lastTotal,original.lastTotal);assert.equal(organized.tracking,original.tracking);
 await history.capture([row(145)],time+120002);
 assert.equal(history.snapshot([id]).rows[0].daily[1].tokens,60,'Archive does not stop numeric collection');
 history=await createTokenHistory({dataDir:root});
 organized=history.snapshot([]).rows[0];assert.equal(organized.category,'personal');assert.equal(organized.usageArchived,true);assert.equal(organized.active,false);
 await history.preferences(id,{archived:false});
 assert.equal(history.snapshot([]).rows[0].category,'personal');assert.equal(history.snapshot([]).rows[0].usageArchived,false);
 await assert.rejects(history.preferences(id,{category:'SECRET'}));await assert.rejects(history.preferences(id,{archived:'true'}));
 await assert.rejects(history.preferences(id,{totalTokens:0}));await assert.rejects(history.preferences(id,{}));
 assert.equal(await history.preferences(other,{category:'professional'}),false);assert.equal(history.snapshot([]).rows.length,1);
 // Old numeric files migrate without assuming personal/professional categories.
 const legacy=JSON.parse(await readFile(join(root,'token-history.json'),'utf8'));
 delete legacy.threads[id].category;delete legacy.threads[id].usageArchived;
 await writeFile(join(root,'token-history.json'),JSON.stringify(legacy));
 history=await createTokenHistory({dataDir:root});assert.equal(history.snapshot([]).rows[0].category,'unclassified');assert.equal(history.snapshot([]).rows[0].usageArchived,false);
 const text=await readFile(join(root,'token-history.json'),'utf8');assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('FORBIDDEN'));
 // Never overwrite an unreadable history to make the feature appear healthy.
 await writeFile(join(root,'token-history.json'),'{bad');await assert.rejects(createTokenHistory({dataDir:root}));assert.equal(await readFile(join(root,'token-history.json'),'utf8'),'{bad');
 console.log('PASS: numeric history, calendar gaps, retained unlinked records, private labels, category/archive/restore persistence, legacy migration, continued collection while archived, validation and corrupt-file preservation.');
}finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});}
