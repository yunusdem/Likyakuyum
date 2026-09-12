import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Form, InputGroup, Modal, Spinner, Alert, Badge } from "react-bootstrap";
import {
  IconShieldCheck,
  IconSearch,
  IconRefresh,
  IconId,
  IconUser,
  IconAlertTriangle,
  IconChevronRight,
  IconChevronLeft,
  IconExternalLink,
  IconCheck,
  IconSettings,
} from "@tabler/icons-react";
import ERPToolbar from "components/common/ERPToolbar";
import { MASAK_LISTS } from "data/masakData";
import MasakModal from "../../components/masak/MasakModal";
import {
  MasakService,
  masakBayatMi,
  masakKodEtiketi,
  masakSayi,
  masakTarihSaat,
  type MasakGuncellemeRaporu,
  type MasakKayit,
  type MasakListeDurumu,
} from "../../services/masakService";

const SAYFA_BOYUTU = 50;

const listeEtiketi = (listeKod?: string | null): string => {
  if (!listeKod) return "-";
  const bulunan = MASAK_LISTS.find((l) => l.listeKod === listeKod);
  return bulunan ? bulunan.code : masakKodEtiketi(listeKod);
};

export const MasakListsPage: React.FC = () => {
  const [listeKod, setListeKod] = useState<string>("");
  const [ad, setAd] = useState<string>("");
  const [kimlikNo, setKimlikNo] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const [kayitlar, setKayitlar] = useState<MasakKayit[]>([]);
  const [toplam, setToplam] = useState<number>(0);
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);
  const [hata, setHata] = useState<string | null>(null);

  const [toplamKayit, setToplamKayit] = useState<number>(0);
  const [sonGuncelleme, setSonGuncelleme] = useState<string | null>(null);
  const [listeler, setListeler] = useState<MasakListeDurumu[]>([]);

  const [detay, setDetay] = useState<MasakKayit | null>(null);
  const [guncellemeAcik, setGuncellemeAcik] = useState<boolean>(false);

  // Tek tuşla güncelleme (son girilen adreslerle, adres ekranı açılmadan)
  const [hizliGuncelleniyor, setHizliGuncelleniyor] = useState<boolean>(false);
  const [hizliRapor, setHizliRapor] = useState<MasakGuncellemeRaporu | null>(null);
  const [hizliHata, setHizliHata] = useState<string | null>(null);

  const durumYukle = useCallback(async () => {
    try {
      const durum = await MasakService.getDurum();
      setToplamKayit(durum.toplamKayit);
      setSonGuncelleme(durum.sonGuncelleme);
      setListeler(durum.listeler);
    } catch {
      /* durum okunamazsa üst bant boş kalır, liste yine denenecek */
    }
  }, []);

  /** Liste sekmeleri: standart dört liste + sunucuda tanımlı kullanıcı listeleri */
  const listeSekmeleri = useMemo<{ deger: string; etiket: string }[]>(() => {
    const standart = MASAK_LISTS.map((l) => ({ deger: l.listeKod, etiket: l.code }));
    const ozel = listeler
      .filter((l) => !MASAK_LISTS.some((m) => m.listeKod === l.listeKod))
      .map((l) => ({ deger: l.listeKod, etiket: masakKodEtiketi(l.listeKod) }));
    return [{ deger: "", etiket: "Tümü" }, ...standart, ...ozel];
  }, [listeler]);

  const listeYukle = useCallback(
    async (istenenSayfa: number = page, filtre?: { listeKod?: string; ad?: string; kimlikNo?: string }) => {
      setYukleniyor(true);
      setHata(null);
      try {
        const sonuc = await MasakService.getListe({
          listeKod: (filtre?.listeKod ?? listeKod) || undefined,
          q: (filtre?.ad ?? ad).trim() || undefined,
          kimlikNo: (filtre?.kimlikNo ?? kimlikNo).trim() || undefined,
          page: istenenSayfa,
          pageSize: SAYFA_BOYUTU,
        });
        setKayitlar(sonuc.kayitlar);
        setToplam(sonuc.toplam);
        setPage(sonuc.page);
      } catch (err: any) {
        setKayitlar([]);
        setToplam(0);
        setHata(err?.message || "MASAK kayıtları getirilemedi.");
      } finally {
        setYukleniyor(false);
      }
    },
    [ad, kimlikNo, listeKod, page]
  );

  useEffect(() => {
    durumYukle();
    listeYukle(1);
    // İlk yükleme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listele = () => listeYukle(1);

  /**
   * Adres ekranı açılmadan, sunucuda kayıtlı son girilen adreslerle tüm listeleri günceller.
   * Adres değiştirmek gerekiyorsa "Adresleri Düzenle" ile MasakModal açılır.
   */
  const hizliGuncelle = async () => {
    setHizliGuncelleniyor(true);
    setHizliHata(null);
    setHizliRapor(null);
    try {
      const sonuc = await MasakService.guncelle();
      setHizliRapor(sonuc);
      setToplamKayit(sonuc.toplamKayit);
      setSonGuncelleme(sonuc.guncellemeZamani);
      setListeler(sonuc.durum);
      await listeYukle(1);
    } catch (err: any) {
      setHizliHata(err?.message || "Güncelleme yapılamadı.");
    } finally {
      setHizliGuncelleniyor(false);
    }
  };

  const sekmeSec = (deger: string) => {
    setListeKod(deger);
    setPage(1);
    // Filtre değişince listeyi hemen tazele
    void listeYukle(1, { listeKod: deger });
  };

  const sonSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);
  const bayat = masakBayatMi(sonGuncelleme);

  const temizle = () => {
    setAd("");
    setKimlikNo("");
    setListeKod("");
    setPage(1);
    void listeYukle(1, { listeKod: '', ad: '', kimlikNo: '' });
  };

  return (
    <div className="container-fluid py-2 px-3">
      <ERPToolbar
        pageTitle="MASAK Malvarlıkları Dondurulanlar"
        pageIcon={<IconShieldCheck size={20} />}
        onSearch={listele}
        onRefresh={() => {
          durumYukle();
          listeYukle(page);
        }}
        onClear={temizle}
        onPrint={() => window.print()}
        disabled={yukleniyor || hizliGuncelleniyor}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted text-nowrap d-none d-md-inline" style={{ fontSize: "0.78rem" }}>
              Son güncelleme: <strong className={bayat ? "text-danger" : ""}>{masakTarihSaat(sonGuncelleme)}</strong>
            </span>
            <Button
              variant="primary"
              size="sm"
              className="d-flex align-items-center gap-1"
              onClick={hizliGuncelle}
              disabled={hizliGuncelleniyor || guncellemeAcik}
              title="Sunucuda kayıtlı son adreslerle tüm listeleri indirir"
            >
              {hizliGuncelleniyor ? (
                <>
                  <Spinner as="span" animation="border" size="sm" /> Güncelleniyor...
                </>
              ) : (
                <>
                  <IconRefresh size={15} /> MASAK Listelerini Güncelle
                </>
              )}
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              className="d-flex align-items-center gap-1"
              onClick={() => setGuncellemeAcik(true)}
              disabled={hizliGuncelleniyor}
              title="Liste adreslerini görüntüle / değiştir, yeni liste ekle"
            >
              <IconSettings size={15} /> Adresleri Düzenle
            </Button>
          </div>
        }
      />

      {/* Tek tuşla güncelleme sonucu */}
      {hizliHata && (
        <Alert
          variant="danger"
          className="py-2 px-3 mb-3"
          style={{ fontSize: "0.82rem" }}
          dismissible
          onClose={() => setHizliHata(null)}
        >
          {hizliHata}
        </Alert>
      )}
      {hizliRapor && (
        <Alert
          variant={hizliRapor.sonuclar.some((s) => s.durum === "hata") ? "warning" : "success"}
          className="py-2 px-3 mb-3"
          style={{ fontSize: "0.82rem" }}
          dismissible
          onClose={() => setHizliRapor(null)}
        >
          <div className="fw-semibold mb-1">
            Güncelleme tamamlandı · {masakTarihSaat(hizliRapor.guncellemeZamani)}
          </div>
          <div className="d-flex flex-wrap gap-3">
            {hizliRapor.sonuclar.map((s) => (
              <span key={s.listeKod} className="d-flex align-items-center gap-1">
                {s.durum === "basarili" ? (
                  <IconCheck size={14} className="text-success" />
                ) : (
                  <IconAlertTriangle size={14} className="text-danger" />
                )}
                <strong>{masakKodEtiketi(s.listeKod)}</strong>
                {s.durum === "basarili" ? (
                  <span>{masakSayi(s.kayitSayisi)} kayıt</span>
                ) : (
                  <span className="text-danger" title={s.hata}>
                    {(s.hata || "hata").slice(0, 70)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </Alert>
      )}

      {/* Durum bandı */}
      <div
        className={`d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded px-3 py-2 mb-3 ${
          bayat ? "border-danger bg-danger-subtle" : "bg-light"
        }`}
        style={{ fontSize: "0.82rem" }}
      >
        <div className="d-flex align-items-center gap-3">
          <span>
            Toplam kayıt: <strong>{masakSayi(toplamKayit)}</strong>
          </span>
          <span className="text-muted">
            Son güncelleme: <strong>{masakTarihSaat(sonGuncelleme)}</strong>
          </span>
        </div>
        {bayat && (
          <span className="text-danger fw-semibold d-flex align-items-center gap-1">
            <IconAlertTriangle size={15} />
            MASAK sitesinden listeleri sık aralıklarla güncelleyiniz.
          </span>
        )}
      </div>

      {/* Arama satırı */}
      <Card className="border shadow-2xs mb-3" style={{ borderRadius: "6px" }}>
        <Card.Body className="p-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <InputGroup size="sm" style={{ width: "260px" }}>
              <InputGroup.Text className="bg-light px-2">
                <IconUser size={14} className="text-primary" />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Adı"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && listele()}
              />
            </InputGroup>

            <InputGroup size="sm" style={{ width: "200px" }}>
              <InputGroup.Text className="bg-light px-2">
                <IconId size={14} className="text-primary" />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Kimlik no"
                value={kimlikNo}
                onChange={(e) => setKimlikNo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && listele()}
                className="font-monospace"
              />
            </InputGroup>

            <Button
              variant="primary"
              size="sm"
              onClick={listele}
              disabled={yukleniyor}
              className="d-flex align-items-center gap-1"
            >
              <IconSearch size={15} /> Listele
            </Button>

            <Button variant="outline-secondary" size="sm" onClick={temizle} disabled={yukleniyor}>
              Temizle
            </Button>

            <div className="d-flex align-items-center gap-1 ms-auto">
              {listeSekmeleri.map((sekme) => (
                <Button
                  key={sekme.deger || "tumu"}
                  variant={listeKod === sekme.deger ? "primary" : "outline-secondary"}
                  size="sm"
                  onClick={() => sekmeSec(sekme.deger)}
                  disabled={yukleniyor}
                  style={{ minWidth: "52px" }}
                >
                  {sekme.etiket}
                </Button>
              ))}
            </div>
          </div>
        </Card.Body>
      </Card>

      {hata && (
        <Alert variant="danger" className="py-2 px-3" style={{ fontSize: "0.82rem" }}>
          {hata}
        </Alert>
      )}

      {/* Veri tablosu */}
      <Card
        className="shadow-sm border-secondary border-opacity-25"
        style={{ borderRadius: "6px", overflow: "hidden" }}
      >
        <div
          className="table-responsive"
          style={{ maxHeight: "calc(100vh - 360px)", minHeight: "360px", backgroundColor: "#fff" }}
        >
          {yukleniyor ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" variant="primary" className="mb-2" />
              <span>Kayıtlar yükleniyor...</span>
            </div>
          ) : (
            <table className="table table-sm table-bordered table-hover mb-0 align-middle">
              <thead
                className="sticky-top"
                style={{
                  zIndex: 2,
                  background: "linear-gradient(180deg, #dbe8f6 0%, #c8dcf0 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                <tr className="text-secondary text-nowrap">
                  <th style={{ width: "60px", textAlign: "center", borderRight: "1px solid #b8cee6" }} className="py-1">
                    Sıra
                  </th>
                  <th style={{ width: "70px", borderRight: "1px solid #b8cee6" }} className="py-1 px-2">
                    Liste
                  </th>
                  <th style={{ width: "260px", borderRight: "1px solid #b8cee6" }} className="py-1 px-2">
                    Adı / Ünvanı
                  </th>
                  <th style={{ width: "140px", borderRight: "1px solid #b8cee6" }} className="py-1 px-2">
                    Uyruğu
                  </th>
                  <th style={{ width: "150px", borderRight: "1px solid #b8cee6" }} className="py-1 px-2">
                    Kimlik No
                  </th>
                  <th style={{ borderRight: "1px solid #b8cee6" }} className="py-1 px-2">
                    Diğer adı
                  </th>
                  <th style={{ width: "190px", borderRight: "1px solid #b8cee6" }} className="py-1 px-2">
                    Yaptırım
                  </th>
                  <th style={{ width: "70px", textAlign: "center" }} className="py-1 px-2">
                    Detay
                  </th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      {toplamKayit === 0
                        ? "Henüz liste yüklenmemiş. 'MASAK Listelerini Güncelle' ile listeleri indiriniz."
                        : "Arama kriterlerine uygun kayıt bulunamadı."}
                    </td>
                  </tr>
                ) : (
                  kayitlar.map((k, idx) => (
                    <tr
                      key={k.masakId}
                      style={{ backgroundColor: idx % 2 === 1 ? "#f9fbfd" : "#ffffff" }}
                    >
                      <td className="text-center py-1" style={{ fontSize: "0.82rem" }}>
                        {k.siraNo ?? "-"}
                      </td>
                      <td className="py-1 px-2" style={{ fontSize: "0.82rem" }}>
                        <Badge bg="secondary">{listeEtiketi(k.listeKod)}</Badge>
                      </td>
                      <td className="py-1 px-2 fw-semibold" style={{ fontSize: "0.85rem" }}>
                        {k.adUnvan}
                      </td>
                      <td className="py-1 px-2" style={{ fontSize: "0.82rem" }}>
                        {k.uyruk || "-"}
                      </td>
                      <td className="py-1 px-2 font-monospace" style={{ fontSize: "0.8rem" }}>
                        {k.tckn || k.vkn || (k.kimlikNo ? k.kimlikNo.slice(0, 22) : "-")}
                      </td>
                      <td
                        className="py-1 px-2 text-truncate"
                        style={{ fontSize: "0.8rem", maxWidth: "280px" }}
                        title={k.digerIsimler || ""}
                      >
                        {k.digerIsimler || "-"}
                      </td>
                      <td className="py-1 px-2" style={{ fontSize: "0.8rem" }}>
                        {k.yaptirimTuru || "-"}
                      </td>
                      <td className="text-center py-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="py-0 px-2"
                          onClick={() => setDetay(k)}
                          title="Kaydın tüm alanlarını göster"
                        >
                          <IconChevronRight size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Alt durum çubuğu */}
        <div
          className="d-flex flex-wrap align-items-center justify-content-between px-3 py-2 border-top text-dark"
          style={{
            background: "linear-gradient(180deg, #eef5fc 0%, #dbe8f6 100%)",
            fontSize: "0.82rem",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-secondary text-light px-2 py-1 fw-normal">
              {toplam > 0
                ? `${masakSayi((page - 1) * SAYFA_BOYUTU + 1)} - ${masakSayi(
                    Math.min(page * SAYFA_BOYUTU, toplam)
                  )} / ${masakSayi(toplam)}`
                : "Kayıt yok"}
            </span>
            <span className="text-muted small">Sayfa {page} / {sonSayfa}</span>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-1">
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-flex align-items-center gap-1"
              disabled={page <= 1 || yukleniyor}
              onClick={() => listeYukle(page - 1)}
            >
              <IconChevronLeft size={14} /> Önceki
            </Button>
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small d-flex align-items-center gap-1"
              disabled={page >= sonSayfa || yukleniyor}
              onClick={() => listeYukle(page + 1)}
            >
              Sonraki <IconChevronRight size={14} />
            </Button>
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={listele}
              disabled={yukleniyor}
              title="F4: Listele"
            >
              F4)Listele
            </Button>
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={() => {
                durumYukle();
                listeYukle(page);
              }}
              disabled={yukleniyor}
              title="F5: Yenile"
            >
              F5)Yenile
            </Button>
            <Button
              variant="light"
              size="sm"
              className="px-2 py-0 border text-dark bg-white shadow-xs fw-semibold small"
              onClick={() => window.print()}
              title="F10: Yazdır"
            >
              F10)Yazdır
            </Button>
          </div>
        </div>
      </Card>

      {/* Mevzuat hatırlatması */}
      <Card className="border mt-3" style={{ borderRadius: "6px" }}>
        <Card.Body className="p-3" style={{ fontSize: "0.8rem" }}>
          <div className="fw-bold mb-2 d-flex align-items-center gap-2">
            <IconAlertTriangle size={16} className="text-danger" />
            MASAK mevzuatı hatırlatması (5549, 6415 ve 7262 S.K.)
          </div>
          <div className="text-muted">
            Kıymetli maden, taş ve kuyum alım-satımında belirlenen parasal sınırları aşan işlemlerde
            veya şüphe duyulan hallerde tutara bakılmaksızın kimlik tespiti zorunludur. Yukarıdaki
            listelerde yer alan kişi veya kuruluşlarla işlem yapılması derhal durdurulmalı ve
            gecikmeksizin MASAK Başkanlığına bildirimde bulunulmalıdır. Resmî kaynak:{" "}
            <a href="https://ms.hmb.gov.tr/" target="_blank" rel="noopener noreferrer">
              ms.hmb.gov.tr <IconExternalLink size={12} />
            </a>
          </div>
        </Card.Body>
      </Card>

      {/* Detay modalı */}
      <Modal show={!!detay} onHide={() => setDetay(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title as="h6" className="fw-bold mb-0">
            {detay?.adUnvan}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {detay && (
            <table className="table table-sm table-bordered mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
              <tbody>
                {(
                  [
                    ["Liste", `${listeEtiketi(detay.listeKod)} — ${detay.listeAdi || "-"}`],
                    ["Sıra No", detay.siraNo],
                    ["Adı / Ünvanı", detay.adUnvan],
                    ["Kayıt tipi", detay.kayitTipi],
                    ["Kimlik / Pasaport", detay.kimlikNo],
                    ["TCKN", detay.tckn],
                    ["VKN", detay.vkn],
                    ["Diğer isimleri", detay.digerIsimler],
                    ["Orijinal dilde adı", detay.orijinalAd],
                    ["Eski adı", detay.eskiAdi],
                    ["Görevi", detay.gorevi],
                    ["Adres", detay.adres],
                    ["Uyruğu", detay.uyruk],
                    ["Diğer uyrukları", detay.digerUyruk],
                    ["Yaptırım türü", detay.yaptirimTuru],
                    ["Anne adı", detay.anneAdi],
                    ["Baba adı", detay.babaAdi],
                    ["Doğum tarihi", detay.dogumTarihi],
                    ["Doğum yeri", detay.dogumYeri],
                    ["Örgütü", detay.orgut],
                    ["Kuruluş yapısı", detay.kurulusYapisi],
                    ["Listeye alınma", detay.listeyeAlinma],
                    ["Karar bilgisi", detay.kararBilgi],
                    ["Resmî Gazete", detay.resmiGazete],
                    ["Diğer bilgiler", detay.digerBilgiler],
                  ] as [string, string | number | null | undefined][]
                )
                  .filter(([, deger]) => deger !== null && deger !== undefined && `${deger}`.trim() !== "")
                  .map(([etiket, deger]) => (
                    <tr key={etiket}>
                      <td className="bg-light fw-semibold" style={{ width: "180px" }}>
                        {etiket}
                      </td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{deger}</td>
                    </tr>
                  ))}

                {detay.ekBilgi &&
                  Object.entries(detay.ekBilgi).map(([etiket, deger]) => (
                    <tr key={`ek-${etiket}`}>
                      <td className="bg-light fw-semibold text-muted">{etiket}</td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{deger}</td>
                    </tr>
                  ))}

                <tr>
                  <td className="bg-light fw-semibold text-muted">Kaynak</td>
                  <td className="text-muted" style={{ fontSize: "0.76rem" }}>
                    {masakTarihSaat(detay.guncellemeZamani)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setDetay(null)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Güncelleme / adres giriş ekranı */}
      <MasakModal
        show={guncellemeAcik}
        onHide={() => {
          setGuncellemeAcik(false);
          durumYukle();
          listeYukle(page);
        }}
      />
    </div>
  );
};

export default MasakListsPage;
