# Instalar o Monitor Codex com ajuda do Codex

## Para quem vai instalar

Baixe e extraia o projeto em uma pasta permanente do computador onde você usa
o Codex. Abra essa pasta como projeto no **Codex local** e envie:

> Leia `docs/INSTALAR-COM-CODEX.md` e execute a instalação do Monitor Codex neste computador. Verifique os requisitos, instale o que faltar, prepare as configurações e o painel e teste o funcionamento. Preserve minhas configurações e cadastros existentes. Oriente-me quando uma etapa depender de mim. Não configure início automático com o Windows.

Se já souber, acrescente o endereço do seu NocoBase e o navegador que usa.
Não envie senhas, tokens nem arquivos de conversas. Quando solicitado, faça
login ou autorize o acesso na tela do aplicativo.

O Codex precisa de acesso local aos arquivos e comandos do computador. Uma
tarefa executada somente na nuvem não instala o coletor no seu Windows.
Este arquivo é um roteiro para o agente executar e verificar; não é um
instalador executável nem dispensa as permissões do sistema.

## Instruções para o Codex responsável pela instalação

Ao receber o pedido acima, conduza a instalação até o resultado verificável.
Não se limite a devolver comandos para o usuário executar. Use as ferramentas
disponíveis, respeite as permissões do ambiente e continue as etapas que não
dependem de uma intervenção pendente. Explique a ação humana em linguagem
simples, indicando a tela, o botão e o resultado esperado.

Leia primeiro [AGENTS.md](../AGENTS.md), [README.md](../README.md),
[NAVEGADORES.md](NAVEGADORES.md) e [PRIVACIDADE.md](PRIVACIDADE.md).
Confira as versões e a ajuda dos comandos locais antes de escolher opções.
Se houver skills NocoBase aplicáveis, siga suas rotas de ambiente, modelo e UI.

### 1. Identificar o destino e o que já existe

- Resolva a raiz desta cópia por `package.json`, `src/` e `scripts/`; execute
  os comandos do monitor nessa raiz. Não use a pasta temporária de download.
- Identifique Windows, arquitetura, permissões de gravação, Node e PowerShell.
- Verifique a pasta Codex efetivamente usada pelo aplicativo, considerando
  `CODEX_HOME`, configuração existente e `src/config.mjs`. Não deduza essa
  pasta a partir do nome do usuário nem copie configuração de outro computador.
- Identifique NocoBase, versão, endereço, acesso administrativo disponível e
  cadastros de tarefas/projetos. Esta versão exige **NocoBase 2**.
- Inspecione esta instalação do monitor: configuração, hooks, ponte e processo.
  Se já existe uma instalação funcionando, reutilize-a ou explique a migração;
  não crie uma segunda cópia com handlers duplicados para o mesmo uso.
- Pergunte somente o que não puder identificar: endereço do NocoBase,
  instalação de destino se houver várias, navegador e preferência de conexão.
  Agrupe perguntas relacionadas e aproveite informações já fornecidas.

Mostre uma prévia curta: requisitos encontrados, ausentes, instalação que será
usada e ações planejadas. O pedido de instalação autoriza a preparação e a
instalação dos componentes necessários; não peça uma nova confirmação para
cada comando rotineiro. Ele não autoriza apagar dados, atualizar uma aplicação
existente de forma disruptiva ou substituir registros de outra instalação.

### 2. Instalar somente os requisitos necessários

| Componente | Quando é necessário | Conduta |
| --- | --- | --- |
| Node.js 22+ | Sempre, para o coletor | Reutilizar versão compatível; instalar se ausente |
| PowerShell e Windows | Iniciadores e ponte desta distribuição | Verificar; não prometer suporte equivalente em outro sistema |
| NocoBase 2 e bloco JavaScript/RunJS | Painel | Reutilizar aplicação e verificar disponibilidade do bloco |
| Codex local compatível com hooks | Captura de eventos | Conferir eventos, configuração e confiança |
| CLI oficial NocoBase (`nb`) | Automatização quando essa rota for usada | Instalar/conectar se faltar e a rota for necessária |
| Extensão e ponte nativa | Botão Conectar iniciar o Node | Opcionais; instalar somente para o caminho escolhido |
| Docker | Apenas se a instalação escolhida do NocoBase exigir | Não instalar apenas porque o monitor usa NocoBase |
| Git | Apenas se for necessário clonar/atualizar por Git | Um ZIP extraído é suficiente; não exigir Git nesse caso |

**Node:** verifique `node --version`, `npm --version` e o executável resolvido.
Se faltar, consulte a [página oficial de downloads](https://nodejs.org/en/download)
e instale uma LTS compatível com a arquitetura. No Windows com WinGet disponível,
confira o pacote antes de instalar:

```powershell
winget show --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id OpenJS.NodeJS.LTS --exact --source winget
```

Use a revisão e a elevação oferecidas pelo ambiente. Se houver gerenciador de
versões ou Node incompatível já usado por outros projetos, preserve-o e escolha
uma instalação compatível sem substituição silenciosa. Não ignore verificações
de hash nem aceite termos adicionais por iniciativa própria. Sem WinGet,
use o instalador oficial verificado e oriente o usuário na janela que exigir
interação. Depois confirme versão e caminho; uma instalação concluída pode
exigir nova sessão de terminal para atualizar PATH. O coletor não exige
`npm install` nem dependências extras de runtime.

**NocoBase:** se já existir, conecte-se a essa aplicação. Não reinstale o banco,
não redefina a senha, não atualize a versão e não altere o Docker para instalar
o painel. Se `nb` for necessário e estiver ausente, consulte o
[guia oficial do CLI](https://docs.nocobase.com/nocobase-cli/installation/cli)
e siga a instalação atual indicada nele. Verifique `nb --version` e a ajuda.

Se o NocoBase também estiver ausente, explique que ele é a aplicação que hospeda
o painel. Prepare a instalação local pelo guia oficial e pelo assistente
`nb init --ui`, garantindo a escolha de uma versão **2** compatível; não aceite
uma instalação padrão de versão 3 como equivalente. Oriente o usuário nas
escolhas de conta/termos e acompanhe o comando até a conclusão, continuando pelos
comandos de retomada fornecidos pelo próprio CLI. Instale Docker ou outros
componentes somente se essa rota os exigir. Não reinicie o computador por conta
própria; salve o progresso privado e retome após a ação humana.

Se o sistema, a versão ou as políticas impedirem a rota suportada, apresente
a limitação específica e o próximo passo. Não transforme uma falha de acesso
em instrução para desabilitar segurança, confiança ou políticas corporativas.

### 3. Preparar configuração e preservar o ambiente

Crie `config.local.json` na raiz a partir de `config.example.json`, somente se
não existir. Se existir, leia e altere somente os campos necessários, mantendo
backup privado em `.local/backups/`. Preserve campos desconhecidos.

- `port`: use 13011 se estiver livre; se outra instância ocupar a porta, escolha
  outra livre sem encerrar o processo de terceiros. Use a mesma porta no painel.
- `origins`: endereços locais exatos do NocoBase, sem caminho ou barra final.
  A configuração aceita localhost, 127.0.0.1 e loopback IPv6; nunca `*` ou um
  endereço remoto. Um NocoBase remoto exige outra solução, fora deste roteiro.
- `dataDir`: mantenha `.local/data`, salvo necessidade identificada.
- `codexHome`: informe somente se a descoberta padrão não corresponder ao
  aplicativo usado. `CODEX_HOME` tem precedência; confira `src/config.mjs`.

Não copie IDs, cartões, configurações ou caminhos do autor do projeto. Mantenha
tudo que for específico do usuário fora dos arquivos públicos. Não faça commit,
push ou exportação da instalação configurada. A configuração real do bloco
fica no NocoBase ou num arquivo privado em `.local/`; preserve `src/panel.jsx`
em demonstração para os exemplos e testes do pacote.

### 4. Instalar hooks e orientar a confiança

Na raiz do pacote, execute e revise a prévia:

```powershell
node scripts/Install-Hooks.mjs
```

Confira a pasta de destino e o comando Node desta cópia; depois aplique:

```powershell
node scripts/Install-Hooks.mjs --apply
```

O instalador preserva handlers de terceiros e cria backup quando já há um
arquivo. Verifique a gravação dos nove eventos descritos no README, sem imprimir
handlers de terceiros ou conteúdo privado. Não altere confiança, revisor de
aprovações ou permissões de ferramentas.

Peça ao usuário para revisar e confiar nos hooks na interface disponível do
Codex. No CLI, a revisão usa `/hooks`. Se a configuração só for lida após
recarregar o aplicativo, explique a ação e salve o progresso antes de fazê-la.
Depois confirme que os eventos chegam; arquivo gravado não comprova hook ativo.
Não use opções para contornar a confiança. Novas definições podem exigir revisão.

### 5. Configurar a página do NocoBase

Use acesso autorizado via CLI/ferramentas oficiais, conforme as capacidades da
versão instalada. Verifique ambiente e destino antes de escrever. Havendo
vários Portals ou aplicações, pergunte o destino; não escolha pelo marcador de
padrão. Siga as skills NocoBase disponíveis para o modelo e a UI.

Se autenticação expirar, inicie o fluxo oficial e peça ao usuário que autorize
no navegador. Não peça senha ou token no chat. Sem acesso automatizado suportado,
prepare o bloco e guie a inclusão pela interface; registre essa etapa como
pendente até verificar sua realização. Não invente comandos de CLI nem grave
esquemas por SQL para contornar ausência de ferramenta.

Leia somente o esquema necessário das coleções que armazenam as tarefas e
projetos. Verifique chave primária, título, situação, link do Codex e relação
de setor quando existir. Os nomes `projetos`, `demandas`, `nome`, `titulo`,
`linkCodex`, `subarea` e `situacao` do exemplo não são nomes universais.

Se faltar apenas um campo de vínculo, explique e crie um campo compatível de
texto/URL na coleção escolhida pela rota oficial; não substitua campos ou dados.
Se não existirem cadastros de tarefas/projetos, pergunte onde o usuário quer
cadastrá-los antes de criar um modelo. Não copie a estrutura pessoal do autor.

Prepare uma página **Monitor Codex**, evitando duplicar outra já existente.
Crie um bloco JavaScript/RunJS compatível com `ctx.libs.React`, `ctx.libs.antd`
e `MultiRecordResource`. Comece pela demonstração de `src/panel.jsx`, verifique
a renderização e configure a cópia do bloco para uso real:

- `demo: false`;
- `endpoint`: loopback e porta configurada;
- `sources`: coleções confirmadas, com `label`, `idField`, `titleField`,
  `linkField`, `statusField` e, quando existirem, `sectorPath` e `appends`.

Use os dados cadastrados pelo próprio usuário. O monitor vincula um chat a uma
tarefa/projeto já cadastrado; ele não precisa de uma lista nova de acompanhamentos.
Verifique leitura das coleções e edição do campo de link com a conta usada.
Não amplie permissões globais para resolver acesso negado.

No mesmo grupo do menu esquerdo, prepare também **Uso do Codex**, abaixo de
**Monitor Codex**, com um bloco JavaScript/RunJS usando `src/panel-usage.jsx`.
Evite duplicar uma página já existente. Valide primeiro a demonstração e
configure `USAGE_CONFIG` na cópia local: `demo: false` e o mesmo `endpoint`
do coletor. Essa página não exige novas coleções nem cadastro de conta; usa
limites da conta conectada pela ponte do desktop. Exige um contexto real de
chat vinculado disponível e informa quando a leitura não puder ser confirmada.

Leia os dois blocos novamente depois de salvar. Reabra as páginas e confira
que os blocos persistiram. Não declare sucesso apenas porque a API de gravação
respondeu. Na página de uso, verifique a leitura real e a mudança automática
do horário de última leitura, sem clique, após pelo menos um minuto. Ausência
de janela ou erro da fonte não significa consumo zero. Confira também
Redefinições disponíveis: usar somente o contador retornado; dado ausente
é Não informado, e zero explícito deve aparecer como zero. Não consumir resets.

### 6. Escolher conexão com ou sem extensão

Se a preferência ainda não foi informada, apresente as duas opções numa única
pergunta: **sem extensão** (abrir o iniciador quando for trabalhar) ou
**com extensão** (iniciar pelo botão Conectar no painel). Não instale a ponte
quando o usuário escolher sem extensão.

**Sem extensão:** execute `node scripts/Iniciar-Monitor.mjs` ou abra
`Iniciar-Monitor.cmd`, na raiz. O usuário poderá abrir esse CMD posteriormente
e clicar em **Atualizar** para retomar as consultas. Não instale protocolo,
host nativo, serviço ou início automático só para esse caminho.

**Com extensão, no Windows:** confira o navegador escolhido e execute a
prévia do instalador apenas para ele. Exemplo para Edge:

```powershell
.\scripts/Instalar-Ponte-Navegadores.ps1 -Browsers Edge -Preview
.\scripts/Instalar-Ponte-Navegadores.ps1 -Browsers Edge
```

Os valores aceitos são Chrome, Edge, Brave, Opera e Firefox. Confirme registros
pertencentes a esta cópia; em conflito, preserve a outra instalação e explique
a migração. O instalador também prepara o iniciador e seu protocolo auxiliar;
nenhuma dessas ações deve ativar `-AutoStart`.

Guie o carregamento explícito da extensão segundo [NAVEGADORES.md](NAVEGADORES.md).
Para Chromium use `extensions/chromium`. Firefox usa `extensions/firefox`,
mas o carregamento temporário não persiste ao fechar o navegador; a distribuição
permanente ainda depende de assinatura Mozilla. Não apresente teste temporário
Firefox como instalação definitiva nem desative verificação de assinatura.

Para origem local diferente de http://localhost:13000 ou
http://127.0.0.1:13000, prepare cópias privadas dos pacotes em `.local/`, ajustando
`content_scripts.matches` dos manifests e `allowedOrigins` de `background.js`
dos dois pacotes. Preserve a chave Chromium e o ID Firefox, o código de comunicação
idêntico e a seleção limitada de origens. O usuário deve carregar essa cópia
configurada. Não adicione acesso a todos os sites. Registre o caminho privado
para futuras atualizações; não exporte a cópia personalizada.

Se uma política impedir carregamento, ofereça o caminho sem extensão. Para
processos auxiliares use janela oculta, salvo quando a própria etapa exigir
uma janela interativa para autorização. O navegador não inicia um arquivo CMD
arbitrário; o botão exige a ponte e a extensão realmente carregada.

### 7. Verificar a instalação por etapas

Execute as verificações necessárias e guarde resultados mínimos em
`.local/instalacao-codex.md`: etapa, resultado, horário e pendência. Não salve
prompts, respostas, tokens ou uma listagem das tarefas. Evite repetir testes
já aprovados sem uma mudança ou falha que justifique isso.

1. **Coletor:** inicie-o e execute `node scripts/Diagnosticar-Monitor.mjs`.
   Confira serviço e `instanceId` desta raiz em `/states`, com a origem permitida,
   sem imprimir a lista de estados. Diagnóstico aprovado não valida o painel.
2. **Interface:** confira o bloco salvo, textos, tema, ausência de erros e
   **Coletor conectado**. Com extensão, teste o clique humano em **Conectar**;
   iniciar por shell sozinho não comprova que o botão funciona.
3. **Vínculo real:** peça ao usuário uma tarefa/projeto e o link/ID do chat
   desta instalação que deseja acompanhar. Use `codex://threads/ID` ou o ID
   local; links de compartilhamento não identificam o chat. Preserve outros
   vínculos e verifique que o cartão aparece.
4. **Atualização automática:** use o próprio chat de instalação para um teste
   combinado com o usuário. Verifique Processando e faça uma pergunta com
   `request_user_input` ou `request_user_input_async`; peça para observar
   Aguardando resposta antes de responder. Após a resposta, verifique a retomada
   de Processando. Termine com uma resposta curta para que o usuário observe
   Respondido. Se não puder observar o estado depois da própria resposta final,
   registre essa última verificação como pendente e peça confirmação no próximo
   contato. Não permaneça num loop que impeça o usuário de observar o teste.
5. **Aprovações:** valide somente se surgir um pedido humano real. Não force
   comando arriscado para produzir uma aprovação nem confunda auto_review com
   espera humana. Marque como não testado se não houver evento real disponível.
6. **Desconexão e retorno:** com o usuário ciente do teste e somente para esta
   instalação, use Desconectar e confirme o encerramento do PID/porta/instância
   correspondente. Reconecte pelo caminho escolhido e verifique a preservação
   do vínculo. Não encerre outros Node, chats, Docker ou NocoBase; não use
   `taskkill /IM node.exe` ou comando equivalente.

Os testes isolados de desenvolvimento podem complementar a verificação, mas
não substituem eventos e interface reais. Não execute a suíte inteira dentro
da instalação pessoal para afirmar que os hooks foram ativados. Em uma cópia
isolada, `npm test` é opcional para diagnóstico e usa fixtures fictícias;
`npm run test:edge` usa perfil/host temporários. Esses testes não comprovam
reinício físico do Windows ou carregamento no navegador pessoal.

Quando não houver ferramenta de leitura da interface, guie a confirmação do
usuário com resultado esperado. Distinga claramente observado, confirmado
pelo usuário, teste isolado e não testado. Não diga que funciona perfeitamente
em todos os computadores ou versões do Codex.

### 8. Tratar falhas e retomar sem refazer tudo

- **Porta ocupada:** identifique a instância, escolha porta livre se necessário
  e alinhe configuração/painel. Não mate um processo desconhecido.
- **Node ou PATH:** confirme o executável efetivo, abra nova sessão quando
  necessário e refaça somente os caminhos privados da ponte se mudarem.
- **Hooks não chegam:** confira destino real, definição instalada e confiança;
  não marque como confiado automaticamente nem leia transcrições para compensar.
- **Botão não inicia:** teste o iniciador direto e depois host, extensão e origem.
  Diferencie coletor funcional de conexão pelo botão ainda não confirmada.
- **Painel vazio:** confira modo real, coleção, campos, permissões e persistência
  do bloco. Não recrie a página inteira ou altere cadastros existentes às cegas.
- **Estado não confirmado:** aguarde a recuperação e use Tentar novamente quando
  fizer sentido. Consulte os limites do README; não apague dados ou resolva
  perguntas pela passagem de tempo.
- **Intervenção humana ou reinício:** salve progresso e pendências em `.local/`.
  Quando o usuário retornar, leia esse registro e revalide somente o que pode
  ter mudado. Não reinstale tudo nem prometa continuar quando o chat estiver fechado.

Preserve backups e não remova componentes já existentes. Se for preciso desfazer
uma tentativa, remova somente registros/handlers/arquivos comprovadamente
criados por ela, usando os comandos de remoção do pacote para a ponte e sem
apagar dados privados. Explique qualquer mudança de vínculo necessária para teste.

### 9. Entregar o resultado para o usuário

Informe de forma curta:

- o endereço da página criada ou configurada;
- como iniciar pelo caminho escolhido e como Desconectar ao terminar;
- como cadastrar a tarefa/projeto e depois vinculá-lo ao chat;
- quais verificações passaram e qualquer confirmação ainda pendente;
- como retomar uma instalação incompleta usando este mesmo arquivo.

Classifique o resultado como **verificado**, **parcial com etapas pendentes**
ou **impedido por uma limitação identificada**. Só declare a instalação verificada
quando os requisitos, configuração, hooks ativos, painel persistido, conexão,
vínculo e atualização automática tiverem evidência. Uma verificação opcional de
aprovação ou de reinício não realizada deve continuar explicitamente não testada.
Não publique arquivos privados, não altere visibilidade do GitHub e não ative
início automático com o Windows como parte desta instalação.

## Referências

- [Node.js: downloads oficiais](https://nodejs.org/en/download)
- [Microsoft: instalação com WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/install)
- [NocoBase: instalação e conexão pelo CLI](https://docs.nocobase.com/nocobase-cli/installation/cli)
- [Codex: hooks e revisão de confiança](https://learn.chatgpt.com/docs/hooks)
- [Guia do monitor](../README.md) e [guia dos navegadores](NAVEGADORES.md)
