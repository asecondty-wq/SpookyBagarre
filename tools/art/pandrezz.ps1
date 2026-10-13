param([string[]]$Names = @(), [switch]$Force)
# Pandrezz (hero of the creator's game PANDREZZ) as a 3D cartoon fighter, made with the Codex CLI from his
# artworks (tools/art/refs/pandrezz_*.png: Steam capsule art, dialogue portrait, title-screen back view).
#   pandrezz      : front A-pose, empty hands, plain background (Tripo image_to_model input) -> tools/art/apose/
#   cdman/vinylman: front views of his two friends he summons (reference for the Blender models) -> tools/art/refs/
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$refs = Join-Path $root 'tools/art/refs'
$apose = Join-Path $root 'tools/art/apose'
New-Item -ItemType Directory -Force $apose | Out-Null

$look = ' Stylised 3D cartoon render like a modern remaster of a late-90s console party fighting game: smooth rounded shapes, slightly big head, expressive face, vivid colours, clean materials. Neutral even studio lighting, plain light grey background, no cast shadow, no text, no logo, no watermark. Centred with a small margin all around, the character fills most of the height.'
$P = [ordered]@{
    pandrezz = 'Create ONE new image, portrait 1024x1536. The hero of the attached pixel-art artworks, remade as a 3D cartoon fighter: a cheerful, very strong bearded rock musician. Long wavy copper-auburn hair down to the shoulders, black rectangular glasses, short ginger beard, big confident grin. Dark purple over-ear headphones resting around his neck. Black t-shirt with a small pixel-art heart (pink and blue) on the chest, black wristbands, broad shoulders and strong arms. Blue jeans slightly ripped at one knee, chunky grey and white sneakers. NO guitar, nothing on his back. Full body from head to feet, seen from the front with a slight three-quarter turn to the left (about 20 degrees), standing in a clean A-pose: arms straight and held away from the body at about 45 degrees, hands open and EMPTY with fingers slightly spread, legs straight and slightly apart, feet flat. The hair stays behind the shoulders, the arms are clear of the hair.' + $look
    cdman = 'Create ONE new image, portrait 1024x1536. The CD-headed character of the attached pixel-art images, remade as a 3D cartoon character: his head IS a shiny iridescent compact disc seen face-on (rainbow reflections, a clear centre hole), with two square white eyes with small cyan pupils on the disc. Red hoodie with the hood down and two white drawstrings, dark blue jeans, white sneakers, small hands. Full body from head to feet, seen straight from the front, standing in a relaxed A-pose with empty hands.' + $look
    vinylman = 'Create ONE new image, portrait 1024x1536. The vinyl-record-headed character of the attached pixel-art images, remade as a 3D cartoon character: his head IS a glossy black vinyl record seen face-on (fine grooves catching the light, a small grey centre ring), with two big white oval eyes with small blue pupils on the record. Plain grey t-shirt, dark trousers, grey and white sneakers. Full body from head to feet, seen straight from the front, standing in a relaxed A-pose with empty hands.' + $look
}
$inputs = @{
    pandrezz = @('pandrezz_art.png', 'pandrezz_face.png', 'pandrezz_back.png')
    cdman = @('cdman_src.png')
    vinylman = @('vinylman_src.png')
}

if ($Names.Count -eq 0) { $Names = @($P.Keys) }
foreach ($name in $Names) {
    $dir = if ($name -eq 'pandrezz') { $apose } else { $refs }
    $file = Join-Path $dir ($name + '.png')
    if ((Test-Path $file) -and -not $Force) { continue }
    $args2 = @()
    foreach ($i in $inputs[$name]) {
        $src = Join-Path $refs $i
        Copy-Item $src (Join-Path $dir ($name + '_in_' + $i)) -Force
        $args2 += '-i'; $args2 += (Join-Path $dir ($name + '_in_' + $i))
    }
    $ErrorActionPreference = 'Continue'
    $prompt = 'Use your image generation tool. ' + $P[$name] + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
    $null | & $exe exec --skip-git-repo-check -s workspace-write -C $dir $prompt @args2 2>$null | Select-Object -Last 3
    $ErrorActionPreference = 'Stop'
    if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
