@echo off
if exist "%~dp0.local\windows-launcher.json" (
  powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0Reconectar-Monitor.ps1"
) else (
  node "%~dp0Iniciar-Monitor.mjs"
  if errorlevel 1 pause
)
