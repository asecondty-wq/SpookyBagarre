# Pieces of the "Crypte" menu art (pixel art), drawn by Codex with the chosen concept as style reference.
#   powershell -File tools/art/ui_crypt.ps1 [name ...]     (all when no name; then: python tools/art/codex_recover.py tools/art/ui/crypt)
# Output in tools/art/ui/crypt/ on flat magenta; tools/art/ui_cut.py turns them into the game's pixel art (assets/ui/crypt/).
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$root = Split-Path (Split-Path $PSScriptRoot)
$out = Join-Path $PSScriptRoot 'ui\crypt'
New-Item -ItemType Directory -Force $out | Out-Null
$style = Join-Path $PSScriptRoot 'ui\concepts\crypt.png'
$key = 'Background: perfectly flat pure magenta #FF00FF everywhere else (no shadow on the ground, no gradient), so it can be cut out.'
$px = 'Crisp detailed 16-bit pixel art exactly in the style, palette and pixel size of the attached crypt graveyard game menu picture: visible pixel grid, thick dark outline, hand-placed shading, dithering, cool violet moonlight from the upper right and warm orange candle light from below. No blur, no smooth gradient, no 3D render look, no text.'
$char = 'Pixel art full-body sprite of the character in the second attached image (keep his or her face, hair, beard, glasses, skin tone, clothes and colors clearly recognizable), drawn as a chunky cartoon fighter of a Halloween brawler game. Standing in a confident, funny fighting idle pose, three-quarter view facing to the right. The character fills about 85% of the canvas height, centered, nothing cut off. Portrait canvas 1024x1536.'
$jobs = @(
  @{ n='aboueb'; ref='tools/art/apose/aboueb.png'; p="$char He spins a basketball on one finger; his huge curly hair flows like whips." },
  @{ n='pandrezz'; ref='tools/art/apose/pandrezz.png'; p="$char He charges a glowing blue energy ball between his hands, rocker attitude." },
  @{ n='tices'; ref='tools/art/apose/tices.png'; p="$char He holds a flammekueche (Alsatian tarte flambée) like a frisbee in one hand and a bottle of rum in the other." },
  @{ n='jsan'; ref='tools/art/apose/jsan.png'; p="$char He blows a big cloud of vape smoke from a vape pen; his fluffy orange shiba dog sits proudly at his feet." },
  @{ n='bido'; ref='tools/art/apose/bido.png'; p="$char He flexes one huge bicep and holds a heavy dumbbell; a few small pink hearts float around him." },
  @{ n='nymano'; ref='tools/art/apose/nymano.png'; p="$char He looks very sad with big tears streaming down his cheeks, a skateboard under his arm." },
  @{ n='omfu'; ref='tools/art/apose/omfu.png'; p="$char DJ attitude: big headphones around his neck, a cowbell in one hand and a bucket of fried chicken in the other." },
  @{ n='lolobiscotto'; ref='tools/art/apose/lolobiscotto.png'; p="$char She holds a bottle of Ricard pastis and a red chili pepper; her little grey and white cat sits on her shoulder." },
  @{ n='bg'; p='Background plate only, landscape canvas 1536x1024: the night graveyard of the first attached image, without any title, button, character, candle or foreground object: dark violet night sky with clouds, a huge full moon at the upper right, a haunted castle on a hill, layers of misty tombstones, crooked crosses and dead trees, a wide cobblestone crypt floor across the lower third. Keep the center of the image calmer and darker (a menu goes there). The image fills the whole canvas edge to edge.' },
  @{ n='fg'; p="Foreground frame only, landscape canvas 1536x1024, for a parallax menu: on the far left a ruined stone crypt pillar with moss, green slime drips and a torn red banner with a skull, a cluster of dripping candles; at the bottom left a big skull, bones and a jack-o-lantern; on the far right a large tombstone with a carved skull, candles, a jack-o-lantern and a black cat with glowing green eyes; along the bottom edge rubble, bones and small green slime puddles. The whole center and the top of the canvas stay EMPTY flat magenta. $key" },
  @{ n='logo'; p="The game title logo only: the words SPOOKY (first line) and BAGARRE (second line), huge chunky blood-red pixel letters with cracks and a thick black outline, toxic green slime oozing over the top of the letters and dripping down, the second O of SPOOKY replaced by a small skull. Landscape canvas 1536x1024, the logo fills 90% of the width. $key" },
  @{ n='button'; p="One wide menu button with no text: a horizontal carved grey-violet stone tombstone slab, about 5 times wider than tall, with small cracks, a little moss, a tiny carved skull at each end and a short rusty chain hanging at each side. Landscape canvas 1536x1024, the slab fills 90% of the width, centered. $key" },
  @{ n='slime'; p="One long horizontal strip of toxic green slime oozing and dripping downward (glossy, with bright highlights and darker green shading), to lay over the top edge of a menu button: a wavy band along the top with 6 to 9 drips of different lengths hanging down. Landscape canvas 1536x1024, the strip fills 90% of the width. $key" },
  @{ n='hand'; p="A skeleton hand pointing to the right with its index finger, the other bones curled, a bit of torn sleeve at the wrist, bone white with violet shading and a thick dark outline. Square canvas 1024x1024, the hand fills 80% of the width. $key" },
  @{ n='fresco'; layout='tools/art/ui/crypt_layout.png'; refs=@('aboueb','pandrezz','tices','jsan','bido','nymano','omfu','lolobiscotto'); p='Repaint the FIRST attached image (a rough layout) as ONE cohesive, finished pixel art illustration: the background of a game menu. Keep exactly the same composition, framing and the position, size and pose of every element: the crypt with the hooded skeleton and the red banner on the left, the moon and the castle at the upper right, the tombstone with the skull on the right, the candles, pumpkins, skulls and bones, the cobblestone path, and the eight characters where they are. The characters must look PAINTED INTO the scene, not pasted on it: the same pixel size, palette and outline as the scenery, lit by the same cool violet moonlight from the upper right and warm orange candle light from below, with soft cast shadows on the ground and low fog passing in front of their feet. Keep every character clearly recognizable, the later attached images show each of them (in this order: the basketball player with long curly hair, the rocker with the blue energy ball, the man perched on the crypt ledge with a tarte flambée and a rum bottle, the man vaping with his shiba dog, the muscular man with the dumbbell, the sad crying skater sitting on top of the tombstone, the DJ with the cowbell and the bucket of chicken, the woman with the pastis bottle, the chili and her grey cat). Keep the central vertical band of the picture (where the menu buttons go) free of characters. No text, no logo, no buttons, no frame. Landscape canvas 1536x1024 filling the whole canvas edge to edge.' },
  @{ n='fresco2'; same='fresco' },
  @{ n='slab'; p='A full screen heavy stone tomb door, landscape canvas 1536x1024, filling the whole canvas edge to edge: big grey-violet stone blocks with cracks and moss, a carved border, a large engraved skull with crossed bones in the center, a few cobwebs in the corners, lit by a dim violet light. No text.' }
)
$only = $args
foreach ($j in $jobs) {
  if ($j.same) { $k = $jobs | Where-Object { $_.n -eq $j.same } | Select-Object -First 1; $j = @{ n = $j.n; p = $k.p; layout = $k.layout; refs = $k.refs } } # a second try of the same picture
  if ($only.Count -and -not ($only -contains $j.n)) { continue }
  if (Test-Path (Join-Path $out "$($j.n).png")) { "exists $($j.n)"; continue }
  $imgs = @()
  if ($j.layout) { $imgs += (Join-Path $root $j.layout) }
  $imgs += $style
  if ($j.ref) { $imgs += (Join-Path $root $j.ref) }
  foreach ($r in @($j.refs)) { if ($r) { $imgs += (Join-Path $root "tools/art/apose/$r.png") } }
  $prompt = "$px $($j.p) Save it as $($j.n).png in the current directory."
  # the prompt before -i: --image takes several files and would swallow it
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt -i $imgs 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$($j.n).png")) { "ok $($j.n)" } else { "missing $($j.n)" }
}
