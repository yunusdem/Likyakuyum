import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Button } from "react-bootstrap";
import { IconArrowsMove } from "@tabler/icons-react";
import { girisSirasiAc, girisSirasiService, yerlesimAnahtari } from "../../services/girisSirasiService";
import {
  Bolum,
  YERLESIM_OLAYI,
  bolumSirasi,
  bolumleriBul,
  yerlesimUygula,
  yerlesimiTemizle,
} from "../../services/yerlesimService";
import { listedeTasi, yolEkranAdi } from "../../utils/girisSirasi";

/**
 * Sürükle-bırak yerleşim (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, 4b): App'te bir kez bağlıdır.
 * 1) Kullanıcının kayıtlı yerleşimini açık sayfaya uygular (sayfa yeniden çizildikçe tekrar).
 * 2) "Yerleşimi Düzenle" ile kutuların üstüne tutamaç koyar; kutu kendi bölümü içinde sürüklenip bırakılır.
 * Sayfanın kodu ve React'in DOM'u değişmez; yalnız CSS sırası.
 */

type Tutamac = { bolum: HTMLElement; ad: string; etiket: string; x: number; y: number; w: number; h: number };

const sayfaEkranlari = (): string[] => {
  const adlar = Array.from(document.querySelectorAll<HTMLElement>("[data-ekran]")).map((e) => e.dataset.ekran || "").filter(Boolean);
  if (document.querySelector("[data-sayfa-icerik]")) adlar.push(yolEkranAdi(window.location.pathname));
  return Array.from(new Set(adlar));
};

const YerlesimDuzenleyici: React.FC = () => {
  const location = useLocation();
  const [ekran, setEkran] = useState<string | null>(null);
  const [tutamaclar, setTutamaclar] = useState<Tutamac[]>([]);
  const [surukle, setSurukle] = useState<{ bolum: HTMLElement; ad: string; hedef: string | null; x: number; y: number } | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  // Düzenlenen sıra: bölüm → kutu adları (görünür sırayla)
  const taslak = useRef(new Map<HTMLElement, string[]>());
  const bolumler = useRef<Bolum[]>([]);
  const duzenleniyor = useRef<string | null>(null);

  // --- 1) Kayıtlı yerleşimi uygula (düzenleme sırasında taslak uygulanır)
  useEffect(() => {
    let zamanlayici: number | undefined;
    const uygula = () => {
      window.clearTimeout(zamanlayici);
      zamanlayici = window.setTimeout(() => {
        for (const e of sayfaEkranlari()) {
          if (e === duzenleniyor.current) yerlesimUygula(e, duzlestir());
          else yerlesimUygula(e);
        }
      }, 120);
    };
    void girisSirasiService.hazirla().then(uygula);
    uygula();
    const gozcu = new MutationObserver(uygula);
    gozcu.observe(document.body, { childList: true, subtree: true });
    const birak = girisSirasiService.dinle(uygula);
    return () => {
      gozcu.disconnect();
      birak();
      window.clearTimeout(zamanlayici);
    };
  }, [location.pathname]);

  // Sayfa değişince düzenleme kapanır
  useEffect(() => {
    if (duzenleniyor.current) bitir(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const duzlestir = (): string[] => bolumler.current.flatMap((b) => taslak.current.get(b.el) || b.birimler.map((x) => x.ad));

  const tara = useCallback((e: string) => {
    bolumler.current = bolumleriBul(e);
    for (const b of bolumler.current) if (!taslak.current.has(b.el)) taslak.current.set(b.el, bolumSirasi(b));
  }, []);

  const olcum = useCallback(() => {
    const t: Tutamac[] = [];
    for (const b of bolumler.current) {
      for (const x of b.birimler) {
        const r = x.kutu.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        t.push({ bolum: b.el, ad: x.ad, etiket: x.etiket, x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    setTutamaclar(t);
  }, []);

  // --- 2) Düzenleme kipi
  useEffect(() => {
    const ac = (ev: Event) => {
      const e = (ev as CustomEvent<{ ekran: string }>).detail?.ekran;
      if (!e) return;
      taslak.current = new Map();
      duzenleniyor.current = e;
      tara(e);
      if (!bolumler.current.length) {
        duzenleniyor.current = null;
        setMesaj("Bu ekranda yeri değiştirilebilen kutu yok.");
        window.setTimeout(() => setMesaj(null), 3000);
        return;
      }
      setMesaj(null);
      setEkran(e);
      olcum();
    };
    window.addEventListener(YERLESIM_OLAYI, ac);
    return () => window.removeEventListener(YERLESIM_OLAYI, ac);
  }, [tara, olcum]);

  // Düzenlerken: kaydırma / sekme değişimi / yeniden çizimde tutamaçlar yerini bulur
  useEffect(() => {
    if (!ekran) return;
    let istek = 0;
    let son = 0;
    const dongu = (t: number) => {
      if (t - son > 400) {
        tara(ekran);
        son = t;
      }
      olcum();
      istek = requestAnimationFrame(dongu);
    };
    istek = requestAnimationFrame(dongu);
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") bitir(false);
    };
    window.addEventListener("keydown", tus, true);
    return () => {
      cancelAnimationFrame(istek);
      window.removeEventListener("keydown", tus, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ekran]);

  const bitir = (kaydedildi: boolean) => {
    const e = duzenleniyor.current;
    duzenleniyor.current = null;
    setEkran(null);
    setSurukle(null);
    setTutamaclar([]);
    if (e && !kaydedildi) yerlesimUygula(e); // vazgeç: kayıtlı yerleşime dön
  };

  const kaydet = async () => {
    if (!ekran) return;
    setKaydediliyor(true);
    try {
      await girisSirasiService.kaydet(yerlesimAnahtari(ekran), duzlestir().map((alan) => ({ alan, atla: false })));
      bitir(true);
    } catch (e: any) {
      setMesaj(e?.message || "Yerleşim kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const varsayilan = async () => {
    if (!ekran) return;
    setKaydediliyor(true);
    try {
      await girisSirasiService.sifirla(yerlesimAnahtari(ekran));
      yerlesimiTemizle(ekran);
      taslak.current = new Map();
      bitir(true);
    } catch (e: any) {
      setMesaj(e?.message || "Varsayılana dönülemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  // Sürükleme: kutu yalnız kendi bölümündeki bir kutunun üstüne bırakılırsa taşınır; başka yere bırakılırsa yerinde kalır
  const hedefBul = (bolum: HTMLElement, x: number, y: number): string | null =>
    tutamaclar.find((t) => t.bolum === bolum && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h)?.ad ?? null;

  const birak = () => {
    if (!surukle || !ekran) return setSurukle(null);
    const liste = taslak.current.get(surukle.bolum);
    if (liste && surukle.hedef && surukle.hedef !== surukle.ad) {
      taslak.current.set(surukle.bolum, listedeTasi(liste, liste.indexOf(surukle.ad), liste.indexOf(surukle.hedef)));
      yerlesimUygula(ekran, duzlestir());
    }
    setSurukle(null);
  };

  const tabloVar = !!ekran && !!document.querySelector("[data-sayfa-icerik] td input, [data-sayfa-icerik] td select, [data-ekran] td input");

  return createPortal(
    <>
      {mesaj && !ekran && (
        <div className="position-fixed top-0 start-50 translate-middle-x mt-3 alert alert-secondary py-2 px-3 small shadow" style={{ zIndex: 1080 }}>
          {mesaj}
        </div>
      )}
      {ekran && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1060, pointerEvents: surukle ? "auto" : "none", cursor: surukle ? "grabbing" : undefined }}
          onPointerMove={(e) => surukle && setSurukle({ ...surukle, x: e.clientX, y: e.clientY, hedef: hedefBul(surukle.bolum, e.clientX, e.clientY) })}
          onPointerUp={birak}
        >
          {tutamaclar.map((t) => {
            const kaynak = surukle?.bolum === t.bolum && surukle.ad === t.ad;
            const hedef = surukle?.bolum === t.bolum && surukle.hedef === t.ad && !kaynak;
            const soluk = surukle && surukle.bolum !== t.bolum;
            return (
              <div
                key={`${t.ad}`}
                title={`${t.etiket} — sürükleyip aynı bölümdeki başka bir kutunun üstüne bırakın`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSurukle({ bolum: t.bolum, ad: t.ad, hedef: t.ad, x: e.clientX, y: e.clientY });
                }}
                style={{
                  position: "fixed",
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  height: t.h,
                  pointerEvents: "auto",
                  cursor: surukle ? "grabbing" : "grab",
                  border: `2px ${hedef ? "solid" : "dashed"} ${hedef ? "#16a34a" : kaynak ? "#2563eb" : "#94a3b8"}`,
                  background: hedef ? "rgba(22,163,74,.15)" : kaynak ? "rgba(37,99,235,.15)" : "rgba(148,163,184,.08)",
                  borderRadius: 6,
                  opacity: soluk ? 0.35 : 1,
                  touchAction: "none",
                }}
              />
            );
          })}
          {surukle && (
            <div
              className="badge bg-primary shadow"
              style={{ position: "fixed", left: surukle.x + 12, top: surukle.y + 12, pointerEvents: "none" }}
            >
              {tutamaclar.find((t) => t.bolum === surukle.bolum && t.ad === surukle.ad)?.etiket}
            </div>
          )}
          <div
            className="d-flex align-items-center gap-2 bg-white border rounded-3 shadow px-3 py-2 small text-nowrap"
            style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", zIndex: 1061, maxWidth: "calc(100vw - 24px)", overflowX: "auto" }}
          >
            <IconArrowsMove size={16} className="text-primary flex-shrink-0" />
            <span className="fw-semibold">Yerleşimi düzenle</span>
            <span className="text-muted d-none d-lg-inline">— kutuyu sürükleyip aynı bölümdeki başka kutunun üstüne bırakın</span>
            {mesaj && <span className="text-danger ms-2">{mesaj}</span>}
            {tabloVar && (
              <Button
                size="sm"
                variant="outline-secondary"
                className="ms-2"
                onClick={() => {
                  if (!ekran) return;
                  const kayitli = (girisSirasiService.kayit(yerlesimAnahtari(ekran)) || []).map((k) => k.alan);
                  const degisti = bolumler.current.some((b) => {
                    const t = taslak.current.get(b.el) || [];
                    const k = kayitli.filter((a) => t.includes(a));
                    return k.length ? k.join() !== t.join() : t.join() !== b.birimler.map((x) => x.ad).join();
                  });
                  if (degisti && !window.confirm("Kaydedilmemiş yerleşim değişiklikleri kaybolacak. Devam edilsin mi?")) return;
                  bitir(false);
                  girisSirasiAc(ekran);
                }}
              >
                Tablo Satırı Sırası…
              </Button>
            )}
            <Button size="sm" variant="outline-secondary" className="ms-2" disabled={kaydediliyor} onClick={varsayilan}>
              Varsayılana Dön
            </Button>
            <Button size="sm" variant="secondary" disabled={kaydediliyor} onClick={() => bitir(false)}>
              Vazgeç
            </Button>
            <Button size="sm" variant="primary" disabled={kaydediliyor} onClick={kaydet}>
              Kaydet
            </Button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default YerlesimDuzenleyici;
