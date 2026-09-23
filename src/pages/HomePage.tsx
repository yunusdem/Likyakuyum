import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { IconBuildingBank, IconCash, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { VezneIzlemeService, type VezneIzlemeDataResponse } from "../services/vezneIzlemeService";
import { EBankaService, type EBankaOzet } from "../services/ebankaService";
import { paraYaz, zamanYaz } from "./ebanka/ebankaOrtak";

// Dashboard: solda vezne, sağda banka bakiyeleri. Yalnızca bakiyesi olan birimler görünür;
// ayrıntı için asıl ekrana gidilir. Yenileme elle. Renkler kullanıcı temasından (menü başlığı) gelir.

const YESIL = "var(--user-menu-header-bg, #0b5d3b)";
const ALTIN = "#d4af37";

const STIL = `
.lk-dash { --lk-yesil: ${YESIL}; --lk-altin: ${ALTIN}; }
.lk-dash .lk-hero { background: linear-gradient(120deg, var(--lk-yesil) 0%, color-mix(in srgb, var(--lk-yesil) 70%, #000) 100%); color: #fff; border-radius: 14px; border-bottom: 3px solid var(--lk-altin); }
.lk-dash .lk-hero-btn { background: rgba(255,255,255,.12); border: 1px solid rgba(212,175,55,.6); color: #fff; border-radius: 8px; }
.lk-dash .lk-hero-btn:hover:not(:disabled) { background: rgba(212,175,55,.25); }
.lk-dash .lk-panel { background: #fff; border-radius: 14px; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 6px 20px rgba(15,23,42,.06); overflow: hidden; height: 100%; }
.lk-dash .lk-panel-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid rgba(15,23,42,.06); }
.lk-dash .lk-ikon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: var(--lk-altin); background: var(--lk-yesil); }
.lk-dash .lk-link { margin-left: auto; font-size: 12px; color: var(--lk-yesil); background: none; border: none; font-weight: 600; }
.lk-dash .lk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; padding: 16px 18px; }
.lk-dash .lk-kart { position: relative; border-radius: 12px; padding: 12px 14px; background: linear-gradient(160deg, #fffdf6 0%, #fff 60%); border: 1px solid rgba(212,175,55,.35); cursor: pointer; transition: transform .15s, box-shadow .15s; }
.lk-dash .lk-kart:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(212,175,55,.2); }
.lk-dash .lk-kart::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 3px; background: var(--lk-altin); }
.lk-dash .lk-birim { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #64748b; }
.lk-dash .lk-tutar { font-size: 20px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1.25; word-break: break-all; }
.lk-dash .lk-eksi { color: #b42318; }
.lk-dash .lk-alt { font-size: 11.5px; color: #64748b; display: flex; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
.lk-dash .lk-bos { color: #94a3b8; font-size: 13px; padding: 24px 18px; text-align: center; }
`;

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [vezne, setVezne] = useState<VezneIzlemeDataResponse | null>(null);
  const [vezneHata, setVezneHata] = useState("");
  const [banka, setBanka] = useState<EBankaOzet | null>(null);
  const [bankaHata, setBankaHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [saat, setSaat] = useState<Date | null>(null);

  const yenile = useCallback(async () => {
    setYukleniyor(true);
    await Promise.all([
      VezneIzlemeService.getIzlemeData()
        .then((v) => { setVezne(v); setVezneHata(""); })
        .catch((e) => setVezneHata(e?.message || "Vezne bakiyeleri alınamadı.")),
      EBankaService.getOzet()
        .then((o) => { setBanka(o); setBankaHata(""); })
        .catch((e) => setBankaHata(e?.message || "Banka bakiyeleri alınamadı.")),
    ]);
    setSaat(new Date());
    setYukleniyor(false);
  }, []);

  useEffect(() => { yenile(); }, [yenile]);

  const doluMu = (n: unknown) => Math.abs(Number(n) || 0) >= 0.005;
  const vezneler = vezne?.columns || [];
  const vezneSatirlari = (vezne?.rows || []).filter((r) => doluMu(r.toplam) || Object.values(r.bakiyeler || {}).some(doluMu));
  const bankaToplamlari = (banka?.toplamlar || []).filter((t) => doluMu(t.bakiye));
  const hesaplar = (banka?.hesaplar || []).filter((h) => h.aktif && doluMu(h.bakiye));

  const panelBasi = (ikon: React.ReactNode, ad: string, alt: string, yol: string) => (
    <div className="lk-panel-head">
      <div className="lk-ikon">{ikon}</div>
      <div>
        <div className="fw-bold">{ad}</div>
        <div className="text-muted" style={{ fontSize: 12 }}>{alt}</div>
      </div>
      <button type="button" className="lk-link" onClick={() => navigate(yol)}>
        Ayrıntı <IconChevronRight size={14} />
      </button>
    </div>
  );

  return (
    <div className="lk-dash w-100 pb-3">
      <style>{STIL}</style>

      <div className="lk-hero d-flex align-items-center flex-wrap gap-3 px-4 py-3 mb-3">
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".12em", color: ALTIN, fontWeight: 700 }}>GENEL DURUM</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Kasa ve Banka Bakiyeleri</div>
        </div>
        <div className="ms-auto d-flex align-items-center gap-3">
          {saat && <span style={{ fontSize: 12, opacity: 0.8 }}>Son güncelleme {saat.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button type="button" className="lk-hero-btn btn btn-sm px-3" disabled={yukleniyor} onClick={yenile}>
            {yukleniyor ? <Spinner size="sm" /> : <IconRefresh size={16} />} <span className="ms-1">Yenile</span>
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="lk-panel">
            {panelBasi(<IconCash size={20} />, "Vezne Bakiyeleri", `${vezneler.length} vezne toplamı`, "/vezne/izleme")}
            {vezneHata ? (
              <div className="lk-bos text-danger">{vezneHata}</div>
            ) : vezne && vezneSatirlari.length === 0 ? (
              <div className="lk-bos">Veznelerde bakiye yok.</div>
            ) : (
              <div className="lk-grid">
                {vezneSatirlari.map((r) => (
                  <div key={r.paraId} className="lk-kart" onClick={() => navigate("/vezne/izleme")}>
                    <div className="lk-birim">{r.paraKodu}</div>
                    <div className={`lk-tutar ${r.toplam < 0 ? "lk-eksi" : ""}`}>{paraYaz(r.toplam)}</div>
                    {vezneler
                      .filter((v) => doluMu(r.bakiyeler?.[v.vezneId]))
                      .map((v) => {
                        const m = Number(r.bakiyeler[v.vezneId]);
                        return (
                          <div key={v.vezneId} className="lk-alt">
                            <span className="text-truncate">{v.ad || v.kod}</span>
                            <span className={m < 0 ? "lk-eksi" : ""}>{paraYaz(m)}</span>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-6">
          <div className="lk-panel">
            {panelBasi(<IconBuildingBank size={20} />, "Banka Bakiyeleri", banka?.sonEsitleme ? `Bankadan son güncelleme ${zamanYaz(banka.sonEsitleme)}` : "Bankadan henüz güncellenmedi", "/ebanka/hesaplar")}
            {bankaHata ? (
              <div className="lk-bos">{bankaHata}</div>
            ) : banka && bankaToplamlari.length === 0 ? (
              <div className="lk-bos">Bakiyesi olan banka hesabı yok.</div>
            ) : (
              <div className="lk-grid">
                {bankaToplamlari.map((t) => (
                  <div key={t.doviz} className="lk-kart" onClick={() => navigate("/ebanka/hesaplar")}>
                    <div className="lk-birim">{t.doviz}</div>
                    <div className={`lk-tutar ${t.bakiye < 0 ? "lk-eksi" : ""}`}>{paraYaz(t.bakiye)}</div>
                    {hesaplar
                      .filter((h) => h.doviz === t.doviz)
                      .map((h) => (
                        <div key={h.vomsisHesapId} className="lk-alt">
                          <span className="text-truncate">{h.bankaAdi}{h.hesapNo ? ` ${h.hesapNo}` : ""}</span>
                          <span className={h.bakiye < 0 ? "lk-eksi" : ""}>{paraYaz(h.bakiye)}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
