@echo off
if exist "%~dp0.local\windows-launcher.json" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Reconectar-Monitor.ps1" -Diagnose -Quiet
) else (
  node "%~dp0scripts\Diagnosticar-Monitor.mjs"
)
pause
