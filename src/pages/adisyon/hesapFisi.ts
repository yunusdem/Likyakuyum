import type { AdisyonAyrinti, HesapDurumu } from "../../services/adisyonService";
import { esitBol, telefonYaz } from "../../../Backend/src/services/adisyon/adisyonHesap";

/**
 * Hesap / kurye fişi üreticisi (saf). adisyonKasa.tsx'ten ayrıldı (26.11.2026): mutfak yazıcı istasyonu da kullanır —
 * garson "Hesap iste"ye basınca hesap fişi kasadaki yazıcıdan kendiliğinden çıkar (TA34).
 */
const p2 = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kacis = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Hesap fişi (bilgi amaçlı, mali belge değil): 80 mm düz metin + aynı içerikte HTML */
export function hesapFisi(a: AdisyonAyrinti, h: HesapDurumu, masaAd: string, zaman = new Date()) {
  const G = 38;
  const satir = (sol: string, sag = "") => { const s = sol.slice(0, Math.max(1, G - sag.length - 1)); return s + " ".repeat(Math.max(1, G - s.length - sag.length)) + sag; };
  const orta = (t: string) => { const s = t.slice(0, G); return " ".repeat(Math.floor((G - s.length) / 2)) + s; };
  const cizgi = "-".repeat(G);
  // Paket / gel-al (D8): kurye fişi — müşteri adı, telefon, adres, not
  const paket = a.tur === 2 || a.tur === 3;
  const l: string[] = [orta(paket ? (a.tur === 3 ? "GEL-AL" : "PAKET SERVİS") : "HESAP"), orta(paket ? a.adisyonNo : `Masa ${masaAd} · ${a.adisyonNo}`), orta(zaman.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })), cizgi];
  if (paket) {
    const sar = (on: string, t: string) => { const kelime = String(t).split(/\s+/); let s2 = on; for (const k of kelime) { if ((s2 + " " + k).trim().length > G) { l.push(s2); s2 = "  " + k; } else s2 = (s2 ? s2 + " " : "") + k; } if (s2.trim()) l.push(s2); };
    if (a.musteriAd) l.push(`Müşteri: ${a.musteriAd}`.slice(0, G));
    if (a.musteriTel) l.push(`Tel: ${telefonYaz(a.musteriTel)}`);
    if (a.musteriAdres) sar("Adres:", a.musteriAdres);
    if (a.aciklama) sar("Not:", a.aciklama);
    l.push(cizgi);
  }
  for (const k of a.kalemler.filter((x) => !x.iptal && !x.faturaId)) {
    const ad = `${k.miktar % 1 ? String(k.miktar).replace(".", ",") : k.miktar} ${k.ad}${k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}`;
    l.push(satir(ad, k.ikram ? "İKRAM" : p2(k.tutar)));
  }
  l.push(cizgi);
  if (h.servis > 0) { l.push(satir("Ara toplam", p2(h.ara))); l.push(satir(`Servis (%${String(a.servisOrani).replace(".", ",")})`, p2(h.servis))); }
  if ((h.indirim || 0) > 0) { if (!(h.servis > 0)) l.push(satir("Ara toplam", p2(h.ara))); l.push(satir(`İndirim${h.indirimTuru === 1 ? ` (%${String(h.indirimDegeri).replace(".", ",")})` : ""}`, `-${p2(h.indirim || 0)}`)); }
  if (Math.abs(h.yuvarlama) > 0.004) l.push(satir("Yuvarlama", p2(h.yuvarlama)));
  l.push(satir("TOPLAM", p2(h.toplam)));
  for (const o of h.odemeler) l.push(satir("Alınan", `-${p2(o.tutar)}`));
  if (h.odemeler.length) l.push(satir("KALAN", p2(h.kalan)));
  // Kişi başı: toplamın eşit payı (ödeme yapan kişi de sayılır; kalan / kişi değil). Kuruş artığı ilk paya (Eşit böl ile aynı)
  if (a.kisiSayisi && a.kisiSayisi > 1 && h.toplam > 0) l.push(satir(`Kişi başı (${a.kisiSayisi})`, p2(esitBol(h.toplam, a.kisiSayisi)[0])));
  const metin = l.join("\r\n") + "\r\n\r\n\r\n";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Hesap ${kacis(masaAd)}</title><style>@page{size:80mm auto;margin:2mm}body{margin:0;font:12px/1.35 'Courier New',monospace;width:76mm}pre{margin:0;white-space:pre-wrap}</style></head><body><pre>${kacis(l.join("\n"))}</pre></body></html>`;
  return { metin, html };
}
