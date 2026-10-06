# Likya Kuyum - kaldirma (Inno Setup kaldirma sirasinda calistirir)
# Program gorevleri ve guvenlik duvari kurali kaldirilir. VERITABANI ve VERI KLASORU SILINMEZ (firmanin verisi).
$ErrorActionPreference = "SilentlyContinue"
Stop-ScheduledTask -TaskName "LikyaKuyum"
Unregister-ScheduledTask -TaskName "LikyaKuyum" -Confirm:$false
Unregister-ScheduledTask -TaskName "LikyaKuyumGuncelle" -Confirm:$false
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "server\.js" -and $_.ExecutablePath -like "$(Split-Path -Parent $PSScriptRoot)*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-NetFirewallRule -DisplayName "Likya Kuyum" | Remove-NetFirewallRule
exit 0
