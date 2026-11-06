@echo off
cd /d "%~dp0"
set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
netstat -ano | findstr ":4397" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo Star Realms Simulator is already running on port 4397.
  start "" http://127.0.0.1:4397
  "%SystemRoot%\System32\ping.exe" -n 4 127.0.0.1 >nul
  exit /b 0
)
echo Starting Star Realms Simulator ...
start "Star Realms Simulator" "%NODE_EXE%" src\server\server.js
"%SystemRoot%\System32\ping.exe" -n 3 127.0.0.1 >nul
start "" http://127.0.0.1:4397
echo.
echo Server is running in its own window. Close that window to stop it.
"%SystemRoot%\System32\ping.exe" -n 6 127.0.0.1 >nul
