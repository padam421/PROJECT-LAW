@echo off
cd /d "%~dp0..\backend"
:loop
"C:\Program Files\nodejs\node.exe" -e "require('dotenv').config({path:'../.env'}); const s=require('net').connect({host:'127.0.0.1',port:Number(process.env.PORT)||3000}); s.setTimeout(1000); s.once('connect',()=>{s.destroy();process.exit(0)}); s.once('error',()=>process.exit(1)); s.once('timeout',()=>{s.destroy();process.exit(1)});"
if not errorlevel 1 (
    echo Nyay Setu backend is already running. Skipping this duplicate launcher.
    exit /b 0
)
"C:\Program Files\nodejs\node.exe" src/server.js
timeout /t 3 /nobreak >nul
goto loop
