/**
 * Kurulum (exe) açılışındaki şema göçünün durumu (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.6 · K20).
 * Sağlık ucu göç bitmeden ya da hatalıyken 503 döner: güncelleyici (guncelle.ps1) yeni sürümün sağlık denetimi tutmayınca
 * eski sürüme döner. Önceden göç hatası yalnız loga yazılıyor, sağlık 200 döndüğü için bozuk sürüm yerinde kalıyordu.
 */
let durum = { durum: "bekliyor", mesaj: null, zaman: null };
export const gocDurumu = () => durum;
export const gocDurumuYaz = (asama, mesaj = null) => {
    durum = { durum: asama, mesaj, zaman: new Date().toISOString() };
};
const DENEME_ARALIGI_MS = 10_000;
const DENEME_SURESI_MS = 10 * 60 * 1000;
/**
 * Açılış göçünü çalıştırır (E7). Windows açılışında SQL Express servisi programdan geç hazır olabiliyor: bağlantı
 * hatasında durum "sürüyor" kalır, 10 sn arayla 10 dk yeniden denenir (önceden bir kez denenip "hata"da kalıyor, sağlık
 * ucu program kapanana kadar 503 veriyordu). Göç dosyasının kendi hatası (`dosyaHatasiMi`) hemen "hata" olur.
 */
export const gocuCalistir = async (uygula, dosyaHatasiMi, secenek = {}) => {
    const aralik = secenek.aralikMs ?? DENEME_ARALIGI_MS;
    const sure = secenek.sureMs ?? DENEME_SURESI_MS;
    const bekle = secenek.bekle ?? ((ms) => new Promise((t) => setTimeout(t, ms)));
    const bas = Date.now();
    gocDurumuYaz("suruyor");
    for (let deneme = 1;; deneme++) {
        try {
            const s = await uygula();
            gocDurumuYaz("tamam");
            return s;
        }
        catch (err) {
            const mesaj = String(err?.message || err);
            if (dosyaHatasiMi(err) || Date.now() - bas + aralik > sure) {
                gocDurumuYaz("hata", mesaj);
                return null;
            }
            gocDurumuYaz("suruyor", `Veritabanına bağlanılamadı (deneme ${deneme}); yeniden denenecek: ${mesaj}`);
            await bekle(aralik);
        }
    }
};
