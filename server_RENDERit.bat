@echo off
setlocal
cd /d "%~dp0"
title RENDERit - Local Node Server
echo Starting RENDERit with tools\local-server.js on port 8888...
start "" "http://localhost:8888"
node tools\local-server.js
pause
endlocal
