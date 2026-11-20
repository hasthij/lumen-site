# Renders Lumen's REAL UI offscreen with the app's own snapshot switches and writes transparent PNGs to ..\shots.
# Run from anywhere:  powershell -File C:\Main\lumen-site\tools\capture.ps1
$ErrorActionPreference = 'Stop'
$repo  = 'C:\Main\Lumen'
$site  = Split-Path $PSScriptRoot -Parent
$shots = Join-Path $site 'shots'
$tmp   = Join-Path $env:TEMP 'lumen-shots'
New-Item -ItemType Directory -Force $shots, $tmp | Out-Null

Push-Location $repo
cargo build --release -p lumen
Pop-Location
$exe = Join-Path $repo 'target\release\lumen.exe'
$env:LUMEN_SNAP_ALPHA = '1'

function Snap($name, [string[]]$argv, $pad = 0) {
  $bmp = Join-Path $tmp "$name.bmp"
  & $exe @argv $bmp
  if ($LASTEXITCODE -ne 0) { Write-Warning "$name failed (exit $LASTEXITCODE)"; return }
  node (Join-Path $PSScriptRoot 'bmp2png.mjs') $bmp (Join-Path $shots "$name.png") $pad
}

# Island, every tab (clipboard is skipped on purpose: it would show your real history)
foreach ($t in 'media','sound','launch','system','notes') {
  # --island-snapshot <tab> <out>: pass tab then out
  $bmp = Join-Path $tmp "island-$t.bmp"
  & $exe --island-snapshot $t $bmp
  if ($LASTEXITCODE -eq 0) { node (Join-Path $PSScriptRoot 'bmp2png.mjs') $bmp (Join-Path $shots "island-$t.png") 24 }
  else { Write-Warning "island-$t failed (exit $LASTEXITCODE)" }
}

# Clock and launcher (launcher query is typed into the real launcher UI)
Snap 'clock' @('--snapshot') 8
# LUMEN_SNAP_CLEAN hides file/folder/window results so no personal names reach the site.
# One frame per keystroke: type-a-0..7 ("spotify"), type-b-0..7 ("=24*7+3").
$env:LUMEN_SNAP_CLEAN = '1'
foreach ($set in @(@('a','spotify'), @('b','=24*7+3'))) {
  $q = $set[1]
  for ($i = 0; $i -le $q.Length; $i++) {
    $name = "type-$($set[0])-$i"
    $bmp = Join-Path $tmp "$name.bmp"
    & $exe --launcher-snapshot $q.Substring(0, $i) $bmp
    if ($LASTEXITCODE -eq 0) { node (Join-Path $PSScriptRoot 'bmp2png.mjs') $bmp (Join-Path $shots "$name.png") 8 }
  }
}

# Settings window, every page
foreach ($p in 'general','appearance','island','launcher','taskbar') {
  $bmp = Join-Path $tmp "settings-$p.bmp"
  & $exe --settings-snapshot $p $bmp
  if ($LASTEXITCODE -eq 0) { node (Join-Path $PSScriptRoot 'bmp2png.mjs') $bmp (Join-Path $shots "settings-$p.png") 0 }
}
Write-Host "Done. Screenshots in $shots"
