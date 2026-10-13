import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {UUID} from './state.mjs';

export function calendarDate(at,timeZone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));
  return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');
}
const count=value=>Number.isSafeInteger(value)&&value>=0;
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

// Private numeric history, independent of the active link registry. No Codex content.
export async function createTokenHistory({dataDir,timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}){
  const path=join(dataDir,'token-history.json');
  let state={version:1,timeZone,threads:{}};
  try{
    const text=await readFile(path,'utf8');
    if(text.length>20000000)throw new Error('history too large');
    const input=JSON.parse(text);
    if(input.version!==1||typeof input.timeZone!=='string'||!input.threads||typeof input.threads!=='object'||Array.isArray(input.threads))throw new Error('unsupported history');
    calendarDate(Date.now(),input.timeZone);
    const threads={};
    for(const [id,row] of Object.entries(input.threads)){
      if(!UUID.test(id)||!count(row.sinceAt)||!count(row.lastAt)||row.lastAt<row.sinceAt||!count(row.lastTotal)||!count(row.unallocatedTokens)||!Array.isArray(row.daily))throw new Error('invalid history');
      const dates=new Set();
      const daily=row.daily.map(day=>{
        if(!validDay(day.date)||dates.has(day.date)||!count(day.tokens)||typeof day.partial!=='boolean')throw new Error('invalid day');
        dates.add(day.date);return {date:day.date,tokens:day.tokens,partial:day.partial};
      }).sort((a,b)=>a.date.localeCompare(b.date));
      threads[id.toLowerCase()]={sinceAt:row.sinceAt,lastAt:row.lastAt,lastTotal:row.lastTotal,unallocatedTokens:row.unallocatedTokens,daily,tracking:row.tracking===true,needsBaseline:row.needsBaseline===true,...(typeof row.title==='string'?{title:row.title.slice(0,512)}:{})};
    }
    state={version:1,timeZone:input.timeZone,threads};
  }catch(error){if(error.code!=='ENOENT')throw error;}
  let tail=Promise.resolve();
  const serial=fn=>{const work=tail.then(fn);tail=work.catch(()=>{});return work;};
  async function commit(next){
    await mkdir(dataDir,{recursive:true});
    await writeFile(path+'.tmp',JSON.stringify(next));
    await rename(path+'.tmp',path);
    state=next;
  }
  return {
    capture(rows,at){return serial(async()=>{
      if(!count(at))throw new Error('invalid time');
      const next=structuredClone(state),today=calendarDate(at,state.timeZone);
      let changed=false;
      for(const input of rows){
        if(!UUID.test(input.id)||input.confirmed!==true||!count(input.totalTokens))continue;
        const id=input.id.toLowerCase(),old=next.threads[id];
        if(old&&at<=old.lastAt)continue;
        const row=old||{sinceAt:at,lastAt:at,lastTotal:input.totalTokens,unallocatedTokens:0,daily:[],tracking:true,needsBaseline:false};
        let day=row.daily.find(value=>value.date===today);
        if(!day){day={date:today,tokens:0,partial:!old};row.daily.push(day);}
        if(old){
          const previousDay=calendarDate(old.lastAt,state.timeZone),delta=input.totalTokens-old.lastTotal;
          if(row.needsBaseline){
            day.partial=true;
            if(delta>0){if(!count(row.unallocatedTokens+delta))throw new Error('history overflow');row.unallocatedTokens+=delta;}
          }
          else if(delta<0){day.partial=true;}
          else if(previousDay===today){
            if(!count(day.tokens+delta))throw new Error('history overflow');
            day.tokens+=delta;
          }else if(delta>0){
            // A cumulative change spanning midnight has no reliable date.
            if(!count(row.unallocatedTokens+delta))throw new Error('history overflow');
            row.unallocatedTokens+=delta;day.partial=true;
            const previous=row.daily.find(value=>value.date===previousDay);if(previous)previous.partial=true;
          }
          if(at-old.lastAt>150000)day.partial=true;
        }
        row.lastAt=at;row.lastTotal=input.totalTokens;row.tracking=true;row.needsBaseline=false;next.threads[id]=row;changed=true;
      }
      if(changed)await commit(next);
    });},
    labels(values,allowed){return serial(async()=>{
      const next=structuredClone(state);let changed=false;
      for(const {id,title} of values){
        if(allowed.includes(id)&&next.threads[id]&&next.threads[id].title!==title){next.threads[id].title=title;changed=true;}
      }
      if(changed)await commit(next);
    });},
    sync(activeIds){return serial(async()=>{
      const allowed=new Set(activeIds),next=structuredClone(state);let changed=false;
      for(const [id,row] of Object.entries(next.threads)){
        const tracking=allowed.has(id);
        if(row.tracking!==tracking){row.tracking=tracking;row.needsBaseline=true;changed=true;}
      }
      if(changed)await commit(next);
    });},
    snapshot(activeIds){
      const active=new Set(activeIds);
      return {confirmed:true,timeZone:state.timeZone,rows:Object.entries(state.threads).map(([id,row])=>({id,...structuredClone(row),active:active.has(id)}))};
    },
    flush:()=>tail
  };
}
