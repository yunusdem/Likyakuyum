// A4 (POS olmayan) HTML baskısı: Edge/Chrome ile sayfa görüntüsü üretilir, GDI ile A4 kâğıda birebir basılır.
// Önceden A4 işlerde HTML çizilmiyor, yalnız metni (Consolas) basılıyordu; tasarım ve kenar boşlukları kayboluyordu.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// A4 = 210 x 297 mm; CSS 96 dpi'da 793.7 x 1122.5 px. 2x ölçekle ~192 dpi görüntü (lazer çıktısı için yeterli keskinlik).
const A4_GEN_PX = 794;
const A4_YUK_PX = 1123;
const OLCEK = 2;
const EN_COK_SAYFA = 5;

const ORTAK_ARGS = [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--allow-file-access-from-files",
  "--hide-scrollbars",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  "--run-all-compositor-stages-before-draw",
];

function calistir(exe, args, sureMs) {
  return new Promise((resolve) => {
    let bitti = false;
    const child = spawn(exe, args, { windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(() => {
      if (bitti) return;
      bitti = true;
      try { child.kill(); } catch {}
      resolve(false);
    }, sureMs);
    child.on("close", () => { if (bitti) return; bitti = true; clearTimeout(timer); resolve(true); });
    child.on("error", () => { if (bitti) return; bitti = true; clearTimeout(timer); resolve(false); });
  });
}

/** PDF içindeki sayfa nesnelerini sayar (yalnız Chromium'un ürettiği basit PDF için) */
function pdfSayfaSayisi(pdfDosya) {
  try {
    const veri = fs.readFileSync(pdfDosya).toString("latin1");
    const n = (veri.match(/\/Type\s*\/Page[^s]/g) || []).length;
    return n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/**
 * HTML dosyasını A4 sayfa görüntüsüne (PNG, sayfalar alt alta) çevirir.
 * Sayfa sayısı önce tarayıcının kendi yazdırma motoruyla (print-to-pdf, @page kurallarına uyar) bulunur.
 * @returns {Promise<{ png: string, sayfa: number } | null>}
 */
async function a4PngUret(chromiumPath, htmlFile, pngFile) {
  if (!chromiumPath || !htmlFile || !fs.existsSync(htmlFile)) return null;
  const fileUrl = "file:///" + path.resolve(htmlFile).replace(/\\/g, "/");

  let sayfa = 1;
  const pdfFile = pngFile.replace(/\.png$/i, "") + "_sayfa.pdf";
  try {
    await calistir(chromiumPath, [...ORTAK_ARGS, "--no-pdf-header-footer", `--print-to-pdf=${pdfFile}`, fileUrl], 15000);
    if (fs.existsSync(pdfFile)) sayfa = Math.min(EN_COK_SAYFA, pdfSayfaSayisi(pdfFile));
  } catch {}
  try { if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile); } catch {}

  try { if (fs.existsSync(pngFile)) fs.unlinkSync(pngFile); } catch {}
  await calistir(
    chromiumPath,
    [
      ...ORTAK_ARGS,
      `--window-size=${A4_GEN_PX},${A4_YUK_PX * sayfa}`,
      `--force-device-scale-factor=${OLCEK}`,
      "--virtual-time-budget=1500",
      `--screenshot=${pngFile}`,
      fileUrl,
    ],
    15000
  );
  if (!fs.existsSync(pngFile) || fs.statSync(pngFile).size < 1000) return null;
  return { png: pngFile, sayfa };
}

/**
 * $pngPath'teki alt alta A4 sayfa görüntüsünü $a4Sayfa sayfa olarak basan PowerShell parçası.
 * $doc (PrintDocument) hazır olmalı. Görüntü kâğıdın fiziksel köşesine oturtulur: OriginAtMargins=false iken
 * Graphics başlangıcı yazdırılabilir alanın köşesidir, bu yüzden donanım kenar boşluğu (HardMargin) kadar geri kaydırılır.
 * Kenar boşlukları (ör. üstten 2 cm) HTML'in kendisinde olduğundan çıktı ekrandakiyle birebir aynı kalır.
 */
function a4GdiParcasi() {
  return `
      $a4Kagit = $null
      foreach ($ps in $doc.PrinterSettings.PaperSizes) { if ($ps.Kind -eq [System.Drawing.Printing.PaperKind]::A4) { $a4Kagit = $ps; break } }
      if ($a4Kagit) { $doc.DefaultPageSettings.PaperSize = $a4Kagit }
      $doc.DefaultPageSettings.Landscape = $false
      $script:pngImg = [System.Drawing.Image]::FromFile($pngPath)
      $script:a4Idx = 0
      $doc.add_PrintPage({
        param($s, $ev)
        $g = $ev.Graphics
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $img = $script:pngImg
        $dilim = [int][Math]::Floor($img.Height / [Math]::Max(1, $script:a4Sayfa))
        $kaynak = New-Object System.Drawing.Rectangle(0, ($script:a4Idx * $dilim), $img.Width, $dilim)
        $hx = [float]$ev.PageSettings.HardMarginX
        $hy = [float]$ev.PageSettings.HardMarginY
        $hedef = New-Object System.Drawing.RectangleF((0 - $hx), (0 - $hy), [float]$ev.PageBounds.Width, [float]$ev.PageBounds.Height)
        $g.DrawImage($img, $hedef, $kaynak, [System.Drawing.GraphicsUnit]::Pixel)
        $script:a4Idx++
        $ev.HasMorePages = ($script:a4Idx -lt $script:a4Sayfa)
      })
      for ($c = 0; $c -lt $copies; $c++) {
        $script:a4Idx = 0
        $doc.Print()
      }
      $script:pngImg.Dispose()
      $doc.Dispose()
      $spooledSuccess = $true`;
}

module.exports = { a4PngUret, a4GdiParcasi, A4_GEN_PX, A4_YUK_PX, OLCEK };
