param([string[]]$Names = @(), [switch]$Force)
# Front A-pose images for the 3D models (Tripo image_to_model input), made with the Codex CLI from the reference
# sheets in tools/art/refs. Empty hands (props are modelled separately in Blender), arms away from the body,
# legs apart, plain background: this is what rigs well. Output: tools/art/apose/<id>.png
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$refs = Join-Path $root 'tools/art/refs'
$out = Join-Path $root 'tools/art/apose'
New-Item -ItemType Directory -Force $out | Out-Null

$common = 'Create ONE new image, portrait 1024x1536. The SAME character as in the attached reference sheet (same design, same proportions, same colours, same materials, same face and expression), shown ALONE, once, full body from head to feet, seen from the front with a slight three-quarter turn to the left (about 20 degrees), standing in a clean A-pose: arms straight and held away from the body at about 45 degrees, hands open and EMPTY with fingers slightly spread (no object in the hands), legs straight and slightly apart, feet flat. Neutral studio lighting, soft and even, plain light grey background, no cast shadow, no text, no logo, no watermark. Centred with a small margin all around, the character fills most of the height. High quality stylised 3D render.'

$extra = [ordered]@{
    frog     = ' Keep the red bandana, the scars and the spots.'
    micron   = ' Keep the tricolour sash, the suit and the white powder sachet in the breast pocket; NO banknotes in the hands.'
    bubba    = ' Keep the cap, the aviator sunglasses, the beard, the tank top, the belt buckle and the boots; NO burger in the hands.'
    parmesan = ' Keep the gloves, the shoes, the moustache and the rind with dotted lettering; NO grater in the hands.'
    pika     = ''
    tung     = ' Keep the carved face; NO baseball bat, the bat is removed.'
    shark    = ' Keep the three legs with sneakers, the fins and the tail; the pectoral fins are held away from the body like arms.'
    catlady  = ' Keep the witch hat, the glasses, the cardigan, the dress, the stockings, the slippers, the orange cat around her neck and the kitten in the pocket; she stands upright (not hunched) so the arms and legs are clear.'
}
$pikaPrompt = 'Create ONE new image, portrait 1024x1536. An ORIGINAL cartoon creature for a 3D party fighting game, a spooky little monster that trains humans: a chubby round ghost-hamster with soft glowing pale lavender fur, small ROUND ears, huge shiny black eyes with white sparkles, glowing electric BLUE cheek patches with tiny sparks, a short wavy ghost tail ending in a small blue flame wisp, a cocky grin showing one fang, wearing a backwards purple and white baseball cap and a small black vest with pockets full of little purple and white balls. Full body from head to feet, seen from the front with a slight three-quarter turn to the left, standing in a clean A-pose: short arms held away from the body, paws open and EMPTY, legs slightly apart. Stylised 3D render like a modern remaster of a late-90s console game, smooth rounded shapes, vivid colours, Halloween mood. Neutral even studio lighting, plain light grey background, no shadow, no text, no logo, no watermark. Centred, the creature fills most of the height.'

if ($Names.Count -eq 0) { $Names = @($extra.Keys) }
foreach ($name in $Names) {
    $file = Join-Path $out ($name + '.png')
    if ((Test-Path $file) -and -not $Force) { continue }
    $ErrorActionPreference = 'Continue'
    if ($name -eq 'pika') {
        $prompt = 'Use your image generation tool. ' + $pikaPrompt + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
        $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Select-Object -Last 3
    } else {
        Copy-Item (Join-Path $refs ($name + '.png')) (Join-Path $out ($name + '_ref.png')) -Force
        $prompt = 'Use your image generation tool. ' + $common + $extra[$name] + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
        $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt -i (Join-Path $out ($name + '_ref.png')) 2>$null | Select-Object -Last 3
    }
    $ErrorActionPreference = 'Stop'
    if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
