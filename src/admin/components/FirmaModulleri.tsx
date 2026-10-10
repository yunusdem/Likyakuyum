import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { adminApi, FirmaDto, FirmaModulAyari, ModulKaydi } from "../services/adminApi";
import { modulKatalogu } from "../../config/modulKatalogu";
import ModulAgaci, { agacYapisi } from "./ModulAgaci";
import { paketleriHazirla } from "./paketOrtak";
import { UrunRozetleri } from "./UrunSecici";

/**
 * Firma Detay > Modüller sekmesi. Ağaç, kullanıcı uygulamasının sol menüsü ve üst kısayol çubuğuyla birebir aynıdır
 * (tek kaynak: src/config/modulKatalogu.ts). Sekme açılınca katalog sunucuyla eşitlenir; böylece menüye eklenen yeni
 * sayfa panelde kendiliğinden görünür (yeni sayfa, ayarı yapılmış firmalarda kapalı gelir).
 *
 * Lisansında ürün seçili firmada (docs/LISANS_URUN_PAKETLERI.md) ağaç paketlerden dolu gelir; tik değişiklikleri sunucuda
 * paket tabanına göre "elle açıldı / elle kapatıldı" istisnası olarak saklanır ve paket değişse de korunur.
 */
const FirmaModulleri: React.FC<{ firma: FirmaDto }> = ({ firma }) => {
  const [katalog, setKatalog] = useState<ModulKaydi[] | null>(null);
  const [ayar, setAyar] = useState<FirmaModulAyari | null>(null);
  const [paketAdlari, setPaketAdlari] = useState<Record<string, string>>({});
  const [kisitsiz, setKisitsiz] = useState(true);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [degisti, setDegisti] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ayariUygula = (a: FirmaModulAyari, k: ModulKaydi[]) => {
    setAyar(a);
    setKisitsiz(a.kisitsiz);
    setAcik(new Set(a.kisitsiz ? k.map((m) => m.modulKodu) : a.acik));
    setDegisti(false);
  };

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const k = await adminApi.modulKatalogEsitle(modulKatalogu());
        const [a, paketler] = await Promise.all([adminApi.firmaModulleri(firma.firmaId), paketleriHazirla().catch(() => null)]);
        if (iptal) return;
        setKatalog(k);
        setPaketAdlari(Object.fromEntries((paketler?.paketler || []).map((p) => [p.paketKodu, p.ad])));
        ayariUygula(a, k);
      } catch (err: any) {
        if (!iptal) setHata(err?.message || "Modüller getirilemedi.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [firma.firmaId]);

  const yapi = useMemo(() => agacYapisi(katalog || []), [katalog]);
  const urunlu = !!ayar && ayar.urunler.length > 0;
  const taban = useMemo(() => new Set(ayar?.taban || []), [ayar]);

  const kaydet = async (veri: { kisitsiz?: boolean; acik?: string[]; paketeDon?: boolean }, mesaj: string) => {
    setKaydediliyor(true);
    setHata(null);
    try {
      ayariUygula(await adminApi.firmaModulleriniYaz(firma.firmaId, veri), katalog!);
      setBilgi(mesaj);
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  if (!katalog || !ayar) {
    return hata ? (
      <Alert variant="danger">{hata}</Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" />
      </div>
    );
  }

  const yapraklar = katalog.filter((m) => yapi.yaprakMi(m.modulKodu));
  const acikYaprak = yapraklar.filter((m) => acik.has(m.modulKodu)).length;
  const istisnaSayisi = urunlu ? yapraklar.filter((m) => acik.has(m.modulKodu) !== taban.has(m.modulKodu)).length : 0;

  // Ürünlü firmada her yaprağın paketle ilişkisi (kaydedilmemiş değişiklik de anında görünür)
  const rozet = (m: ModulKaydi) => {
    if (!urunlu || !yapi.yaprakMi(m.modulKodu)) return null;
    const pakette = taban.has(m.modulKodu);
    const acikMi = acik.has(m.modulKodu);
    if (pakette && acikMi) return <Badge bg="light" text="secondary" className="fw-normal">Pakette</Badge>;
    if (!pakette && acikMi) return <Badge bg="primary" className="fw-normal">Elle açıldı</Badge>;
    if (pakette && !acikMi) return <Badge bg="warning" text="dark" className="fw-normal">Elle kapatıldı</Badge>;
    return null;
  };

  return (
    <>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}

      {urunlu && (
        <Alert variant="info" className="py-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span>Lisans ürünleri:</span>
            <UrunRozetleri urunler={ayar.urunler} adlar={paketAdlari} />
            <span className="small text-muted ms-1">
              Sayfalar paketten gelir. Tik değişikliği firmaya özel istisna olarak saklanır; paket değişse de korunur.
              {istisnaSayisi > 0 && ` Şu an ${istisnaSayisi} sayfa paketten farklı.`}
            </span>
          </div>
        </Alert>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        {urunlu ? (
          <span className="text-muted small">
            Açık sayfa: {acikYaprak} / {yapraklar.length}
          </span>
        ) : (
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
        )}
        <div className="d-flex gap-2">
          {urunlu && (
            <Button
              size="sm"
              variant="outline-primary"
              disabled={kaydediliyor || (istisnaSayisi === 0 && !degisti)}
              onClick={() => kaydet({ paketeDon: true }, "Elle yapılan değişiklikler silindi; sayfalar paketteki haline döndü.")}
            >
              Pakete Dön
            </Button>
          )}
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={kisitsiz && !urunlu}
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
            disabled={kisitsiz && !urunlu}
            onClick={() => {
              setAcik(new Set());
              setDegisti(true);
            }}
          >
            Tümünü Kapat
          </Button>
          <Button
            size="sm"
            className="btn-adm"
            disabled={!degisti || kaydediliyor}
            onClick={() =>
              kaydet(
                !urunlu && kisitsiz ? { kisitsiz: true } : { acik: [...acik] },
                "Modül ayarı kaydedildi. Kullanıcılar bir sonraki sayfa yenilemesinde / girişinde yeni menüyü görür."
              )
            }
          >
            {kaydediliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
          </Button>
        </div>
      </div>

      {!kisitsiz && acikYaprak === 0 && (
        <Alert variant="warning">Hiçbir sayfa açık değil: bu haliyle kaydedilirse firma kullanıcıları boş bir menü görür.</Alert>
      )}
      {firma.baglantiModu === "setup" && degisti && (
        <Alert variant="warning" className="py-2">
          Kurulum (exe) firması: kaydettikten sonra Lisans sekmesinden yeni lisans kodu üretin; program kısıtı lisans kodundan okur.
        </Alert>
      )}

      <div style={kisitsiz && !urunlu ? { opacity: 0.55 } : undefined}>
        <ModulAgaci
          katalog={katalog}
          acik={acik}
          kimlik={`modul-${firma.firmaId}`}
          disabled={kisitsiz && !urunlu}
          rozet={rozet}
          onDegistir={(yeni) => {
            setAcik(yeni);
            setDegisti(true);
            setBilgi(null);
          }}
        />
      </div>
    </>
  );
};

export default FirmaModulleri;
