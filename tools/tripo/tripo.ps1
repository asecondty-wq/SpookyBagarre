# Tripo API helper with a credit floor (Windows PowerShell 5.1).
# The API key is read from TRIPO_API_KEY (process, then Windows user variable);
# it is never written to the project. Every paid task is refused when the
# balance minus its estimate would fall under -Floor, and is logged with its
# real cost (consumed_credit) in tools/tripo/ledger.jsonl (spookyBagarre).
#
#   tripo.ps1 balance
#   tripo.ps1 image -Id windmill -Prompt "..." -Out art_proposals/lake_tripo
#   tripo.ps1 timage -Id gravure -Image <reference png> -Prompt "..." -Out <dir> [-TPose]
#   tripo.ps1 model -Id windmill -Image <png> -Out assets/maps/mode7/lake/models [-Texture standard] [-Faces 8000] [-Version P1-20260311]
#   tripo.ps1 rigcheck -Task <model task id>                      (free)
#   tripo.ps1 rig -Id gravure -Task <model task id> -Out <dir>
#   tripo.ps1 retarget -Id clergy_anims -Task <rig task id> -Animations "preset:biped:idle,preset:biped:slash" -Out <dir> [-InPlace] [-Geometry]
#   tripo.ps1 fetch -Task <task id> -Id windmill -Out <dir>     (resume a download)
param(
    [Parameter(Position=0,Mandatory=$true)][ValidateSet('balance','image','timage','model','rigcheck','rig','retarget','fetch')][string]$Command,
    [string]$Id,
    [string]$Prompt,
    [string]$Negative='',
    [string]$Image,
    [string]$Out,
    [string]$Task,
    [string]$Version='v3.0-20250812',
    [ValidateSet('standard','detailed')][string]$Texture='standard',
    [int]$Faces=16000,
    [switch]$Pbr,
    [ValidateSet('text_to_image','generate_image')][string]$ImageType='text_to_image',
    [string]$ImageModel='',
    [switch]$TPose,
    [string]$Template='',
    [string]$Style='',
    [string]$RigVersion='v1.0-20240301',
    [ValidateSet('tripo','mixamo')][string]$Spec='tripo',
    [string]$Animations='',
    [switch]$InPlace,
    [switch]$Geometry,
    [int]$Floor=450,
    [int]$Estimate=0
)
$ErrorActionPreference='Stop'
$Api='https://api.tripo3d.ai/v2/openapi'
$Root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Ledger=Join-Path $PSScriptRoot 'ledger.jsonl'
$Key=$env:TRIPO_API_KEY
if (-not $Key) { $Key=[Environment]::GetEnvironmentVariable('TRIPO_API_KEY','User') }
if (-not $Key) { throw 'TRIPO_API_KEY is not set.' }
$Headers=@{Authorization="Bearer $Key"}

function Get-Balance {
    $r=Invoke-RestMethod -Uri "$Api/user/balance" -Headers $Headers -Method Get
    if ($r.code -ne 0) { throw "Balance request failed: $($r | ConvertTo-Json -Compress)" }
    return [int]$r.data.balance
}
function Assert-Budget([int]$cost) {
    $balance=Get-Balance
    if ($balance-$cost -lt $Floor) {
        throw "Refused: balance $balance - estimate $cost would fall under the floor ${Floor}."
    }
    Write-Host "Balance $balance, estimate $cost, floor ${Floor}: allowed."
    return $balance
}
function Resolve-Path2([string]$path) {
    if ([IO.Path]::IsPathRooted($path)) { return $path }
    return Join-Path $Root $path
}
function Resolve-Out([string]$dir) {
    if (-not $dir) { throw '-Out is required.' }
    $path=Resolve-Path2 $dir
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    return $path
}
function Submit([hashtable]$body) {
    $json=$body | ConvertTo-Json -Depth 6 -Compress
    $r=Invoke-RestMethod -Uri "$Api/task" -Headers $Headers -Method Post -ContentType 'application/json' -Body $json
    if ($r.code -ne 0) { throw "Task refused: $($r | ConvertTo-Json -Compress)" }
    Write-Host "Task $($r.data.task_id) submitted ($($body.type))."
    return $r.data.task_id
}
function Wait-Task([string]$taskId) {
    $deadline=(Get-Date).AddMinutes(20)
    while ($true) {
        $r=Invoke-RestMethod -Uri "$Api/task/$taskId" -Headers $Headers -Method Get
        $d=$r.data
        if ($d.status -eq 'success') { return $d }
        if (@('failed','cancelled','banned','expired','unknown') -contains $d.status) {
            throw "Task $taskId ended: $($d.status)"
        }
        if ((Get-Date) -gt $deadline) { throw "Task $taskId still $($d.status) after 20 minutes; resume with fetch." }
        Start-Sleep -Seconds 4
    }
}
# Uploads a local image (free) and returns the file object for a task body.
function Upload-Image([string]$path) {
    $full=Resolve-Path2 $path
    $upload=& curl.exe -s -X POST "$Api/upload" -H "Authorization: Bearer $Key" -F "file=@$full" | ConvertFrom-Json
    if ($upload.code -ne 0) { throw "Upload failed: $($upload | ConvertTo-Json -Compress)" }
    $type=([IO.Path]::GetExtension($full)).TrimStart('.').ToLower()
    if ($type -eq 'jpeg') { $type='jpg' }
    return @{type=$type;file_token=$upload.data.image_token}
}
# Downloads every URL of the task output: model/pbr_model -> <id>.glb,
# rendered_image -> <id>_preview.<ext>, generated_image/image -> <id>_ref.<ext>.
function Save-Output($data,[string]$name,[string]$dir) {
    $saved=@()
    foreach ($p in $data.output.PSObject.Properties) {
        $url=[string]$p.Value
        if ($url -notmatch '^https?://') { continue }
        $ext=([IO.Path]::GetExtension(([Uri]$url).AbsolutePath)).ToLower()
        switch -Regex ($p.Name) {
            '^(pbr_model|model|base_model)$' { $file="$name$ext"; if ($ext -eq '') { $file="$name.glb" }; if ($p.Name -eq 'base_model' -and ($data.output.model -or $data.output.pbr_model)) { $file=$null } }
            '^rendered_image$' { $file="${name}_preview$ext" }
            default { $file="${name}_ref$ext" }
        }
        if (-not $file) { continue }
        $target=Join-Path $dir $file
        Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing
        $saved+=$target
        Write-Host "Saved $($p.Name) -> $target"
    }
    foreach ($p in $data.output.PSObject.Properties) {
        if ([string]$p.Value -notmatch '^https?://') { Write-Host "Output $($p.Name) = $($p.Value)" }
    }
    return $saved
}
function Write-Ledger($data,[string]$name,$extra) {
    $entry=[ordered]@{time=(Get-Date).ToString('s');id=$name;task=$data.task_id;type=$data.type;
        consumed_credit=$data.consumed_credit;balance_after=(Get-Balance)}
    foreach ($k in $extra.Keys) { $entry[$k]=$extra[$k] }
    $line=($entry | ConvertTo-Json -Compress -Depth 6)+"`n"
    [IO.File]::AppendAllText($Ledger,$line,(New-Object Text.UTF8Encoding($false)))
    Write-Host "Cost: $($data.consumed_credit) credits, balance now $($entry.balance_after)."
}

switch ($Command) {
    'balance' { Write-Host "Balance: $(Get-Balance)" }
    'image' {
        if (-not $Id -or -not $Prompt) { throw '-Id and -Prompt are required.' }
        $dir=Resolve-Out $Out
        Assert-Budget ($(if ($Estimate) { $Estimate } else { 20 })) | Out-Null
        $body=@{type=$ImageType;prompt=$Prompt}
        if ($Negative) { $body.negative_prompt=$Negative }
        $taskId=Submit $body
        $data=Wait-Task $taskId
        Save-Output $data $Id $dir | Out-Null
        Write-Ledger $data $Id @{prompt=$Prompt}
    }
    'timage' {
        # generate_image from a reference picture, optionally turned into a T-pose.
        if (-not $Id -or -not $Image) { throw '-Id and -Image are required.' }
        $dir=Resolve-Out $Out
        Assert-Budget ($(if ($Estimate) { $Estimate } else { 50 })) | Out-Null
        $body=@{type='generate_image'}
        # A second picture sets the rendering style (multi-reference generation).
        if ($Style) { $body.files=@((Upload-Image $Image),(Upload-Image $Style)) } else { $body.file=(Upload-Image $Image) }
        if ($Prompt) { $body.prompt=$Prompt }
        if ($TPose) { $body.t_pose=$true }
        if ($Template) { $body.template=$Template }
        if ($ImageModel) { $body.model_version=$ImageModel }
        $taskId=Submit $body
        $data=Wait-Task $taskId
        Save-Output $data $Id $dir | Out-Null
        Write-Ledger $data $Id @{image=$Image;prompt=$Prompt;t_pose=[bool]$TPose;template=$Template;style=$Style;model_version=$ImageModel}
    }
    'model' {
        if (-not $Id -or -not $Image) { throw '-Id and -Image are required.' }
        $dir=Resolve-Out $Out
        Assert-Budget ($(if ($Estimate) { $Estimate } else { 60 })) | Out-Null
        $body=@{type='image_to_model';model_version=$Version;file=(Upload-Image $Image);
            texture=$true;pbr=[bool]$Pbr;texture_quality=$Texture;face_limit=$Faces;
            orientation='align_image';texture_alignment='original_image'}
        $taskId=Submit $body
        $data=Wait-Task $taskId
        Save-Output $data $Id $dir | Out-Null
        Write-Ledger $data $Id @{image=$Image;version=$Version;texture=$Texture;faces=$Faces;pbr=[bool]$Pbr}
    }
    'rigcheck' {
        if (-not $Task) { throw '-Task is required.' }
        $taskId=Submit @{type='animate_prerigcheck';original_model_task_id=$Task}
        $data=Wait-Task $taskId
        Write-Host "Riggable: $($data.output.riggable), rig type: $($data.output.rig_type), cost $($data.consumed_credit)."
    }
    'rig' {
        if (-not $Id -or -not $Task) { throw '-Id and -Task are required.' }
        $dir=Resolve-Out $Out
        Assert-Budget ($(if ($Estimate) { $Estimate } else { 30 })) | Out-Null
        $taskId=Submit @{type='animate_rig';original_model_task_id=$Task;model_version=$RigVersion;
            out_format='glb';rig_type='biped';spec=$Spec}
        $data=Wait-Task $taskId
        Save-Output $data $Id $dir | Out-Null
        Write-Ledger $data $Id @{model_task=$Task;rig_version=$RigVersion;spec=$Spec}
    }
    'retarget' {
        if (-not $Id -or -not $Task -or -not $Animations) { throw '-Id, -Task and -Animations are required.' }
        $list=@($Animations.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        if ($list.Count -gt 5) { throw 'At most five animations per task.' }
        $dir=Resolve-Out $Out
        Assert-Budget ($(if ($Estimate) { $Estimate } else { 10*$list.Count })) | Out-Null
        $body=@{type='animate_retarget';original_model_task_id=$Task;out_format='glb';bake_animation=$true;
            export_with_geometry=[bool]$Geometry;animate_in_place=[bool]$InPlace}
        if ($list.Count -eq 1) { $body.animation=$list[0] } else { $body.animations=$list }
        $taskId=Submit $body
        $data=Wait-Task $taskId
        Save-Output $data $Id $dir | Out-Null
        Write-Ledger $data $Id @{rig_task=$Task;animations=($list -join ',');in_place=[bool]$InPlace;geometry=[bool]$Geometry}
    }
    'fetch' {
        if (-not $Task -or -not $Id) { throw '-Task and -Id are required.' }
        $dir=Resolve-Out $Out
        $data=Wait-Task $Task
        Save-Output $data $Id $dir | Out-Null
        Write-Host "Task $Task cost $($data.consumed_credit) credits (not logged again)."
    }
}
