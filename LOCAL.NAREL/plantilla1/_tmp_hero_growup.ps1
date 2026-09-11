$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

# PRIMERO: volvemos el tamaño original (la parte INFERIOR va a QUEDARSE EN EL MISMO PUNTO)
# LUEGO: usamos un ancla de transform ABAJO. Con contain, usamos object-position + ajuste de altura.
# Truco perfecto:
#   - Dejamos width más GRANDE y height más GRANDE para que la imagen sea más grande.
#   - Usamos transform: translate(-50%, -50%) scale(1.15) transform-origin: bottom center.
#   => scale(1.15) desde el centro INFERIOR => todo el 15% adicional se COLA HACIA ARRIBA,
#      y la parte INFERIOR (L de NAREL) queda en el MISMO lugar que siempre.

$agrandarArriba = @'
.big-logo img{
      width:150vw!important;
      max-width:150vw!important;
      min-width:100%!important;
      height:auto!important;
      max-height:150vh!important;
      object-fit:contain!important;
      object-position:50% 100%!important;
      display:block;
      position:absolute;
      left:50%;
      top:0!important;
      height:140%!important;
      max-height:200vh!important;
      transform:translateX(-50%)!important;
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
  $newRaw = [regex]::Replace($raw, $pattern, $agrandarArriba)
  if ($newRaw -ne $raw) {
    [System.IO.File]::WriteAllText($t, $newRaw, [System.Text.UTF8Encoding]::new($false))
    Write-Host ("OK (agarrar ABAJO, grow HACIA ARRIBA): " + $t)
  } else {
    Write-Host ("SIN CAMBIOS: " + $t)
  }
}

# Muestra
Write-Host ""
Write-Host "=== BLOQUE APLICADO (top:0 -> crece hacia arriba, abajo igual) ==="
Write-Host $agrandarArriba
