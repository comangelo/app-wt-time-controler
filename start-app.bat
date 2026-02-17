@echo off
echo ========================================
echo Iniciando Watchtower Time Controller
echo ========================================

echo.
echo Iniciando BACKEND...
start cmd /k "cd backend && .venv\Scripts\activate && python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload"

timeout /t 3 > nul

echo.
echo Iniciando FRONTEND...
start cmd /k "cd frontend && npm start"

echo.
echo ========================================
echo Aplicacion iniciada
echo ========================================
