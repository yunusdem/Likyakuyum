/**
 * Kasa PC'deki yazdırma ajanına (printercekmeApp, ws://127.0.0.1:9100) arka planda fiş gönderimi — ekranda "yazdırılıyor"
 * katmanı açmadan (mutfak fişleri sürekli gelir). İleti biçimi silentPrintService ile aynı ("print" eylemi).
 *
 * Sonuç üç durumludur (26.11.2026 denetimi; eskiden 12 sn cevapsız kalan fiş "basıldı" sayılıyordu ve mutfağa hiç ulaşmayan
 * sipariş kuyruktan düşüyordu):
 *  - basıldı: ajan "print_result" ile başarı bildirdi
 *  - basılamadı: ajan hata bildirdi, bağlantı sonuç gelmeden kapandı ya da süre doldu (fiş kuyrukta kalır, yeniden denenir)
 *  - ajan yok: bağlantı hiç kurulamadı (basım denemesi sayılmaz)
 */
export interface AjanSonucu { success: boolean; message: string; ajanYok?: boolean }

export const AJAN_BEKLEME_MS = 15000;

/** Ajan iletisi baskı sonucu mu (saf; test edilir): yalnız "print_result" eylemi sonuç sayılır */
export function ajanIletisiSonuc(j: unknown): AjanSonucu | null {
  if (!j || typeof j !== "object") return null;
  const m = j as Record<string, unknown>;
  if (m.action !== "print_result") return null;
  return { success: m.success === true, message: String(m.message || (m.success === true ? "" : "Yazdırma hatası.")) };
}

const dene = (url: string, ileti: Record<string, unknown>, bekleme = AJAN_BEKLEME_MS): Promise<AjanSonucu | null> =>
  new Promise((cevap) => {
    if (typeof WebSocket === "undefined") return cevap(null);
    let bitti = false, gonderildi = false;
    let ws: WebSocket | null = null;
    let t: ReturnType<typeof setTimeout> = setTimeout(() => son(null), 3500);
    // Bağlantı kurulamadıysa null (ajan yok); kurulduysa sonuç ya da "cevap gelmedi" başarısızlığı
    const son = (r: AjanSonucu | null) => { if (bitti) return; bitti = true; clearTimeout(t); try { ws?.close(); } catch { /* */ } cevap(gonderildi ? r ?? { success: false, message: "Yazdırma ajanından cevap gelmedi." } : null); };
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        gonderildi = true;
        clearTimeout(t);
        t = setTimeout(() => son({ success: false, message: "Yazdırma ajanından cevap gelmedi (yazıcı kapalı ya da meşgul olabilir)." }), bekleme);
        try { ws?.send(JSON.stringify(ileti)); } catch { son({ success: false, message: "Fiş yazdırma ajanına iletilemedi." }); }
      };
      ws.onmessage = (e) => { try { const r = ajanIletisiSonuc(JSON.parse(String(e.data))); if (r) son(r); } catch { /* */ } };
      ws.onerror = () => { if (!gonderildi) son(null); };
      ws.onclose = () => { if (gonderildi) son({ success: false, message: "Yazdırma ajanı sonuç bildirmeden bağlantıyı kapattı." }); };
    } catch { son(null); }
  });

export async function ajanaGonder(g: { html: string; text?: string; printerName: string; title: string; jobId: string }): Promise<AjanSonucu> {
  const ileti = { action: "print", jobId: g.jobId, html: g.html, text: g.text, printerName: g.printerName, targetDevice: g.printerName, copies: 1, isPos: true, title: g.title };
  const r = (await dene("ws://127.0.0.1:9100", ileti)) ?? (await dene("ws://localhost:9100", ileti));
  return r ?? { success: false, ajanYok: true, message: "Yazdırma ajanı bu bilgisayarda çalışmıyor (127.0.0.1:9100)." };
}
