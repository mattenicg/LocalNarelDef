$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

$newBlock = @'
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
      top:40%!important;
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
  $newRaw = [regex]::Replace($raw, $pattern, $newBlock)
  if ($newRaw -ne $raw) {
    [System.IO.File]::WriteAllText($t, $newRaw, [System.Text.UTF8Encoding]::new($false))
    Write-Host ("OK (top 40%): " + $t)
  } else {
    Write-Host ("SIN CAMBIOS: " + $t)
  }
}
