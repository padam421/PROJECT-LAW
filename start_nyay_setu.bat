@echo off
title Nyay Setu - AI Legal Platform Launcher
color 0b
echo ========================================================
echo         NYAY SETU - AI LEGAL PLATFORM LAUNCHER
echo ========================================================
echo.

cd /d "%~dp0backend"

echo [1/2] Checking backend dependencies...
if not exist "node_modules\" (
    echo Installing backend packages, please wait...
    call npm install
)

echo.
echo [2/2] Starting Nyay Setu Backend Server on Port 3000...
start "Nyay Setu Backend Server" cmd /k "node src/server.js"

timeout /t 2 /nobreak >nul

echo.
echo Opening Nyay Setu in your default browser...
start http://localhost:3000/

echo.
echo ========================================================
echo   Nyay Setu is now running at: http://localhost:3000/
echo   User Portal   : http://localhost:3000/user
echo   Lawyer Portal : http://localhost:3000/lawyer
echo   Admin Console : http://localhost:3000/admin
echo ========================================================
echo.
pause
