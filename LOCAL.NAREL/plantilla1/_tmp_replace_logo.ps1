$ErrorActionPreference = "Stop"
$base = "d:\Matte\WEBS VENTAS\Plantilla.ropa\plantilla 1"
$newImg = '<img src="/assets/img/logo-nl-diamond.png" alt="Logo NAREL LOCAL" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;background:#000;" onerror="this.style.display=&apos;none&apos;;" />'
$newImgInline = $newImg
$countAll = 0
$files = Get-ChildItem -Path $base -Filter "*.html" -Recurse
foreach ($f in $files) {
  $raw = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $raw
  # 1) multilinea logo-nl (admin/auth): <div class="logo-circle">\n...<span class="logo-nl">NL</span>\n...</div>
  $raw = [regex]::Replace($raw, '(<div\s+class="logo-circle"\s*>)\s*\r?\n\s*<span\s+class="logo-nl">NL</span>\s*\r?\n\s*(</div>)', ('$1' + "`r`n        " + $newImgInline + "`r`n      `$2"))
  # 2) multilinea logo-nf (header tienda)
  $raw = [regex]::Replace($raw, '(<div\s+class="logo-circle"\s*>)\s*\r?\n\s*<span\s+class="logo-nf">NL</span>\s*\r?\n\s*(</div>)', ('$1' + "`r`n        " + $newImgInline + "`r`n      `$2"))
  # 3) una sola linea logo-nf (footer): <div class="logo-circle"><span ...>NL</span></div>
  $raw = [regex]::Replace($raw, '(<div\s+class="logo-circle"\s*>)<span\s+class="logo-nf">NL</span>(</div>)', ('$1' + $newImgInline + '$2'))
  if ($raw -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $raw, [System.Text.UTF8Encoding]::new($false))
    $countAll++
    Write-Host ("  OK reemplazo en: " + $f.FullName.Replace($base, "."))
  }
}
Write-Host ""
Write-Host ("REEMPLAZOS REALIZADOS: " + $countAll + " archivos")
$quedan = 0
foreach ($f in $files) {
  $r = [System.IO.File]::ReadAllText($f.FullName)
  $m1 = ([regex]::Matches($r, '<span\s+class="logo-n[fl]">NL</span>')).Count
  if ($m1 -gt 0) {
    $quedan += $m1
    Write-Host ("QUEDAN " + $m1 + " EN: " + $f.FullName.Replace($base, "."))
  }
}
Write-Host ("TOTAL span LOGO NL RESTANTES: " + $quedan + " (debe ser 0)")
