param([string[]]$Names = @(), [switch]$Force)
# The seven friends of the creator as 3D cartoon fighters, made with the Codex CLI (text descriptions taken from
# their photos; a photo dropped in tools/art/friends/<id>.jpg|png is passed to Codex as a reference when present).
#   <id>       : front A-pose, empty hands, plain background (Tripo image_to_model input) -> tools/art/apose/
#   shiba, greycat : creatures (J'san's dog, Lolobiscotto's cat) -> tools/art/props/
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$apose = Join-Path $root 'tools/art/apose'
$propsDir = Join-Path $root 'tools/art/props'
$photos = Join-Path $root 'tools/art/friends'
New-Item -ItemType Directory -Force $apose, $propsDir | Out-Null

$look = ' Stylised 3D cartoon render like a modern remaster of a late-90s console party fighting game: smooth rounded shapes, slightly big head, big expressive eyes, exaggerated but recognisable features, vivid colours, rich detailed materials (fabric folds, stitching, hair strands as chunky sculpted locks). Neutral even studio lighting, plain light grey background, no cast shadow, no text, no letters, no numbers, no logo, no watermark. Centred with a small margin all around, the character fills most of the height.'
$pose = ' Full body from head to feet, seen from the front with a slight three-quarter turn to the left (about 20 degrees), standing in a clean A-pose: arms straight and held away from the body at about 45 degrees, hands open and EMPTY with fingers slightly spread, legs straight and slightly apart, feet flat. Nothing held, nothing on the back, the arms are clear of the body and of the hair.'
$P = [ordered]@{
    aboueb = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. He wears a sleeveless basketball jersey (red with gold trim, no number) instead of the tank top, matching basketball shorts and high-top basketball sneakers. His long curly hair is gathered in a long thick curly ponytail down his back.' + $pose + $look
    tices = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. Wide baggy jeans with a belt, sneakers.' + $pose + $look
    omfu = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. Stocky rounded body, wide black trousers, sneakers.' + $pose + $look
    lolobiscotto = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. High-waisted light blue jeans and white sneakers below the top of the photo.' + $pose + $look
    jsan = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. Beige chino trousers and white sneakers below the top of the photo.' + $pose + $look
    nymano = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. He is ALWAYS sad: droopy teary eyes, eyebrows raised in the middle, a trembling pout, one tear on the cheek. Dark baggy jeans and skate shoes below the top of the photo.' + $pose + $look
    bido = 'Create ONE new image, portrait 1024x1536. The real person in the attached photo, remade as a 3D cartoon fighter: keep his or her likeness exactly (face shape, skin tone, eyes, hair, beard, glasses or sunglasses, cap, jewellery, the clothes of the photo), just stylised as a cartoon. A very muscular bodybuilder body with big arms, the t-shirt stretched on his muscles, a dreamy seductive smile.' + $pose + $look
    shiba = 'Create ONE new image, square 1024x1024. A cute shiba inu dog as a 3D cartoon creature: a cream and light sesame beige coat with white cheeks, chest and paws, pointy ears, a tightly curled fluffy tail over the back, a happy confident face. Standing on its four legs, seen from the side with a slight three-quarter turn toward the viewer, head turned toward the viewer. Nothing in its mouth, no collar text.' + $look
    greycat = 'Create ONE new image, square 1024x1024. A small cat as a 3D cartoon creature: dark charcoal grey fur with a white chest, white paws and a white muzzle, big yellow eyes, a cheeky look. Standing on its four legs, seen from the side with a slight three-quarter turn toward the viewer, tail up.' + $look
}

if ($Names.Count -eq 0) { $Names = @($P.Keys) }
foreach ($name in $Names) {
    $dir = if ($name -eq 'shiba' -or $name -eq 'greycat') { $propsDir } else { $apose }
    $file = Join-Path $dir ($name + '.png')
    if ((Test-Path $file) -and -not $Force) { "SKIP $name"; continue }
    $args2 = @()
    foreach ($ext in @('jpg', 'jpeg', 'png', 'webp')) {
        $ph = Join-Path $photos ($name + '.' + $ext)
        if (Test-Path $ph) { $args2 += '-i'; $args2 += $ph; break }
    }
    $extra = ''
    $ErrorActionPreference = 'Continue'
    $prompt = 'Use your image generation tool. ' + $P[$name] + $extra + ' Save it as ' + $name + '.png in the current directory and do not resize it.'
    $null | & $exe exec --skip-git-repo-check -s workspace-write -C $dir $prompt @args2 2>$null | Select-Object -Last 3
    $ErrorActionPreference = 'Stop'
    if (Test-Path $file) { "OK $name" } else { "MISSING $name" }
}
