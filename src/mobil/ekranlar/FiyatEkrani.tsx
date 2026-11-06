import React, { useCallback, useEffect, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";
import { istek, tl } from "../api";

/**
 * Fiyatlar (docs/MOBIL_CARI_YOL_HARITASI.md K12, K14): firmanın seçtiği ürünlerin carinin göreceği son fiyatı. Dükkân
 * panosundaki gibi Alış / Satış; 15 saniyede bir yenilenir. Ham kur ve komisyon gelmez.
 */

export interface MobilFiyat {
  urunId: number;
  kod: string;
  ad: string;
  birim: string;
  alis: number | null;
  satis: number | null;
}

const basamak = (v: number | null) => (v !== null && v >= 1000 ? 2 : v !== null && v < 10 ? 4 : 3);

const FiyatEkrani: React.FC<{ firmaId: number }> = ({ firmaId }) => {
  const [veri, setVeri] = useState<{ zaman: string | null; urunler: MobilFiyat[] } | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      setVeri(await istek<{ zaman: string | null; urunler: MobilFiyat[] }>("GET", "/fiyatlar"));
      setHata(null);
    } catch (e: any) {
      setHata(e?.message || "Fiyatlar alınamadı.");
    }
  }, []);

  useEffect(() => {
    setVeri(null);
    void yukle();
    const t = setInterval(() => void yukle(), 15_000);
    return () => clearInterval(t);
  }, [yukle, firmaId]);

  return (
    <>
      {hata && <Alert variant="warning">{hata}</Alert>}
      {!veri && !hata && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}
      {veri && (
        <div className="m-kart">
          <div className="d-flex justify-content-between align-items-baseline">
            <div className="m-baslik">Fiyatlar</div>
            <div className="small text-muted">{veri.zaman ? new Date(veri.zaman).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "UTC" }) : ""}</div>
          </div>
          {veri.urunler.length === 0 && <div className="text-muted py-3">Şu an gösterilecek fiyat yok.</div>}
          {veri.urunler.map((u) => (
            <div className="m-fiyat-satir" key={u.urunId}>
              <div className="ad">
                {u.ad}
                <span className="kod">
                  {u.kod} · {u.birim}
                </span>
              </div>
              <div className="deger alis">
                <span className="etiket">Alış</span>
                {tl(u.alis, basamak(u.alis))}
              </div>
              <div className="deger satis">
                <span className="etiket">Satış</span>
                {tl(u.satis, basamak(u.satis))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default FiyatEkrani;
