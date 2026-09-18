@echo off
setlocal enabledelayedexpansion

echo ===================================================================
echo     AEDIRS - AI Emergency Disaster Response System (Dev Runner)
echo ===================================================================

REM Check for virtual environment in root
if exist ".venv\Scripts\python.exe" (
    set PYTHON_EXEC=..\.venv\Scripts\python.exe
) else (
    set PYTHON_EXEC=python
)

echo [*] Launching FastAPI backend at http://127.0.0.1:8000 ...
start "AEDIRS Backend (FastAPI)" cmd /k "cd backend && !PYTHON_EXEC! -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [*] Launching Vite React frontend at http://localhost:5173 ...
start "AEDIRS Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo [✓] Both services launched concurrently in separate command windows.
echo     - Backend API Docs: http://127.0.0.1:8000/docs
echo     - Frontend Client:  http://localhost:5173
echo ===================================================================
