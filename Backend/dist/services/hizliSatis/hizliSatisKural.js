/**
 * Hızlı Satış ortak kuralları (docs/HIZLI_SATIS_YOL_HARITASI.md). Saf işlevler; ön yüz de içe aktarır.
 */
import { noTemizle, noTuru } from "../../utils/vknKontrol.js";
export const HIZLI_SATIS_MODULLERI = ["perakende", "ticari", "sarraf", "doviz"];
export const MODUL_ADI = {
    perakende: "Perakende",
    ticari: "Ticari",
    sarraf: "Sarraf",
    doviz: "Döviz",
};
/**
 * Her modülün hızlı satışının lisans (modül kataloğu) kodu: sol menüdeki maddesi (src/routes/DashboardRoute.tsx,
 * "<ana menü>:hizli-satis/<modül>"). Firma bazında ayrı açılıp kapanır; sunucu modül uçlarında bu kodu denetler.
 */
export const HIZLI_SATIS_MODUL_KODU = {
    perakende: "perakende:hizli-satis/perakende",
    ticari: "ticari:hizli-satis/ticari",
    sarraf: "vezne:hizli-satis/sarraf",
    doviz: "vezne:hizli-satis/doviz",
};
/** Buton ürün türü: 1 Ürün Tanımı / para birimi (TODVZ_PARA), 2 stok kartı, 3 serbest ürün */
export const URUN_TURU = { PARA: 1, STOK: 2, SERBEST: 3 };
/** Hangi modülde hangi tür buton konabilir (H7, H9) */
export const MODUL_URUN_TURLERI = {
    perakende: [URUN_TURU.PARA, URUN_TURU.SERBEST],
    ticari: [URUN_TURU.STOK, URUN_TURU.SERBEST],
    sarraf: [URUN_TURU.PARA],
    doviz: [URUN_TURU.PARA],
};
/** 12.000 TL kuralı yalnız mal satışında (H12) */
export const FATURA_SINIRI_MODULLERI = ["perakende", "ticari"];
export const VARSAYILAN_FATURA_SINIRI = 12000;
/** TODVZ_URUN_RESIM.TIP: hızlı satış butonu resmi (0 altın, 1 özel, 2 stok kartı) */
export const BUTON_RESIM_TIPI = 4;
/** Küçültülmüş buton resminin en büyük boyutu (data URL karakteri); tarayıcı ~300 px'e küçültür */
export const BUTON_RESIM_AZAMI = 400_000;
export const SERBEST_KDV_ORANLARI = [0, 1, 10, 20];
export const modulGecerliMi = (m) => HIZLI_SATIS_MODULLERI.includes(m);
export const renkGecerliMi = (r) => typeof r === "string" && /^#[0-9a-fA-F]{6}$/.test(r);
/** Satış fişi toplamı (KDV dahil) sınıra eşit ya da üstündeyse alıcı bilgisi zorunlu; alışta (tip 0) uygulanmaz */
export const faturaSiniriAsildiMi = (modul, toplam, sinir, tip = 1) => tip === 1 && FATURA_SINIRI_MODULLERI.includes(modul) && sinir > 0 && Math.round(toplam * 100) >= Math.round(sinir * 100);
/** Alış / Satış düğmesi olan modüller (H10, H11; Perakende alışı 14.10.2026) */
export const ALIS_SATIS_MODULLERI = ["perakende", "sarraf", "doviz"];
/** İskonto kullanılabilen modüller (yalnız satışta) */
export const ISKONTO_MODULLERI = ["perakende", "ticari", "sarraf"];
export const sinirOku = (deger) => {
    const s = typeof deger === "string" ? (deger.includes(",") ? deger.replace(/\./g, "").replace(",", ".") : deger) : deger;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : VARSAYILAN_FATURA_SINIRI;
};
/** Sınır aşıldığında alıcı bilgisinde eksikler (H13). Boş dizi = tamam. */
export function aliciEksikleri(a) {
    const eksik = [];
    const t = (v) => String(v ?? "").trim();
    const unvan = t(a?.unvan);
    // Fiş ekranlarındaki anonim adlar (isAnonymousCustomerName): nihai tüketici, "isim beyan edilmemiştir/edilmedi"
    const anonim = /^n[iİı]ha[iİı]\s+t[üu]ket[iİı]c[iİı]$/i.test(unvan) || /beyan\s+ed[iİı]lme/i.test(unvan.toLocaleLowerCase("tr-TR"));
    if (!unvan || anonim)
        eksik.push("Ad Soyad / Ünvan");
    const no = noTemizle(t(a?.vknTckn));
    if (!no)
        eksik.push("TCKN / VKN");
    else if (/^1{10,11}$/.test(no) || !noTuru(no))
        eksik.push("Geçerli TCKN / VKN");
    if (!t(a?.adres))
        eksik.push("Adres");
    if (!t(a?.il))
        eksik.push("İl");
    if (!t(a?.ilce))
        eksik.push("İlçe");
    return eksik;
}
/** Ürün Tanımı (TODVZ_PARA) bu modülün butonu olabilir mi (H7). urunTipi: 0 döviz, 1 altın, 2 gümüş, 3 ziynet, 99 iskonto */
export function paraUygunMu(modul, p) {
    const kod = String(p.kod ?? "").trim().toLocaleUpperCase("tr-TR");
    const tip = Number(p.urunTipi) || 0;
    if (!kod || ["TL", "TRY", "TRL", "YTL", "POS", "HAVALE"].includes(kod) || tip === 99)
        return false;
    if (modul === "doviz")
        return tip === 0;
    if (modul === "perakende")
        return tip === 1 || tip === 2 || tip === 3;
    if (modul === "sarraf")
        return tip >= 0 && tip <= 3;
    return false;
}
