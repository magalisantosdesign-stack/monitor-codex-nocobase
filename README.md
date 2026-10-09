# Monitor Codex para NocoBase

Kanban local para acompanhar chats vinculados a tarefas ou projetos: **Processando**, **Aguardando aprovação**, **Aguardando resposta**, **Respondido**, **Interrompido** **Sem sinal** e **Estado não confirmado**. Oferece Stand-by, atualização automática e suporte aos temas claro e escuro. O estado do chat é independente da situação da tarefa ou projeto.

O pacote começa **em demonstração, com seis cartões fictícios**. Nesse modo não lê cadastros, chama o coletor ou salva vínculos. Dados pessoais, conversas e configurações de conta não acompanham a distribuição. Este é um projeto independente, sem vínculo oficial com Codex ou NocoBase.

## Escolha como instalar

Você pode escolher **um dos dois caminhos**. Ambos entregam o mesmo monitor e permitem usar a conexão com ou sem extensão.

| Instalação | Quem faz a preparação | Como começar |
| --- | --- | --- |
| **Automática assistida pelo Codex via .md** | O Codex verifica requisitos, instala componentes ausentes, configura e testa | Abra a pasta no Codex e peça para executar [INSTALAR-COM-CODEX.md](docs/INSTALAR-COM-CODEX.md) |
| **Manual** | Você executa os comandos e configura o painel | Siga a seção [Instalação manual](#instalação-manual) deste README |

### Opção 1 — instalação automática assistida pelo Codex (.md)

1. Baixe e extraia o projeto em uma pasta permanente no computador onde usa o Codex.
2. Abra essa pasta como projeto no **Codex local**.
3. Envie o pedido abaixo. Se souber, acrescente o endereço do NocoBase e seu navegador.

> Leia docs/INSTALAR-COM-CODEX.md e execute a instalação do monitor neste computador. Verifique os requisitos, instale o que faltar, faça as configurações e os testes e me oriente nas etapas que exigirem minha ação. Preserve meu ambiente e não configure início automático com o Windows.

O [arquivo de instalação](docs/INSTALAR-COM-CODEX.md) orienta o Codex a aproveitar componentes existentes, preparar o coletor e o painel no NocoBase e verificar a atualização automática dos estados. O agente deve informar resultados e pendências e pode retomar a instalação após uma interrupção.

Você acompanha o processo e realiza as intervenções solicitadas, como login, permissões do sistema, confiança dos hooks e carregamento da extensão, caso escolha usá-la. O .md é o roteiro que o Codex executa com suas ferramentas; não é um executável. As etapas automáticas dependem de acesso autorizado ao computador e ao NocoBase.

**Neste caminho, o Codex conduz a preparação. Os comandos da seção manual são uma alternativa, não uma etapa adicional obrigatória.**

### Opção 2 — instalação manual

Se preferir fazer a preparação por conta própria, confira os requisitos abaixo e abra os passos recolhidos em [Instalação manual](#instalação-manual). Esse caminho mantém os comandos e configurações detalhados para o coletor, o painel e os hooks.

## Como iniciar e encerrar depois da instalação

A extensão é **opcional**, tanto na instalação pelo Codex quanto na manual. Escolha como quer iniciar o monitor no dia a dia; essa escolha é independente de quem fez a instalação. As duas opções usam o mesmo coletor e oferecem a mesma atualização automática dos estados.

| | Sem extensão | Com extensão |
| --- | --- | --- |
| Iniciar o monitor | Abrir `Iniciar-Monitor.cmd` ou executar `node scripts/Iniciar-Monitor.mjs` | Clicar em **Conectar monitor** no NocoBase |
| Preparação adicional | Nenhuma instalação de ponte ou extensão | Instalar a ponte local e carregar a extensão no navegador |
| Encerrar o Node do monitor | **Desconectar monitor**, no painel | **Desconectar monitor**, no painel |
| Após reiniciar o Windows | Abrir o iniciador novamente | Clicar em **Conectar monitor** novamente |
| Início automático com o Windows | Desativado | Desativado |

**Fechar a página, o navegador ou o Docker não encerra o coletor.** Ao terminar o trabalho, use **Desconectar monitor** antes de fechar o NocoBase. Isso encerra somente o processo do monitor e preserva vínculos, estados e Stand-by.

## Requisitos

Na instalação via .md, o Codex verifica estes requisitos e prepara os componentes ausentes. Na instalação manual, faça essa verificação antes dos passos abaixo.

- Node.js **22 ou superior**; testes executados com Node.js 24. O coletor não exige `npm install`.
- NocoBase **2**, com bloco JavaScript/RunJS que disponibilize `ctx.libs.React`, `ctx.libs.antd` e `MultiRecordResource`.
- **Docker Desktop**, no Windows, se o NocoBase for instalado pelo Docker. Nesse caso, o Docker precisa estar instalado e em execução para usar o painel.
- Codex local com os eventos de hooks necessários disponíveis e confiados pelo usuário.
- Windows e PowerShell para os iniciadores `.cmd` e a ponte do navegador. Outros sistemas não foram validados nesta versão.

### Quando preciso do Docker?

**Se já tem NocoBase 2 funcionando**, aproveite essa instalação. Não precisa reinstalar o NocoBase nem instalar Docker apenas para adicionar o monitor.

**Se vai instalar o NocoBase do zero pelo Docker**, precisa do Docker Desktop no Windows. Na instalação via .md, o Codex verifica se ele está instalado e funcionando, prepara o que faltar e orienta nas intervenções necessárias. Na instalação manual, prepare o Docker e siga o [guia oficial de instalação do NocoBase](https://docs.nocobase.com/get-started/installation/docker), usando a versão 2 compatível com este painel. O Docker é o método padrão do CLI do NocoBase; também existem opções por npm e Git, com seus próprios requisitos de aplicação e banco de dados. Veja a [referência oficial do CLI](https://docs.nocobase.com/api/cli/init).

São dois componentes: **o NocoBase hospeda o painel** e pode rodar no Docker; **o coletor do monitor roda pelo Node.js no Windows**, fora do container, no computador onde você usa o Codex. Ele não exige Docker. Para acompanhar os estados, os dois precisam estar em execução.

O botão via extensão foi verificado no Chrome e no Edge no Windows. Brave, Opera/GX e Firefox têm pacotes e testes isolados, mas ainda precisam de validação no navegador real. A instalação permanente no Firefox exige assinatura Mozilla, ainda não fornecida. Safari e navegadores móveis não têm ponte neste pacote. Detalhes em [docs/NAVEGADORES.md](docs/NAVEGADORES.md).

## Instalação manual

**Somente para quem escolheu instalar manualmente.** Se escolheu a instalação pelo Codex via .md, deixe o agente conduzir a configuração.

<details>
<summary><strong>Abrir os passos e comandos da instalação manual</strong></summary>

Siga esta seção se escolheu a **Opção 2 — instalação manual**. Na opção via .md, o Codex conduz essas tarefas pelo roteiro de instalação.

Execute os comandos na raiz do projeto. As etapas 1 a 3 preparam o monitor; na etapa 4, escolha apenas uma opção de conexão.

### 1. Guardar e configurar o pacote

Extraia o pacote ou clone este repositório em uma **pasta permanente**, na qual sua conta possa gravar arquivos. Copie `config.example.json` para `config.local.json`:

```powershell
Copy-Item config.example.json config.local.json
```

A porta padrão do coletor é **13011**. Configure `origins` com os endereços locais exatos do NocoBase, sem caminho ou barra final. O servidor atende somente em loopback; não use `*`. Dados privados ficam em `.local/data`.

Se necessário, configure `codexHome` para a pasta Codex da conta. Sem essa opção, usa `CODEX_HOME` ou `.codex` na pasta da conta. `CODEX_MONITOR_PORT`, `CODEX_MONITOR_DATA`, `CODEX_MONITOR_SETTINGS` e `CODEX_MONITOR_CONFIG` permitem configurações específicas. Consulte `src/config.mjs` antes de alterar essas opções.

### 2. Preparar o painel

Crie uma página com um bloco JavaScript no NocoBase e cole `src/panel.jsx`. Mantenha `demo: true` para experimentar os seis cartões fictícios, sem acesso à rede ou aos cadastros.

Para uso real, ajuste `MONITOR_CONFIG` no início do bloco:

- `demo: false`.
- `endpoint`: endereço local e porta do coletor, normalmente `http://127.0.0.1:13011`.
- `sources`: suas coleções e respectivos campos; os nomes fornecidos são apenas exemplos.
- `idField`, `titleField` e `linkField`: chave primária, título e campo de texto/URL usado para guardar `codex://threads/ID`.
- `sectorPath` e `appends`: caminho do setor e relações necessárias para lê-lo.
- `statusField`: situação de negócio, que o monitor não modifica.
- `label`: tipo de cadastro exibido no cartão.

O painel depende das bibliotecas do NocoBase; não é uma página HTML independente. Sua conta precisa poder ler as coleções e editar o campo de vínculo.

Para incluir a página, crie um item **Uso do Codex** no mesmo grupo do menu esquerdo, abaixo de **Monitor Codex**, adicione um bloco JavaScript/RunJS e use `src/panel-usage.jsx`. Configure `USAGE_CONFIG` na sua cópia: `demo: false` e o `endpoint` do seu coletor. Não é necessário criar coleções ou cadastrar a conta.

### 3. Instalar e confiar nos hooks

Na pasta do monitor, execute primeiro a prévia:

```powershell
node scripts/Install-Hooks.mjs
```

Revise o destino e o comando. Para gravar:

```powershell
node scripts/Install-Hooks.mjs --apply
```

O instalador preserva outros handlers e guarda backups em `.local/backups`. Revise os hooks no Codex e conceda confiança (no CLI, `/hooks`). O instalador não concede confiança nem aprova ferramentas. Pode ser necessário recarregar o Codex para ler a configuração.

São registrados nove eventos, incluindo `PreCompact` e `PostCompact`, para compactações manuais e automáticas. Ao atualizar uma instalação, revise a confiança nos novos handlers; uma definição não confiada não será executada.

Evite manter handlers de duas cópias do monitor para o mesmo uso. Se mover a pasta ou substituir uma instalação, revise os hooks antigos; instalar esta cópia não remove automaticamente os anteriores.

### 4A. Conexão sem extensão

1. Abra `Iniciar-Monitor.cmd` na pasta instalada. Alternativamente, execute `node scripts/Iniciar-Monitor.mjs` nessa pasta.
2. Abra o painel do NocoBase e confira **Coletor conectado**. Se ele já estava aberto ou havia sido desconectado, clique em **Atualizar** para retomar a consulta.
3. Vincule seus chats e acompanhe os estados. As mudanças passam a aparecer automaticamente.
4. Ao terminar, clique em **Desconectar monitor** para encerrar o Node do coletor.

Para iniciar novamente, repita os passos 1 e 2. **Atualizar** consulta o serviço; não inicia um processo local. **Conectar monitor** é destinado ao caminho com extensão e informa o iniciador manual quando a extensão não está disponível.

Esse caminho não exige instalar a ponte, registrar um protocolo, instalar extensão ou criar uma entrada de inicialização do Windows. O Node precisa estar disponível no PATH para usar o iniciador diretamente.

### 4B. Conexão com extensão

Depois das etapas 1 a 3, execute no PowerShell, dentro da pasta permanente do monitor:

```powershell
.\scripts/Instalar-Ponte-Navegadores.ps1 -Browsers Chrome,Edge -Preview
.\scripts/Instalar-Ponte-Navegadores.ps1 -Browsers Chrome,Edge
```

Substitua a seleção pelos navegadores usados: `Chrome`, `Edge`, `Brave`, `Opera` ou `Firefox`. Sem `-Browsers`, o instalador prepara todos esses hosts. A prévia não grava nada; a instalação registra a ponte somente na conta atual, sem administrador. Ela salva o caminho absoluto do Node e as opções privadas do iniciador em `.local/`.

Carregue a extensão explicitamente, conforme [docs/NAVEGADORES.md](docs/NAVEGADORES.md). Instalar a ponte **não instala a extensão**. Chrome/Edge/Brave/Opera usam `extensions/chromium`; Firefox usa `extensions/firefox`.

1. Com a extensão carregada, atualize a página do NocoBase.
2. Clique em **Conectar monitor**. O script local inicia em segundo plano e termina após iniciar o Node. A confirmação é **Coletor conectado** no painel.
3. Ao terminar, clique em **Desconectar monitor**. O Node do coletor encerra; nenhum controlador fica residente para reconectar.
4. Depois de reiniciar o Windows, abra o NocoBase e use **Conectar monitor** novamente.

A extensão encaminha somente a ação fixa de iniciar a partir do botão nas origens locais configuradas. Não lê cartões, conversas ou outros sites. A comunicação usa Native Messaging. O instalador não altera políticas do navegador nem configura início automático.

Se Node ou a pasta instalada mudar, refaça a ponte. Antes de mover a pasta, remova os registros da instalação antiga. Os arquivos privados da ponte não acompanham a exportação. Políticas corporativas podem impedir scripts ou extensões; o pacote não as modifica.

</details>

## Vínculos e Stand-by

Em **Vincular um chat**, escolha a tarefa ou projeto e informe o ID local ou `codex://threads/ID`. Links de compartilhamento não identificam o chat local. Vários cadastros podem acompanhar o mesmo chat.

**Atualizar link** substitui o vínculo do cadastro escolhido. Salvar vazio deixa de acompanhar sem excluir a tarefa ou projeto. O aviso de link inválido mostra título, tipo, setor e link, com opção de corrigir; vínculos inválidos não entram no Kanban nem são enviados ao coletor.

Use **Colocar em Stand-by** para guardar um chat já revisado. Ele sai das colunas e contadores ativos e aparece na aba **Stand-by**. **Retomar acompanhamento** o devolve à aba ativa. O link e a situação de negócio permanecem.

Stand-by fica salvo após reiniciar. Uma nova execução principal observada devolve automaticamente o chat ao acompanhamento; eventos atrasados e subagentes não o retomam. Não é possível guardar um chat em processamento ou com pergunta/aprovação pendente. Os botões exigem coletor conectado e ficam desabilitados na demonstração. Vários vínculos do mesmo chat compartilham essa escolha; remover o último elimina seu marcador de Stand-by.

## Se não conectar

1. Abra `Iniciar-Monitor.cmd` diretamente e clique em **Atualizar** no painel. Isso testa o coletor sem depender da extensão.
2. Abra `Diagnosticar-Monitor.cmd`. Ele verifica a instância e a última tentativa, sem listar chats.
3. Confira a mesma porta em `config.local.json` e `MONITOR_CONFIG.endpoint`, além da origem correta do NocoBase.
4. No caminho com extensão, confira o host instalado, a extensão carregada e a origem permitida em [docs/NAVEGADORES.md](docs/NAVEGADORES.md).
5. Logs privados ficam em `.local/windows-launcher.log`, `.local/startup-result.json` ou na pasta de dados (`service-error.log`). Não publique esses arquivos.

O iniciador detecta configuração inválida, porta ocupada, trava antiga e falha ao criar o processo. Outra instalação na mesma porta não é considerada a instância correta. A tentativa pelo botão termina com orientação após 45 segundos se o coletor não confirmar.

Instalações antigas que ativaram início com o Windows podem remover somente essa entrada com:

```powershell
.\scripts/Remover-Integracao-Windows.ps1 -OnlyAutoStart
```

O protocolo externo `codex-monitor://reconnect` permanece uma alternativa de compatibilidade, registrada por `scripts/Instalar-Reconexao.ps1`; ele não é usado pelo botão atual e não é necessário no caminho sem extensão.

## Limites e validação

- O painel consulta estados a cada **3 segundos** e vínculos a cada **30 segundos**, enquanto estiver aberto e conectado.
- Apenas chats vinculados são acompanhados. Não há reconstrução de eventos anteriores à ativação/vinculação nem estado separado para pensamento.
- Perguntas exigem `request_user_input` ou `request_user_input_async`. Perguntas em texto livre podem aparecer como Respondido.
- `PermissionRequest` sozinho não comprova pedido humano. A classificação consulta `approvalsReviewer` no snapshot interno de configurações por chat. Revisão automática permanece Processando; configuração desconhecida mostra Sem sinal para esse pedido.
- Esse snapshot não é uma fila de aprovações ao vivo e precisa ser revalidado se o Codex mudar sua estrutura.
- Subagentes e resultados tardios não reabrem o turno principal encerrado. Não se infere conclusão por tempo ou silêncio.

O clique real foi confirmado no Chrome; a desconexão foi verificada pela ausência do processo do coletor, PID e listener. O teste isolado com navegador real passou no Edge. O Firefox foi testado em Job Object sintético para confirmar que o Node sobrevive ao host. Esses resultados não comprovam funcionamento em todos os computadores. Um reinício físico do Windows com a ponte atual ainda precisa ser validado.

Referências: [Hooks do Codex](https://learn.chatgpt.com/docs/hooks) e [revisão automática](https://learn.chatgpt.com/docs/sandboxing/auto-review).

## Organização do projeto

```text
monitor-codex-nocobase/
├── src/          Código do coletor e painel JSX
├── tests/        Testes com dados fictícios
├── scripts/      Instalação, inicialização, diagnóstico e exportação
├── extensions/  Extensões Chromium e Firefox
├── docs/         Guias de navegadores, privacidade e histórico
├── Iniciar-Monitor.cmd
├── Diagnosticar-Monitor.cmd
├── LICENSE
├── config.example.json
└── package.json
```

Execute os comandos deste guia na raiz do projeto. `config.local.json` e `.local/` continuam nessa raiz e não são publicados.

## Desenvolvimento e publicação

```powershell
npm test
node scripts/check-distribution.mjs
node scripts/export.mjs
```

Os testes usam dados fictícios e serviços isolados. O teste opcional `npm run test:edge` usa o Edge instalado, um perfil exclusivo e um host temporário. Não usa o perfil pessoal; quando não há Edge, informa SKIP.

`scripts/export.mjs` cria uma pasta nova em `release/` com somente os arquivos públicos listados em `package.json`. Configurações locais, dados, logs, backups e histórico Git da pasta de trabalho ficam de fora. Use essa exportação para iniciar ou atualizar o **repositório dedicado ao monitor**; nunca publique o repositório de trabalho que contém dados pessoais.

Distribuído sob a [licença MIT](LICENSE). Você pode usar, modificar e redistribuir o monitor, inclusive comercialmente, preservando o aviso de autoria e a licença. Copyright (c) 2026 magalisantosdesign-stack. Consulte [docs/PRIVACIDADE.md](docs/PRIVACIDADE.md), [docs/CHANGELOG.md](docs/CHANGELOG.md) e [AGENTS.md](AGENTS.md).
O coletor também confere o estado do Codex desktop a cada 3 segundos para reconhecer respostas recebidas dentro do mesmo turno. A ponte local é descoberta automaticamente pelos hooks de chats vinculados; precisa de uma versão compatível do aplicativo desktop no Windows. Uma atualização do Codex pode exigir ajuste dessa integração. Sem ponte disponível, a coleta continua pelos hooks, e perguntas assíncronas podem permanecer pendentes até uma nova entrada. Não há leitura de arquivos de transcrição nem uso do texto das conversas.

A ponte é opcional e depende da versão do Codex desktop. A consulta geral de status exige o contexto de outro chat vinculado; quando há apenas um contexto disponível, esse chat usa os hooks para execução e a consulta de metadados para perguntas. Contextos de chats desvinculados não são usados. Essa ponte local ainda não é uma API estável de integração pública.

Perguntas pendentes são reconciliadas por IDs e tipos dos itens, usando uma consulta de um turno com saídas desativadas. O monitor não examina textos, argumentos ou respostas. Uma entrada humana posterior ao ID da pergunta libera a pendência, inclusive no mesmo turno. Flags vazias de um agente trabalhando não bastam para liberar uma pergunta.

Antes de compactar, `PreCompact` tenta confirmar essa entrada e salva um comprovante mínimo `QuestionResolved` na fila privada. O comprovante permanece após a compactação e o reinício do coletor, mesmo se os IDs desaparecerem do histórico resumido. Essa captura também funciona com o coletor desligado, para chats já vinculados. O hook termina após a consulta, limitada a 900 ms; não instala um serviço permanente e não bloqueia a compactação.

Isso exige hooks carregados e confiados e uma ponte desktop compatível. Se a consulta falhar, exceder o limite ou já não encontrar os IDs, a compactação sozinha não comprova uma resposta: a pendência permanece até nova confirmação ou entrada detectada pelos hooks. Os testes simulam a confirmação antes da compactação, o coletor desligado e a retomada com os IDs removidos; não substituem a validação do evento no aplicativo real.


## Recuperação de estados

O monitor relê os chats automaticamente enquanto conectado. Cada confirmação tem validade de 30 segundos. Esse prazo mede a confiança da exibição; não conclui chats nem responde perguntas. Se faltar confirmação, o cartão vai para **Estado não confirmado** e informa o último estado observado. Uma pergunta cujos IDs foram removidos sem comprovante não aparece como uma espera comprovada. Quando a fonte retornar, o cartão volta à coluna correta automaticamente.

**Tentar novamente**, no cartão, prioriza uma nova leitura. Não reinicia o coletor, não envia mensagens, não concede aprovações e não exige terminal ou reinstalação de hooks. Depois de reconectar ou reiniciar o coletor, os estados salvos passam por nova verificação. A leitura também funciona com apenas um chat vinculado; conexões indisponíveis usam outros contextos locais reais quando disponíveis. Um novo turno principal observado pela fonte recupera um início cujo hook não chegou, respeitando proteção contra eventos antigos.

A confirmação de captura é mantida em memória e não é exportada. Enquanto um estado estiver sem confirmação, ele não pode ser colocado em Stand-by; marcadores já existentes são preservados. Uma ponte incompatível ou uma instalação sem captura ativa continua sendo uma limitação de instalação, sinalizada no painel. A recuperação não contorna a confiança exigida pelo Codex nem promete estados que a fonte não forneceu.

## Atualizar uma instalação anterior a 0.6.4

Desconecte o coletor antes de atualizar os arquivos. Preserve `config.local.json` e `.local/` na raiz, reinstale os hooks com `npm run hooks:install` e revise a confiança solicitada pelo Codex. Se usa extensão, execute novamente `scripts/Instalar-Ponte-Navegadores.ps1` e carregue `extensions/chromium` ou `extensions/firefox` no navegador. O bloco do NocoBase usa agora `src/panel.jsx`. A atualização não instala nada automaticamente.

## Uso do Codex

A nova página **Uso do Codex**, no menu esquerdo abaixo de **Monitor Codex**, mostra consumo, percentual disponível, próxima renovação das janelas e redefinições disponíveis retornadas pela conta conectada. A quantidade de redefinições é apenas consultada; o painel não utiliza esse benefício. Quando o contador não for fornecido, aparece Não informado. Atualiza automaticamente a cada minuto enquanto aberta e oferece **Atualizar uso**. O Kanban e o Stand-by continuam na página Monitor Codex.

Esses limites são compartilhados pela conta inteira, incluindo chats não vinculados. Não são tokens por tarefa nem uma estimativa de custo. Quando a fonte não responder, a aba sinaliza leitura não confirmada e preserva a última leitura com seu horário; ausência de dados nunca significa zero. A integração usa a ponte opcional do desktop e requer pelo menos um contexto real de chat vinculado disponível; alterações no aplicativo podem afetar sua compatibilidade. O modo de demonstração mostra apenas números fictícios, sem consultas.
