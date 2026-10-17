[CmdletBinding(PositionalBinding = $false)]
param([string]$Model = '', [switch]$Force, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Names = @())
# Painted art for ZINZIN BAGARRE (Codex, free): the arena flies through eight worlds.
#   zz_<monde>_sky   : the world ahead, a wide matte painting (behind the arena, crossfaded from one world to the next)
#   zz_<monde>_props : six props on flat magenta, cut out by tools/art/cutout.py, flying past as cards
#   zz_<monde>_ground: the ground far below, a seamless texture seen from above, scrolling under the flight
#   zinzin_top       : the arena floor seen from above
# Output: tools/art/stages/<name>.png, then: python tools/art/stage_prep.py <id> ; python tools/art/cutout.py <id>
#   powershell -File tools/art/zinzin.ps1 [-Model <modèle Codex>] [noms...]   (la sandbox Windows « elevated » plantait : unelevated)
#     (then python tools/art/codex_recover.py tools/art/stages)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $root 'tools/art/stages'
New-Item -ItemType Directory -Force $out | Out-Null

$style = ' Hand-painted stylised video game art like a modern remaster of a late-90s console fighting game (Super Smash Bros Ultimate quality): rich detail, crisp shapes, vivid saturated colours, epic and a little absurd, dramatic chiaroscuro lighting with strong light sources and deep shadows, painterly but clean. No text, no letters, no logo, no watermark, no characters, no people.'
$top = 'Create ONE new image, square 1024x1024. A video game texture seen from DIRECTLY ABOVE (orthographic top-down, no perspective, no horizon): the circular floor of a fighting-game arena. The circle is centred and fills the image edge to edge (it touches all four sides). Evenly lit from above, no cast shadows, no objects standing on it. The floor is: '
$sky = 'Create ONE new image, landscape 1536x1024. A wide panoramic matte painting for the background of a 3D fighting game, seen from HIGH ABOVE as if from a platform flying very fast far over the scene and looking ahead toward the horizon: the horizon line is at about one third from the top, the upper third is the sky, the lower two thirds show a vast landscape receding into the distance, with a strong vanishing point in the middle. The scene: '
$ground = 'Create ONE new image, square 1024x1024. A SEAMLESS TILEABLE texture (the left edge continues the right edge and the top edge continues the bottom edge perfectly, no visible seam, no border, no vignette), seen from DIRECTLY ABOVE from very high altitude (orthographic, no perspective, no horizon, no sky), evenly lit, for the ground scrolling far below a flying arena in a video game. The ground is: '
$props = 'Create ONE new image, landscape 1536x1024. A sheet of SIX separate isolated props for a 3D video game background, each one complete, seen from the front at eye level, arranged in two rows of three with wide empty space between them (they must not touch or overlap each other or the image border). Background: one perfectly flat uniform pure magenta colour (#FF00FF) everywhere, no gradient, no floor, no shadow, no reflection, no ground plane. The props are: '
$P = [ordered]@{
  zinzin_top = $top + 'the deck of a flying battle saucer: dark polished obsidian and gunmetal plates, glowing cyan and hot pink circuit lines running in concentric rings, a big glowing zigzag lightning bolt emblem inside a ring in the centre, small rivets, a faint holographic grid, slightly worn by fights.' + $style
  zz_prairie_sky = $sky + 'a magical rainbow meadow world at sunrise: rolling hills of candy-coloured grass covered with giant glowing flowers, enormous spotted mushrooms, floating grassy islands with waterfalls pouring into the sky, huge rainbow arches, crystal lakes, golden god rays through pastel clouds, a giant ringed planet low in the pink sky.' + $style
  zz_music_sky = $sky + 'a crazy medieval musical kingdom at golden sunset: castles whose towers are giant organ pipes, trumpets and violins, a bridge shaped like a piano keyboard across a river, villages of houses shaped like drums and lutes, colourful banners, rivers of glowing golden musical notes winding through the valley, stained-glass coloured clouds.' + $style
  zz_war_sky = $sky + 'an epic battlefield in full war seen from the sky at dusk: endless trenches and craters, columns of tanks, cannons firing with orange muzzle flashes, burning ruined villages, biplanes in dogfights, searchlight beams sweeping, red flares, huge orange explosions on the horizon under a dark brooding red sky.' + $style
  zz_castle_sky = $sky + 'a giant haunted gothic castle on jagged cliffs during a violent purple thunderstorm: towers and spires with glowing windows, forks of lightning, swarms of bats, a moat of dark water, a winding road through a dead forest, ghost lights, deep black shadows and purple light.' + $style
  zz_cemetery_sky = $sky + 'a terrifying endless cemetery valley under a huge blood red moon: thousands of crooked tombstones, open graves, giant skeletal hands rising out of the ground, green ghost fire, mausoleums, dead trees, low green fog in the hollows, very dark and scary.' + $style
  zz_abyss_sky = $sky + 'a deep ocean abyss: glowing bioluminescent jellyfish swarms, a giant whale swimming in the distance, coral cities glowing in cyan and magenta, a gigantic sunken ship, beams of light coming down from the surface far above, bubbles, dark blue depths.' + $style
  zz_neon_sky = $sky + 'a futuristic neon megacity at night: endless skyscrapers with glowing pink, cyan and yellow neon lights, giant holograms of fish and dragons, flying cars in streams of light, highways in the air, rain glints, a huge glowing moon behind the towers.' + $style
  zz_space_sky = $sky + 'a chaotic absurd outer space: planets made of cheese, donuts and watermelon, a giant rubber duck floating among asteroids, a swirling black hole with a glowing accretion disc, a rainbow nebula, floating toilets and teacups, comets, galaxies, everything vivid and silly.' + $style
  zz_prairie_ground = $ground + 'a magical rainbow meadow seen from high above: patches of candy-coloured grass in pink, mint and lime, fields of tiny flowers in stripes of bright colours, small winding sparkling blue streams, little red spotted mushroom dots, tiny round trees.' + $style
  zz_music_ground = $ground + 'medieval farmland seen from high above, shaped like music: fields laid out like piano keys in cream and dark brown, golden paths curving like sheet music staves with little note-shaped hedges, tiny castles and windmills, a winding river.' + $style
  zz_war_ground = $ground + 'a battlefield seen from high above: churned brown mud, round shell craters, zigzag trenches, lines of barbed wire, tank tracks, small glowing orange fires and embers scattered, scorched dark patches.' + $style
  zz_castle_ground = $ground + 'a haunted dark forest seen from high above at night: canopies of dead purple-grey trees, rocky outcrops, a black winding river with purple reflections, wisps of violet mist, a few tiny glowing yellow windows of cottages.' + $style
  zz_cemetery_ground = $ground + 'a dense cemetery seen from high above at night: neat rows of small grey tombstones and crosses, dark green-black grass, pale gravel paths, a few open graves, small green glowing ghost lights scattered.' + $style
  zz_abyss_ground = $ground + 'the deep ocean floor seen from above: pale blue sand with ripples covered by bright shimmering caustic light patterns, patches of glowing cyan and pink coral, shells, small rocks, dark blue shadows.' + $style
  zz_neon_ground = $ground + 'a futuristic megacity seen from directly above at night: a dense grid of dark rooftops, streets glowing with pink and cyan light trails of traffic, rooftop neon signs as colourful shapes without letters, helipads with lights, tiny glowing windows.' + $style
  zz_prairie_props = $props + 'a giant rainbow flower with a glowing heart, a big red spotted glowing mushroom, a small floating grassy island with a waterfall pouring from it, a lollipop tree with swirly candy leaves, a big pink crystal cluster, a giant blue butterfly with open wings.' + $style
  zz_music_props = $props + 'a medieval castle tower shaped like a giant golden trumpet, a round castle tower shaped like a giant red drum, a golden harp as tall as a tree, a giant wooden lute standing upright, a medieval banner pole with a striped flag, a hot air balloon shaped like a jester hat with bells.' + $style
  zz_war_props = $props + 'a green World War One tank, a red biplane in flight, a field cannon firing a big orange flash, a barricade of sandbags and barbed wire, a ruined burning house, a grey zeppelin airship.' + $style
  zz_castle_props = $props + 'a gothic stone tower with glowing yellow windows, a stone gargoyle on a pillar, a dead tree full of bats, a floating candelabra with lit candles, a white ghost with glowing eyes, a crumbling stone bridge arch.' + $style
  zz_cemetery_props = $props + 'a giant skeletal hand rising out of a mound of earth, a crooked tombstone with a glowing green crack, a small stone mausoleum with a green glowing door, a creepy scarecrow, a wooden coffin standing upright half open, an iron lantern with a green flame on a post.' + $style
  zz_abyss_props = $props + 'a big glowing pink jellyfish, an anglerfish with a glowing lure, a tall glowing coral tower, a small sunken wooden shipwreck, a giant purple squid tentacle, an open treasure chest full of glowing gold.' + $style
  zz_neon_props = $props + 'a slim skyscraper covered in pink and cyan neon lights, a flying car with glowing blue thrusters, a holographic glowing koi fish, a tall radio tower with blinking red lights, a blimp with a glowing screen showing only colourful shapes, a giant neon palm tree.' + $style
  zz_space_props = $props + 'a small planet made of cheese with holes, a giant yellow rubber duck, a white toilet floating, a pink frosted donut planet with sprinkles, a classic silver flying saucer with lights, a cow wearing a round astronaut helmet.' + $style
}

if ($Names.Count -eq 0) { $Names = @($P.Keys) }
foreach ($name in $Names) {
  if (-not $P.Contains($name)) { "UNKNOWN $name"; continue }
  $file = Join-Path $out ($name + '.png')
  if ((Test-Path $file) -and -not $Force) { continue }
  $ErrorActionPreference = 'Continue'
  $prompt = 'Use your image generation tool. ' + $P[$name] + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
  $extra = @('-c', 'windows.sandbox="unelevated"'); if ($Model) { $extra += @('-m', $Model) }
  $null | & $exe exec @extra --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Select-Object -Last 3
  $ErrorActionPreference = 'Stop'
  if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
