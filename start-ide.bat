@echo off
cd /d "%~dp0"

echo ========================================
echo   Statuz IDE - Starting...
echo ========================================

:: Step 1: Check if compilation is needed
echo.
echo [1/2] Checking build...
node build/lib/preLaunch.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Build check failed, running full compile...
    echo.
    call npm run compile
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Compilation failed. Exiting.
        pause
        exit /b 1
    )
)

:: Step 2: Launch
echo.
echo [2/2] Launching Statuz IDE...
echo ========================================

:: Use electron.exe to avoid Windows Device Guard blocking renamed binaries
set CODE=".build\electron\electron.exe"

set NODE_ENV=development
set VSCODE_DEV=1
set VSCODE_CLI=1
set VSCODE_PORTABLE=%CD%\.portable
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1

%CODE% . --user-data-dir="%CD%\.portable\user-data" --disable-gpu --no-sandbox --new-window --window-position=0,0 --disable-extension=vscode.vscode-api-tests %*

echo.
echo Statuz IDE closed.
exit /b 0