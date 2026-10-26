@echo off
echo Stopping Nyay Setu background services...
powershell -Command "Get-NetTCPConnection -LocalPort 3000, 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Done.
