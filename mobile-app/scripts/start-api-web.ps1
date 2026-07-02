$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$pnpmBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin'
$toolsBin = Join-Path $workspaceRoot '.tools\bin'

$env:Path = "$toolsBin;$nodeBin;$pnpmBin;$env:Path"
$env:EXPO_NO_TELEMETRY = '1'
$env:BROWSER = 'none'
$env:CI = '1'
$env:EXPO_PUBLIC_DATA_MODE = 'api'
if (-not $env:EXPO_PUBLIC_API_BASE_URL) {
  $env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8796'
}

Set-Location $projectRoot
& '.\node_modules\.bin\expo.CMD' start --web --port 8792 --host localhost
