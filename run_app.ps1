$Host.UI.RawUI.WindowTitle = "ShipGuard Platform (Port 8080)"
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  ShipGuard: Parametric Parcel Protection and Claims Platform" -ForegroundColor White
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  Full-Stack App: http://localhost:8080" -ForegroundColor Green
Write-Host "  API Docs:       http://localhost:8080/docs" -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Cyan
$env:PYTHONPATH = "backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080

