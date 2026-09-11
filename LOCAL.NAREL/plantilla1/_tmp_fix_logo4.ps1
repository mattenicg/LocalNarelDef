$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

$imgSrc = '/assets/img/logo-ngl-diamond.jpeg'
$fallback1 = '/logo_1.jpeg'
$fallback2 = '/logo%20solo.jpeg'

# onerror super simple, 3 niveles, sin nested funciones inline que rompan HTML entities
$onerrorSimple = "this.onerror=null;this.src='" + $fallback1 + "';var s2=function(){this.onerror=null;this.src='" + $fallback2 + "';this.addEventListener('error',function(){this.style.display='none';});}.bind(this);this.addEventListener('error',s2,{once:true});"
$finalImg = '<img src="' + $imgSrc + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;background:#000;" onerror="' + $onerrorSimple + '" />'

$countAll = 0
$files = Get-ChildItem -Path $base -Filter "*.html" -Recurse
foreach ($f in $files) {
  $raw = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $raw
  # Limpiamos CUALQUIER <img ... logo ...> que esté dentro del logo-circle
  $raw = [regex]::Replace($raw, '(<div\s+class="logo-circle"\s*>)\s*<img\s+[^>]*>\s*(</div>)', ('$1' + $finalImg + '$2'))
  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $raw, [System.Text.UTF8Encoding]::new($false))
    $countAll++
  }
}
"REEMPLAZADOS onerror limpio: $countAll archivos"

$muestra = [System.IO.File]::ReadAllText((Join-Path $base "login.html"))
$pos = $muestra.IndexOf('<div class="logo-circle">')
Write-Host $muestra.Substring($pos, [Math]::Min(600, $muestra.Length - $pos))
