# Likya - panelden dagitim (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md)
# Gorev Zamanlayici'daki "LikyaDagitim" gorevi bu betigi calistirir (pm2'yi calistiran kullanici olarak, en yuksek yetkiyle).
# Backend <Klasor>\istek.json yazar ve gorevi tetikler; betik <Klasor>\durum.json ve <Klasor>\log\*.log yazar.
#   istek.json : { id, hedef (canli|test), commit (sha ya da origin/main), baslatan, logDosyasi }
#   ayar.json  : { git, node, npm, pm2, gorev, canli: { kok, pm2, port, admin, erp, exePaketi }, test: { kok, pm2, port } }
# Adimlar: elle degisiklik denetimi -> fetch -> checkout -> (npm install gerekirse) -> Backend build -> sema gocu -> arayuz
# build (dist) -> "yayin" klasorune ayna (IIS bunu sunar) -> (canli: admin + erp build) -> pm2 restart -> saglik (commit
# dogrulamali) -> (canli: exe paketi, dist'ten). Herhangi biri
# kalirsa onceki commit'e ayni adimlarla geri donulur (sema gocu geri alinmaz).
# Sunucuda ilk panel denemesi: 24.10.2026 (Canlıya Geçir).
# -Deneme: pm2 yerine verilen komut (DenemeBaslat/DenemeDurdur) kullanilir; yerel denemede gorev gerekmez.
param(
  [string]$Klasor = "C:\LikyaYedek\dagitim",
  [string]$IstekDosyasi = "",
  [switch]$Deneme
)
$ErrorActionPreference = "Stop"
if (-not $IstekDosyasi) { $IstekDosyasi = Join-Path $Klasor "istek.json" }
$durumDosyasi = Join-Path $Klasor "durum.json"
New-Item -ItemType Directory -Force -Path (Join-Path $Klasor "log") | Out-Null

$ayar = Get-Content (Join-Path $Klasor "ayar.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$istek = Get-Content $IstekDosyasi -Raw -Encoding UTF8 | ConvertFrom-Json
$id = [int]$istek.id
$hedef = [string]$istek.hedef
$ortam = $ayar.$hedef
if (-not $ortam) { throw "ayar.json icinde '$hedef' ortami yok" }
$kok = [string]$ortam.kok
$port = [int]$ortam.port
$Gunluk = if ($istek.logDosyasi) { [string]$istek.logDosyasi } else { Join-Path $Klasor ("log\{0}-{1}.log" -f $hedef, $id) }

# Programlar tam yolla cagrilir: .cmd dosyasi adiyla baslatilirsa %~dp0 calisma klasorune cozulur ve npm kendini bulamaz
function TamYol([string]$ad) { $c = Get-Command $ad -ErrorAction SilentlyContinue; if ($c) { return $c.Source } else { return $ad } }
$git = if ($ayar.git) { [string]$ayar.git } else { TamYol "git.exe" }
$npm = if ($ayar.npm) { [string]$ayar.npm } else { TamYol "npm.cmd" }
$pm2 = if ($ayar.pm2) { [string]$ayar.pm2 } else { TamYol "pm2.cmd" }
if ($ayar.node) { $env:Path = (Split-Path -Parent ([string]$ayar.node)) + ";" + $env:Path }
if ($ayar.git) { $env:Path = (Split-Path -Parent $git) + ";" + $env:Path }
$env:NODE_OPTIONS = ""
$env:CI = "1"
# Tek bir komutun (npm install, vite build, surum:yayinla) en cok surebilecegi sure
$SurecZamanAsimiDk = if ($ayar.komutZamanAsimiDk) { [int]$ayar.komutZamanAsimiDk } else { 25 }

$script:durum = [ordered]@{
  id = $id; hedef = $hedef; pid = $PID; durum = "CALISIYOR"; adim = "Basladi"; mesaj = $null
  oncekiCommit = $null; yeniCommit = $null; baslangic = (Get-Date).ToString("o"); bitis = $null
}

function Yaz([string]$m) {
  $satir = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Add-Content -Path $Gunluk -Value $satir -Encoding UTF8
  # Write-Output degil: fonksiyonlarin donus degerine karismasin (Saglik $false donerken log satirlari diziyi dogru yapiyordu)
  Write-Host $satir
}
function DurumYaz {
  $gecici = "$durumDosyasi.tmp"
  [IO.File]::WriteAllText($gecici, ($script:durum | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
  Move-Item -Path $gecici -Destination $durumDosyasi -Force
}
function Adim([string]$a) { $script:durum.adim = $a; DurumYaz; Yaz "--- $a" }
function Bitir([string]$d, [string]$m) {
  $script:durum.durum = $d; $script:durum.mesaj = $m; $script:durum.adim = $null; $script:durum.bitis = (Get-Date).ToString("o")
  DurumYaz
  Yaz "SONUC: $d - $m"
}

# Surec calistirma (.NET Process): yalniz surecin kendisi beklenir. Start-Process -Wait alt surecleri de bekledigi icin
# kullanilmaz (pm2 daemon'u ilk kez acilirsa ya da denemede node baslatilirsa sonsuza dek takilirdi).
function Surec([string]$exe, [string[]]$arg, [string]$dizin) {
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = $exe
  $psi.Arguments = (($arg | ForEach-Object { if ($_ -match '[\s"]') { '"' + $_.Replace('"', '\"') + '"' } else { $_ } }) -join " ")
  $psi.WorkingDirectory = $dizin
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = New-Object Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  # Iki akis eszamansiz okunur (tampon dolunca surec kilitlenmesin). Surec bitince akislar en cok 5 sn beklenir:
  # komutun arkada biraktigi bir alt surec borulari acik tutuyorsa cikti eksik kalir ama betik takilmaz.
  $outGorev = $p.StandardOutput.ReadToEndAsync()
  $errGorev = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($SurecZamanAsimiDk * 60 * 1000)) {
    try { $p.Kill() } catch { }
    throw ("{0} {1} dakikada bitmedi, durduruldu" -f (Split-Path -Leaf $exe), $SurecZamanAsimiDk)
  }
  $out = ""; $err = ""
  if ([Threading.Tasks.Task]::WaitAll(@($outGorev, $errGorev), 5000)) { $out = $outGorev.Result; $err = $errGorev.Result }
  else { $out = "(cikti alinamadi: alt surec akislari acik birakti)" }
  return @{ kod = $p.ExitCode; out = $out; err = $err }
}
# Komut calistirma: cikti log'a yazilir, cikis kodu izinli degilse hata
function Calistir([string]$exe, [string[]]$arg, [string]$dizin, [int[]]$izinliKodlar = @(0)) {
  Yaz ("> {0} {1}   [{2}]" -f (Split-Path -Leaf $exe), ($arg -join " "), $dizin)
  $r = Surec $exe $arg $dizin
  $cikti = @((("" + $r.out) + "`n" + ("" + $r.err)) -split "`r?`n" | Where-Object { $_ -and $_.Trim() })
  if ($cikti.Count -gt 60) { $cikti = @("... ({0} satir atlandi)" -f ($cikti.Count - 60)) + $cikti[-60..-1] }
  foreach ($s in $cikti) { Add-Content -Path $Gunluk -Value ("    " + $s) -Encoding UTF8 }
  if ($izinliKodlar -notcontains $r.kod) { throw ("{0} cikis kodu {1}" -f (Split-Path -Leaf $exe), $r.kod) }
  return $r.kod
}
function Git([string[]]$arg, [string]$dizin = $kok) {
  $r = Surec $git (@("-C", $dizin) + $arg) $dizin
  if ($r.kod -ne 0) { throw ("git {0}: {1}" -f ($arg -join " "), ("" + $r.err + $r.out).Trim()) }
  return ("" + $r.out).Trim()
}

function Saglik([string]$beklenenCommit, [int]$saniye = 120) {
  $adres = "http://127.0.0.1:$port/api/v1/health"
  $son = ""
  for ($t = 0; $t -lt $saniye; $t += 3) {
    Start-Sleep -Seconds 3
    try {
      $r = Invoke-WebRequest -Uri $adres -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) {
        $j = $r.Content | ConvertFrom-Json
        $c = [string]$j.data.commit
        if (-not $beklenenCommit -or -not $c -or $c -eq $beklenenCommit) { return $true }
        $son = "calisan commit $c, beklenen $beklenenCommit"
      } else { $son = "HTTP " + $r.StatusCode }
    } catch { $son = $_.Exception.Message }
  }
  Yaz "Saglik kontrolu kaldi: $son"
  return $false
}

function Pm2Yeniden {
  if ($Deneme) {
    if ($ayar.denemeDurdur) { Calistir "powershell.exe" @("-NoProfile", "-Command", [string]$ayar.denemeDurdur) $kok | Out-Null }
    if ($ayar.denemeBaslat) { Calistir "powershell.exe" @("-NoProfile", "-Command", [string]$ayar.denemeBaslat) $kok | Out-Null }
    return
  }
  Calistir $pm2 @("restart", [string]$ortam.pm2, "--update-env") $kok | Out-Null
}

function PaketKilidiDegisti([string]$a, [string]$b, [string]$dosya) {
  if (-not $a) { return $true }
  $d = Git @("diff", "--name-only", $a, $b, "--", $dosya)
  return [bool]$d
}

# Kurulum: verilen commit'i cikar, derle, baslat. $geriDonus: sema gocu ve exe paketi atlanir.
function Kur([string]$commit, [string]$oncekiCommit, [bool]$geriDonus) {
  $on = if ($geriDonus) { "GERI DONUS: " } else { "" }

  Adim ($on + "Kaynak cikariliyor ($($commit.Substring(0, 9)))")
  # -f: derleme ciktilarindaki (dist, Backend/dist, node_modules) degisiklikler ve yoldaki takipsiz dosyalar ezilir.
  # Elle degistirilmis baska izlenen dosya varsa buraya hic gelinmez (ElleDegisiklikler). Site "yayin" klasorunden
  # sunuldugu icin checkout ve derleme boyunca kullanicilar eski surumu gormeye devam eder.
  Git @("checkout", "-f", "-B", "main", $commit) | Out-Null
  # Bir sonraki calistirma icin betigin yeni surumu
  $yeniBetik = Join-Path $kok "kurulum\betikler\dagit.ps1"
  if (Test-Path $yeniBetik) { Copy-Item $yeniBetik (Join-Path $Klasor "dagit.ps1") -Force }

  Adim ($on + "Bagimliliklar")
  if (PaketKilidiDegisti $oncekiCommit $commit "Backend/package-lock.json") {
    Calistir $npm @("install", "--no-audit", "--no-fund") (Join-Path $kok "Backend") | Out-Null
  } else { Yaz "Backend/package-lock.json degismedi, npm install atlandi" }
  if (PaketKilidiDegisti $oncekiCommit $commit "package-lock.json") {
    Calistir $npm @("install", "--no-audit", "--no-fund") $kok | Out-Null
  } else { Yaz "package-lock.json degismedi, npm install atlandi" }
  if (-not (Test-Path (Join-Path $kok "node_modules\@rollup\rollup-win32-x64-msvc"))) {
    $rollup = "4.63.1"
    try { $rollup = (Get-Content (Join-Path $kok "node_modules\rollup\package.json") -Raw | ConvertFrom-Json).version } catch { }
    Calistir $npm @("install", "--no-save", "--no-audit", "--no-fund", "@rollup/rollup-win32-x64-msvc@$rollup") $kok | Out-Null
  }

  Adim ($on + "Backend derleniyor")
  Calistir $npm @("run", "build") (Join-Path $kok "Backend") | Out-Null

  if (-not $geriDonus) {
    Adim "Sema gocleri (sablon, bulut firmalari, yonetim)"
    $kod = Calistir $npm @("run", "surum:yayinla", "--", "--yalniz-sema") (Join-Path $kok "Backend") @(0, 2)
    if ($kod -eq 2) { throw "Sema gocu hata verdi (log'a bakin)" }
  }

  Adim ($on + "Arayuz derleniyor")
  # Kök "npm run build" = tsc && vite build (dist'e). IIS dist'i degil "yayin" klasorunu sunar; dist derleme boyunca bos
  # kalabilir. dist ayrica exe paketinin (surum:yayinla) kaynagidir, o yuzden yeni derleme dist'e yazilir.
  $node = if ($ayar.node) { [string]$ayar.node } else { TamYol "node.exe" }
  Calistir $node @((Join-Path $kok "node_modules\typescript\bin\tsc")) $kok | Out-Null
  Calistir $node @((Join-Path $kok "node_modules\vite\bin\vite.js"), "build") $kok | Out-Null
  $wc = Join-Path $kok "dist\web.config"
  if (-not (Test-Path (Join-Path $kok "dist\index.html"))) { throw "dist\index.html olusmadi" }
  if (-not (Test-Path $wc)) { throw "dist\web.config olusmadi (public\web.config eksik)" }
  if ($port -ne 5000) {
    $metin = [IO.File]::ReadAllText($wc)
    [IO.File]::WriteAllText($wc, $metin.Replace("127.0.0.1:5000", "127.0.0.1:$port"), (New-Object Text.UTF8Encoding($false)))
    Yaz "web.config backend portu $port yapildi"
  }

  Adim ($on + "Arayuz yayinlaniyor (yayin)")
  # robocopy: 0-7 basari; IIS'in kilitledigi dosyalar icin tekrar dener
  Calistir "robocopy.exe" @((Join-Path $kok "dist"), (Join-Path $kok "yayin"), "/MIR", "/R:10", "/W:3", "/NFL", "/NDL", "/NJH", "/NP") $kok @(0, 1, 2, 3, 4, 5, 6, 7) | Out-Null
  if ($hedef -eq "canli") {
    if ($ortam.admin -ne $false) { Adim ($on + "Yonetim paneli derleniyor"); Calistir $npm @("run", "build:admin") $kok | Out-Null }
    if ($ortam.erp -ne $false) { Adim ($on + "Tanitim sitesi derleniyor"); Calistir $npm @("run", "build:erp") $kok | Out-Null }
  }

  Adim ($on + "Backend yeniden baslatiliyor")
  Pm2Yeniden
  Adim ($on + "Saglik kontrolu")
  if (-not (Saglik $commit)) { throw "Backend yeni surumle saglikli acilmadi" }
  Yaz "Saglik tamam: $commit"

  if (-not $geriDonus -and $hedef -eq "canli" -and $ortam.exePaketi -eq $true) {
    Adim "Kurulum (exe) paketi yayinlaniyor"
    try {
      Calistir $npm @("run", "surum:yayinla", "--", "--mevcut-moduller", "--not", "Dagitim #$id") (Join-Path $kok "Backend") | Out-Null
    } catch { Yaz ("UYARI: exe paketi yayinlanamadi: " + $_.Exception.Message); $script:paketUyarisi = "exe paketi yayinlanamadi" }
  }
}

$script:paketUyarisi = $null
try {
  # Ayni anda tek dagitim
  if (Test-Path $durumDosyasi) {
    try {
      $eski = Get-Content $durumDosyasi -Raw | ConvertFrom-Json
      if ($eski.durum -eq "CALISIYOR" -and $eski.pid -and (Get-Process -Id $eski.pid -ErrorAction SilentlyContinue)) {
        Write-Output "Baska bir dagitim calisiyor (pid $($eski.pid)); cikiliyor."; exit 3
      }
    } catch { }
  }
  DurumYaz
  Yaz "===== Dagitim #$id -> $hedef ($kok) baslatan: $($istek.baslatan)"
  if (-not (Test-Path (Join-Path $kok ".git"))) { throw "Depo bulunamadi: $kok" }

  # Sunucuda elle degistirilmis izlenen dosya (ornegin Backend/.env) varsa hicbir seye dokunmadan durulur:
  # checkout -f onu sessizce silerdi. Derleme ciktilari ve paket klasorleri sayilmaz.
  Adim "Calisma kopyasi denetleniyor"
  # public-admin / public-erp altındaki PrinterAgent.exe ve images: admin ve erp derlemesi public'ten kopyalar (vite.*.config.ts)
  $izinli = '^(Backend/dist/|dist/|dist-admin/|dist-erp/|yayin/|node_modules/|Backend/node_modules/|public-erp/images/|public-erp/PrinterAgent\.exe$|public-admin/PrinterAgent\.exe$|package-lock\.json$|Backend/package-lock\.json$)'
  $elle = @()
  foreach ($s in ((Git @("-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=no")) -split "`r?`n")) {
    if (-not $s.Trim()) { continue }
    $yol = ($s -replace '^\s*[MADRCUT?!]{1,2}\s+', '').Trim('"')
    if ($yol -match ' -> ') { $yol = ($yol -split ' -> ')[1].Trim('"') }
    if ($yol -notmatch $izinli) { $elle += $yol }
  }
  if ($elle.Count -gt 0) {
    $liste = ($elle | Select-Object -First 10) -join ", "
    throw ("Sunucuda elle degistirilmis dosya var, dagitim yapilmadi (hicbir sey degismedi): {0}. Ayarlari Backend\.env.local'e tasiyin ya da 'git checkout -- <dosya>' ile geri alin." -f $liste)
  }

  Adim "Uzak depo okunuyor"
  Git @("fetch", "origin", "--quiet") | Out-Null
  $onceki = Git @("rev-parse", "HEAD")
  $yeni = Git @("rev-parse", "--verify", ([string]$istek.commit + "^{commit}"))
  $script:durum.oncekiCommit = $onceki; $script:durum.yeniCommit = $yeni; DurumYaz
  Yaz "Onceki: $onceki  Yeni: $yeni"
  if ($onceki -eq $yeni) { Bitir "BASARILI" "Zaten bu surumde ($($yeni.Substring(0, 9))); degisiklik yapilmadi"; exit 0 }

  try {
    Kur $yeni $onceki $false
    $m = "Kuruldu: " + $yeni.Substring(0, 9)
    if ($script:paketUyarisi) { $m += " (UYARI: $script:paketUyarisi)" }
    Bitir "BASARILI" $m
    exit 0
  } catch {
    $hata = $_.Exception.Message
    Yaz "HATA: $hata"
    Yaz "Onceki surume donuluyor: $onceki"
    try {
      Kur $onceki $yeni $true
      Bitir "GERI_DONDU" ("Kurulum kaldi: {0}. Onceki surume ({1}) donuldu." -f $hata, $onceki.Substring(0, 9))
      exit 1
    } catch {
      Bitir "GERI_DONUS_HATASI" ("Kurulum kaldi: {0}. Geri donus de kaldi: {1}. ELLE MUDAHALE GEREKIR." -f $hata, $_.Exception.Message)
      exit 2
    }
  }
} catch {
  Bitir "HATA" $_.Exception.Message
  exit 2
}
