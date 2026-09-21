import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconRefresh, IconSearch } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaMod, EBankaService, EBankaVposIslem, EBankaVposIslemDetayi } from "../../services/ebankaService";
import { ModRozeti, SekmeDugmeleri, bugun, gunOnce, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > H- Sanal POS İşlemleri: liste, detay, iptal / iade, Vomsis müşterileri (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 4, E22, E25)

const TUR: Record<string, { ad: string; renk: string }> = {
  islem: { ad: "Ödeme", renk: "success" },
  iade: { ad: "İade edildi", renk: "warning" },
  iptal: { ad: "İptal edildi", renk: "secondary" },
};

const basarili = (i: EBankaVposIslem) => i.durumKodu === 1;

export const EBankaVposIslemlerPage: React.FC = () => {
  const [gorunum, setGorunum] = useState<"islemler" | "musteriler">("islemler");
  const [mod, setMod] = useState<EBankaMod | undefined>();
  const [islemler, setIslemler] = useState<EBankaVposIslem[]>([]);
  const [baslangic, setBaslangic] = useState(gunOnce(30));
  const [bitis, setBitis] = useState(bugun());
  const [arama, setArama] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [guncelleniyor, setGuncelleniyor] = useState(false);

  const [secili, setSecili] = useState<EBankaVposIslem | null>(null);
  const [detay, setDetay] = useState<EBankaVposIslemDetayi | null>(null);
  const [islemTuru, setIslemTuru] = useState<"" | "cancel" | "refund">("");
  const [iadeTutari, setIadeTutari] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [musteriler, setMusteriler] = useState<{ id: number | null; eposta: string | null; unvan: string | null; faturaAdedi: number }[] | null>(null);
  const { bildir, bildirimKutusu } = useBildirim();

  const listele = useCallback(async () => {
    setYukleniyor(true);
    try {
      const v = await EBankaService.getVposIslemler({ baslangic, bitis, arama: arama.trim() });
      setMod(v.mod);
      setIslemler(v.islemler);
    } catch (err: any) {
      bildir("danger", err?.message || "İşlemler okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, arama, bildir]);

  // Açılışta bir kez; sonraki listelemeler "Listele" ile
  useEffect(() => {
    listele();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guncelle = async () => {
    setGuncelleniyor(true);
    try {
      const s = await EBankaService.vposIslemleriGuncelle();
      bildir("success", `${s.adet} Sanal POS işlemi güncellendi.`);
      await listele();
    } catch (err: any) {
      bildir("danger", err?.message || "İşlemler güncellenemedi.");
    } finally {
      setGuncelleniyor(false);
    }
  };

  const detayAc = async (i: EBankaVposIslem) => {
    setSecili(i);
    setDetay(null);
    setIslemTuru("");
    setIadeTutari("");
    try {
      setDetay(await EBankaService.getVposIslemDetayi(i.referansNo));
    } catch (err: any) {
      setDetay({ yerel: i, vomsis: null, vomsisHatasi: err?.message || "Detay alınamadı." });
    }
  };

  const iptalIade = async () => {
    if (!secili || !islemTuru) return;
    setGonderiliyor(true);
    try {
      const s = await EBankaService.vposIptalIade(secili.referansNo, islemTuru, islemTuru === "refund" ? iadeTutari : undefined);
      bildir("success", `${islemTuru === "cancel" ? "İptal" : "İade"} onaylandı (${paraYaz(s.tutar)}). ${s.muhasebe}`);
      setSecili(null);
      await listele();
    } catch (err: any) {
      bildir("danger", err?.message || "İşlem yapılamadı.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const sonucuSorgula = async () => {
    if (!secili) return;
    setGonderiliyor(true);
    try {
      const s = await EBankaService.vposOdemeSonucu(secili.referansNo);
      bildir(s.durum === "basarili" ? "success" : s.durum === "basarisiz" ? "danger" : "warning", `${s.durum === "basarili" ? "Ödeme başarılı." : s.durum === "basarisiz" ? "Ödeme başarısız." : "Sonuç henüz yok."} ${s.mesaj}`);
      setSecili(null);
      await listele();
    } catch (err: any) {
      bildir("danger", err?.message || "Sonuç sorgulanamadı.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const musterileriAc = async () => {
    setGorunum("musteriler");
    if (musteriler) return;
    try {
      setMusteriler(await EBankaService.getVomsisMusterileri());
    } catch (err: any) {
      setMusteriler([]);
      bildir("danger", err?.message || "Vomsis müşterileri okunamadı.");
    }
  };

  const iptalEdilebilir = !!secili && basarili(secili) && (!secili.tur || secili.tur === "islem");

  return (
    <div className="ebanka-vpos-islemler-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="H- e-Banka Sanal POS İşlemleri"
        onRefresh={listele}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor || guncelleniyor}
        modeText={`${islemler.length} işlem`}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <ModRozeti mod={mod} />
            <Button size="sm" variant="primary" disabled={guncelleniyor} onClick={guncelle}>
              {guncelleniyor ? <Spinner size="sm" className="me-1" /> : <IconRefresh size={16} className="me-1" />}
              Vomsis'ten Güncelle
            </Button>
          </div>
        }
      />
      {bildirimKutusu}

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Header className="bg-white py-2">
          <SekmeDugmeleri<typeof gorunum>
            secili={gorunum}
            onSec={(k) => (k === "musteriler" ? musterileriAc() : setGorunum("islemler"))}
            secenekler={[
              { anahtar: "islemler", ad: "İşlemler" },
              { anahtar: "musteriler", ad: "Vomsis Müşterileri" },
            ]}
          />
        </Card.Header>

        {gorunum === "islemler" && (
          <>
            <Card.Body className="p-2 border-bottom">
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  listele();
                }}
              >
                <Row className="g-2 align-items-end">
                  <Col md={2} xs={6}>
                    <Form.Label className="small fw-bold text-secondary mb-1">Başlangıç</Form.Label>
                    <Form.Control type="date" size="sm" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
                  </Col>
                  <Col md={2} xs={6}>
                    <Form.Label className="small fw-bold text-secondary mb-1">Bitiş</Form.Label>
                    <Form.Control type="date" size="sm" value={bitis} onChange={(e) => setBitis(e.target.value)} />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-bold text-secondary mb-1">Ara</Form.Label>
                    <Form.Control type="text" size="sm" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Referans no, açıklama, kart no, müşteri, cari" />
                  </Col>
                  <Col md={2}>
                    <Button type="submit" size="sm" variant="outline-primary" className="w-100" disabled={yukleniyor}>
                      <IconSearch size={16} className="me-1" />
                      Listele
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
            <Card.Body className="p-0">
              <Table size="sm" hover responsive className="mb-0 small align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Tarih</th>
                    <th>Referans No</th>
                    <th>Cari / Müşteri</th>
                    <th>Açıklama</th>
                    <th>Kart</th>
                    <th className="text-center">Taksit</th>
                    <th className="text-end">Tutar</th>
                    <th>Durum</th>
                    <th>Tahsilat Fişi</th>
                  </tr>
                </thead>
                <tbody>
                  {islemler.map((i) => (
                    <tr key={i.referansNo} style={{ cursor: "pointer" }} onClick={() => detayAc(i)}>
                      <td className="font-monospace text-nowrap">{zamanYaz(i.islemTarihi)}</td>
                      <td className="font-monospace">{i.referansNo}</td>
                      <td>{i.cariAdi ? `${i.cariKod} - ${i.cariAdi}` : i.musteri || "-"}</td>
                      <td className="text-truncate" style={{ maxWidth: "240px" }} title={i.aciklama || ""}>
                        {i.aciklama || ""}
                      </td>
                      <td className="font-monospace text-nowrap">
                        {i.kartNo || "-"} <span className="text-muted">{i.kartAilesi || ""}</span>
                      </td>
                      <td className="text-center">{i.taksit && i.taksit > 1 ? i.taksit : ""}</td>
                      <td className="text-end font-monospace fw-bold text-nowrap">
                        {paraYaz(i.tutar)} {i.paraBirimi}
                        {i.iadeTutar ? <div className="text-danger fw-normal">-{paraYaz(i.iadeTutar)}</div> : null}
                      </td>
                      <td>
                        {i.tur === "bekliyor" ? (
                          <Badge bg="warning" text="dark">
                            3D bekliyor
                          </Badge>
                        ) : basarili(i) ? (
                          <Badge bg={(TUR[i.tur || "islem"] || TUR.islem).renk} text={i.tur === "iade" ? "dark" : undefined}>
                            {(TUR[i.tur || "islem"] || { ad: i.tur }).ad}
                          </Badge>
                        ) : (
                          <Badge bg="danger" title={i.hataMesaji || ""}>
                            Başarısız
                          </Badge>
                        )}
                      </td>
                      <td>{i.bankaHareketId && i.bankaHareketId > 0 ? <Badge bg="success">#{i.bankaHareketId}</Badge> : ""}</td>
                    </tr>
                  ))}
                  {islemler.length === 0 && !yukleniyor && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-3">
                        İşlem yok. "Vomsis'ten Güncelle" ile çekin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </>
        )}

        {gorunum === "musteriler" && (
          <Card.Body className="p-0">
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "90px" }}>Vomsis No</th>
                  <th>Ünvan</th>
                  <th>E-posta</th>
                  <th className="text-end">Fatura Bilgisi</th>
                </tr>
              </thead>
              <tbody>
                {musteriler?.map((m, s) => (
                  <tr key={m.id ?? s}>
                    <td className="font-monospace">{m.id ?? "-"}</td>
                    <td>{m.unvan || "-"}</td>
                    <td>{m.eposta || "-"}</td>
                    <td className="text-end">{m.faturaAdedi}</td>
                  </tr>
                ))}
                {(!musteriler || musteriler.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      {musteriler ? "Vomsis'te kayıtlı müşteri yok." : "Yükleniyor…"}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card.Body>
        )}
      </Card>

      <Modal show={!!secili} onHide={gonderiliyor ? undefined : () => setSecili(null)} size="lg" centered>
        <Modal.Header closeButton={!gonderiliyor} className="py-2">
          <Modal.Title className="fs-6 fw-bold">Sanal POS İşlemi</Modal.Title>
        </Modal.Header>
        {secili && (
          <Modal.Body className="small">
            <Row className="g-1">
              {(
                [
                  ["Referans No", secili.referansNo],
                  ["Tarih", zamanYaz(secili.islemTarihi)],
                  ["Cari", secili.cariAdi ? `${secili.cariKod} - ${secili.cariAdi}` : null],
                  ["Müşteri", secili.musteri],
                  ["Açıklama", secili.aciklama],
                  ["Tutar", `${paraYaz(secili.tutar)} ${secili.paraBirimi || ""}`],
                  ["Karttan Çekilen", detay?.vomsis?.paidAmount ? `${paraYaz(Number(detay.vomsis.paidAmount))} ${secili.paraBirimi || ""}` : null],
                  ["Taksit", secili.taksit],
                  ["Vade Farkı Oranı", detay?.vomsis?.installmentRatio && Number(detay.vomsis.installmentRatio) ? `%${detay.vomsis.installmentRatio}` : null],
                  ["Kart", [secili.kartNo, secili.kartBanka, secili.kartAilesi].filter(Boolean).join(" · ")],
                  ["Sanal POS", secili.posAdi],
                  ["Vomsis Durumu", detay?.vomsis?.status],
                  ["Hata", [secili.hataKodu && secili.hataKodu !== "00" ? secili.hataKodu : null, secili.hataMesaji].filter(Boolean).join(" ")],
                  ["İade Tutarı", secili.iadeTutar ? paraYaz(secili.iadeTutar) : null],
                  ["Tahsilat Fişi", secili.bankaHareketId && secili.bankaHareketId > 0 ? `#${secili.bankaHareketId}` : null],
                  ["İade Fişi", secili.iadeBankaHareketId ? `#${secili.iadeBankaHareketId}` : null],
                ] as [string, React.ReactNode][]
              )
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([ad, deger]) => (
                  <React.Fragment key={ad}>
                    <Col xs={4} className="text-secondary fw-bold">
                      {ad}
                    </Col>
                    <Col xs={8}>{deger}</Col>
                  </React.Fragment>
                ))}
            </Row>
            {!detay && <div className="text-muted mt-2">Vomsis'ten detay alınıyor…</div>}
            {detay?.vomsisHatasi && (
              <Alert variant="light" className="border py-1 mt-2 mb-0">
                Vomsis detayı alınamadı: {detay.vomsisHatasi}
              </Alert>
            )}

            {iptalEdilebilir && (
              <>
                <hr className="my-2" />
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <Form.Check type="radio" id="vpos-cancel" name="vpos-tur" label="İptal (tamamı, gün içinde)" checked={islemTuru === "cancel"} onChange={() => setIslemTuru("cancel")} />
                  <Form.Check type="radio" id="vpos-refund" name="vpos-tur" label="İade" checked={islemTuru === "refund"} onChange={() => { setIslemTuru("refund"); setIadeTutari(secili.tutar.toFixed(2)); }} />
                  {islemTuru === "refund" && (
                    <Form.Control type="text" size="sm" inputMode="decimal" style={{ width: "130px" }} className="font-monospace" value={iadeTutari} onChange={(e) => setIadeTutari(e.target.value)} />
                  )}
                </div>
                {islemTuru && (
                  <Alert variant="warning" className="py-1 mt-2 mb-0">
                    {islemTuru === "cancel"
                      ? "Karttan çekilen tutarın tamamı iptal edilir; bağlı tahsilat fişi varsa iptal edilir."
                      : "Girilen tutar karta iade edilir; bağlı tahsilat fişi varsa iade tutarı kadar Havale/EFT Gönderme fişi kesilir."}{" "}
                    Bu işlem geri alınamaz.
                  </Alert>
                )}
              </>
            )}
          </Modal.Body>
        )}
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" disabled={gonderiliyor} onClick={() => setSecili(null)}>
            Kapat
          </Button>
          {/* 3D'si yarım kalmış ya da tahsilat fişi kesilememiş kartlı ödeme: sonuç Vomsis'e yeniden sorulur, başarılıysa fiş kesilir */}
          {secili && !secili.linkUid && (secili.tur === "bekliyor" || (basarili(secili) && secili.tur === "islem" && !secili.bankaHareketId && secili.cariKartId)) && (
            <Button size="sm" variant="outline-primary" disabled={gonderiliyor} onClick={sonucuSorgula}>
              {gonderiliyor && <Spinner size="sm" className="me-1" />}
              Sonucu Sorgula
            </Button>
          )}
          {iptalEdilebilir && islemTuru && (
            <Button size="sm" variant="danger" disabled={gonderiliyor || (islemTuru === "refund" && !iadeTutari.trim())} onClick={iptalIade}>
              {gonderiliyor && <Spinner size="sm" className="me-1" />}
              {islemTuru === "cancel" ? "İşlemi İptal Et" : "İadeyi Yap"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EBankaVposIslemlerPage;
