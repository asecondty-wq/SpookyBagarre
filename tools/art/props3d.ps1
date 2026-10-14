# Reference images of the props (Codex, the creator's ChatGPT account), turned into 3D models by Tripo afterwards.
$exe = (Get-AppxPackage -Name OpenAI.Codex).InstallLocation + '\app\resources\codex.exe'
$out = Join-Path $PSScriptRoot 'props3d'
$common = 'Single 3D game prop for a stylized cartoon fighting game (Super Smash Bros Ultimate look): chunky readable shapes, bold saturated colors, clean hand-painted textures, slightly exaggerated proportions. Isolated object, centered, three-quarter view from slightly above, plain pure white background, soft even studio lighting, no shadow on the ground, no text, no logo, no hands, no character. Square 1024x1024, do not resize.'
$jobs = [ordered]@{
  basketball = 'An orange basketball with black seams.'
  plate = 'A round ceramic plate piled high with golden couscous topped with chunks of carrot, zucchini, chickpeas and a piece of meat.'
  peel = 'A long wooden pizza peel (baker paddle) with a flat square blade and a long handle, worn wood.'
  flamm = 'An Alsatian tarte flambee (flammekueche): a thin rectangular crispy flatbread with cream, onions and bacon bits, slightly charred edges.'
  rum = 'A dark brown glass rum bottle with a cork, standing upright, amber liquid inside.'
  ricard = 'A tall yellow-tinted glass bottle of anise pastis with a blue and yellow label without any text, standing upright.'
  chili = 'A glossy bright red chili pepper with a green stem.'
  cowbell = 'A metal cowbell (musical instrument) with a handle, brushed steel.'
  bucket = 'A fried chicken bucket with red and white vertical stripes, overflowing with crispy golden drumsticks.'
  turntable = 'A DJ turntable deck with a black vinyl record on it and a tone arm, seen from above three-quarter.'
  vape = 'A chunky vape pen device, matte black and silver with a mouthpiece.'
  sampler = 'A compact grey hardware music sampler with a grid of rubber drum pads and knobs.'
  skate = 'A skateboard with a colorful painted deck and four wheels, wheels down, seen from above three-quarter.'
  dumbbell = 'A heavy black metal dumbbell with chrome handle.'
  kettlebell = 'A black cast iron kettlebell with a thick handle.'
  barbell = 'An Olympic barbell loaded with big red weight plates on each end.'
  balloon = 'A big shiny red heart-shaped foil balloon with a string.'
  carpet = 'A flying magic carpet with ornate red, gold and blue patterns and tassels at the corners, lying flat.'
  speaker = 'A big black subwoofer speaker cabinet with one large woofer cone in front.'
  burger = 'A big juicy cartoon cheeseburger with lettuce, tomato and melted cheese.'
  grater = 'A four-sided stainless steel cheese grater with a handle on top.'
  bat = 'A wooden baseball bat, light wood with a dark grip.'
}
foreach ($n in $jobs.Keys) {
  if (Test-Path (Join-Path $out "$n.png")) { "skip $n"; continue }
  $prompt = "$($jobs[$n]) $common Save it as $n.png in the current directory."
  $null | & $exe exec --skip-git-repo-check -s workspace-write -C $out $prompt 2>$null | Out-Null
  if (Test-Path (Join-Path $out "$n.png")) { "ok $n" } else { "MISSING $n" }
}
