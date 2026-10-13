param([string[]]$Names = @(), [switch]$Force)
# Reference images of props / creatures for Tripo (image_to_model), made with the Codex CLI.
# Output: tools/art/props/<id>.png
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $root 'tools/art/props'
New-Item -ItemType Directory -Force $out | Out-Null

$tail = ' Stylised 3D render like a modern remaster of a late-90s console game, smooth rounded shapes, clean readable silhouette, vivid colours, Halloween mood. Neutral even studio lighting, plain light grey background, no cast shadow, no text, no logo, no watermark. The subject is shown ALONE, once, complete, centred with a small margin all around.'
$P = [ordered]@{
    cat = 'Create ONE new image, square 1024x1024. A chubby cartoon orange tabby cat caught mid-air in a furious pounce, seen from the front with a slight three-quarter turn: all four legs spread wide with the paws open and the claws out, back arched, fur bristling, mouth wide open hissing with small sharp fangs, wild round yellow eyes, ears flat, striped tail straight up behind.' + $tail
}

if ($Names.Count -eq 0) { $Names = @($P.Keys) }
foreach ($name in $Names) {
    $file = Join-Path $out ($name + '.png')
    if ((Test-Path $file) -and -not $Force) { continue }
    $ErrorActionPreference = 'Continue'
    $prompt = 'Use your image generation tool. ' + $P[$name] + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
    $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Select-Object -Last 3
    $ErrorActionPreference = 'Stop'
    if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
