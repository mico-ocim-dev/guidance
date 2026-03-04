@echo off
title GCO Office Management
cd /d "%~dp0"

set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

echo Stopping any existing dev server...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 "') do (
  taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 "') do (
  taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3002 "') do (
  taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3003 "') do (
  taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

echo Starting GCO Office Management...
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
call npm run dev

pause
