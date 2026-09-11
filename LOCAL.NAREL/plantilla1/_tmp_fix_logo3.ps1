$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"
$imgSrc = '/assets/img/logo-ngl-diamond.jpeg'
$fallback1 = '/logo_1.jpeg'
$fallback2 = '/logo%20solo.jpeg'

# Imagen final con onerror MUY simple (sin entidades HTML, sin chain raro)
# src1 -> si rompe -> fallback1 -> si rompe -> fallback2 -> si rompe -> se oculta (para no mostrar icono roto)
$simpleOnerror = "this.onerror=null;this.src='$fallback1';this.addEventListener('error',function(){this.onerror=null;this.src='$fallback2';this.addEventListener('error',function(){this.style.display='none';});});"
$newImg = "<img src=`"$imgSrc`" alt=`"`" style=`"width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;background:#000;`" onerror=`"$simpleOnerror`" />"

$countAll = 0
$files = Get-ChildItem -Path $base -Filter "*.html" -Recurse
foreach ($f in $files) {
  $raw = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $raw

  # Reemplazar CUALQUIER <img ... logo-n[gl]-diamond ...> (png o jpeg) por la versión nueva simple
  $raw = [regex]::Replace($raw, '<img\s+[^>]*logo-n[gl]-diamond\.(png|jpeg)[^>]*>', ($newImg))

  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $raw, [System.Text.UTF8Encoding]::new($false))
    $countAll++
  }
}
"ACTUALIZADOS onerror simple: $countAll archivos"

# Quick check 1 archivo
$sample = [System.IO.File]::ReadAllText((Join-Path $base "login.html"))
$sample = $sample.Substring($sample.IndexOf('<div class="logo-circle">'), 420)
Write-Host ""
Write-Host "MUESTRA login.html (logo-circle):"
Write-Host $sample
