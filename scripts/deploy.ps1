param([ValidateSet('Build','Start','Stop','Status')][string]$Action='Start')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskScript=Join-Path $taskRoot 'scripts/serve-demo.mjs'
$taskProcesses=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($taskScript) })
Push-Location $taskRoot
try {
    if($Action -eq 'Build') { & npm --prefix gulimall-web run build;if($LASTEXITCODE -ne 0){throw 'Static build failed'} }
    elseif($Action -eq 'Stop') { foreach($taskProcess in $taskProcesses) { Stop-Process -Id $taskProcess.ProcessId };Write-Output 'Workspace static demo stopped.' }
    elseif($Action -eq 'Status') { Write-Output "Static demo processes: $($taskProcesses.Count)" }
    elseif($taskProcesses.Count -eq 0) {
        if(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue){throw 'Port 8080 is occupied by another process'}
        if(-not(Test-Path -LiteralPath (Join-Path $taskRoot 'gulimall-web/dist/index.html'))){throw 'Run deploy.ps1 Build first'}
        New-Item -ItemType Directory -Force (Join-Path $taskRoot '.tools') | Out-Null
        $null=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.tools/static-demo.log') -RedirectStandardError (Join-Path $taskRoot '.tools/static-demo.err.log') -PassThru
        $taskReady=$false
        for($taskTry=0;$taskTry -lt 20;$taskTry++){try{if((Invoke-WebRequest 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200){$taskReady=$true;break}}catch{};Start-Sleep -Milliseconds 250}
        if(-not $taskReady){throw 'Static demo failed to start; inspect .tools/static-demo.err.log'}
        Write-Output 'Static demo ready at http://127.0.0.1:8080. /api uses the loopback gateway; no Vite server required.'
    }else {Write-Output 'Static demo already running at http://127.0.0.1:8080'}
}finally{Pop-Location}
