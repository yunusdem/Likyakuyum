import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { YaziciService } from "../services/yazici.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class YaziciController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body.dbName as string),
    };
  }

  /**
   * POST /api/v1/yazici/register-client-printers
   * İstemci bilgisayarındaki yerel yazıcı servisi veya tarayıcı tarafından çağrılır.
   */
  public static registerClientPrinters = asyncHandler(async (req: Request, res: Response) => {
    const rawIp = (
      req.headers["cf-connecting-ip"]?.toString().trim() ||
      req.headers["x-real-ip"]?.toString().trim() ||
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    ).replace(/^.*:/, "");
    const clientIp = rawIp === "1" ? "127.0.0.1" : rawIp;
    const { computerName, userName, printers, userId, token, workstationToken } = req.body;
    const finalUserId = (req.user as any)?.userId || (req.user as any)?.id || userId;
    const finalToken = token || workstationToken;
    const result = YaziciService.registerClientPrinters({
      clientIp,
      computerName,
      userName,
      token: finalToken,
      userId: finalUserId,
      printers: Array.isArray(printers) ? printers : [],
    });
    return ApiResponse.ok(res, "İstemci yazıcıları kaydedildi.", result);
  });

  /**
   * GET /api/v1/yazici/client-printers
   * Bu bilgisayara (IP veya Kullanıcıya) ait kayıtlı canlı yazıcıları döndürür.
   */
  public static getClientPrinters = asyncHandler(async (req: Request, res: Response) => {
    const rawIp = (
      req.headers["cf-connecting-ip"]?.toString().trim() ||
      req.headers["x-real-ip"]?.toString().trim() ||
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    ).replace(/^.*:/, "");
    const clientIp = rawIp === "1" ? "127.0.0.1" : rawIp;
    const token = (req.query.token as string) || (req.query.workstationToken as string) || undefined;
    const computerName = (req.query.computerName as string) || undefined;
    const list = YaziciService.getClientPrinters({
      token,
      clientIp,
      computerName,
      userId: (req.user as any)?.userId || (req.user as any)?.id,
    });
    return ApiResponse.ok(res, "İstemci yazıcıları listelendi.", list);
  });

  /**
   * GET /api/v1/yazici/print-jobs
   * İstemci bilgisayarındaki yerel ajan için bekleyen yazdırma işlerini döndürür.
   */
  public static getPendingPrintJobs = asyncHandler(async (req: Request, res: Response) => {
    const rawIp = (
      req.headers["cf-connecting-ip"]?.toString().trim() ||
      req.headers["x-real-ip"]?.toString().trim() ||
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    ).replace(/^.*:/, "");
    const token = (req.query.token as string) || (req.query.workstationToken as string) || undefined;
    const computerName = (req.query.computerName as string) || undefined;
    const jobs = YaziciService.getPendingPrintJobs({
      token,
      computerName,
      clientIp: rawIp,
    });
    return ApiResponse.ok(res, "Bekleyen işler listelendi.", jobs);
  });

  /**
   * POST /api/v1/yazici/print-jobs/:id/complete
   */
  public static completePrintJob = asyncHandler(async (req: Request, res: Response) => {
    const ok = YaziciService.completePrintJob(req.params.id);
    return ApiResponse.ok(res, "İş tamamlandı.", { success: ok });
  });

  /**
   * GET /api/v1/yazici/agent-script
   * Windows PowerShell için doğrudan bellekten çalıştırılabilir yerel yazdırma köprüsü scriptini döndürür.
   */
  public static getAgentScript = (req: Request, res: Response) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
    const serverBase = `${protocol}://${host}`;

    const script = `
$port = 5050
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try { $listener.Prefixes.Add("http://localhost:$port/") } catch {}

try {
    $listener.Start()
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  LIKYA KUYUMCU ERP - YEREL SESSIZ YAZDIRMA SERVISI" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Port       : http://127.0.0.1:$port/" -ForegroundColor Green
    Write-Host "  Bilgisayar : $env:COMPUTERNAME ($env:USERNAME)" -ForegroundColor Green
    Write-Host "  Durum      : AKTIF VE DINLENIYOR" -ForegroundColor Green
    Write-Host "  Web Sitesi : likyakuyum.com / likyaerp.com baglantisi hazir" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Bu pencere acik kaldigi surece web sitesinden gonderilen" -ForegroundColor Gray
    Write-Host "tum fisler bu bilgisayardaki yazicilara sessiz iletilir." -ForegroundColor Gray
} catch {
    Write-Host "[HATA] Port dinlenemedi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

function Get-LocalPrintersData {
    try {
        $rawPrinters = Get-CimInstance Win32_Printer | Select-Object Name, DeviceID, Default, Local, Network, WorkOffline, PortName
        $printerList = @()
        foreach ($p in $rawPrinters) {
            $pName = if ($p.Name) { $p.Name } else { $p.DeviceID }
            $isNet = [bool]$p.Network -or ($p.PortName -match '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}') -or ($p.PortName -like '*WSD*') -or ($p.PortName -like '*TCP*') -or ($pName -like '\\\\*')
            $isUsb = ($p.PortName -like '*USB*') -or ($p.PortName -like '*DOT4*')
            $printerList += @{
                name = $pName
                isDefault = [bool]$p.Default
                isOnline = -not [bool]$p.WorkOffline
                isLocal = [bool]$p.Local
                isNetwork = [bool]$isNet
                isUsb = [bool]$isUsb
                portName = $p.PortName
            }
        }
        return @{
            success = $true
            computerName = $env:COMPUTERNAME
            userName = $env:USERNAME
            count = $printerList.Count
            printers = $printerList
        }
    } catch {
        return @{ success = $false; printers = @() }
    }
}

function Sync-PrintersToCloud {
    try {
        $pData = Get-LocalPrintersData
        $regBody = $pData | ConvertTo-Json -Depth 3 -Compress
        $serverEndpoints = @(
            "${serverBase}/api/v1/yazici/register-client-printers",
            "https://www.likyaerp.com/api/v1/yazici/register-client-printers",
            "https://likyaerp.com/api/v1/yazici/register-client-printers",
            "https://likyakuyum.com/api/v1/yazici/register-client-printers",
            "https://www.likyakuyum.com/api/v1/yazici/register-client-printers",
            "http://localhost:5000/api/v1/yazici/register-client-printers",
            "http://127.0.0.1:5000/api/v1/yazici/register-client-printers"
        )
        $uniqueEndpoints = $serverEndpoints | Where-Object { $_ -match '^https?://' } | Select-Object -Unique
        foreach ($sep in $uniqueEndpoints) {
            try {
                Invoke-RestMethod -Uri $sep -Method Post -Body $regBody -ContentType "application/json; charset=utf-8" -TimeoutSec 3 | Out-Null
                Write-Host "  [BULUT] Bu bilgisayarin $($pData.count) yazicisi senkronize edildi -> $sep" -ForegroundColor Green
            } catch {}
        }
    } catch {}
}

function Print-JobItem ($printObj) {
    try {
        $printerName = $printObj.targetDevice
        if (-not $printerName) { $printerName = $printObj.printerName }
        $text = $printObj.text
        if (-not $text) { $text = $printObj.textContent }
        $html = $printObj.html
        if (-not $html) { $html = $printObj.htmlContent }
        $isPos = [bool]$printObj.isPos

        if ($text -and $isPos) {
            $rndFile = Join-Path $tmpDir ("print_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ".txt")
            [System.IO.File]::WriteAllText($rndFile, $text, [System.Text.Encoding]::UTF8)
            if ($printerName) {
                Get-Content -Path $rndFile -Raw | Out-Printer -Name $printerName
            } else {
                Get-Content -Path $rndFile -Raw | Out-Printer
            }
            Start-Sleep -Milliseconds 400
            Remove-Item $rndFile -Force -ErrorAction SilentlyContinue
            return $true
        } elseif ($html) {
            $rndFile = Join-Path $tmpDir ("print_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ".html")
            [System.IO.File]::WriteAllText($rndFile, $html, [System.Text.Encoding]::UTF8)

            $p1 = [System.Environment]::GetFolderPath('ProgramFilesX86') + "\\Microsoft\\Edge\\Application\\msedge.exe"
            $p2 = [System.Environment]::GetFolderPath('ProgramFiles') + "\\Microsoft\\Edge\\Application\\msedge.exe"
            $p3 = [System.Environment]::GetFolderPath('LocalApplicationData') + "\\Microsoft\\Edge\\Application\\msedge.exe"
            $p4 = [System.Environment]::GetFolderPath('ProgramFilesX86') + "\\Google\\Chrome\\Application\\chrome.exe"
            $p5 = [System.Environment]::GetFolderPath('ProgramFiles') + "\\Google\\Chrome\\Application\\chrome.exe"
            $browserPaths = @($p1, $p2, $p3, $p4, $p5)
            $browserExe = $browserPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

            if ($browserExe) {
                $pArgs = @("--headless=new", "--disable-gpu", "--no-pdf-header-footer")
                if ($printerName) {
                    $pArgs += ('--print-to-printer="' + $printerName + '"')
                } else {
                    $pArgs += "--print-to-printer"
                }
                $pArgs += ('"' + $rndFile + '"')
                $proc = Start-Process -FilePath $browserExe -ArgumentList $pArgs -PassThru -WindowStyle Hidden
                $proc.WaitForExit(10000)
            } else {
                if ($printerName) {
                    Start-Process -FilePath $rndFile -Verb PrintTo -ArgumentList ('"' + $printerName + '"') -WindowStyle Hidden
                } else {
                    Start-Process -FilePath $rndFile -Verb Print -WindowStyle Hidden
                }
            }
            Start-Sleep -Milliseconds 500
            Remove-Item $rndFile -Force -ErrorAction SilentlyContinue
            return $true
        }
    } catch {
        Write-Host "Yazdirma hatasi: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    return $false
}

function Poll-CloudPrintJobs {
    $pollEndpoints = @(
        "${serverBase}/api/v1/yazici",
        "https://www.likyaerp.com/api/v1/yazici",
        "https://likyaerp.com/api/v1/yazici",
        "https://likyakuyum.com/api/v1/yazici"
    )
    foreach ($pe in $pollEndpoints) {
        try {
            $pollUrl = "$pe/print-jobs?computerName=$env:COMPUTERNAME"
            $resp = Invoke-RestMethod -Uri $pollUrl -Method Get -TimeoutSec 2
            $jobs = $resp.data
            if ($jobs -and $jobs.Count -gt 0) {
                foreach ($j in $jobs) {
                    Write-Host "  [BULUT IS ALINDI] $($j.targetDevice) yazdiriliyor..." -ForegroundColor Yellow
                    $ok = Print-JobItem $j
                    try {
                        Invoke-RestMethod -Uri "$pe/print-jobs/$($j.id)/complete" -Method Post -TimeoutSec 2 | Out-Null
                    } catch {}
                }
            }
        } catch {}
    }
}

Sync-PrintersToCloud

$tmpDir = Join-Path $env:TEMP "likya-print-temp"
if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null }

$asyncResult = $listener.BeginGetContext($null, $null)
$lastSync = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$lastJobCheck = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

while ($listener.IsListening) {
    try {
        if ($asyncResult.AsyncWaitHandle.WaitOne(800)) {
            $context = $listener.EndGetContext($asyncResult)
            $asyncResult = $listener.BeginGetContext($null, $null)

            $req = $context.Request
            $res = $context.Response

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
                $pData = Get-LocalPrintersData
                $json = $pData | ConvertTo-Json -Depth 3 -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType = "application/json; charset=utf-8"
                $res.ContentLength64 = $buffer.Length
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
                continue
            }

            if ($path -eq "/print" -and $req.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
                $body = $reader.ReadToEnd()
                $reader.Close()
                $printObj = $body | ConvertFrom-Json
                Print-JobItem $printObj

                $ret = '{"success":true,"message":"Yazdirma komutu Windows yazicisina iletildi."}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($ret)
                $res.ContentType = "application/json; charset=utf-8"
                $res.ContentLength64 = $buffer.Length
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
                continue
            }

            $statusJson = '{"success":true,"service":"Likya Kuyumcu Yerel Sessiz Yazici Servisi","status":"online","port":5050}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($statusJson)
            $res.ContentType = "application/json; charset=utf-8"
            $res.ContentLength64 = $buffer.Length
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
        }

        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        if ($now - $lastSync -gt 15) {
            $lastSync = $now
            Sync-PrintersToCloud
        }

        if ($now - $lastJobCheck -gt 1) {
            $lastJobCheck = $now
            Poll-CloudPrintJobs
        }
    } catch {
        Start-Sleep -Milliseconds 100
    }
}
`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(script);
  };

  /**
   * GET /api/v1/yazici/system-printers
   * Bilgisayarda kurulu aktif yazıcıları listeler (Denetim Masası / Aygıtlar ve Yazıcılar)
   */
  public static getSystemPrinters = asyncHandler(async (_req: Request, res: Response) => {
    const list = await YaziciService.getSystemPrinters();
    return ApiResponse.ok(res, "Sistem yazıcıları başarıyla listelendi.", list);
  });

  /**
   * GET /api/v1/yazici
   */
  public static listYazicilar = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const yazicilar = await YaziciService.listYazicilar(dbContext);
    return ApiResponse.ok(res, "Yazıcılar başarıyla listelendi.", yazicilar);
  });

  /**
   * GET /api/v1/yazici/:id
   */
  public static getYaziciById = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const yazici = await YaziciService.getYaziciById(req.params.id, dbContext);
    return ApiResponse.ok(res, "Yazıcı detayları getirildi.", yazici);
  });

  /**
   * POST /api/v1/yazici
   */
  public static createYazici = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const created = await YaziciService.createYazici(req.body, dbContext);
    return ApiResponse.created(res, "Yazıcı tanımı başarıyla oluşturuldu.", created);
  });

  /**
   * PUT /api/v1/yazici/:id
   */
  public static updateYazici = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const updated = await YaziciService.updateYazici(req.params.id, req.body, dbContext);
    return ApiResponse.ok(res, "Yazıcı bilgileri başarıyla güncellendi.", updated);
  });

  /**
   * GET /api/v1/yazici/usage/:id
   */
  public static getYaziciUsage = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const usage = await YaziciService.getYaziciUsage(req.params.id, dbContext);
    return ApiResponse.ok(res, "Yazıcı kullanım durumu getirildi.", usage);
  });

  /**
   * DELETE /api/v1/yazici/:id
   */
  public static deleteYazici = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const isForce = req.query.force === "true";
    await YaziciService.deleteYazici(req.params.id, { force: isForce }, dbContext);
    return ApiResponse.ok(res, "Yazıcı tanımı başarıyla silindi.", { id: req.params.id });
  });

  /**
   * POST /api/v1/yazici/direct-print
   */
  public static directPrint = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = YaziciController.getDbContext(req);
    const rawIp = (
      req.headers["cf-connecting-ip"]?.toString().trim() ||
      req.headers["x-real-ip"]?.toString().trim() ||
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    ).replace(/^.*:/, "");
    const clientIp = rawIp === "1" ? "127.0.0.1" : rawIp;
    const result = await YaziciService.directPrint({ ...req.body, clientIp }, dbContext);
    return ApiResponse.ok(res, result.message, result);
  });

  /**
   * GET /api/v1/yazici/download-agent
   * Her iki siteden de (likyakuyum.com ve likyaerp.com) güncel PrinterAgent.exe dosyasını indirir.
   */
  public static downloadAgent = asyncHandler(async (_req: Request, res: Response) => {
    const candidatePaths = [
      path.resolve(process.cwd(), "../public/PrinterAgent.exe"),
      path.resolve(process.cwd(), "../public-erp/PrinterAgent.exe"),
      path.resolve(process.cwd(), "public/PrinterAgent.exe"),
      path.resolve(process.cwd(), "../printercekmeApp/dist/PrinterAgent.exe"),
      path.resolve(process.cwd(), "../dist/PrinterAgent.exe"),
      path.resolve(process.cwd(), "../dist-erp/PrinterAgent.exe"),
      path.resolve(process.cwd(), "uploads/PrinterAgent.exe"),
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      return res.status(404).json({ success: false, message: "PrinterAgent.exe bulunamadı." });
    }

    res.setHeader("Content-Disposition", 'attachment; filename="PrinterAgent.exe"');
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(foundPath);
  });
}
