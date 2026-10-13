param([string[]]$Names = @(), [switch]$Force)
# Character reference sheets for spookyBagarre (front + side turnaround), generated with the Codex CLI
# (image_generation on the creator's ChatGPT account). They guide the Blender models and give face/texture paintings.
# Output: tools/art/refs/<id>.png
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $root 'tools/art/refs'
New-Item -ItemType Directory -Force $out | Out-Null

$style = 'Character model reference sheet for a 3D fighting game: the SAME character shown twice side by side at the same scale, on the left a FRONT view and on the right a SIDE view (profile facing right), full body from head to feet, standing in a relaxed A-pose with the arms slightly away from the body, orthographic, flat even studio lighting, plain light grey background, no cast shadow, no text, no labels, no watermark. Art style: a stylised 3D character like a modern remaster of a late-90s Nintendo 64 Rare game (Banjo-Kazooie, Conker): smooth chunky rounded shapes, big expressive cartoon eyes, bold readable silhouette, vivid saturated colours, simple clean materials with a few painted details, a slightly spooky Halloween mood. The character must look great and very recognisable.'

$who = [ordered]@{
    frog     = 'CROASSASSIN, a menacing but goofy green frog brawler standing upright on two strong legs: a squat round body with a pale cream belly, warty bright green skin with darker spots, a very wide mouth with a cocky grin, two huge bulging yellow eyes with black slit pupils on top of the head, a tattered blood-red bandana knotted around the neck, webbed four-fingered hands and big webbed feet, a few stitched scars.'
    micron   = 'PRESIDENT MICRON, a cartoon caricature of a young, very confident French head of state: a slim man in a perfectly cut navy-blue slim-fit suit, crisp white shirt and thin dark navy tie, a blue white red tricolour sash across the chest, slicked-back brown hair greying at the temples, large bright blue eyes, large ears, a huge toothy self-satisfied smile, one hand holding a fat wad of banknotes, a small white powder sachet peeking out of the breast pocket. Exaggerated big head on a thin body.'
    bubba    = 'BIG BUBBA, a gigantic obese American redneck brawler: red trucker cap with a bald eagle patch, mirrored aviator sunglasses, bushy brown beard, a stained white tank top that does not cover his huge hairy belly, sunburnt pink skin, blue jeans with a giant star belt buckle, brown cowboy boots, holding a giant cheeseburger in one hand. Massive arms, tiny head compared to the body.'
    parmesan = 'IL PARMIGIANO, a living rectangular block of Parmigiano Reggiano cheese with short arms and legs: a grainy pale golden cheese body with crystal speckles, a darker golden crust rind on the back and sides with dotted embossed lettering, an angry Italian face on the front with thick black eyebrows, fierce eyes and a big curly black moustache, white cartoon gloves, small brown leather shoes, holding a large steel box cheese grater in one hand.'
    pika     = 'PIKABOO, an original chubby yellow electric mouse creature (a monster that trains humans): round body, very long pointy ears with black tips, round red cheek pouches crackling with sparks, a zigzag lightning-bolt shaped tail with a brown base, a backwards red and white trainer cap, a small blue vest with pockets full of red and white capture balls, mischievous grin showing one tooth, slightly spooky shiny black eyes.'
    tung     = 'TUNG TUNG TUNG SAHUR, the Indonesian meme: a living vertical wooden log (a tree-trunk cylinder with brown bark and a pale round cut top), a simple carved face on the front with two big round eyes and a wide toothy grin, thin wooden arms and short wooden legs, holding a big wooden baseball bat over the shoulder. Tall and thin.'
    catlady  = 'LA MERE MICHEL, a scruffy crazy cat lady witch: a hunched skinny old woman with wild frizzy grey hair full of cat hair and twigs, a crooked patched pointy black witch hat, round cracked glasses, a long shabby moth-eaten purple cardigan with holes over a faded flowery dress, mismatched striped stockings, fluffy pink slippers, a big wart on the nose, a manic toothy grin, cat hair everywhere, a fat orange tabby cat lying around her neck like a scarf and a black kitten peeking out of her cardigan pocket.'
    shark    = 'TRALALERO TRALALA, the Italian meme: a blue great white shark standing upright on THREE muscular human legs wearing chunky blue sneakers with white soles (no logo), white belly, wide grin full of sharp teeth, small black eyes, small pectoral fins used as arms, a big dorsal fin and a tail fin. Cool and cocky.'
}

if ($Names.Count -eq 0) { $Names = @($who.Keys) }
foreach ($name in $Names) {
    $file = Join-Path $out ($name + '.png')
    if ((Test-Path $file) -and -not $Force) { continue }
    $prompt = 'Use your image generation tool. Create ONE new image, landscape 1536x1024. ' + $style + ' The character: ' + $who[$name] + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
    $ErrorActionPreference = 'Continue'
    $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Select-Object -Last 2
    $ErrorActionPreference = 'Stop'
    if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
