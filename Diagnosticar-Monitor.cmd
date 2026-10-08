@echo off
if exist "%~dp0.local\windows-launcher.json" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Reconectar-Monitor.ps1" -Diagnose -Quiet
) else (
  node "%~dp0Diagnosticar-Monitor.mjs"
)
pause
