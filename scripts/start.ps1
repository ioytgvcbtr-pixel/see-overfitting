param([int]$WebPort = 3000, [int]$ApiPort = 8000)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = '<PYTHON_ENV>\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw "Python interpreter missing: $pythonPath" }
if ($ApiPort -ne 8000) { throw 'The web proxy currently expects ApiPort 8000.' }
Set-Location -LiteralPath $projectRoot
$apiProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',"$ApiPort") -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden
try { & npm.cmd run dev -- --port $WebPort }
finally { if (!$apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id } }
