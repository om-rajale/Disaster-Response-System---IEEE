#!/usr/bin/env bash

echo "==================================================================="
echo "    AEDIRS - AI Emergency Disaster Response System (Dev Runner)"
echo "==================================================================="

# Detect virtual environment
if [ -f "./.venv/Scripts/python.exe" ]; then
    PYTHON_CMD="../.venv/Scripts/python.exe"
elif [ -f "./.venv/bin/python" ]; then
    PYTHON_CMD="../.venv/bin/python"
else
    PYTHON_CMD="python"
fi

# Cleanup child processes on exit
cleanup() {
    echo ""
    echo "[!] Shutting down AEDIRS processes..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "[*] Launching FastAPI backend at http://127.0.0.1:8000 ..."
(cd backend && $PYTHON_CMD -m uvicorn main:app --reload --host 127.0.0.1 --port 8000) &

echo "[*] Launching Vite React frontend at http://localhost:5173 ..."
(cd frontend && npm run dev) &

echo "[✓] Services running. Press Ctrl+C to terminate both."
echo "==================================================================="

wait
