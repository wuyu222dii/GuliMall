$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
foreach ($taskFile in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1') {
    $taskParseErrors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile($taskFile.FullName, [ref]$null, [ref]$taskParseErrors)
    if ($taskParseErrors) { throw "PowerShell parse failure: $($taskFile.Name)" }
}

# Exercise the real setup and loader in an isolated directory, never the user's .env.
$taskTestRoot = Join-Path $taskRoot ('.tools/script-tests-' + [Guid]::NewGuid().ToString('N'))
$taskTestScripts = Join-Path $taskTestRoot 'scripts'
New-Item -ItemType Directory -Force $taskTestScripts | Out-Null
foreach ($taskFile in @('setup.ps1', 'env.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskFile) -Destination $taskTestScripts
}
Copy-Item -LiteralPath (Join-Path $taskRoot '.env.example') -Destination $taskTestRoot
& (Join-Path $taskTestScripts 'setup.ps1') | Out-Null
$taskTestEnv = Join-Path $taskTestRoot '.env'
$taskFirstHash = (Get-FileHash -LiteralPath $taskTestEnv -Algorithm SHA256).Hash
if ((Get-Content -LiteralPath $taskTestEnv -Raw) -match '=CHANGE_ME') { throw 'Setup did not generate all passwords.' }
& (Join-Path $taskTestScripts 'setup.ps1') | Out-Null
if ((Get-FileHash -LiteralPath $taskTestEnv -Algorithm SHA256).Hash -ne $taskFirstHash) { throw 'Setup overwrote existing credentials.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskTestRoot '.data/uploads'))) { throw 'Upload directory missing.' }
$taskLiteral = '$2a$10$literal$(throw 123);still-literal'
Add-Content -LiteralPath $taskTestEnv -Value "`nTASK_LITERAL='$taskLiteral'"
$taskOriginalEnvironment = @{}
foreach ($taskLine in Get-Content -LiteralPath $taskTestEnv) {
    if ($taskLine -match '^([A-Z][A-Z0-9_]*)=') {
        $taskOriginalEnvironment[$Matches[1]] = [Environment]::GetEnvironmentVariable($Matches[1], 'Process')
    }
}
try {
    $env:DB_PASSWORD = 'externally-provided-test-value'
    . (Join-Path $taskTestScripts 'env.ps1')
    if ($env:TASK_LITERAL -ne $taskLiteral) { throw 'Loader evaluated or altered a literal value.' }
    if ($env:DB_PASSWORD -ne 'externally-provided-test-value') { throw 'Loader overwrote the caller environment.' }
    Set-Content -LiteralPath $taskTestEnv -Value 'INVALID LINE'
    $taskRejected = $false
    try { . (Join-Path $taskTestScripts 'env.ps1') } catch { $taskRejected = $true }
    if (-not $taskRejected) { throw 'Loader accepted malformed input.' }
} finally {
    foreach ($taskKey in $taskOriginalEnvironment.Keys) {
        if ($null -eq $taskOriginalEnvironment[$taskKey]) {
            Remove-Item -LiteralPath "Env:$taskKey" -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($taskKey, $taskOriginalEnvironment[$taskKey], 'Process')
        }
    }
}
Write-Output 'PASS: script syntax, random secrets, non-overwrite, literal values, environment precedence, malformed input.'
