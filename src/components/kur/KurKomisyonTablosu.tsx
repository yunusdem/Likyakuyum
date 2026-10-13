import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Form, Spinner, Table } from "react-bootstrap";
import { KurKaynakService, type KomisyonTuru, type KurKomisyonSatiri } from "../../services/kurKaynakService";

/**
 * Firma Tanımları › Kur Kaynağı: birim bazında alış/satış komisyonu (docs/KUR_KAYNAGI_YOL_HARITASI.md, K10–K13).
 * Kullanıcı eksi yazmaz; alış komisyonu alıştan düşülür, satış komisyonu satışa eklenir. Kayıt sayfanın Kaydet düğmesiyle.
 */

export interface KurKomisyonTablosuRef {
  /** Değişiklik varsa kaydeder; değişiklik yoksa hiçbir şey yapmaz */
  kaydet: () => Promise<boolean>;
}

type Hucre = { alisTur: KomisyonTuru; alis: string; satisTur: KomisyonTuru; satis: string };

const metin = (v: number) => (v ? String(v).replace(".", ",") : "");
const sayi = (v: string) => {
  // Virgül varsa ondalık odur (noktalar binliktir); yoksa nokta ondalık sayılır (0.005)
  const s = v.trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.abs(n) : NaN;
};
/** Rakam ve tek ondalık ayırıcı; eksi işareti kabul edilmez */
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
    for (const s of liste) h[s.paraId] = { alisTur: s.alisTur, alis: metin(s.alisDeger), satisTur: s.satisTur, satis: metin(s.satisDeger) };
    setHucreler(h);
    setDegisti(false);
  }, []);

  useEffect(() => {
    KurKaynakService.komisyonlar()
      .then(doldur)
      .catch((e) => setHata(e?.message || "Komisyonlar yüklenemedi."))
      .finally(() => setYukleniyor(false));
  }, [doldur]);

  const guncelle = (paraId: number, alan: keyof Hucre, deger: string) => {
    setHucreler((p) => ({ ...p, [paraId]: { ...p[paraId], [alan]: alan === "alis" || alan === "satis" ? temizle(deger) : deger } }));
    setDegisti(true);
  };

  useImperativeHandle(ref, () => ({
    kaydet: async () => {
      if (!degisti) return false;
      const gonder: KurKomisyonSatiri[] = [];
      for (const s of satirlar) {
        const h = hucreler[s.paraId];
        const alis = h.alis ? sayi(h.alis) : 0;
        const satis = h.satis ? sayi(h.satis) : 0;
        if (Number.isNaN(alis) || Number.isNaN(satis)) throw new Error(`${s.kod} komisyonu sayı değil.`);
        if ((h.alisTur === "Y" && alis >= 100) || (h.satisTur === "Y" && satis >= 100)) throw new Error(`${s.kod} yüzde komisyonu 100'den küçük olmalı.`);
        gonder.push({ ...s, alisTur: h.alisTur, alisDeger: alis, satisTur: h.satisTur, satisDeger: satis });
      }
      doldur(await KurKaynakService.komisyonKaydet(gonder));
      return true;
    },
  }));

  if (yukleniyor) return <div className="text-center py-3"><Spinner size="sm" /></div>;
  if (hata) return <div className="text-danger small">{hata}</div>;

  const ara = arama.trim().toLocaleUpperCase("tr-TR");
  const gorunen = ara ? satirlar.filter((s) => `${s.kod} ${s.ad}`.toLocaleUpperCase("tr-TR").includes(ara)) : satirlar;

  const turSecici = (paraId: number, alan: "alisTur" | "satisTur") => (
    <Form.Select
      size="sm"
      value={hucreler[paraId][alan]}
      onChange={(e) => guncelle(paraId, alan, e.target.value)}
      style={{ width: 62 }}
      aria-label="Komisyon türü"
    >
      <option value="Y">%</option>
      <option value="T">TL</option>
    </Form.Select>
  );

  const degerKutusu = (paraId: number, alan: "alis" | "satis") => (
    <Form.Control
      size="sm"
      inputMode="decimal"
      value={hucreler[paraId][alan]}
      onChange={(e) => guncelle(paraId, alan, e.target.value)}
      onFocus={(e) => e.target.select()}
      className="font-monospace text-end"
      style={{ width: 96 }}
      placeholder="0"
    />
  );

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div className="small text-secondary">
          Eksi koymanıza gerek yok: alış komisyonu alış fiyatından düşülür, satış komisyonu satış fiyatına eklenir.
        </div>
        <Form.Control size="sm" placeholder="Birim ara" value={arama} onChange={(e) => setArama(e.target.value)} style={{ maxWidth: 160 }} />
      </div>
      <div className="border rounded-2" style={{ maxHeight: 420, overflowY: "auto" }}>
        <Table size="sm" className="mb-0 align-middle" style={{ fontSize: 13 }}>
          <thead className="sticky-top" style={{ background: "var(--bs-body-bg, #fff)" }}>
            <tr>
              <th style={{ width: 70 }}>Kod</th>
              <th>Ad</th>
              <th colSpan={2} className="text-center">Alış komisyonu</th>
              <th colSpan={2} className="text-center">Satış komisyonu</th>
            </tr>
          </thead>
          <tbody>
            {gorunen.map((s) => (
              <tr key={s.paraId}>
                <td className="fw-semibold">{s.kod}</td>
                <td className="text-truncate" style={{ maxWidth: 200 }}>{s.ad}</td>
                <td style={{ width: 70 }}>{turSecici(s.paraId, "alisTur")}</td>
                <td style={{ width: 104 }}>{degerKutusu(s.paraId, "alis")}</td>
                <td style={{ width: 70 }}>{turSecici(s.paraId, "satisTur")}</td>
                <td style={{ width: 104 }}>{degerKutusu(s.paraId, "satis")}</td>
              </tr>
            ))}
            {gorunen.length === 0 && (
              <tr><td colSpan={6} className="text-center text-secondary py-3">Kayıt yok</td></tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
});

KurKomisyonTablosu.displayName = "KurKomisyonTablosu";
export default KurKomisyonTablosu;
