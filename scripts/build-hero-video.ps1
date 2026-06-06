# Build a single scroll-scrub video from hero PNG frames (230 requests -> 1).
# Requires ffmpeg: winget install Gyan.FFmpeg
$projectRoot = Split-Path $PSScriptRoot -Parent
$heroDir = Join-Path $projectRoot "HERO SECTION IMAGES"
$mp4Out = Join-Path $heroDir "hero-scroll.mp4"
$manifestScript = Join-Path $PSScriptRoot "generate-frames-manifest.ps1"

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
  Write-Error "ffmpeg not found. Install with: winget install Gyan.FFmpeg"
  exit 1
}

$inputPattern = Join-Path $heroDir "ezgif-frame-%03d.webp"
if (-not (Test-Path (Join-Path $heroDir "ezgif-frame-001.webp"))) {
  $inputPattern = Join-Path $heroDir "ezgif-frame-%03d.png"
  if (-not (Test-Path (Join-Path $heroDir "ezgif-frame-001.png"))) {
    Write-Error "Missing ezgif-frame-001.webp or .png in $heroDir"
    exit 1
  }
  Write-Host "Using PNG frames (run convert-hero-to-webp.ps1 to save space)"
}

Write-Host "Encoding hero-scroll.mp4 (1920x1080, all-keyframes for smooth scrub)..."
Write-Host "This may take several minutes..."

& ffmpeg -y `
  -framerate 30 `
  -i $inputPattern `
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" `
  -c:v libx264 `
  -profile:v high `
  -pix_fmt yuv420p `
  -crf 18 `
  -g 1 `
  -keyint_min 1 `
  -movflags +faststart `
  -an `
  $mp4Out

if ($LASTEXITCODE -ne 0) {
  Write-Error "ffmpeg failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "Wrote $mp4Out"
Write-Host "Regenerating manifest..."
& $manifestScript
Write-Host "Done. Reload index.html — network requests should drop to ~12 (1 video + assets)."
