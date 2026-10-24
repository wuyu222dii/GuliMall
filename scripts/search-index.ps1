$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')
$taskEsUrl = [Environment]::GetEnvironmentVariable('ELASTICSEARCH_URL','Process')
if (-not $taskEsUrl) { $taskEsUrl = 'http://127.0.0.1:19200' }
$taskIndexUrl = $taskEsUrl.TrimEnd('/') + '/gulimall-products-v1'
try { $null = Invoke-RestMethod -Method Head -Uri $taskIndexUrl }
catch {
    if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
    $taskMappingPath = Join-Path $PSScriptRoot '../gulimall-search/src/main/resources/elasticsearch/products.json'
    $null = Invoke-RestMethod -Method Put -Uri $taskIndexUrl -ContentType 'application/json' -Body ([System.IO.File]::ReadAllText((Resolve-Path $taskMappingPath)))
}
$taskMapping = Invoke-RestMethod ($taskIndexUrl + '/_mapping')
if ($taskMapping.'gulimall-products-v1'.mappings._meta.gulimall_schema -ne 1 -or $taskMapping.'gulimall-products-v1'.mappings.properties.attrs.type -ne 'nested') { throw 'Unexpected mapping; do not overwrite an existing index. Inspect its schema first.' }
$null = Invoke-RestMethod -Method Put -Uri ($taskIndexUrl + '/_alias/gulimall-products-write')
Write-Output 'Search index schema v1 ready; existing documents preserved.'
