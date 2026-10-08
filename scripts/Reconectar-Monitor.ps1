param([switch]$Quiet, [switch]$Diagnose)
$monitorPackageRoot = [IO.Path]::GetDirectoryName($PSScriptRoot)
$ErrorActionPreference = 'Stop'
$taskLocal = Join-Path $monitorPackageRoot '.local'
$taskLog = Join-Path $taskLocal 'windows-launcher.log'
try {
  New-Item -ItemType Directory -Force -Path $taskLocal | Out-Null
  $taskConfig = Get-Content -LiteralPath (Join-Path $taskLocal 'windows-launcher.json') -Raw | ConvertFrom-Json
  if (-not (Test-Path -LiteralPath $taskConfig.node -PathType Leaf)) { throw 'Node instalado nao foi encontrado. Execute novamente Instalar-Reconexao.ps1.' }
  foreach ($taskProperty in $taskConfig.environment.PSObject.Properties) {
    if ($taskProperty.Name -in @('CODEX_HOME','CODEX_MONITOR_CONFIG','CODEX_MONITOR_DATA','CODEX_MONITOR_PORT','CODEX_MONITOR_SETTINGS')) {
      [Environment]::SetEnvironmentVariable($taskProperty.Name, [string]$taskProperty.Value, 'Process')
    }
  }
  Set-Location -LiteralPath $monitorPackageRoot
  if ($Diagnose) {
    & $taskConfig.node (Join-Path $monitorPackageRoot 'scripts\Diagnosticar-Monitor.mjs')
    exit $LASTEXITCODE
  }
  Add-Content -LiteralPath $taskLog -Value ((Get-Date).ToUniversalTime().ToString('o') + ' START')
  $taskPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $taskConfig.node (Join-Path $monitorPackageRoot 'scripts\Iniciar-Monitor.mjs') 2>&1 | Out-File -LiteralPath $taskLog -Append -Encoding utf8
  $taskExit = $LASTEXITCODE
  $ErrorActionPreference = $taskPreference
  if ($taskExit -ne 0) { throw 'O coletor nao confirmou a conexao. Execute Diagnosticar-Monitor.cmd nesta pasta e confira .local\windows-launcher.log.' }
} catch {
  $taskMessage = $_.Exception.Message
  try { Add-Content -LiteralPath $taskLog -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ERROR: ' + $taskMessage) } catch {}
  if (-not $Quiet) {
    try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($taskMessage,'Monitor Codex: falha na reconexao','OK','Error') | Out-Null } catch {}
  }
  exit 1
}
