param([int]$WebPort = 3000, [int]$ApiPort = 8000)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = '<PYTHON_ENV>\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw "Python interpreter missing: $pythonPath" }
if ($ApiPort -ne 8000) { throw 'The web proxy currently expects ApiPort 8000.' }
Set-Location -LiteralPath $projectRoot
$listeners = Get-NetTCPConnection -State Listen -LocalPort @($WebPort, $ApiPort) -ErrorAction SilentlyContinue
if ($listeners) { throw "Port $WebPort or $ApiPort is already in use. Close the existing FitLab session or choose a free web port." }
$apiProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',"$ApiPort") -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden
try {
    $apiReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($apiProcess.HasExited) { throw 'The API process exited. Check the Python dependencies and local configuration.' }
        try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 1; if ($health.status -eq 'ok') { $apiReady = $true; break } } catch { Start-Sleep -Milliseconds 200 }
    }
    if (!$apiReady) { throw 'The API did not become ready in time.' }
    Write-Output "FitLab API ready at http://127.0.0.1:$ApiPort (PID $($apiProcess.Id))"
    & npm.cmd run dev -- --port $WebPort
}
finally { if (!$apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id } }
