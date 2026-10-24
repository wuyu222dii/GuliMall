param(
    [ValidateSet('Start', 'Stop')][string]$Action = 'Start',
    [ValidateSet('product','member','coupon','ware','order','search','auth-server','third-party','gateway')][string[]]$Modules
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'Set JAVA_HOME to JDK 8 first.' }
$taskWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskMarker = '-Dgulimall.workspace=' + $taskWorkspace.Replace('\', '/')
if (-not $Modules) { $Modules = @('product','member','coupon','ware','order','search','auth-server','third-party','gateway') }
$taskLogs = Join-Path $taskWorkspace '.tools/runtime'
New-Item -ItemType Directory -Force $taskLogs | Out-Null
foreach ($taskModule in $Modules) {
    $taskName = 'gulimall-' + $taskModule
    $taskJar = Join-Path $taskWorkspace "$taskName/target/$taskName-0.0.1-SNAPSHOT.jar"
    $taskProcesses = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object {
        $_.CommandLine -and $_.CommandLine.Contains($taskMarker) -and $_.CommandLine.Contains($taskJar)
    })
    if ($Action -eq 'Stop') {
        foreach ($taskProcess in $taskProcesses) { Stop-Process -Id $taskProcess.ProcessId; Write-Output "Stopped $taskName PID $($taskProcess.ProcessId)" }
    } elseif ($taskProcesses.Count -eq 0) {
        if (-not (Test-Path -LiteralPath $taskJar)) { throw "Build $taskName before starting it." }
        $taskProcess = Start-Process -FilePath (Join-Path $env:JAVA_HOME 'bin/java.exe') -ArgumentList @('-Xms32m', '-Xmx256m', $taskMarker, '-Dfile.encoding=UTF-8', '-jar', ('"' + $taskJar + '"')) -WorkingDirectory $taskWorkspace -RedirectStandardOutput (Join-Path $taskLogs "$taskName.log") -RedirectStandardError (Join-Path $taskLogs "$taskName.err.log") -WindowStyle Hidden -PassThru
        Write-Output "Started $taskName PID $($taskProcess.Id)"
    } else { Write-Output "$taskName already running" }
}
