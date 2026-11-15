param(
    [ValidateRange(1024,65535)][int]$WebPort = 3000,
    [ValidateRange(1024,65535)][int]$ApiPort = 8000,
    [string]$Python = '',
    [switch]$NoBrowser,
    [switch]$SmokeTest,
    [switch]$Install,
    [switch]$Production
)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if ($WebPort -eq $ApiPort) { throw '网页与计算服务需要使用不同端口。' }
$pythonPath = $Python
if (!$pythonPath) { $pythonPath = $env:FITLAB_PYTHON }
$localConfig = Join-Path $projectRoot '.env.local'
if (!$pythonPath -and (Test-Path -LiteralPath $localConfig)) {
    $setting = Get-Content -LiteralPath $localConfig | Where-Object { $_ -match '^FITLAB_PYTHON=' } | Select-Object -First 1
    if ($setting) { $pythonPath = $setting.Substring('FITLAB_PYTHON='.Length).Trim().Trim('"') }
}
if (!$pythonPath) { $pythonPath = (Get-Command python -ErrorAction Stop).Source }
if (!(Test-Path -LiteralPath $pythonPath)) { throw '没有找到Python解释器，请设置FITLAB_PYTHON或使用-Python参数。' }
function Read-SetupReport {
    $reportText = & $pythonPath -X utf8 scripts/check_environment.py --json
    try { return (($reportText -join "`n") | ConvertFrom-Json) } catch { throw '环境自检未完成，请确认使用Python 3.13。' }
}
$report = Read-SetupReport
if ($Install) {
    $missingRuntime = @($report.checks | Where-Object { !$_.ok -and $_.id -in @('python','node','npm') })
    if ($missingRuntime.Count) {
        foreach ($check in $missingRuntime) { Write-Output ($check.label + '：' + $check.fix) }
        throw '请先准备Python与Node.js运行环境，再安装项目依赖。'
    }
    $missingDependencies = @($report.checks | Where-Object { !$_.ok -and ($_.id.StartsWith('package-') -or $_.id -eq 'frontend') })
    if ($missingDependencies.Count) {
        if (Get-NetTCPConnection -State Listen -LocalPort @($WebPort,$ApiPort) -ErrorAction SilentlyContinue) {
            throw '请先退出当前端口上的服务，再安装依赖；已有FitLab可不带-Install直接复用。'
        }
        & $pythonPath -m pip install -r requirements.txt
        if ($LASTEXITCODE -ne 0) { throw 'Python依赖安装未完成，请检查网络后重试。' }
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw '前端依赖安装未完成，请检查网络后重试。' }
        $report = Read-SetupReport
    } else { Write-Output '锁定依赖已就绪，未重复安装。' }
}
foreach ($check in $report.checks) {
    if (!$check.ok) { Write-Output ($check.label + '：' + $check.detail + '。' + $check.fix) }
}
if (!$report.ok) { throw '环境尚未就绪。可运行 .\scripts\start.ps1 -Install 安装项目依赖后重试。' }
function Get-FitLabHealth([string]$Address) {
    try {
        $health = Invoke-RestMethod -Uri $Address -TimeoutSec 2
        if ($health.app -eq 'fitlab' -and $health.status -eq 'ok') { return $health }
    } catch {}
    return $null
}
function Open-FitLab([string]$Address) {
    if ($NoBrowser) { return }
    $chrome = Get-Command chrome.exe -ErrorAction SilentlyContinue
    $candidates = @()
    if ($chrome) { $candidates += $chrome.Source }
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($base) { $candidates += Join-Path $base 'Google\Chrome\Application\chrome.exe' }
    }
    $browserPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($browserPath) { Start-Process -FilePath $browserPath -ArgumentList @($Address) -WindowStyle Normal }
    else { Start-Process -FilePath $Address -WindowStyle Normal }
}
function Wait-FitLab([string]$Address, $Process) {
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt 45) {
        if ($Process -and $Process.HasExited) { throw '服务提前退出，请查看artifacts/local中的启动日志。' }
        if (Get-FitLabHealth $Address) { return }
        Start-Sleep -Milliseconds 250
    }
    throw '服务启动等待超时，请查看artifacts/local中的启动日志后重试。'
}
function Stop-Owned($Process) {
    if (!$Process) { return }
    $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    $ids = [System.Collections.Generic.List[int]]::new()
    $ids.Add($Process.Id)
    for ($i = 0; $i -lt $ids.Count; $i++) {
        foreach ($child in $all | Where-Object { $_.ParentProcessId -eq $ids[$i] }) { $ids.Add([int]$child.ProcessId) }
    }
    for ($i = $ids.Count - 1; $i -ge 0; $i--) { Stop-Process -Id $ids[$i] -ErrorAction SilentlyContinue }
}
$apiUrl = "http://127.0.0.1:$ApiPort"
$webUrl = "http://127.0.0.1:$WebPort"
$apiHealth = Get-FitLabHealth "$apiUrl/health"
$webHealth = Get-FitLabHealth "$webUrl/api/health"
if ($apiHealth -and $webHealth) {
    Write-Output "FitLab已启动，复用现有实例：$webUrl"
    Open-FitLab $webUrl
    return
}
foreach ($port in @($ApiPort,$WebPort)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener -and !(($port -eq $ApiPort -and $apiHealth) -or ($port -eq $WebPort -and $webHealth))) {
        throw "端口${port}被占用，未关闭任何程序。请使用-WebPort和-ApiPort选择空闲端口，或先退出原服务。"
    }
}
New-Item -ItemType Directory -Path 'artifacts/local' -Force | Out-Null
$apiProcess = $null
$webProcess = $null
try {
    if (!$apiHealth) {
        $apiProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',"$ApiPort") -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput "artifacts/local/api-$ApiPort.out.log" -RedirectStandardError "artifacts/local/api-$ApiPort.err.log"
        Wait-FitLab "$apiUrl/health" $apiProcess
    }
    if (!$webHealth) {
        if ($Production -and !(Test-Path -LiteralPath '.next/BUILD_ID')) { throw '生产模式需要先运行 npm.cmd run build。' }
        $oldOrigin = $env:FITLAB_API_ORIGIN
        $env:FITLAB_API_ORIGIN = $apiUrl
        $webMode = if ($Production) { 'start' } else { 'dev' }
        try {
            $webProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/next/dist/bin/next',$webMode,'--hostname','127.0.0.1','--port',"$WebPort") -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput "artifacts/local/web-$WebPort.out.log" -RedirectStandardError "artifacts/local/web-$WebPort.err.log"
        } finally { $env:FITLAB_API_ORIGIN = $oldOrigin }
        Wait-FitLab "$webUrl/api/health" $webProcess
    }
    Write-Output "启动自检通过，FitLab已就绪：$webUrl"
    Open-FitLab $webUrl
    if ($SmokeTest) { return }
    Write-Output '关闭本终端或按Ctrl+C可停止本次启动的服务。'
    while ((!$apiProcess -or !$apiProcess.HasExited) -and (!$webProcess -or !$webProcess.HasExited)) { Start-Sleep -Milliseconds 500 }
} finally {
    Stop-Owned $webProcess
    Stop-Owned $apiProcess
}
