@echo off
REM Resurrect PM2 apps on system startup

REM Make sure the path to pm2 is correct for your user
call "%APPDATA%\npm\pm2.cmd" resurrect
