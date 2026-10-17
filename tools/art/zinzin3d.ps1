[CmdletBinding(PositionalBinding = $false)]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Names = @())
# Reference images (Codex, free) for the 3D giants of ZINZIN BAGARRE, turned into 3D by Meshy
# (tools/meshy/meshy.py model <name> tools/art/props3d/<name>.png --pose none, then meshy_pack.py pack_prop(<name>, 1024)).
# The whale and the duck were made the same way. Same look as props3d_b.ps1.
#   powershell -File tools/art/zinzin3d.ps1 [noms...]   (then: python tools/art/codex_recover.py tools/art/props3d)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'props3d'
$common = 'Single 3D game prop for a stylized cartoon fighting game (Super Smash Bros Ultimate look): chunky readable shapes, bold saturated colors, clean hand-painted textures, slightly exaggerated proportions. Isolated object, centered, three-quarter view from slightly above, plain pure white background, soft even studio lighting, no shadow on the ground, no text, no logo, no hands, no character. Square 1024x1024, do not resize.'
$jobs = [ordered]@{
  island = 'A small floating island of grass and rock: a lush green meadow on top with giant colourful flowers and two round trees, a craggy rock underside tapering to a point, a sparkling waterfall pouring over its edge, seen whole from the side.'
  jester = 'A hot air balloon shaped like a medieval jester hat: four puffy lobes striped red, yellow, blue and green, little golden bells on the tips, a small wicker basket hanging under it on ropes, whole and seen from the side.'
  biplane = 'A red World War One biplane in flight: two stacked wings with struts, a wooden propeller, round engine cowling, tail with a rudder, small wheels, seen from the side three-quarter, whole.'
  ghost = 'A big classic cartoon ghost floating: a white sheet with a ragged wavy hem, two dark hollow eyes and a round open mouth, arms raised spookily, glowing faintly, whole and seen from the front three-quarter.'
  hand = 'A giant skeletal hand bursting out of a mound of dark earth and grass, bony fingers clawing upward and spread wide, old yellowed bone with cracks, a little green glow between the bones, whole.'
  hovercar = 'A sleek futuristic flying car: low glossy body in dark purple with hot pink and cyan neon trim, glowing headlights, no wheels but four glowing blue hover thrusters underneath, whole and seen from the side three-quarter.'
}
if ($Names.Count -eq 0) { $Names = @($jobs.Keys) }
foreach ($n in $Names) {
  if (-not $jobs.Contains($n)) { "UNKNOWN $n"; continue }
  if (Test-Path (Join-Path $out "$n.png")) { "skip $n"; continue }
  $prompt = "Use your image generation tool. $($jobs[$n]) $common Save it as $n.png in the current directory."
  $null | & $exe exec -c 'windows.sandbox="unelevated"' --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$n.png")) { "OK $n" } else { "MISSING $n" }
}
