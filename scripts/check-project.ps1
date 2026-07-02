$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$nodeBin = 'C:\Users\bskim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'

$env:Path = "$nodeBin;$env:Path"

Set-Location $workspaceRoot
& "$nodeBin\node.exe" .\scripts\check-project.mjs
