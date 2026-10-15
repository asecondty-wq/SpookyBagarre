# Skanky's props drawn by Codex in the style of his model (then Meshy image-to-3D, tools/meshy/meshy.py --pose none)
#   powershell -File tools/art/skanky.ps1     (then: python tools/art/codex_recover.py tools/art/props train skateboard)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$root = Split-Path (Split-Path $PSScriptRoot)
$out = Join-Path $PSScriptRoot 'props'
$style = Join-Path $root 'tools/art/meshy/skanky/ref.png'
$jobs = @(
  @('train', 'A single French regional commuter train car for a cartoon brawler video game, in exactly the same stylized 3D render style as the attached character (smooth Pixar-like shading, clean chunky shapes, soft studio light): the front car of a modern TER train, white and blue body with a red stripe, a big rounded windshield with two headlights, a few side windows and doors, a little graffiti tag on the side, on its bogies with wheels. Seen from a three quarter front side view, the whole car visible, centered, filling 90% of the canvas width. Plain pure white background, no rails, no shadow, no text, no logo, no person. Landscape canvas 1536x1024. Save it as train.png in the current directory.'),
  @('skateboard', 'A single skateboard for a cartoon brawler video game, in exactly the same stylized 3D render style as the attached character (smooth Pixar-like shading, clean chunky shapes, soft studio light): a worn street skateboard deck with black grip tape on top, kicked up nose and tail, a red and black graphic under the deck, silver trucks and four creamy white wheels. Seen from a three quarter top side view so the deck, the trucks and the wheels all show, centered, filling 85% of the canvas width. Plain pure white background, no shadow, no text, no logo, no person. Landscape canvas 1536x1024. Save it as skateboard.png in the current directory.')
)
foreach ($j in $jobs) {
  if (Test-Path (Join-Path $out ($j[0] + '.png'))) { 'exists ' + $j[0]; continue }
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $j[1] -i $style 2>$null | Out-Null
  if (Test-Path (Join-Path $out ($j[0] + '.png'))) { 'ok ' + $j[0] } else { 'missing ' + $j[0] }
}
