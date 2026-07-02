$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$pnpmBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin'
$toolsBin = Join-Path $workspaceRoot '.tools\bin'

$env:Path = "$toolsBin;$nodeBin;$pnpmBin;$env:Path"
$env:EXPO_NO_TELEMETRY = '1'
$env:EAS_NO_VCS = '1'

function Get-LanIPv4Address {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object InterfaceMetric |
    Select-Object -ExpandProperty IPAddress

  if (-not $addresses -or $addresses.Count -eq 0) {
    throw 'LAN IPv4 address not found. Set EXPO_PUBLIC_API_BASE_URL manually, for example http://192.168.0.31:8796'
  }

  return $addresses[0]
}

Set-Location $projectRoot

if (-not $env:EXPO_PUBLIC_API_BASE_URL) {
  $lanIp = Get-LanIPv4Address
  $env:EXPO_PUBLIC_API_BASE_URL = "http://$lanIp`:8796"
}

$env:EXPO_PUBLIC_DATA_MODE = 'api'

$easPath = Join-Path $projectRoot 'eas.json'
$eas = Get-Content -LiteralPath $easPath -Raw | ConvertFrom-Json
$previewProfile = $eas.build.preview | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$previewProfile | Add-Member -NotePropertyName env -NotePropertyValue ([ordered]@{
  EXPO_PUBLIC_DATA_MODE = 'api'
  EXPO_PUBLIC_API_BASE_URL = $env:EXPO_PUBLIC_API_BASE_URL
}) -Force
$eas.build | Add-Member -NotePropertyName previewApi -NotePropertyValue $previewProfile -Force
$eas | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $easPath -Encoding UTF8

Write-Host "Android API preview will use $($env:EXPO_PUBLIC_API_BASE_URL)"
& "$nodeBin\node.exe" .\scripts\check-android-preview.mjs
& '.\node_modules\.bin\eas.CMD' build --platform android --profile previewApi
