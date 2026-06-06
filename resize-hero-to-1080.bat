@echo off
cd /d "%~dp0"
echo.
echo IYYO - Resize hero frames to 1920x1080 (with backup)
echo Project folder: %CD%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\resize-hero-frames.ps1" -Backup
echo.
if errorlevel 1 (
  echo Script failed. See messages above.
) else (
  echo Finished successfully.
)
echo.
pause
