@echo off
set PYTHONIOENCODING=utf-8
cd /d "c:\Users\Padam Kishore\Pictures\PROJECT-LAW\ai-service"
:loop
"C:\Users\Padam Kishore\AppData\Local\Programs\Python\Python313\python.exe" src/app.py
timeout /t 3 /nobreak >nul
goto loop
