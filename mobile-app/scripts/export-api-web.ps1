$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$pnpmBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin'
$toolsBin = Join-Path $workspaceRoot '.tools\bin'

$env:Path = "$toolsBin;$nodeBin;$pnpmBin;$env:Path"
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:EXPO_PUBLIC_DATA_MODE = 'api'
if (-not $env:EXPO_PUBLIC_API_BASE_URL) {
  $env:EXPO_PUBLIC_API_BASE_URL = 'https://weather-check-backend-hvfs.onrender.com'
}

Set-Location $projectRoot
& "$nodeBin\node.exe" .\node_modules\expo\bin\cli export --platform web --output-dir dist-phone
& "$nodeBin\node.exe" .\scripts\post-export-pwa.mjs
