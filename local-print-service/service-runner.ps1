# Likya Kuyumcu ERP - Standalone Native Windows Print Service
# Port: 5050 (Node.js veya harici yukleme gerektirmez, 100% native Windows PowerShell)
param([int]$Port = 5050)

$url = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  LIKYA KUYUMCU ERP - YEREL SESSIZ YAZDIRMA SERVISI" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Port       : $url" -ForegroundColor Green
    Write-Host "  Durum      : AKTIF VE DINLENIYOR" -ForegroundColor Green
    Write-Host "  Tarayici   : likyakuyum.com / localhost baglantisi hazir" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Bu pencere acik kaldigi surece web uygulamasindan gonderilen" -ForegroundColor Gray
    Write-Host "tum fisler bu bilgisayardaki yazicidan aninda yazdirilir." -ForegroundColor Gray
    Write-Host "Kapatmak icin pencereyi carpisindan kapatabilir veya Ctrl+C yapabilirsiniz." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[HATA] Port $Port dinlenemedi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$tmpDir = Join-Path $env:TEMP "likya-print-temp"
if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null }

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        # CORS ve Chrome Private Network Access basliklari
        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.Headers.Add("Access-Control-Allow-Headers", "*")
        $res.Headers.Add("Access-Control-Allow-Private-Network", "true")

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        $path = $req.Url.AbsolutePath.ToLower()

        if ($path -eq "/printers") {
            try {
                $rawPrinters = Get-CimInstance Win32_Printer | Select-Object Name, DeviceID, Default, Local, Network, WorkOffline
                $printerList = @()
                foreach ($p in $rawPrinters) {
                    $printerList += @{
                        name = if ($p.Name) { $p.Name } else { $p.DeviceID }
                        isDefault = [bool]$p.Default
                        isOnline = -not [bool]$p.WorkOffline
                        isLocal = [bool]$p.Local
                        isNetwork = [bool]$p.Network
                    }
                }
                $payload = @{
                    success = $true
                    count = $printerList.Count
                    printers = $printerList
                }
                $json = $payload | ConvertTo-Json -Depth 3 -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType = "application/json; charset=utf-8"
                $res.ContentLength64 = $buffer.Length
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
            } catch {
                $errJson = '{"success":false,"printers":[]}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                $res.ContentType = "application/json; charset=utf-8"
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $res.Close()
            continue
        }

        if ($path -eq "/print" -and $req.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $printObj = $body | ConvertFrom-Json
            $printerName = $printObj.printerName
            $text = $printObj.text
            $html = $printObj.html

            try {
                if ($text) {
                    $rndFile = Join-Path $tmpDir ("print_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ".txt")
                    [System.IO.File]::WriteAllText($rndFile, $text, [System.Text.Encoding]::UTF8)
                    if ($printerName) {
                        Get-Content -Path $rndFile -Raw | Out-Printer -Name $printerName
                    } else {
                        Get-Content -Path $rndFile -Raw | Out-Printer
                    }
                    Start-Sleep -Milliseconds 800
                    Remove-Item $rndFile -Force -ErrorAction SilentlyContinue
                } elseif ($html) {
                    # HTML temiz metne cevrilip gonderilir veya default yaziciya iletilir
                    $rndFile = Join-Path $tmpDir ("print_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ".html")
                    [System.IO.File]::WriteAllText($rndFile, $html, [System.Text.Encoding]::UTF8)
                    if ($printerName) {
                        Start-Process -FilePath $rndFile -Verb PrintTo -ArgumentList "`"$printerName`"" -PassThru | ForEach-Object { Start-Sleep -Seconds 2; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
                    } else {
                        Start-Process -FilePath $rndFile -Verb Print -PassThru | ForEach-Object { Start-Sleep -Seconds 2; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
                    }
                    Start-Sleep -Milliseconds 800
                    Remove-Item $rndFile -Force -ErrorAction SilentlyContinue
                }

                $ret = '{"success":true,"message":"Yazdirma komutu Windows yazicisina iletildi."}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($ret)
                $res.ContentType = "application/json; charset=utf-8"
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
            } catch {
                $ret = '{"success":false,"message":"' + $_.Exception.Message.Replace('"', '\"') + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($ret)
                $res.ContentType = "application/json; charset=utf-8"
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $res.Close()
            continue
        }

        # Status / Ping
        $statusJson = '{"success":true,"service":"Likya Kuyumcu Yerel Sessiz Yazici Servisi","status":"online","port":' + $Port + '}'
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($statusJson)
        $res.ContentType = "application/json; charset=utf-8"
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
        $res.Close()

    } catch {
        # Listener dongusu hata alirsa devam etsin
    }
}
