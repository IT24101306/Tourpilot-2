@echo off
cd /d "%~dp0"
echo.
echo IYYO - Convert hero frames to lossless WebP (smaller, no quality loss)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\convert-hero-to-webp.ps1" -Backup
echo.
pause
