# More prop reference images (Codex, free) for the big animation pass (16 Oct 2026), turned into 3D by Meshy
# (tools/meshy/meshy.py model <name> tools/art/props3d/<name>.png --pose none). Same look as props3d.ps1.
#   powershell -File tools/art/props3d_b.ps1    (then: python tools/art/codex_recover.py tools/art/props3d)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'props3d'
$common = 'Single 3D game prop for a stylized cartoon fighting game (Super Smash Bros Ultimate look): chunky readable shapes, bold saturated colors, clean hand-painted textures, slightly exaggerated proportions. Isolated object, centered, three-quarter view from slightly above, plain pure white background, soft even studio lighting, no shadow on the ground, no text, no logo, no hands, no character. Square 1024x1024, do not resize.'
$jobs = [ordered]@{
  cap = 'A beige baseball cap with a curved dark brown brim and a small button on top, seen from the side three-quarter, empty.'
  poop = 'A cartoon dog poop: a brown swirl pile shaped like soft serve, glossy, with two small flies, cute and funny.'
  coin = 'A single big shiny gold coin, thick, with a raised star in the middle, standing on its edge slightly tilted.'
  coinpile = 'A small heap of shiny gold coins, about a dozen, stacked and scattered in a loose pile.'
  billwad = 'A thick wad of green banknotes folded and held by a rubber band, slightly fanned out.'
  diamond = 'A big brilliant cut diamond gem, pale blue and white, sparkling facets, standing on its point.'
  goldbar = 'A heavy shiny gold ingot bar, trapezoid shape, with a few small engraved lines.'
  monitor = 'A flat black computer monitor screen on a short stand, the screen showing a glowing blue code editor.'
  crtpc = 'An old 1990s beige desktop computer with a bulky CRT monitor on top of the tower case, chunky and retro.'
  mic = 'A classic handheld stage microphone: black handle and a round silver mesh head, slightly tilted.'
}
foreach ($n in $jobs.Keys) {
  if (Test-Path (Join-Path $out "$n.png")) { "skip $n"; continue }
  $prompt = "$($jobs[$n]) $common Save it as $n.png in the current directory."
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$n.png")) { "ok $n" } else { "MISSING $n" }
}
