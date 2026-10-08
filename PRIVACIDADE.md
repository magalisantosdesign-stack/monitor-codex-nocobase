# Dados da distribuição

## Conteúdo público

Código do coletor, hook, painel, iniciadores e instaladores; configurações de exemplo; documentação; testes e exemplos com identificadores fictícios. O manifesto `files` do package.json delimita a exportação.

## Conteúdo local privado

- `config.local.json`, arquivos `*.local.json` e variáveis da conta.
- `.local/`: vínculos de chats, estados, eventos mínimos, logs, PID, trava e backups.
- `.local/windows-launcher.json`: executável Node e opções privadas de ambiente salvas na instalação; `.local/startup-result.json`: somente horário, resultado e porta da tentativa. Logs do iniciador e do serviço são privados e podem conter caminhos da instalação; não publicar.
- Configurações e hooks existentes da conta Codex; eles nunca são exportados.
- Cadastros do NocoBase: carregados somente no painel de uso real, com a sessão e as permissões do usuário.
- Histórico Git da pasta de trabalho, relatórios, capturas e outros arquivos do ambiente de origem.

Prompts, respostas, argumentos de ferramentas, transcrições, senhas e credenciais não são persistidos pelo monitor. O coletor guarda somente IDs vinculados, metadados mínimos de eventos, estados e horários. A classificação de revisão automática consulta apenas a configuração de revisor do chat; não concede permissões nem altera essa configuração.

O serviço usa loopback e origens locais explícitas. Não guarda chave de API do NocoBase. O protocolo de reconexão executa um iniciador fixo sem argumentos recebidos da página.

O uso padrão não inicia com o Windows. Com extensão, o botão chama o iniciador; sem extensão, a pessoa abre o iniciador diretamente. Ambos usam o mesmo coletor. Desconectar encerra seu processo, preservando dados e hooks; fechar a página ou o Docker não o encerra. O parâmetro legado `-AutoStart` não é necessário para nenhum desses caminhos. Uma entrada antiga pode ser removida com `Remover-Integracao-Windows.ps1 -OnlyAutoStart`.

`check-distribution.mjs` verifica o manifesto, caminhos pessoais e IDs reais nos arquivos públicos. Ele não é um detector universal de segredos. Para compartilhar, use a pasta limpa gerada por `export.mjs` e revise qualquer conteúdo adicionado depois. `.gitignore` não remove dados que tenham sido gravados em commits anteriores: por isso a distribuição deve começar em um repositório novo.

A extensão é opcional e observa exclusivamente o clique no botão de conectar, sem ler cartões ou conversas. O host recebe somente uma ação fixa, valida a origem da extensão e encerra ao terminar. A permissão nativeMessaging é usada somente para esse iniciador. Nenhum serviço de controle inicia com o Windows. Sem extensão, não é necessário registrar hosts ou protocolos no Windows.

As versões Chromium e Firefox encaminham somente a ação fixa de iniciar. Cada navegador carrega a extensão explicitamente; nenhuma política, verificação de assinatura ou permissão do navegador é contornada. Os hosts ficam registrados somente na conta atual. Firefox inicia o coletor fora do Job Object do host, sem mantê-lo residente.
`desktop-bridges/<ID>.json` fica exclusivamente no diretório privado de dados e contém o endereço local da ponte e IDs de contexto do hook. A consulta compacta ao desktop pode retornar mensagens junto dos metadados: o monitor descarta esses campos, não os usa para inferir estado e não os salva. Somente os estados dos chats vinculados são consultados. Não há envio de mensagens, aprovação de pedidos ou leitura de transcrições por essa integração. A ponte e suas conexões terminam junto com o coletor.



Quando há pergunta pendente, read_thread fornece a estrutura de um turno com includeOutputs:false e maxOutputCharsPerItem:0. A resposta da ferramenta ainda pode carregar campos de conteúdo; o monitor não acessa esses campos e não os registra. Apenas IDs e tipos dos itens confirmam a ordem entre pergunta e nova entrada humana. Não há leitura de arquivos de transcrição. A consulta fica restrita ao chat vinculado.

O hook `PreCompact` pode fazer essa mesma leitura limitada antes da compactação e publicar `QuestionResolved` exclusivamente na fila privada. O comprovante contém apenas IDs do chat, turno e pergunta, estado do turno, horário e indicador de evento principal. Não contém a pergunta nem sua resposta. A captura pode ocorrer com o coletor desligado, mas o processo do hook termina após a consulta de até 900 ms; não há um segundo serviço residente. `PreCompact` e `PostCompact` não aprovam pedidos nem alteram a compactação.

A saúde da captura e as tentativas de recuperação ficam apenas em memória, com horários, motivos fixos e IDs vinculados. O botão Tentar novamente chama somente uma leitura restrita da mesma instância; nunca recebe comandos, caminhos, mensagens ou aprovações. A confirmação expirada muda somente a exibição, preservando o estado observado privado.
