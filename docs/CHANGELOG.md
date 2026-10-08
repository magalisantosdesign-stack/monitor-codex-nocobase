# Histórico de versões

## 0.6.4 — 2026-10-08

- Separação de código, testes, scripts, extensões e documentação em pastas.
- Caminhos de inicialização, hooks, Native Messaging e exportação atualizados; configuração e dados privados permanecem na raiz.
- Atalhos CMD preservados e guia de atualização da instalação anterior.

## 0.6.3 — 08/10/2026

- Separa estado observado da confirmação atual da captura; sinaliza Estado não confirmado e preserva o último estado sem inventar conclusão ou pedido pendente.
- Recupera automaticamente leituras, usa contexto do próprio chat quando necessário e evita que uma conexão indisponível bloqueie os outros cartões.
- Acrescenta Tentar novamente no cartão, com leitura restrita ao vínculo/instância, sem terminal, reinstalação ou autorização de ferramentas.
- Recupera início de turno não observado a partir de metadados atuais, descartando snapshots antigos e turnos aposentados.
- Revalida estados depois de reiniciar e testa compactação sem IDs, falha/retorno da fonte, Stand-by, privacidade e ciclo manual.

## 0.6.2 — 08/10/2026

- Acrescenta `PreCompact` e `PostCompact` para preservar uma confirmação observada de resposta antes de resumir o chat.
- Guarda somente IDs, estado do turno e horário em um comprovante interno, recuperável após reiniciar o coletor; funciona para chats vinculados mesmo com o coletor desligado.
- Mantém perguntas pendentes se não houver confirmação, se a ponte falhar ou se a consulta exceder 900 ms; compactação e ausência de IDs não liberam pendências.
- Inclui testes de captura pelo hook real em ponte sintética, compactação com coletor desligado, reinício sem os IDs e preservação de handlers de terceiros.
- Os novos hooks precisam ser carregados e confiados no Codex; a validação sintética não comprova sua ativação no aplicativo real.

## 0.6.1 — 08/10/2026

- Corrige perguntas respondidas dentro do mesmo turno que permaneciam como Aguardando resposta.
- Acrescenta reconciliação automática com os estados do Codex desktop pela ponte local, com proteção contra snapshots antigos e sem guardar conteúdo das conversas.
- Confirma respostas pela ordem dos IDs de pergunta e entrada humana; trabalho paralelo e compactação não comprovam uma resposta.
- A compatibilidade dessa ponte depende da versão do Codex desktop; sem ela, permanecem os eventos dos hooks. Nenhum serviço adicional ou início com Windows é instalado.

## 0.6.0 — 08/10/2026

- Conexão manual por botão com extensão opcional e ponte Native Messaging no Windows.
- Pacotes Chromium (Chrome, Edge, Brave, Opera/GX) e Firefox; instalação permanente Firefox depende de assinatura ainda não fornecida.
- Script local inicia o Node em segundo plano e encerra após a inicialização. Sem início automático com o Windows ou controlador residente.
- Desconectar monitor encerra somente o coletor da instância confirmada, preservando vínculos, estados e Stand-by.
- Uso sem extensão por `Iniciar-Monitor.cmd` ou `node scripts/Iniciar-Monitor.mjs`. Atualizar retoma consultas após um início manual, sem executar comandos locais.
- Orientações separadas para os dois caminhos, diagnóstico e remoção da ponte.
- Testes de ciclo de vida, ponte, APIs dos navegadores e persistência do Node no Job Object Firefox. Teste real isolado Edge e confirmação de uso no Chrome; reinício físico com a ponte atual ainda pendente.
- Distribuição com demonstração fictícia e exportação por manifesto explícito, sem dados ou configurações pessoais.

