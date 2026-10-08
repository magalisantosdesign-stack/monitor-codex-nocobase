import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {config,root} from './config.mjs';
export function hookCommand(node,script,platform=process.platform){
 if(platform==='win32'){
  if(/["\r\n%&|<>!^]/.test(node+script))throw new Error('Caminho incompatível com o shell Windows.');
  return '"'+node+'" "'+script+'"';
 }
 const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
 return quote(node)+' '+quote(script);
}
export function mergeHooks(existing,command,{legacyCommand}={}){
 const next=structuredClone(existing||{description:'Monitor local de chats vinculados.',hooks:{}});
 next.hooks??={};
 for(const event of ['UserPromptSubmit','PreToolUse','PermissionRequest','PostToolUse','PreCompact','PostCompact','Stop','Interrupt','SessionEnd']){
  const groups=next.hooks[event]||[];
  if(!Array.isArray(groups))throw new Error('Configuração de hooks incompatível.');
  const retained=groups.map(group=>({...group,hooks:(group.hooks||[]).filter(handler=>handler.command!==command&&(!legacyCommand||handler.command!==legacyCommand))})).filter(group=>group.hooks.length);
  next.hooks[event]=[...retained,{matcher:['PreCompact','PostCompact'].includes(event)?'manual|auto':'*',hooks:[{type:'command',command,commandWindows:command,timeout:3}]}];
 }
 return next;
}
async function install(){
 const command=hookCommand(process.execPath,join(root,'hook.mjs'));
 const target=join(config.codexHome,'hooks.json');
 if(!process.argv.includes('--apply')){
  console.log(JSON.stringify({mode:'prévia',destination:target,command,events:9,note:'Nenhum arquivo alterado. Use --apply para instalar e revise a confiança no Codex.'},null,2));return;
 }
 let raw,existing;
 try{raw=await readFile(target,'utf8');existing=JSON.parse(raw);}catch(error){if(error.code!=='ENOENT')throw error;}
 const legacyCommand=process.platform==='win32'?process.execPath+' "'+join(root,'hook.mjs')+'"':undefined;
 const next=mergeHooks(existing,command,{legacyCommand});
 await mkdir(config.codexHome,{recursive:true});
 if(raw!==undefined){const backups=join(root,'.local','backups');await mkdir(backups,{recursive:true});await writeFile(join(backups,'hooks-'+Date.now()+'.json'),raw,{flag:'wx'});}
 const temporary=target+'.monitor-'+process.pid+'.tmp';
 await writeFile(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx'});await rename(temporary,target);
 console.log('Hooks instalados; outros handlers preservados. Revise e conceda confiança no Codex. Nenhuma aprovação de ferramenta ou configuração de confiança foi alterada.');
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith('/Install-Hooks.mjs')&&process.argv[1].replace(/\\/g,'/').endsWith('/Install-Hooks.mjs')){
 try{await install();}catch(error){console.error(error.message);process.exitCode=1;}
}
