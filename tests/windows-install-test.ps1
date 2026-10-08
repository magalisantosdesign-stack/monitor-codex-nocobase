param([Parameter(Mandatory=$true)][string]$InstallRoot, [switch]$OnlyPreview)
$ErrorActionPreference='Stop'
# The registry is replaced by memory-only cmdlets for this entire test process.
# No real protocol or Windows startup entry is installed.
$global:monitorTestRegistry=@{}
# Simulate the notification too: tests never refresh the real shell cache.
Add-Type -TypeDefinition @'
using System;
public static class CodexMonitorShell {
 public static int Notifications=0;
 public static void SHChangeNotify(uint change,uint flags,IntPtr first,IntPtr second){Notifications++;}
}
'@
function Test-Path {
  param([string]$LiteralPath,[string]$Path,[string]$PathType)
  $target=if($LiteralPath){$LiteralPath}else{$Path}
  if($target -like 'HKCU:*'){return $global:monitorTestRegistry.ContainsKey($target)}
  if($PathType){return Microsoft.PowerShell.Management\Test-Path -LiteralPath $target -PathType $PathType}
  return Microsoft.PowerShell.Management\Test-Path -LiteralPath $target
}
function New-Item {
  param([string]$Path,[string]$LiteralPath,[string]$ItemType,[switch]$Force)
  $target=if($LiteralPath){$LiteralPath}else{$Path}
  if($target -like 'HKCU:*'){
    while($target -like 'HKCU:*'){
      if(-not $global:monitorTestRegistry.ContainsKey($target)){$global:monitorTestRegistry[$target]=@{}}
      $next=Split-Path $target -Parent;if($next -eq $target){break};$target=$next
    }
    return
  }
  Microsoft.PowerShell.Management\New-Item -Path $target -ItemType $ItemType -Force:$Force
}
function Get-Item {
  param([string]$LiteralPath,[string]$Path)
  $target=if($LiteralPath){$LiteralPath}else{$Path}
  if($target -like 'HKCU:*'){
    $value=[pscustomobject]@{Values=$global:monitorTestRegistry[$target]}
    $value | Add-Member -MemberType ScriptMethod -Name GetValue -Value {param($name) return $this.Values[$name]}
    return $value
  }
  Microsoft.PowerShell.Management\Get-Item -LiteralPath $target
}
function Set-Item {
  param([string]$LiteralPath,[string]$Value)
  if($LiteralPath -notlike 'HKCU:*'){throw 'Test forbids unexpected Set-Item'}
  $global:monitorTestRegistry[$LiteralPath]['']=$Value
}
function New-ItemProperty {
  param([string]$LiteralPath,[string]$Name,[string]$Value,[string]$PropertyType,[switch]$Force)
  if($LiteralPath -notlike 'HKCU:*'){throw 'Test forbids unexpected New-ItemProperty'}
  $global:monitorTestRegistry[$LiteralPath][$Name]=$Value
}
function Remove-ItemProperty {
  param([string]$LiteralPath,[string]$Name)
  if($LiteralPath -notlike 'HKCU:*'){throw 'Test forbids unexpected Remove-ItemProperty'}
  $global:monitorTestRegistry[$LiteralPath].Remove($Name)
}
function Remove-Item {
  param([string]$LiteralPath,[switch]$Recurse)
  if($LiteralPath -notlike 'HKCU:*'){throw 'Test forbids all filesystem deletion'}
  foreach($key in @($global:monitorTestRegistry.Keys)){if($key -eq $LiteralPath -or $key.StartsWith($LiteralPath+'\')){$global:monitorTestRegistry.Remove($key)}}
}
function Assert-True {param($Condition,[string]$Message) if(-not $Condition){throw $Message}}
$protocol='HKCU:\Software\Classes\codex-monitor'
$commandKey=$protocol+'\shell\open\command'
$runKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$installer=Join-Path $InstallRoot 'scripts\Instalar-Reconexao.ps1'
$remover=Join-Path $InstallRoot 'scripts\Remover-Integracao-Windows.ps1'
if ($OnlyPreview) {
  & $installer -AutoStart -Preview
  Assert-True ($global:monitorTestRegistry.Count -eq 0) 'Preview wrote the simulated registry'
  Assert-True ([CodexMonitorShell]::Notifications -eq 0) 'Preview notified the shell'
  exit 0
}
& $installer -AutoStart | Out-Null
$command=$global:monitorTestRegistry[$commandKey]['']
Assert-True ($command.Contains('scripts\Reconectar-Monitor.ps1') -and -not $command.Contains('%1')) 'Protocol command must be fixed with no URI input'
$private=Get-Content (Join-Path $InstallRoot '.local\windows-launcher.json') -Raw | ConvertFrom-Json
Assert-True ($global:monitorTestRegistry[$runKey][$private.runName] -eq ($command+' -Quiet')) 'Logon command incorrect'
& $installer -AutoStart | Out-Null
Assert-True ($global:monitorTestRegistry[$runKey].Count -eq 1) 'Repeated installation duplicated startup entry'
# Simulate the exact previous layout of this installation, in memory only.
$legacyCommand=$command.Replace((Join-Path $InstallRoot 'scripts\Reconectar-Monitor.ps1'),(Join-Path $InstallRoot 'Reconectar-Monitor.ps1'))
$global:monitorTestRegistry[$commandKey]['']=$legacyCommand
$global:monitorTestRegistry[$runKey][$private.runName]=$legacyCommand+' -Quiet'
& $installer -AutoStart | Out-Null
Assert-True ($global:monitorTestRegistry[$commandKey][''] -eq $command) 'Owned legacy protocol did not migrate'
Assert-True ($global:monitorTestRegistry[$runKey][$private.runName] -eq ($command+' -Quiet')) 'Owned legacy startup command did not migrate'
$notifiedBeforeRemoval=[CodexMonitorShell]::Notifications
& $remover -OnlyAutoStart | Out-Null
Assert-True ([CodexMonitorShell]::Notifications -eq $notifiedBeforeRemoval) 'Startup-only removal notified an unchanged protocol'
Assert-True ($global:monitorTestRegistry[$runKey].Count -eq 0 -and $global:monitorTestRegistry.ContainsKey($commandKey)) 'Startup-only removal changed protocol'
& $remover | Out-Null
Assert-True ([CodexMonitorShell]::Notifications -eq ($notifiedBeforeRemoval+1)) 'Protocol removal did not notify the shell'
Assert-True (-not $global:monitorTestRegistry.ContainsKey($protocol)) 'Owned protocol was not removed'
$global:monitorTestRegistry[$protocol]=@{}
$global:monitorTestRegistry[$commandKey]=@{''='foreign-command'}
$rejected=$false
try{& $installer -AutoStart | Out-Null}catch{$rejected=$true}
Assert-True ($rejected -and $global:monitorTestRegistry[$commandKey][''] -eq 'foreign-command') 'Foreign protocol was overwritten'
Assert-True ($notifiedBeforeRemoval -eq 3) 'Each protocol registration must notify the shell'
Write-Output 'PASS: memory-only registry install, idempotency, startup removal and conflict protection.'
