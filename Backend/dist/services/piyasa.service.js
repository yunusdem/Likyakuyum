import { KAYNAKLAR } from "../piyasa/kaynaklar/index.js";
import { logger } from "../utils/logger.js";
/**
 * Piyasa panosu: 7 sitenin fiyatlarını süreç içinde tek noktadan tutar.
 * - Firma bağımsız, veritabanı yok; kaç kullanıcı bakarsa baksın sitelere giden istek sayısı değişmez.
 * - Talep olunca çalışır: son istekten BOSTA_KAPAT_MS sonra bağlantılar kapanır, ilk istekte yeniden açılır.
 * - Değişim yönü (yukarı/aşağı) burada, bir önceki değere göre bulunur ve bir sonraki değişime kadar korunur.
 */
const BOSTA_KAPAT_MS = 90_000;
const ILK_BEKLEME_MS = 3_000;
let calisiyor = false;
let sonIstek = 0;
let denetim = null;
const onceki = new Map();
const baslat = () => {
    if (calisiyor)
        return;
    calisiyor = true;
    logger.info("[piyasa] Kaynaklar başlatılıyor");
    for (const k of KAYNAKLAR)
        k.baslat();
    denetim = setInterval(() => {
        if (Date.now() - sonIstek > BOSTA_KAPAT_MS)
            durdur();
    }, 15_000);
    denetim.unref();
};
const durdur = () => {
    if (!calisiyor)
        return;
    calisiyor = false;
    logger.info("[piyasa] Kimse bakmıyor, kaynaklar durduruldu");
    for (const k of KAYNAKLAR)
        k.durdur();
    if (denetim)
        clearInterval(denetim);
    denetim = null;
};
const yonEkle = (anlik) => ({
    ...anlik,
    gruplar: anlik.gruplar.map((g, gi) => ({
        ...g,
        satirlar: g.satirlar.map((s) => {
            const deger = s.satis ?? s.alis;
            if (deger === null)
                return s;
            const anahtar = `${anlik.kod}|${gi}|${s.kod}`;
            const o = onceki.get(anahtar);
            const yon = !o ? null : deger > o.deger ? "yukari" : deger < o.deger ? "asagi" : o.yon;
            onceki.set(anahtar, { deger, yon });
            return { ...s, yon };
        }),
    })),
});
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
export const PiyasaService = {
    async anlik() {
        sonIstek = Date.now();
        if (!calisiyor) {
            baslat();
            // İlk açılışta boş ekran yerine verinin gelmesini kısa süre bekle
            const bitis = Date.now() + ILK_BEKLEME_MS;
            while (Date.now() < bitis && KAYNAKLAR.some((k) => k.anlik().durum === "bekliyor"))
                await bekle(150);
        }
        return {
            sunucuSaati: new Date().toISOString(),
            kaynaklar: KAYNAKLAR.map((k) => yonEkle(k.anlik())),
        };
    },
};
