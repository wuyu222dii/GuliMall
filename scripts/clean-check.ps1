param([switch]$Runtime)
$ErrorActionPreference='Stop'
$cleanRoot=Split-Path $PSScriptRoot -Parent
$cleanOriginal=@{};Get-ChildItem Env:|ForEach-Object {$cleanOriginal[$_.Name]=$_.Value}
$cleanTag=[guid]::NewGuid().ToString('N')
$cleanProject='gulimall-handoff-'+$cleanTag
$cleanDirectory=Join-Path $cleanRoot ('.tools/clean '+$cleanTag.Substring(0,8))
$cleanPaused=$false;$cleanStarted=$false;$cleanCleaned=$false;$cleanRestored=$false;$cleanReport=$null;$privateHashes=@{}
function Clean-RestoreEnvironment {
    Get-ChildItem Env:|Where-Object {-not $cleanOriginal.ContainsKey($_.Name)}|ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue}
    foreach($key in $cleanOriginal.Keys){[Environment]::SetEnvironmentVariable($key,$cleanOriginal[$key],'Process')}
}
function Clean-ClearConfiguration {
    $keys=@(Get-Content (Join-Path $cleanRoot '.env.example')|ForEach-Object {if($_ -match '^([A-Z][A-Z0-9_]*)='){$Matches[1]}})
    foreach($key in @(Get-ChildItem Env:|Where-Object {$_.Name -in $keys -or $_.Name -match '^(GULIMALL_|COMPOSE_|SPRING_|ALIPAY_|PAYMENT_TEST|ORDER_STOCK|WARE_ORDER|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$)'}|Select-Object -ExpandProperty Name)){Remove-Item -LiteralPath ('Env:'+$key)}
}
function Clean-Docker([string[]]$Arguments){& docker @Arguments;if($LASTEXITCODE -ne 0){throw 'Clean rehearsal Docker operation failed; inspect the private run log'}}
Push-Location $cleanRoot
try {
    & git diff --quiet
    if($LASTEXITCODE -ne 0){throw 'Stage the reviewed tracked changes first; the rehearsal exports the Git index snapshot'}
    $tree=(& git write-tree).Trim();if($LASTEXITCODE -ne 0){throw 'A Git index snapshot is required'}
    foreach($tool in @('node','npm','mvn','docker')){$command=Get-Command $tool -ErrorAction Stop;if($command.Source.StartsWith($cleanRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw "Install $tool outside the source workspace before checking clean builds"}}
    if(-not $env:JAVA_HOME -or [IO.Path]::GetFullPath($env:JAVA_HOME).StartsWith($cleanRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Set JAVA_HOME to a machine-installed JDK 8 outside this workspace'}
    if(Test-Path -LiteralPath $cleanDirectory){throw 'Clean export directory already exists'}
    New-Item -ItemType Directory -Path $cleanDirectory|Out-Null
    $archive=Join-Path $cleanDirectory 'source.zip';$source=Join-Path $cleanDirectory 'source'
    & git archive --format=zip --output=$archive $tree;if($LASTEXITCODE -ne 0){throw 'Git export failed'}
    Expand-Archive -LiteralPath $archive -DestinationPath $source
    foreach($path in @('.env','.tools','.data','gulimall-web/node_modules','gulimall-web/dist','gulimall-order/target')){if(Test-Path -LiteralPath (Join-Path $source $path)){throw 'Git export unexpectedly contains local artifacts'}}
    Clean-ClearConfiguration
    & "$source/scripts/setup.ps1"
    & "$source/scripts/dev.ps1" Build *> (Join-Path $cleanDirectory 'build.log')
    if($LASTEXITCODE -ne 0){throw 'Clean build failed; inspect build.log in the private export directory'}
    Push-Location $source
    try{& npm run lint --prefix gulimall-web *> (Join-Path $cleanDirectory 'lint.log');if($LASTEXITCODE -ne 0){throw 'Clean frontend lint failed'}}finally{Pop-Location}
    $cleanReport=[ordered]@{tree=$tree;source=$source;build=$true;lint=$true;copiedPrivateFiles=$false;dependencyCachesReused=$true;runtimeRequested=[bool]$Runtime;runtimePassed=$false;independentMachine=$false;secondOperator=$false;realServices=$false}
    if($Runtime){
        Clean-RestoreEnvironment
        if($env:GULIMALL_TEST -eq '1'){throw 'Leave test mode before the clean rehearsal'}
        if(-not(Test-Path '.tools/simulation/state.json') -or -not(Get-Content '.tools/simulation/state.json' -Raw|ConvertFrom-Json).active){throw 'Runtime rehearsal requires the healthy standing simulation so its original mode can be restored'}
        & "$PSScriptRoot/simulation.ps1" Diagnose -Json *> (Join-Path $cleanDirectory 'original-health.json');if($LASTEXITCODE -ne 0){throw 'Original simulation is not healthy; no services were stopped'}
        if(@(& docker ps -a --filter ('label=com.docker.compose.project='+$cleanProject) --format '{{.ID}}').Count){throw 'Rehearsal project already exists'}
        $cleanPaused=$true
        & "$PSScriptRoot/simulation.ps1" Stop
        . "$PSScriptRoot/env.ps1"
        Clean-Docker -Arguments @('compose','-p','gulimall-demo','-f',(Join-Path $cleanRoot 'compose.yaml'),'stop')
        foreach($file in @('.env','.tools/simulation/payment-config.json','.data/simulation/payment/trades.json')){if(Test-Path -LiteralPath $file){$privateHashes[$file]=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash}}
        Clean-ClearConfiguration
        $hash=[regex]::Match([IO.File]::ReadAllText((Join-Path $source 'infra/mysql/002-demo.sql')),"'demo_a',\s*'([^']+)'").Groups[1].Value
        if(-not $hash.StartsWith('$2a$')){throw 'Isolated admin fixture hash missing'}
        $envFile=Join-Path $source '.env';$content=[IO.File]::ReadAllText($envFile).Replace('ADMIN_USER=admin','ADMIN_USER=handoff_admin').Replace('ADMIN_PASSWORD_HASH=',"ADMIN_PASSWORD_HASH='$hash'")
        [IO.File]::WriteAllText($envFile,$content,(New-Object Text.UTF8Encoding($false)))
        New-Item -ItemType Directory -Force (Join-Path $source '.tools')|Out-Null
        [IO.File]::WriteAllText((Join-Path $source '.tools/handoff-owner.json'),(@{project=$cleanProject;workspace=$source}|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
        [IO.File]::WriteAllText((Join-Path $source '.tools/handoff-access.json'),(@{username='handoff_admin';password='Demo12345!'}|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
        $env:COMPOSE_PROJECT_NAME=$cleanProject;$env:COMPOSE_FILE=Join-Path $source 'compose.yaml'
        $cleanStarted=$true
        & "$source/scripts/preflight.ps1" -Mode Simulation -Json *> (Join-Path $cleanDirectory 'preflight.json');if($LASTEXITCODE -ne 0){throw 'Isolated preflight failed'}
        & "$source/scripts/simulation.ps1" Start -ProjectName $cleanProject *> (Join-Path $cleanDirectory 'runtime.log')
        if($LASTEXITCODE -ne 0){throw 'Isolated startup failed'}
        Push-Location $source
        try {
            . "$source/scripts/env.ps1"
            & "$source/scripts/search-index.ps1" *> (Join-Path $cleanDirectory 'search-index.log');if($LASTEXITCODE -ne 0){throw 'Fresh search index initialization failed'}
            & node scripts/handoff.acceptance.mjs *> (Join-Path $cleanDirectory 'transactions.log');if($LASTEXITCODE -ne 0){throw 'Isolated transaction checks failed'}
            & "$source/scripts/simulation.ps1" Stop -ProjectName $cleanProject
            Clean-Docker -Arguments @('compose','stop')
            & "$source/scripts/simulation.ps1" Start -ProjectName $cleanProject *> (Join-Path $cleanDirectory 'restart.log');if($LASTEXITCODE -ne 0){throw 'Isolated restart failed'}
            & node scripts/handoff.acceptance.mjs verify *> (Join-Path $cleanDirectory 'persistence.log');if($LASTEXITCODE -ne 0){throw 'Isolated restart verification failed'}
            $cleanReport.runtimePassed=$true
        } finally {Pop-Location}
    }
} finally {
    try {
        if($cleanStarted){
            & "$source/scripts/simulation.ps1" Stop -ProjectName $cleanProject
            $containerNames=@(& docker ps -a --filter ('label=com.docker.compose.project='+$cleanProject) --format '{{.Names}}')
            foreach($name in $containerNames){$owner=& docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' $name;if($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($owner) -ne [IO.Path]::GetFullPath($source)){throw 'Refusing cleanup of an unowned rehearsal resource'}}
            if($cleanProject -notmatch '^gulimall-handoff-[a-f0-9]{32}$'){throw 'Unsafe cleanup project'}
            Clean-Docker -Arguments @('compose','-p',$cleanProject,'-f',(Join-Path $source 'compose.yaml'),'down','--volumes')
            if(@(& docker ps -a --filter ('label=com.docker.compose.project='+$cleanProject) --format '{{.ID}}').Count -or @(& docker volume ls --filter ('label=com.docker.compose.project='+$cleanProject) --format '{{.Name}}').Count){throw 'Rehearsal resource cleanup is incomplete'}
            $cleanCleaned=$true
        }
    } finally {
        try {
            Clean-RestoreEnvironment
            if($cleanPaused){
                try{foreach($file in $privateHashes.Keys){if((Get-FileHash -LiteralPath (Join-Path $cleanRoot $file) -Algorithm SHA256).Hash -ne $privateHashes[$file]){throw 'Original private data changed during isolated rehearsal'}}}
                finally{& "$PSScriptRoot/simulation.ps1" Start
                    & "$PSScriptRoot/simulation.ps1" Diagnose -Json *> (Join-Path $cleanDirectory 'restored-health.json');if($LASTEXITCODE -ne 0){throw 'Standing simulation was not restored to health'};$cleanRestored=$true}
            }
            if($cleanReport){$cleanReport.originalModeRestored=$cleanRestored;$cleanReport.resourcesCleaned=$cleanCleaned;[IO.File]::WriteAllText((Join-Path $cleanDirectory 'result.json'),($cleanReport|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))}
        } finally {Clean-RestoreEnvironment;Pop-Location;Write-Output "Private clean rehearsal output: $cleanDirectory"}
    }
}
