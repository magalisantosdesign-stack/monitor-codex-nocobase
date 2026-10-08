param([switch]$Preview)
# Compatibility entry point for the existing Chrome installation.
& (Join-Path $PSScriptRoot 'Remover-Ponte-Navegadores.ps1') -Browsers Chrome -Preview:$Preview
