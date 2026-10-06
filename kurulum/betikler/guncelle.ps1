# Likya Kuyum - yeni surumu uygular, acilmazsa eski surume doner. Sonuc: <Veri>\guncelleme\sonuc.json
# Program "LikyaKuyum" baslangic goreviyle calisir; bu betik ayri bir gorevden (LikyaKuyumGuncelle, SYSTEM) cagrilir.
# -Deneme: gorev yerine dogrudan node sureci baslatilir/durdurulur (yonetici gerektirmeyen yerel deneme icin).
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
$saglik = "http://127.0.0.1:$Port/api/v1/health"
$pidDosyasi = Join-Path $Kok "deneme.pid"

function Yaz([string]$m) { Add-Content -Path $Gunluk -Value ("{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) }
function Sonuc([bool]$b, [string]$m) {
  $j = @{ surum = $Surum; basarili = $b; mesaj = $m; zaman = (Get-Date).ToString("o") } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $gk "sonuc.json"), $j, (New-Object Text.UTF8Encoding($false)))
  Yaz "SONUC: $b - $m"
}
function Durdur {
  if ($Deneme) {
    if (Test-Path $pidDosyasi) { Stop-Process -Id ([int](Get-Content $pidDosyasi)) -Force -ErrorAction SilentlyContinue; Remove-Item $pidDosyasi -Force }
  } else {
    Stop-ScheduledTask -TaskName $Gorev -ErrorAction SilentlyContinue
    $desen = [regex]::Escape($uyg)
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "server\.js" -and ($_.ExecutablePath -like "$Kok*") } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  for ($i = 0; $i -lt 20; $i++) {
    try { Invoke-WebRequest -Uri $saglik -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Sleep -Milliseconds 500 } catch { return }
  }
}
function Baslat {
  if ($Deneme) {
    $p = Start-Process -FilePath $DenemeNode -ArgumentList "dist\server.js" -WorkingDirectory (Join-Path $uyg "backend") -WindowStyle Hidden -PassThru
    Set-Content -Path $pidDosyasi -Value $p.Id
  } else {
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
  if (Test-Path (Join-Path $kaynak "backend\uploads")) { Copy-Item (Join-Path $kaynak "backend\uploads") (Join-Path $hedef "backend") -Recurse -Force }
  if (-not $Deneme) { & icacls (Join-Path $hedef "backend\.env") /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" | Out-Null }
}

$degistirildi = $false
try {
  Yaz "Guncelleme basladi: $Surum ($Zip)"
  if (-not (Test-Path $Zip)) { throw "Paket bulunamadi: $Zip" }
  if (Test-Path $yeni) { Remove-Item $yeni -Recurse -Force }
  Expand-Archive -Path $Zip -DestinationPath $yeni -Force
  if (-not (Test-Path (Join-Path $yeni "backend\dist\server.js")) -or -not (Test-Path (Join-Path $yeni "backend\BUTUNLUK.json"))) { throw "Paket eksik (backend\dist\server.js / BUTUNLUK.json yok)." }
  KorunanlariTasi $uyg $yeni

  Durdur
  if (Test-Path $onceki) { Remove-Item $onceki -Recurse -Force }
  Rename-Item $uyg $onceki
  Rename-Item $yeni $uyg
  $degistirildi = $true
  Baslat
  if (SaglikBekle) {
    Remove-Item (Join-Path $gk "bekleyen.json") -Force -ErrorAction SilentlyContinue
    Remove-Item $Zip -Force -ErrorAction SilentlyContinue
    if (Test-Path $hatali) { Remove-Item $hatali -Recurse -Force }
    Sonuc $true "Surum $Surum yuklendi."
    exit 0
  }
  throw "Yeni surum acilmadi (saglik denetimi $SaglikSaniye sn icinde yanit vermedi)."
} catch {
  $hata = $_.Exception.Message
  Yaz "HATA: $hata"
  try {
    if ($degistirildi -and (Test-Path $onceki)) {
      Durdur
      if (Test-Path $hatali) { Remove-Item $hatali -Recurse -Force }
      Rename-Item $uyg $hatali
      Rename-Item $onceki $uyg
      Baslat
      $geri = SaglikBekle
      Sonuc $false ("$hata Eski surume donuldu" + $(if ($geri) { "." } else { " ancak program yanit vermiyor!" }))
    } else {
      if (Test-Path $yeni) { Remove-Item $yeni -Recurse -Force -ErrorAction SilentlyContinue }
      Sonuc $false $hata
    }
  } catch {
    Sonuc $false ("$hata / geri alma hatasi: " + $_.Exception.Message)
  }
  exit 1
}
