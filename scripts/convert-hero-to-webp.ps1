# Convert hero PNG frames to lossless WebP (smaller files, zero quality loss).
# Requires cwebp: winget install --id Google.Libwebp
#
# Usage:
#   .\scripts\convert-hero-to-webp.ps1 -Backup          # keep PNG backup, keep both
#   .\scripts\convert-hero-to-webp.ps1 -Backup -RemovePng   # backup then delete PNGs

param(
  [switch]$Backup,
  [switch]$RemovePng,
  [ValidateSet("Lossless", "NearLossless")]
  [string]$Mode = "Lossless"
)

$ErrorActionPreference = "Stop"

function Find-Cwebp {
  $cmd = Get-Command cwebp -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cwebp.exe"
  )

  $wingetPkg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "cwebp.exe" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($wingetPkg) { $candidates += $wingetPkg.FullName }

  foreach ($path in $candidates) {
    if ($path -and (Test-Path $path)) { return $path }
  }

  return $null
}

$projectRoot = Split-Path $PSScriptRoot -Parent
$heroDir = Join-Path $projectRoot "HERO SECTION IMAGES"
$backupDir = Join-Path $heroDir "_original-png"
$manifestScript = Join-Path $PSScriptRoot "generate-frames-manifest.ps1"
$projectsData = Join-Path $projectRoot "js\projects-data.js"
$workDir = Join-Path $env:TEMP "iyyo-webp-convert"

$cwebpPath = Find-Cwebp
if (-not $cwebpPath) {
  Write-Error @"
cwebp not found.

Install Google's WebP tools, then open a NEW PowerShell window and run again:
  winget install --id Google.Libwebp
"@
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

if ($Backup -and -not (Test-Path $backupDir)) {
  Write-Host "Backing up PNGs to $backupDir ..."
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  $frames | Copy-Item -Destination $backupDir
}

if (Test-Path $workDir) {
  Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

function Get-WebpArgSets {
  param([string]$ModeName)

  if ($ModeName -eq "Lossless") {
    return ,@(
      @("-lossless", "-m", "4", "-mt"),
      @("-lossless", "-m", "2", "-low_memory"),
      @("-lossless", "-z", "3", "-m", "0", "-low_memory", "-noasm")
    )
  }

  return ,@(
    @("-q", "100", "-m", "4", "-mt"),
    @("-q", "100", "-m", "2", "-low_memory"),
    @("-q", "100", "-m", "0", "-low_memory", "-noasm")
  )
}

function Convert-FrameToWebp {
  param(
    [string]$CwebpPath,
    [System.IO.FileInfo]$Frame,
    [string]$TempPath,
    [string]$ModeName
  )

  if ((Test-Path $TempPath) -and ((Get-Item $TempPath).Length -gt 0)) {
    Remove-Item $TempPath -Force
  }

  foreach ($webpArgs in (Get-WebpArgSets $ModeName)) {
    $argList = @($webpArgs + @("-quiet", $Frame.FullName, "-o", $TempPath))
    & $CwebpPath @argList
    if ($LASTEXITCODE -eq 0 -and (Test-Path $TempPath) -and ((Get-Item $TempPath).Length -gt 0)) {
      return $true
    }
    if (Test-Path $TempPath) { Remove-Item $TempPath -Force -ErrorAction SilentlyContinue }
  }

  return $false
}
Write-Host "Converting $($frames.Count) PNG frames to WebP ($Mode) ..."
Write-Host "Tool: $cwebpPath"

$done = 0
$skipped = 0
$failed = 0
$beforeBytes = ($frames | Measure-Object -Property Length -Sum).Sum

foreach ($frame in $frames) {
  $outName = [System.IO.Path]::ChangeExtension($frame.Name, ".webp")
  $outPath = Join-Path $heroDir $outName
  $tempPath = Join-Path $workDir $outName

  if ((Test-Path $outPath) -and ((Get-Item $outPath).Length -gt 0)) {
    $skipped++
    if (($done + $skipped + $failed) % 25 -eq 0) {
      Write-Host "  $($done + $skipped + $failed) / $($frames.Count)"
    }
    continue
  }

  if (Convert-FrameToWebp -CwebpPath $cwebpPath -Frame $frame -TempPath $tempPath -ModeName $Mode) {
    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    Move-Item -LiteralPath $tempPath -Destination $outPath -Force
    $done++
  } else {
    $failed++
    Write-Warning "Failed on $($frame.Name) after low-memory retries."
  }

  if (($done + $skipped + $failed) % 25 -eq 0) {
    Write-Host "  $($done + $skipped + $failed) / $($frames.Count)"
  }
}

Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue

$webpFiles = Get-ChildItem $heroDir -File -Filter "ezgif-frame-*.webp"
$afterBytes = ($webpFiles | Measure-Object -Property Length -Sum).Sum
$savedPct = if ($beforeBytes -gt 0) {
  [math]::Round((1 - ($afterBytes / $beforeBytes)) * 100, 1)
} else { 0 }

Write-Host ""
Write-Host "Converted: $done, skipped (already exist): $skipped, failed: $failed"
Write-Host ("PNG total:  {0:N1} MB" -f ($beforeBytes / 1MB))
Write-Host ("WebP total: {0:N1} MB" -f ($afterBytes / 1MB))
Write-Host ("Space saved: {0}% (lossless - no quality loss)" -f $savedPct)

$webpCount = ($webpFiles | Measure-Object).Count
if ($failed -gt 0 -or $webpCount -lt $frames.Count) {
  Write-Error "Missing WebP frames: have $webpCount, expected $($frames.Count). Close other apps and run again."
  exit 1
}

if ($RemovePng) {
  Write-Host "Removing original PNG frames..."
  $frames | Remove-Item -Force
}

if (Test-Path $projectsData) {
  $text = [System.IO.File]::ReadAllText($projectsData)
  $updated = $text -replace 'HERO SECTION IMAGES/ezgif-frame-(\d+)\.png', 'HERO SECTION IMAGES/ezgif-frame-$1.webp'
  if ($updated -ne $text) {
    [System.IO.File]::WriteAllText($projectsData, $updated, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Updated js/projects-data.js image paths to .webp"
  }
}

Write-Host "Regenerating manifest..."
& $manifestScript

Write-Host ""
Write-Host "Done. Hard refresh the site (Ctrl+Shift+R)."
if (-not $RemovePng) {
  Write-Host "Tip: PNGs are still on disk. Re-run with -RemovePng to delete them after verifying the site."
}
