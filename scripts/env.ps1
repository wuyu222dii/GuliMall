$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskEnvFile = Join-Path $taskRoot '.env'
if (-not (Test-Path -LiteralPath $taskEnvFile)) {
    throw 'Missing .env. Run ./scripts/setup.ps1 first.'
}
foreach ($taskLine in Get-Content -LiteralPath $taskEnvFile) {
    if ($taskLine -match '^\s*(#|$)') { continue }
    if ($taskLine -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') {
        throw 'Invalid .env line. Use NAME=value without shell expressions.'
    }
    $taskKey = $Matches[1]
    $taskValue = $Matches[2].Trim()
    if ($taskValue.Length -ge 2 -and (($taskValue.StartsWith("'") -and $taskValue.EndsWith("'")) -or ($taskValue.StartsWith('"') -and $taskValue.EndsWith('"')))) {
        $taskValue = $taskValue.Substring(1, $taskValue.Length - 2)
    }
    # Match Compose precedence: values already supplied by the caller win.
    if ($null -eq [Environment]::GetEnvironmentVariable($taskKey, 'Process')) {
        [Environment]::SetEnvironmentVariable($taskKey, $taskValue, 'Process')
    }
}
