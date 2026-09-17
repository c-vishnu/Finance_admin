@echo off
setlocal
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE (
  echo Node.js was not found.
  echo Install Node 20 or newer, then run:  npm run preview:static
  exit /b 1
)
echo Starting the Wayvida Books preview on http://localhost:4001/
echo Press Ctrl+C in this window to stop it.
"%NODE_EXE%" "%~dp0scripts\preview-server.mjs"