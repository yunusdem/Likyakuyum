import React, { useEffect } from "react";
import { AdisyonService } from "../../services/adisyonService";
import { mutfakFisHtml, mutfakFisMetni } from "../../pages/adisyon/mutfakFis";
import { AjanSonucu, ajanaGonder } from "../../pages/adisyon/mutfakYaziciAjan";
import { hesapFisi } from "../../pages/adisyon/hesapFisi";
import { PrinterService } from "../../services/printerService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";

/**
 * Hesap fişi işi (TA34): garson "Hesap iste"ye bastığında sunucu kuyruğa yazar; istasyon adisyonu ve hesabı okuyup kasanın fiş
 * yazıcısından (Perakende fiş yazıcısı çözümlemesi; yoksa ajanın varsayılan yazıcısı) basar. Adisyon bu arada kapandıysa basılmaz.
 */
async function hesapFisiniBas(adisyonId: number, fisId: number, deneme: number): Promise<AjanSonucu> {
  const [a, h] = await Promise.all([AdisyonService.getir(adisyonId), AdisyonService.hesap(adisyonId)]);
  if (a.durum !== 0 && a.durum !== 1) return { success: true, message: "Adisyon kapanmış; hesap fişi basılmadı." };
  const { metin, html } = hesapFisi(a, h, a.masaAd || "");
  let yazici = "";
  try {
    const yazicilar = await PrinterService.getYazicilar().catch(() => []);
    const rp: any = resolveEffectivePrinter({ pageType: "perakende", tip: 1, vezne: null, user: null, printers: yazicilar || [] } as any);
    yazici = rp?.printer?.cihazAdi || rp?.printer?.ad || "";
  } catch { /* varsayılan yazıcı */ }
  return ajanaGonder({ html, text: metin, printerName: yazici, title: `Hesap_${a.masaAd || a.adisyonNo}`, jobId: `hesap_${fisId}_${deneme}` });
}

/** Bu bilgisayar mutfak fişlerini basar mı (Adisyon › Ayarlar › Bu bilgisayar) — bilgisayara özel */
export const MUTFAK_ISTASYON_ANAHTARI = "likya_mutfak_yazici_istasyonu";
export const mutfakIstasyonuMu = () => localStorage.getItem(MUTFAK_ISTASYON_ANAHTARI) === "1";
/** İstasyon durumu (ayarlar ekranı gösterir) */
export const MUTFAK_ISTASYON_OLAYI = "likya_mutfak_istasyon_durumu";
/** Açık adisyon ekranı "mutfak fişi yazıldı" olayını aldığında istasyonu beklemeden uyandırır */
export const MUTFAK_ISTASYON_UYAN = "likya_mutfak_istasyon_uyan";
export const mutfakIstasyonunuUyandir = () => window.dispatchEvent(new Event(MUTFAK_ISTASYON_UYAN));

/** Yoklama aralıkları (ms): kuyrukta iş varken sık, boşken seyrek; ajan yokken daha da seyrek */
export const ISTASYON_ARALIK = { is: 3000, bos: 12000, ajanYok: 20000 };
const KILIT = "likya_mutfak_yazici_istasyonu_kilidi";

/**
 * Mutfak yazıcı istasyonu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): "bu bilgisayar basar" işaretli kasa PC'sinde, hangi
 * sayfa açık olursa olsun arka planda kuyruktan fiş kiralar, hazırlık yerinin yazıcısına ajan üzerinden basar ve sonucu bildirir.
 *
 * 26.11.2026 denetimiyle:
 *  - Tarayıcıda TEK istasyon: aynı bilgisayarda açık her sekme / müşteri ekranı penceresi ayrı istasyon olup aynı fişi iki kez
 *    basabiliyor ve sunucuyu sekme sayısı kadar yokluyordu. Web Locks ile kilidi alan tek sekme çalışır; o kapanınca başkası devralır.
 *  - Fişler TEK TEK kiralanır ve basılır (kirası dolmuş fiş basılmaz); sonuç kira belgesiyle (deneme) bildirilir.
 *  - Sunucu yükü: kuyruk boşken 12 sn'de bir (eskiden her sekme 3 sn'de bir), iş varken ve adisyon ekranı uyandırınca hemen.
 *  - Ajan yoksa "ajan yok" bildirilir: basım hakkı tükenmez, ajan gelince fişler kendiliğinden basılır.
 */
export const MutfakYaziciIstasyonu: React.FC = () => {
  useEffect(() => {
    let dur = false;
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    let calisiyor = false;
    let birak: (() => void) | null = null;
    const planla = (ms: number) => { if (dur) return; if (zamanlayici) clearTimeout(zamanlayici); zamanlayici = setTimeout(() => void tur(), ms); };
    const tur = async () => {
      if (dur || calisiyor) return;
      if (!mutfakIstasyonuMu() || !localStorage.getItem("kuyumcu_erp_access_token")) return planla(ISTASYON_ARALIK.bos);
      calisiyor = true;
      let sonraki = ISTASYON_ARALIK.bos;
      try {
        // Bir turda en çok 10 fiş, tek tek: her biri kiralanır, basılır, sonucu yazılır
        for (let n = 0; n < 10 && !dur; n++) {
          const [f] = await AdisyonService.mutfakFisleriAl(1);
          if (!f) break;
          sonraki = ISTASYON_ARALIK.is;
          const r = f.tur === 3
            ? await hesapFisiniBas(Number(f.icerik.adisyonId), f.fisId, f.deneme).catch((e: any): AjanSonucu => ({ success: false, message: e?.message || "Hesap fişi hazırlanamadı." }))
            : await ajanaGonder({ html: mutfakFisHtml(f.icerik), text: mutfakFisMetni(f.icerik), printerName: f.icerik.yazici, title: `Mutfak_${f.icerik.yer}_${f.fisId}`, jobId: `mutfak_${f.fisId}_${f.deneme}` });
          await AdisyonService.mutfakFisSonucu(f.fisId, r.success, r.success ? undefined : r.message, { deneme: f.deneme, ajanYok: !!r.ajanYok }).catch(() => undefined);
          window.dispatchEvent(new CustomEvent(MUTFAK_ISTASYON_OLAYI, { detail: { fisId: f.fisId, basarili: r.success, mesaj: r.message, zaman: Date.now() } }));
          if (r.ajanYok) { sonraki = ISTASYON_ARALIK.ajanYok; break; }
          if (!r.success) break; // aynı yazıcı büyük olasılıkla sıradakini de basamaz: sonraki turda
        }
      } catch {
        /* oturum / bağlantı yok: sonraki tur */
      } finally {
        calisiyor = false;
        planla(sonraki);
      }
    };
    const uyan = () => { if (!calisiyor) planla(200); };
    const basla = () => { window.addEventListener(MUTFAK_ISTASYON_UYAN, uyan); void tur(); };
    const kilitler = (navigator as any).locks;
    if (kilitler?.request) {
      // Kilit bu sekmede kalır (söz çözülene kadar); sekme kapanınca / bileşen kalkınca bırakılır ve bekleyen sekme devralır
      void kilitler.request(KILIT, () => new Promise<void>((coz) => { if (dur) return coz(); birak = coz; basla(); })).catch(() => undefined);
    } else basla();
    return () => { dur = true; if (zamanlayici) clearTimeout(zamanlayici); window.removeEventListener(MUTFAK_ISTASYON_UYAN, uyan); birak?.(); };
  }, []);
  return null;
};

export default MutfakYaziciIstasyonu;
