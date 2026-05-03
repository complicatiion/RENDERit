@echo off
setlocal
cd /d "%~dp0"
title RENDERit - Offline PBR Visualizer
echo Starting RENDERit Visualizer...
echo Local server will run on http://localhost:8888
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8888"
  python -m http.server 8888
  goto :end
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8888"
  py -m http.server 8888
  goto :end
)
where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8888"
  node tools\local-server.js
  goto :end
)
echo Python or Node.js is required to start the local offline server.
echo You can also run: python -m http.server 8888
pause
:end
endlocal
