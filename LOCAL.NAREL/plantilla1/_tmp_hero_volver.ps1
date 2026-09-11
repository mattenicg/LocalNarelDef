$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

$backBlock = @'
.big-logo img{
      width:150vw!important;
      max-width:150vw!important;
      min-width:100%!important;
      height:auto!important;
      max-height:150vh!important;
      object-fit:contain!important;
      display:block;
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      filter:drop-shadow(0 10px 50px rgba(0,0,0,.85));
    }
'@

$targets = @(
  (Join-Path $base "plantilla 1.html"),
  (Join-Path $base "public\plantilla-1.html")
)

foreach ($t in $targets) {
  if (-not (Test-Path $t)) { continue; }
  $raw = [System.IO.File]::ReadAllText($t)
  $pattern = '(?s)\.big-logo img\s*\{.*?\n\s*\}'
  $newRaw = [regex]::Replace($raw, $pattern, $backBlock)
  if ($newRaw -ne $raw) {
    [System.IO.File]::WriteAllText($t, $newRaw, [System.Text.UTF8Encoding]::new($false))
    Write-Host ("OK RESTAURADO: " + $t)
  } else {
    Write-Host ("SIN CAMBIOS: " + $t)
  }
}

Write-Host ""
Write-Host "=== BLOQUE RESTAURADO (como estaba antes) ==="
$sample = [System.IO.File]::ReadAllText($targets[0])
$m = [regex]::Match($sample, '(?s)\.big-logo img\s*\{.*?\n\s*\}')
Write-Host $m.Value
