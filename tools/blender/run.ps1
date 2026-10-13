param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
# Runs a script of tools/blender in Blender, in the background (no window):
#   ./tools/blender/run.ps1 prep.py --id frog
$ErrorActionPreference = 'Stop'
$blender = $env:BLENDER
if (-not $blender) {
    $blender = Get-ChildItem 'C:\Program Files\Blender Foundation' -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [version](($_.Name -replace '[^0-9.]', '') + '.0') } -Descending |
        ForEach-Object { Join-Path $_.FullName 'blender.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $blender) { throw 'Blender introuvable' }
$path = Join-Path $PSScriptRoot $Script
$ErrorActionPreference = 'Continue'
& $blender --background --factory-startup --python $path -- @Rest 2>&1 | ForEach-Object { "$_" } |
    Where-Object { $_ -match '^\[SB\]|Error|error|Traceback|line \d+|Exception|failed' }
exit $LASTEXITCODE
