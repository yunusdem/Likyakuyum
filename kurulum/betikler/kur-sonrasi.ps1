# Likya Kuyum - kurulum sonrasi hazirlik (Inno Setup tarafindan, yonetici olarak calistirilir)
# docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.4
#  1) Veri klasoru (C:\ProgramData\LikyaKuyum) ve firma.lky denetimi
#  2) SQL Server Express (ornek LIKYA, TCP 14330): yoksa sessiz kurulur
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

try {
  Yaz "Kurulum sonrasi hazirlik basladi. Kok: $Kok"
  if (-not $Deneme) {
    & icacls $Veri /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
  }
  if (-not (Test-Path (Join-Path $Veri "firma.lky"))) { throw "firma.lky bulunamadi ($Veri)." }

  # --- 2) SQL Server
  $sqlYonetimBaglanti = $SqlYonetim
  $sqlUygulama = $UygulamaSunucu
  if (-not $sqlYonetimBaglanti) {
    $servis = Get-Service -Name "MSSQL`$$Ornek" -ErrorAction SilentlyContinue
    if (-not $servis) {
      if (-not $SqlKurulum -or -not (Test-Path $SqlKurulum)) { throw "SQL Server bulunamadi ve kurulum dosyasi yok." }
      Yaz "SQL Server Express kuruluyor (birkac dakika surer)..."
      $saSifre = RastgeleSifre 32
      $arg = "/Q /IACCEPTSQLSERVERLICENSETERMS /ACTION=Install /FEATURES=SQLEngine /INSTANCENAME=$Ornek /SECURITYMODE=SQL /SAPWD=`"$saSifre`" /SQLSYSADMINACCOUNTS=`"NT AUTHORITY\SYSTEM`" `"BUILTIN\Administrators`" /TCPENABLED=1 /UPDATEENABLED=0 /SQLSVCSTARTUPTYPE=Automatic"
      $p = Start-Process -FilePath $SqlKurulum -ArgumentList $arg -Wait -PassThru
      if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "SQL Server Express kurulumu basarisiz (kod $($p.ExitCode)). Ayrinti: C:\Program Files\Microsoft SQL Server\*\Setup Bootstrap\Log" }
      $servis = Get-Service -Name "MSSQL`$$Ornek"
    }
    # Sabit TCP portu (agdaki diger bilgisayarlar ve uygulama icin)
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
  $jwtA = if ($eski["JWT_ACCESS_SECRET"]) { $eski["JWT_ACCESS_SECRET"] } else { RastgeleSifre 48 }
  $jwtR = if ($eski["JWT_REFRESH_SECRET"]) { $eski["JWT_REFRESH_SECRET"] } else { RastgeleSifre 48 }
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
CORS_ORIGIN=*
"@
  [IO.File]::WriteAllText($envYolu, $icerik, (New-Object Text.UTF8Encoding($false)))
  if (-not $Deneme) {
    & icacls $envYolu /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $Kok "uygulama\backend\uploads") | Out-Null
  }
  Yaz ".env yazildi."

  # --- 5) Baslangic gorevi + guvenlik duvari
  if (-not $Deneme) {
    $node = Join-Path $Kok "node\node.exe"
    $be = Join-Path $Kok "uygulama\backend"
    $eylem = New-ScheduledTaskAction -Execute $node -Argument "dist\server.js" -WorkingDirectory $be
    $tetik = New-ScheduledTaskTrigger -AtStartup
    $kim = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $ayar = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName "LikyaKuyum" -Action $eylem -Trigger $tetik -Principal $kim -Settings $ayar -Force | Out-Null
    Stop-ScheduledTask -TaskName "LikyaKuyum" -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName "LikyaKuyum"
    Get-NetFirewallRule -DisplayName "Likya Kuyum" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName "Likya Kuyum" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain, Private | Out-Null
    Yaz "Baslangic gorevi ve guvenlik duvari hazir."

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
