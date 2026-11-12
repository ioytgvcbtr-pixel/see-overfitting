param([int]$WebPort = 3000, [int]$ApiPort = 8000, [string]$Python = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = $Python
if (!$pythonPath) { $pythonPath = $env:FITLAB_PYTHON }
$localConfig = Join-Path $projectRoot '.env.local'
if (!$pythonPath -and (Test-Path -LiteralPath $localConfig)) {
    $setting = Get-Content -LiteralPath $localConfig | Where-Object { $_ -match '^FITLAB_PYTHON=' } | Select-Object -First 1
    if ($setting) { $pythonPath = $setting.Substring('FITLAB_PYTHON='.Length).Trim().Trim('"') }
}
if (!$pythonPath) { $pythonPath = (Get-Command python -ErrorAction Stop).Source }
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Python interpreter not found. Set FITLAB_PYTHON or pass -Python.' }
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
