# Conexão nos navegadores — Windows

O painel é uma página do NocoBase. A extensão permite que **Conectar monitor**
inicie o script local em segundo plano. O script encerra após confirmar o Node;
**Desconectar monitor** encerra somente esse coletor. Nada inicia com o Windows.
Fechar o navegador sozinho não encerra o coletor: use Desconectar.

A extensão é opcional. Para usar sem ela, abra `Iniciar-Monitor.cmd` e clique
em **Atualizar** no painel; **Desconectar monitor** funciona nos dois caminhos.
Veja a preparação comum e o caminho sem extensão no [README.md](../README.md).

## Preparar a ponte

Na pasta instalada, execute:

```powershell
.\scripts/Instalar-Ponte-Navegadores.ps1 -Preview
.\scripts/Instalar-Ponte-Navegadores.ps1
```

O primeiro comando mostra a prévia. O segundo registra os hosts da conta atual
para Chrome/Brave/Opera, Edge e Firefox. Não exige administrador, instala a
extensão nem altera políticas ou permissões do navegador. Para selecionar:

```powershell
.\scripts/Instalar-Ponte-Navegadores.ps1 -Browsers Chrome,Edge
```

O comando antigo `scripts/Instalar-Ponte-Chrome.ps1` permanece válido para Chrome.
Node 22+ precisa estar instalado. Configurações e caminhos privados ficam em
`.local/` e não acompanham a distribuição.

## Carregar a extensão

| Navegador no Windows | Pacote | Tela de instalação |
| --- | --- | --- |
| Chrome | `extensions/chromium` | `chrome://extensions` |
| Edge | `extensions/chromium` | `edge://extensions` |
| Brave | `extensions/chromium` | `brave://extensions` |
| Opera / Opera GX | `extensions/chromium` | `opera://extensions` |
| Firefox 140+ | `extensions/firefox` | `about:debugging#/runtime/this-firefox`, para teste |

Nos navegadores Chromium, ative o modo do desenvolvedor e use **Carregar sem
compactação** selecionando a pasta da tabela. Recarregue a extensão quando seu
código mudar, atualize a página do NocoBase e clique em Conectar monitor.

No Firefox, **Carregar extensão temporária** permite selecionar
`extensions/firefox/manifest.json` para desenvolvimento. Essa instalação some
ao fechar o Firefox. Para distribuição permanente, o pacote precisa ser
assinado pela Mozilla; pode ser distribuído no GitHub como XPI assinado, sem
listagem pública na loja. Não desative a verificação de assinaturas.

Os dois pacotes têm o mesmo código de comunicação; variam o manifesto, o ID e
o host nativo. O ID Chromium permanece fixo na instalação sem compactação. Se
uma publicação em loja atribuir outro ID, será necessário ajustar a lista de
extensões permitidas e testar novamente; a versão atual não autoriza IDs extras.

## Endereço do NocoBase

Os pacotes incluem somente `http://127.0.0.1:13000` e
`http://localhost:13000`. Outra porta exige ajustar **matches** no manifesto e
**allowedOrigins** em `background.js` dos dois pacotes, além da configuração
`origins` do coletor. Não use acesso a todos os sites nem curingas de origem.

## Safari, outros sistemas e dispositivos

Esta distribuição conecta pelo botão no **Windows**. O Safari precisa de uma
extensão acompanhada por um aplicativo macOS e um iniciador para esse sistema;
o script PowerShell/CMD deste pacote não fornece essa integração. Não há suporte
à ponte Safari, macOS, Linux ou navegadores móveis nesta versão. O coletor Node
tem configuração portátil, mas isso não torna a ponte Windows multiplataforma.

## Verificação e remoção

Teste Conectar, Desconectar, nova conexão e novo clique após reiniciar o Windows.
Confirme **Coletor conectado** no painel. Instalar o host ou passar nos testes
isolados não comprova que a extensão está carregada no navegador escolhido.
Os testes automatizados cobrem callbacks Chromium, Promises Firefox, registros
simulados, proteção de instalação de outra pasta e encerramento/início em dados
fictícios. A publicação nas lojas e a assinatura Firefox ainda não foram feitas.

Para remover os registros de propriedade comprovada:

```powershell
.\scripts/Remover-Ponte-Navegadores.ps1 -Preview
.\scripts/Remover-Ponte-Navegadores.ps1
```

Depois remova a extensão em cada navegador. Chrome/Brave/Opera compartilham o
registro do host; remover esse registro afeta os três. Edge e Firefox têm
registros próprios. Remoção preserva dados, hooks e coletor; use Desconectar
antes, se quiser encerrá-lo. Nunca substitua o registro pertencente a outra
instalação.

## Referências oficiais

- [Native Messaging no Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Native Messaging no Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging)
- [Native Messaging no Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)
- [Diferenças do Firefox e persistência do processo](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#app_persistence)
- [Assinatura e distribuição Firefox](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Extensões no Brave](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave)
- [Native Messaging no Opera](https://help.opera.com/en/extensions/message-passing/)
- [Comunicação nativa no Safari](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension)

## Teste real disponível

`npm run test:edge` testa a extensão no Edge instalado usando perfil, página, porta, dados e registro nativo de teste isolados; ao finalizar, encerra o navegador criado e remove seu registro temporário. Não usa perfil pessoal. Se Edge não estiver instalado, informa SKIP. Esse teste passou nesta entrega. O uso no Chrome também foi confirmado, incluindo a ausência de processo, PID e listener do coletor após desconectar. Brave/Opera/Firefox ainda exigem verificação no navegador real escolhido. O teste Firefox com Job Object Windows confirmou que o coletor sobrevive ao host e encerra via shutdown. Um reinício físico do Windows com a ponte atual ainda precisa ser validado.
