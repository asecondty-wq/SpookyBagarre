# Epektase's guitar, drawn by Codex in the style of his T-pose picture (then Meshy image-to-3D, tools/meshy/meshy.py)
#   powershell -File tools/art/epektase.ps1     (then: python tools/art/codex_recover.py tools/art/props guitar)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$root = Split-Path (Split-Path $PSScriptRoot)
$out = Join-Path $PSScriptRoot 'props'
$style = Join-Path $root 'tools/art/apose/epektase.png'
$prompt = 'A single electric guitar for a cartoon brawler video game, in exactly the same stylized 3D render style as the attached character (smooth Pixar-like shading, clean shapes, soft studio light): a heavy metal electric guitar with a pointed V-shaped body, glossy black body with a blood red bevel, chrome hardware, six strings, a long neck with white skull-shaped fret inlays and a pointy headstock. Seen straight from the front, standing upright, the whole guitar visible, centered, filling 85% of the canvas height. Plain pure white background, no shadow, no text, no hand, no person. Portrait canvas 1024x1536. Save it as guitar.png in the current directory.'
$null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt -i $style 2>$null | Out-Null
if (Test-Path (Join-Path $out 'guitar.png')) { 'ok guitar' } else { 'missing guitar' }
