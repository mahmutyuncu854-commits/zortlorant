@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurup tekrar dene.
  pause
  exit /b
)
echo ZORTLORANT sunucusu baslatiliyor... Bu pencereyi oyun boyunca acik tut.
start "" http://localhost:3000
node server.js
pause
