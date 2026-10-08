param([ValidateSet('Chrome','Edge','Brave','Opera','Firefox')][string[]]$Browsers=@('Chrome','Edge','Brave','Opera','Firefox'), [switch]$Preview)
$monitorPackageRoot = [IO.Path]::GetDirectoryName($PSScriptRoot)
$ErrorActionPreference='Stop'
$taskLocal=Join-Path $monitorPackageRoot '.local'
$taskChromiumManifest=Join-Path $taskLocal 'chrome-native-host.json'
$taskFirefoxManifest=Join-Path $taskLocal 'firefox-native-host.json'
$taskMap=@{
 Chrome='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
 Edge='HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\local.codex_monitor'
 Brave='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
 Opera='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
 Firefox='HKCU:\Software\Mozilla\NativeMessagingHosts\local.codex_monitor'
}
$taskRegistrations=@{}
foreach($taskBrowser in $Browsers) {
 $taskRegistry=$taskMap[$taskBrowser]
 $taskExpected=if($taskBrowser -eq 'Firefox'){$taskFirefoxManifest}else{$taskChromiumManifest}
 if(Test-Path -LiteralPath $taskRegistry) {
  if((Get-Item -LiteralPath $taskRegistry).GetValue('') -ne $taskExpected) {throw ('Ponte de outra instalação para '+$taskBrowser+'; registros preservados.')}
 }
 $taskRegistrations[$taskRegistry]=$taskExpected
}
$taskManifest=Get-Content -LiteralPath (Join-Path $monitorPackageRoot 'extensions\chromium\manifest.json') -Raw | ConvertFrom-Json
$taskHash=[Security.Cryptography.SHA256]::Create()
try {$taskDigest=$taskHash.ComputeHash([Convert]::FromBase64String($taskManifest.key))} finally {$taskHash.Dispose()}
$taskId=-join ([BitConverter]::ToString($taskDigest).Replace('-','').Substring(0,32).ToLowerInvariant().ToCharArray() | ForEach-Object {[char](97+[Convert]::ToInt32([string]$_,16))})
$taskGecko=Get-Content -LiteralPath (Join-Path $monitorPackageRoot 'extensions\firefox\manifest.json') -Raw | ConvertFrom-Json
if($Preview) {
 [pscustomobject]@{Mode='preview';Browsers=$Browsers;ChromiumId=$taskId;FirefoxId=$taskGecko.browser_specific_settings.gecko.id;Registry=$taskRegistrations;AutoStart=$false} | ConvertTo-Json -Depth 4
 return
}
if(-not (Test-Path -LiteralPath (Join-Path $taskLocal 'windows-launcher.json'))) {& (Join-Path $monitorPackageRoot 'scripts\Instalar-Reconexao.ps1') | Out-Null}
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
$taskCmd=Join-Path $taskLocal 'chrome-native-host.cmd'
$taskCommand='@echo off' + "`r`n" + '"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\Chrome-Monitor.ps1" -ExtensionOrigin "%~1"' + "`r`n"
[IO.File]::WriteAllText($taskCmd,$taskCommand,[Text.Encoding]::ASCII)
$taskHost=@{name='local.codex_monitor';description='Iniciador local do Monitor Codex';path=$taskCmd;type='stdio';allowed_origins=@('chrome-extension://'+$taskId+'/')}
[IO.File]::WriteAllText($taskChromiumManifest,($taskHost | ConvertTo-Json -Depth 3),[Text.UTF8Encoding]::new($false))
if($Browsers -contains 'Firefox') {
 $taskFirefoxCmd=Join-Path $taskLocal 'firefox-native-host.cmd'
 $taskFirefoxCommand='@echo off' + "`r`n" + '"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\Chrome-Monitor.ps1" -NativeManifest "%~1" -FirefoxExtensionId "%~2"' + "`r`n"
 [IO.File]::WriteAllText($taskFirefoxCmd,$taskFirefoxCommand,[Text.Encoding]::ASCII)
 $taskFirefoxHost=@{name='local.codex_monitor';description='Iniciador local do Monitor Codex';path=$taskFirefoxCmd;type='stdio';allowed_extensions=@($taskGecko.browser_specific_settings.gecko.id)}
 [IO.File]::WriteAllText($taskFirefoxManifest,($taskFirefoxHost | ConvertTo-Json -Depth 3),[Text.UTF8Encoding]::new($false))
}
foreach($taskRegistry in $taskRegistrations.Keys) {
 New-Item -Path $taskRegistry -Force | Out-Null
 Set-Item -LiteralPath $taskRegistry -Value $taskRegistrations[$taskRegistry]
 if((Get-Item -LiteralPath $taskRegistry).GetValue('') -ne $taskRegistrations[$taskRegistry]) {throw 'Registro da ponte não confirmado.'}
}
Write-Output ('Ponte registrada sem inicio automatico para: '+($Browsers -join ', ')+'. Carregue a extensao indicada em NAVEGADORES.md.')
