@echo off
title Nyay Setu - AI Legal Platform Launcher
color 0b
echo ========================================================
echo         NYAY SETU - AI LEGAL PLATFORM LAUNCHER
echo ========================================================
echo.

echo [1/3] Starting Nyay Setu Supreme Court AI RAG Service on Port 5000...
start "Nyay Setu Supreme Court AI Service" cmd /k "cd /d \"%~dp0ai-service\" && python src/app.py"

cd /d "%~dp0backend"

echo.
echo [2/3] Checking backend dependencies...
if not exist "node_modules\" (
    echo Installing backend packages, please wait...
    call npm install
)

echo.
echo [3/3] Starting Nyay Setu Backend Server on Port 3000...
start "Nyay Setu Backend Server" cmd /k "node src/server.js"

timeout /t 3 /nobreak >nul

echo.
echo Opening Nyay Setu in your default browser...
start http://localhost:3000/

echo.
echo ========================================================
echo   Nyay Setu is now running at: http://localhost:3000/
echo   AI RAG Service: http://localhost:5000/api/ai/health
echo   User Portal   : http://localhost:3000/user
echo   Lawyer Portal : http://localhost:3000/lawyer
echo   Admin Console : http://localhost:3000/admin
echo ========================================================
echo.
pause
