# Likya Kuyum - kurulum sonrasi hazirlik (Inno Setup tarafindan, yonetici olarak calistirilir)
# docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.4
#  1) Veri klasoru (C:\ProgramData\LikyaKuyum) ve firma.lky denetimi
#  2) SQL Server: uygun var olan ornek kullanilir (sql-bul.ps1), yoksa Express 2025 (ornek LIKYA, TCP 14330) sessiz kurulur
#     (kurulum dosyasini Inno Setup Microsoft'tan indirir)
#  3) Firma veritabani sablondan acilir (varsa dokunulmaz), uygulamanin SQL girisi olusturulur / sifresi yenilenir
#  4) uygulama\backend\.env yazilir (yalniz SYSTEM ve Yoneticiler okuyabilir)
#  5) Gorev Zamanlayici: bilgisayar acilinca SYSTEM ile calisan "LikyaKuyum" gorevi; guvenlik duvari (5000/TCP)
# -Deneme: yonetici gerektiren adimlar (SQL kurulumu, gorev, guvenlik duvari, ACL) atlanir; var olan SQL'e Windows kimligiyle baglanilir.
param(
  [Parameter(Mandatory = $true)][string]$Kok,
  [string]$Veri = "$env:ProgramData\LikyaKuyum",
  [string]$SqlKurulum = "",
  [string]$Ornek = "LIKYA",
  [int]$SqlPort = 14330,
  [int]$Port = 5000,
  [string]$VeritabaniAdi = "LIKYA",
  [string]$SqlYonetim = "",
  [string]$UygulamaSunucu = "",
  [switch]$Deneme
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Veri, (Join-Path $Veri "log") | Out-Null
$Gunluk = Join-Path $Veri "log\kurulum.log"
function Yaz([string]$m) { $s = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m; Add-Content -Path $Gunluk -Value $s; Write-Output $s }
function RastgeleSifre([int]$n = 28) {
  $k = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return "Lk1" + (-join ($b | ForEach-Object { $k[$_ % $k.Length] }))
}
function SqlCalistir([string]$Baglanti, [string]$Sorgu, [int]$Sure = 600) {
  $c = New-Object System.Data.SqlClient.SqlConnection $Baglanti
  $c.Open()
  try { $k = $c.CreateCommand(); $k.CommandText = $Sorgu; $k.CommandTimeout = $Sure; return $k.ExecuteScalar() } finally { $c.Close() }
}

# Windows 11 + bazi NVMe diskler: fiziksel sektor 4 KB'tan buyukse SQL Server 2022 servisi acilmaz (Microsoft:
# "system disk sector size greater than 4 KB"). Onerilen kayit defteri ayari yapilir; etkisi yeniden baslatmayla gelir (cikis 2).
function SektorDenetle {
  $sektor = 0
  try {
    foreach ($s in (& fsutil fsinfo sectorinfo $env:SystemDrive 2>$null)) {
      if ($s -match 'PhysicalBytesPerSectorForAtomicity\s*:\s*(\d+)') { $sektor = [int]$Matches[1] }
    }
  } catch { }
  if ($sektor -eq 0) { try { $sektor = [int](Get-PhysicalDisk | Measure-Object -Property PhysicalSectorSize -Maximum).Maximum } catch { } }
  $nvme = "HKLM:\SYSTEM\CurrentControlSet\Services\stornvme\Parameters\Device"
  $ayarli = $false
  try { $ayarli = [bool](Get-ItemProperty -Path $nvme -Name ForcedPhysicalSectorSizeInBytes -ErrorAction Stop).ForcedPhysicalSectorSizeInBytes } catch { }
  if ($sektor -gt 4096 -and -not $ayarli) {
    if (-not $Deneme) {
      # Anahtar varsa yeniden olusturulmaz: New-Item -Force anahtardaki Windows degerlerini (IoStripeAlignment vb.) siler
      if (-not (Test-Path $nvme)) { New-Item -Path $nvme -Force | Out-Null }
      New-ItemProperty -Path $nvme -Name ForcedPhysicalSectorSizeInBytes -PropertyType MultiString -Value @("* 4095") -Force | Out-Null
    }
    Yaz "YENIDEN BASLAT: disk sektor boyutu $sektor bayt; SQL Server icin Windows ayari yapildi. Bilgisayari yeniden baslatip kurulumu tekrar calistirin."
    exit 2
  }
}
# Bir TCP portunu dinleyen surec (yoksa $null)
function PortSahibi([int]$p) {
  $b = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $b) { return $null }
  return (Get-CimInstance Win32_Process -Filter "ProcessId=$($b.OwningProcess)" -ErrorAction SilentlyContinue)
}

try {
  Yaz "Kurulum sonrasi hazirlik basladi. Kok: $Kok"
  if (-not $Deneme) {
    & icacls $Veri /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
  }
  if (-not (Test-Path (Join-Path $Veri "firma.lky"))) { throw "firma.lky bulunamadi ($Veri)." }

  # --- 2) SQL Server
  $sqlYonetimBaglanti = $SqlYonetim
  $sqlUygulama = $UygulamaSunucu
  # Bilgisayarda kendi ornegimiz yoksa sartlari tutan var olan ornek kullanilir (sql-bul.ps1, bolum 17); ayarlarina dokunulmaz
  if (-not $sqlYonetimBaglanti) {
    . (Join-Path $PSScriptRoot "sql-bul.ps1") -Ornek $Ornek -VeritabaniAdi $VeritabaniAdi
    $secim = SqlOrnekSec { param($m) Yaz $m }
    if ($secim -and $secim -ne "kendi") {
      Yaz "Var olan SQL ornegi kullaniliyor: $($secim.Ad) ($($secim.Uygulama))"
      $sqlYonetimBaglanti = $secim.Yonetim
      $sqlUygulama = $secim.Uygulama
    }
  }
  if (-not $sqlYonetimBaglanti) {
    $servis = Get-Service -Name "MSSQL`$$Ornek" -ErrorAction SilentlyContinue
    # SQL kurulmadan once ya da kurulu ama acilmiyorsa (onceki denemede sektor sorunuyla yarim kalmis olabilir)
    if (-not $servis -or $servis.Status -ne "Running") { SektorDenetle }
    if (-not $servis) {
      if (-not $SqlKurulum -or -not (Test-Path $SqlKurulum)) { throw "SQL Server bulunamadi ve kurulum dosyasi yok (internetten indirilemedi)." }
      # Dosya kurulum sirasinda Microsoft'tan indirildi: sabit ozet yerine Microsoft imzasi denetlenir
      $imza = Get-AuthenticodeSignature -FilePath $SqlKurulum
      if ($imza.Status -ne "Valid" -or "$($imza.SignerCertificate.Subject)" -notmatch 'O=Microsoft Corporation') {
        throw "Indirilen SQL Server kurulum dosyasinin Microsoft imzasi gecersiz ($($imza.Status)). Internet baglantinizi kontrol edip kurulumu tekrar calistirin."
      }
      Yaz "SQL Server Express kuruluyor (birkac dakika surer)..."
      $saSifre = RastgeleSifre 32
      $arg = "/Q /IACCEPTSQLSERVERLICENSETERMS /ACTION=Install /FEATURES=SQLEngine /INSTANCENAME=$Ornek /SECURITYMODE=SQL /SAPWD=`"$saSifre`" /SQLSYSADMINACCOUNTS=`"NT AUTHORITY\SYSTEM`" `"BUILTIN\Administrators`" /TCPENABLED=1 /UPDATEENABLED=0 /SQLSVCSTARTUPTYPE=Automatic"
      $p = Start-Process -FilePath $SqlKurulum -ArgumentList $arg -Wait -PassThru
      if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "SQL Server Express kurulumu basarisiz (kod $($p.ExitCode)). Ayrinti: C:\Program Files\Microsoft SQL Server\*\Setup Bootstrap\Log" }
      $servis = Get-Service -Name "MSSQL`$$Ornek"
    }
    # Sabit TCP portu (agdaki diger bilgisayarlar ve uygulama icin)
    $sahip = PortSahibi $SqlPort
    if ($sahip -and $sahip.Name -ne "sqlservr.exe") { throw "SQL Server icin $SqlPort numarali port baska bir program tarafindan kullaniliyor: $($sahip.Name) (PID $($sahip.ProcessId)). Programi kapatip kurulumu tekrar calistirin." }
    $kimlik = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL").$Ornek
    $tcp = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$kimlik\MSSQLServer\SuperSocketNetLib\Tcp"
    Set-ItemProperty -Path $tcp -Name Enabled -Value 1
    Set-ItemProperty -Path "$tcp\IPAll" -Name TcpPort -Value "$SqlPort"
    Set-ItemProperty -Path "$tcp\IPAll" -Name TcpDynamicPorts -Value ""
    Restart-Service -Name "MSSQL`$$Ornek" -Force
    Start-Sleep -Seconds 5
    $sqlYonetimBaglanti = "Server=localhost\$Ornek;Database=master;Integrated Security=SSPI;Connection Timeout=30"
    $sqlUygulama = "127.0.0.1,$SqlPort"
  }

  # --- 3) Veritabani + uygulama girisi
  $varMi = SqlCalistir $sqlYonetimBaglanti "SELECT COUNT(*) FROM sys.databases WHERE name = N'$VeritabaniAdi'"
  if ($varMi -eq 0) {
    $sablon = Join-Path $Kok "sablon\sablon.bak"
    if (-not (Test-Path $sablon)) { throw "Sablon bulunamadi: $sablon" }
    Yaz "Firma veritabani sablondan aciliyor: $VeritabaniAdi"
    $veriYolu = SqlCalistir $sqlYonetimBaglanti "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260))"
    $logYolu = SqlCalistir $sqlYonetimBaglanti "SELECT CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(260))"
    $sablonSql = $sablon.Replace("'", "''")
    $c = New-Object System.Data.SqlClient.SqlConnection $sqlYonetimBaglanti; $c.Open()
    $k = $c.CreateCommand(); $k.CommandText = "RESTORE FILELISTONLY FROM DISK = N'$sablonSql'"; $k.CommandTimeout = 600
    $r = $k.ExecuteReader(); $move = @(); $i = 0
    while ($r.Read()) {
      $ad = [string]$r["LogicalName"]; $tur = [string]$r["Type"]
      if ($tur -eq "L") { $hedef = "$logYolu$VeritabaniAdi" + "_log.ldf" } else { $i++; $hedef = if ($i -eq 1) { "$veriYolu$VeritabaniAdi.mdf" } else { "$veriYolu$VeritabaniAdi" + "_$i.ndf" } }
      $move += "MOVE N'$($ad.Replace("'", "''"))' TO N'$($hedef.Replace("'", "''"))'"
    }
    $r.Close(); $c.Close()
    SqlCalistir $sqlYonetimBaglanti ("RESTORE DATABASE [$VeritabaniAdi] FROM DISK = N'$sablonSql' WITH RECOVERY, " + ($move -join ", ")) | Out-Null
    SqlCalistir $sqlYonetimBaglanti "ALTER AUTHORIZATION ON DATABASE::[$VeritabaniAdi] TO [$((SqlCalistir $sqlYonetimBaglanti 'SELECT SUSER_SNAME(0x01)'))]" | Out-Null
  } else {
    Yaz "Firma veritabani zaten var; dokunulmadi: $VeritabaniAdi"
  }
  $girisAdi = "likya_app"
  $girisSifre = RastgeleSifre 28
  SqlCalistir $sqlYonetimBaglanti @"
IF SUSER_ID(N'$girisAdi') IS NULL
  CREATE LOGIN [$girisAdi] WITH PASSWORD = N'$girisSifre', CHECK_POLICY = OFF, DEFAULT_DATABASE = [$VeritabaniAdi];
ELSE
  ALTER LOGIN [$girisAdi] WITH PASSWORD = N'$girisSifre';
EXEC (N'USE [$VeritabaniAdi]; IF USER_ID(N''$girisAdi'') IS NULL CREATE USER [$girisAdi] FOR LOGIN [$girisAdi]; ALTER ROLE [db_owner] ADD MEMBER [$girisAdi];');
"@ | Out-Null
  Yaz "Uygulama SQL girisi hazir: $girisAdi"

  # --- 4) .env
  $envYolu = Join-Path $Kok "uygulama\backend\.env"
  $eski = @{}
  if (Test-Path $envYolu) {
    foreach ($s in Get-Content $envYolu) { if ($s -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $eski[$Matches[1]] = $Matches[2] } }
  }
  # Port: daha once kurulduysa .env'deki port korunur (guncelle.ps1 de portu .env'den okur)
  if (-not $PSBoundParameters.ContainsKey("Port") -and $eski["PORT"] -match '^\d+$') { $Port = [int]$eski["PORT"] }
  # Sifreleme anahtarlarinin ikinci kopyasi veri klasorunde (yalniz SYSTEM ve Yoneticiler): program klasoru silinip
  # yeniden kurulursa da kayitli e-Belge / GIB / Vomsis sifreleri cozulebilsin (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, E13)
  $anahtarYolu = Join-Path $Veri "anahtar.env"
  if (Test-Path $anahtarYolu) {
    foreach ($s in Get-Content $anahtarYolu) { if ($s -match '^\s*([A-Z_]+)\s*=\s*(.*)$' -and -not $eski[$Matches[1]]) { $eski[$Matches[1]] = $Matches[2] } }
  }
  $jwtA = if ($eski["JWT_ACCESS_SECRET"]) { $eski["JWT_ACCESS_SECRET"] } else { RastgeleSifre 48 }
  $jwtR = if ($eski["JWT_REFRESH_SECRET"]) { $eski["JWT_REFRESH_SECRET"] } else { RastgeleSifre 48 }
  # Firma veritabanindaki sifreler bu anahtarlarla saklanir: e-Belge (ICE), GIB hesabi (EBELGE_ENC_KEY, 64 hex) ve
  # e-Banka/Vomsis API sifresi (ADMIN_DB_ENC_KEY; ADMIN_DB_USER bos kaldigi icin admin veritabani baglantisi acilmaz).
  # Yoksa kurulumda bu sifreler hic kaydedilemiyordu. Bir kez uretilir, yeniden kurulumda korunur (degisirse kayitli sifreler cozulemez).
  $hex = { $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString("x2") }) }
  $ebelgeAnahtar = if ($eski["EBELGE_ENC_KEY"]) { $eski["EBELGE_ENC_KEY"] } else { & $hex }
  $bankaAnahtar = if ($eski["ADMIN_DB_ENC_KEY"]) { $eski["ADMIN_DB_ENC_KEY"] } else { & $hex }
  $icerik = @"
# Likya Kuyum kurulum ayarlari (kur-sonrasi.ps1 yazdi). Elle degistirmeyin.
PORT=$Port
NODE_ENV=production
LOG_LEVEL=info
KURULUM_MODU=1
MERKEZ_GIRIS=kapali
VERI_KLASORU=$Veri
KURULUM_DB_SERVER=$sqlUygulama
KURULUM_DB_NAME=$VeritabaniAdi
KURULUM_DB_USER=$girisAdi
KURULUM_DB_PASSWORD=$girisSifre
ARAYUZ_KLASORU=$(Join-Path $Kok "uygulama\web")
JWT_ACCESS_SECRET=$jwtA
JWT_REFRESH_SECRET=$jwtR
EBELGE_ENC_KEY=$ebelgeAnahtar
ADMIN_DB_ENC_KEY=$bankaAnahtar
CORS_ORIGIN=*
"@
  [IO.File]::WriteAllText($envYolu, $icerik, (New-Object Text.UTF8Encoding($false)))
  $anahtarIcerik = "# Likya Kuyum sifreleme anahtarlari (kur-sonrasi.ps1). SILMEYIN: kayitli sifreler bu anahtarlarla cozulur.`r`nEBELGE_ENC_KEY=$ebelgeAnahtar`r`nADMIN_DB_ENC_KEY=$bankaAnahtar`r`nJWT_ACCESS_SECRET=$jwtA`r`nJWT_REFRESH_SECRET=$jwtR`r`n"
  [IO.File]::WriteAllText($anahtarYolu, $anahtarIcerik, (New-Object Text.UTF8Encoding($false)))
  if (-not $Deneme) {
    & icacls $envYolu /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $Kok "uygulama\backend\uploads") | Out-Null
  }
  Yaz ".env yazildi."

  # --- 4b) Firma belge klasoru (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K6): program SYSTEM ile yazar,
  # bilgisayarin kullanicilari Gezgin'den acip okuyabilir. Uygulama klasorunun disinda; guncelleme ve kaldirma dokunmaz.
  $belgeler = Join-Path $Kok "Belgeler"
  New-Item -ItemType Directory -Force -Path $belgeler | Out-Null
  if (-not $Deneme) {
    & icacls $belgeler /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-32-545:(OI)(CI)RX" | Out-Null
  }
  Yaz "Belge klasoru hazir: $belgeler"

  # --- 5) Baslangic gorevi + guvenlik duvari
  if (-not $Deneme) {
    $node = Join-Path $Kok "node\node.exe"
    $be = Join-Path $Kok "uygulama\backend"
    # Port baska bir programdaysa program acilamaz; nedeni acikca yazilir (yalniz "yanit vermedi" diyordu)
    Stop-ScheduledTask -TaskName "LikyaKuyum" -ErrorAction SilentlyContinue
    $sahip = PortSahibi $Port
    if ($sahip -and -not ("$($sahip.ExecutablePath)" -like "$Kok*")) {
      throw "$Port numarali port baska bir program tarafindan kullaniliyor: $($sahip.Name) (PID $($sahip.ProcessId)). Programi kapatip kurulumu tekrar calistirin."
    }
    $eylem = New-ScheduledTaskAction -Execute $node -Argument "dist\server.js" -WorkingDirectory $be
    # Acilista + 5 dakikada bir bekci: "basarisiz olursa yeniden baslat" ayari program hata koduyla kapaninca calismiyor
    # (denendi). Program calisiyorsa tekrar tetigi bir sey yapmaz (IgnoreNew), kapanmissa yeniden acar.
    $tetik = @(
      (New-ScheduledTaskTrigger -AtStartup),
      (New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5))
    )
    $kim = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $ayar = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName "LikyaKuyum" -Action $eylem -Trigger $tetik -Principal $kim -Settings $ayar -Force | Out-Null
    Stop-ScheduledTask -TaskName "LikyaKuyum" -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName "LikyaKuyum"
    Get-NetFirewallRule -DisplayName "Likya Kuyum" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    # Butun ag profilleri (dukkan aglari cogu zaman "Genel" gorunur; yalniz Ozel/Etki alani acikken diger bilgisayarlar
    # baglanamiyordu), ama yalniz yerel alt agdan
    New-NetFirewallRule -DisplayName "Likya Kuyum" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null
    Yaz "Baslangic gorevi ve guvenlik duvari hazir."
    # Kisayol: port degistiyse kisayol da ayni portu acsin
    $url = "[InternetShortcut]`r`nURL=http://localhost:$Port/login`r`n"
    [IO.File]::WriteAllText((Join-Path $Kok "LikyaKuyum.url"), $url, (New-Object Text.UTF8Encoding($false)))

    $saglik = "http://127.0.0.1:$Port/api/v1/health"
    $tamam = $false
    for ($i = 0; $i -lt 45 -and -not $tamam; $i++) {
      Start-Sleep -Seconds 2
      try { $tamam = (Invoke-WebRequest -Uri $saglik -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch { }
    }
    if (-not $tamam) { throw "Program baslatildi ancak $saglik yanit vermedi. Gunluk: $(Join-Path $Veri 'log\likya.log')" }
  }
  Yaz "TAMAM: kurulum hazir."
  exit 0
} catch {
  Yaz ("HATA: " + $_.Exception.Message)
  exit 1
}
