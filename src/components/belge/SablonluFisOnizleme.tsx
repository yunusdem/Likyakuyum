import React, { useEffect, useRef, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";
import type { FisHtml } from "../../utils/belgeSablon/fisCikti";

/**
 * Şablondan çizilecek fişi yükler. `anahtar` değişince (pencere açılışı, 80 mm / A4 seçimi) yeniden üretilir;
 * eski isteğin geç gelen yanıtı yok sayılır. `uret` her açılışta ekranın o anki verisini okumalıdır.
 */
export function useSablonluFis(acik: boolean, anahtar: string, uret: () => Promise<FisHtml>) {
  const [fis, setFis] = useState<FisHtml | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const no = useRef(0);
  const uretRef = useRef(uret);
  uretRef.current = uret;
  useEffect(() => {
    if (!acik) { no.current++; setFis(null); setHata(null); return; }
    const benim = ++no.current;
    setFis(null); setHata(null);
    uretRef.current()
      .then((f) => { if (benim === no.current) setFis(f); })
      .catch((e: any) => { if (benim === no.current) setHata(e?.message || "Fiş hazırlanamadı."); });
  }, [acik, anahtar]);
  return { fis, hata };
}

/** Önizleme gövdesi: yükleniyor / hata / şablondan çizilmiş fiş. */
export const SablonluFisOnizleme: React.FC<{ fis: FisHtml | null; hata: string | null }> = ({ fis, hata }) => {
  if (hata) return <Alert variant="danger" className="mb-0 w-100">Fiş hazırlanamadı: {hata}</Alert>;
  if (!fis) return <div className="text-secondary d-flex align-items-center gap-2 py-5"><Spinner size="sm" /> Fiş hazırlanıyor…</div>;
  return (
    // fit-content + otomatik kenar: pencereden geniş A4 sayfa da sola kaymadan kaydırılabilir kalır
    <div style={{ boxShadow: "0 4px 15px rgba(0, 0, 0, 0.35)", borderRadius: 2, background: "#fff", width: "fit-content", margin: "0 auto" }}
      dangerouslySetInnerHTML={{ __html: fis.html }} />
  );
};
