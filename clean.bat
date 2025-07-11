@echo off
echo Cleaning Node.js project...

REM Remove node_modules
IF EXIST node_modules (
    echo Removing node_modules...
    rmdir /s /q node_modules
) ELSE (
    echo node_modules folder not found.
)

REM Remove dist
IF EXIST dist (
    echo Removing dist...
    rmdir /s /q dist
) ELSE (
    echo dist folder not found.
)

REM Remove package-lock.json
IF EXIST package-lock.json (
    echo Removing package-lock.json...
    del /f /q package-lock.json
) ELSE (
    echo package-lock.json not found.
)

echo Running npm install...
call npm i
IF ERRORLEVEL 1 (
    echo npm install failed. Aborting.
    pause
    exit /b
)

echo Building the project...
call npm run build
IF ERRORLEVEL 1 (
    echo npm build failed. Aborting.
    pause
    exit /b
)

echo Packing the module...
call npm pack
IF ERRORLEVEL 1 (
    echo npm pack failed. Aborting.
    pause
    exit /b
)

echo Cleanup and build complete.
