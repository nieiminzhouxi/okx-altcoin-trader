@echo off
chcp 65001 >nul 2>&1
title Sync to GitHub - OKX Altcoin Trader

echo ============================================
echo   Sync Project to GitHub
echo   Repo: okx-altcoin-trader
echo ============================================
echo.

REM ---- 配置区 ----
set GIT_EXE=C:\Users\24378\.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe
set WORK_DIR=%~dp0
set GH_USER=nieiminzhouxi
set GH_REPO=okx-altcoin-trader

REM ---- 检查 git 是否存在 ----
if not exist "%GIT_EXE%" (
    echo [ERROR] Git not found: %GIT_EXE%
    echo Please edit this BAT file and update GIT_EXE path.
    pause
    exit /b 1
)

cd /d "%WORK_DIR%"

REM ---- 读取 Token（从同目录的 .gh-token 文件） ----
set TOKEN_FILE=%WORK_DIR%.gh-token
if not exist "%TOKEN_FILE%" (
    echo [INFO] Token file not found: %TOKEN_FILE%
    echo.
    echo Please create a file named ".gh-token" in this directory,
    echo and paste your GitHub Personal Access Token into it.
    echo.
    echo Get your token from: https://github.com/settings/tokens
    echo.
    set /p TOKEN=Or paste your token now: 
) else (
    set /p TOKEN=<"%TOKEN_FILE%"
)

if "%TOKEN%"=="" (
    echo [ERROR] No token provided.
    pause
    exit /b 1
)

set REMOTE_URL=https://%GH_USER%:%TOKEN%@github.com/%GH_USER%/%GH_REPO%.git

REM ---- 检查是否已初始化 git ----
if not exist ".git" (
    echo [INFO] Initializing git repository...
    "%GIT_EXE%" init
    "%GIT_EXE%" config user.email "1143902832@qq.com"
    "%GIT_EXE%" config user.name "%GH_USER%"
)

REM ---- 配置代理（科学上网，如不需要可注释掉这两行） ----
"%GIT_EXE%" config http.proxy http://127.0.0.1:12334
"%GIT_EXE%" config https.proxy http://127.0.0.1:12334

REM ---- 设置远程仓库 ----
"%GIT_EXE%" remote remove origin 2>nul
"%GIT_EXE%" remote add origin "%REMOTE_URL%"

REM ---- 添加所有文件 ----
echo [1/4] Adding files...
"%GIT_EXE%" add -A

REM ---- 检查是否有变更 ----
"%GIT_EXE%" diff --cached --quiet
if %errorlevel% equ 0 (
    echo [INFO] No changes to commit. Trying pull and push...
    goto PULL_PUSH
)

REM ---- 提交 ----
echo [2/4] Committing...
set COMMIT_MSG=Auto sync %date% %time%
"%GIT_EXE%" commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo [ERROR] Commit failed.
    pause
    exit /b 1
)

:PULL_PUSH
REM ---- 拉取远程变更（避免冲突） ----
echo [3/4] Pulling remote changes...
"%GIT_EXE%" pull origin master --no-rebase 2>nul

REM ---- 推送 ----
echo [4/4] Pushing to GitHub...
"%GIT_EXE%" push -u origin master
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed! Check your network or token.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Sync Complete!
echo   https://github.com/%GH_USER%/%GH_REPO%
echo ============================================
echo.
pause