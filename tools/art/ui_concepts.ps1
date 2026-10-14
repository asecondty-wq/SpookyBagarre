# UI art direction concepts for SpookyBagarre's menus, drawn by Codex (the creator's ChatGPT account).
#   powershell -File tools/art/ui_concepts.ps1 [name ...]     (all when no name; Codex may fail to copy: codex_recover.py)
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'ui\concepts'
New-Item -ItemType Directory -Force $out | Out-Null
$common = 'Full screen video game main menu mockup, 16:9 landscape (1536x1024), for “SPOOKY BAGARRE”, a 4-player Halloween monster brawler like Super Smash Bros. Clean, detailed, crisp pixel art in the style of the best 16-bit and modern indie pixel games (Hyper Light Drifter, Owlboy, Blasphemous menus): a visible pixel grid, limited palette, hand-placed shading, dithering, no blur, no smooth gradients, no photorealism, no 3D render look. The menu shows the big title logo “SPOOKY BAGARRE” and five menu buttons with French labels exactly: “COMBAT LOCAL”, “CRÉER UN SALON”, “REJOINDRE”, “COMMENT JOUER”, “OPTIONS” (the first one highlighted as selected, with a cursor next to it). Strong personality, funny and gross, not generic, not corporate.'
$jobs = @(
  @{ n='crypt'; p='Direction “Crypte”: the buttons are carved tombstone slabs of grey-violet stone with cracks and moss, framed by bones and rusty chains; dripping candles with flames; the title is chunky blood-red letters with toxic green slime dripping, outlined in black; background: a pixel graveyard at night under a huge moon, crooked crosses, fog layers, bats. Cursor: a skeleton hand pointing. Palette: deep indigo, bone white, slime green, blood red, candle orange.' },
  @{ n='arcade'; p='Direction “Fête foraine maudite”: a haunted carnival / arcade cabinet look: buttons are wooden carnival ticket signs with light bulbs around them, striped red and cream circus tent in the background at night, pumpkins with glowing faces, cotton candy pink and poison purple, a creepy smiling moon; the title is bulb-lit marquee letters in yellow and red, slightly crooked. Cursor: a severed gloved hand. Palette: midnight purple, marquee yellow, circus red, cream, pumpkin orange, slime green accents.' },
  @{ n='comic'; p='Direction “Série B”: like a 1950s B-movie horror poster made in pixel art: big screaming hand-lettered title in yellow with a thick black outline and a red drop shadow, comic halftone dither patterns, buttons are torn poster paper strips pinned with nails, a giant monster silhouette (a frog and a shark with legs) towering over a tiny town in the background, lightning in a green sky. Cursor: a pixel bone. Palette: toxic green sky, mustard yellow, blood red, ink black, paper beige.' }
)
$only = $args
foreach ($j in $jobs) {
  if ($only.Count -and -not ($only -contains $j.n)) { continue }
  $prompt = "$common $($j.p) Save it as $($j.n).png in the current directory."
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$($j.n).png")) { "ok $($j.n)" } else { "missing $($j.n)" }
}
