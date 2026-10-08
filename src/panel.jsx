// RunJS surface: js-model.render / JSBlockModel. No record context required.
const React = ctx.libs.React;
const {Alert,Button,Card,Col,Empty,Input,List,Row,Select,Space,Statistic,Tag,Tabs,Typography,theme} = ctx.libs.antd;
// Configure este bloco antes de usar dados reais. A demonstração não faz chamadas de rede.
const MONITOR_CONFIG = {
 demo: true,
 endpoint: 'http://127.0.0.1:13011',
 reconnectUri: 'codex-monitor://reconnect',
 pollMs: 3000,
 linksPollMs: 30000,
 sources: [
  {collection:'projetos',label:'Projeto',idField:'id',titleField:'nome',linkField:'linkCodex',sectorPath:'subarea.nome',statusField:'situacao',appends:['subarea']},
  {collection:'demandas',label:'Tarefa',idField:'id',titleField:'titulo',linkField:'linkCodex',sectorPath:'subarea.nome',statusField:'situacao',appends:['subarea']},
 ],
};
const endpoint=MONITOR_CONFIG.endpoint.replace(/\/$/,'');
const DEMO_CARDS=['processando','aguardando_aprovacao','aguardando_resposta','respondido','interrompido','sem_sinal'].map((status,i)=>({
 key:'demo:'+i,id:i+1,collection:'demo',label:'Exemplo',title:['Preparar campanha fictícia','Revisar proposta fictícia','Escolher formato de exemplo','Gerar resumo de exemplo','Execução interrompida de exemplo','Chat de exemplo sem eventos'][i],sector:'Demonstração',
 chat:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),link:'',business:'',demoStatus:status,
}));
const DEMO_STATES=Object.fromEntries(DEMO_CARDS.filter(row=>row.demoStatus!=='sem_sinal').map(row=>[row.chat,{status:row.demoStatus,at:Date.parse('2026-01-01T12:00:00Z')}]));
function fieldValue(record,path){return String(path||'').split('.').reduce((value,key)=>value?.[key],record);}
const statusNames={processando:'Processando',aguardando_aprovacao:'Aguardando aprovação',aguardando_resposta:'Aguardando resposta',respondido:'Respondido',interrompido:'Interrompido',sem_sinal:'Sem sinal',nao_confirmado:'Estado não confirmado',stand_by:'Stand-by'};
const colors={processando:'processing',aguardando_aprovacao:'orange',aguardando_resposta:'gold',respondido:'green',interrompido:'red',sem_sinal:'default',nao_confirmado:'default',stand_by:'purple'};
const boardStatuses=['processando','aguardando_aprovacao','aguardando_resposta','respondido','interrompido','sem_sinal','nao_confirmado'];
const columnColors={processando:'#1677ff',aguardando_aprovacao:'#fa8c16',aguardando_resposta:'#d4a106',respondido:'#52c41a',interrompido:'#ff4d4f',sem_sinal:'#8c8c8c',nao_confirmado:'#8c8c8c',stand_by:'#722ed1'};
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
function chatId(value){
 const text=String(value||'').trim();
 const match=text.match(new RegExp('^(?:codex://threads/)?('+uuid+')(?:[?#].*)?$','i'));
 return match?match[1].toLowerCase():null;
}
async function records(source){
 const collection=source.collection;
 const resource=ctx.makeResource('MultiRecordResource');resource.setResourceName(collection);
 resource.setPageSize(200);resource.setAppends(source.appends||[]);
 let rows=[];let page=1;
 do{resource.setPage(page);await resource.refresh();rows.push(...resource.getData());page++;}
 while(page<=resource.getTotalPage());
 return rows.map(r=>({key:collection+':'+fieldValue(r,source.idField),id:fieldValue(r,source.idField),collection,label:source.label,linkField:source.linkField,title:fieldValue(r,source.titleField)||String(fieldValue(r,source.idField)),sector:fieldValue(r,source.sectorPath)||'Sem setor',link:fieldValue(r,source.linkField)||'',business:fieldValue(r,source.statusField)||'',chat:chatId(fieldValue(r,source.linkField))}));
}
function Monitor(){
 const {token}=theme.useToken();
 const columnBackgrounds={processando:token.colorInfoBg,aguardando_aprovacao:token.colorWarningBg,aguardando_resposta:token.colorWarningBg,respondido:token.colorSuccessBg,interrompido:token.colorErrorBg,sem_sinal:token.colorFillAlter,nao_confirmado:token.colorFillAlter,stand_by:token.colorFillAlter};
 const [bindings,setBindings]=React.useState([]),[states,setStates]=React.useState({}),[online,setOnline]=React.useState(false);
 const [error,setError]=React.useState(''),[filter,setFilter]=React.useState('todos'),[selected,setSelected]=React.useState(),[link,setLink]=React.useState(''),[busy,setBusy]=React.useState(false);
 const [editingKey, setEditingKey] = React.useState(null);
 const [editingLink, setEditingLink] = React.useState('');
 const [updatingLink, setUpdatingLink] = React.useState(false);
 const [view,setView]=React.useState('ativos'),[movingChat,setMovingChat]=React.useState(null);
 const [recheckingChat,setRecheckingChat]=React.useState(null);
 const bindingsRef=React.useRef([]);
 const mounted=React.useRef(true);
 const [reconnecting,setReconnecting]=React.useState(false),[reconnectError,setReconnectError]=React.useState('');
 const reconnectTimer=React.useRef(null);
 const [disconnecting,setDisconnecting]=React.useState(false);
 const paused=React.useRef(false),connectionEpoch=React.useRef(0),collectorInstance=React.useRef('');
 async function local(path,options={}){
  const response=await window.fetch(endpoint+path,{...options,signal:window.AbortSignal.timeout(3500)});
  if(!response.ok)throw new Error('Coletor local indisponível');return response.json();
 }
 async function poll(){
  if(paused.current)return;
  const epoch=connectionEpoch.current;
  if(MONITOR_CONFIG.demo){if(mounted.current){setStates(DEMO_STATES);setOnline(true);}return;}
  try{const data=await local('/states');if(data.service!=='codex-monitor')throw new Error('Coletor não reconhecido');if(mounted.current&&!paused.current&&epoch===connectionEpoch.current){collectorInstance.current=data.instanceId||'';setStates(data.states||{});setOnline(true);}}
  catch{if(mounted.current&&!paused.current&&epoch===connectionEpoch.current){
   setOnline(false);
   const result=typeof document==='undefined'?null:document.querySelector('[data-codex-monitor-control="connect"]')?.getAttribute('data-codex-monitor-result');
   if(result==='BRIDGE_UNAVAILABLE'||result==='START_FAILED'){
    window.clearTimeout(reconnectTimer.current);setReconnecting(false);
    setReconnectError(result==='START_FAILED'?'O script local falhou ao iniciar. Confira Diagnosticar-Monitor.cmd nesta pasta.':'A extensão não conseguiu acessar o script local. Execute scripts/Instalar-Ponte-Navegadores.ps1 nesta pasta e recarregue a extensão.');
   }
  }}
 }
 async function reload(){
  if(MONITOR_CONFIG.demo){bindingsRef.current=DEMO_CARDS;if(mounted.current){setBindings(DEMO_CARDS);setError('');}await poll();return;}
  try{
   const groups=await Promise.all(MONITOR_CONFIG.sources.map(records));
   const rows=groups.flat();bindingsRef.current=rows;if(mounted.current){setBindings(rows);setError('');}
   try{await local('/linked',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[...new Set(rows.filter(r=>r.chat).map(r=>r.chat))]})});}
   catch{if(mounted.current)setOnline(false);}
   await poll();
  }catch{if(mounted.current)setError('Não foi possível carregar os vínculos. Atualize a página ou confira seu acesso aos projetos e tarefas.');}
 }
 async function refresh(){
  if(disconnecting||reconnecting)return;
  // Resume observation after a manual start; never launch a local process here.
  paused.current=false;connectionEpoch.current++;
  await reload();
 }
 React.useEffect(()=>{
  mounted.current=true;let inFlight=false;
  reload();
  const timer=window.setInterval(async()=>{if(inFlight)return;inFlight=true;try{await poll();}finally{inFlight=false;}},MONITOR_CONFIG.pollMs);
  const linksTimer=window.setInterval(()=>reload(),MONITOR_CONFIG.linksPollMs);
  return()=>{mounted.current=false;window.clearInterval(timer);window.clearInterval(linksTimer);window.clearTimeout(reconnectTimer.current);};
 },[]);
 React.useEffect(()=>{
  if(!online)return;
  setReconnectError('');
  if(reconnecting){window.clearTimeout(reconnectTimer.current);setReconnecting(false);reload();ctx.message.success('Monitor reconectado.');}
 },[online,reconnecting]);
 function reconnect(event){
  if(MONITOR_CONFIG.demo)return;
  if(reconnecting)return;
  if(event?.currentTarget?.getAttribute('data-codex-monitor-bridge')!=='ready'){
   setReconnectError('Sem extensão: abra Iniciar-Monitor.cmd na pasta do monitor e clique em Atualizar. Para iniciar pelo botão, instale a ponte e ative a extensão conforme docs/NAVEGADORES.md.');return;
  }
  // The installed content script handles the trusted click before React.
  // No URI, window.open, shell command or permanent controller is used.
  window.setTimeout(()=>{
   if(!mounted.current)return;
   paused.current=false;connectionEpoch.current++;
   setReconnectError('');setReconnecting(true);
   window.clearTimeout(reconnectTimer.current);
   reconnectTimer.current=window.setTimeout(()=>{
    if(mounted.current){setReconnecting(false);setReconnectError('O script local não confirmou a conexão. Confira se scripts/Instalar-Ponte-Navegadores.ps1 foi executado nesta instalação e se a extensão está ativa. Diagnosticar-Monitor.cmd informa a última tentativa.');}
   },45000);
  },0);
 }
 async function disconnect(){
  if(MONITOR_CONFIG.demo)return;
  if(disconnecting||!collectorInstance.current)return;
  setDisconnecting(true);paused.current=true;connectionEpoch.current++;
  window.clearTimeout(reconnectTimer.current);setReconnecting(false);
  try{
   const result=await local('/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceId:collectorInstance.current})});
   if(result.ok!==true)throw new Error('Encerramento não confirmado');
   const deadline=Date.now()+8000;let ended=false;
   while(Date.now()<deadline){
    await new Promise(resolve=>window.setTimeout(resolve,250));
    try{await local('/states');}catch{ended=true;break;}
   }
   if(!ended)throw new Error('O coletor ainda responde');
   if(mounted.current){collectorInstance.current='';setOnline(false);setReconnectError('');ctx.message.success('Monitor desconectado. O coletor foi encerrado; vínculos e Stand-by foram preservados.');}
  }catch{
   paused.current=false;connectionEpoch.current++;
   if(mounted.current){setReconnectError('Não foi possível confirmar o encerramento do coletor. Tente desconectar novamente.');await poll();ctx.message.error('Encerramento não confirmado.');}
  }finally{if(mounted.current)setDisconnecting(false);}
 }
 async function bind(){
  if(MONITOR_CONFIG.demo){ctx.message.info('A demonstração não grava vínculos.');return;}
  const id=chatId(link),row=bindingsRef.current.find(r=>r.key===selected);
  if(!id||!row){ctx.message.warning('Escolha uma tarefa ou projeto e informe o link local ou ID do chat.');return;}
  setBusy(true);
  try{const resource=ctx.makeResource('MultiRecordResource');resource.setResourceName(row.collection);
   await resource.update(row.id,{[row.linkField]:'codex://threads/'+id},{refresh:false});setLink('');setSelected(undefined);await reload();ctx.message.success('Chat vinculado.');
  }catch{ctx.message.error('Não foi possível salvar o vínculo. Confira sua permissão de edição.');}
  finally{setBusy(false);}
 }
 function editLink(binding) {
  if (updatingLink) return;
  setEditingKey(binding.key);
  setEditingLink(binding.link);
 }
 async function updateLink() {
  if(MONITOR_CONFIG.demo){ctx.message.info('A demonstração não grava vínculos.');return;}
  if (updatingLink) return;
  const binding = bindingsRef.current.find(item => item.key === editingKey);
  const enteredLink = editingLink.trim();
  const id = enteredLink ? chatId(enteredLink) : null;
  if (!binding) {
   ctx.message.warning('O cadastro não está mais disponível. Atualize o painel.');
   return;
  }
  if (enteredLink && !id) {
   ctx.message.warning('Informe um link codex://threads/ID ou o ID do chat. Para remover o vínculo, deixe o campo vazio.');
   return;
  }
  setUpdatingLink(true);
  try {
   const resource = ctx.makeResource('MultiRecordResource');
   resource.setResourceName(binding.collection);
   await resource.update(binding.id, { [binding.linkField]: id ? 'codex://threads/' + id : '' }, { refresh: false });
   setEditingKey(null);
   setEditingLink('');
   await reload();
   ctx.message.success(id ? 'Link atualizado. O monitor acompanha o chat informado.' : 'Link removido. Este cadastro deixou de acompanhar o chat.');
  } catch {
   ctx.message.error('Não foi possível atualizar o link. Confira sua permissão de edição.');
  } finally {
   setUpdatingLink(false);
  }
 }
 async function moveStandby(chat,enabled){
  if(MONITOR_CONFIG.demo)return;
  if(movingChat)return;
  setMovingChat(chat);
  try{
   await local('/standby',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:chat,enabled})});
   await poll();
   if(!enabled){setView('ativos');setFilter('todos');}
   ctx.message.success(enabled?'Chat guardado em Stand-by.':'Chat voltou ao acompanhamento.');
  }catch{ctx.message.error('Não foi possível mover o chat. Ele pode ter retomado a execução; confira a conexão e tente novamente.');}
  finally{if(mounted.current)setMovingChat(null);}
 }
 async function recheck(chat){
  if(MONITOR_CONFIG.demo)return;
  if(!online||disconnecting||recheckingChat||!collectorInstance.current)return;
  const epoch=connectionEpoch.current;setRecheckingChat(chat);
  try{
   await local('/recheck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:chat,instanceId:collectorInstance.current})});
   if(mounted.current&&!paused.current&&epoch===connectionEpoch.current){await poll();ctx.message.success('Nova verificação solicitada. O acompanhamento continua automático.');}
  }catch{if(mounted.current&&epoch===connectionEpoch.current)ctx.message.error('Não foi possível solicitar a verificação. Confira a conexão do coletor.');}
  finally{if(mounted.current)setRecheckingChat(null);}
 }
 const grouped=new Map();
 for(const row of bindings.filter(r=>r.chat)){if(!grouped.has(row.chat))grouped.set(row.chat,{chat:row.chat,bindings:[]});grouped.get(row.chat).bindings.push(row);}
 const chats=[...grouped.values()].map(row=>({...row,state:states[row.chat],status:states[row.chat]?.standby?'stand_by':online?(states[row.chat]?.displayStatus||states[row.chat]?.status||'sem_sinal'):'nao_confirmado'}));
 const order={aguardando_aprovacao:0,aguardando_resposta:1,processando:2,interrompido:3,respondido:4,sem_sinal:5};
 chats.sort((a,b)=>(order[a.status]??5)-(order[b.status]??5));
 const unconfirmed=chats.filter(row=>row.status==='nao_confirmado');
 const invalidBindings=bindings.filter(r=>r.link&&!r.chat);
 return <Space direction="vertical" size="large" style={{width:'100%'}}>
  <Space wrap><Typography.Title level={3} style={{margin:0}}>Monitor Codex</Typography.Title><Tag color={online?'green':'default'}>{MONITOR_CONFIG.demo?'Demonstração · dados fictícios':online?'Coletor conectado':'Coletor desconectado'}</Tag>{!online&&<Button type="primary" data-codex-monitor-control="connect" data-codex-monitor-demo={String(MONITOR_CONFIG.demo)} aria-busy={reconnecting} disabled={MONITOR_CONFIG.demo||disconnecting} onClick={reconnect}>{reconnecting?'Conectando…':'Conectar monitor'}</Button>}{online&&<Button loading={disconnecting} disabled={MONITOR_CONFIG.demo||Boolean(movingChat)} onClick={disconnect}>{disconnecting?'Desconectando…':'Desconectar monitor'}</Button>}<Button disabled={disconnecting||reconnecting} onClick={refresh}>Atualizar</Button></Space>
  {error&&<Alert type="error" showIcon message={error}/>}
  {!online&&<Alert type="warning" showIcon message={reconnecting?'Conectando monitor…':'Coletor local desconectado'} description={reconnectError||'Com extensão, clique em Conectar monitor. Sem extensão, abra Iniciar-Monitor.cmd e clique em Atualizar. Após conectar, os estados atualizam automaticamente.'}/>}
  {online&&unconfirmed.length>0&&<Alert type="warning" showIcon message={unconfirmed.length+' chat(s) com estado não confirmado'} description="O monitor continua tentando automaticamente. Os cartões preservam o último estado observado e voltarão à coluna correta quando houver confirmação."/>}
  <Row gutter={[16,16]}>{['processando','aguardando_aprovacao','aguardando_resposta','respondido'].map(status=><Col xs={24} sm={12} xl={6} key={status}><Card><Statistic title={statusNames[status]} value={chats.filter(r=>r.status===status).length}/></Card></Col>)}</Row>
  <Card title="Vincular um chat">
   <Space wrap><Select showSearch optionFilterProp="label" placeholder="Escolha uma tarefa ou projeto" value={selected} onChange={setSelected} style={{minWidth:300}} options={bindings.map(r=>({value:r.key,label:(r.label+': ')+r.title+' · '+r.sector}))}/><Input placeholder="codex://threads/… ou ID do chat" value={link} onChange={e=>setLink(e.target.value)} style={{width:340}}/><Button type="primary" disabled={MONITOR_CONFIG.demo} loading={busy} onClick={bind}>Vincular</Button></Space>
   <Typography.Paragraph type="secondary" style={{marginTop:12,marginBottom:0}}>Cada tarefa ou projeto acompanha um chat. Vincular outro chat substitui o vínculo anterior.</Typography.Paragraph>
  </Card>
  {invalidBindings.length>0&&<Alert type="warning" showIcon message={invalidBindings.length+' vínculo(s) com link não reconhecido'} description={
   <Space direction="vertical" size={12} style={{width:'100%'}}>
    <Typography.Text>Use o ID do chat ou um link codex://threads/ID. Links de compartilhamento não identificam um chat local para este monitor.</Typography.Text>
    {invalidBindings.map(binding=><Space direction="vertical" size={4} key={binding.key} style={{width:'100%'}}>
     <Typography.Text strong>{binding.label+': '+binding.title+' · '+binding.sector}</Typography.Text>
     <Typography.Text style={{overflowWrap:'anywhere'}}>Link cadastrado: {binding.link}</Typography.Text>
     {editingKey===binding.key?<Space direction="vertical" size={6} style={{width:'100%'}}>
      <Input aria-label={'Link do chat de '+binding.title} value={editingLink} onChange={event=>setEditingLink(event.target.value)} placeholder="codex://threads/… ou ID do chat" disabled={updatingLink} onPressEnter={updateLink}/>
      <Typography.Text type="secondary">Troque o link para acompanhar outro chat. Deixe vazio para remover o vínculo.</Typography.Text>
      <Space>
       <Button size="small" type="primary" loading={updatingLink} onClick={updateLink}>Salvar link</Button>
       <Button size="small" disabled={updatingLink} onClick={()=>setEditingKey(null)}>Cancelar</Button>
      </Space>
     </Space>:<Button type="link" size="small" style={{padding:0}} disabled={MONITOR_CONFIG.demo||updatingLink} onClick={()=>editLink(binding)}>Atualizar link</Button>}
    </Space>)}
   </Space>
  }/>}
  {view==='ativos'&&<Space><Typography.Text>Mostrar:</Typography.Text><Select value={filter} onChange={setFilter} style={{minWidth:210}} options={[{value:'todos',label:'Todos os vinculados'},...Object.entries(statusNames).filter(([value])=>value!=='stand_by').map(([value,label])=>({value,label}))]}/></Space>}
  <Tabs activeKey={view} onChange={key=>{setView(key);setFilter('todos');}} items={[{key:'ativos',label:'Em acompanhamento'},{key:'stand_by',label:<Space>Stand-by<Tag>{chats.filter(row=>row.status==='stand_by').length}</Tag></Space>}]}/>
  <Row wrap={false} gutter={12} style={{overflowX:'auto',paddingBottom:12}} aria-label="Kanban de chats do Codex">
   {(view==='stand_by'?['stand_by']:boardStatuses.filter(status=>filter==='todos'||status===filter)).map(status=>{
    const cards=chats.filter(row=>row.status===status);
    return <Col flex="0 0 260px" key={status}>
     <Card size="small" title={<Space><Typography.Text strong>{statusNames[status]}</Typography.Text><Tag color={colors[status]}>{cards.length}</Tag></Space>}
      style={{minHeight:360,height:'100%',background:columnBackgrounds[status],color:token.colorText,borderColor:token.colorBorderSecondary,borderTop:'3px solid '+columnColors[status]}}>
      <List split={false} dataSource={cards} locale={{emptyText:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum chat"/>}}
       renderItem={row=><List.Item key={row.chat} style={{padding:'0 0 12px',display:'block'}}>
        <Card size="small" style={{background:token.colorBgContainer}}>
         <Space direction="vertical" size={8} style={{width:'100%'}}>
          <Typography.Text strong style={{overflowWrap:'anywhere'}}>{row.bindings.map(b=>b.title).join(' / ')}</Typography.Text>
          {row.bindings.map(binding => (
           <Space direction="vertical" size={4} key={binding.key} style={{width:'100%'}}>
            <Typography.Text type="secondary">
             {binding.label+' · '+binding.sector}
             {row.bindings.length > 1 ? ' · ' + binding.title : ''}
            </Typography.Text>
            {editingKey === binding.key ? (
             <Space direction="vertical" size={6} style={{width:'100%'}}>
              <Input
               aria-label={'Link do chat de ' + binding.title}
               value={editingLink}
               onChange={event => setEditingLink(event.target.value)}
               placeholder="codex://threads/… ou ID do chat"
               disabled={updatingLink}
               onPressEnter={updateLink}
              />
              <Typography.Text type="secondary" style={{fontSize:12}}>
               Troque o link para acompanhar outro chat. Deixe vazio para remover o vínculo.
              </Typography.Text>
              <Space>
               <Button size="small" type="primary" loading={updatingLink} onClick={updateLink}>Salvar link</Button>
               <Button size="small" disabled={updatingLink} onClick={() => setEditingKey(null)}>Cancelar</Button>
              </Space>
             </Space>
            ) : (
             <Button type="link" size="small" style={{padding:0}} disabled={updatingLink||MONITOR_CONFIG.demo} onClick={() => editLink(binding)}>
              Atualizar link
             </Button>
            )}
           </Space>
          ))}
          {(row.status==='stand_by'||(!row.state?.questionPending&&!row.state?.approvalPending&&['respondido','interrompido','sem_sinal'].includes(row.status)))&&<Button size="small" disabled={!online||MONITOR_CONFIG.demo||Boolean(movingChat)} loading={movingChat===row.chat} onClick={()=>moveStandby(row.chat,row.status!=='stand_by')}>
           {row.status==='stand_by'?'Retomar acompanhamento':'Colocar em Stand-by'}
          </Button>}
          <Typography.Text type="secondary" style={{fontSize:12}}>
           {row.state?.at?'Último sinal: '+new Date(row.state.at).toLocaleString('pt-BR'):'Aguardando o primeiro evento deste chat'}
          </Typography.Text>
          {(row.status==='nao_confirmado'||row.state?.verification?.confirmed===false)&&<Space direction="vertical" size={6}>
           <Typography.Text type="secondary" style={{fontSize:12}}>{'Último estado observado: '+(statusNames[row.state?.status]||'Sem sinal')}</Typography.Text>
           <Typography.Text type="secondary" style={{fontSize:12}}>Conferindo automaticamente.</Typography.Text>
           <Button size="small" disabled={!online||disconnecting||Boolean(recheckingChat)||MONITOR_CONFIG.demo} loading={recheckingChat===row.chat} onClick={()=>recheck(row.chat)}>Tentar novamente</Button>
          </Space>}
          <Typography.Link disabled={MONITOR_CONFIG.demo} href={MONITOR_CONFIG.demo?undefined:'codex://threads/'+row.chat}>Abrir chat</Typography.Link>
         </Space>
        </Card>
       </List.Item>}/>
     </Card>
    </Col>;
   })}
  </Row>
  <Typography.Paragraph type="secondary">Respondido indica que o chat terminou uma resposta. A situação da tarefa continua independente. Perguntas feitas apenas em texto livre podem aparecer como Respondido.</Typography.Paragraph>
 </Space>;
}
ctx.render(<Monitor/>);
