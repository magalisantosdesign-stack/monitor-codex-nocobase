param([ValidateSet('Chrome','Edge','Brave','Opera','Firefox')][string[]]$Browsers=@('Chrome','Edge','Brave','Opera','Firefox'),[switch]$Preview)
$ErrorActionPreference='Stop'
$taskMap=@{
 Chrome='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
 Edge='HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\local.codex_monitor'
 Brave='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
 Opera='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
 Firefox='HKCU:\Software\Mozilla\NativeMessagingHosts\local.codex_monitor'
}
$taskOwned=@()
foreach($taskBrowser in $Browsers) {
 $taskRegistry=$taskMap[$taskBrowser]
 $taskExpected=Join-Path $PSScriptRoot $(if($taskBrowser -eq 'Firefox'){'.local\firefox-native-host.json'}else{'.local\chrome-native-host.json'})
 if(Test-Path -LiteralPath $taskRegistry) {
  if((Get-Item -LiteralPath $taskRegistry).GetValue('') -ne $taskExpected) {throw 'Ponte de outra instalação; registros preservados.'}
  $taskOwned+=$taskRegistry
 }
}
if($Preview) { [pscustomobject]@{Mode='preview';Registry=@($taskOwned | Select-Object -Unique)} | ConvertTo-Json;return }
foreach($taskRegistry in @($taskOwned | Select-Object -Unique)) { Remove-Item -LiteralPath $taskRegistry }
Write-Output 'Registros desta ponte removidos. Dados, hooks e coletor preservados. Chrome/Brave/Opera compartilham o mesmo registro; remova as extensoes nos navegadores.'
