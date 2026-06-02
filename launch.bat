@echo off
setlocal EnableDelayedExpansion
title InvestorIQ — Angel Investor Research

echo.
echo   [*]  InvestorIQ --- Angel Investor Research
echo   -----------------------------------------------
echo.

REM ── Change to script directory ─────────────────────────────────
cd /d "%~dp0"

REM ── Python check ───────────────────────────────────────────────
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X]  Python not found.
    echo        Install it from https://www.python.org/downloads/
    echo        Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo   [+]  Python %PY_VER% found

REM ── Virtual environment ────────────────────────────────────────
if not exist ".venv" (
    echo   [>]  Creating virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo   [X]  Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo   [+]  Virtual environment created
)

REM ── Activate ───────────────────────────────────────────────────
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo   [X]  Failed to activate virtual environment.
    pause
    exit /b 1
)

REM ── Dependencies ───────────────────────────────────────────────
echo   [>]  Checking dependencies...
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo   [+]  Dependencies ready

REM ── .env setup ─────────────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    ) else (
        type nul > .env
    )
    echo.
    echo   [!]  Created .env file --- action required:
    echo        1. Open .env with Notepad (right-click -> Open with -> Notepad)
    echo        2. Set your key: ANTHROPIC_API_KEY=sk-ant-...
    echo        3. Get a key at: https://console.anthropic.com
    echo.
)

REM ── Launch ─────────────────────────────────────────────────────
echo.
echo   [>]  Launching InvestorIQ...
echo        App will open at: http://localhost:8501
echo        Press Ctrl+C to stop.
echo.

streamlit run investor_app.py --server.port 8501 --server.headless false --browser.gatherUsageStats false

if %errorlevel% neq 0 (
    echo.
    echo   [X]  Failed to start. Is Streamlit installed?
    echo        Try:  pip install streamlit
)

pause
