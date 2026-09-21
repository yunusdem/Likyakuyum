import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Col, Form, Modal, Row, Table } from "react-bootstrap";
import { IconChevronLeft, IconChevronRight, IconRefresh, IconSearch } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaHareket, EBankaHareketListesi, EBankaHesap, EBankaService } from "../../services/ebankaService";
import { EsitlemeModal, bugun, esitlemeOzeti, gunOnce, ibanYaz, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > C- Hesap Hareketleri (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 1)

const SAYFA_BOYUTU = 100;

const AKTARIM: Record<number, { ad: string; renk: string }> = {
  0: { ad: "Bekliyor", renk: "secondary" },
  1: { ad: "Aktarıldı", renk: "success" },
  2: { ad: "Aktarılmayacak", renk: "light" },
};

const DetaySatiri: React.FC<{ ad: string; deger?: React.ReactNode; mono?: boolean }> = ({ ad, deger, mono }) =>
  deger === null || deger === undefined || deger === "" ? null : (
    <tr>
      <td className="text-secondary fw-bold text-nowrap" style={{ width: "170px" }}>
        {ad}
      </td>
      <td className={mono ? "font-monospace" : undefined}>{deger}</td>
    </tr>
  );

export const EBankaHareketlerPage: React.FC = () => {
  const [baslangic, setBaslangic] = useState(gunOnce(30));
  const [bitis, setBitis] = useState(bugun());
  const [vomsisHesapId, setVomsisHesapId] = useState("");
  const [tipKodu, setTipKodu] = useState("");
  const [tur, setTur] = useState("");
  const [aktarimDurumu, setAktarimDurumu] = useState("");
  const [arama, setArama] = useState("");
  const [sayfa, setSayfa] = useState(1);

  const [hesaplar, setHesaplar] = useState<EBankaHesap[]>([]);
  const [tipler, setTipler] = useState<{ tipKodu: string; tipAdi: string }[]>([]);
  const [liste, setListe] = useState<EBankaHareketListesi>({ satirlar: [], toplam: 0, toplamlar: [] });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secili, setSecili] = useState<EBankaHareket | null>(null);
  const [esitlemeAcik, setEsitlemeAcik] = useState(false);
  const [sonEsitleme, setSonEsitleme] = useState<string | null>(null);
  const { bildir, bildirimKutusu } = useBildirim();

  const tanimlariYukle = useCallback(async () => {
    try {
      const [h, t, a] = await Promise.all([EBankaService.getHesaplar(), EBankaService.getHareketTipleri(), EBankaService.getAyar()]);
      setHesaplar(h);
      setTipler(t);
      setSonEsitleme(a.sonEsitleme);
    } catch {
      /* filtre listeleri gelmese de hareketler listelenebilir */
    }
  }, []);

  const listele = useCallback(
    async (istenenSayfa: number) => {
      setYukleniyor(true);
      try {
        setListe(
          await EBankaService.getHareketler({
            baslangic,
            bitis,
            vomsisHesapId: vomsisHesapId ? Number(vomsisHesapId) : undefined,
            tipKodu,
            tur,
            aktarimDurumu: aktarimDurumu === "" ? undefined : Number(aktarimDurumu),
            arama: arama.trim(),
            sayfa: istenenSayfa,
            sayfaBoyutu: SAYFA_BOYUTU,
          })
        );
        setSayfa(istenenSayfa);
      } catch (err: any) {
        bildir("danger", err?.message || "Hareketler okunamadı.");
      } finally {
        setYukleniyor(false);
      }
    },
    [baslangic, bitis, vomsisHesapId, tipKodu, tur, aktarimDurumu, arama, bildir]
  );

  // Açılışta bir kez; sonraki listelemeler "Listele" ile (her tuş vuruşunda sorgu atılmasın)
  useEffect(() => {
    tanimlariYukle();
    listele(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const durumDegistir = async (h: EBankaHareket, aktarilmayacak: boolean) => {
    try {
      await EBankaService.aktarimDurumu([h.vomsisId], aktarilmayacak);
      setSecili(null);
      bildir("success", aktarilmayacak ? "Hareket aktarılmayacak olarak işaretlendi." : "Hareket bekleyenlere geri alındı.");
      listele(sayfa);
    } catch (err: any) {
      bildir("danger", err?.message || "Durum değiştirilemedi.");
    }
  };

  const sayfaSayisi = Math.max(1, Math.ceil(liste.toplam / SAYFA_BOYUTU));

  return (
    <div className="ebanka-hareketler-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="C- e-Banka Hesap Hareketleri"
        onRefresh={() => listele(sayfa)}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor}
        modeText={`${liste.toplam.toLocaleString("tr-TR")} hareket`}
        rightContent={
          <Button size="sm" variant="primary" onClick={() => setEsitlemeAcik(true)}>
            <IconRefresh size={16} className="me-1" />
            Vomsis'ten Güncelle
          </Button>
        }
      />
      {bildirimKutusu}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              listele(1);
            }}
          >
            <Row className="g-2 align-items-end">
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Başlangıç</Form.Label>
                <Form.Control type="date" size="sm" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
              </Col>
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Bitiş</Form.Label>
                <Form.Control type="date" size="sm" value={bitis} onChange={(e) => setBitis(e.target.value)} />
              </Col>
              <Col xl={3} md={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Hesap</Form.Label>
                <Form.Select size="sm" value={vomsisHesapId} onChange={(e) => setVomsisHesapId(e.target.value)}>
                  <option value="">Tümü</option>
                  {hesaplar.map((h) => (
                    <option key={h.vomsisHesapId} value={h.vomsisHesapId}>
                      {h.bankaAdi} {h.doviz} - {h.hesapNo}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xl={2} md={4} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Hareket Tipi</Form.Label>
                <Form.Select size="sm" value={tipKodu} onChange={(e) => setTipKodu(e.target.value)}>
                  <option value="">Tümü</option>
                  {tipler.map((t) => (
                    <option key={t.tipKodu} value={t.tipKodu}>
                      {t.tipAdi}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xl={1} md={2} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Yön</Form.Label>
                <Form.Select size="sm" value={tur} onChange={(e) => setTur(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="alacakli">Giriş</option>
                  <option value="borclu">Çıkış</option>
                </Form.Select>
              </Col>
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Aktarım</Form.Label>
                <Form.Select size="sm" value={aktarimDurumu} onChange={(e) => setAktarimDurumu(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="0">Bekliyor</option>
                  <option value="1">Aktarıldı</option>
                  <option value="2">Aktarılmayacak</option>
                </Form.Select>
              </Col>
              <Col xl={10} md={9}>
                <Form.Label className="small fw-bold text-secondary mb-1">Ara</Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Açıklama, ünvan, ad, IBAN, vergi no, fiş / evrak no"
                />
              </Col>
              <Col xl={2} md={3}>
                <Button type="submit" size="sm" variant="outline-primary" className="w-100" disabled={yukleniyor}>
                  <IconSearch size={16} className="me-1" />
                  Listele
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {liste.toplamlar.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {liste.toplamlar.map((t) => (
            <div key={t.doviz} className="border rounded bg-white px-3 py-1 small">
              <span className="fw-bold me-2">{t.doviz || "-"}</span>
              <span className="text-success font-monospace me-2">+{paraYaz(t.giris)}</span>
              <span className="text-danger font-monospace me-2">-{paraYaz(t.cikis)}</span>
              <span className="text-muted">({t.adet})</span>
            </div>
          ))}
        </div>
      )}

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "125px" }}>Tarih</th>
                <th>Hesap</th>
                <th>Tip</th>
                <th>Karşı Taraf</th>
                <th>Açıklama</th>
                <th className="text-end">Tutar</th>
                <th className="text-end">Bakiye</th>
                <th>Aktarım</th>
              </tr>
            </thead>
            <tbody>
              {liste.satirlar.map((h) => (
                <tr key={h.vomsisId} style={{ cursor: "pointer" }} onClick={() => setSecili(h)}>
                  <td className="font-monospace text-nowrap">{zamanYaz(h.sistemTarihi)}</td>
                  <td className="text-nowrap">
                    {h.bankaAdi} {h.doviz}
                  </td>
                  <td className="text-nowrap">{h.tipAdi || h.tipKodu || "-"}</td>
                  <td>{h.karsiUnvan || h.gonderenUnvan || h.gonderenAd || "-"}</td>
                  <td className="text-truncate" style={{ maxWidth: "340px" }} title={h.aciklama || ""}>
                    {h.aciklama || ""}
                  </td>
                  <td className={`text-end font-monospace fw-bold text-nowrap ${h.tutar < 0 ? "text-danger" : "text-success"}`}>{paraYaz(h.tutar)}</td>
                  <td className="text-end font-monospace text-nowrap">{paraYaz(h.bakiye)}</td>
                  <td>
                    <Badge bg={AKTARIM[h.aktarimDurumu].renk} text={h.aktarimDurumu === 2 ? "dark" : undefined} className={h.aktarimDurumu === 2 ? "border" : undefined}>
                      {AKTARIM[h.aktarimDurumu].ad}
                    </Badge>
                  </td>
                </tr>
              ))}
              {liste.satirlar.length === 0 && !yukleniyor && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-3">
                    Bu ölçütlere uyan hareket yok.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
        {sayfaSayisi > 1 && (
          <Card.Footer className="bg-white py-2 d-flex align-items-center justify-content-end gap-2 small">
            <span className="text-muted">
              Sayfa {sayfa} / {sayfaSayisi}
            </span>
            <Button size="sm" variant="light" className="border" disabled={yukleniyor || sayfa <= 1} onClick={() => listele(sayfa - 1)}>
              <IconChevronLeft size={16} />
            </Button>
            <Button size="sm" variant="light" className="border" disabled={yukleniyor || sayfa >= sayfaSayisi} onClick={() => listele(sayfa + 1)}>
              <IconChevronRight size={16} />
            </Button>
          </Card.Footer>
        )}
      </Card>

      <Modal show={!!secili} onHide={() => setSecili(null)} size="lg" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Hareket Detayı</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {secili && (
            <Table size="sm" className="mb-0 small">
              <tbody>
                <DetaySatiri ad="İşlem Tarihi" deger={zamanYaz(secili.sistemTarihi)} mono />
                <DetaySatiri ad="Muhasebe Tarihi" deger={zamanYaz(secili.muhasebeTarihi)} mono />
                <DetaySatiri ad="Hesap" deger={`${secili.bankaAdi} ${secili.doviz || ""} - ${secili.hesapNo || ""}`} />
                <DetaySatiri ad="Hesap IBAN" deger={secili.hesapIban && ibanYaz(secili.hesapIban)} mono />
                <DetaySatiri ad="Hareket Tipi" deger={`${secili.tipAdi || "-"}${secili.tipKodu ? ` (${secili.tipKodu})` : ""}`} />
                <DetaySatiri ad="Banka Kodu / MT940" deger={[secili.bankaTipi, secili.mt940Tipi].filter(Boolean).join(" / ")} mono />
                <DetaySatiri
                  ad="Tutar"
                  deger={
                    <span className={`fw-bold ${secili.tutar < 0 ? "text-danger" : "text-success"}`}>
                      {paraYaz(secili.tutar)} {secili.doviz}
                    </span>
                  }
                  mono
                />
                <DetaySatiri ad="İşlem Sonrası Bakiye" deger={secili.bakiye !== null ? `${paraYaz(secili.bakiye)} ${secili.doviz || ""}` : null} mono />
                <DetaySatiri ad="Açıklama" deger={secili.aciklama} />
                <DetaySatiri ad="Karşı Taraf Ünvan" deger={secili.karsiUnvan} />
                <DetaySatiri ad="Karşı Taraf IBAN" deger={secili.karsiIban && ibanYaz(secili.karsiIban)} mono />
                <DetaySatiri ad="Karşı Taraf VKN/TCKN" deger={secili.karsiVkn} mono />
                <DetaySatiri ad="Gönderen Ad" deger={secili.gonderenAd} />
                <DetaySatiri ad="Gönderen Ünvan" deger={secili.gonderenUnvan} />
                <DetaySatiri ad="Gönderen TCKN" deger={secili.gonderenTckn} mono />
                <DetaySatiri ad="Gönderen VKN" deger={secili.gonderenVkn} mono />
                <DetaySatiri ad="Gönderen IBAN" deger={secili.gonderenIban && ibanYaz(secili.gonderenIban)} mono />
                <DetaySatiri ad="Gönderen Hesap" deger={secili.gonderenSube} mono />
                <DetaySatiri ad="Alıcı IBAN" deger={secili.aliciIban && ibanYaz(secili.aliciIban)} mono />
                <DetaySatiri ad="Ödeyen VKN" deger={secili.odeyenVkn} mono />
                <DetaySatiri ad="Fiş No" deger={secili.fisNo} mono />
                <DetaySatiri ad="Evrak No" deger={secili.evrakNo} mono />
                <DetaySatiri ad="Vomsis Notu" deger={secili.notu} />
                <DetaySatiri ad="Vomsis Etiketleri" deger={secili.etiketler} />
                <DetaySatiri ad="Vomsis No" deger={secili.vomsisId} mono />
                <DetaySatiri ad="Aktarım" deger={AKTARIM[secili.aktarimDurumu].ad + (secili.bankaHareketId ? ` — Banka fişi #${secili.bankaHareketId}` : "")} />
              </tbody>
            </Table>
          )}
        </Modal.Body>
        {/* Fişi olmayan "aktarılmayacak" hareket yeniden kuyruğa alınabilir; fişi iptal edilmiş olan alınamaz (önce fiş silinmeli) */}
        {secili && secili.aktarimDurumu !== 1 && !secili.bankaHareketId && (
          <Modal.Footer className="py-2">
            <Button size="sm" variant="outline-secondary" onClick={() => durumDegistir(secili, secili.aktarimDurumu === 0)}>
              {secili.aktarimDurumu === 0 ? "Aktarılmayacak İşaretle" : "Bekleyenlere Geri Al"}
            </Button>
          </Modal.Footer>
        )}
      </Modal>

      <EsitlemeModal
        show={esitlemeAcik}
        sonEsitleme={sonEsitleme}
        onHide={() => setEsitlemeAcik(false)}
        onBitti={(s) => {
          setEsitlemeAcik(false);
          bildir("success", esitlemeOzeti(s));
          tanimlariYukle();
          listele(1);
        }}
      />
    </div>
  );
};

export default EBankaHareketlerPage;
