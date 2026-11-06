import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, InputGroup, Spinner, Table } from "react-bootstrap";
import { Makas, MakasTablosu, MobilYonetimService, tarihSaat } from "../../services/mobilYonetimService";
import { makasUygula } from "../../../Backend/src/services/mobil/mobilKural";
import { enterEngelle } from "./mobilOrtak";

/**
 * Cari kartı › Mobil › cariye özel makas (docs/MOBIL_CARI_YOL_HARITASI.md K13, K29). Değer > 0 cari lehine (alış artar,
 * satış düşer), < 0 aleyhine. Yönetici yazarken carinin göreceği son fiyat aynı satırda hemen hesaplanır (sunucuyla aynı
 * kural: Backend/src/services/mobil/mobilKural.ts makasUygula).
 */

const sayiYaz = (v: number | null, ondalik: number) =>
  v === null ? "-" : v.toLocaleString("tr-TR", { minimumFractionDigits: Math.min(ondalik, 4), maximumFractionDigits: ondalik });

type Taslak = { alisTip: "Y" | "T"; alisDeger: string; satisTip: "Y" | "T"; satisDeger: string };
const taslakla = (m: Makas): Taslak => ({ alisTip: m.alisTip, alisDeger: m.alisDeger ? String(m.alisDeger) : "", satisTip: m.satisTip, satisDeger: m.satisDeger ? String(m.satisDeger) : "" });
const makasla = (t: Taslak): Makas => ({
  alisTip: t.alisTip,
  alisDeger: Number(String(t.alisDeger).replace(",", ".")) || 0,
  satisTip: t.satisTip,
  satisDeger: Number(String(t.satisDeger).replace(",", ".")) || 0,
});

const CariMakasTablosu: React.FC<{ cariKartId: number }> = ({ cariKartId }) => {
  const [tablo, setTablo] = useState<MakasTablosu | null>(null);
  const [taslak, setTaslak] = useState<Record<number, Taslak>>({});
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const doldur = (t: MakasTablosu) => {
    setTablo(t);
    setTaslak(Object.fromEntries(t.satirlar.map((s) => [s.urunId, taslakla(s.makas)])));
  };

  const yukle = useCallback(async () => {
    try {
      doldur(await MobilYonetimService.cariMakas(cariKartId));
    } catch (e: any) {
      setHata(e?.message || "Makas tablosu alınamadı.");
    }
  }, [cariKartId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const kaydet = async () => {
    if (!tablo) return;
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      doldur(await MobilYonetimService.cariMakasYaz(cariKartId, tablo.satirlar.map((s) => ({ urunId: s.urunId, ...makasla(taslak[s.urunId]) }))));
      setMesaj("Cariye özel makas kaydedildi.");
    } catch (e: any) {
      setHata(e?.message || "Kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const degis = (id: number, k: keyof Taslak, v: string) => setTaslak((t) => ({ ...t, [id]: { ...t[id], [k]: v } as Taslak }));

  const tipKutusu = (id: number, k: "alisTip" | "satisTip") => (
    <Form.Select size="sm" style={{ maxWidth: 62 }} value={taslak[id]?.[k] || "Y"} onChange={(e) => degis(id, k, e.target.value)}>
      <option value="Y">%</option>
      <option value="T">TL</option>
    </Form.Select>
  );

  return (
    <Card className="mb-3">
      <Card.Header className="py-2 small fw-semibold">Bu cariye özel makas (+ cari lehine, − aleyhine)</Card.Header>
      <Card.Body className="py-2" onKeyDown={enterEngelle}>
        {hata && <Alert variant="danger" className="py-2 small">{hata}</Alert>}
        {mesaj && <Alert variant="success" className="py-2 small">{mesaj}</Alert>}
        {!tablo ? (
          <Spinner animation="border" size="sm" />
        ) : tablo.satirlar.length === 0 ? (
          <div className="small text-muted">Mobilde görünen ürün seçilmemiş (Mobil › Mobil Ayarları).</div>
        ) : (
          <>
            <div className="small text-muted mb-1">Liste fiyatı: Anlık Fiyat Listesi'nin son kaydı ({tarihSaat(tablo.zaman)}). Cari yalnız “Carinin göreceği” sütununu görür.</div>
            <Table size="sm" responsive className="small align-middle mb-2">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th className="text-end">Liste alış</th>
                  <th>Alış makası</th>
                  <th className="text-end">Liste satış</th>
                  <th>Satış makası</th>
                  <th className="text-end">Carinin göreceği (alış / satış)</th>
                </tr>
              </thead>
              <tbody>
                {tablo.satirlar.map((s) => {
                  const t = taslak[s.urunId];
                  const sonuc = t ? makasUygula(s.liste, makasla(t), tablo.ondalik) : s.sonuc;
                  const ters = sonuc.alis !== null && sonuc.satis !== null && sonuc.alis > sonuc.satis;
                  return (
                    <tr key={s.urunId}>
                      <td>
                        <span className="font-monospace">{s.kod}</span> {s.ad} <span className="text-muted">({s.birim})</span>
                      </td>
                      <td className="text-end">{sayiYaz(s.liste.alis, tablo.ondalik)}</td>
                      <td>
                        <InputGroup size="sm" style={{ maxWidth: 170 }}>
                          <Form.Control inputMode="decimal" value={t?.alisDeger ?? ""} placeholder="0" onChange={(e) => degis(s.urunId, "alisDeger", e.target.value)} />
                          {tipKutusu(s.urunId, "alisTip")}
                        </InputGroup>
                      </td>
                      <td className="text-end">{sayiYaz(s.liste.satis, tablo.ondalik)}</td>
                      <td>
                        <InputGroup size="sm" style={{ maxWidth: 170 }}>
                          <Form.Control inputMode="decimal" value={t?.satisDeger ?? ""} placeholder="0" onChange={(e) => degis(s.urunId, "satisDeger", e.target.value)} />
                          {tipKutusu(s.urunId, "satisTip")}
                        </InputGroup>
                      </td>
                      <td className={`text-end fw-semibold ${ters ? "text-danger" : ""}`} title={ters ? "Alış satıştan yüksek oldu" : undefined}>
                        {sayiYaz(sonuc.alis, tablo.ondalik)} / {sayiYaz(sonuc.satis, tablo.ondalik)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="text-end">
              <Button type="button" size="sm" disabled={mesgul} onClick={() => void kaydet()}>
                Makası kaydet
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default CariMakasTablosu;
