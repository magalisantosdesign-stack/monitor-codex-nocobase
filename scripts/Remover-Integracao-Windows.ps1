param([switch]$OnlyAutoStart)
$monitorPackageRoot = [IO.Path]::GetDirectoryName($PSScriptRoot)
$ErrorActionPreference='Stop'
$taskConfigFile=Join-Path $monitorPackageRoot '.local\windows-launcher.json'
if (-not (Test-Path -LiteralPath $taskConfigFile)) { throw 'Esta pasta nao possui uma instalacao Windows registrada.' }
$taskConfig=Get-Content -LiteralPath $taskConfigFile -Raw | ConvertFrom-Json
$taskPowerShell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskExpected='"'+$taskPowerShell+'" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $monitorPackageRoot 'scripts\Reconectar-Monitor.ps1')+'"'
$taskRunKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if (Test-Path -LiteralPath $taskRunKey) {
  $taskCurrent=(Get-Item -LiteralPath $taskRunKey).GetValue($taskConfig.runName)
  if ($taskCurrent -eq ($taskExpected+' -Quiet')) { Remove-ItemProperty -LiteralPath $taskRunKey -Name $taskConfig.runName }
  elseif ($taskCurrent) { throw 'Inicio automatico pertence a outro comando; preservado.' }
}
if (-not $OnlyAutoStart) {
  $taskProtocol='HKCU:\Software\Classes\codex-monitor'
  $taskCommandKey=Join-Path $taskProtocol 'shell\open\command'
  if (Test-Path -LiteralPath $taskCommandKey) {
    if ((Get-Item -LiteralPath $taskCommandKey).GetValue('') -ne $taskExpected) { throw 'Protocolo pertence a outro iniciador; preservado.' }
    # Remove only this exact protocol registration, never files or data.
    Remove-Item -LiteralPath $taskProtocol -Recurse
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

  }
}
Write-Output 'Integracao selecionada removida; dados e hooks preservados.'
