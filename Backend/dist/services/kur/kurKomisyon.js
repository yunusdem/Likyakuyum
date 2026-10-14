/**
 * Kur komisyonu formülü (docs/KUR_KAYNAGI_YOL_HARITASI.md, K6–K15). Saf; veritabanı ve ağ yok.
 * Kullanıcı hep pozitif yazar: komisyon alıştan düşülür, satışa eklenir. Y = yüzde, T = TL tutar.
 */
export const yuvarla = (v, ondalik) => {
    const c = 10 ** Math.max(0, Math.min(10, ondalik));
    return Math.round((v + Number.EPSILON) * c) / c;
};
const uygula = (baz, tur, deger, yon) => {
    const d = Math.abs(Number(deger) || 0);
    return tur === "Y" ? baz * (1 + (yon * d) / 100) : baz + yon * d;
};
const pozitif = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
/**
 * Ham fiyattan liste satırı. Alış ya da satıştan biri yoksa null (listede yarım satır kaydedilemez).
 * Döviz kolonları ham kalır, efektif kolonlar komisyonludur.
 */
export const komisyonUygula = (ham, k, ondalik) => {
    const bazAlis = pozitif(ham.bazAlis) ? ham.bazAlis : null;
    const bazSatis = pozitif(ham.bazSatis) ? ham.bazSatis : null;
    if (bazAlis === null || bazSatis === null)
        return null;
    const dovizAlis = pozitif(ham.dovizAlis) ? ham.dovizAlis : bazAlis;
    const dovizSatis = pozitif(ham.dovizSatis) ? ham.dovizSatis : bazSatis;
    const kom = k ?? { alisTur: "T", alisDeger: 0, satisTur: "T", satisDeger: 0 };
    const efektifAlis = yuvarla(uygula(bazAlis, kom.alisTur, kom.alisDeger, -1), ondalik);
    const efektifSatis = yuvarla(uygula(bazSatis, kom.satisTur, kom.satisDeger, 1), ondalik);
    if (efektifAlis <= 0 || efektifSatis <= 0)
        return null;
    return {
        dovizAlis: yuvarla(dovizAlis, ondalik),
        dovizSatis: yuvarla(dovizSatis, ondalik),
        efektifAlis,
        efektifSatis,
    };
};
