param([switch]$Preview)
$monitorPackageRoot = [IO.Path]::GetDirectoryName($PSScriptRoot)
# Compatibility entry point for the existing Chrome installation.
& (Join-Path $monitorPackageRoot 'scripts\Instalar-Ponte-Navegadores.ps1') -Browsers Chrome -Preview:$Preview
