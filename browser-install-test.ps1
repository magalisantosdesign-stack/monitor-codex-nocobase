param([Parameter(Mandatory=$true)][string]$InstallRoot)
$ErrorActionPreference='Stop'
# Registry cmdlets are mocked for the whole test. No browser is installed or
# changed; this script operates only on a synthetic installation directory.
$global:monitorBridgeRegistry=@{}
function Test-Path {
 param([string]$LiteralPath,[string]$Path,[string]$PathType)
 $taskTarget=if($LiteralPath){$LiteralPath}else{$Path}
 if($taskTarget -like 'HKCU:*'){return $global:monitorBridgeRegistry.ContainsKey($taskTarget)}
 if($PathType){return Microsoft.PowerShell.Management\Test-Path -LiteralPath $taskTarget -PathType $PathType}
 return Microsoft.PowerShell.Management\Test-Path -LiteralPath $taskTarget
}
function Get-Item {
 param([string]$LiteralPath)
 if($LiteralPath -notlike 'HKCU:*'){return Microsoft.PowerShell.Management\Get-Item -LiteralPath $LiteralPath}
 $taskItem=[pscustomobject]@{Values=$global:monitorBridgeRegistry[$LiteralPath]}
 $taskItem | Add-Member -MemberType ScriptMethod -Name GetValue -Value {param($name) return $this.Values[$name]}
 return $taskItem
}
function New-Item {
 param([string]$Path,[string]$ItemType,[switch]$Force)
 if($Path -like 'HKCU:*'){if(-not $global:monitorBridgeRegistry.ContainsKey($Path)){$global:monitorBridgeRegistry[$Path]=@{}};return}
 Microsoft.PowerShell.Management\New-Item -Path $Path -ItemType $ItemType -Force:$Force
}
function Set-Item {
 param([string]$LiteralPath,[string]$Value)
 if($LiteralPath -notlike 'HKCU:*'){throw 'Unexpected registry target'}
 $global:monitorBridgeRegistry[$LiteralPath]['']=$Value
}
function Remove-Item {
 param([string]$LiteralPath)
 if($LiteralPath -notlike 'HKCU:*'){throw 'Test forbids filesystem deletion'}
 $global:monitorBridgeRegistry.Remove($LiteralPath)
}
function Assert-True {param($Condition,[string]$Message) if(-not $Condition){throw $Message}}
$taskInstaller=Join-Path $InstallRoot 'Instalar-Ponte-Navegadores.ps1'
$taskRemover=Join-Path $InstallRoot 'Remover-Ponte-Navegadores.ps1'
$taskChrome='HKCU:\Software\Google\Chrome\NativeMessagingHosts\local.codex_monitor'
$taskEdge='HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\local.codex_monitor'
$taskFirefox='HKCU:\Software\Mozilla\NativeMessagingHosts\local.codex_monitor'
$taskLocal=Join-Path $InstallRoot '.local'
$taskConfig=Get-Content -LiteralPath (Join-Path $taskLocal 'windows-launcher.json') -Raw
& $taskInstaller -Preview | Out-Null
Assert-True ($global:monitorBridgeRegistry.Count -eq 0) 'Preview modified registry'
Assert-True (-not (Test-Path -LiteralPath (Join-Path $taskLocal 'chrome-native-host.json'))) 'Preview created native host'
& $taskInstaller | Out-Null
Assert-True ($global:monitorBridgeRegistry.Count -eq 3) 'Browsers must share exactly three user registry entries'
Assert-True ($global:monitorBridgeRegistry.ContainsKey($taskChrome) -and $global:monitorBridgeRegistry.ContainsKey($taskEdge) -and $global:monitorBridgeRegistry.ContainsKey($taskFirefox)) 'Missing browser host'
Assert-True ((Get-Content -LiteralPath (Join-Path $taskLocal 'windows-launcher.json') -Raw) -eq $taskConfig) 'Installation changed private launcher configuration'
$taskChromiumHost=Get-Content -LiteralPath (Join-Path $taskLocal 'chrome-native-host.json') -Raw | ConvertFrom-Json
$taskGeckoHost=Get-Content -LiteralPath (Join-Path $taskLocal 'firefox-native-host.json') -Raw | ConvertFrom-Json
Assert-True ($taskChromiumHost.allowed_origins.Count -eq 1 -and -not $taskChromiumHost.allowed_extensions) 'Chromium allowlist incorrect'
Assert-True ($taskGeckoHost.allowed_extensions.Count -eq 1 -and -not $taskGeckoHost.allowed_origins) 'Firefox allowlist incorrect'
& $taskInstaller | Out-Null
Assert-True ($global:monitorBridgeRegistry.Count -eq 3) 'Repeated installation duplicated entries'
& (Join-Path $InstallRoot 'Instalar-Ponte-Chrome.ps1') -Preview | Out-Null
Assert-True ($global:monitorBridgeRegistry.Count -eq 3) 'Compatibility preview modified registry'
& $taskRemover -Preview | Out-Null
Assert-True ($global:monitorBridgeRegistry.Count -eq 3) 'Removal preview modified registry'
& $taskRemover -Browsers Edge | Out-Null
Assert-True (-not $global:monitorBridgeRegistry.ContainsKey($taskEdge) -and $global:monitorBridgeRegistry.Count -eq 2) 'Edge removal affected other browsers'
$global:monitorBridgeRegistry[$taskFirefox]['']='foreign-manifest'
$taskRejected=$false
try {& $taskInstaller | Out-Null} catch {$taskRejected=$true}
Assert-True ($taskRejected -and -not $global:monitorBridgeRegistry.ContainsKey($taskEdge)) 'Foreign owner must reject before any registration is written'
$taskRejected=$false
try {& $taskRemover | Out-Null} catch {$taskRejected=$true}
Assert-True ($taskRejected -and $global:monitorBridgeRegistry.ContainsKey($taskChrome)) 'Removal must preserve all entries on owner conflict'
$global:monitorBridgeRegistry[$taskFirefox]['']=Join-Path $taskLocal 'firefox-native-host.json'
& $taskRemover | Out-Null
Assert-True ($global:monitorBridgeRegistry.Count -eq 0) 'Owned hosts not removed'
Assert-True (Test-Path -LiteralPath (Join-Path $taskLocal 'windows-launcher.json')) 'Removal deleted launcher config'
Write-Output 'PASS: browser registry preview, sharing, preservation, idempotency and foreign owner protection; no real registry writes.'
