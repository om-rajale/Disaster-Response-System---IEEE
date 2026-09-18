Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "    AEDIRS - AI Emergency Disaster Response System (Dev Runner)" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

$pythonCmd = if (Test-Path ".\.venv\Scripts\python.exe") { "..\.venv\Scripts\python.exe" } else { "python" }

Write-Host "[*] Launching FastAPI backend at http://127.0.0.1:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; & $pythonCmd -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

Write-Host "[*] Launching Vite React frontend at http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "[✓] Both services launched concurrently!" -ForegroundColor Green
Write-Host "    - Backend API Docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "    - Frontend Client:  http://localhost:5173" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Cyan
