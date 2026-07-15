@echo off
setlocal

title VSCode Dev

pushd %~dp0\..

:: Get electron, compile, built-in extensions
if "%VSCODE_SKIP_PRELAUNCH%"=="" node build/lib/preLaunch.js

for /f "tokens=2 delims=:," %%a in ('findstr /R /C:"\"nameShort\":.*" product.json') do set NAMESHORT=%%~a
set NAMESHORT=%NAMESHORT: "=%
set NAMESHORT=%NAMESHORT:"=%.exe
:: Use electron.exe to avoid Windows Device Guard blocking renamed binaries
set CODE=".build\electron\electron.exe"

:: Manage built-in extensions
if "%~1"=="--builtin" goto builtin

:: Configuration
set NODE_ENV=development
set VSCODE_DEV=1
set VSCODE_CLI=1
set VSCODE_PORTABLE=%CD%\.portable
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1

set DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"

:: Window visibility and stability flags
set USER_DATA_DIR=--user-data-dir="%CD%\.portable\user-data"
set DISABLE_GPU=--disable-gpu
set NO_SANDBOX=--no-sandbox
set NEW_WINDOW=--new-window
set WINDOW_POSITION=--window-position=0,0
for %%A in (%*) do (
	if "%%~A"=="--extensionTestsPath" (
		set DISABLE_TEST_EXTENSION=""
	)
)

:: Launch Code (with path arg)

%CODE% . %USER_DATA_DIR% %DISABLE_GPU% %NO_SANDBOX% %NEW_WINDOW% %WINDOW_POSITION% %DISABLE_TEST_EXTENSION% %*
goto end

:builtin
%CODE% build/builtin

:end

popd

endlocal
