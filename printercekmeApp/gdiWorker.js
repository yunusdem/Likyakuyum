// Sürekli açık (persistent) Windows PowerShell GDI Yazdırma İşçisi.
// Her fişte sıfırdan powershell.exe + .NET CLR başlatmak (~1-2 sn) yerine tek bir süreci
// arka planda sıcak tutar; stdin üzerinden iş alır ve ~20-60 ms içinde yazıcı kuyruğuna iletir.
// Fiş GDI çizim matematiği (80mm ve A4) önceki sürümlerle piksel piksel birebir aynıdır.
const os = require("os");
const { spawn } = require("child_process");
const { a4GdiParcasi } = require("./a4Baski");

function buildWorkerPsScript() {
  return `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function Clean-PName($str) {
  if (-not $str) { return "" }
  $s = $str -replace '\\s*\\([0-9]+\\s*yönlendirildi\\)', ''
  $s = $s -replace '\\s*\\(yönlendirildi\\s*[0-9]+\\)', ''
  $s = $s -replace '\\s*\\([^\\)]*redirected[^\\)]*\\)', ''
  $s = $s -replace '\\s*\\([^\\)]*session[^\\)]*\\)', ''
  $s = $s -replace '[^a-zA-Z0-9]', ''
  return $s.ToLower().Trim()
}

function Test-IsVirtual($str) {
  if (-not $str) { return $true }
  $low = $str.ToLower()
  $virts = @("onenote", "pdf", "xps", "fax", "document writer", "root print queue", "anydesk", "teamviewer")
  foreach ($v in $virts) {
    if ($low.IndexOf($v) -ge 0) { return $true }
  }
  return $false
}

function Test-IsPos($str) {
  if (-not $str) { return $false }
  if (Test-IsVirtual $str) { return $false }
  $low = $str.ToLower()
  $posKeys = @("pos", "thermal", "termal", "receipt", "fis", "fiş", "80", "58", "xp-", "xprinter", "epson", "bixolon", "hprt", "rp80", "rp-80", "citizen", "star", "sam4s", "zj-", "argox", "zebra", "tsc", "godex", "kuveyt", "hugin", "inter")
  foreach ($k in $posKeys) {
    if ($low.IndexOf($k) -ge 0) { return $true }
  }
  return $false
}

function Resolve-TargetPrinter($rawTarget, $isPos) {
  $exactPrinter = $null
  if ($rawTarget -and $rawTarget.Trim() -ne '') {
    try {
      $quickDoc = New-Object System.Drawing.Printing.PrintDocument
      $quickDoc.PrinterSettings.PrinterName = $rawTarget
      if ($quickDoc.PrinterSettings.IsValid) {
        $exactPrinter = $rawTarget
      }
      $quickDoc.Dispose()
    } catch {}
  }

  if (-not $exactPrinter) {
    $installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters

    if ($rawTarget -and $rawTarget.Trim() -ne '') {
      foreach ($p in $installed) {
        if ($p.Equals($rawTarget, [System.StringComparison]::OrdinalIgnoreCase)) {
          $exactPrinter = $p; break
        }
      }
      if (-not $exactPrinter) {
        foreach ($p in $installed) {
          if (-not (Test-IsVirtual $p)) {
            if ($p.IndexOf($rawTarget, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $rawTarget.IndexOf($p, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
              $exactPrinter = $p; break
            }
          }
        }
      }
      if (-not $exactPrinter) {
        $cleanRaw = Clean-PName $rawTarget
        if ($cleanRaw.Length -ge 3) {
          foreach ($p in $installed) {
            if (-not (Test-IsVirtual $p)) {
              $cleanP = Clean-PName $p
              if ($cleanP -eq $cleanRaw -or $cleanP.IndexOf($cleanRaw) -ge 0 -or $cleanRaw.IndexOf($cleanP) -ge 0) {
                $exactPrinter = $p; break
              }
            }
          }
        }
      }
    }

    if ((-not $exactPrinter -or (Test-IsVirtual $exactPrinter)) -and $isPos) {
      foreach ($p in $installed) {
        if (Test-IsPos $p) { $exactPrinter = $p; break }
      }
    }

    if (-not $exactPrinter) {
      foreach ($p in $installed) {
        if (-not (Test-IsVirtual $p)) { $exactPrinter = $p; break }
      }
    }

    if (-not $exactPrinter -or (Test-IsVirtual $exactPrinter)) {
      $allPrintersStr = ($installed -join ', ')
      throw "Hedef yazıcı ('$rawTarget') bu bilgisayarda bulunamadı ve fiziksel yazıcı algılanamadı. Sistemdeki yazıcılar: [$allPrintersStr]"
    }
  }
  return $exactPrinter
}

function Send-Reply($id, $ok, $printer, $msg) {
  $obj = @{ id = $id; success = $ok; printerName = $printer; message = $msg }
  $json = $obj | ConvertTo-Json -Compress
  $b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
  [Console]::Out.WriteLine("LIKYA_RES:$b64")
  [Console]::Out.Flush()
}

[Console]::Out.WriteLine("LIKYA_READY")
[Console]::Out.Flush()

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $trimmed = $line.Trim()
  if ($trimmed -eq '') { continue }
  if ($trimmed -eq 'EXIT') { break }

  $jobId = ""
  try {
    $rawJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($trimmed))
    $job = $rawJson | ConvertFrom-Json
    $jobId = [string]$job.id
    $rawTarget = [string]$job.target
    $pngPath = [string]$job.pngPath
    $textPath = [string]$job.textPath
    $copies = [Math]::Max(1, [int]$job.copies)
    $isPos = [bool]$job.isPos
    $script:a4Sayfa = [int]$job.a4Sayfa

    $exactPrinter = Resolve-TargetPrinter $rawTarget $isPos
    $spooledSuccess = $false

    try {
      $doc = New-Object System.Drawing.Printing.PrintDocument
      $doc.PrinterSettings.PrinterName = $exactPrinter
      if ($doc.PrinterSettings.IsValid) {
        $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
        $doc.OriginAtMargins = $false
        $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

        if ($pngPath -and (Test-Path $pngPath) -and (-not $isPos) -and ($script:a4Sayfa -gt 0)) {
${a4GdiParcasi()}
        } elseif ($pngPath -and (Test-Path $pngPath)) {
          $script:pngImg = [System.Drawing.Image]::FromFile($pngPath)
          $doc.add_PrintPage({
            param($s, $ev)
            $g = $ev.Graphics
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

            $leftOffset = 8.0
            $availW = [float]$ev.PageBounds.Width
            if ($availW -le 50 -or $availW -gt 320) { $availW = 283.0 }
            $targetW = [float]($availW - $leftOffset)
            $scale = $targetW / [float]$script:pngImg.Width
            $targetH = [float]($script:pngImg.Height * $scale)

            $destRect = New-Object System.Drawing.RectangleF($leftOffset, 2.0, $targetW, $targetH)
            $srcRect = New-Object System.Drawing.RectangleF(0.0, 0.0, [float]$script:pngImg.Width, [float]$script:pngImg.Height)

            $g.DrawImage($script:pngImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
            $ev.HasMorePages = $false
          })
          for ($c = 0; $c -lt $copies; $c++) {
            $doc.Print()
          }
          $script:pngImg.Dispose()
          $doc.Dispose()
          $spooledSuccess = $true
        } elseif ($textPath -and (Test-Path $textPath)) {
          $script:lines = [System.IO.File]::ReadAllLines($textPath, [System.Text.Encoding]::UTF8)
          if ($script:lines.Count -gt 0) {
            $script:font = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Bold)
            $script:brush = [System.Drawing.Brushes]::Black
            $script:lineIdx = 0
            $doc.add_PrintPage({
              param($sender, $ev)
              $g = $ev.Graphics
              $lineHeight = $script:font.GetHeight($g) + 1.2
              $y = 8.0
              $x = 14.0
              while ($script:lineIdx -lt $script:lines.Count) {
                $curLine = $script:lines[$script:lineIdx]
                if ($curLine -ne $null) {
                  $g.DrawString($curLine, $script:font, $script:brush, $x, $y)
                }
                $y += $lineHeight
                $script:lineIdx++
              }
              $ev.HasMorePages = $false
            })
            for ($c = 0; $c -lt $copies; $c++) {
              $script:lineIdx = 0
              $doc.Print()
            }
            $doc.Dispose()
            $script:font.Dispose()
            $spooledSuccess = $true
          }
        }
      }
    } catch {
      try { if ($script:pngImg) { $script:pngImg.Dispose(); $script:pngImg = $null } } catch {}
      try { if ($doc) { $doc.Dispose() } } catch {}
    }

    if (-not $spooledSuccess -and $textPath -and (Test-Path $textPath)) {
      try {
        Get-Content -Raw -Encoding UTF8 $textPath | Out-Printer -Name $exactPrinter
        $spooledSuccess = $true
      } catch {}
    }

    if ($spooledSuccess) {
      Send-Reply $jobId $true $exactPrinter "SUCCESS"
    } else {
      Send-Reply $jobId $false $exactPrinter "Yazıcıya yazdırma komutu gönderilemedi."
    }
  } catch {
    Send-Reply $jobId $false "" $_.Exception.Message
  }
}
`;
}

class PersistentGdiWorker {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.startingPromise = null;
    this.pending = new Map();
    this.stdoutBuf = "";
    this.jobSeq = 1;
    this.shuttingDown = false;
  }

  isAlive() {
    return Boolean(this.proc && !this.proc.killed && this.proc.exitCode === null && this.ready);
  }

  _rejectAll(reason) {
    for (const [, p] of this.pending.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  shutdown() {
    this.shuttingDown = true;
    this.ready = false;
    this._rejectAll("GDI işçisi kapatıldı");
    if (this.proc) {
      try { this.proc.stdin.write("EXIT\n"); } catch {}
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }
  }

  ensureStarted() {
    if (os.platform() !== "win32" || this.shuttingDown) return Promise.resolve(false);
    if (this.isAlive()) return Promise.resolve(true);
    if (this.startingPromise) return this.startingPromise;

    this.startingPromise = new Promise((resolve) => {
      let resolved = false;
      const done = (ok) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(startTimer);
          this.startingPromise = null;
          resolve(ok);
        }
      };

      const systemRoot = process.env.SystemRoot || "C:\\Windows";
      const psPath = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const script = buildWorkerPsScript();
      const b64 = Buffer.from(script, "utf16le").toString("base64");

      const proc = spawn(
        psPath,
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-STA", "-WindowStyle", "Hidden", "-EncodedCommand", b64],
        {
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      this.proc = proc;
      this.ready = false;
      this.stdoutBuf = "";

      const startTimer = setTimeout(() => {
        if (!this.ready) {
          try { proc.kill(); } catch {}
          done(false);
        }
      }, 10000);

      proc.stdout.on("data", (chunk) => {
        this.stdoutBuf += chunk.toString("utf8");
        let nl;
        while ((nl = this.stdoutBuf.indexOf("\n")) !== -1) {
          const line = this.stdoutBuf.slice(0, nl).trim();
          this.stdoutBuf = this.stdoutBuf.slice(nl + 1);
          if (!line) continue;

          if (line === "LIKYA_READY") {
            this.ready = true;
            console.log("[gdiWorker] Kalıcı PowerShell GDI işçisi hazır.");
            done(true);
            continue;
          }

          if (line.startsWith("LIKYA_RES:")) {
            try {
              const b64Payload = line.slice("LIKYA_RES:".length).trim();
              const parsed = JSON.parse(Buffer.from(b64Payload, "base64").toString("utf8"));
              const id = String(parsed.id || "");
              if (id && this.pending.has(id)) {
                const p = this.pending.get(id);
                this.pending.delete(id);
                clearTimeout(p.timer);
                p.resolve(parsed);
              }
            } catch {}
          }
        }
      });

      proc.on("close", () => {
        if (this.proc === proc) {
          this.proc = null;
          this.ready = false;
        }
        this._rejectAll("GDI işçisi beklenmedik şekilde kapandı");
        done(false);
      });

      proc.on("error", () => {
        if (this.proc === proc) {
          this.proc = null;
          this.ready = false;
        }
        done(false);
      });
    });

    return this.startingPromise;
  }

  async print({ target, pngPath, textPath, copies = 1, isPos = true, a4Sayfa = 0, timeoutMs = 12000 }) {
    const ok = await this.ensureStarted();
    if (!ok || !this.isAlive()) {
      throw new Error("GDI işçisi başlatılamadı");
    }

    const id = `gdi_${Date.now()}_${this.jobSeq++}`;
    const payload = {
      id,
      target: target || "",
      pngPath: pngPath || "",
      textPath: textPath || "",
      copies: Math.max(1, Number(copies) || 1),
      isPos: Boolean(isPos),
      a4Sayfa: Number(a4Sayfa) || 0,
    };
    const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Zaman aşımı olduysa işçiyi sıfırla ki sonraki işler takılmasın
        try { if (this.proc) this.proc.kill(); } catch {}
        this.proc = null;
        this.ready = false;
        reject(new Error("GDI işçisi zaman aşımına uğradı"));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.proc.stdin.write(b64 + "\n");
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }
}

module.exports = new PersistentGdiWorker();
