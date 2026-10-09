// RunJS / JSBlockModel: account usage page, separate from the chat Kanban.
const React=ctx.libs.React;
const {Alert,Button,Card,Col,Collapse,Empty,Progress,Row,Select,Space,Statistic,Table,Tag,Typography,theme}=ctx.libs.antd;
// Starts with fictitious data; configure only your local copy for real use.
const USAGE_CONFIG={demo:true,endpoint:'http://127.0.0.1:13011',sources:[{collection:'projetos',label:'Projeto',titleField:'nome',linkField:'linkCodex'},{collection:'demandas',label:'Tarefa',titleField:'titulo',linkField:'linkCodex'}]};
const endpoint=USAGE_CONFIG.endpoint;

function UsageOverview({online,demo=false,refreshKey=0,bindingNames,loadNames}){
 const {token}=theme.useToken();
 const [data,setData]=React.useState(null),[busy,setBusy]=React.useState(false),[failed,setFailed]=React.useState(false);
 const [retry,setRetry]=React.useState(0),[clock,setClock]=React.useState(Date.now());
 React.useEffect(()=>{
  let active=true,inFlight=false;const controller=new window.AbortController();
  if(!online&&!demo){setBusy(false);setFailed(true);}
  async function refresh(){
   if(inFlight||(!online&&!demo))return;inFlight=true;setBusy(true);
   try{
    let value;
    if(demo)value={service:'codex-monitor',confirmed:true,at:Date.now(),scope:'account',availableResets:2,resetDetails:[{type:'full',expiresAt:Math.floor(Date.now()/1000)+20*86400},{type:'full',expiresAt:Math.floor(Date.now()/1000)+28*86400}],limits:[{label:'Codex',plan:'Demonstração',windows:[{key:'primary',usedPercent:38,remainingPercent:62,windowDurationMins:10080,resetsAt:Math.floor(Date.now()/1000)+2*86400+23*3600}]}]};
    else{
     const response=await window.fetch(endpoint+'/usage',{signal:window.AbortSignal.any([controller.signal,window.AbortSignal.timeout(7000)])});
     if(!response.ok)throw new Error('unavailable');value=await response.json();
     if(value.service!=='codex-monitor'||value.scope!=='account'||!Array.isArray(value.limits))throw new Error('schema');
    }
    if(active){setData(value);setFailed(!value.confirmed);}
   }catch{if(active)setFailed(true);}finally{inFlight=false;if(active)setBusy(false);}
  }
  refresh();const timer=window.setInterval(refresh,60000),tick=window.setInterval(()=>{if(active)setClock(Date.now());},30000);
  return()=>{active=false;controller.abort();window.clearInterval(timer);window.clearInterval(tick);};
 },[online,demo,refreshKey,retry]);
 function duration(minutes){if(minutes===10080)return 'Semanal';if(minutes===300)return '5 horas';if(minutes%1440===0)return (minutes/1440)+' dias';if(minutes%60===0)return (minutes/60)+' horas';return minutes+' minutos';}
 function countdown(seconds){const remaining=Math.max(0,Math.ceil(seconds-clock/1000)),days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60);return remaining===0?'Renovação pendente de confirmação':days?days+'d '+hours+'h':hours?hours+'h '+minutes+'min':minutes+'min';}
 const confirmed=(online||demo)&&data?.confirmed===true&&!failed&&clock-(data.at||0)<120000;
 const resetCount=Number.isSafeInteger(data?.availableResets)&&data.availableResets>=0?data.availableResets:null;
 const resetRows=Array.isArray(data?.resetDetails)?data.resetDetails:[];
 const resetList=<Space direction="vertical" size={0} style={{width:'100%'}}>
  {resetRows.length?resetRows.map((reset,index)=><div key={index} style={{padding:'12px 0',borderTop:index?'1px solid '+token.colorBorderSecondary:undefined}}>
   <Typography.Text>Redefinição completa</Typography.Text><br/>
   <Typography.Text type="secondary">{Number.isSafeInteger(reset.expiresAt)&&reset.expiresAt>0?'Expira em '+new Date(reset.expiresAt*1000).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}):'Validade não informada'}</Typography.Text>
  </div>):<Typography.Text type="secondary">{resetCount===0?'Nenhuma redefinição disponível':resetCount===null?'Disponibilidade não informada':'As datas de validade não foram informadas pelo Codex.'}</Typography.Text>}
  {resetCount!==null&&resetCount>resetRows.length&&resetRows.length>0&&<Typography.Text type="secondary">{'Validade disponível para '+resetRows.length+' de '+resetCount+' redefinições.'}</Typography.Text>}
 </Space>;
 const resetBox=<Card size="small" title={<Space wrap>Redefinições disponíveis <Tag>{resetCount??'Não informado'}</Tag></Space>}>{resetList}</Card>;
 const windows=(data?.limits||[]).flatMap(limit=>limit.windows.map(window=>({...window,label:limit.label,plan:limit.plan})));
 return <Space direction="vertical" size="large" style={{width:'100%'}}>
  <Space wrap style={{justifyContent:'space-between',width:'100%'}}>
   <div><Typography.Title level={4} style={{margin:0}}>Uso do Codex</Typography.Title><Typography.Text type="secondary">Consumo da conta conectada, renovação e redefinições disponíveis.</Typography.Text></div>
   <Space><Tag color={demo?'blue':confirmed?'green':'default'}>{demo?'Dados fictícios':confirmed?'Leitura confirmada':'Leitura não confirmada'}</Tag><Button loading={busy} disabled={!online&&!demo} onClick={()=>setRetry(value=>value+1)}>Atualizar uso</Button></Space>
  </Space>
  {!demo&&!confirmed&&<Alert type="warning" showIcon message="Uso não confirmado" description={windows.length?'Os números abaixo são da última leitura. A consulta continua automaticamente enquanto esta aba estiver aberta.':'Conecte o monitor e use um chat vinculado no Codex para disponibilizar a leitura. Dados ausentes não representam consumo zero.'}/>}
  {windows.length?<Row gutter={[16,16]}>{windows.map((window,index)=>{
   const elapsed=Math.max(0,Math.min(100,(1-(window.resetsAt-clock/1000)/(window.windowDurationMins*60))*100));
   return <Col xs={24} xl={windows.length===1?24:12} key={window.label+window.key+index}><Card style={{borderTop:'3px solid '+token.colorPrimary}}>
    <Space direction="vertical" size={16} style={{width:'100%'}}>
     <Space wrap><Typography.Text strong>{window.label==='codex'?'Codex':window.label}</Typography.Text>{window.plan&&<Tag>{({pro:'Pro',plus:'Plus',free:'Gratuito',team:'Team',business:'Business',enterprise:'Enterprise'})[window.plan]||window.plan}</Tag>}<Tag>{duration(window.windowDurationMins)}</Tag></Space>
     <Row gutter={[16,16]}><Col xs={24} sm={12}><Statistic title="Consumido" value={window.usedPercent} precision={window.usedPercent%1?1:0} suffix="%"/></Col><Col xs={24} sm={12}><Statistic title="Disponível" value={window.remainingPercent} precision={window.remainingPercent%1?1:0} suffix="%"/></Col></Row>
     <div><Typography.Text>Disponibilidade da cota</Typography.Text><Progress percent={Math.round(window.remainingPercent*10)/10} strokeColor={token.colorPrimary} status="normal"/></div>
     <Row gutter={[24,16]} style={{width:'100%'}}><Col xs={24} lg={index===0?12:24}><Space direction="vertical" size={16} style={{width:'100%'}}>
     <div><Typography.Text strong>{'Próxima renovação: '+countdown(window.resetsAt)}</Typography.Text><br/><Typography.Text type="secondary">{new Date(window.resetsAt*1000).toLocaleString('pt-BR')}</Typography.Text></div>
     <div><Typography.Text type="secondary">{Math.round(100-elapsed)+'% do tempo restante neste período'}</Typography.Text><Progress percent={Math.round(100-elapsed)} showInfo={false} strokeColor={token.colorSuccess} status="normal"/></div>
     </Space></Col>{index===0&&<Col xs={24} lg={12}>{resetBox}</Col>}</Row>
    </Space>
   </Card></Col>;
  })}</Row>:<Card><Empty description={busy?'Consultando o uso da conta…':'Ainda não há leitura de uso disponível'}/></Card>}
  {!windows.length&&resetBox}
  <TokenAnalytics demo={demo} refreshKey={retry+refreshKey} bindingNames={bindingNames} loadNames={loadNames}/>
  <Card size="small"><Space direction="vertical" size={8}>
   <Typography.Text type="secondary">A cota é compartilhada pela conta inteira, incluindo chats que não estão vinculados ao painel. Ela não mede o consumo individual de cada tarefa.</Typography.Text>
   <Typography.Text type="secondary">Atualização automática a cada minuto enquanto esta página estiver aberta.</Typography.Text>
   {data?.at&&<Typography.Text type="secondary">{'Última leitura: '+new Date(data.at).toLocaleString('pt-BR')}</Typography.Text>}
  </Space></Card>
 </Space>;
}

function TokenAnalytics({demo,refreshKey,bindingNames,loadNames}){
 const {token}=theme.useToken();
 const [data,setData]=React.useState(null),[labels,setLabels]=React.useState(bindingNames.labels),[labelsFailed,setLabelsFailed]=React.useState(bindingNames.failed),[failed,setFailed]=React.useState(false),[busy,setBusy]=React.useState(false);
 const [range,setRange]=React.useState(30),[selected,setSelected]=React.useState(null);
 const accent=[token.colorPrimary,'#39c5a4','#a78bfa','#e5ad53','#ef768d',token.colorTextSecondary];
 const number=value=>Number.isSafeInteger(value)?value.toLocaleString('pt-BR'):'Não informado';
 const compact=value=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:2}).format(value);
 const dateLabel=value=>new Date(value+'T12:00:00Z').toLocaleDateString('pt-BR');
 React.useEffect(()=>{
  let active=true,inFlight=false;const controller=new window.AbortController();
  async function refresh(){
   if(inFlight)return;inFlight=true;setBusy(true);
   try{
    let value;
    if(demo){const today=new Date().toISOString().slice(0,10);value={service:'codex-monitor',scope:'tokens',at:Date.now(),account:{confirmed:true,at:Date.now(),lifetimeTokens:9321450,daily:Array.from({length:30},(_,i)=>({date:new Date(Date.parse(today+'T00:00:00Z')-(29-i)*86400000).toISOString().slice(0,10),tokens:Math.round(90000+(i%7)*21000+(i%3)*36000)}))},threads:{confirmed:true,at:Date.now(),rows:[510000,370000,210000].map((totalTokens,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),totalTokens,confirmed:true,updatedAt:Math.floor(Date.now()/1000)}))}};}
    else{const response=await window.fetch(endpoint+'/tokens',{signal:window.AbortSignal.any([controller.signal,window.AbortSignal.timeout(22000)])});if(!response.ok)throw new Error('unavailable');value=await response.json();if(value.service!=='codex-monitor'||value.scope!=='tokens'||!Array.isArray(value.account?.daily)||!Array.isArray(value.threads?.rows))throw new Error('schema');}
    if(active){setData(value);setFailed(false);}
   }catch{if(active)setFailed(true);}finally{inFlight=false;if(active)setBusy(false);}
  }
  let namesInFlight=false;
  async function names(){
   if(namesInFlight)return;namesInFlight=true;
   try{const result=await loadNames();if(active){setLabels(result);setLabelsFailed(false);}}
   catch{if(active)setLabelsFailed(true);}finally{namesInFlight=false;}
  }
  refresh();const timer=window.setInterval(refresh,60000),namesTimer=window.setInterval(names,60000);
  return()=>{active=false;controller.abort();window.clearInterval(timer);window.clearInterval(namesTimer);};
 },[demo,refreshKey]);
 const daily=(data?.account?.daily||[]).slice(-range);
 const sum=rows=>{const n=rows.reduce((total,row)=>total+row.tokens,0);return Number.isSafeInteger(n)?n:null;};
 const period=sum(daily),maximum=Math.max(1,...daily.map(row=>row.tokens));
 const peak=daily.length?daily.reduce((best,row)=>row.tokens>best.tokens?row:best):null;
 const rows=(data?.threads?.rows||[]).map((row,i)=>({...row,key:row.id,title:[...new Set(labels[row.id]||[])].join(' · ')||'Chat vinculado '+(i+1)}));
 const known=rows.filter(row=>row.confirmed&&Number.isSafeInteger(row.totalTokens));
 const linkedTotal=known.reduce((total,row)=>total+row.totalTokens,0),safeLinked=Number.isSafeInteger(linkedTotal);
 const ranked=[...known].sort((a,b)=>b.totalTokens-a.totalTokens),parts=ranked.slice(0,5).map(row=>({title:row.title,value:row.totalTokens}));
 if(ranked.length>5)parts.push({title:'Outros chats',value:ranked.slice(5).reduce((total,row)=>total+row.totalTokens,0)});
 let position=0;const segments=parts.map((part,i)=>{const length=linkedTotal?part.value/linkedTotal*100:0,offset=position;position+=length;return {...part,color:accent[i],length,offset};});
 const current=daily.find(row=>row.date===selected)||peak;
 function csvLink(headers,values){
  const escape=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const text='\uFEFF'+[headers,...values].map(row=>row.map(escape).join(';')).join('\r\n');
  return 'data:text/csv;charset=utf-8,'+encodeURIComponent(text);
 }
 const cardStyle={height:'100%',background:token.colorFillAlter};
 return <Space direction="vertical" size={20} style={{width:'100%'}}>
  <Space wrap style={{justifyContent:'space-between',width:'100%'}}><div><Typography.Title level={4} style={{margin:0}}>Tokens em perspectiva</Typography.Title><Typography.Text type="secondary">Histórico da conta e consumo acumulado dos chats vinculados.</Typography.Text></div><Space wrap><Tag color={demo?'blue':!failed&&data?.account?.confirmed?'green':'default'}>{demo?'Demonstração':busy?'Consultando tokens…':!failed&&data?.account?.confirmed?'Conta confirmada':'Conta não confirmada'}</Tag><Select aria-label="Período do histórico da conta" value={range} onChange={setRange} options={[{value:7,label:'7 dias informados'},{value:30,label:'30 dias informados'},{value:90,label:'90 dias informados'}]}/></Space></Space>
  {(failed||data&&(!data.account?.confirmed||!data.threads?.confirmed))&&<Alert showIcon type="warning" message="Leitura de tokens não confirmada" description="As fontes são independentes. Valores anteriores são preservados e não representam uma nova leitura. A consulta é repetida automaticamente; dados ausentes não significam zero."/>}
  <Row gutter={[14,14]}>
   {[{title:'Acumulado da conta',value:data?.account?.lifetimeTokens,color:accent[0],detail:'Total informado pelo Codex'},{title:'Total no período',value:daily.length?period:null,color:accent[1],detail:daily.length?dateLabel(daily[0].date)+' → '+dateLabel(daily.at(-1).date):'Aguardando histórico'},{title:'Média por dia informado',value:daily.length&&period!==null?Math.round(period/daily.length):null,color:accent[2],detail:daily.length+' dias com dados'},{title:'Chats com leitura',value:data?known.length:null,color:accent[3],detail:rows.length+' chats vinculados · '+number(safeLinked?linkedTotal:null)+' tokens locais'}].map(item=><Col xs={24} sm={12} xl={6} key={item.title}><Card style={{...cardStyle,borderTop:'2px solid '+item.color}}><Statistic title={item.title} value={item.value??'—'} formatter={()=>item.value===null||item.value===undefined?'—':compact(item.value)} valueStyle={{color:item.color,fontWeight:650}}/><Typography.Text type="secondary" style={{fontSize:12}}>{item.detail}</Typography.Text></Card></Col>)}
  </Row>
  <Row gutter={[16,16]}>
   <Col xs={24} xl={16}><Card style={{height:'100%'}} title="Evolução diária da conta" extra={<Button size="small" disabled={!daily.length} download="tokens-conta.csv" href={csvLink(['Data','Tokens'],daily.map(row=>[row.date,row.tokens]))}>Exportar CSV</Button>}>
    {daily.length?<><Typography.Text type="secondary">Selecione uma barra para ver o valor exato.</Typography.Text><div style={{width:'100%',overflowX:'auto',marginTop:20}}><svg role="group" aria-label="Tokens da conta por dia informado" viewBox="0 0 820 245" style={{width:'100%',minWidth:daily.length>30?620:320,display:'block'}}>
     {[0,.25,.5,.75,1].map(step=><g key={step}><line x1="60" x2="806" y1={208-step*180} y2={208-step*180} stroke={token.colorBorderSecondary}/><text x="53" y={212-step*180} textAnchor="end" fill={token.colorTextSecondary} fontSize="11">{compact(Math.round(maximum*step))}</text></g>)}
     {daily.map((row,i)=>{const width=740/daily.length,x=63+i*width,height=row.tokens/maximum*180;return <g key={row.date} tabIndex={0} role="button" aria-label={dateLabel(row.date)+': '+number(row.tokens)+' tokens'} onClick={()=>setSelected(row.date)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row.date);}}} style={{cursor:'pointer'}}><title>{dateLabel(row.date)+' · '+number(row.tokens)+' tokens'}</title><rect x={x} y="22" width={Math.max(1,width-3)} height="186" fill="transparent"/><rect x={x} y={208-height} width={Math.max(1,width-3)} height={Math.max(1,height)} rx="2" fill={current?.date===row.date?accent[0]:accent[1]}/>{(i===0||i===daily.length-1||i%Math.ceil(daily.length/6)===0)&&<text x={x+width/2} y="233" textAnchor="middle" fill={token.colorTextSecondary} fontSize="10">{row.date.slice(8)+'/'+row.date.slice(5,7)}</text>}</g>;})}
    </svg></div><Space wrap style={{width:'100%',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid '+token.colorBorderSecondary}}><Typography.Text strong>{current?dateLabel(current.date):''}</Typography.Text><Typography.Text>{number(current?.tokens)} tokens</Typography.Text><Typography.Text type="secondary">{peak?'Pico do período: '+dateLabel(peak.date):''}</Typography.Text></Space></>:<Empty description={busy?'Consultando histórico…':'Histórico diário não disponível'}/>}
   </Card></Col>
   <Col xs={24} xl={8}><Card title="Participação dos chats vinculados" style={{height:'100%'}}>
    {safeLinked&&linkedTotal>0?<><div style={{maxWidth:230,margin:'0 auto'}}><svg viewBox="0 0 160 160" role="img" aria-label="Participação no acumulado local dos chats vinculados" style={{display:'block',width:'100%'}}><circle cx="80" cy="80" r="60" fill="none" stroke={token.colorFillSecondary} strokeWidth="15"/>{segments.map((part,i)=><circle key={i} cx="80" cy="80" r="60" pathLength="100" fill="none" stroke={part.color} strokeWidth="15" strokeDasharray={part.length+' '+(100-part.length)} strokeDashoffset={-part.offset} transform="rotate(-90 80 80)"><title>{part.title+' · '+number(part.value)+' tokens'}</title></circle>)}<text x="80" y="78" textAnchor="middle" fill={token.colorText} fontSize="19" fontWeight="700">{compact(linkedTotal)}</text><text x="80" y="96" textAnchor="middle" fill={token.colorTextSecondary} fontSize="9">acumulado local</text></svg></div><Space direction="vertical" style={{width:'100%'}}>{segments.map((part,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'baseline'}}><span style={{color:part.color}}>●</span><Typography.Text ellipsis={{tooltip:part.title}} style={{flex:1,minWidth:0}}>{part.title}</Typography.Text><Typography.Text>{(Math.round(part.length*10)/10).toLocaleString('pt-BR')}%</Typography.Text></div>)}</Space></>:<Empty description={rows.length?'Consumo local não disponível':'Nenhum chat vinculado'}/>}
    <Typography.Paragraph type="secondary" style={{margin:'18px 0 0',fontSize:12}}>Comparação entre os chats com leitura local. Não é uma divisão do total da conta nem da cota.</Typography.Paragraph>
   </Card></Col>
  </Row>
  <Card title="Consumo por chat vinculado" extra={<Button size="small" disabled={!rows.length} download="tokens-chats.csv" href={csvLink(['Chat','Tokens acumulados locais','Leitura confirmada'],rows.map(row=>[row.title,row.totalTokens,row.confirmed&&data?.threads?.confirmed&&!failed?'Sim':'Não']))}>Exportar CSV</Button>}>
   <Typography.Paragraph type="secondary">Acumulado local por chat, incluindo os que estão em Stand-by. O período do gráfico não filtra esta tabela.</Typography.Paragraph>
   {labelsFailed&&<Alert type="warning" showIcon message="Não foi possível atualizar os nomes dos vínculos. Os números continuam identificados por chat." style={{marginBottom:12}}/>}
   <Table size="small" scroll={{x:620}} pagination={{pageSize:10,showSizeChanger:false}} dataSource={rows} columns={[{title:'Chat / tarefa',dataIndex:'title',key:'title',render:(title,row)=><Typography.Link href={'codex://threads/'+row.id}>{title}</Typography.Link>},{title:'Tokens acumulados',dataIndex:'totalTokens',key:'tokens',defaultSortOrder:'descend',sorter:(a,b)=>(a.totalTokens??-1)-(b.totalTokens??-1),render:number},{title:'Leitura',key:'confirmed',render:(_,row)=><Tag color={!failed&&data?.threads?.confirmed&&row.confirmed?'green':'default'}>{!failed&&data?.threads?.confirmed&&row.confirmed?'Confirmada':'Não confirmada'}</Tag>}]} locale={{emptyText:busy?'Consultando…':'Nenhum consumo de chat disponível'}}/>
  </Card>
  <Collapse size="small" items={[{key:'source',label:'Fontes, períodos e atualização',children:<Space direction="vertical"><Typography.Text>Conta: consulta account/usage/read do Codex. O acumulado da conta e o histórico diário são medidas fornecidas separadamente; o histórico pode cobrir apenas parte do acumulado.</Typography.Text><Typography.Text>Chats: campo numérico tokens_used dos metadados locais, somente para IDs vinculados. Não são lidos prompts, respostas ou transcrições. Não há divisão confirmada entre entrada, saída e cache, nem estimativa de custo.</Typography.Text><Typography.Text>Dias ausentes não são tratados como zero. A média usa apenas os dias informados. As consultas são feitas a cada minuto enquanto esta página estiver aberta.</Typography.Text>{data?.account?.at&&<Typography.Text type="secondary">{'Última leitura confirmada da conta: '+new Date(data.account.at).toLocaleString('pt-BR')}</Typography.Text>}{data?.threads?.at&&<Typography.Text type="secondary">{'Última leitura local: '+new Date(data.threads.at).toLocaleString('pt-BR')}</Typography.Text>}</Space>}]} />
 </Space>;
}


// Resource construction and the first read belong to the RunJS host, before render.
const bindingResources=USAGE_CONFIG.demo?[]:(USAGE_CONFIG.sources||[]).map(source=>{
 const resource=ctx.makeResource('MultiRecordResource');resource.setResourceName(source.collection);resource.setPageSize(200);resource.setAppends([]);return {source,resource};
});
async function readTokenNames(){
 const result={};
 if(USAGE_CONFIG.demo){['Planejar campanha fictícia','Revisar materiais de exemplo','Organizar projeto fictício'].forEach((title,i)=>{result['00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')]=[title];});return result;}
 for(const {source,resource} of bindingResources){
  for(let page=1;page<=100;page++){resource.setPage(page);await resource.refresh();
   for(const record of resource.getData()){const match=String(record[source.linkField]||'').trim().match(/^(?:codex:\/\/threads\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i);if(match){const id=match[1].toLowerCase();(result[id]||=[]).push(String(record[source.titleField]||source.label||'Chat vinculado'));}}
   if(page>=resource.getTotalPage())break;if(page===100)throw new Error('page limit');
  }
 }
 return result;
}
const initialBindingNames=await readTokenNames().then(labels=>({labels,failed:false}),()=>({labels:{},failed:true}));

ctx.render(<UsageOverview online={true} demo={USAGE_CONFIG.demo} bindingNames={initialBindingNames} loadNames={readTokenNames}/>);
