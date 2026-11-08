import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";
import { MobilYetkiler, hatirla, istek, tl } from "../api";

/**
 * Fiyatlar (docs/MOBIL_CARI_YOL_HARITASI.md K12, K14, §8 T1, T4): firmanın seçtiği ürünlerin carinin göreceği son fiyatı.
 * Dükkân panosundaki gibi Alış / Satış; 15 saniyede bir yenilenir. Ham kur ve komisyon gelmez.
 * Kısayol (T1): Satış fiyatına dokunan cari o ürünü almak ister (firmanın sattığı fiyat), Alış fiyatına dokunan satmak
 * ister. Yetkisi olmayan yön soluk ve dokunulmaz. Bir yenilemeden ötekine değişen fiyat kısa süre yeşil / kırmızı parlar.
 * Üstte grup sekmeleri (Hepsi / Döviz / Altın / Gümüş / Ziynet): yalnız listede ürünü olan gruplar çıkar, tek grup varsa
 * sekme gösterilmez. Seçim bu cihazda hatırlanır.
 */

export type FiyatGrubu = "doviz" | "altin" | "gumus" | "ziynet";

export interface MobilFiyat {
  urunId: number;
  kod: string;
  ad: string;
  birim: string;
  /** Sunucu ürün tipinden verir; eski sunucuda yoksa ad / koddan tahmin edilir */
  grup?: FiyatGrubu;
  alis: number | null;
  satis: number | null;
}

type Degisim = "yukari" | "asagi";
type GrupSecimi = "hepsi" | FiyatGrubu;

const GRUPLAR: { kod: GrupSecimi; ad: string }[] = [
  { kod: "hepsi", ad: "Hepsi" },
  { kod: "doviz", ad: "Döviz" },
  { kod: "altin", ad: "Altın" },
  { kod: "gumus", ad: "Gümüş" },
  { kod: "ziynet", ad: "Ziynet" },
];

/** Sunucu grup vermediyse: ad / koddan, olmazsa birimden (altın / gümüş / ziynet gr ya da adet, döviz kendi kodu) */
const grubu = (u: MobilFiyat): FiyatGrubu => {
  if (u.grup) return u.grup;
  const metin = `${u.kod} ${u.ad}`.toLocaleUpperCase("tr");
  if (/G[ÜU]M[ÜU][ŞS]/.test(metin)) return "gumus";
  if (/[ÇC]EYREK|YARIM|Z[İI]YNET|CUMHUR|RE[ŞS]AT|GREMSE|\bATA\b/.test(metin)) return "ziynet";
  if (/ALTIN|AYAR/.test(metin) || u.kod.trim().toLocaleUpperCase("tr") === "HAS") return "altin";
  return u.birim === "gr" || u.birim === "adet" ? "altin" : "doviz";
};

const basamak = (v: number | null) => (v !== null && v >= 1000 ? 2 : v !== null && v < 10 ? 4 : 3);
const saatYaz = (z: string | null) =>
  z ? new Date(z).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "UTC" }) : "";

const FiyatKutusu: React.FC<{
  tur: "alis" | "satis";
  deger: number | null;
  degisim?: Degisim;
  dokunulur: boolean;
  pasif: boolean;
  erisimAdi: string;
  onClick?: () => void;
}> = ({ tur, deger, degisim, dokunulur, pasif, erisimAdi, onClick }) => {
  const sinif = `deger ${tur}${dokunulur ? " dokunulur" : ""}${pasif ? " pasif" : ""}${degisim ? ` ${degisim}` : ""}`;
  const icerik = (
    <>
      <span className="etiket">{tur === "alis" ? "Alış" : "Satış"}</span>
      {tl(deger, basamak(deger))}
    </>
  );
  return dokunulur ? (
    <button type="button" className={sinif} aria-label={erisimAdi} onClick={onClick}>
      {icerik}
    </button>
  ) : (
    <div className={sinif}>{icerik}</div>
  );
};

const FiyatEkrani: React.FC<{
  firmaId: number;
  yetkiler?: MobilYetkiler | null;
  /** Verilmişse fiyatlar dokunulabilir: ürün + carinin yönü (AL = almak istiyor, SAT = satmak istiyor) */
  onIslem?: (urunId: number, yon: "AL" | "SAT") => void;
}> = ({ firmaId, yetkiler, onIslem }) => {
  const [veri, setVeri] = useState<{ zaman: string | null; urunler: MobilFiyat[] } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [degisimler, setDegisimler] = useState<Record<number, { alis?: Degisim; satis?: Degisim }>>({});
  const onceki = useRef<Map<number, { alis: number | null; satis: number | null }>>(new Map());
  const parlamaZamanlayici = useRef<number | undefined>(undefined);

  const yukle = useCallback(async () => {
    try {
      const v = await istek<{ zaman: string | null; urunler: MobilFiyat[] }>("GET", "/fiyatlar");
      // Önceki yenilemeye göre değişen fiyatlar kısa süre parlar (T4)
      const d: Record<number, { alis?: Degisim; satis?: Degisim }> = {};
      for (const u of v.urunler) {
        const o = onceki.current.get(u.urunId);
        if (o) {
          const s: { alis?: Degisim; satis?: Degisim } = {};
          if (u.alis !== null && o.alis !== null && u.alis !== o.alis) s.alis = u.alis > o.alis ? "yukari" : "asagi";
          if (u.satis !== null && o.satis !== null && u.satis !== o.satis) s.satis = u.satis > o.satis ? "yukari" : "asagi";
          if (s.alis || s.satis) d[u.urunId] = s;
        }
        onceki.current.set(u.urunId, { alis: u.alis, satis: u.satis });
      }
      setVeri(v);
      setHata(null);
      if (Object.keys(d).length) {
        setDegisimler(d);
        window.clearTimeout(parlamaZamanlayici.current);
        parlamaZamanlayici.current = window.setTimeout(() => setDegisimler({}), 1800);
      }
    } catch (e: any) {
      setHata(e?.message || "Fiyatlar alınamadı.");
    }
  }, []);

  useEffect(() => {
    setVeri(null);
    onceki.current = new Map();
    setDegisimler({});
    void yukle();
    const t = setInterval(() => void yukle(), 15_000);
    return () => {
      clearInterval(t);
      window.clearTimeout(parlamaZamanlayici.current);
    };
  }, [yukle, firmaId]);

  // Alış fiyatı → cari satar (satış yetkisi gerekir); Satış fiyatı → cari alır (alış yetkisi gerekir)
  const islemVar = !!onIslem;
  const satabilir = islemVar && !!yetkiler?.satis;
  const alabilir = islemVar && !!yetkiler?.alis;

  const [grup, setGrup] = useState<GrupSecimi>(() => (hatirla.oku("fiyat_grup") as GrupSecimi) || "hepsi");
  const grupSec = (g: GrupSecimi) => {
    setGrup(g);
    hatirla.yaz("fiyat_grup", g);
  };
  // Yalnız ürünü olan gruplar; tek grup varsa sekme yok. Seçili grup listeden kalktıysa Hepsi.
  const sekmeler = useMemo(() => {
    const var_ = new Set((veri?.urunler || []).map(grubu));
    return var_.size > 1 ? GRUPLAR.filter((g) => g.kod === "hepsi" || var_.has(g.kod as FiyatGrubu)) : [];
  }, [veri]);
  const etkinGrup: GrupSecimi = sekmeler.some((s) => s.kod === grup) ? grup : "hepsi";
  const gorunen = etkinGrup === "hepsi" ? veri?.urunler || [] : (veri?.urunler || []).filter((u) => grubu(u) === etkinGrup);

  return (
    <>
      {hata && <Alert variant="warning">{hata}</Alert>}
      {!veri && !hata && (
        <div className="m-yukleniyor">
          <Spinner animation="border" />
        </div>
      )}
      {veri && (
        <div className="m-kart">
          <div className="m-kart-ust">
            <div>
              <div className="m-baslik">Fiyatlar</div>
              {islemVar && veri.urunler.length > 0 && <div className="m-ipucu">Fiyata dokunarak hemen işlem yapabilirsiniz</div>}
            </div>
            {veri.zaman && <span className="m-canli">{saatYaz(veri.zaman)}</span>}
          </div>
          {sekmeler.length > 0 && (
            <div className="m-segment kucuk m-fiyat-grup" role="tablist" aria-label="Fiyat grubu">
              {sekmeler.map((s) => (
                <button
                  key={s.kod}
                  type="button"
                  role="tab"
                  aria-selected={etkinGrup === s.kod}
                  className={etkinGrup === s.kod ? "secili" : ""}
                  onClick={() => grupSec(s.kod)}
                >
                  {s.ad}
                </button>
              ))}
            </div>
          )}
          {veri.urunler.length === 0 && <div className="m-bos">Şu an gösterilecek fiyat yok.</div>}
          <div className="m-fiyat-liste">
            {gorunen.map((u) => (
              <div className="m-fiyat-satir" key={u.urunId}>
                <div className="ad">
                  <div className="ad-metin">{u.ad}</div>
                  <span className="kod">
                    {u.kod} · {u.birim}
                  </span>
                </div>
                <FiyatKutusu
                  tur="alis"
                  deger={u.alis}
                  degisim={degisimler[u.urunId]?.alis}
                  dokunulur={satabilir && u.alis !== null}
                  pasif={islemVar && !(satabilir && u.alis !== null)}
                  erisimAdi={`${u.ad} sat, alış fiyatı ${tl(u.alis, basamak(u.alis))}`}
                  onClick={() => onIslem?.(u.urunId, "SAT")}
                />
                <FiyatKutusu
                  tur="satis"
                  deger={u.satis}
                  degisim={degisimler[u.urunId]?.satis}
                  dokunulur={alabilir && u.satis !== null}
                  pasif={islemVar && !(alabilir && u.satis !== null)}
                  erisimAdi={`${u.ad} al, satış fiyatı ${tl(u.satis, basamak(u.satis))}`}
                  onClick={() => onIslem?.(u.urunId, "AL")}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default FiyatEkrani;
