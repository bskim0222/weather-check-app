$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$pnpmBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin'
$toolsBin = Join-Path $workspaceRoot '.tools\bin'

$env:Path = "$toolsBin;$nodeBin;$pnpmBin;$env:Path"
$env:EXPO_NO_TELEMETRY = '1'
$env:EAS_NO_VCS = '1'

Set-Location $projectRoot
& "$nodeBin\node.exe" .\scripts\check-android-preview.mjs
& '.\node_modules\.bin\eas.CMD' build --platform android --profile preview
