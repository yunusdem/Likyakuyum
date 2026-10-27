import React, { useEffect, useRef, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";
import type { FisHtml } from "../../utils/belgeSablon/fisCikti";

/**
 * Şablondan çizilecek fişi (veya fişleri) yükler. `anahtar` değişince yeniden üretilir;
 * eski isteğin geç gelen yanıtı yok sayılır. `uret` her açılışta ekranın o anki verisini okumalıdır.
 */
export function useSablonluFis(acik: boolean, anahtar: string, uret: () => Promise<FisHtml | FisHtml[]>) {
  const [fis, setFis] = useState<FisHtml | FisHtml[] | null>(null);
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

/** Önizleme gövdesi: yükleniyor / hata / şablondan çizilmiş tek veya çoklu fiş. */
export const SablonluFisOnizleme: React.FC<{ fis: FisHtml | FisHtml[] | null; hata: string | null }> = ({ fis, hata }) => {
  if (hata) return <Alert variant="danger" className="mb-0 w-100">Fiş hazırlanamadı: {hata}</Alert>;
  if (!fis) return <div className="text-secondary d-flex align-items-center justify-content-center gap-2 py-5"><Spinner size="sm" /> Fiş hazırlanıyor…</div>;

  const fisler = Array.isArray(fis) ? fis : [fis];

  if (fisler.length === 1) {
    return (
      <div id="sablonlu-fis-alani" className="sablonlu-fis-alani d-flex justify-content-center w-100">
        <div
          id="sablonlu-fis-icerik"
          style={{ boxShadow: "0 4px 15px rgba(0, 0, 0, 0.35)", borderRadius: 2, background: "#fff", width: "fit-content", margin: "0 auto" }}
          dangerouslySetInnerHTML={{ __html: fisler[0].html }}
        />
      </div>
    );
  }

  // Birden fazla fiş: sayfa sayfa kaydırılabilir görünüm
  return (
    <div id="sablonlu-fis-alani" className="sablonlu-fis-alani d-flex flex-column align-items-center gap-4 py-2 w-100">
      <div className="alert alert-info py-1 px-3 mb-1 small d-flex align-items-center gap-2 shadow-xs border-0 text-center" style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}>
        <span>ℹ️ Bu işlemde <strong>{fisler.length} adet fiş</strong> bulunmaktadır. Aşağı kaydırarak tüm sayfaları inceleyebilirsiniz.</span>
      </div>
      {fisler.map((item, idx) => (
        <div key={idx} className="d-flex flex-column align-items-center w-100">
          <div className="badge bg-secondary bg-opacity-75 text-white mb-2 px-3 py-1 shadow-sm rounded-pill d-flex align-items-center gap-1.5" style={{ fontSize: "11px", letterSpacing: "0.4px" }}>
            <span>📄 {idx + 1}. Fiş (Toplam {fisler.length})</span>
            {item.baslik && <span className="opacity-75">| {item.baslik}</span>}
          </div>
          <div
            style={{
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)",
              borderRadius: 3,
              background: "#fff",
              width: "fit-content",
              margin: "0 auto",
            }}
            dangerouslySetInnerHTML={{ __html: item.html }}
          />
        </div>
      ))}
    </div>
  );
};
