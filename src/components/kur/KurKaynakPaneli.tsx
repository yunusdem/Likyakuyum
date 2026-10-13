import React, { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { KurKaynakService, type KurKaynakBilgi } from "../../services/kurKaynakService";

/**
 * Anlık Fiyat Listesi'nin solundaki kaynak listesi (docs/KUR_KAYNAGI_YOL_HARITASI.md, K1, K9).
 * Basılan kaynaktan kur çekilir. Kopuk kaynağa basılamaz. Durumlar 15 sn'de bir yenilenir
 * (bu yoklama piyasa bağlantılarını da açık tutar).
 */

const YOKLAMA_MS = 15_000;

interface Props {
  secili: string;
  yukleniyor: boolean;
  /** İlk yüklemede firmada kayıtlı seçili kaynak */
  onKayitliSecili: (kod: string, ad: string) => void;
  onSec: (kod: string, ad: string) => void;
}

const NOKTA: Record<KurKaynakBilgi["durum"], { renk: string; yazi: string }> = {
  canli: { renk: "#16a34a", yazi: "Bağlı" },
  bekliyor: { renk: "#d97706", yazi: "Bağlanıyor" },
  kopuk: { renk: "#dc2626", yazi: "Bağlantı yok" },
};

const KurKaynakPaneli: React.FC<Props> = ({ secili, yukleniyor, onKayitliSecili, onSec }) => {
  const [kaynaklar, setKaynaklar] = useState<KurKaynakBilgi[]>([]);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let ilk = true;
    let iptal = false;
    const yukle = () =>
      KurKaynakService.kaynaklar()
        .then((r) => {
          if (iptal) return;
          setKaynaklar(r.kaynaklar);
          setHata(null);
          if (ilk) {
            ilk = false;
            const k = r.kaynaklar.find((x) => x.kod === r.secili);
            onKayitliSecili(r.secili, k?.ad ?? "Merkez Bankası");
          }
        })
        .catch((e) => !iptal && setHata(e?.message || "Kaynaklar alınamadı."));
    yukle();
    const t = setInterval(yukle, YOKLAMA_MS);
    return () => {
      iptal = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="kur-kaynak-paneli">
      <style>{`
        .kur-kaynak-paneli {
          flex: 0 0 170px;
          border-right: 1px solid var(--bs-border-color, #dee2e6);
          background: linear-gradient(180deg, #f8fafc 0%, #eef5fc 100%);
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .kur-kaynak-paneli .kkp-baslik {
          font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
          color: #64748b; padding: 10px 12px 6px;
        }
        .kur-kaynak-paneli .kkp-liste { display: flex; flex-direction: column; gap: 2px; padding: 0 6px 8px; }
        .kur-kaynak-paneli .kkp-oge {
          display: flex; align-items: center; gap: 8px; width: 100%;
          border: 1px solid transparent; border-radius: 6px; background: transparent;
          padding: 7px 8px; font-size: 13px; font-weight: 600; color: #1e293b; text-align: left;
          cursor: pointer; white-space: nowrap;
        }
        .kur-kaynak-paneli .kkp-oge:hover:not(:disabled) { background: #e0f2fe; }
        .kur-kaynak-paneli .kkp-oge.secili { background: #bae6fd; border-color: #7dd3fc; color: #0c4a6e; }
        .kur-kaynak-paneli .kkp-oge:disabled { cursor: not-allowed; color: #94a3b8; }
        .kur-kaynak-paneli .kkp-nokta { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }
        .kur-kaynak-paneli .kkp-ad { overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; }
        @media (max-width: 767.98px) {
          .kur-kaynak-paneli { flex: 0 0 auto; border-right: 0; border-bottom: 1px solid var(--bs-border-color, #dee2e6); }
          .kur-kaynak-paneli .kkp-baslik { display: none; }
          .kur-kaynak-paneli .kkp-liste { flex-direction: row; overflow-x: auto; padding: 6px; }
          .kur-kaynak-paneli .kkp-oge { width: auto; }
        }
      `}</style>
      <div className="kkp-baslik">Kur kaynağı</div>
      <div className="kkp-liste" role="listbox" aria-label="Kur kaynağı">
        {kaynaklar.length === 0 && !hata && (
          <div className="text-center py-2"><Spinner size="sm" /></div>
        )}
        {hata && <div className="small text-danger px-2">{hata}</div>}
        {kaynaklar.map((k) => {
          const n = NOKTA[k.durum];
          const sec = k.kod === secili;
          return (
            <button
              key={k.kod}
              type="button"
              role="option"
              aria-selected={sec}
              className={`kkp-oge${sec ? " secili" : ""}`}
              disabled={k.durum === "kopuk" || yukleniyor}
              onClick={() => onSec(k.kod, k.ad)}
              title={`${k.ad} · ${n.yazi}`}
            >
              <span className="kkp-nokta" style={{ background: n.renk }} />
              <span className="kkp-ad">{k.ad}</span>
              {sec && yukleniyor && <Spinner size="sm" style={{ width: 12, height: 12 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default KurKaynakPaneli;
