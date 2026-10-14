# Hit effect sprites drawn by Codex (the creator's ChatGPT account), on flat magenta, cut out by hitfx_cut.py
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'hitfx'
$common = 'Video game hit effect sprite for a 3D cartoon brawler like Super Smash Bros Ultimate. Bold, crisp, flat graphic shapes with a hot white core, saturated colored rim and a thin dark outline, no text, no character, no smoke, no gradient background. The effect is centered with a wide empty margin and fills about 70% of the canvas. Background: perfectly flat pure magenta #FF00FF everywhere else. Square 1024x1024 image, do not resize.'
$jobs = @(
  @{ n='burst'; p='A punchy star-shaped impact burst: 10 sharp uneven spikes radiating from the center, white core, yellow then orange rim.' },
  @{ n='heavy'; p='A heavy smash impact: a big jagged explosive starburst with long sharp spikes, white core, hot orange and crimson rim, a few small flying shards around it.' },
  @{ n='slash'; p='A sharp slash effect: a thin crescent arc swoosh from upper left to lower right, tapered at both ends, white core and cyan-blue rim, a couple of thin speed streaks.' },
  @{ n='zap'; p='An electric hit: a burst of jagged zig-zag lightning bolts radiating from the center, white core, electric cyan and violet rim.' },
  @{ n='ring'; p='A shockwave ring seen from the front: a thin circular ring with a slightly broken uneven edge and small spikes on its outside, white with pale yellow rim, empty transparent center.' },
  @{ n='streak'; p='A launch speed streak: one long tapered horizontal comet streak pointing right, white head fading into a thin pale blue tail with two thinner parallel lines.' }
)
foreach ($j in $jobs) {
  $prompt = "$($j.p) $common Save it as $($j.n).png in the current directory."
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$($j.n).png")) { "ok $($j.n)" } else { "missing $($j.n)" }
}
