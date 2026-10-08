param([string]$ExtensionOrigin, [string]$ParentWindow, [string]$NativeManifest, [string]$FirefoxExtensionId)
$ErrorActionPreference = 'Stop'
$taskInput = [IO.BinaryReader]::new([Console]::OpenStandardInput())
$taskOutput = [IO.BinaryWriter]::new([Console]::OpenStandardOutput())
$taskReply = @{ok=$false;code='INVALID_REQUEST'}
try {
  $taskManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'chrome-extension\manifest.json') -Raw | ConvertFrom-Json
  $taskHash=[Security.Cryptography.SHA256]::Create()
  try {$taskDigest=$taskHash.ComputeHash([Convert]::FromBase64String($taskManifest.key))} finally {$taskHash.Dispose()}
  $taskId=-join ([BitConverter]::ToString($taskDigest).Replace('-','').Substring(0,32).ToLowerInvariant().ToCharArray() | ForEach-Object {[char](97+[Convert]::ToInt32([string]$_,16))})
  $taskFirefox=$false
  if($NativeManifest -or $FirefoxExtensionId) {
    $taskFirefoxManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'firefox-extension\manifest.json') -Raw | ConvertFrom-Json
    $taskExpectedManifest=Join-Path $PSScriptRoot '.local\firefox-native-host.json'
    if(-not $NativeManifest -or -not [IO.Path]::IsPathRooted($NativeManifest) -or [IO.Path]::GetFullPath($NativeManifest) -ne [IO.Path]::GetFullPath($taskExpectedManifest) -or $FirefoxExtensionId -ne $taskFirefoxManifest.browser_specific_settings.gecko.id -or $ExtensionOrigin) {throw 'INVALID_ORIGIN'}
    $taskFirefox=$true
  } elseif ($ExtensionOrigin -ne ('chrome-extension://'+$taskId+'/')) {throw 'INVALID_ORIGIN'}
  $taskLength=$taskInput.ReadUInt32()
  if ($taskLength -lt 1 -or $taskLength -gt 1024) {throw 'INVALID_REQUEST'}
  $taskBytes=$taskInput.ReadBytes([int]$taskLength)
  if ($taskBytes.Length -ne $taskLength) {throw 'INVALID_REQUEST'}
  $taskMessage=[Text.Encoding]::UTF8.GetString($taskBytes) | ConvertFrom-Json
  if ($taskMessage.action -ne 'start' -or @($taskMessage.PSObject.Properties).Count -ne 1) {throw 'INVALID_REQUEST'}
  $taskLocal=Join-Path $PSScriptRoot '.local'
  $taskConfig=Get-Content -LiteralPath (Join-Path $taskLocal 'windows-launcher.json') -Raw | ConvertFrom-Json
  if (-not [IO.Path]::IsPathRooted($taskConfig.node) -or -not (Test-Path -LiteralPath $taskConfig.node -PathType Leaf)) {throw 'NODE_UNAVAILABLE'}
  foreach($taskProperty in $taskConfig.environment.PSObject.Properties) {
    if($taskProperty.Name -in @('CODEX_HOME','CODEX_MONITOR_CONFIG','CODEX_MONITOR_DATA','CODEX_MONITOR_PORT','CODEX_MONITOR_SETTINGS')) {[Environment]::SetEnvironmentVariable($taskProperty.Name,[string]$taskProperty.Value,'Process')}
  }
  Add-Content -LiteralPath (Join-Path $taskLocal 'native-launcher.log') -Value ((Get-Date).ToUniversalTime().ToString('o')+' START')
  Set-Location -LiteralPath $PSScriptRoot
  if($taskFirefox) {
    . (Join-Path $PSScriptRoot 'Iniciar-ForaDoJob.ps1')
    $taskExit=Start-MonitorOutsideJob -NodePath $taskConfig.node -LauncherPath (Join-Path $PSScriptRoot 'Iniciar-Monitor.mjs') -WorkingDirectory $PSScriptRoot
  } else {
    $ErrorActionPreference='Continue'
    $taskResult=& $taskConfig.node (Join-Path $PSScriptRoot 'Iniciar-Monitor.mjs') 2>&1
    $taskExit=$LASTEXITCODE
    $ErrorActionPreference='Stop'
  }
  if($taskExit -ne 0) {throw 'START_FAILED'}
  $taskReply=@{ok=$true}
} catch {
  $taskCode=$_.Exception.Message
  if($taskCode -notin @('INVALID_ORIGIN','INVALID_REQUEST','NODE_UNAVAILABLE','START_FAILED')) {$taskCode='BRIDGE_UNAVAILABLE'}
  $taskReply=@{ok=$false;code=$taskCode}
}
$taskJson=[Text.Encoding]::UTF8.GetBytes(($taskReply | ConvertTo-Json -Compress))
$taskOutput.Write([uint32]$taskJson.Length)
$taskOutput.Write($taskJson)
$taskOutput.Flush()
# One short-lived host per click; no resident controller or startup task.
