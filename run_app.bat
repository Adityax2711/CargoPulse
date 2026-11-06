@echo off
title ShipGuard Platform
echo ===================================================================
echo   ShipGuard: Parametric Parcel Protection and Claims Platform
echo ===================================================================
echo   Serving Full-Stack App at: http://localhost:8080
echo   API Docs available at:      http://localhost:8080/docs
echo ===================================================================
set PYTHONPATH=backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
pause

