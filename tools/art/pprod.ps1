# PPROD's props drawn by Codex in the style of his T-pose picture (then Meshy image-to-3D, tools/meshy/meshy.py)
#   powershell -File tools/art/pprod.ps1     (then: python tools/art/codex_recover.py tools/art/props chair laptop)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$root = Split-Path (Split-Path $PSScriptRoot)
$out = Join-Path $PSScriptRoot 'props'
$style = Join-Path $root 'tools/art/apose/pprod.png'
$jobs = @(
  @('chair', 'A single gaming office chair for a cartoon brawler video game, in exactly the same stylized 3D render style as the attached character (smooth Pixar-like shading, clean shapes, soft studio light): a black and grey racing style gaming chair with a high backrest, a small neck pillow, armrests, a five-star base with castor wheels and a gas lift. Seen from a three quarter front view, the whole chair visible, centered, filling 85% of the canvas height. Plain pure white background, no shadow, no text, no logo, no person. Portrait canvas 1024x1536. Save it as chair.png in the current directory.'),
  @('laptop', 'A single open laptop computer for a cartoon brawler video game, in exactly the same stylized 3D render style as the attached character (smooth Pixar-like shading, clean shapes, soft studio light): a chunky dark grey gaming laptop opened at 110 degrees, a glowing screen full of green code lines on black, a keyboard with a few glowing RGB keys, stickers on the lid. Seen from a three quarter front view, the whole laptop visible, centered, filling 70% of the canvas width. Plain pure white background, no shadow, no text outside the screen, no person. Square canvas 1024x1024. Save it as laptop.png in the current directory.')
)
foreach ($j in $jobs) {
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $j[1] -i $style 2>$null | Out-Null
  if (Test-Path (Join-Path $out ($j[0] + '.png'))) { 'ok ' + $j[0] } else { 'missing ' + $j[0] }
}
