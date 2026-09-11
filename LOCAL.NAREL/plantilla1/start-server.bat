@echo off
setlocal

cd /d "%~dp0"

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js no esta instalado o no se encuentra en el PATH.
  echo Instala Node.js LTS y volve a ejecutar este archivo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm no esta disponible.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($connection) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo El servidor ya esta funcionando en http://localhost:3000/
  start "" "http://localhost:3000/"
  exit /b 0
)

echo Iniciando Narel Local en http://localhost:3000/
start "Narel Local - Servidor" /d "%~dp0" cmd /k npm start

timeout /t 3 /nobreak >nul
start "" "http://localhost:3000/"

endlocal
