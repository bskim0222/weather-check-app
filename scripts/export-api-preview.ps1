$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$pnpmBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin'
$toolsBin = Join-Path $workspaceRoot '.tools\bin'
$mobileRoot = Join-Path $workspaceRoot 'mobile-app'

$env:Path = "$toolsBin;$nodeBin;$pnpmBin;$env:Path"
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:EXPO_PUBLIC_DATA_MODE = 'api'
if (-not $env:EXPO_PUBLIC_API_BASE_URL) {
  $env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8796'
}

Set-Location $mobileRoot
& "$nodeBin\node.exe" .\node_modules\expo\bin\cli export --platform web --output-dir dist-phone
& "$nodeBin\node.exe" .\scripts\post-export-pwa.mjs

Write-Host ''
Write-Host 'API preview export is ready.'
Write-Host 'Serve it with:'
Write-Host 'cd C:\Users\bskim\Documents\날씨앱만들기\mobile-app'
Write-Host 'node scripts/serve-dist-phone.mjs'
