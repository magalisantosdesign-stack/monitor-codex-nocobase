import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const reasons={CONFIG_INVALID:'Confira config.local.json: porta, origens locais e JSON valido.',PORT_OCCUPIED:'A porta atende outro servico ou outra instalacao. Escolha outra porta tambem no painel.',LOCK_UNAVAILABLE:'Confira permissoes da pasta de dados e a trava de inicio.',START_IN_PROGRESS:'Outra tentativa esta em andamento. Aguarde e tente novamente.',SPAWN_FAILED:'Windows nao conseguiu abrir o processo Node.',SERVER_EXITED:'O coletor encerrou ao iniciar. Confira service-error.log na pasta de dados.',START_TIMEOUT:'O coletor nao confirmou inicio no prazo. Confira service-error.log e tente novamente.',START_FAILED:'Confira os logs privados da instalacao.'};
let startup;
try{startup=JSON.parse(await readFile(join(root,'.local','startup-result.json'),'utf8'));}catch{}
let config;
try{({config}=await import('./config.mjs'));}catch{console.log('Configuracao invalida. Confira config.local.json.');process.exitCode=1;}
if(config){
 let connected=false;
 try{
  const response=await fetch(`http://127.0.0.1:${config.port}/states`,{headers:{Origin:config.origins[0]},signal:AbortSignal.timeout(2500)});
  const body=await response.json();connected=response.ok&&body.service==='codex-monitor'&&body.instanceId===config.instanceId;
 }catch{}
 console.log(connected?'Coletor conectado nesta instalacao.':'Coletor nao confirmado nesta instalacao.');
 if(!connected){console.log('Abra Iniciar-Monitor.cmd, ou execute node Iniciar-Monitor.mjs.');process.exitCode=1;}
 else console.log('Se o painel continua desconectado, confira endpoint, origem do NocoBase e permissoes do navegador.');
}
if(startup)console.log('Ultima tentativa: '+startup.at+' · '+startup.code+(reasons[startup.code]?'\n'+reasons[startup.code]:''));
else console.log('Nenhuma tentativa Node registrada. Confira .local/windows-launcher.log e se o navegador autorizou abrir o iniciador.');
