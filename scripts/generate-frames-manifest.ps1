# Regenerate js/frames.manifest.json + js/frames.manifest.js after frame changes.
# Prefers .webp over .png for the same frame number (one entry per frame).
$projectRoot = Split-Path $PSScriptRoot -Parent

$heroDir = Join-Path $projectRoot "HERO SECTION IMAGES"
$jsonOut = Join-Path $projectRoot "js\frames.manifest.json"
$jsOut = Join-Path $projectRoot "js\frames.manifest.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

if (-not (Test-Path $heroDir)) {
  Write-Error "Folder not found: $heroDir"
  exit 1
}

$raw = Get-ChildItem $heroDir -File |
  Where-Object {
    $_.Name -match '^ezgif-frame-\d+\.(png|jpe?g|webp)$'
  }

$byFrame = @{}
foreach ($file in $raw) {
  if ($file.BaseName -notmatch '(\d+)$') { continue }
  $num = [int]$Matches[1]
  $existing = $byFrame[$num]
  if (-not $existing) {
    $byFrame[$num] = $file.Name
    continue
  }
  if ($file.Extension -eq ".webp") {
    $byFrame[$num] = $file.Name
  }
}

$files = $byFrame.GetEnumerator() |
  Sort-Object { $_.Key } |
  ForEach-Object { $_.Value }

if ($files.Count -eq 0) {
  Write-Error "No ezgif-frame-* images found in $heroDir"
  exit 1
}

$manifest = [ordered]@{
  folder = "HERO SECTION IMAGES"
  files  = @($files)
}

$mp4 = Join-Path $heroDir "hero-scroll.mp4"
$webm = Join-Path $heroDir "hero-scroll.webm"
if (Test-Path $mp4) { $manifest.videoMp4 = "HERO SECTION IMAGES/hero-scroll.mp4" }
if (Test-Path $webm) { $manifest.video = "HERO SECTION IMAGES/hero-scroll.webm" }

$json = ($manifest | ConvertTo-Json -Compress)
[System.IO.File]::WriteAllText($jsonOut, $json, $utf8NoBom)

$js = "window.IYYO_FRAME_MANIFEST = $json;`n"
[System.IO.File]::WriteAllText($jsOut, $js, $utf8NoBom)

$webpCount = ($files | Where-Object { $_ -match '\.webp$' }).Count
Write-Host "Wrote $($files.Count) frames ($webpCount webp) to:"
Write-Host "  $jsonOut"
Write-Host "  $jsOut"
