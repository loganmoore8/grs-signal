$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$runtimeNode = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node).Source }
Push-Location $workspaceRoot
try { & $runtimeNode --import tsx scripts/dev.ts } finally { Pop-Location }
