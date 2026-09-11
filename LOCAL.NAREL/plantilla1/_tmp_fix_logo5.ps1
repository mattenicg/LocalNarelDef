$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

$imgSrc = '/assets/img/logo-ngl-diamond.jpeg'
$fallback1 = '/logo_1.jpeg'
$fallback2 = '/logo%20solo.jpeg'
$onerrorSimple = "this.onerror=null;this.src='" + $fallback1 + "';var s2=function(){this.onerror=null;this.src='" + $fallback2 + "';this.addEventListener('error',function(){this.style.display='none';});}.bind(this);this.addEventListener('error',s2,{once:true});"
$finalImg = '<img src="' + $imgSrc + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;background:#000;" onerror="' + $onerrorSimple + '" />'

$countAll = 0
$files = Get-ChildItem -Path $base -Filter "*.html" -Recurse
foreach ($f in $files) {
  $raw = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $raw

  # Busco el div logo-circle y reemplazo TODO su contenido por una versión limpia
  # Paso 1: encontrar todos los <div class="logo-circle">...</div> y reemplazar el interior
  $pattern = '(?s)(<div\s+class="logo-circle"\s*>).*?(</div>)'
  $raw = [regex]::Replace($raw, $pattern, {
    param($m)
    return $m.Groups[1].Value + $finalImg + $m.Groups[2].Value
  })

  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $raw, [System.Text.UTF8Encoding]::new($false))
    $countAll++
  }
}
Write-Host ("REEMPLAZADOS logo-circle limpio: " + $countAll + " archivos")

# Muestra
$sample = [System.IO.File]::ReadAllText((Join-Path $base "login.html"))
$pos = $sample.IndexOf('<div class="logo-circle">')
Write-Host ""
Write-Host "MUESTRA login.html:"
Write-Host $sample.Substring($pos, 420)
