// RunJS / JSBlockModel. Business tasks are independent of Codex chat states.
const React=ctx.libs.React;
const {Alert,Button,Card,Col,Drawer,Empty,Input,Row,Select,Space,Tag,Typography,theme}=ctx.libs.antd;
const TASKS_CONFIG={demo:true,collection:'codex_monitor_tasks',idField:'id',titleField:'title',projectField:'project',linkField:'linkCodex',statusField:'status',pollMs:30000};
const TASK_STATUSES=[
 {value:'nao_iniciado',label:'Não iniciado',color:'#8c8c8c'},
 {value:'em_andamento',label:'Em andamento',color:'#1677ff'},
 {value:'aguardando',label:'Aguardando',color:'#d4a106'},
 {value:'pausado',label:'Pausado',color:'#fa8c16'},
 {value:'concluido',label:'Concluído',color:'#52c41a'},
];
const TASK_DEMO=TASK_STATUSES.map((status,i)=>({id:i+1,title:['Planejar campanha fictícia','Preparar apresentação de exemplo','Revisar proposta fictícia','Atualizar material de exemplo','Entregar resumo fictício'][i],project:'Projeto de demonstração',status:status.value,linkCodex:i%2?'codex://threads/00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'):''}));
// Resources are created in the RunJS host, never inside React effects.
const taskResource=TASKS_CONFIG.demo?null:ctx.makeResource('MultiRecordResource');
if(taskResource){taskResource.setResourceName(TASKS_CONFIG.collection);taskResource.setPageSize(200);taskResource.setAppends([]);}
function taskChatId(value){const match=String(value||'').trim().match(/^(?:codex:\/\/threads\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i);return match?match[1].toLowerCase():null;}
function taskStatus(row){return row[TASKS_CONFIG.statusField]||'nao_iniciado';}
function taskValues(draft){
 const title=String(draft.title||'').trim(),project=String(draft.project||'').trim(),link=String(draft.link||'').trim(),chat=link?taskChatId(link):null;
 if(!title||title.length>200)throw Error('Informe um nome de tarefa com até 200 caracteres.');
 if(project.length>120)throw Error('O projeto deve ter até 120 caracteres.');
 if(link&&!chat)throw Error('Informe um link codex://threads/ID ou o ID local do chat, ou deixe vazio para remover o vínculo.');
 if(!TASK_STATUSES.some(option=>option.value===draft.status))throw Error('Escolha uma situação válida para a tarefa.');
 return {[TASKS_CONFIG.titleField]:title,[TASKS_CONFIG.projectField]:project,[TASKS_CONFIG.linkField]:chat?'codex://threads/'+chat:'',[TASKS_CONFIG.statusField]:draft.status};
}
async function readTasks(){
 if(TASKS_CONFIG.demo)return TASK_DEMO;
 const rows=[];let page=1;
 do{taskResource.setPage(page);await taskResource.refresh();rows.push(...taskResource.getData());page++;}while(page<=taskResource.getTotalPage());
 return rows;
}
function Tasks(){
 const {token}=theme.useToken();
 const [rows,setRows]=React.useState(TASKS_CONFIG.demo?TASK_DEMO:[]),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [search,setSearch]=React.useState(''),[projectFilter,setProjectFilter]=React.useState('');
 const [opened,setOpened]=React.useState(false),[editing,setEditing]=React.useState(null),[draft,setDraft]=React.useState({title:'',project:'',link:'',status:'nao_iniciado'});
 const [formError,setFormError]=React.useState(''),[saving,setSaving]=React.useState(false),[moving,setMoving]=React.useState(null);
 const mounted=React.useRef(true),pending=React.useRef(false),loadVersion=React.useRef(0),reading=React.useRef(null);
 async function reload(){
  // Serialize the shared resource's pagination; ignore reads begun before a write.
  while(reading.current){await reading.current;if(!mounted.current)return;}
  const version=loadVersion.current;
  const operation=(async()=>{try{const data=await readTasks();if(mounted.current&&version===loadVersion.current){setRows(data);setError('');}}catch{if(mounted.current&&version===loadVersion.current)setError('Não foi possível carregar as tarefas. Confira a coleção e sua permissão de leitura.');}})();
  reading.current=operation;try{await operation;}finally{if(reading.current===operation)reading.current=null;}
 }
 React.useEffect(()=>{mounted.current=true;reload();const timer=window.setInterval(()=>{if(!pending.current&&!reading.current)reload();},TASKS_CONFIG.pollMs);return()=>{mounted.current=false;loadVersion.current++;window.clearInterval(timer);};},[]);
 function openTask(row=null){
  if(pending.current)return;setEditing(row);setFormError('');
  setDraft(row?{title:row[TASKS_CONFIG.titleField]||'',project:row[TASKS_CONFIG.projectField]||'',link:row[TASKS_CONFIG.linkField]||'',status:taskStatus(row)}:{title:'',project:'',link:'',status:'nao_iniciado'});setOpened(true);
 }
 function closeTask(){if(!pending.current)setOpened(false);}
 async function saveTask(){
  if(TASKS_CONFIG.demo||pending.current)return;
  let values;try{values=taskValues(draft);}catch(failure){setFormError(failure.message);return;}
  pending.current=true;setSaving(true);setFormError('');loadVersion.current++;
  try{
   if(editing)await taskResource.update(editing[TASKS_CONFIG.idField],values,{refresh:false});
   else await taskResource.create(values,{refresh:false});
  }catch{
   if(mounted.current){setFormError('Não foi possível confirmar a gravação. Confira as permissões. Se houve falha de conexão, atualize e procure a tarefa antes de repetir o cadastro.');setSaving(false);}
   pending.current=false;return;
  }
  if(mounted.current){setOpened(false);setNotice(editing?'Tarefa atualizada.':'Tarefa cadastrada.');}
  try{await reload();}finally{pending.current=false;if(mounted.current)setSaving(false);}
 }
 async function changeStatus(row,status){
  if(TASKS_CONFIG.demo||pending.current||!TASK_STATUSES.some(option=>option.value===status)||status===taskStatus(row))return;
  pending.current=true;setMoving(row[TASKS_CONFIG.idField]);loadVersion.current++;
  try{await taskResource.update(row[TASKS_CONFIG.idField],{[TASKS_CONFIG.statusField]:status},{refresh:false});}
  catch{if(mounted.current){setError('Não foi possível confirmar a mudança de situação. Atualize e confira o cadastro.');setMoving(null);}pending.current=false;return;}
  if(mounted.current){setRows(current=>current.map(item=>item[TASKS_CONFIG.idField]===row[TASKS_CONFIG.idField]?{...item,[TASKS_CONFIG.statusField]:status}:item));setNotice('Situação da tarefa atualizada.');}
  try{await reload();}finally{pending.current=false;if(mounted.current)setMoving(null);}
 }
 const projects=[...new Set(rows.map(row=>row[TASKS_CONFIG.projectField]).filter(Boolean))].sort();
 const visible=rows.filter(row=>(!projectFilter||row[TASKS_CONFIG.projectField]===projectFilter)&&(!search||String(row[TASKS_CONFIG.titleField]||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))));
 const columns=TASK_STATUSES.concat(visible.some(row=>!TASK_STATUSES.some(option=>option.value===taskStatus(row)))?[{value:'outros',label:'Situação não reconhecida',color:'#8c8c8c'}]:[]);
 return <Space direction="vertical" size="large" style={{width:'100%'}}>
  <Space wrap><Typography.Title level={3} style={{margin:0}}>Tarefas</Typography.Title>{TASKS_CONFIG.demo&&<Tag color="green">Demonstração · dados fictícios</Tag>}<Button type="primary" onClick={()=>openTask()} disabled={saving||moving!==null}>Cadastrar nova tarefa</Button><Button onClick={reload} disabled={saving||moving!==null}>Atualizar tarefas</Button></Space>
  <Typography.Text type="secondary">Organize o trabalho aqui. A situação da tarefa é independente do estado do chat no Monitor Codex.</Typography.Text>
  {error&&<Alert type="error" showIcon message={error}/>}{notice&&<Alert type="success" showIcon message={notice} closable onClose={()=>setNotice('')}/>}
  <Space wrap><Input aria-label="Buscar tarefa" allowClear value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar tarefa" style={{width:280}}/><Select aria-label="Filtrar tarefas por projeto" allowClear placeholder="Todos os projetos" value={projectFilter||undefined} onChange={value=>setProjectFilter(value||'')} style={{minWidth:220}} options={projects.map(project=>({value:project,label:project}))}/></Space>
  <Row wrap={false} gutter={12} style={{overflowX:'auto',paddingBottom:12}} aria-label="Kanban de tarefas">
   {columns.map(column=>{const cards=visible.filter(row=>column.value==='outros'?!TASK_STATUSES.some(option=>option.value===taskStatus(row)):taskStatus(row)===column.value);return <Col key={column.value} flex="0 0 270px"><Card size="small" title={<Space><Typography.Text strong>{column.label}</Typography.Text><Tag>{cards.length}</Tag></Space>} style={{minHeight:380,height:'100%',background:token.colorFillAlter,borderTop:'3px solid '+column.color}}>
    <Space direction="vertical" size={12} style={{width:'100%'}}>{!cards.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma tarefa"/>}{cards.map(row=><Card key={row[TASKS_CONFIG.idField]} size="small" style={{background:token.colorBgContainer}}><Space direction="vertical" size={10} style={{width:'100%'}}>
     <Typography.Text strong style={{overflowWrap:'anywhere'}}>{row[TASKS_CONFIG.titleField]}</Typography.Text><Typography.Text type="secondary">{row[TASKS_CONFIG.projectField]||'Sem projeto'}</Typography.Text>
     <Tag color={taskChatId(row[TASKS_CONFIG.linkField])?'blue':'default'}>{taskChatId(row[TASKS_CONFIG.linkField])?'Chat vinculado':row[TASKS_CONFIG.linkField]?'Link não reconhecido':'Sem chat vinculado'}</Tag>
     <Select aria-label={'Situação da tarefa '+row[TASKS_CONFIG.titleField]} value={taskStatus(row)} options={TASK_STATUSES} style={{width:'100%'}} disabled={TASKS_CONFIG.demo||saving||moving!==null} loading={moving===row[TASKS_CONFIG.idField]} onChange={value=>changeStatus(row,value)}/>
     <Button size="small" onClick={()=>openTask(row)} disabled={saving||moving!==null}>Editar tarefa</Button>
    </Space></Card>)}</Space>
   </Card></Col>;})}
  </Row>
  <Drawer title={editing?'Editar tarefa':'Nova tarefa'} open={opened} onClose={closeTask} width="min(480px, 100vw)" closable={!saving} maskClosable={!saving} keyboard={!saving}>
   <Space direction="vertical" size={16} style={{width:'100%'}}>
    <label style={{width:'100%'}}>Nome da tarefa *<Input aria-label="Nome da tarefa" value={draft.title} maxLength={200} disabled={saving} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
    <label style={{width:'100%'}}>Projeto (opcional)<Input aria-label="Projeto da tarefa" value={draft.project} maxLength={120} disabled={saving} onChange={event=>setDraft({...draft,project:event.target.value})}/></label>
    <Space direction="vertical" style={{width:'100%'}}><Typography.Text>Situação da tarefa</Typography.Text><Select aria-label="Situação da tarefa no cadastro" value={draft.status} options={TASK_STATUSES} style={{width:'100%'}} disabled={saving} onChange={value=>setDraft({...draft,status:value})}/></Space>
    <label style={{width:'100%'}}>Link do chat (opcional)<Input aria-label="Link do chat da tarefa" value={draft.link} disabled={saving} onChange={event=>setDraft({...draft,link:event.target.value})} placeholder="codex://threads/… ou ID do chat"/></label>
    <Typography.Text type="secondary">Sem link, a tarefa continua neste Kanban. Com link, aparece também no Monitor Codex. Remover ou trocar o link preserva o histórico de consumo já registrado.</Typography.Text>
    {TASKS_CONFIG.demo&&<Alert type="info" showIcon message="Demonstração: nenhum cadastro será gravado."/>}{formError&&<Alert type="error" showIcon message={formError}/>}
    <Space wrap><Button type="primary" onClick={saveTask} disabled={TASKS_CONFIG.demo} loading={saving}>{editing?'Salvar alterações':'Cadastrar tarefa'}</Button><Button onClick={closeTask} disabled={saving}>Cancelar</Button></Space>
   </Space>
  </Drawer>
 </Space>;
}
ctx.render(<Tasks/>);
