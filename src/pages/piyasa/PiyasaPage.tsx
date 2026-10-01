import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "react-bootstrap";
import {
  IconLayoutGrid,
  IconTableColumn,
  IconSearch,
  IconX,
  IconMaximize,
  IconMinimize,
  IconPlayerPause,
  IconPlayerPlay,
  IconAdjustmentsHorizontal,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { PiyasaService, type PiyasaYaniti } from "../../services/piyasaService";
import { CompanyService } from "../../services/companyService";
import KaynakKarti from "./KaynakKarti";
import KarsilastirmaTablosu from "./KarsilastirmaTablosu";
import OzetSeridi from "./OzetSeridi";
import {
  ORTAK_KALEMLER,
  SUZGECLER,
  enIyiBul,
  kaynakGorunum,
  ortakDizinKur,
  saatYaz,
  tercihOku,
  tercihYaz,
  type EnIyi,
  type Suzgec,
} from "./piyasaBicim";
import "./piyasa.css";

type Gorunum = "kaynaklar" | "karsilastirma";

/** Saniyede bir kendini çizen saat — sayfanın geri kalanı her saniye yeniden çizilmesin diye ayrı */
const Saat: React.FC = () => {
  const [simdi, setSimdi] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setSimdi(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="pz-saat">
      <span className="pz-saat-deger">
        {simdi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span className="pz-saat-tarih">{simdi.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", weekday: "long" })}</span>
    </div>
  );
};

/** Bir sonraki yenilemeye kalan süreyi gösteren halka; her yenilemede (tur değişince) baştan başlar */
const Halka: React.FC<{ sn: number; tur: number; durdu: boolean }> = ({ sn, tur, durdu }) => (
  <svg key={tur} className={`pz-halka ${durdu ? "pz-halka-durdu" : ""}`} viewBox="0 0 36 36" aria-hidden>
    <circle className="pz-halka-iz" cx="18" cy="18" r="15.5" />
    <circle className="pz-halka-dolgu" cx="18" cy="18" r="15.5" style={{ animationDuration: `${sn}s` }} />
  </svg>
);

const PiyasaPage: React.FC = () => {
  const kokRef = useRef<HTMLDivElement>(null);
  const [veri, setVeri] = useState<PiyasaYaniti | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonYenileme, setSonYenileme] = useState<string | null>(null);
  const [tazelemeSn, setTazelemeSn] = useState(5);
  const [tur, setTur] = useState(0);
  const [durdu, setDurdu] = useState(false);
  const [parlat, setParlat] = useState(false);
  const [tamEkran, setTamEkran] = useState(false);

  const [gorunum, setGorunum] = useState<Gorunum>(() => tercihOku("gorunum", "kaynaklar"));
  const [suzgec, setSuzgec] = useState<Suzgec>(() => tercihOku("suzgec", "tumu"));
  const [gizli, setGizli] = useState<string[]>(() => tercihOku("gizli", []));
  const [referansKod, setReferansKod] = useState<string>(() => tercihOku("referans", "harem"));
  const [buyuk, setBuyuk] = useState<string | null>(null);
  const [arama, setArama] = useState("");

  useEffect(() => tercihYaz("gorunum", gorunum), [gorunum]);
  useEffect(() => tercihYaz("suzgec", suzgec), [suzgec]);
  useEffect(() => tercihYaz("gizli", gizli), [gizli]);
  useEffect(() => tercihYaz("referans", referansKod), [referansKod]);

  // Yenileme süresi: Firma Tanımları › Sistem › Tazeleme Süresi (Sn) — Vezne İzleme ile ortak alan
  useEffect(() => {
    CompanyService.getDefinitions()
      .then((t) => {
        const sn = Number(t?.TAZELEME_SURESI);
        if (Number.isFinite(sn) && sn > 0) setTazelemeSn(sn);
      })
      .catch(() => {
        /* tanım okunamazsa 5 sn ile devam */
      });
  }, []);

  const yukle = useCallback(async () => {
    try {
      const v = await PiyasaService.anlik();
      setVeri(v);
      setHata(null);
      setSonYenileme(new Date().toISOString());
    } catch (e: any) {
      setHata(e?.message || "Piyasa verisi alınamadı");
    }
  }, []);

  // Yoklama döngüsü: istek bitince bekler (üst üste binmez); sekme arka plandayken durur
  useEffect(() => {
    if (durdu) return;
    let iptal = false;
    let zamanlayici = 0;
    const dongu = async () => {
      if (iptal) return;
      if (document.hidden) {
        zamanlayici = window.setTimeout(dongu, 1000);
        return;
      }
      await yukle();
      if (iptal) return;
      setTur((t) => t + 1);
      zamanlayici = window.setTimeout(dongu, tazelemeSn * 1000);
    };
    void dongu();
    return () => {
      iptal = true;
      window.clearTimeout(zamanlayici);
    };
  }, [tazelemeSn, durdu, yukle]);

  // İlk veri çizildikten sonra değişimler parlasın
  useEffect(() => {
    if (veri && !parlat) {
      const t = window.setTimeout(() => setParlat(true), 400);
      return () => window.clearTimeout(t);
    }
  }, [veri, parlat]);

  useEffect(() => {
    const degisti = () => setTamEkran(document.fullscreenElement === kokRef.current);
    document.addEventListener("fullscreenchange", degisti);
    return () => document.removeEventListener("fullscreenchange", degisti);
  }, []);

  const tamEkranDegistir = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void kokRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const tumKaynaklar = veri?.kaynaklar ?? [];
  const gorunenler = useMemo(() => tumKaynaklar.filter((k) => !gizli.includes(k.kod)), [tumKaynaklar, gizli]);
  const dizin = useMemo(() => ortakDizinKur(gorunenler), [gorunenler]);
  const enIyiler = useMemo(() => {
    const kodlar = gorunenler.map((k) => k.kod);
    const m = new Map<string, EnIyi>();
    for (const k of ORTAK_KALEMLER) m.set(k.kod, enIyiBul(dizin, kodlar, k.kod));
    return m;
  }, [dizin, gorunenler]);

  const referans =
    gorunenler.find((k) => k.kod === referansKod && k.gruplar.length) ??
    gorunenler.find((k) => k.durum === "canli" && k.gruplar.length) ??
    gorunenler[0];
  const canliSayisi = tumKaynaklar.filter((k) => k.durum === "canli").length;

  const gizleDegistir = (kod: string) => setGizli((g) => (g.includes(kod) ? g.filter((x) => x !== kod) : [...g, kod]));

  return (
    <div ref={kokRef} className={`pz ${tamEkran ? "pz-tam-ekran" : ""}`}>
      {/* ÜST PANO */}
      <div className="pz-pano">
        <div className="pz-pano-ust">
          <div className="pz-baslik">
            <span className="pz-ust-yazi">Canlı Piyasa</span>
            <h1 className="pz-baslik-yazi">Altın &amp; Döviz Panosu</h1>
            <div className="pz-baslik-meta">
              <span className={`pz-canli-rozet ${!veri ? "pz-canli-bekliyor" : canliSayisi ? "" : "pz-canli-yok"}`}>
                <span className="pz-nokta" />
                {veri ? `${canliSayisi}/${tumKaynaklar.length} kaynak canlı` : "Bağlanıyor"}
              </span>
              <span className="pz-ayrac-nokta" />
              <span>{tazelemeSn} sn'de bir yenilenir</span>
              {sonYenileme && (
                <>
                  <span className="pz-ayrac-nokta" />
                  <span>Son: {saatYaz(sonYenileme)}</span>
                </>
              )}
            </div>
          </div>

          <div className="pz-pano-sag">
            <label className="pz-referans" title="Üstteki büyük rakamların alındığı kaynak">
              <span>Referans</span>
              <select value={referans?.kod ?? referansKod} onChange={(e) => setReferansKod(e.target.value)}>
                {gorunenler.map((k) => (
                  <option key={k.kod} value={k.kod}>
                    {k.ad}
                  </option>
                ))}
              </select>
            </label>
            <Saat />
            <button
              type="button"
              className="pz-pano-dugme pz-yenile"
              onClick={() => setDurdu((d) => !d)}
              title={durdu ? "Yenilemeyi başlat" : `Yenilemeyi duraklat (${tazelemeSn} sn)`}
            >
              <Halka sn={tazelemeSn} tur={tur} durdu={durdu} />
              {durdu ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
            </button>
            <button type="button" className="pz-pano-dugme" onClick={tamEkranDegistir} title={tamEkran ? "Tam ekrandan çık" : "Tam ekran"}>
              {tamEkran ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </button>
          </div>
        </div>

        <OzetSeridi referans={referans} dizin={dizin} enIyiler={enIyiler} parlat={parlat} />
      </div>

      {/* ARAÇ ÇUBUĞU */}
      <div className="pz-arac">
        <div className="pz-bolumlu" role="tablist" aria-label="Görünüm">
          <button type="button" role="tab" aria-selected={gorunum === "kaynaklar"} className={gorunum === "kaynaklar" ? "aktif" : ""} onClick={() => setGorunum("kaynaklar")}>
            <IconLayoutGrid size={15} /> Kaynaklar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={gorunum === "karsilastirma"}
            className={gorunum === "karsilastirma" ? "aktif" : ""}
            onClick={() => setGorunum("karsilastirma")}
          >
            <IconTableColumn size={15} /> Karşılaştırma
          </button>
        </div>

        <div className="pz-cipler" role="group" aria-label="Grup süzgeci">
          {SUZGECLER.map((s) => (
            <button key={s.kod} type="button" className={`pz-cip ${suzgec === s.kod ? "aktif" : ""}`} onClick={() => setSuzgec(s.kod)}>
              {s.ad}
            </button>
          ))}
        </div>

        <div className="pz-arac-sag">
          <div className="pz-arama">
            <IconSearch size={15} />
            <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Kalem ara (çeyrek, usd…)" aria-label="Kalem ara" />
            {arama && (
              <button type="button" onClick={() => setArama("")} aria-label="Aramayı temizle">
                <IconX size={14} />
              </button>
            )}
          </div>

          <Dropdown align="end" autoClose="outside">
            <Dropdown.Toggle as="button" type="button" className="pz-kaynak-menu-dugme" id="pz-kaynak-menu">
              <IconAdjustmentsHorizontal size={15} />
              Kaynaklar
              {tumKaynaklar.length > 0 && (
                <span className="pz-kaynak-menu-sayi">
                  {gorunenler.length}/{tumKaynaklar.length}
                </span>
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu className="pz-kaynak-menu shadow-lg">
              {tumKaynaklar.map((k) => {
                const gor = kaynakGorunum(k.kod, k.ad);
                const acik = !gizli.includes(k.kod);
                return (
                  <button key={k.kod} type="button" className="pz-kaynak-menu-oge" onClick={() => gizleDegistir(k.kod)}>
                    <span className={`pz-onay ${acik ? "acik" : ""}`}>{acik && <IconCheck size={12} strokeWidth={3} />}</span>
                    <span className="pz-monogram pz-monogram-kucuk" style={{ "--pz-kaynak": gor.renk } as React.CSSProperties}>
                      {gor.kisa}
                    </span>
                    <span className="pz-kaynak-menu-ad">{k.ad}</span>
                    <span className={`pz-nokta pz-nokta-${k.durum}`} />
                  </button>
                );
              })}
              {gizli.length > 0 && (
                <button type="button" className="pz-kaynak-menu-hepsi" onClick={() => setGizli([])}>
                  Hepsini göster
                </button>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {hata && (
        <div className="pz-hata">
          <IconAlertTriangle size={16} />
          <span>
            {hata}
            {veri ? " — son alınan fiyatlar gösteriliyor, yeniden deneniyor." : ""}
          </span>
        </div>
      )}

      {/* İÇERİK */}
      {!veri && !hata ? (
        <div className="pz-izgara">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="pz-kart pz-kart-iskelet">
              <div className="pz-iskelet">
                {Array.from({ length: 10 }).map((__, j) => (
                  <span key={j} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : gorunenler.length === 0 && veri ? (
        <div className="pz-bos pz-bos-genis">
          Tüm kaynaklar gizli.
          <button type="button" className="pz-cip aktif" onClick={() => setGizli([])}>
            Hepsini göster
          </button>
        </div>
      ) : gorunum === "kaynaklar" ? (
        <div className="pz-izgara">
          {gorunenler.map((k) => (
            <KaynakKarti
              key={k.kod}
              kaynak={k}
              suzgec={suzgec}
              arama={arama}
              enIyiler={enIyiler}
              parlat={parlat}
              buyuk={buyuk === k.kod}
              onBuyut={() => setBuyuk((b) => (b === k.kod ? null : k.kod))}
              onGizle={() => gizleDegistir(k.kod)}
            />
          ))}
        </div>
      ) : (
        <KarsilastirmaTablosu kaynaklar={gorunenler} dizin={dizin} enIyiler={enIyiler} suzgec={suzgec} arama={arama} parlat={parlat} />
      )}
    </div>
  );
};

export default PiyasaPage;
