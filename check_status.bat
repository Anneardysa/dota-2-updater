@echo off
echo Checking bot status...
call pm2 status dota-tracker
echo.
echo Recent logs:
call pm2 logs dota-tracker --lines 10 --nostream
pause
