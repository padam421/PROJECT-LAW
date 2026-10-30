@echo off
set PYTHONIOENCODING=utf-8
cd /d "c:\Users\Padam Kishore\Pictures\PROJECT-LAW\ai-service"
:loop
"C:\Users\Padam Kishore\AppData\Local\Programs\Python\Python313\python.exe" -c "import os,socket,sys; s=socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('127.0.0.1',int(os.environ.get('PORT','5000'))))==0 else 1)"
if not errorlevel 1 (
    echo Nyay Setu AI service is already running. Skipping this duplicate launcher.
    exit /b 0
)
"C:\Users\Padam Kishore\AppData\Local\Programs\Python\Python313\python.exe" src/app.py
timeout /t 3 /nobreak >nul
goto loop
