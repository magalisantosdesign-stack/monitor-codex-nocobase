// RunJS / JSBlockModel: account usage page, separate from the chat Kanban.
const React=ctx.libs.React;
const {Alert,Button,Card,Col,Empty,Progress,Row,Space,Statistic,Tag,Typography,theme}=ctx.libs.antd;
// Starts with fictitious data; configure only your local copy for real use.
const USAGE_CONFIG={demo:true,endpoint:'http://127.0.0.1:13011'};
const endpoint=USAGE_CONFIG.endpoint;

function UsageOverview({online,demo=false,refreshKey=0}){
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
  <Card size="small"><Space direction="vertical" size={8}>
   <Typography.Text type="secondary">A cota é compartilhada pela conta inteira, incluindo chats que não estão vinculados ao painel. Ela não mede o consumo individual de cada tarefa.</Typography.Text>
   <Typography.Text type="secondary">Atualização automática a cada minuto enquanto esta página estiver aberta.</Typography.Text>
   {data?.at&&<Typography.Text type="secondary">{'Última leitura: '+new Date(data.at).toLocaleString('pt-BR')}</Typography.Text>}
  </Space></Card>
 </Space>;
}

ctx.render(<UsageOverview online={true} demo={USAGE_CONFIG.demo}/>);
