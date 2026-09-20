import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { adminApi, FirmaDto, ModulKaydi } from "../services/adminApi";
import { modulKatalogu } from "../../config/modulKatalogu";

/**
 * Firma Detay > Modüller sekmesi. Ağaç, kullanıcı uygulamasının sol menüsü ve üst kısayol çubuğuyla birebir aynıdır
 * (tek kaynak: src/config/modulKatalogu.ts). Sekme açılınca katalog sunucuyla eşitlenir; böylece menüye eklenen yeni
 * sayfa panelde kendiliğinden görünür (yeni sayfa, ayarı yapılmış firmalarda kapalı gelir).
 */
const FirmaModulleri: React.FC<{ firma: FirmaDto }> = ({ firma }) => {
  const [katalog, setKatalog] = useState<ModulKaydi[] | null>(null);
  const [kisitsiz, setKisitsiz] = useState(true);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [degisti, setDegisti] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kapaliGruplar, setKapaliGruplar] = useState<Set<string>>(new Set());

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const [k, ayar] = await Promise.all([adminApi.modulKatalogEsitle(modulKatalogu()), adminApi.firmaModulleri(firma.firmaId)]);
        if (iptal) return;
        setKatalog(k);
        setKisitsiz(ayar.kisitsiz);
        setAcik(new Set(ayar.kisitsiz ? k.map((m) => m.modulKodu) : ayar.acik));
      } catch (err: any) {
        if (!iptal) setHata(err?.message || "Modüller getirilemedi.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [firma.firmaId]);

  const { cocuklar, ustler } = useMemo(() => {
    const c = new Map<string | null, ModulKaydi[]>();
    const u = new Map<string, string | null>();
    for (const m of katalog || []) {
      u.set(m.modulKodu, m.ustKodu);
      c.set(m.ustKodu, [...(c.get(m.ustKodu) || []), m]);
    }
    return { cocuklar: c, ustler: u };
  }, [katalog]);

  const altSoyu = (kod: string): string[] => (cocuklar.get(kod) || []).flatMap((m) => [m.modulKodu, ...altSoyu(m.modulKodu)]);

  const degistir = (kod: string, ac: boolean) => {
    const yeni = new Set(acik);
    if (ac) {
      // Açılan öğenin tüm üstleri ve tüm altları da açılır
      for (let u: string | null | undefined = kod; u; u = ustler.get(u)) yeni.add(u);
      altSoyu(kod).forEach((k) => yeni.add(k));
    } else {
      yeni.delete(kod);
      altSoyu(kod).forEach((k) => yeni.delete(k));
      // Hiçbir altı açık kalmayan üst de kapanır
      for (let u = ustler.get(kod); u; u = ustler.get(u)) {
        if ((cocuklar.get(u) || []).some((m) => yeni.has(m.modulKodu))) break;
        yeni.delete(u);
      }
    }
    setAcik(yeni);
    setDegisti(true);
    setBilgi(null);
  };

  const kaydet = async () => {
    setKaydediliyor(true);
    setHata(null);
    try {
      const sonuc = await adminApi.firmaModulleriniYaz(firma.firmaId, kisitsiz ? { kisitsiz: true } : { acik: [...acik] });
      setKisitsiz(sonuc.kisitsiz);
      if (!sonuc.kisitsiz) setAcik(new Set(sonuc.acik));
      setDegisti(false);
      setBilgi("Modül ayarı kaydedildi. Kullanıcılar bir sonraki sayfa yenilemesinde / girişinde yeni menüyü görür.");
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  if (!katalog) {
    return hata ? (
      <Alert variant="danger">{hata}</Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" />
      </div>
    );
  }

  const yapraklar = katalog.filter((m) => !(cocuklar.get(m.modulKodu) || []).length);
  const acikYaprak = yapraklar.filter((m) => acik.has(m.modulKodu)).length;

  const dugum = (m: ModulKaydi, derinlik: number): React.ReactNode => {
    const altlar = cocuklar.get(m.modulKodu) || [];
    const secili = acik.has(m.modulKodu);
    const altYapraklar = altSoyu(m.modulKodu).filter((k) => !(cocuklar.get(k) || []).length);
    const acikAlt = altYapraklar.filter((k) => acik.has(k)).length;
    const daraltilmis = kapaliGruplar.has(m.modulKodu);

    return (
      <div key={m.modulKodu} className={derinlik === 0 ? "border rounded mb-2" : ""}>
        <div
          className={`d-flex align-items-center gap-2 ${derinlik === 0 ? "px-3 py-2 bg-light" : "py-1"}`}
          style={{ paddingLeft: derinlik === 0 ? undefined : 12 + derinlik * 22 }}
        >
          <Form.Check
            type={altlar.length ? "switch" : "checkbox"}
            id={`modul-${firma.firmaId}-${m.modulKodu}`}
            checked={secili}
            disabled={kisitsiz}
            onChange={(e) => degistir(m.modulKodu, e.target.checked)}
            label={<span className={derinlik === 0 ? "fw-semibold" : ""}>{m.baslik}</span>}
            className="mb-0 flex-grow-1"
          />
          {altlar.length > 0 && (
            <>
              <span className="text-muted small text-nowrap">
                {acikAlt} / {altYapraklar.length}
              </span>
              <Button
                variant="link"
                size="sm"
                className="p-0 text-decoration-none"
                onClick={() => {
                  const y = new Set(kapaliGruplar);
                  daraltilmis ? y.delete(m.modulKodu) : y.add(m.modulKodu);
                  setKapaliGruplar(y);
                }}
              >
                {daraltilmis ? "Göster" : "Gizle"}
              </Button>
            </>
          )}
        </div>
        {altlar.length > 0 && !daraltilmis && <div className={derinlik === 0 ? "py-2" : ""}>{altlar.map((c) => dugum(c, derinlik + 1))}</div>}
      </div>
    );
  };

  return (
    <>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <Form.Check
          type="switch"
          id={`modul-kisitsiz-${firma.firmaId}`}
          checked={!kisitsiz}
          onChange={(e) => {
            setKisitsiz(!e.target.checked);
            setDegisti(true);
            setBilgi(null);
          }}
          label={
            kisitsiz
              ? "Kısıtlama kapalı — firma tüm menüleri görür (yeni eklenen sayfalar dahil)"
              : `Kısıtlama açık — firma yalnızca işaretli sayfaları görür (${acikYaprak} / ${yapraklar.length})`
          }
        />
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={kisitsiz}
            onClick={() => {
              setAcik(new Set(katalog.map((m) => m.modulKodu)));
              setDegisti(true);
            }}
          >
            Tümünü Aç
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={kisitsiz}
            onClick={() => {
              setAcik(new Set());
              setDegisti(true);
            }}
          >
            Tümünü Kapat
          </Button>
          <Button size="sm" className="btn-adm" disabled={!degisti || kaydediliyor} onClick={kaydet}>
            {kaydediliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
          </Button>
        </div>
      </div>

      {!kisitsiz && acikYaprak === 0 && (
        <Alert variant="warning">Hiçbir sayfa açık değil: bu haliyle kaydedilirse firma kullanıcıları boş bir menü görür.</Alert>
      )}

      <div style={kisitsiz ? { opacity: 0.55 } : undefined}>{(cocuklar.get(null) || []).map((m) => dugum(m, 0))}</div>
    </>
  );
};

export default FirmaModulleri;
