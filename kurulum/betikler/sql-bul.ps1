# Likya Kuyum - kullanilacak SQL Server orneginin secimi (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, bolum 17)
# kur-sonrasi.ps1 nokta ile yukler (SqlOrnekSec). Inno Setup ayrica -Denetim ile cagirir: indirme gerekip gerekmedigine karar verir.
#   exit 0  : kendi ornegimiz (LIKYA) ya da kullanilabilir baska bir ornek var -> SQL indirilmez
#   exit 10 : uygun ornek yok -> SQL Server Express indirilip LIKYA ornegi kurulur
# Var olan ornek (or. eski programin SQLEXPRESS'i) su sartlarla kullanilir; hicbir ayarina dokunulmaz:
#   servis calisiyor ve otomatik baslar, surum 17 (SQL Server 2025) ve ustu, TCP acik ve sabit port, karisik kimlik dogrulama
#   acik, bu Windows hesabi sysadmin, ornekte ayni adli veritabani yok ya da bizim semamiz (TODVZ_TANIM) var.
param(
  [switch]$Denetim,
  [string]$Ornek = "LIKYA",
  [string]$VeritabaniAdi = "LIKYA"
)

$SqlKayit = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server"

function SqlTek([string]$Baglanti, [string]$Sorgu) {
  $c = New-Object System.Data.SqlClient.SqlConnection $Baglanti
  $c.Open()
  try { $k = $c.CreateCommand(); $k.CommandText = $Sorgu; $k.CommandTimeout = 30; return $k.ExecuteScalar() } finally { $c.Close() }
}

# Kurulu orneklerin listesi: @{ Ad; Kimlik; Servis }
function SqlOrnekleri {
  $liste = @()
  $adlar = Get-ItemProperty "$SqlKayit\Instance Names\SQL" -ErrorAction SilentlyContinue
  if (-not $adlar) { return $liste }
  foreach ($p in $adlar.PSObject.Properties) {
    if ($p.Name -like "PS*") { continue }
    $servis = if ($p.Name -eq "MSSQLSERVER") { "MSSQLSERVER" } else { "MSSQL`$$($p.Name)" }
    $liste += [pscustomobject]@{ Ad = $p.Name; Kimlik = [string]$p.Value; Servis = $servis }
  }
  return $liste
}

# Var olan ornegin kullanilabilirligi. Uygunsa @{ Ad; Yonetim; Uygulama }, degilse nedeni yazilir ve $null doner.
function OrnekUygunMu($o, [scriptblock]$Bildir) {
  $neden = {
    param($m)
    # Bildirim ciktisi donus degerine karismasin ($Bildir adi: kur-sonrasi.ps1'deki $Gunluk dosya yolunu golgelemesin)
    if ($Bildir) { & $Bildir "SQL ornegi $($o.Ad) kullanilmadi: $m" | Out-Null }
  }
  $s = Get-CimInstance Win32_Service -Filter "Name='$($o.Servis.Replace("'", "''"))'" -ErrorAction SilentlyContinue
  if (-not $s) { & $neden "servis yok"; return $null }
  if ($s.State -ne "Running") { & $neden "servis calismiyor"; return $null }
  if ($s.StartMode -ne "Auto") { & $neden "servis otomatik baslamiyor"; return $null }
  $tcp = "$SqlKayit\$($o.Kimlik)\MSSQLServer\SuperSocketNetLib\Tcp"
  $acik = (Get-ItemProperty $tcp -ErrorAction SilentlyContinue).Enabled
  $port = [string](Get-ItemProperty "$tcp\IPAll" -ErrorAction SilentlyContinue).TcpPort
  if ($acik -ne 1) { & $neden "TCP kapali"; return $null }
  if ($port -notmatch '^\d+$') { & $neden "sabit TCP portu yok"; return $null }
  # Uygulama TCP ile baglanir: port gercekten dinleniyor mu
  $t = New-Object Net.Sockets.TcpClient
  try { $t.Connect("127.0.0.1", [int]$port) } catch { & $neden "TCP $port portuna baglanilamadi"; return $null } finally { $t.Close() }
  # Yonetim baglantisi paylasilan bellekle (lpc): TCP + Windows kimliginde bazi bilgisayarlarda SPN hatasi aliniyor
  $hedef = if ($o.Ad -eq "MSSQLSERVER") { "lpc:." } else { "lpc:.\$($o.Ad)" }
  $yonetim = "Server=$hedef;Database=master;Integrated Security=SSPI;Connection Timeout=15"
  try {
    $surum = [int](SqlTek $yonetim "SELECT CAST(SERVERPROPERTY('ProductMajorVersion') AS int)")
    if ($surum -lt 17) { & $neden "surum $surum (en az 17 / SQL Server 2025 gerekli)"; return $null }
    if ([int](SqlTek $yonetim "SELECT IS_SRVROLEMEMBER('sysadmin')") -ne 1) { & $neden "bu Windows hesabi sysadmin degil"; return $null }
    if ([int](SqlTek $yonetim "SELECT CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS int)") -eq 1) { & $neden "karisik kimlik dogrulama kapali"; return $null }
    $vt = $VeritabaniAdi.Replace("]", "]]").Replace("'", "''")
    $durum = [int](SqlTek $yonetim "IF DB_ID(N'$vt') IS NULL SELECT 0 ELSE IF OBJECT_ID(N'[$vt].dbo.TODVZ_TANIM') IS NOT NULL SELECT 1 ELSE SELECT 2")
    if ($durum -eq 2) { & $neden "$VeritabaniAdi adli baska bir veritabani var"; return $null }
  } catch {
    & $neden ("baglanilamadi: " + $_.Exception.Message); return $null
  }
  return [pscustomobject]@{ Ad = $o.Ad; Yonetim = $yonetim; Uygulama = "127.0.0.1,$port"; Yeni = $false }
}

# Secim: once kendi ornegimiz (varsa kur-sonrasi onu hazirlar), sonra bizim veritabanimizi tasiyan, sonra herhangi uygun ornek.
# Donus: "kendi" | uygun ornek nesnesi | $null (indirilip kurulmali)
function SqlOrnekSec([scriptblock]$Bildir) {
  $ornekler = SqlOrnekleri
  if ($ornekler | Where-Object { $_.Ad -eq $Ornek }) { return "kendi" }
  $uygun = @()
  foreach ($o in $ornekler) { $u = OrnekUygunMu $o $Bildir; if ($u) { $uygun += $u } }
  if ($uygun.Count -eq 0) { return $null }
  $vt = $VeritabaniAdi.Replace("'", "''")
  foreach ($u in $uygun) {
    try { if ([int](SqlTek $u.Yonetim "SELECT CASE WHEN DB_ID(N'$vt') IS NULL THEN 0 ELSE 1 END") -eq 1) { return $u } } catch { }
  }
  return $uygun[0]
}

if ($Denetim) {
  $ErrorActionPreference = "Continue"
  try { $secim = SqlOrnekSec $null } catch { $secim = $null }
  if ($secim) { exit 0 } else { exit 10 }
}
