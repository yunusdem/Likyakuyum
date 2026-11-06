import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Form, InputGroup, Spinner } from "react-bootstrap";
import { IconKey, IconSearch, IconUsers } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { MobilDurum, MobilErisim, MobilVeritabani, MobilYonetimService, tarihSaat } from "../../services/mobilYonetimService";
import { DurumRozeti, ErisimEkleFormu, ErisimTablosu, KopyalaDugmesi, SifreModal } from "./mobilOrtak";
import { useMobilYetkisi } from "./useMobilYetkisi";

/**
 * Mobil › Mobil Kullanıcılar (docs/MOBIL_CARI_YOL_HARITASI.md K5): yönetici hangi carisine hangi veritabanında erişim
 * verdiğini tek yerden görür. Yeni kullanıcı cari kartının Mobil sekmesinden eklenir.
 */
const MobilKullanicilarPage: React.FC = () => {
  const { yonetici } = useMobilYetkisi();
  const [veri, setVeri] = useState<{ durum: MobilDurum; erisimler: MobilErisim[]; veritabanlari: MobilVeritabani[] } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [aranan, setAranan] = useState("");
  const [vt, setVt] = useState<number | "">("");
  const [sifre, setSifre] = useState<{ kullaniciAdi: string; geciciSifre: string; paylasim: string; girisAdresi: string } | null>(null);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      setVeri(await MobilYonetimService.kullanicilar());
    } catch (e: any) {
      setHata(e?.message || "Mobil kullanıcılar alınamadı.");
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const islem = async (is: () => Promise<unknown>, tamam: string) => {
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      await is();
      setMesaj(tamam);
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(false);
    }
  };

  const gruplar = useMemo(() => {
    if (!veri) return [];
    const q = aranan.trim().toLocaleLowerCase("tr-TR");
    const harita = new Map<number, MobilErisim[]>();
    for (const e of veri.erisimler) harita.set(e.mobilKullaniciId, [...(harita.get(e.mobilKullaniciId) || []), e]);
    return [...harita.values()].filter((satirlar) => {
      if (vt !== "" && !satirlar.some((e) => e.firmaId === vt)) return false;
      if (!q) return true;
      return satirlar.some((e) => [e.kullaniciAdi, e.adSoyad, e.cariKod, e.cariAd, e.eposta].some((x) => String(x || "").toLocaleLowerCase("tr-TR").includes(q)));
    });
  }, [veri, aranan, vt]);

  const sifreSifirla = async (id: number, kullaniciAdi: string) => {
    if (!window.confirm(`${kullaniciAdi} için yeni geçici şifre üretilecek; açık oturumları kapanır. Devam?`)) return;
    setMesgul(true);
    try {
      setSifre({ ...(await MobilYonetimService.sifreSifirla(id)), kullaniciAdi });
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "Şifre sıfırlanamadı.");
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="p-2 p-md-3">
      <ERPToolbar pageTitle="Mobil Kullanıcılar" pageIcon={<IconUsers size={22} className="text-primary" />} onRefresh={() => void yukle()} disabled={mesgul} />
      {!yonetici && <Alert variant="warning" className="mt-3">Mobil kullanıcılarını yalnız yönetici görebilir.</Alert>}
      {hata && (
        <Alert variant="danger" className="mt-3" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}
      {mesaj && (
        <Alert variant="success" className="mt-3 py-2" dismissible onClose={() => setMesaj(null)}>
          {mesaj}
        </Alert>
      )}
      {!veri && !hata && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}
      {veri && (
        <>
          <Card className="mt-3 mb-3">
            <Card.Body className="py-2 d-flex flex-wrap gap-3 align-items-center small">
              <span>
                Müşteri no: <strong>{veri.durum.musteriNo}</strong>
              </span>
              <span>
                Bu veritabanında kullanım: <strong>{veri.durum.kullanilan}</strong> / {veri.durum.kullaniciLimiti}
              </span>
              <span className="text-muted text-break">{veri.durum.girisAdresi}</span>
              <KopyalaDugmesi metin={veri.durum.girisAdresi} etiket="Giriş adresi" />
              <span className="text-muted">Yeni kullanıcı: cari kartı › Mobil sekmesi</span>
            </Card.Body>
          </Card>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <InputGroup size="sm" style={{ maxWidth: 320 }}>
              <InputGroup.Text>
                <IconSearch size={14} />
              </InputGroup.Text>
              <Form.Control placeholder="Kullanıcı, cari, e-posta" value={aranan} onChange={(e) => setAranan(e.target.value)} />
            </InputGroup>
            <Form.Select size="sm" style={{ maxWidth: 320 }} value={vt} onChange={(e) => setVt(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Bütün veritabanları</option>
              {veri.veritabanlari.map((v) => (
                <option key={v.firmaId} value={v.firmaId}>
                  {v.unvan} ({v.dbName}){v.modulAcik ? "" : " — Mobil kapalı"}
                </option>
              ))}
            </Form.Select>
            <span className="small text-muted align-self-center">{gruplar.length} kullanıcı</span>
          </div>
          {gruplar.length === 0 && <div className="text-muted small">Kayıt yok.</div>}
          {gruplar.map((satirlar) => {
            const k = satirlar[0];
            return (
              <Card key={k.mobilKullaniciId} className="mb-2">
                <Card.Header className="py-2 d-flex flex-wrap gap-2 align-items-center small">
                  <strong className="font-monospace">{k.kullaniciAdi}</strong>
                  <span>{k.adSoyad}</span>
                  {k.eposta && <span className="text-muted">{k.eposta}</span>}
                  <DurumRozeti durum={k.kullaniciDurum} />
                  {k.sifreDegismeli && <Badge bg="warning" text="dark">İlk şifre değişmedi</Badge>}
                  {k.kilitli && <Badge bg="danger">Kilitli</Badge>}
                  <span className="text-muted">Son giriş: {tarihSaat(k.sonGiris)}</span>
                  <span className="ms-auto d-flex gap-1">
                    <Button size="sm" variant="outline-primary" disabled={mesgul} onClick={() => void sifreSifirla(k.mobilKullaniciId, k.kullaniciAdi)}>
                      <IconKey size={14} /> Şifre sıfırla
                    </Button>
                    <Button
                      size="sm"
                      variant={k.kullaniciDurum === "AKTIF" ? "outline-secondary" : "outline-success"}
                      disabled={mesgul}
                      onClick={() =>
                        void islem(
                          () => MobilYonetimService.kullaniciGuncelle(k.mobilKullaniciId, { durum: k.kullaniciDurum === "AKTIF" ? "PASIF" : "AKTIF" }),
                          k.kullaniciDurum === "AKTIF" ? "Kullanıcı pasife alındı." : "Kullanıcı aktif edildi."
                        )
                      }
                    >
                      {k.kullaniciDurum === "AKTIF" ? "Pasife al" : "Aktif et"}
                    </Button>
                  </span>
                </Card.Header>
                <Card.Body className="py-2">
                  <ErisimTablosu erisimler={satirlar} mesgul={mesgul} onIslem={(is, m) => void islem(is, m)} />
                  <ErisimEkleFormu
                    mobilKullaniciId={k.mobilKullaniciId}
                    veritabanlari={veri.veritabanlari}
                    mevcutFirmalar={satirlar.map((e) => e.firmaId)}
                    mesgul={mesgul}
                    onIslem={(is, m) => void islem(is, m)}
                  />
                </Card.Body>
              </Card>
            );
          })}
        </>
      )}
      <SifreModal bilgi={sifre} onKapat={() => setSifre(null)} />
    </div>
  );
};

export default MobilKullanicilarPage;
