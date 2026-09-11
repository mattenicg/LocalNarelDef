$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"

# Path REAL de tu logo (lo que realmente guardaste con nombre jpeg, no png):
$imgSrc = '/assets/img/logo-ngl-diamond.jpeg'
# Fallback 1 (logo_1.jpeg, existente)
$fallback1 = '/logo_1.jpeg'
# Fallback 2 (logo solo.jpeg, existente)
$fallback2 = '/logo solo.jpeg'

# Fallback FINAL inline (si NINGUNO de los 3 logos existe como archivo, mostramos el span NL de nuevo usando JS)
$onerrorChain = @(
  "if(this.src.indexOf('logo-ngl-diamond.jpeg') === -1){ /* already fallback */ }",
  "if(this.src.indexOf('logo_1.jpeg') === -1){ this.onerror = function(){ this.onerror=function(){ this.outerHTML='<span class=&quot;logo-nl&quot; style=&quot;color:#fff;font-family:Bebas Neue,sans-serif;font-weight:700;font-size:28px;display:inline-block;margin-top:20%&quot;>NL</span>'; }; this.src='$fallback2'.replace(' ', '%20'); return; }",
  "this.onerror = function(){ this.onerror=function(){ this.outerHTML='<span class=&quot;logo-nl&quot; style=&quot;color:#fff;font-family:Bebas Neue,sans-serif;font-weight:700;font-size:28px;display:inline-block;margin-top:20%&quot;>NL</span>'; }; this.src='$fallback1'; return; };",
  "this.src='$fallback1';"
) -join ' '

$newImg = "<img src=`"$imgSrc`" alt=`"`" style=`"width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;background:#000;`" onerror=`"$onerrorChain`" />"

$countAll = 0
$files = Get-ChildItem -Path $base -Filter "*.html" -Recurse
foreach ($f in $files) {
  $raw = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $raw

  # A) Reemplazar img ya existentes (que apuntaban a logo-nl-diamond.png mal)
  $raw = [regex]::Replace($raw, '<img\s+[^>]*logo-nl-diamond\.png[^>]*>', ($newImg))

  # B) Reemplazar por si las dudas también logo-nl-diamond.jpeg (por si alguien lo puso a mano)
  $raw = [regex]::Replace($raw, '<img\s+[^>]*logo-nl-diamond\.jpeg[^>]*>', ($newImg))

  # C) Reemplazar spans logo-nl/logo-nf por si acaso (si quedó alguno de antes del reemplazo anterior)
  # (no debería quedar ninguno, pero por si acaso)
  $raw = [regex]::Replace($raw, '<div\s+class="logo-circle"\s*>\s*<span\s+class="logo-n[fl]">NL</span>\s*</div>', ('<div class="logo-circle">' + $newImg + '</div>'))

  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $raw, [System.Text.UTF8Encoding]::new($false))
    $countAll++
    Write-Host ("  FIX: " + $f.FullName.Replace($base, "."))
  }
}
Write-Host ""
Write-Host ("ARCHIVOS ACTUALIZADOS: $countAll")
