# Cadastro de tarefas no Monitor Codex

O pacote inclui um cadastro básico vazio. Depois de prepará-lo no NocoBase 2,
o botão **Nova tarefa** permite cadastrar diretamente no Monitor Codex.
Na instalação via Codex, o agente realiza essa preparação seguindo
[INSTALAR-COM-CODEX.md](INSTALAR-COM-CODEX.md). Os passos abaixo são a alternativa manual.

## Preparar o cadastro básico

No gerenciador de coleções do NocoBase, crie uma coleção do tipo **Geral**:

- Nome técnico: `codex_monitor_tasks`.
- Título: **Tarefas do Monitor Codex**.
- Chave primária: `id`, criada automaticamente pelo NocoBase.

Adicione os campos de texto de linha única:

| Nome técnico | Título | Obrigatório |
| --- | --- | --- |
| `title` | Nome da tarefa | Sim, até 200 caracteres |
| `project` | Projeto | Não |
| `linkCodex` | Link do chat Codex | Não |

O campo de link é texto para aceitar o esquema `codex://`. O formulário valida
o ID antes de salvar. Não é necessário criar relação com outra coleção,
situação de negócio, dados de demonstração ou outra página de cadastro.

Para administradores com o CLI oficial autenticado no ambiente correto, a
definição equivalente está em `config/nocobase-tasks.json`. Execute na raiz
do pacote, consultando primeiro a ajuda da versão instalada:

```powershell
nb api data-modeling collections get --help
nb api data-modeling collections apply --help
nb api data-modeling collections get --filter-by-tk codex_monitor_tasks --appends fields -j
```

**Somente se a consulta confirmar que essa coleção não existe**, aplique:

```powershell
nb api data-modeling collections apply --body-file config/nocobase-tasks.json -j
```

Confira no resultado a coleção geral, chave `id` e os três campos. Uma falha de
autenticação, conexão ou permissão não significa que a coleção não existe.
Não use `--replace-fields`. Se já existir, confira a compatibilidade e reutilize;
não aplique o arquivo inteiro sobre um cadastro preexistente nem sobrescreva
campos. Uma incompatibilidade exige revisão antes de modificar o modelo.

Mantenha as fontes básicas incluídas nos dois blocos, configure `demo: false`
e o endpoint correto. Para o papel que utilizará o painel, conceda leitura e
criação nessa coleção e edição do campo `linkCodex`, além do acesso às páginas.
Não é necessária permissão de exclusão. A instalação não altera ACL global.

## Cadastrar e acompanhar

1. Abra **Monitor Codex** e clique em **Nova tarefa**.
2. Preencha **Nome da tarefa** e, se quiser, **Projeto**.
3. Informe o ID ou `codex://threads/ID` em **Link do chat**, ou deixe vazio.
4. Clique em **Cadastrar tarefa**.

Com link, o cadastro aparece no acompanhamento. Sem link, ele fica salvo no
NocoBase e disponível em **Escolha uma tarefa ou projeto**; selecione-o depois,
informe o link e clique em **Vincular**. O nome do projeto é apenas um rótulo,
não cria um projeto separado nem define a categoria Pessoal/Profissional do consumo.

O coletor pode estar desligado durante o cadastro. Conecte-o para confirmar
os estados. A tarefa e o link permanecem após atualizar ou sair da página.
**Atualizar link** permite trocar ou remover o vínculo sem apagar a tarefa
ou o histórico de consumo já registrado.

Na demonstração, abrir o formulário é permitido e **Cadastrar tarefa** fica
desabilitado. Nenhum dado é gravado nem é feita uma conexão para demonstrá-lo.

## Aproveitar suas coleções existentes

Se já tem tarefas/projetos, pode manter seus formulários e configurar as fontes.
Exemplo de configuração do Monitor para uma coleção própria:

```js
taskCreation: false,
sources: [
  {collection:'minhas_tarefas',label:'Tarefa',idField:'id',titleField:'titulo',linkField:'linkCodex',appends:[]},
],
```

Alinhe também `USAGE_CONFIG.sources` na página Uso do Codex. Nesse caminho,
cadastre no formulário que já usa e depois selecione o registro no Monitor.
Não é obrigatório criar `codex_monitor_tasks`.

Para usar ambos, mantenha a configuração `taskCreation` básica e adicione
suas coleções às fontes dos dois painéis. O botão **Nova tarefa** continuará
criando somente na coleção básica. Não aponte esse formulário para uma coleção
com outros campos obrigatórios ou regras de negócio sem adaptar e testar o formulário.

## Conferência da instalação

Na conta que vai usar o painel, confira: cadastrar sem link, reencontrar na lista
após recarregar, vincular um chat local, trocar/remover o link e verificar o
nome na página de consumo. Link inválido e nome vazio devem impedir o envio.
Sem permissão de criação, o formulário deve manter o que foi digitado e informar
a falha. Se a conexão cair durante o salvamento, procure a tarefa com **Atualizar**
antes de repetir o envio, pois o servidor pode já tê-la recebido.
