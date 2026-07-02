$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'

$env:Path = "$nodeBin;$env:Path"
if (-not $env:PORT) {
  $env:PORT = '8796'
}
$env:WEATHER_PROVIDER_MODE = 'kma,yr,fmi'

if (-not $env:KMA_SERVICE_KEY) {
  Write-Host 'KMA_SERVICE_KEY is not set. The backend will use fallback data for KMA.'
}

if (-not $env:YR_USER_AGENT) {
  Write-Host 'YR_USER_AGENT is not set. Example: WeatherCheck/0.1 weathercheck.official@gmail.com'
}

Set-Location $projectRoot
& "$nodeBin\node.exe" .\src\server.mjs
