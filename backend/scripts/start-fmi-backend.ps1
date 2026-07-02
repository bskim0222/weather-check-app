$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'

$env:Path = "$nodeBin;$env:Path"
if (-not $env:PORT) {
  $env:PORT = '8796'
}
$env:WEATHER_PROVIDER_MODE = 'fmi'

Set-Location $projectRoot
& "$nodeBin\node.exe" .\src\server.mjs
