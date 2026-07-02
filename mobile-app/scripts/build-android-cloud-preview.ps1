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

if (-not $env:EXPO_PUBLIC_API_BASE_URL) {
  $env:EXPO_PUBLIC_API_BASE_URL = 'https://weather-check-backend-hvfs.onrender.com'
}

if (-not $env:EXPO_PUBLIC_API_BASE_URL.StartsWith('https://')) {
  throw 'Cloud preview API URL must start with https:// for Android friend testing.'
}

$env:EXPO_PUBLIC_DATA_MODE = 'api'

$easPath = Join-Path $projectRoot 'eas.json'
$eas = Get-Content -LiteralPath $easPath -Raw | ConvertFrom-Json
$previewProfile = $eas.build.preview | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$previewProfile | Add-Member -NotePropertyName env -NotePropertyValue ([ordered]@{
  EXPO_PUBLIC_DATA_MODE = 'api'
  EXPO_PUBLIC_API_BASE_URL = $env:EXPO_PUBLIC_API_BASE_URL
}) -Force
$eas.build | Add-Member -NotePropertyName previewCloud -NotePropertyValue $previewProfile -Force
$eas | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $easPath -Encoding UTF8

Write-Host "Android cloud preview will use $($env:EXPO_PUBLIC_API_BASE_URL)"
& "$nodeBin\node.exe" .\scripts\check-android-preview.mjs
& '.\node_modules\.bin\eas.CMD' build --platform android --profile previewCloud
