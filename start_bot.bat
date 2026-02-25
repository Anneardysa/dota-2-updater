@echo off
cd /d "%~dp0"
echo Starting Dota 2 Update Monitor...
call pm2 start src/index.js --name dota-tracker
echo.
echo Bot started in background!
pause
