import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
export const root=dirname(dirname(fileURLToPath(import.meta.url)));
const file=process.env.CODEX_MONITOR_CONFIG||join(root,'config.local.json');
let local={};
try{local=JSON.parse(readFileSync(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('Configuração local inválida.');}
const port=Number(process.env.CODEX_MONITOR_PORT||local.port||13011);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta inválida.');
const origins=local.origins||['http://localhost:13000','http://127.0.0.1:13000'];
if(!Array.isArray(origins)||!origins.length||origins.some(origin=>{
 try{const url=new URL(origin);return !['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.origin!==origin;}catch{return true;}
}))throw new Error('Informe origens locais completas, sem curingas ou caminhos.');
const codexHome=resolve(process.env.CODEX_HOME||local.codexHome||join(homedir(),'.codex'));
export const config={port,origins,codexHome,
 dataDir:resolve(root,process.env.CODEX_MONITOR_DATA||local.dataDir||'.local/data'),
 settingsFile:resolve(root,process.env.CODEX_MONITOR_SETTINGS||local.settingsFile||join(codexHome,'.codex-global-state.json')),
 instanceId:createHash('sha256').update(root).digest('hex').slice(0,24)};
