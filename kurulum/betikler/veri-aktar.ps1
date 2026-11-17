# Likya Kuyum - eski programdan veri aktarimi, kurulum (exe) icin. YONETICI olarak calistirilir.
# docs/VERITABANI_TASIMA_YOL_HARITASI.md (K7, K10). Bulutta ayni is admin panelinden (firma > Veri Aktar) yapilir.
#
#   & "C:\Program Files\LikyaKuyum\araclar\veri-aktar.ps1" -Yedek "D:\Eski\lr2026.bak"
#   & "C:\Program Files\LikyaKuyum\araclar\veri-aktar.ps1" -Yedek "D:\Eski\lr2026.bak" -YalnizDogrula
#
# Ne yapar:
#  1) Yedek, SQL Server'in okuyabildigi yedek klasorune kopyalanir.
#  2) Gecici bir SQL girisi acilir (Windows hesabinizla; kurulumdaki uygulama girisi yalniz db_owner, RESTORE yapamaz).
#  3) Program durdurulur (-ProgramiDurdurma verilmezse), aktarim motoru calisir: yedek gecici adla acilir, firma veritabaninin
#     aktarim oncesi yedegi alinir, veri TEK islemde kopyalanir ve COMMIT'ten once kaynakla satir satir karsilastirilir;
#     fark varsa hicbir sey yazilmaz.
#  4) Gecici giris ve kopya silinir, program yeniden baslatilir. Rapor: <Veri>\log\aktarim_<zaman>.json
# Cikis kodu: 0 basarili, 2 engel / dogrulama farki (veri yazilmadi), 1 hata.
param(
  [Parameter(Mandatory = $true)][string]$Yedek,
  [string]$Kok = "",
  [string]$Veri = "$env:ProgramData\LikyaKuyum",
  [string]$Sunucu = "",
  [string]$Veritabani = "",
  [switch]$YalnizDogrula,
  [switch]$ProgramiDurdurma,
  # Yedek kopyasi ve aktarim oncesi yedek klasoru; bos: SQL Server'in yedek klasoru (SQL bu klasoru okuyup yazabilir)
  [string]$KopyaKlasoru = "",
  # Deneme / gelistirme: node ve betik yolu, calisma klasoru
  [string]$Node = "",
  [string[]]$Betik = @(),
  [string]$CalismaKlasoru = ""
)
$ErrorActionPreference = "Stop"
if (-not $Kok) { $Kok = Split-Path -Parent $PSScriptRoot }
# -File ile cagrilinca dizi tek metin gelir ("a,b")
if ($Betik.Count -eq 1 -and $Betik[0] -match ',') { $Betik = $Betik[0].Split(',') }
New-Item -ItemType Directory -Force -Path (Join-Path $Veri "log") | Out-Null
$Damga = Get-Date -Format "yyyyMMdd_HHmmss"
$Gunluk = Join-Path $Veri "log\aktarim.log"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }   # node ciktisi (Turkce) bozulmasin
function Yaz([string]$m) { $s = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m; Add-Content -Path $Gunluk -Value $s -Encoding UTF8; Write-Host $s }
function RastgeleSifre([int]$n = 28) {
  $k = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return "Lk1" + (-join ($b | ForEach-Object { $k[$_ % $k.Length] }))
}
function SqlTek([string]$Sorgu) {
  $c = New-Object System.Data.SqlClient.SqlConnection "Server=$Sunucu;Database=master;Integrated Security=SSPI;Connection Timeout=15"
  $c.Open()
  try { $k = $c.CreateCommand(); $k.CommandText = $Sorgu; $k.CommandTimeout = 120; return $k.ExecuteScalar() } finally { $c.Close() }
}

# --- Ayarlar (.env'den)
$beKlasoru = if ($CalismaKlasoru) { $CalismaKlasoru } else { Join-Path $Kok "uygulama\backend" }
$envYolu = Join-Path $beKlasoru ".env"
$ayar = @{}
if (Test-Path $envYolu) { foreach ($s in Get-Content $envYolu) { if ($s -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $ayar[$Matches[1]] = $Matches[2] } } }
if (-not $Sunucu) { $Sunucu = $ayar["KURULUM_DB_SERVER"] }
if (-not $Veritabani) { $Veritabani = $ayar["KURULUM_DB_NAME"] }
if (-not $Sunucu -or -not $Veritabani) { Yaz "HATA: sunucu / veritabani bulunamadi (.env: $envYolu). -Sunucu ve -Veritabani verin."; exit 1 }
if (-not (Test-Path $Yedek)) { Yaz "HATA: yedek dosyasi yok: $Yedek"; exit 1 }
$sunucuAdi = $Sunucu; $sunucuPort = ""
if ($Sunucu -match '^(.+),(\d+)$') { $sunucuAdi = $Matches[1]; $sunucuPort = $Matches[2] }

$giris = "lky_aktarim_" + ([guid]::NewGuid().ToString("N").Substring(0, 8))
$kopya = $null
$durduruldu = $false
$cikis = 1
try {
  if ([int](SqlTek "SELECT IS_SRVROLEMEMBER('sysadmin')") -ne 1) { Yaz "HATA: bu Windows hesabi SQL Server'da sysadmin degil; yonetici hesabiyla calistirin."; exit 1 }
  $dbKimlik = SqlTek "SELECT DB_ID(N'$($Veritabani.Replace("'", "''"))')"
  if ($null -eq $dbKimlik -or $dbKimlik -is [DBNull]) { Yaz "HATA: firma veritabani yok: $Veritabani"; exit 1 }

  # 1) Yedek SQL Server'in okuyabildigi klasore
  $yedekKlasoru = if ($KopyaKlasoru) { $KopyaKlasoru } else { [string](SqlTek "SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(260))") }
  $kopya = Join-Path $yedekKlasoru "LkyAktarim_$Damga.bak"
  Copy-Item -LiteralPath $Yedek -Destination $kopya -Force
  Yaz "Yedek kopyalandi: $kopya"

  # 2) Gecici SQL girisi
  $sifre = RastgeleSifre
  SqlTek "CREATE LOGIN [$giris] WITH PASSWORD = N'$sifre', CHECK_POLICY = OFF; ALTER SERVER ROLE [sysadmin] ADD MEMBER [$giris];" | Out-Null
  Yaz "Gecici SQL girisi acildi: $giris"

  # 3) Program durdurulur (aktarim sirasinda kimse calismasin)
  $durdur = Join-Path $Kok "araclar\durdur.ps1"
  if (-not $ProgramiDurdurma -and -not $YalnizDogrula -and (Test-Path $durdur)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $durdur -Kok $Kok | Out-Null
    $durduruldu = $true
    Yaz "Program durduruldu."
  }

  $node = if ($Node) { $Node } else { Join-Path $Kok "node\node.exe" }
  $scriptAdi = if ($YalnizDogrula) { "aktarim-dogrula" } else { "veri-aktar" }
  $komut = if ($Betik.Count) { $Betik } else { @(Join-Path $beKlasoru "dist\scripts\$scriptAdi.js") }
  $rapor = Join-Path $Veri "log\aktarim_$Damga.json"
  $arg = if ($YalnizDogrula) {
    @("--kaynak-yedek", $kopya, "--hedef-db", $Veritabani, "--rapor", $rapor)
  } else {
    @("--yedek", $kopya, "--hedef-db", $Veritabani, "--on-yedek", (Join-Path $yedekKlasoru "LkyAktarimOnce_$Damga.bak"), "--rapor", $rapor)
  }
  # Sifre komut satirinda gorunmesin: ortam degiskeniyle (betik once bunlari okur)
  $env:KLON_DB_SERVER = $sunucuAdi; $env:KLON_DB_PORT = $sunucuPort; $env:KLON_DB_USER = $giris; $env:KLON_DB_PASSWORD = $sifre
  Yaz "Calisiyor: $scriptAdi ($Veritabani)"
  Push-Location $beKlasoru
  # PS 5.1: Stop modunda node'un stderr satiri istisnaya donusur; engel / fark mesajlari stderr'e yazilir
  $oncekiTercih = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $node @komut @arg 2>&1 | ForEach-Object { $s = "$_"; Add-Content -Path $Gunluk -Value $s -Encoding UTF8; Write-Host $s }
    $cikis = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oncekiTercih
    Pop-Location
    Remove-Item Env:\KLON_DB_PASSWORD, Env:\KLON_DB_USER -ErrorAction SilentlyContinue
  }
  Yaz ("SONUC: " + $(if ($cikis -eq 0) { "BASARILI" } elseif ($cikis -eq 2) { "AKTARIM YAPILMADI (engel / dogrulama farki), veritabani degismedi" } else { "HATA" }) + " - rapor: $rapor")
} catch {
  Yaz "HATA: $($_.Exception.Message)"
  $cikis = 1
} finally {
  try {
    SqlTek "IF SUSER_ID(N'$giris') IS NOT NULL BEGIN DECLARE @k nvarchar(max) = N''; SELECT @k += N'KILL ' + CAST(session_id AS nvarchar(10)) + N';' FROM sys.dm_exec_sessions WHERE login_name = N'$giris'; EXEC (@k); DROP LOGIN [$giris]; END" | Out-Null
    Yaz "Gecici SQL girisi silindi."
  } catch { Yaz "UYARI: gecici giris silinemedi ($giris): $($_.Exception.Message)" }
  if ($kopya -and (Test-Path $kopya)) { Remove-Item -LiteralPath $kopya -Force -ErrorAction SilentlyContinue }
  if ($durduruldu) {
    try { Start-ScheduledTask -TaskName "LikyaKuyum"; Yaz "Program yeniden baslatildi." } catch { Yaz "UYARI: program baslatilamadi; bilgisayari yeniden baslatin." }
  }
}
exit $cikis
