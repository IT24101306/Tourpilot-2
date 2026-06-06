# Resize hero PNG frames from 4K (3840x2160) to 1080p (1920x1080).
# Run: double-click resize-hero-to-1080.bat
#   or: powershell -ExecutionPolicy Bypass -File .\scripts\resize-hero-frames.ps1 -Backup

param(
  [int]$Width = 1920,
  [int]$Height = 1080,
  [switch]$Backup
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path $PSScriptRoot -Parent
$heroDir = Join-Path $projectRoot "HERO SECTION IMAGES"
$backupDir = Join-Path $heroDir "_original-4k"
$manifestScript = Join-Path $PSScriptRoot "generate-frames-manifest.ps1"
$workDir = Join-Path $env:TEMP "iyyo-hero-resize"

if (-not (Test-Path $heroDir)) {
  Write-Error "Folder not found: $heroDir"
  exit 1
}

$frames = Get-ChildItem $heroDir -File |
  Where-Object { $_.Name -match '^ezgif-frame-\d+\.png$' } |
  Sort-Object {
    if ($_.BaseName -match '(\d+)$') { [int]$Matches[1] } else { $_.Name }
  }

if ($frames.Count -eq 0) {
  Write-Error "No ezgif-frame-*.png files found in $heroDir"
  exit 1
}

Get-ChildItem $heroDir -File -Filter "_tmp_*.png" -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

if (Test-Path $workDir) {
  Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

function Clear-ReadOnly {
  param([string]$Path)
  if (Test-Path $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.IsReadOnly) {
      $item.IsReadOnly = $false
    }
  }
}

function Save-PngFile {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $ms = New-Object System.IO.MemoryStream
  try {
    $Bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
  } finally {
    $ms.Dispose()
  }

  $parent = Split-Path $Path -Parent
  if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  Clear-ReadOnly $Path
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Force
  }

  [System.IO.File]::WriteAllBytes($Path, $bytes)
}

function Resize-ImageFile {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [int]$TargetW,
    [int]$TargetH
  )

  $inputBytes = [System.IO.File]::ReadAllBytes($InputPath)
  $inputStream = New-Object System.IO.MemoryStream(,$inputBytes)
  $src = $null
  $bmp = $null
  $graphics = $null

  try {
    $src = [System.Drawing.Image]::FromStream($inputStream, $false, $false)

    if ($src.Width -eq $TargetW -and $src.Height -eq $TargetH) {
      return $false
    }

    $bmp = New-Object System.Drawing.Bitmap(
      $TargetW,
      $TargetH,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 28, 28, 28))
    $graphics.DrawImage($src, 0, 0, $TargetW, $TargetH)
    $graphics.Dispose()
    $graphics = $null

    Save-PngFile -Bitmap $bmp -Path $OutputPath
    return $true
  } finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    if ($src) { $src.Dispose() }
    if ($inputStream) { $inputStream.Dispose() }
  }
}

if ($Backup -and -not (Test-Path $backupDir)) {
  Write-Host "Backing up originals to $backupDir ..."
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  foreach ($frame in $frames) {
    Copy-Item -LiteralPath $frame.FullName -Destination (Join-Path $backupDir $frame.Name) -Force
  }
}

Write-Host "Resizing $($frames.Count) frames to ${Width}x${Height} ..."
Write-Host "Working folder: $workDir"
$done = 0
$skipped = 0
$failed = 0

foreach ($frame in $frames) {
  $tempPath = Join-Path $workDir $frame.Name

  try {
    $changed = Resize-ImageFile `
      -InputPath $frame.FullName `
      -OutputPath $tempPath `
      -TargetW $Width `
      -TargetH $Height

    if ($changed) {
      Clear-ReadOnly $frame.FullName
      Copy-Item -LiteralPath $tempPath -Destination $frame.FullName -Force
      $done++
    } else {
      $skipped++
    }
  } catch {
    $failed++
    Write-Warning "Failed on $($frame.Name): $($_.Exception.Message)"
  }

  if (($done + $skipped + $failed) % 25 -eq 0) {
    Write-Host "  $($done + $skipped + $failed) / $($frames.Count)"
  }
}

Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Done. Resized: $done, already ${Width}x${Height}: $skipped, failed: $failed"

if ($failed -gt 0) {
  Write-Error "Some frames failed. Close File Explorer / image viewers in that folder and run again."
  exit 1
}

if (Test-Path $manifestScript) {
  Write-Host "Regenerating frames manifest..."
  & $manifestScript
}

$sampleBytes = [System.IO.File]::ReadAllBytes($frames[0].FullName)
$sampleStream = New-Object System.IO.MemoryStream(,$sampleBytes)
$sample = [System.Drawing.Image]::FromStream($sampleStream)
try {
  Write-Host "Sample size: $($sample.Width)x$($sample.Height)"
} finally {
  $sample.Dispose()
  $sampleStream.Dispose()
}

Write-Host ""
Write-Host "Tip: If you use hero-scroll.mp4, rebuild it after resizing:"
Write-Host "  .\scripts\build-hero-video.ps1"
