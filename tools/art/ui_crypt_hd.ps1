# The "Crypte" menu art again, as polished painted illustration (high definition, no pixel art), drawn by Codex:
# the pixel art fresco as the layout (same composition: src/ui/crypt.js keeps its gag points), the friends' T-pose
# pictures for their faces.
#   powershell -File tools/art/ui_crypt_hd.ps1 [name ...]   (then: python tools/art/codex_recover.py tools/art/ui/crypt_hd)
# Output in tools/art/ui/crypt_hd/ (magenta background for the cut-out pieces); tools/art/ui_hd.py --paint brings
# them into the game (assets/ui/crypt/hd/).
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$root = Split-Path (Split-Path $PSScriptRoot)
$out = Join-Path $PSScriptRoot 'ui\crypt_hd'
New-Item -ItemType Directory -Force $out | Out-Null
$layout = Join-Path $PSScriptRoot 'ui\crypt\fresco2.png'
$key = 'Background: perfectly flat pure magenta #FF00FF everywhere else (no shadow, no gradient), so it can be cut out.'
$paint = 'Polished high definition digital painting, premium cartoon video game key art: smooth painterly shading, rich detail, soft rim lights, crisp clean shapes, characters in the same stylized 3D cartoon look as the attached character pictures (big expressive faces). NOT pixel art: no visible pixels, no pixel grid, no dithering, no chunky outlines. Spooky Halloween graveyard mood, cool violet moonlight from the upper right and warm orange candle light from below. No text unless asked.'
$jobs = @(
  @{ n='fresco'; refs=@('aboueb','pandrezz','tices','jsan','bido','nymano','omfu','lolobiscotto'); p='Repaint the FIRST attached image (a pixel art game menu background) as ONE cohesive finished painted illustration in high definition. Keep exactly the same composition and framing, and the position, size and pose of every element: the crypt with the hooded skeleton and the red skull banner on the left, the full moon and the castle at the upper right, the tombstone with the carved skull on the right, the candles, pumpkins, skulls, bones and green slime, the cobblestone path, and the eight characters exactly where they are. The characters are painted into the scene, lit by the same lights, with soft shadows and low fog at their feet. Keep every character clearly recognizable: the later attached images show each of them, in this order: the basketball player with long curly hair spinning a ball, the rocker with the blue energy ball, the man perched on the crypt ledge with a tarte flambee and a rum bottle, the man vaping with his shiba dog, the muscular man with the dumbbell, the sad crying skater sitting on top of the tombstone, the DJ with the cowbell and the bucket of chicken, the woman with the pastis bottle, the chili and her grey cat. Keep the central vertical band free of characters (menu buttons go there). No text, no logo, no buttons, no frame. Landscape canvas 1536x1024 filling the whole canvas edge to edge.' },
  @{ n='logo'; p="The game title logo only: the words SPOOKY (first line) and BAGARRE (second line), huge chunky glossy blood-red 3D cartoon letters with cracks and a thick dark outline, toxic green slime oozing over the top of the letters and dripping down, the second O of SPOOKY replaced by a small cartoon skull. Landscape canvas 1536x1024, the logo fills 90% of the width. $key" },
  @{ n='button'; p="One wide menu button with no text: a horizontal carved grey-violet stone tombstone slab, about 4.3 times wider than tall, with small cracks, a little moss, a tiny carved skull at each end and a short rusty chain hanging at each side. Landscape canvas 1536x1024, the slab fills 90% of the width, centered. $key" },
  @{ n='slime'; p="One long horizontal strip of glossy toxic green slime oozing and dripping downward (bright highlights, darker green shading), to lay over the top edge of a menu button: a wavy band along the top with 6 to 9 drips of different lengths hanging down. Landscape canvas 1536x1024, the strip fills 90% of the width. $key" },
  @{ n='hand'; p="A cartoon skeleton hand pointing to the right with its index finger, the other bones curled, a bit of torn dark sleeve at the wrist, bone white with soft violet shading. Square canvas 1024x1024, the hand fills 80% of the width. $key" },
  @{ n='slab'; p='A full screen heavy stone tomb door, landscape canvas 1536x1024, filling the whole canvas edge to edge: big grey-violet stone blocks with cracks and moss, a carved border, a large engraved skull with crossed bones in the center, a few cobwebs in the corners, lit by a dim violet light.' }
)
$only = $args
foreach ($j in $jobs) {
  if ($only.Count -and -not ($only -contains $j.n)) { continue }
  if (Test-Path (Join-Path $out "$($j.n).png")) { "exists $($j.n)"; continue }
  $imgs = @()
  if ($j.n -eq 'fresco') { $imgs += $layout }
  foreach ($r in @($j.refs)) { if ($r) { $imgs += (Join-Path $root "tools/art/apose/$r.png") } }
  if (-not $imgs.Count) { $imgs += (Join-Path $root 'tools/art/apose/pprod.png') }
  $prompt = "$paint $($j.p) Save it as $($j.n).png in the current directory."
  # the prompt before -i: --image takes several files and would swallow it
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt -i $imgs 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$($j.n).png")) { "ok $($j.n)" } else { "missing $($j.n)" }
}
