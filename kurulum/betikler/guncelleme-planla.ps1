# Likya Kuyum - indirilen surumun uygulanmasini planlar (program, SYSTEM olarak calisirken cagirir)
# Varsayilan: bir sonraki 03:00'te; -Hemen: hemen baslatir. Gorev: "LikyaKuyumGuncelle" (SYSTEM), araclar\guncelle.ps1
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [Parameter(Mandatory = $true)][string]$Surum,
  [switch]$Hemen
)
$ErrorActionPreference = "Stop"
$betik = Join-Path $PSScriptRoot "guncelle.ps1"
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$betik`" -Zip `"$Zip`" -Surum `"$Surum`""
$simdi = Get-Date
$zaman = $simdi.Date.AddHours(3)
if ($zaman -le $simdi) { $zaman = $zaman.AddDays(1) }
$eylem = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
$tetik = New-ScheduledTaskTrigger -Once -At $zaman
$kim = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$ayar = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "LikyaKuyumGuncelle" -Action $eylem -Trigger $tetik -Principal $kim -Settings $ayar -Force | Out-Null
if ($Hemen) { Start-ScheduledTask -TaskName "LikyaKuyumGuncelle" }
Write-Output ("Planlandi: {0} -> {1}" -f $Surum, $(if ($Hemen) { "simdi" } else { $zaman.ToString("yyyy-MM-dd HH:mm") }))
exit 0
