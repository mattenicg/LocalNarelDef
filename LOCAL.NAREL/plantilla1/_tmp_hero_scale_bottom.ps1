$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

# MÉTODO QUE NUNCA FALLA: scale(1.3) con anclaje ABAJO =
# - La parte INFERIOR (L de NAREL) se QUEDA EXACTAMENTE en el MISMO lugar
# - Todo el 30% más grande se agranda HACIA ARRIBA (sin mover nada)
# - Usamos object-fit:contain, width 150vw original. Nada se mueve de lugar.

$growUpSafe = @'
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
      transform-origin:50% 100%!important;
      transform:translate(-50%,-50%) scale(1.3)!important;
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
  $newRaw = [regex]::Replace($raw, $pattern, $growUpSafe)
  if ($newRaw -ne $raw) {
    [System.IO.File]::WriteAllText($t, $newRaw, [System.Text.UTF8Encoding]::new($false))
    Write-Host ("OK (scale 1.3, origen ABAJO = agranda SÓLO HACIA ARRIBA): " + $t)
  } else {
    Write-Host ("SIN CAMBIOS: " + $t)
  }
}

Write-Host ""
Write-Host "=== BLOQUE APLICADO (método infalible: scale + origin bottom) ==="
Write-Host $growUpSafe
