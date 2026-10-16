# Likya Kuyum - yeniden kurulumdan once programi durdurur (Inno Setup PrepareToInstall cagirir, gecici klasorden)
# Gorev devre disi birakilir (5 dakikalik bekci tetigi dosyalar kopyalanirken programi yeniden acmasin), calisan node
# sureci kapatilir: node.exe kilitliyken kurulum "dosya kullanimda" penceresinde takiliyordu. kur-sonrasi.ps1 gorevi
# yeniden kaydeder (etkin); kurulum basarisiz olursa Inno gorevi yeniden etkinlestirir.
param([Parameter(Mandatory = $true)][string]$Kok)
$ErrorActionPreference = "SilentlyContinue"
Disable-ScheduledTask -TaskName "LikyaKuyum" | Out-Null
Stop-ScheduledTask -TaskName "LikyaKuyum"
Stop-ScheduledTask -TaskName "LikyaKuyumGuncelle"
$idler = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -like "$Kok\*" } | ForEach-Object { $_.ProcessId })
foreach ($i in $idler) { Stop-Process -Id $i -Force }
foreach ($i in $idler) { Wait-Process -Id $i -Timeout 20 }
exit 0
