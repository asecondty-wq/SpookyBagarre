param([string[]]$Names = @(), [switch]$Force)
# Painted stage art made with the Codex CLI:
#   <stage>_top : the arena floor seen from directly above (mapped on the platform top)
#   <stage>_sky : a panoramic matte painting of the world around and below (mapped on the sky dome)
# Output: tools/art/stages/<name>.png (then tools/art/stage_prep.py makes the game textures)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $root 'tools/art/stages'
New-Item -ItemType Directory -Force $out | Out-Null

$style = ' Hand-painted stylised video game art like a modern remaster of a late-90s console fighting game: rich detail, crisp shapes, vivid saturated colours, strong spooky Halloween mood, painterly but clean. No text, no logo, no watermark, no characters, no people.'
$top = 'Create ONE new image, square 1024x1024. A video game texture seen from DIRECTLY ABOVE (orthographic top-down, no perspective, no horizon): the circular floor of a fighting-game arena. The circle is centred and fills the image edge to edge (it touches all four sides). Evenly lit from above, no cast shadows, no objects standing on it. The floor is: '
$sky = 'Create ONE new image, landscape 1536x1024. A wide panoramic matte painting for the background of a 3D fighting game, seen from HIGH ABOVE as if from a platform floating far over the scene and looking slightly down: the horizon line is at about one third from the top, the upper third is the sky, the lower two thirds show a vast landscape receding into the distance. The scene: '
$props = 'Create ONE new image, landscape 1536x1024. A sheet of SIX separate isolated props for a 3D video game background, each one complete and standing upright, seen from the front at eye level, arranged in two rows of three with wide empty space between them (they must not touch or overlap each other or the image border). Background: one perfectly flat uniform pure magenta colour (#FF00FF) everywhere, no gradient, no floor, no shadow, no reflection, no ground plane. The props are: '
$P = [ordered]@{
    cemetery_top = $top + 'an ancient round crypt slab of grey-violet stone flagstones, cracked and weathered, concentric carved rings of occult runes, a large engraved moon and skull sigil in the centre, moss in the cracks, wax drips from melted candles, a few dead leaves.' + $style
    cemetery_sky = $sky + 'an endless haunted cemetery valley at night: thousands of tombstones and crosses on rolling hills, gothic mausoleums, a ruined cathedral on a far hill, twisted dead trees, green ghost wisps, banks of fog between the hills; a giant pale moon low in a violet sky with torn clouds.' + $style
    swamp_top = $top + 'a giant lily pad, vivid green with radiating veins, waxy sheen, dew drops, darker rim, a few tiny glowing toxic green spots and little mushrooms near the edge.' + $style
    swamp_sky = $sky + 'a toxic bayou swamp at night: black-green water with glowing green reflections, giant purple and violet mushrooms, cypress trees draped with hanging moss, swarms of fireflies, a crooked shack on stilts, will-o-wisps, a sickly green moon behind mist.' + $style
    elysee_top = $top + 'a round rotunda floor of a haunted palace: polished white and grey marble with gold inlays, a big blue, white and red rosette star pattern in the centre, a gold laurel ring, faint ghostly cracks glowing pale blue.' + $style
    elysee_sky = $sky + 'a ghostly Paris at night: endless grey zinc rooftops and chimneys, a spectral iron tower glowing pale blue, the river with ghost boats, a grand palace with blue white red ghost lights, purple fog and a huge moon.' + $style
    diner_top = $top + 'a round 1950s diner floor: black and white checkerboard tiles inside a ring of red vinyl and chrome, a big colourful neon-style burger emblem in the centre, ketchup and mustard stains, crumbs and a few fries.' + $style
    diner_sky = $sky + 'an American desert highway at dusk turning to night: a glowing neon roadside diner, a motel sign, giant saguaro cacti, a lonely road with truck headlights, red mesas under an orange and purple sky with a huge rising moon, 1950s mood, slightly sinister.' + $style
    cave_top = $top + 'the top of a gigantic wheel of aged hard cheese: pale golden grainy crumbly surface with tiny white crystals, faint concentric cutting rings, a slightly darker rind band at the very edge with a stamped dotted pattern.' + $style
    cave_sky = $sky + 'a gigantic underground cheese aging cellar: endless wooden shelves stacked with golden cheese wheels descending into darkness, vaulted brick arches, torches and candles, warm light beams through dust, cobwebs.' + $style
    arena_top = $top + 'a round stadium arena floor for monster battles: purple and white turf, a big stylised capture-ball emblem (a circle split purple over white with a dark band and a white button) in the centre, white boundary lines and a starting ring, scuff marks.' + $style
    arena_sky = $sky + 'a giant haunted stadium bowl at night packed with glowing ghost spectators, huge floodlights, purple and white banners, confetti in the air, fireworks bursting in the night sky above the stands.' + $style
    village_top = $top + 'the stretched skin of a gigantic traditional wooden drum: cream and tan mottled leather, a thick carved wooden rim with tropical floral motifs and a ring of wooden pegs, faint drumstick marks in the centre.' + $style
    village_sky = $sky + 'a tropical Indonesian village before dawn: wooden houses on stilts with warm lanterns, coconut palms, rice terraces, a winding river, little torches moving along paths, a distant dome silhouette, deep blue sky with the first light of dawn on the horizon.' + $style
    sea_top = $top + 'a big round raft deck of weathered wooden planks lashed with ropes, barnacles and salt stains, a painted shark skull emblem in the centre, wet sheen.' + $style
    sea_sky = $sky + 'a stormy ocean at night: huge dark waves with white foam, a ghost pirate ship with torn glowing sails, forks of lightning in heavy clouds, a lighthouse on a rock, shark fins in the foam.' + $style
    attic_top = $top + 'a large round braided rag rug: concentric braided rings in faded purple, mustard, rust red and teal, a little cat hair and a few loose yarn threads, slightly dusty.' + $style
    cemetery_props = $props + 'a weeping stone angel statue on a plinth, a leaning stone cross tombstone with moss, a rounded tombstone with a carved skull, a twisted dead tree with bare branches, a wrought iron cemetery lantern on a post glowing green, a small gothic mausoleum with a glowing green doorway.' + $style
    swamp_props = $props + 'a cluster of giant glowing purple mushrooms, a mossy cypress tree with hanging moss, a clump of cattail reeds, a crooked wooden warning sign with a skull, a hollow tree stump with two glowing yellow eyes inside, a half-sunken rotten rowboat.' + $style
    diner_props = $props + 'a retro neon roadside sign on a tall pole with an arrow, a giant soda cup with a straw, a tall saguaro cactus, a 1950s red gas pump, a cow skull on a wooden post, a chrome jukebox glowing.' + $style
    cave_props = $props + 'a big wooden barrel, a tall stack of golden cheese wheels, an old wooden cheese press, an iron lantern on a hook stand with a flame, a crate of dusty bottles, a stone pillar with a burning torch.' + $style
    arena_props = $props + 'a tall stadium floodlight tower, a purple and white banner on a pole, a giant golden trophy cup, a pyramid stack of purple and white capture balls, a ghostly cheering ghost spectator with a foam finger, a scoreboard on legs.' + $style
    village_props = $props + 'a tall coconut palm tree, a wooden slit drum hanging in a carved wooden frame, a woven bamboo lantern on a post glowing warm, a small wooden hut on stilts with a thatched roof, a stack of rice sheaves, a long wooden canoe standing on its end against a post.' + $style
    sea_props = $props + 'a jagged sea rock with a seagull nest, a broken ship mast with a torn ragged sail, a red and white buoy with a bell, a giant purple kraken tentacle rising from foam, a floating wooden barrel with ropes, a small stone lighthouse with a glowing lamp.' + $style
    attic_props = $props + 'an armchair covered with a dusty white sheet, a tall grandfather clock, an antique birdcage on a stand, a tall stack of old travel trunks, a dressmaker mannequin, an old wooden rocking horse.' + $style
    elysee_props = $props + 'an ornate Parisian wrought iron street lamp glowing, a stone lion statue on a plinth, a marble column with a golden capital, a ghostly tricolour flag on a gilded pole, a gilded garden urn with flowers, a small floating cloud with a golden balustrade.' + $style
    attic_sky = $sky + 'the inside of an enormous dusty attic at night seen from up under the roof: wooden rafters and beams, piles of trunks and boxes, old furniture under white sheets, birdcages, dozens of cats with glowing yellow eyes on the beams, a big round window with the moon, cobwebs, moonbeams through dust.' + $style
}

if ($Names.Count -eq 0) { $Names = @($P.Keys) }
foreach ($name in $Names) {
    $file = Join-Path $out ($name + '.png')
    if ((Test-Path $file) -and -not $Force) { continue }
    $ErrorActionPreference = 'Continue'
    $prompt = 'Use your image generation tool. ' + $P[$name] + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
    $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Select-Object -Last 3
    $ErrorActionPreference = 'Stop'
    if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
