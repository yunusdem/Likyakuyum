import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Form, Spinner, Table } from "react-bootstrap";
import { KurKaynakService, type KomisyonTuru, type KurKomisyonSatiri } from "../../services/kurKaynakService";

/**
 * Firma Tanımları › Kur Kaynağı: birim bazında komisyon (docs/KUR_KAYNAGI_YOL_HARITASI.md, K10–K13, K19).
 * Döviz alış/satış ve efektif alış/satış için ayrı komisyon. Kullanıcı eksi yazmaz; alış komisyonu
 * alıştan düşülür, satış komisyonu satışa eklenir. Kayıt sayfanın Kaydet düğmesiyle.
 */

export interface KurKomisyonTablosuRef {
  /** Değişiklik varsa kaydeder; değişiklik yoksa hiçbir şey yapmaz */
  kaydet: () => Promise<boolean>;
}

/** Tablodaki dört komisyon: [tür alanı, değer alanı, başlık] */
const KOLONLAR = [
  ["dovizAlisTur", "dovizAlisDeger", "Döviz alış"],
  ["dovizSatisTur", "dovizSatisDeger", "Döviz satış"],
  ["alisTur", "alisDeger", "Efektif alış"],
  ["satisTur", "satisDeger", "Efektif satış"],
] as const;

type TurAlani = (typeof KOLONLAR)[number][0];
type DegerAlani = (typeof KOLONLAR)[number][1];
type Hucre = Record<TurAlani, KomisyonTuru> & Record<DegerAlani, string>;

const metin = (v: number) => (v ? String(v).replace(".", ",") : "");
const sayi = (v: string) => {
  // Virgül varsa ondalık odur (noktalar binliktir); yoksa nokta ondalık sayılır (0.005)
  const s = v.trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.abs(n) : NaN;
};
/** Rakam ve ondalık ayırıcı; eksi işareti kabul edilmez */
const temizle = (v: string) => v.replace(/[^0-9.,]/g, "");

const KurKomisyonTablosu = forwardRef<KurKomisyonTablosuRef>((_props, ref) => {
  const [satirlar, setSatirlar] = useState<KurKomisyonSatiri[]>([]);
  const [hucreler, setHucreler] = useState<Record<number, Hucre>>({});
  const [degisti, setDegisti] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [arama, setArama] = useState("");

  const doldur = useCallback((liste: KurKomisyonSatiri[]) => {
    setSatirlar(liste);
    const h: Record<number, Hucre> = {};
    for (const s of liste) {
      const hucre = {} as Hucre;
      for (const [t, d] of KOLONLAR) {
        hucre[t] = s[t];
        hucre[d] = metin(s[d]);
      }
      h[s.paraId] = hucre;
    }
    setHucreler(h);
    setDegisti(false);
  }, []);

  useEffect(() => {
    KurKaynakService.komisyonlar()
      .then(doldur)
      .catch((e) => setHata(e?.message || "Komisyonlar yüklenemedi."))
      .finally(() => setYukleniyor(false));
  }, [doldur]);

  const guncelle = (paraId: number, alan: TurAlani | DegerAlani, deger: string) => {
    const yeni = alan.endsWith("Deger") ? temizle(deger) : deger;
    setHucreler((p) => ({ ...p, [paraId]: { ...p[paraId], [alan]: yeni } }));
    setDegisti(true);
  };

  useImperativeHandle(ref, () => ({
    kaydet: async () => {
      if (!degisti) return false;
      const gonder: KurKomisyonSatiri[] = [];
      for (const s of satirlar) {
        const h = hucreler[s.paraId];
        const satir = { ...s };
        for (const [t, d, baslik] of KOLONLAR) {
          const v = h[d] ? sayi(h[d]) : 0;
          if (Number.isNaN(v)) throw new Error(`${s.kod} ${baslik.toLocaleLowerCase("tr-TR")} komisyonu sayı değil.`);
          if (h[t] === "Y" && v >= 100) throw new Error(`${s.kod} ${baslik.toLocaleLowerCase("tr-TR")} yüzdesi 100'den küçük olmalı.`);
          satir[t] = h[t];
          satir[d] = v;
        }
        gonder.push(satir);
      }
      doldur(await KurKaynakService.komisyonKaydet(gonder));
      return true;
    },
  }));

  if (yukleniyor) return <div className="text-center py-3"><Spinner size="sm" /></div>;
  if (hata) return <div className="text-danger small">{hata}</div>;

  const ara = arama.trim().toLocaleUpperCase("tr-TR");
  const gorunen = ara ? satirlar.filter((s) => `${s.kod} ${s.ad}`.toLocaleUpperCase("tr-TR").includes(ara)) : satirlar;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div className="small text-secondary">
          Eksi koymanıza gerek yok: alış komisyonları alış fiyatından düşülür, satış komisyonları satış fiyatına eklenir.
        </div>
        <Form.Control size="sm" placeholder="Birim ara" value={arama} onChange={(e) => setArama(e.target.value)} style={{ maxWidth: 160 }} />
      </div>
      <div className="border rounded-2" style={{ maxHeight: 420, overflow: "auto" }}>
        <style>{`.kur-komisyon-tablosu > :not(caption) > * > * { padding-left: 3px; padding-right: 3px; }`}</style>
        <Table size="sm" className="mb-0 align-middle kur-komisyon-tablosu" style={{ fontSize: 13, minWidth: 700 }}>
          <thead className="sticky-top" style={{ background: "var(--bs-body-bg, #fff)", zIndex: 1 }}>
            <tr>
              <th style={{ width: 50 }}>Kod</th>
              <th>Ad</th>
              {KOLONLAR.map(([, , baslik]) => (
                <th key={baslik} colSpan={2} className="text-center text-nowrap">{baslik}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gorunen.map((s) => (
              <tr key={s.paraId}>
                <td className="fw-semibold">{s.kod}</td>
                <td className="text-truncate" style={{ maxWidth: 100 }} title={s.ad}>{s.ad}</td>
                {KOLONLAR.map(([t, d, baslik]) => (
                  <React.Fragment key={t}>
                    <td style={{ width: 58 }}>
                      <Form.Select
                        size="sm"
                        value={hucreler[s.paraId][t]}
                        onChange={(e) => guncelle(s.paraId, t, e.target.value)}
                        style={{ width: 54, paddingRight: 18 }}
                        aria-label={`${s.kod} ${baslik} komisyon türü`}
                      >
                        <option value="Y">%</option>
                        <option value="T">TL</option>
                      </Form.Select>
                    </td>
                    <td style={{ width: 72 }}>
                      <Form.Control
                        size="sm"
                        inputMode="decimal"
                        value={hucreler[s.paraId][d]}
                        onChange={(e) => guncelle(s.paraId, d, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="font-monospace text-end"
                        style={{ width: 68 }}
                        placeholder="0"
                        aria-label={`${s.kod} ${baslik} komisyonu`}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
            {gorunen.length === 0 && (
              <tr><td colSpan={10} className="text-center text-secondary py-3">Kayıt yok</td></tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
});

KurKomisyonTablosu.displayName = "KurKomisyonTablosu";
export default KurKomisyonTablosu;
