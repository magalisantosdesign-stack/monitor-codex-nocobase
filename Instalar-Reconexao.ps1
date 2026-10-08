param([switch]$AutoStart, [switch]$Preview)
$ErrorActionPreference = 'Stop'
$taskLauncher = Join-Path $PSScriptRoot 'Reconectar-Monitor.ps1'
$taskPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if ($env:CODEX_MONITOR_NODE) { $taskNode = & $env:CODEX_MONITOR_NODE -p 'process.execPath' }
else { $taskNode = & node -p 'process.execPath' }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $taskNode -PathType Leaf)) { throw 'Instale Node.js 22 ou superior, ou configure CODEX_MONITOR_NODE.' }
$taskMajor = & $taskNode -p 'Number(process.versions.node.match(/^[0-9]+/)[0])'
if ($LASTEXITCODE -ne 0 -or [int]$taskMajor -lt 22) { throw 'Node.js 22 ou superior e necessario.' }
if (-not (Test-Path -LiteralPath $taskLauncher) -or -not (Test-Path -LiteralPath $taskPowerShell)) { throw 'Iniciador indisponivel.' }
$taskCommand = '"' + $taskPowerShell + '" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $taskLauncher + '"'
$taskProtocol = 'HKCU:\Software\Classes\codex-monitor'
$taskCommandKey = Join-Path $taskProtocol 'shell\open\command'
$taskLegacy = '"' + (Join-Path $env:SystemRoot 'System32\wscript.exe') + '" //B //Nologo "' + (Join-Path $PSScriptRoot 'Reconectar-Monitor.vbs') + '"'
if (Test-Path -LiteralPath $taskProtocol) {
  $taskPrevious = if (Test-Path -LiteralPath $taskCommandKey) { (Get-Item -LiteralPath $taskCommandKey).GetValue('') } else { $null }
  if ($taskPrevious -ne $taskCommand -and $taskPrevious -ne $taskLegacy) { throw 'O protocolo codex-monitor pertence a outro iniciador; registro preservado.' }
}
$taskHash = [Security.Cryptography.SHA256]::Create()
try { $taskId = ([BitConverter]::ToString($taskHash.ComputeHash([Text.Encoding]::UTF8.GetBytes($PSScriptRoot))).Replace('-','').Substring(0,12)).ToLowerInvariant() } finally { $taskHash.Dispose() }
$taskRunName = 'CodexMonitor-' + $taskId
$taskRunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$taskAutoCommand = $taskCommand + ' -Quiet'
if ($AutoStart -and (Test-Path -LiteralPath $taskRunKey)) {
  $taskExisting = (Get-Item -LiteralPath $taskRunKey).GetValue($taskRunName)
  if ($taskExisting -and $taskExisting -ne $taskAutoCommand) { throw 'Entrada de inicio automatico conflitante; preservada.' }
}
if ($Preview) {
  [pscustomobject]@{Mode='preview';Node=$taskNode;Protocol='codex-monitor';AutoStart=[bool]$AutoStart;Command=$taskCommand} | ConvertTo-Json
  exit 0
}
$taskLocal = Join-Path $PSScriptRoot '.local'
New-Item -ItemType Directory -Force -Path $taskLocal | Out-Null
$taskEnvironment = @{}
foreach ($taskName in @('CODEX_HOME','CODEX_MONITOR_CONFIG','CODEX_MONITOR_DATA','CODEX_MONITOR_PORT','CODEX_MONITOR_SETTINGS')) {
  $taskValue = [Environment]::GetEnvironmentVariable($taskName,'Process')
  if ($taskValue) { $taskEnvironment[$taskName] = $taskValue }
}
@{node=[string]$taskNode;environment=$taskEnvironment;runName=$taskRunName} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $taskLocal 'windows-launcher.json') -Encoding utf8
New-Item -Path $taskCommandKey -Force | Out-Null
Set-Item -LiteralPath $taskProtocol -Value 'URL:Monitor Codex'
New-ItemProperty -LiteralPath $taskProtocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath $taskProtocol -Name 'FriendlyAppName' -Value 'Monitor Codex' -PropertyType String -Force | Out-Null
# No %1: web URIs never supply commands or arguments.
Set-Item -LiteralPath $taskCommandKey -Value $taskCommand
if ((Get-Item -LiteralPath $taskCommandKey).GetValue('') -ne $taskCommand) { throw 'Registro nao confirmado.' }
if ($AutoStart) {
  New-Item -Path $taskRunKey -Force | Out-Null
  New-ItemProperty -LiteralPath $taskRunKey -Name $taskRunName -Value $taskAutoCommand -PropertyType String -Force | Out-Null
}

# Tell the Windows shell that an owned protocol association changed.
# Registry writes alone do not invalidate every application's association cache.
if (-not ('CodexMonitorShell' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CodexMonitorShell {
 [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint change, uint flags, IntPtr first, IntPtr second);
}
'@
}
[CodexMonitorShell]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)

Write-Output 'Reconexao instalada para esta conta. Node resolvido e salvo em .local\windows-launcher.json.'
if ($AutoStart) { Write-Output 'Inicio automatico ativado no login do Windows. Desative com Remover-Integracao-Windows.ps1 -OnlyAutoStart.' }
