import { SarrafFisiPrintModalProps } from "../pages/vezne/SarrafFisiPrintModal";
import { PerakendeFaturaModel } from "../services/perakendeService";
import { DovizFisiPrintModalProps } from "../pages/vezne/DovizFisiPrintModal";
import { RaporKolon, RaporTanim, RaporVeri, raporBicimle } from "../services/raporService";

/**
 * Telefon numarasını WhatsApp formatına temizler (boşlukları, parantezleri, vb. kaldırır, 90 ile başlatır)
 */
export function cleanPhoneNumber(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";

  // 05xx -> 905xx
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "9" + digits;
  } else if (digits.length === 10 && digits.startsWith("5")) {
    digits = "90" + digits;
  }
  return digits;
}

/**
 * WhatsApp'a doğrudan yönlendirir (ara modal olmadan).
 * WhatsApp Web / Desktop açılır, kullanıcı sohbetinde kişi veya grubu seçip mesajı doğrudan gönderir.
 */
/**
 * WhatsApp'a doğrudan yönlendirir.
 * - Mobilde (Android / iOS): WhatsApp uygulamasını (whatsapp://send) doğrudan açar.
 * - Masaüstünde (Mac / Windows): Kurulu ise WhatsApp Desktop uygulamasını (whatsapp://send) tetikler ve WhatsApp Web'i açar.
 * Kullanıcı doğrudan kişi listesinden dilediği müşteriyi/grubu seçebilir.
 */
export function openWhatsAppDirect(message?: string, rawPhone?: string | null) {
  const phone = cleanPhoneNumber(rawPhone);
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  const textParam = message ? `text=${encodeURIComponent(message)}` : "";

  if (phone) {
    if (isMobile) {
      const url = `https://api.whatsapp.com/send?phone=${phone}${textParam ? `&${textParam}` : ""}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      // Masaüstünde telefon varsa
      try {
        const a = document.createElement("a");
        a.href = `whatsapp://send?phone=${phone}${textParam ? `&${textParam}` : ""}`;
        a.click();
      } catch (e) {}
      const url = `https://web.whatsapp.com/send?phone=${phone}${textParam ? `&${textParam}` : ""}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } else {
    if (isMobile) {
      // Mobilde numara yoksa doğrudan WhatsApp uygulamasını tetikle (kişi seçimi ekranı)
      window.location.href = textParam ? `whatsapp://send?${textParam}` : "whatsapp://send";
    } else {
      // Mac ve Windows: WhatsApp Desktop uygulamasını açmayı dene
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = "whatsapp://send";
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 2500);
      } catch (e) {}

      // WhatsApp Web'i de yeni sekmede aç
      window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
    }
  }
}

import html2canvas from "html2canvas";

export function showWhatsAppToast(msg: string, title: string = "WhatsApp Açıldı", phone?: string | null) {
  const existing = document.getElementById("wa-toast-alert");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "wa-toast-alert";
  div.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999999;
    background: #0b141a;
    color: #ffffff;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12);
    font-size: 13.5px;
    line-height: 1.5;
    display: flex;
    align-items: center;
    gap: 14px;
    border-left: 6px solid #25D366;
    max-width: 540px;
    width: calc(100vw - 32px);
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  div.innerHTML = `
    <div style="background: rgba(37,211,102,0.2); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
      📄
    </div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 700; color: #25D366; margin-bottom: 2px; font-size: 14px;">${title}</div>
      <div style="color: #e2e8f0; font-size: 12.5px;">${msg}</div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
      <button id="wa-toast-action-btn" style="background: #25D366; color: #0b141a; border: none; padding: 7px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; white-space: nowrap;">
        WhatsApp'ı Aç
      </button>
      <button id="wa-toast-close-btn" style="background: transparent; color: #94a3b8; border: none; font-size: 18px; cursor: pointer; padding: 4px 6px;">
        ✕
      </button>
    </div>
  `;

  document.body.appendChild(div);

  const actionBtn = div.querySelector("#wa-toast-action-btn");
  if (actionBtn) {
    actionBtn.addEventListener("click", () => {
      openWhatsAppDirect("", phone);
    });
  }

  const closeBtn = div.querySelector("#wa-toast-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => div.remove());
  }

  setTimeout(() => div.remove(), 12000);
}

function downloadBlob(blob: Blob, fileName: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    console.warn("Dosya indirme hatası:", e);
  }
}

export interface SharePdfOptions {
  pdfBlob?: Blob | null;
  pdfUrl?: string | null;
  fileName: string;
  phone?: string | null;
  message?: string;
}

/**
 * PDF dosyasını doğrudan WhatsApp sohbetine aktarır:
 * - Mobilde (Android / iOS): Web Share API ile PDF dosyasını doğrudan WhatsApp'a belgeli/seçili olarak gönderir.
 * - Masaüstünde (Mac / Windows): WhatsApp URL protokolü güvenlik nedeniyle yerel dosya yolunu kabul etmediğinden,
 *   PDF'i indirir, tam biçimli rapor/fiş metnini WhatsApp mesajına otomatik doldurur ve WhatsApp'ı açar.
 */
export async function sharePdfToWhatsApp(options: SharePdfOptions): Promise<void> {
  const { fileName, phone, message } = options;
  const safeFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

  let blob = options.pdfBlob || null;
  if (!blob && options.pdfUrl) {
    try {
      const res = await fetch(options.pdfUrl);
      blob = await res.blob();
    } catch (e) {
      console.warn("PDF blob alınamadı:", e);
    }
  }

  // 1. Mobilde doğrudan yerel dosya paylaşımı (Kişi seçilince PDF ekli olarak açılır)
  if (isMobile && blob && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([blob], safeFileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: safeFileName,
          text: message || "",
        });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return; // Kullanıcı paylaşımı iptal etti
      }
      console.warn("Mobil dosya paylaşımı başarısız, doğrudan WhatsApp açılıyor:", err);
    }
  }

  // 2. Masaüstünde PDF dosyasını otomatik olarak indir
  if (blob) {
    downloadBlob(blob, safeFileName);
  }

  // 3. Doğrudan WhatsApp uygulamasını ve WhatsApp Web'i aç (mesaj hazır doldurulmuş olarak)
  openWhatsAppDirect(message, phone);

  // 4. Kullanıcıya yönlendirici bildirim göster
  showWhatsAppToast(
    `<b>${safeFileName}</b> indirildi ve WhatsApp açıldı.<br/>Mesaj metni hazır aktarıldı. Dilerseniz indirilen PDF dosyasını sohbete sürükleyerek de gönderebilirsiniz.`,
    "📄 PDF Hazır — WhatsApp Açıldı",
    phone
  );
}

export interface ShareReceiptOptions {
  elementId?: string;
  pdfBlob?: Blob | null;
  pdfPromise?: Promise<Blob | null>;
  fileName: string;
  phone?: string | null;
  message?: string;
}

/**
 * Fişi doğrudan WhatsApp'a aktarır:
 * 1. Mobilde (iOS/Android): PDF dosyasını Web Share API ile doğrudan WhatsApp'a belgeli aktarır (sohbet seçildiğinde PDF ekli gelir).
 * 2. Masaüstünde (Mac/Windows):
 *    - Fiş görseli otomatik panoya kopyalanır (WhatsApp'ta Cmd+V / Ctrl+V ile 1 saniyede doğrudan görsel olarak yapışır).
 *    - Fiş detay metni WhatsApp mesaj alanına otomatik doldurulur.
 *    - PDF dosyası indirilir.
 */
export async function shareReceiptVisualOrPdfToWhatsApp(options: ShareReceiptOptions): Promise<void> {
  const { elementId = "sablonlu-fis-icerik", fileName, phone, message } = options;
  const safeName = fileName.replace(/\.(png|pdf)$/i, "");
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

  // PDF blob hazırla
  let pdfBlob = options.pdfBlob || null;
  if (!pdfBlob && options.pdfPromise) {
    try {
      pdfBlob = await options.pdfPromise;
    } catch (e) {
      console.warn("PDF beklenirken hata oluştu:", e);
    }
  }

  // 1. Mobilde doğrudan yerel dosya paylaşımı (Kişi seçilince PDF ekli olarak açılır)
  if (isMobile && pdfBlob && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([pdfBlob], `${safeName}.pdf`, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: safeName,
          text: message || "",
        });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return; // Kullanıcı vazgeçti
      }
      console.warn("Mobil PDF paylaşımı:", err);
    }
  }

  // 2. Fiş görselini HTML elementinden üret ve panoya kopyala
  const el = document.getElementById(elementId) || document.getElementById("sablonlu-fis-alani") || document.querySelector(".sablonlu-fis-alani");
  let imgBlob: Blob | null = null;
  if (el) {
    try {
      const canvas = await html2canvas(el as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      imgBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    } catch (err) {
      console.warn("html2canvas dönüştürme hatası:", err);
    }
  }

  // Mobilde PDF yoksa ama görsel varsa görseli mobilde paylaş
  if (isMobile && imgBlob && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const imgFile = new File([imgBlob], `${safeName}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [imgFile] })) {
        await navigator.share({
          files: [imgFile],
          title: safeName,
          text: message || "",
        });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
  }

  let copiedToClipboard = false;
  if (imgBlob && typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({ "image/png": imgBlob });
      await navigator.clipboard.write([item]);
      copiedToClipboard = true;
    } catch (e) {
      console.warn("Panoya kopyalama:", e);
    }
  }

  // 3. PDF dosyasını bilgisayara indir
  if (pdfBlob) {
    downloadBlob(pdfBlob, `${safeName}.pdf`);
  } else if (imgBlob) {
    downloadBlob(imgBlob, `${safeName}.png`);
  }

  // 4. Doğrudan WhatsApp uygulamasını ve WhatsApp Web'i aç (mesaj hazır doldurulmuş olarak)
  openWhatsAppDirect(message, phone);

  // 5. Kullanıcıya yönlendirici bildirim göster
  if (copiedToClipboard) {
    showWhatsAppToast(
      `<b>${safeName}.pdf</b> indirildi, metin WhatsApp'a aktarıldı ve fiş görseli panoya kopyalandı.<br/>WhatsApp açıldı. Kişiyi seçtikten sonra sohbete <b>Yapıştır (Cmd+V / Ctrl+V)</b> yaparak fişi görsel olarak anında gönderebilirsiniz.`,
      "📄 Fiş Hazır — WhatsApp Açıldı",
      phone
    );
  } else {
    showWhatsAppToast(
      `<b>${safeName}.pdf</b> dosyası indirildi ve WhatsApp açıldı.<br/>WhatsApp'ta kişiyi seçip mesajı gönderebilir, PDF'i sohbete sürükleyebilirsiniz.`,
      "📄 Dosya İndirildi — WhatsApp Açıldı",
      phone
    );
  }
}

/**
 * Sayıyı TL para formatına çevirir
 */
function formatTL(num?: number | string | null): string {
  if (num === null || num === undefined || num === "") return "0,00 TL";
  const n = typeof num === "string" ? parseFloat(num.replace(/\./g, "").replace(",", ".")) || 0 : num;
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

/**
 * Sayıyı Gram formatına çevirir
 */
function formatGram(num?: number | string | null): string {
  if (num === null || num === undefined || num === "") return "0,00 gr";
  const n = typeof num === "string" ? parseFloat(num.replace(/\./g, "").replace(",", ".")) || 0 : num;
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + " gr";
}

/**
 * Sayıyı adet formatına çevirir
 */
function formatAdet(num?: number | string | null): string {
  if (num === null || num === undefined || num === "") return "1";
  const n = typeof num === "string" ? parseFloat(num.replace(/\./g, "").replace(",", ".")) || 0 : num;
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SARRAF FİŞİ WHATSAPP MESAJI
// ─────────────────────────────────────────────────────────────────────────────
export function buildSarrafWhatsAppMessage(props: SarrafFisiPrintModalProps, firmaAdi: string = "LİKYA KUYUMCULUK"): string {
  const isSatis = Number(props.tip) === 1;
  const isTeklif = !props.fisId;
  const baslikTuru = isSatis
    ? (isTeklif ? "SARRAF SATIŞ FİŞİ (TEKLİF)" : "SARRAF SATIŞ FİŞİ")
    : (isTeklif ? "SARRAF ALIŞ FİŞİ (TEKLİF)" : "SARRAF ALIŞ FİŞİ");

  const lines: string[] = [];
  lines.push(`⚜️ *${firmaAdi.toUpperCase()}*`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`📄 *${baslikTuru}*`);
  if (props.belgeNo || props.seriNo) {
    lines.push(`🔢 *Fiş No:* ${props.belgeNo || props.seriNo}`);
  }
  lines.push(`📅 *Tarih:* ${props.tarih}${props.saat ? ` ${props.saat.slice(0, 5)}` : ""}`);
  if (props.unvan) {
    lines.push(`👤 *Müşteri:* ${props.unvan}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("📦 *ÜRÜN DETAYI:*");

  if (props.satirlar && props.satirlar.length > 0) {
    props.satirlar.forEach((item, idx) => {
      const adetStr = item.adet ? ` (${formatAdet(item.adet)} Adet)` : "";
      lines.push(`${idx + 1}. *${item.urunAdi || item.urunKodu || "Ürün"}*${adetStr}`);
      const miktar = item.miktar ? formatGram(item.miktar) : "";
      const has = item.hasGram ? formatGram(item.hasGram) : "";
      const parts: string[] = [];
      if (miktar) parts.push(`Miktar: ${miktar}`);
      if (has) parts.push(`Has: ${has}`);
      if (parts.length > 0) lines.push(`   ${parts.join(" | ")}`);
      if (item.kur && Number(item.kur) > 0) {
        lines.push(`   Kur: ${Number(item.kur).toLocaleString("tr-TR")} TL`);
      }
      if (item.tutar && Number(item.tutar) > 0) {
        lines.push(`   *Tutar: ${formatTL(item.tutar)}*`);
      }
    });
  } else {
    lines.push("• (Ürün kalemi bulunamadı)");
  }

  // Ödeme Satırları varsa
  if (props.odemeSatirlari && props.odemeSatirlari.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("💳 *ÖDEME BİLGİLERİ:*");
    props.odemeSatirlari.forEach((odm) => {
      const ad = odm.paraAdi || odm.paraKodu || "Ödeme";
      const tutar = odm.tutar ? formatTL(odm.tutar) : "";
      lines.push(`• ${ad}: ${tutar}`);
    });
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  if (props.toplamTutar !== undefined && props.toplamTutar !== null) {
    lines.push(`💰 *Toplam Tutar:* ${formatTL(props.toplamTutar)}`);
  }
  if (props.toplamHas !== undefined && props.toplamHas !== null && Number(props.toplamHas) > 0) {
    lines.push(`✨ *Toplam Has:* ${formatGram(props.toplamHas)}`);
  }
  if (props.odenenTutar !== undefined && props.odenenTutar !== null && Number(props.odenenTutar) > 0) {
    lines.push(`💳 *Ödenen Tutar:* ${formatTL(props.odenenTutar)}`);
  }
  if (props.kalanTutar !== undefined && props.kalanTutar !== null && Math.abs(Number(props.kalanTutar)) > 0.01) {
    const isBorc = Number(props.kalanTutar) > 0;
    lines.push(`⚖️ *${isBorc ? "Kalan Borç" : "Para Üstü / Alacak"}:* ${formatTL(Math.abs(Number(props.kalanTutar)))}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("🙏 *Bizi tercih ettiğiniz için teşekkür ederiz.*");

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PERAKENDE FİŞİ / FATURA WHATSAPP MESAJI
// ─────────────────────────────────────────────────────────────────────────────
export function buildPerakendeWhatsAppMessage(fatura: PerakendeFaturaModel | null, firmaAdi: string = "LİKYA KUYUMCULUK"): string {
  if (!fatura) return "";

  const isIade = Number(fatura.faturaTipi) === 2;
  const baslikTuru = isIade ? "PERAKENDE İADE FİŞİ" : "PERAKENDE SATIŞ FİŞİ";

  const lines: string[] = [];
  lines.push(`⚜️ *${firmaAdi.toUpperCase()}*`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`📄 *${baslikTuru}*`);
  if (fatura.faturaNo) {
    lines.push(`🔢 *Belge No:* ${fatura.faturaNo}`);
  }
  lines.push(`📅 *Tarih:* ${fatura.tarih ? new Date(fatura.tarih).toLocaleDateString("tr-TR") : new Date().toLocaleDateString("tr-TR")}`);
  if (fatura.aliciUnvan) {
    lines.push(`👤 *Müşteri:* ${fatura.aliciUnvan}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("📦 *ÜRÜN BİLGİLERİ:*");

  if (fatura.satirlar && fatura.satirlar.length > 0) {
    fatura.satirlar.forEach((satir: any, idx: number) => {
      const ad = satir.urunAdi || satir.barkod || "Ürün";
      const miktarStr = satir.miktar ? `${formatGram(satir.miktar)}` : (satir.adet ? `${formatAdet(satir.adet)} Adet` : "");
      lines.push(`${idx + 1}. *${ad}* ${miktarStr ? `(${miktarStr})` : ""}`);
      if (satir.fiyat && Number(satir.fiyat) > 0) {
        lines.push(`   Birim: ${formatTL(satir.fiyat)}`);
      }
      if (satir.tutar && Number(satir.tutar) > 0) {
        lines.push(`   *Tutar: ${formatTL(satir.tutar)}*`);
      }
    });
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  if (fatura.araToplam && Number(fatura.araToplam) > 0 && Math.abs(fatura.araToplam - fatura.genelToplam) > 0.01) {
    lines.push(`💵 *Ara Toplam:* ${formatTL(fatura.araToplam)}`);
  }
  if (fatura.iskontoTutari && Number(fatura.iskontoTutari) > 0) {
    lines.push(`🏷️ *İskonto:* -${formatTL(fatura.iskontoTutari)}`);
  }
  if (fatura.toplamKdv && Number(fatura.toplamKdv) > 0) {
    lines.push(`🧾 *Toplam KDV:* ${formatTL(fatura.toplamKdv)}`);
  }
  lines.push(`💰 *Genel Toplam:* ${formatTL(fatura.genelToplam)}`);

  // Ödemeler
  if (fatura.odemeler && fatura.odemeler.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("💳 *ÖDEME BİLGİSİ:*");
    fatura.odemeler.forEach((odm: any) => {
      lines.push(`• ${odm.odemeTuruAdi || odm.odemeTipi || "Ödeme"}: ${formatTL(odm.tutar)}`);
    });
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("🙏 *Bizi tercih ettiğiniz için teşekkür ederiz.*");

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DÖVİZ FİŞİ WHATSAPP MESAJI
// ─────────────────────────────────────────────────────────────────────────────
export function buildDovizWhatsAppMessage(props: DovizFisiPrintModalProps, firmaAdi: string = "LİKYA KUYUMCULUK"): string {
  const isSatis = Number(props.tip) === 1;
  const baslikTuru = isSatis ? "DÖVİZ SATIŞ BORDROSU" : "DÖVİZ ALIM BORDROSU";

  const lines: string[] = [];
  lines.push(`⚜️ *${firmaAdi.toUpperCase()}*`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`📄 *${baslikTuru}*`);
  if (props.belgeNo || props.seriNo) {
    lines.push(`🔢 *Belge No:* ${props.belgeNo || props.seriNo}`);
  }
  lines.push(`📅 *Tarih:* ${props.tarih}${props.saat ? ` ${props.saat.slice(0, 5)}` : ""}`);
  if (props.unvan) {
    lines.push(`👤 *Müşteri:* ${props.unvan}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("💱 *İŞLEM DETAYI:*");

  if (props.lines && props.lines.length > 0) {
    props.lines.forEach((item, idx) => {
      const kod = item.paraKodu || item.paraAdi || "DÖVİZ";
      const miktarNum = Number(item.miktar) || 0;
      const kurNum = Number(item.kur) || 0;
      const tutarNum = Number(item.tutar) || 0;
      lines.push(`${idx + 1}. *${miktarNum.toLocaleString("tr-TR")} ${kod}*`);
      lines.push(`   Kur: ${kurNum.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TL`);
      lines.push(`   *Tutar: ${formatTL(tutarNum)}*`);
    });
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  const toplam = props.sonToplam ?? props.toplamTutar;
  if (toplam !== undefined && toplam !== null) {
    lines.push(`💰 *Toplam Tutar:* ${formatTL(toplam)}`);
  }
  if (props.totalMasraf && Number(props.totalMasraf) > 0) {
    lines.push(`🏷️ *Masraf / Komisyon:* ${formatTL(props.totalMasraf)}`);
  }
  if (props.odemeTutari && Number(props.odemeTutari) > 0) {
    lines.push(`💳 *Ödenen Tutar:* ${formatTL(props.odemeTutari)}`);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("🙏 *Bizi tercih ettiğiniz için teşekkür ederiz.*");

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RAPORLAR WHATSAPP MESAJI
// ─────────────────────────────────────────────────────────────────────────────
export interface RaporWhatsAppParams {
  raporAdi: string;
  filtreOzeti?: string;
  veri: RaporVeri;
  tanim: RaporTanim | null;
  firmaAdi?: string;
}

export function buildRaporWhatsAppMessage(params: RaporWhatsAppParams): string {
  const { raporAdi, filtreOzeti, veri, tanim, firmaAdi = "LİKYA KUYUMCULUK" } = params;

  const lines: string[] = [];
  lines.push(`📊 *${raporAdi.toUpperCase()}*`);
  lines.push(`🏢 *${firmaAdi}*`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  if (filtreOzeti || veri?.filtreOzeti) {
    lines.push(`🔍 *Filtre:* ${filtreOzeti || veri.filtreOzeti}`);
  }
  lines.push(`📑 *Toplam Kayıt:* ${(veri?.toplamKayit || 0).toLocaleString("tr-TR")} satır`);
  lines.push(`🕒 *Rapor Tarihi:* ${new Date().toLocaleString("tr-TR")}`);

  // Kolon bazlı genel toplamlar
  const kolonlar = veri?.tanim?.kolonlar || tanim?.kolonlar || [];
  const toplamKolonlar = kolonlar.filter((k) => k.toplam);

  if (toplamKolonlar.length > 0 && veri?.satirlar && veri.satirlar.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("📈 *GENEL TOPLAMLAR:*");
    toplamKolonlar.forEach((k) => {
      const top = veri.satirlar.reduce((acc, r) => acc + (Number(r[k.anahtar]) || 0), 0);
      const bicimli = raporBicimle(top, k.bicim);
      lines.push(`• *${k.baslik}:* ${bicimli}`);
    });
  }

  // Özet tablosu varsa
  if (veri?.tanim?.ozet && veri.ozetSatirlar && veri.ozetSatirlar.length > 0) {
    const oz = veri.tanim.ozet;
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(`📋 *${oz.baslik.toUpperCase()}:*`);
    veri.ozetSatirlar.slice(0, 10).forEach((satir) => {
      const parcalar: string[] = [];
      oz.kolonlar.forEach((col) => {
        const val = raporBicimle(satir[col.anahtar], col.bicim);
        if (val) parcalar.push(`${col.baslik}: ${val}`);
      });
      lines.push(`• ${parcalar.join(" | ")}`);
    });
    if (veri.ozetSatirlar.length > 10) {
      lines.push(`... (+${veri.ozetSatirlar.length - 10} özet satırı)`);
    }
  }

  // İlk 5 satır önizlemesi (kısa özet olarak)
  if (veri?.satirlar && veri.satirlar.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("📋 *Örnek Kayıtlar:*");
    const gosterimSayisi = Math.min(veri.satirlar.length, 5);
    const onemliKolonlar = kolonlar.slice(0, 4);

    for (let i = 0; i < gosterimSayisi; i++) {
      const r = veri.satirlar[i];
      const satirMetin = onemliKolonlar
        .map((k) => {
          const val = raporBicimle(r[k.anahtar], k.bicim);
          return val ? `${k.baslik}: ${val}` : "";
        })
        .filter(Boolean)
        .join(" | ");
      lines.push(`${i + 1}. ${satirMetin}`);
    }
    if (veri.satirlar.length > gosterimSayisi) {
      lines.push(`... ve ${veri.satirlar.length - gosterimSayisi} kayıt daha.`);
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("Likya Kuyumculuk ERP Sistemi");

  return lines.join("\n");
}
