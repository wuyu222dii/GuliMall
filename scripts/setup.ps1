$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskEnvFile = Join-Path $taskRoot '.env'
if (-not (Test-Path -LiteralPath $taskEnvFile)) {
    $taskContent = Get-Content -LiteralPath (Join-Path $taskRoot '.env.example') -Raw
    $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        foreach ($taskKey in @('DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD')) {
            $taskBytes = New-Object byte[] 24
            $taskRng.GetBytes($taskBytes)
            $taskSecret = [Convert]::ToBase64String($taskBytes).Replace('+', '-').Replace('/', '_')
            $taskContent = $taskContent.Replace("$taskKey=CHANGE_ME", "$taskKey=$taskSecret")
        }
        # CreateNew refuses to overwrite an existing configuration, including concurrent setup.
        $taskStream = [IO.File]::Open($taskEnvFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        try {
            $taskData = [Text.Encoding]::UTF8.GetBytes($taskContent)
            $taskStream.Write($taskData, 0, $taskData.Length)
        } finally { $taskStream.Dispose() }
    } finally { $taskRng.Dispose() }
    Write-Output 'Created .env with random local passwords. Credentials were not printed.'
} else {
    Write-Output 'Existing .env preserved.'
}
New-Item -ItemType Directory -Force (Join-Path $taskRoot '.data/uploads') | Out-Null
