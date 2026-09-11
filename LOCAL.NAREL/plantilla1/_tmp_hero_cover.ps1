$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

$newBlock = @'
.big-logo img{
      width:100vw!important;
      max-width:100vw!important;
      min-width:100vw!important;
      height:100%!important;
      max-height:100%!important;
      min-height:100%!important;
      object-fit:cover!important;
      object-position:50% 50%!important;
      display:block;
      position:absolute;
      left:0!important;
      top:0!important;
      right:0!important;
      bottom:0!important;
      transform:none!important;
      filter:drop-shadow(0 10px 50px rgba(0,0,0,.85));
    }
'@

$targets = @(
  (Join-Path $base "plantilla 1.html"),
  (Join-Path $base "public\plantilla-1.html")
)

foreach ($t in $targets) {
  if (-not (Test-Path $t)) { Write-Host "SKIP (no existe): $t"; continue; }
  $raw = [System.IO.File]::ReadAllText($t)
  # Patrón flexible: captura TODO .big-logo img{ ... } sin importar espacios / valores internos
  $pattern = '(?s)\.big-logo img\s*\{.*?\n\s*\}'
  $newRaw = [regex]::Replace($raw, $pattern, $newBlock)
  if ($newRaw -ne $raw) {
    [System.IO.File]::WriteAllText($t, $newRaw, [System.Text.UTF8Encoding]::new($false))
    Write-Host "OK CAMBIADO: $t"
  } else {
    Write-Host "SIN CAMBIOS (no matcheo): $t"
  }
}

# Muestra el bloque en el 1er archivo para verificar
$sample = [System.IO.File]::ReadAllText($targets[0])
$m = [regex]::Match($sample, '(?s)\.big-logo img\s*\{.*?\n\s*\}')
Write-Host ""
Write-Host "=== VERIFICACION (bloque final en plantilla 1.html) ==="
Write-Host $m.Value
