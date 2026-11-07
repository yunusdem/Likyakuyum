import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Dropdown, Form, Spinner } from "react-bootstrap";
import { IconBuildingStore, IconCoin, IconEye, IconEyeOff, IconFileText, IconShoppingCart } from "@tabler/icons-react";
import { BenYaniti, GirisYaniti, MobilHata, OTURUM_BITTI, hatirla, istek, jetonOku, jetonYaz } from "./api";
import FiyatEkrani from "./ekranlar/FiyatEkrani";
import HesapEkrani from "./ekranlar/HesapEkrani";
import IslemEkrani, { IslemBaslangici } from "./ekranlar/IslemEkrani";
import KatalogEkrani from "./ekranlar/KatalogEkrani";

/**
 * Mobil cari sitesi (mobil.likyaerp.com; docs/MOBIL_CARI_YOL_HARITASI.md §8). Akış: müşteri no → kullanıcı adı + şifre →
 * (ilk girişte) şifre değiştirme → (birden çok veritabanında) seçim → ana ekran. Üst çubukta solda firmanın adı (K2, T2):
 * cari değiştiremez; /ben düzenli yenilendiği için panelde ad değişince burada da değişir.
 */

type Sekme = "fiyat" | "hesap" | "islem" | "katalog";

const parametre = (ad: string): string => {
  try {
    return new URLSearchParams(window.location.search).get(ad) || "";
  } catch {
    return "";
  }
};

const basHarf = (ad: string | null | undefined): string => (String(ad || "").trim().charAt(0) || "L").toLocaleUpperCase("tr-TR");

/** Şifre kutusu: göster / gizle düğmeli */
const SifreAlani: React.FC<{ id: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean }> = (p) => {
  const [acik, setAcik] = useState(false);
  return (
    <div className="m-sifre-kutu">
      <Form.Control id={p.id} type={acik ? "text" : "password"} autoComplete={p.autoComplete} autoFocus={p.autoFocus} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
      <button type="button" aria-label={acik ? "Şifreyi gizle" : "Şifreyi göster"} onClick={() => setAcik((a) => !a)}>
        {acik ? <IconEyeOff size={20} /> : <IconEye size={20} />}
      </button>
    </div>
  );
};

// ------------------------------------------------------------------ Giriş ---

const GirisEkrani: React.FC<{ onGiris: (y: GirisYaniti) => void }> = ({ onGiris }) => {
  const [musteriNo, setMusteriNo] = useState(parametre("m") || hatirla.oku("musteri"));
  const [kisaAd, setKisaAd] = useState<string | null>(null);
  const [kullaniciAdi, setKullaniciAdi] = useState(parametre("u") || hatirla.oku("kullanici"));
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const musteriSorgula = useCallback(async (no: string) => {
    if (!no.trim()) return;
    setMesgul(true);
    setHata(null);
    try {
      const b = await istek<{ musteriNo: string; kisaAd: string }>("GET", `/giris-bilgisi?m=${encodeURIComponent(no.trim())}`);
      setMusteriNo(b.musteriNo);
      setKisaAd(b.kisaAd);
      hatirla.yaz("musteri", b.musteriNo);
    } catch (e: any) {
      setHata(e?.message || "Müşteri no bulunamadı.");
      setKisaAd(null);
    } finally {
      setMesgul(false);
    }
  }, []);

  useEffect(() => {
    if (musteriNo) void musteriSorgula(musteriNo);
    // Yalnız açılışta (bağlantıyla ya da hatırlanan müşteri noyla gelindiyse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const giris = async (e: React.FormEvent) => {
    e.preventDefault();
    setMesgul(true);
    setHata(null);
    try {
      const y = await istek<GirisYaniti>("POST", "/giris", { musteriNo, kullaniciAdi, sifre });
      hatirla.yaz("kullanici", y.kullanici.kullaniciAdi);
      onGiris(y);
    } catch (err: any) {
      setHata(err?.message || "Giriş yapılamadı.");
      setSifre("");
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="m-giris-sayfa">
      <div className="m-giris-ust">
        <div className="madalyon">{basHarf(kisaAd || "Likya")}</div>
        <div className="ad">{kisaAd || "Likya"}</div>
        <div className="alt">Mobil müşteri girişi</div>
      </div>
      <div className="m-giris-kart">
        {hata && <Alert variant="danger">{hata}</Alert>}
        {!kisaAd ? (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void musteriSorgula(musteriNo);
            }}
          >
            <Form.Group className="m-alan" controlId="musteriNo">
              <Form.Label>Müşteri no</Form.Label>
              <Form.Control autoFocus autoCapitalize="characters" autoComplete="off" value={musteriNo} onChange={(e) => setMusteriNo(e.target.value.toUpperCase())} />
              <Form.Text>Firmanızın size verdiği müşteri no.</Form.Text>
            </Form.Group>
            <Button type="submit" className="w-100 m-buyuk-dugme m-cta" disabled={mesgul || !musteriNo.trim()}>
              {mesgul ? <Spinner size="sm" animation="border" /> : "Devam"}
            </Button>
          </Form>
        ) : (
          <Form onSubmit={giris}>
            <div className="m-musteri">
              <span>
                Müşteri no <span className="no">{musteriNo}</span>
              </span>
              <button type="button" onClick={() => setKisaAd(null)}>
                Değiştir
              </button>
            </div>
            <Form.Group className="m-alan" controlId="kullaniciAdi">
              <Form.Label>Kullanıcı adı</Form.Label>
              <Form.Control autoCapitalize="none" autoCorrect="off" autoComplete="username" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} />
            </Form.Group>
            <Form.Group className="m-alan" controlId="sifre">
              <Form.Label>Şifre</Form.Label>
              <SifreAlani id="sifre" autoComplete="current-password" autoFocus={!!kullaniciAdi} value={sifre} onChange={setSifre} />
            </Form.Group>
            <Button type="submit" className="w-100 m-buyuk-dugme m-cta" disabled={mesgul || !kullaniciAdi || !sifre}>
              {mesgul ? <Spinner size="sm" animation="border" /> : "Giriş yap"}
            </Button>
            <div className="m-not">Şifrenizi unuttuysanız firmanızdan yeni şifre isteyin.</div>
          </Form>
        )}
      </div>
      <div className="m-giris-imza">Likya Mobil</div>
    </div>
  );
};

// ------------------------------------------------------------------ Şifre ---

const SifreEkrani: React.FC<{ zorunlu: boolean; onTamam: (y: GirisYaniti) => void; onVazgec?: () => void }> = ({ zorunlu, onTamam, onVazgec }) => {
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (yeni !== tekrar) return setHata("Yeni şifreler aynı değil.");
    setMesgul(true);
    setHata(null);
    try {
      onTamam(await istek<GirisYaniti>("POST", "/sifre", { mevcutSifre: mevcut, yeniSifre: yeni }));
    } catch (err: any) {
      setHata(err?.message || "Şifre değiştirilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="m-kart">
      <div className="m-baslik mb-1">{zorunlu ? "Yeni şifre" : "Şifre değiştir"}</div>
      <div className="fw-bold fs-5 mb-1">{zorunlu ? "Yeni şifrenizi belirleyin" : "Şifrenizi güncelleyin"}</div>
      {zorunlu && <div className="m-ipucu mb-3">İlk girişte size verilen şifreyi değiştirmeniz gerekiyor.</div>}
      {hata && <Alert variant="danger">{hata}</Alert>}
      <Form onSubmit={kaydet}>
        <Form.Group className="m-alan" controlId="mevcut">
          <Form.Label>{zorunlu ? "Size verilen şifre" : "Mevcut şifre"}</Form.Label>
          <SifreAlani id="mevcut" autoComplete="current-password" value={mevcut} onChange={setMevcut} />
        </Form.Group>
        <Form.Group className="m-alan" controlId="yeni">
          <Form.Label>Yeni şifre</Form.Label>
          <SifreAlani id="yeni" autoComplete="new-password" value={yeni} onChange={setYeni} />
          <Form.Text>En az 8 karakter; harf ve rakam içermeli.</Form.Text>
        </Form.Group>
        <Form.Group className="m-alan" controlId="tekrar">
          <Form.Label>Yeni şifre (tekrar)</Form.Label>
          <SifreAlani id="tekrar" autoComplete="new-password" value={tekrar} onChange={setTekrar} />
        </Form.Group>
        <Button type="submit" className="w-100 m-buyuk-dugme m-cta" disabled={mesgul || !mevcut || !yeni || !tekrar}>
          {mesgul ? <Spinner size="sm" animation="border" /> : "Kaydet"}
        </Button>
        {!zorunlu && onVazgec && (
          <Button variant="link" className="w-100 mt-2 text-decoration-none fw-semibold" onClick={onVazgec}>
            Vazgeç
          </Button>
        )}
      </Form>
    </div>
  );
};

// ------------------------------------------------------------------ Uygulama ---

const MobilApp: React.FC = () => {
  const [ben, setBen] = useState<BenYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(!!jetonOku());
  const [hata, setHata] = useState<string | null>(null);
  const [sekme, setSekme] = useState<Sekme>("fiyat");
  const [sifreAcik, setSifreAcik] = useState(false);
  // Ticari katalog (Faz 8): firma katalogda ürün seçtiyse sekme görünür
  const [katalogVar, setKatalogVar] = useState(false);
  // Fiyattan işleme kısayol (T1): Fiyatlar'da dokunulan ürün + yön, Al / Sat açılınca seçili gelir
  const [islemBaslangici, setIslemBaslangici] = useState<IslemBaslangici | null>(null);

  const benYukle = useCallback(async () => {
    if (!jetonOku()) {
      setBen(null);
      setYukleniyor(false);
      return;
    }
    try {
      const b = await istek<BenYaniti>("GET", "/ben");
      setBen(b);
      // Seçili veritabanı kapandıysa sunucu uyarı döner; kullanıcı başka veritabanı seçer
      setHata(b.uyari || null);
    } catch (e: any) {
      if (!(e instanceof MobilHata && e.durum === 401)) setHata(e?.message || "Bağlantı hatası.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void benYukle();
    const bitti = () => setBen(null);
    window.addEventListener(OTURUM_BITTI, bitti);
    return () => window.removeEventListener(OTURUM_BITTI, bitti);
  }, [benYukle]);

  // Firma adı / yetkiler panelde değişirse oturum kapanmadan yansısın (T2): dakikada bir ve sekme öne gelince
  const oturumAcik = !!ben;
  useEffect(() => {
    if (!oturumAcik) return;
    const t = setInterval(() => void benYukle(), 60_000);
    const gorunur = () => {
      if (document.visibilityState === "visible") void benYukle();
    };
    document.addEventListener("visibilitychange", gorunur);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", gorunur);
    };
  }, [oturumAcik, benYukle]);

  const katalogAnahtari = ben && !ben.kullanici.sifreDegismeli && ben.seciliFirmaId !== null && ben.yetkiler?.fiyat ? ben.seciliFirmaId : null;
  useEffect(() => {
    setKatalogVar(false);
    if (katalogAnahtari === null) return;
    let iptal = false;
    istek<{ urunler: unknown[] }>("GET", "/katalog")
      .then((k) => !iptal && setKatalogVar(k.urunler.length > 0))
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [katalogAnahtari]);

  useEffect(() => {
    document.title = ben?.kisaAd ? `${ben.kisaAd} · Likya Mobil` : "Likya Mobil";
  }, [ben?.kisaAd]);

  const jetonAl = async (y: GirisYaniti) => {
    jetonYaz(y.token);
    setSifreAcik(false);
    setYukleniyor(true);
    await benYukle();
  };

  const veritabaniSec = async (firmaId: number) => {
    try {
      await jetonAl(await istek<GirisYaniti>("POST", "/veritabani", { firmaId }));
    } catch (e: any) {
      setHata(e?.message || "Veritabanı seçilemedi.");
    }
  };

  const cikis = async () => {
    await istek("POST", "/cikis").catch(() => undefined);
    jetonYaz(null);
    setBen(null);
  };

  const fiyattanIslem = useCallback((urunId: number, yon: "AL" | "SAT") => {
    setIslemBaslangici({ urunId, yon, sayac: Date.now() });
    setSekme("islem");
    window.scrollTo({ top: 0 });
  }, []);

  if (yukleniyor)
    return (
      <div className="m-giris-sayfa">
        <div className="m-yukleniyor tam">
          <Spinner animation="border" />
        </div>
      </div>
    );

  if (!ben)
    return (
      <>
        {hata && (
          <Alert variant="warning" className="m-3 mb-0">
            {hata}
          </Alert>
        )}
        <GirisEkrani onGiris={(y) => void jetonAl(y)} />
      </>
    );

  const kimlik = ben.kullanici.adSoyad || ben.kullanici.kullaniciAdi;
  // Üst çubuk alt satırı: kimin girdiği (cari adı); yoksa firmanın ünvanı
  const altSatir = ben.cari?.ad || (ben.unvan && ben.unvan !== ben.kisaAd ? ben.unvan : kimlik);

  // Üst çubuk. Geniş ekranda (masaüstü) sekmeler alt menü yerine burada durur; telefonda gizlidir (mobil.scss)
  const ustCubukCiz = (sekmeDugmeleri?: React.ReactNode) => (
    <header className="m-ust">
      <div className="m-ust-ic">
        <div className="m-ust-satir">
          <div className="m-marka">
            <div className="m-marka-ad" title={ben.unvan || ben.kisaAd}>
              {ben.kisaAd}
            </div>
            {altSatir && <div className="m-marka-alt">{altSatir}</div>}
          </div>
          {sekmeDugmeleri && <nav className="m-ust-sekmeler">{sekmeDugmeleri}</nav>}
          <Dropdown align="end" className="m-kullanici">
            <Dropdown.Toggle as="button" type="button" className="m-avatar" aria-label="Hesap menüsü">
              {basHarf(kimlik)}
            </Dropdown.Toggle>
            <Dropdown.Menu className="m-menu">
              <div className="m-menu-baslik">
                <div className="ad">{kimlik}</div>
                {ben.cari?.ad ? <div className="alt">{ben.cari.ad}</div> : null}
                {ben.unvan ? <div className="alt">{ben.unvan}</div> : null}
              </div>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => setSifreAcik(true)}>Şifre değiştir</Dropdown.Item>
              <Dropdown.Item className="text-danger" onClick={() => void cikis()}>
                Çıkış yap
              </Dropdown.Item>
              <div className="m-menu-imza">Likya Mobil</div>
            </Dropdown.Menu>
          </Dropdown>
        </div>
        {/* Birden çok veritabanı (K25): üstten geçiş, firma adını kesmesin diye ikinci satırda */}
        {ben.veritabanlari.length > 1 && !ben.kullanici.sifreDegismeli && (
          <Form.Select size="sm" aria-label="Hesap" className="m-ust-hesap" value={ben.seciliFirmaId ?? ""} onChange={(e) => void veritabaniSec(Number(e.target.value))}>
            {ben.seciliFirmaId === null && <option value="">Hesap seçin…</option>}
            {ben.veritabanlari.map((v) => (
              <option key={v.firmaId} value={v.firmaId}>
                {v.unvan}
                {v.cariAd ? ` — ${v.cariAd}` : ""}
              </option>
            ))}
          </Form.Select>
        )}
      </div>
    </header>
  );
  const ustCubuk = ustCubukCiz();

  // İlk giriş: şifre değişmeden başka ekran yok
  if (ben.kullanici.sifreDegismeli || sifreAcik)
    return (
      <div className="m-kap">
        {ustCubuk}
        <div className="m-govde">
          <SifreEkrani zorunlu={ben.kullanici.sifreDegismeli} onTamam={(y) => void jetonAl(y)} onVazgec={() => setSifreAcik(false)} />
        </div>
      </div>
    );

  if (ben.seciliFirmaId === null)
    return (
      <div className="m-kap">
        {ustCubuk}
        <div className="m-govde">
          {hata && <Alert variant="warning">{hata}</Alert>}
          {ben.veritabanlari.length === 0 && <div className="m-kart m-bos">Açık hesabınız kalmadı. Firmanızla görüşün.</div>}
          <div className="m-kart">
            <div className="m-baslik mb-2">Hesap seçin</div>
            {ben.veritabanlari.map((v) => (
              <button key={v.firmaId} type="button" className="m-liste-satir" onClick={() => void veritabaniSec(v.firmaId)}>
                <div className="ic">
                  <div className="ust">{v.unvan}</div>
                  {v.cariAd && <div className="alt">{v.cariAd}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  const y = ben.yetkiler;
  const sekmeler: { k: Sekme; ad: string; ikon: React.ReactNode; acik: boolean }[] = [
    { k: "fiyat", ad: "Fiyatlar", ikon: <IconCoin size={22} />, acik: !!y?.fiyat },
    { k: "islem", ad: "Al / Sat", ikon: <IconShoppingCart size={22} />, acik: !!(y?.alis || y?.satis) },
    { k: "katalog", ad: "Katalog", ikon: <IconBuildingStore size={22} />, acik: !!y?.fiyat && katalogVar },
    { k: "hesap", ad: "Hesabım", ikon: <IconFileText size={22} />, acik: !!(y?.bakiye || y?.dokum) },
  ];
  const aciklar = sekmeler.filter((s) => s.acik);
  const gecerliSekme = aciklar.some((s) => s.k === sekme) ? sekme : aciklar[0]?.k;
  const islemAcik = !!(y?.alis || y?.satis);

  const sekmeDugmeleri =
    aciklar.length > 1
      ? aciklar.map((s) => (
          <button key={s.k} type="button" className={gecerliSekme === s.k ? "secili" : ""} onClick={() => setSekme(s.k)}>
            {s.ikon}
            {s.ad}
          </button>
        ))
      : undefined;

  return (
    <div className="m-kap">
      {ustCubukCiz(sekmeDugmeleri)}
      <div className="m-govde">
        {hata && (
          <Alert variant="warning" dismissible onClose={() => setHata(null)}>
            {hata}
          </Alert>
        )}
        {aciklar.length === 0 && <div className="m-kart m-bos">Hesabınıza henüz bir yetki tanımlanmamış. Firmanızla görüşün.</div>}
        {gecerliSekme === "fiyat" && <FiyatEkrani firmaId={ben.seciliFirmaId} yetkiler={y} onIslem={islemAcik ? fiyattanIslem : undefined} />}
        {gecerliSekme === "islem" && <IslemEkrani firmaId={ben.seciliFirmaId} yetkiler={y!} baslangic={islemBaslangici} />}
        {gecerliSekme === "katalog" && <KatalogEkrani firmaId={ben.seciliFirmaId} />}
        {gecerliSekme === "hesap" && <HesapEkrani firmaId={ben.seciliFirmaId} yetkiler={y!} />}
      </div>
      {sekmeDugmeleri && (
        <nav className="m-alt">
          <div className="m-alt-ic">{sekmeDugmeleri}</div>
        </nav>
      )}
    </div>
  );
};

export default MobilApp;
