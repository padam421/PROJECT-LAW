@echo off
cd /d "c:\Users\Padam Kishore\Pictures\PROJECT-LAW\backend"
:loop
"C:\Program Files\nodejs\node.exe" src/server.js
timeout /t 3 /nobreak >nul
goto loop
