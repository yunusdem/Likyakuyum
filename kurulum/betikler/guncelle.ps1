# Likya Kuyum - yeni surumu uygular, acilmazsa eski surume doner. Sonuc: <Veri>\guncelleme\sonuc.json
# Program "LikyaKuyum" baslangic goreviyle calisir; bu betik ayri bir gorevden (LikyaKuyumGuncelle, SYSTEM) cagrilir.
# -Deneme: gorev yerine dogrudan node sureci baslatilir/durdurulur (yonetici gerektirmeyen yerel deneme icin); yedek alinmaz.
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [Parameter(Mandatory = $true)][string]$Surum,
  [string]$Kok = (Split-Path -Parent $PSScriptRoot),
  [string]$Veri = "$env:ProgramData\LikyaKuyum",
  [string]$Gorev = "LikyaKuyum",
  [int]$Port = 5000,
  [int]$SaglikSaniye = 90,
  [switch]$Deneme,
  [string]$DenemeNode = "node.exe"
)
$ErrorActionPreference = "Stop"
$uyg = Join-Path $Kok "uygulama"
$onceki = Join-Path $Kok "uygulama.onceki"
$yeni = Join-Path $Kok "uygulama.yeni"
$hatali = Join-Path $Kok "uygulama.hatali"
$gk = Join-Path $Veri "guncelleme"
New-Item -ItemType Directory -Force -Path $gk, (Join-Path $Veri "log") | Out-Null
$Gunluk = Join-Path $Veri "log\guncelleme.log"
$pidDosyasi = Join-Path $Kok "deneme.pid"
# Program bu isaret varken acilirsa bekleyen guncellemeyi yeniden baslatmaz (guncelleyici.ts kacanGuncellemeyiUygula):
# geri donuste eski surum, sonuc.json yazilmadan acildigi icin ayni surumu tekrar uygulatip dongu kuruyordu.
$isaret = Join-Path $gk "uygulaniyor.json"

# Programin .env ayarlari (port, veritabani); -Port verilmediyse port buradan okunur
$ayar = @{}
$envYolu = Join-Path $uyg "backend\.env"
if (Test-Path $envYolu) {
  foreach ($s in Get-Content $envYolu) { if ($s -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $ayar[$Matches[1]] = $Matches[2].Trim() } }
}
if (-not $PSBoundParameters.ContainsKey("Port") -and $ayar["PORT"] -match '^\d+$') { $Port = [int]$ayar["PORT"] }
$saglik = "http://127.0.0.1:$Port/api/v1/health"

function Yaz([string]$m) { Add-Content -Path $Gunluk -Value ("{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) }
function Sonuc([bool]$b, [string]$m) {
  $j = @{ surum = $Surum; basarili = $b; mesaj = $m; zaman = (Get-Date).ToString("o") } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $gk "sonuc.json"), $j, (New-Object Text.UTF8Encoding($false)))
  Yaz "SONUC: $b - $m"
}
# Sunucu hic yanit vermiyorsa (baglanti kurulamiyor) kapanmis sayilir; 503 gibi bir yanit sunucunun hala acik oldugunu gosterir
function Dinliyor {
  try { Invoke-WebRequest -Uri $saglik -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true }
  catch { return ($null -ne $_.Exception.Response) }
}
function Durdur {
  $idler = @()
  if ($Deneme) {
    if (Test-Path $pidDosyasi) { $idler += [int](Get-Content $pidDosyasi); Remove-Item $pidDosyasi -Force }
  } else {
    # Gorevin 5 dakikalik bekci tetigi guncelleme sirasinda programi yeniden acmasin
    Disable-ScheduledTask -TaskName $Gorev -ErrorAction SilentlyContinue | Out-Null
    Stop-ScheduledTask -TaskName $Gorev -ErrorAction SilentlyContinue
    $idler += @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "server\.js" -and ($_.ExecutablePath -like "$Kok*") } | ForEach-Object { $_.ProcessId })
  }
  foreach ($i in $idler) { Stop-Process -Id $i -Force -ErrorAction SilentlyContinue }
  foreach ($i in $idler) { Wait-Process -Id $i -Timeout 20 -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 20 -and (Dinliyor); $i++) { Start-Sleep -Milliseconds 500 }
}
function Baslat {
  if ($Deneme) {
    $p = Start-Process -FilePath $DenemeNode -ArgumentList "dist\server.js" -WorkingDirectory (Join-Path $uyg "backend") -WindowStyle Hidden -PassThru
    Set-Content -Path $pidDosyasi -Value $p.Id
  } else {
    Enable-ScheduledTask -TaskName $Gorev -ErrorAction SilentlyContinue | Out-Null
    Start-ScheduledTask -TaskName $Gorev
  }
}
function SaglikBekle {
  for ($i = 0; $i -lt $SaglikSaniye; $i += 2) {
    Start-Sleep -Seconds 2
    try { if ((Invoke-WebRequest -Uri $saglik -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { return $true } } catch { }
  }
  return $false
}
function KorunanlariTasi([string]$kaynak, [string]$hedef) {
  Copy-Item (Join-Path $kaynak "backend\.env") (Join-Path $hedef "backend\.env") -Force
  # Eski surumlerin uygulama icinde tuttugu veriler tasinir; yeni dosyalar {Kok}\Belgeler'dedir ve guncellemede dokunulmaz
  # (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K6). belge-arsiv, program acilinca bir kez Belgeler'e kopyalanir.
  foreach ($k in @("uploads", "belge-arsiv", "destek-ekler")) {
    if (Test-Path (Join-Path $kaynak "backend\$k")) { Copy-Item (Join-Path $kaynak "backend\$k") (Join-Path $hedef "backend") -Recurse -Force }
  }
  if (-not $Deneme) { & icacls (Join-Path $hedef "backend\.env") /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" | Out-Null }
}

# Klasor tasima: virus tarayici / acik Gezgin penceresi gibi gecici kilitlerde birkac kez denenir
function Tasi([string]$kaynak, [string]$hedef) {
  for ($i = 1; ; $i++) {
    try { Rename-Item $kaynak $hedef -ErrorAction Stop; return } catch { if ($i -ge 5) { throw }; Start-Sleep -Seconds 3 }
  }
}

# Guncellemeden once firma veritabaninin yedegi (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 15.1, Y3): SQL Server kendi yedek
# klasorune yazar (veri klasorune yazma yetkisi yok), sonra <Veri>\yedek\once-<surum>_<zaman>.bak olarak tasinir; son 3 tutulur.
function OnceYedekle {
  $sunucu = $ayar["KURULUM_DB_SERVER"]; $vt = $ayar["KURULUM_DB_NAME"]
  if (-not $sunucu -or -not $vt) { throw "Veritabani ayari (.env) okunamadi; yedek alinamadi." }
  $c = New-Object System.Data.SqlClient.SqlConnection "Server=$sunucu;Database=master;Integrated Security=SSPI;Connection Timeout=30"
  $c.Open()
  try {
    $k = $c.CreateCommand(); $k.CommandTimeout = 60
    $k.CommandText = "SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400))"
    $sqlKlasor = [string]$k.ExecuteScalar()
    if (-not $sqlKlasor) { throw "SQL Server yedek klasoru bulunamadi." }
    $gecici = Join-Path $sqlKlasor "likya_once_guncelleme.bak"
    $k.CommandTimeout = 1800
    $k.CommandText = "BACKUP DATABASE [" + $vt.Replace("]", "]]") + "] TO DISK = N'" + $gecici.Replace("'", "''") + "' WITH COPY_ONLY, INIT, CHECKSUM"
    $k.ExecuteNonQuery() | Out-Null
  } finally { $c.Close() }
  $hedefKlasor = Join-Path $Veri "yedek"
  New-Item -ItemType Directory -Force -Path $hedefKlasor | Out-Null
  $ad = "once-" + ($Surum -replace '[^A-Za-z0-9.+-]', '_') + "_" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".bak"
  Move-Item -Path $gecici -Destination (Join-Path $hedefKlasor $ad) -Force
  Get-ChildItem -Path $hedefKlasor -Filter "once-*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3 | Remove-Item -Force -ErrorAction SilentlyContinue
  Yaz "Guncelleme oncesi yedek alindi: $ad"
}

$durduruldu = $false
$eskiTasindi = $false
$degistirildi = $false
$cikis = 1
try {
  [IO.File]::WriteAllText($isaret, (@{ surum = $Surum; zaman = (Get-Date).ToString("o") } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
  Yaz "Guncelleme basladi: $Surum ($Zip)"
  if (-not (Test-Path $Zip)) { throw "Paket bulunamadi: $Zip" }
  if (Test-Path $yeni) { Remove-Item $yeni -Recurse -Force }
  Expand-Archive -Path $Zip -DestinationPath $yeni -Force
  if (-not (Test-Path (Join-Path $yeni "backend\dist\server.js")) -or -not (Test-Path (Join-Path $yeni "backend\BUTUNLUK.json"))) { throw "Paket eksik (backend\dist\server.js / BUTUNLUK.json yok)." }
  KorunanlariTasi $uyg $yeni
  if (-not $Deneme) {
    try { OnceYedekle } catch { throw ("Guncelleme oncesi yedek alinamadi: " + $_.Exception.Message) }
  }

  $durduruldu = $true
  Durdur
  if (Test-Path $onceki) { Remove-Item $onceki -Recurse -Force }
  Tasi $uyg $onceki
  $eskiTasindi = $true
  Tasi $yeni $uyg
  $degistirildi = $true
  Baslat
  if (SaglikBekle) {
    Remove-Item (Join-Path $gk "bekleyen.json") -Force -ErrorAction SilentlyContinue
    Remove-Item $Zip -Force -ErrorAction SilentlyContinue
    if (Test-Path $hatali) { Remove-Item $hatali -Recurse -Force }
    Sonuc $true "Surum $Surum yuklendi."
    $cikis = 0
  } else {
    throw "Yeni surum acilmadi (saglik denetimi $SaglikSaniye sn icinde yanit vermedi)."
  }
} catch {
  $hata = $_.Exception.Message
  Yaz "HATA: $hata"
  try {
    if ($degistirildi -and (Test-Path $onceki)) {
      Durdur
      if (Test-Path $hatali) { Remove-Item $hatali -Recurse -Force }
      Tasi $uyg $hatali
      Tasi $onceki $uyg
      Baslat
      $geri = SaglikBekle
      Sonuc $false ("$hata Eski surume donuldu" + $(if ($geri) { "." } else { " ancak program yanit vermiyor!" }))
    } else {
      # Yeni surum yerine konamadi. Eski surum tasindiysa geri konur; program durdurulduysa yeniden baslatilir
      # (onceden program kapali kaliyor, uygulama klasoru tasinmis olabiliyordu: gorev bir sonraki acilisa kadar calismiyordu)
      if ($eskiTasindi -and -not (Test-Path $uyg) -and (Test-Path $onceki)) { Tasi $onceki $uyg }
      if (Test-Path $yeni) { Remove-Item $yeni -Recurse -Force -ErrorAction SilentlyContinue }
      if ($durduruldu) {
        Baslat
        $geri = SaglikBekle
        Sonuc $false ("$hata Eski surum yeniden baslatildi" + $(if ($geri) { "." } else { " ancak program yanit vermiyor!" }))
      } else {
        Sonuc $false $hata
      }
    }
  } catch {
    Sonuc $false ("$hata / geri alma hatasi: " + $_.Exception.Message)
  }
} finally {
  # Gorev hicbir durumda devre disi kalmasin (program bir sonraki acilista da baslamazdi)
  if (-not $Deneme) { Enable-ScheduledTask -TaskName $Gorev -ErrorAction SilentlyContinue | Out-Null }
  Remove-Item $isaret -Force -ErrorAction SilentlyContinue
}
exit $cikis
