/**
 * Likya ERP - Kasaya bağlı terazi okuma (docs/TICARI_ADISYON_YOL_HARITASI.md, TA4).
 *
 * Tarayıcının Web Serial özelliği olmadığında (Chrome/Edge dışı) yazdırma ajanı seri porttan (COM) terazinin ham yanıtını
 * okur. Native modül yok: Windows PowerShell'in .NET System.IO.Ports.SerialPort sınıfı kullanılır. Yanıtın çözümü
 * (kilo, kararlılık) tarayıcıda yapılır (Backend/src/services/ticari/teraziProtokol.ts) — ajan yalnız ham metni döner.
 *
 * Parametreler katı denetlenir (PowerShell betiğine yalnız doğrulanmış değerler girer).
 */
"use strict";

const BAUDLAR = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
const PARITELER = { none: "None", even: "Even", odd: "Odd" };
const DUR_BITLERI = { 1: "One", 2: "Two" };

/** İstek parametrelerini doğrular; hata varsa { hata } döner */
function teraziParametreleri(q) {
  const port = String(q.port || "").trim().toUpperCase();
  if (!/^COM\d{1,3}$/.test(port)) return { hata: "Port COM1, COM3 gibi olmalı." };
  const baud = Number(q.baud || 9600);
  if (!BAUDLAR.includes(baud)) return { hata: "Baud hızı geçersiz." };
  const veriBit = Number(q.veriBit || 8);
  if (veriBit !== 7 && veriBit !== 8) return { hata: "Veri biti 7 ya da 8 olmalı." };
  const parite = PARITELER[String(q.parite || "none").toLowerCase()];
  if (!parite) return { hata: "Parite none, even ya da odd olmalı." };
  const durBit = DUR_BITLERI[String(q.durBit || "1")];
  if (!durBit) return { hata: "Dur biti 1 ya da 2 olmalı." };
  // Gönderilecek istek baytları onaltılık (ör. "570D" = "W\r"); boş = terazi kendisi gönderiyor (sürekli mod)
  const istekHex = String(q.istek || "").trim().toUpperCase();
  if (!/^([0-9A-F]{2}){0,8}$/.test(istekHex)) return { hata: "İstek onaltılık bayt dizisi olmalı (ör. 570D)." };
  const zaman = Math.min(5000, Math.max(300, Number(q.zamanAsimi || 1500) || 1500));
  return { port, baud, veriBit, parite, durBit, istekHex, zaman };
}

/** Seri porttan ham yanıtı okuyan PowerShell betiği (yalnız doğrulanmış parametrelerle) */
function teraziBetigi(p) {
  const istekBaytlari = p.istekHex ? (p.istekHex.match(/../g) || []).map((h) => `0x${h}`).join(",") : "";
  return `
$ErrorActionPreference = 'Stop'
$p = New-Object System.IO.Ports.SerialPort '${p.port}', ${p.baud}, ([System.IO.Ports.Parity]::${p.parite}), ${p.veriBit}, ([System.IO.Ports.StopBits]::${p.durBit})
$p.ReadTimeout = 500
$p.WriteTimeout = 1000
try {
  $p.Open()
  $p.DiscardInBuffer()
  ${istekBaytlari ? `[byte[]]$istek = @(${istekBaytlari}); $p.Write($istek, 0, $istek.Length)` : ""}
  $sb = ''
  $son = (Get-Date).AddMilliseconds(${p.zaman})
  while ((Get-Date) -lt $son) {
    $sb += $p.ReadExisting()
    if ($sb -match '\\d' -and $sb -match "[\\r\\n\\x03]") { break }
    Start-Sleep -Milliseconds 40
  }
  [Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::GetEncoding(28591).GetBytes($sb)))
} catch {
  [Console]::Error.Write($_.Exception.Message)
  exit 1
} finally {
  if ($p.IsOpen) { $p.Close() }
}
`;
}

/**
 * Terazi okuma: { success, ham } ya da { success: false, message }.
 * runPowerShell: index.js'teki gizli PowerShell çalıştırıcı (script, zamanAşımıMs) → { stdout, stderr, code }
 */
async function teraziOku(runPowerShell, sorgu) {
  const p = teraziParametreleri(sorgu || {});
  if (p.hata) return { success: false, message: p.hata };
  const r = await runPowerShell(teraziBetigi(p), p.zaman + 6000);
  if (r.code !== 0) return { success: false, message: (r.stderr || "Terazi okunamadı.").replace(/\s+/g, " ").trim() };
  const ham = Buffer.from(String(r.stdout || "").trim(), "base64").toString("latin1");
  if (!ham) return { success: false, message: "Teraziden yanıt gelmedi (kablo, port ve ayarları denetleyin)." };
  return { success: true, ham };
}

module.exports = { teraziOku, teraziParametreleri, teraziBetigi };
