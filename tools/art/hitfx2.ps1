# More hit effect sprites drawn by Codex (15 Oct 2026, the juice pass): comic impacts, stars, cracks, the swipe of
# a blow, blood splats and drips, a smoke puff. Same pipeline as hitfx.ps1: flat magenta, cut out by hitfx_cut.py.
#   powershell -File tools/art/hitfx2.ps1 [name ...]     (then: python tools/art/codex_recover.py tools/art/hitfx)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'hitfx'
$base = 'Video game effect sprite for a 3D cartoon brawler like Super Smash Bros Ultimate, bold crisp flat cel-shaded shapes. No text, no letters, no character. The effect is centered with a wide empty margin and fills about 70% of the canvas. Background: perfectly flat pure magenta #FF00FF everywhere else, no shadow on it. Square 1024x1024 image, do not resize.'
$jobs = @(
  @{ n='pow'; p='A comic book impact explosion: a big jagged cloud-like starburst with a thick black outline, bright yellow inside with a hot orange inner burst and a white center, a few short speed lines around it.' },
  @{ n='stars'; p='A small cluster of five cartoon stars and round sparkle dots bursting outward from the center, white and golden yellow, thin dark outline.' },
  @{ n='crack'; p='An impact crack: sharp white crack lines radiating from a center point like broken glass, thin and jagged, with a few small flying chips, pale yellow glow.' },
  @{ n='swipe'; p='The motion trail of a fast punch: a thick curved crescent band sweeping from the lower left to the upper right, white core fading into pale violet edges, tapered ends, two thin speed lines.' },
  @{ n='splat'; p='A splash of dark red blood: a cartoon splat with irregular droplets flying out from the center, glossy dark crimson with small white highlights, no outline.' },
  @{ n='drips'; p='Cartoon blood drips: five vertical streaks of glossy dark crimson blood running down from a horizontal top edge, of different lengths, each ending in a round drop, small white highlights, no outline.' },
  @{ n='smoke'; p='One stylized cartoon smoke puff: a soft rounded cloud of four overlapping balls, pale grey-white with a slightly darker grey shading at the bottom, flat cel-shaded, no outline.' }
)
$only = $args
foreach ($j in $jobs) {
  if ($only.Count -and -not ($only -contains $j.n)) { continue }
  if (Test-Path (Join-Path $out "$($j.n).png")) { "exists $($j.n)"; continue }
  $prompt = "$($j.p) $base Save it as $($j.n).png in the current directory."
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$($j.n).png")) { "ok $($j.n)" } else { "missing $($j.n)" }
}
