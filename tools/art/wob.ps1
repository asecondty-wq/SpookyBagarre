[CmdletBinding(PositionalBinding = $false)]
param([switch]$Force, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Names = @())
# WORLD OF BAGARRE (17 Oct 2026, the new name of the game): the title art, the logo, and one painted thumbnail per arena
# (Codex, free). References are attached with -i (after the prompt: -i swallows the following files).
#   powershell -File tools/art/wob.ps1 [noms...]     -> tools/art/wob/<name>.png (then python tools/art/codex_recover.py tools/art/wob)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'wob'
New-Item -ItemType Directory -Force $out | Out-Null
$ap = Join-Path $PSScriptRoot 'apose'
$style = ' Vibrant hand-painted video game key art like Super Smash Bros Ultimate: saturated colours, dramatic lighting with strong light and deep shadows, rich detail, crisp shapes, a little absurd and funny.'
$noText = ' No text, no letters, no logo, no watermark, no frame, no border.'

$friends = @(
  @('aboueb', 'the basketball player with long curly hair'),
  @('pandrezz', 'the long-haired rocker with glasses and a blue energy ball in his hands'),
  @('tices', 'the man in a cap and tank top with a tarte flambee and a rum bottle'),
  @('jsan', 'the man with sunglasses vaping, with his shiba dog'),
  @('bido', 'the very muscular man with a dumbbell'),
  @('nymano', 'the sad skater in a black cap with his skateboard'),
  @('omfu', 'the DJ with a cowbell and a bucket of fried chicken'),
  @('lolobiscotto', 'the woman with a pastis bottle, a red chili and her grey cat'),
  @('epektase', 'the guitarist'),
  @('pprod', 'the gamer who codes on his laptop'),
  @('skanky', 'the talkative guy with a microphone, riding a skateboard'),
  @('anbuu', 'the levitating guy with big white angel wings')
)
$friendImgs = $friends | ForEach-Object {
  $p = Join-Path $ap ($_[0] + '.png')
  if (-not (Test-Path $p)) { $p = Join-Path $PSScriptRoot ('meshy\' + $_[0] + '\ref.png') }
  $p
}
$who = ($friends | ForEach-Object { $_[1] }) -join '; '

$jobs = [ordered]@{}
$jobs['title'] = @{ refs = $friendImgs; p = 'Create ONE new image, landscape 1536x1024. The title screen key art of a cartoon 3D brawler video game about a crazy all-out brawl that mixes every world: a huge, chaotic, joyful fight. In the middle background, a small cartoon planet patchworked from many worlds (a rainbow meadow with giant flowers, a haunted castle under a thunderstorm, a neon city, a smoking battlefield, a blue ocean with a whale, and outer space with a rubber duck), and a round flying saucer arena with neon rings orbiting it. On the left third and the right third, in the foreground and the middle ground, the twelve fighters shown in the attached images, each one clearly recognizable with his or her face, hair, clothes and props, mid-fight in dynamic action poses (punching, kicking, jumping, flying, throwing things at each other), with comic speed lines, impact stars and flying objects (a chair, a pizza, a guitar, a basketball, a frying pan). Keep the upper middle of the picture open sky (a logo goes there) and the central vertical band free of characters (menu buttons go there). The attached images show, in this order: ' + $who + '.' + $style + $noText }
$jobs['logo'] = @{ refs = @(); p = 'Create ONE new image, landscape 1536x1024. A video game logo that reads exactly WORLD OF BAGARRE: WORLD OF on a smaller first line, BAGARRE very big on the second line, spelled exactly like that. Chunky bold 3D cartoon letters like the Super Smash Bros and Fortnite logos, slightly tilted and dynamic: hot red to orange gradient letters with a thick dark navy outline, white highlights, small cracks; the O of WORLD is a tiny cartoon planet patchworked from many worlds; a clenched fist bursting out behind BAGARRE, yellow impact stars, speed lines and small comic explosions around the letters. The logo is centred and fills about 85 percent of the width. Background: one perfectly flat uniform pure magenta colour (#FF00FF) everywhere, no gradient, no shadow on the background. Only the logo, nothing else.' }

# the arenas: their painted world (sky) and their floor (top) as references
$arenas = [ordered]@{
  cemetery = 'a crypt slab floating over a haunted cemetery valley at night under a big moon'
  swamp = 'a giant lily pad floating on a toxic glowing swamp at night'
  elysee = 'a marble rotunda floor floating over a ghostly Paris at night'
  diner = 'a round 1950s diner floor floating over a desert highway at dusk'
  cave = 'the top of a gigantic cheese wheel inside an underground cheese cellar'
  arena = 'a monster battle stadium floor inside a haunted stadium full of ghost fans'
  village = 'a giant drum skin floating over a tropical village before dawn'
  sea = 'a raft of wooden planks on a stormy ocean with a ghost pirate ship'
  attic = 'a braided rag rug floating in an enormous dusty attic full of cats'
}
foreach ($k in $arenas.Keys) {
  $jobs['stage_' + $k] = @{ refs = @((Join-Path $root "assets/stages/$k/sky.jpg"), (Join-Path $root "assets/stages/$k/top.jpg")); p = "Create ONE new image, landscape 1536x864 (16:9). The thumbnail of an arena for the stage select screen of a cartoon fighting game: $($arenas[$k]). The round fighting platform (its floor is the SECOND attached image) floats in the middle, seen from the front and slightly above at a three quarter angle, big and clearly readable, and the world around it is the one painted in the FIRST attached image, filling the background. Make it punchy and inviting like a Super Smash Bros Ultimate stage preview." + $style + ' No characters.' + $noText }
}
$jobs['stage_mirror'] = @{ refs = @(); p = 'Create ONE new image, landscape 1536x864 (16:9). The thumbnail of an arena for the stage select screen of a cartoon fighting game: a dark round slab with glowing violet neon rings floating above a calm mirror-like sea that reflects a deep blue and violet twilight sky with stars and a thin crescent moon, the slab and the sky reflected in the water, serene and elegant. The platform floats in the middle, seen from the front and slightly above at a three quarter angle, big and clearly readable. Make it punchy and inviting like a Super Smash Bros Ultimate stage preview.' + $style + ' No characters.' + $noText }
$jobs['stage_zinzin'] = @{ refs = @((Join-Path $root 'assets/stages/zinzin/top.jpg'), (Join-Path $root 'assets/stages/zz_space/sky.jpg'), (Join-Path $root 'assets/stages/zz_prairie/sky.jpg')); p = 'Create ONE new image, landscape 1536x864 (16:9). The thumbnail of the final arena for the stage select screen of a cartoon fighting game: a round flying saucer battle platform (its floor is the FIRST attached image, with neon pink and cyan circuits and a lightning bolt) rushing at full speed out of a hyperspace tunnel of light streaks, blasting from one crazy world into the next: behind it the colourful worlds of the other attached images (outer space with a giant rubber duck and a black hole, a rainbow meadow), glowing engines under the saucer, motion and speed everywhere. The platform is in the middle, seen from the front and slightly above at a three quarter angle, big and clearly readable. Make it epic, like a Super Smash Bros Ultimate Final Destination preview.' + $style + ' No characters.' + $noText }

if ($Names.Count -eq 0) { $Names = @($jobs.Keys) }
foreach ($n in $Names) {
  if (-not $jobs.Contains($n)) { "UNKNOWN $n"; continue }
  $file = Join-Path $out ($n + '.png')
  if ((Test-Path $file) -and -not $Force) { "skip $n"; continue }
  $j = $jobs[$n]
  $prompt = 'Use your image generation tool. ' + $j.p + ' Save it as ' + $n + '.png in the current directory and do not resize it.'
  $args2 = @('exec', '-c', 'windows.sandbox="unelevated"', '--skip-git-repo-check', '-s', 'workspace-write', '-C', $out, $prompt)
  if ($j.refs.Count) { $args2 += '-i'; $args2 += $j.refs }
  $null | & $exe @args2 2>$null | Out-Null
  if (Test-Path $file) { "OK $n" } else { "MISSING $n" }
}
