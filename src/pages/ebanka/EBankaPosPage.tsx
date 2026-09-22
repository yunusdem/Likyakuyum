import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconArrowsExchange, IconChevronLeft, IconChevronRight, IconFileSpreadsheet, IconReceipt, IconRefresh, IconSearch } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { EBankaCari, EBankaPosEsitlemeSonucu, EBankaPosListesi, EBankaPosOzet, EBankaService } from "../../services/ebankaService";
import { CariSecModal, EsitlemeModal, ModRozeti, SekmeDugmeleri, bugun, gunOnce, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > E- POS Terminalleri ve Hareketleri (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 3, E21)
// Yalnızca izleme. İki işlem: Excel / muhasebe fişi dökümü ve seçilen satırlardan elle banka fişi.

const SAYFA_BOYUTU = 100;
const gunYaz = (g: string | null): string => (g ? g.split("-").reverse().join(".") : "-");

export const EBankaPosPage: React.FC = () => {
  const [ozet, setOzet] = useState<EBankaPosOzet | null>(null);
  const [liste, setListe] = useState<EBankaPosListesi>({ satirlar: [], toplam: 0, toplamlar: [], gunluk: [] });
  const [gorunum, setGorunum] = useState<"hareketler" | "gunluk" | "terminaller">("hareketler");

  const [baslangic, setBaslangic] = useState(gunOnce(14));
  const [bitis, setBitis] = useState(bugun());
  const [vomsisTerminalId, setVomsisTerminalId] = useState("");
  const [fisDurumu, setFisDurumu] = useState("");
  const [arama, setArama] = useState("");
  const [sayfa, setSayfa] = useState(1);

  const [yukleniyor, setYukleniyor] = useState(true);
  const [excelIniyor, setExcelIniyor] = useState(false);
  const [esitlemeAcik, setEsitlemeAcik] = useState(false);
  const [secilenler, setSecilenler] = useState<Set<number>>(new Set());

  const [fisAcik, setFisAcik] = useState(false);
  const [kartlar, setKartlar] = useState<BankaHesapItem[]>([]);
  const [bankaId, setBankaId] = useState("");
  const [cari, setCari] = useState<EBankaCari | null>(null);
  const [fisTarihi, setFisTarihi] = useState(bugun());
  const [kur, setKur] = useState("");
  const [cariSecAcik, setCariSecAcik] = useState(false);
  const [fisKesiliyor, setFisKesiliyor] = useState(false);
  const { bildir, bildirimKutusu } = useBildirim();

  const filtre = useMemo(
    () => ({ baslangic, bitis, vomsisTerminalId: vomsisTerminalId ? Number(vomsisTerminalId) : undefined, fisDurumu, arama: arama.trim() }),
    [baslangic, bitis, vomsisTerminalId, fisDurumu, arama]
  );

  const ozetYukle = useCallback(async () => {
    try {
      setOzet(await EBankaService.getPosOzet());
    } catch (err: any) {
      bildir("danger", err?.message || "POS terminalleri okunamadı.");
    }
  }, [bildir]);

  const listele = useCallback(
    async (istenenSayfa: number) => {
      setYukleniyor(true);
      try {
        setListe(await EBankaService.getPosHareketleri({ ...filtre, sayfa: istenenSayfa, sayfaBoyutu: SAYFA_BOYUTU }));
        setSayfa(istenenSayfa);
        setSecilenler(new Set());
      } catch (err: any) {
        bildir("danger", err?.message || "POS hareketleri okunamadı.");
      } finally {
        setYukleniyor(false);
      }
    },
    [filtre, bildir]
  );

  // Açılışta bir kez; sonraki listelemeler "Listele" ile
  useEffect(() => {
    ozetYukle();
    listele(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canli = ozet?.mod === "canli";
  const sayfaSayisi = Math.max(1, Math.ceil(liste.toplam / SAYFA_BOYUTU));
  const secilebilirler = liste.satirlar.filter((h) => h.bankaHareketId === null);
  const hepsiSecili = secilebilirler.length > 0 && secilebilirler.every((h) => secilenler.has(h.vomsisId));
  const seciliSatirlar = liste.satirlar.filter((h) => secilenler.has(h.vomsisId));
  const seciliNet = Math.round(seciliSatirlar.reduce((t, h) => t + h.net, 0) * 100) / 100;
  const seciliDovizler = [...new Set(seciliSatirlar.map((h) => h.doviz || "TL"))];

  const excelIndir = async () => {
    setExcelIniyor(true);
    try {
      await EBankaService.posExcelIndir(filtre);
    } catch (err: any) {
      bildir("danger", err?.message || "Excel dosyası alınamadı.");
    } finally {
      setExcelIniyor(false);
    }
  };

  const fisPenceresiniAc = async () => {
    setFisAcik(true);
    setCari(null);
    setKur("");
    // Varsayılan fiş tarihi: seçilenlerin en geç valörü (para o gün hesaba geçer)
    const valorler = seciliSatirlar.map((h) => h.valor || h.islemTarihi || "").filter(Boolean).sort();
    setFisTarihi(valorler[valorler.length - 1] || bugun());
    if (!kartlar.length) {
      try {
        setKartlar(await BankaService.getBankalar({ aktif: true }));
      } catch {
        setKartlar([]);
      }
    }
  };

  const fisKes = async () => {
    setFisKesiliyor(true);
    try {
      const s = await EBankaService.posFisKes({
        vomsisIdler: [...secilenler],
        bankaId: Number(bankaId),
        cariKartId: cari?.cariKartId ?? null,
        tarih: fisTarihi,
        kur: kur ? Number(kur.replace(",", ".")) : null,
      });
      bildir("success", `Banka fişi kesildi: #${s.bankaHareketId} (${s.adet} işlem, net ${paraYaz(s.net)})`);
      setFisAcik(false);
      await listele(sayfa);
    } catch (err: any) {
      bildir("danger", err?.message || "Banka fişi oluşturulamadı.");
    } finally {
      setFisKesiliyor(false);
    }
  };

  const secimiDegistir = (id: number) =>
    setSecilenler((onceki) => {
      const yeni = new Set(onceki);
      if (!yeni.delete(id)) yeni.add(id);
      return yeni;
    });

  return (
    <div className="ebanka-pos-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="E- e-Banka POS Terminalleri ve Hareketleri"
        onRefresh={() => {
          ozetYukle();
          listele(sayfa);
        }}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor}
        modeText={`Son güncelleme: ${zamanYaz(ozet?.sonEsitleme)}`}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <ModRozeti mod={ozet?.mod} />
            <Button size="sm" variant="primary" onClick={() => setEsitlemeAcik(true)}>
              <IconRefresh size={16} className="me-1" />
              Bankadan Güncelle
            </Button>
          </div>
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
                <Form.Label className="small fw-bold text-secondary mb-1">Terminal</Form.Label>
                <Form.Select size="sm" value={vomsisTerminalId} onChange={(e) => setVomsisTerminalId(e.target.value)}>
                  <option value="">Tümü</option>
                  {ozet?.terminaller.map((t) => (
                    <option key={t.vomsisTerminalId} value={t.vomsisTerminalId}>
                      {t.bankaAdi} - {t.ozelAd || t.terminalNo}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xl={2} md={4} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Banka Fişi</Form.Label>
                <Form.Select size="sm" value={fisDurumu} onChange={(e) => setFisDurumu(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="yok">Fişi kesilmemiş</option>
                  <option value="var">Fişi kesilmiş</option>
                </Form.Select>
              </Col>
              <Col xl={2} md={5} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Ara</Form.Label>
                <Form.Control type="text" size="sm" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Kart no, provizyon, batch" />
              </Col>
              <Col xl={1} md={3}>
                <Button type="submit" size="sm" variant="outline-primary" className="w-100" disabled={yukleniyor}>
                  <IconSearch size={16} />
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        {liste.toplamlar.map((t) => (
          <div key={t.doviz} className="border rounded bg-white px-3 py-1 small">
            <span className="fw-bold me-2">{t.doviz || "-"}</span>
            <span className="me-2">
              Brüt <span className="font-monospace">{paraYaz(t.brut)}</span>
            </span>
            <span className="text-danger me-2">
              Komisyon <span className="font-monospace">{paraYaz(t.komisyon)}</span>
            </span>
            <span className="text-success fw-bold me-2">
              Net <span className="font-monospace">{paraYaz(t.net)}</span>
            </span>
            <span className="text-muted">({t.adet})</span>
          </div>
        ))}
        <div className="ms-auto d-flex gap-2">
          <Button size="sm" variant="outline-success" disabled={excelIniyor || !liste.toplam} onClick={excelIndir}>
            {excelIniyor ? <Spinner size="sm" className="me-1" /> : <IconFileSpreadsheet size={16} className="me-1" />}
            Excel / Muhasebe Fişi Dökümü
          </Button>
          <Button size="sm" variant="outline-primary" disabled={!canli || !secilenler.size || seciliDovizler.length > 1} onClick={fisPenceresiniAc}>
            <IconReceipt size={16} className="me-1" />
            Banka Fişi Oluştur ({secilenler.size})
          </Button>
        </div>
      </div>
      {!canli && ozet && (
        <Alert variant="light" className="border small py-2">
          Test (örnek veri) modunda banka fişi kesilmez; "Banka Fişi Oluştur" yalnızca Canlı modda çalışır.
        </Alert>
      )}

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Header className="bg-white py-2">
          <SekmeDugmeleri<typeof gorunum>
            secili={gorunum}
            onSec={setGorunum}
            secenekler={[
              { anahtar: "hareketler", ad: "Hareketler" },
              { anahtar: "gunluk", ad: "Gün / Terminal Toplamları" },
              { anahtar: "terminaller", ad: `Terminaller (${ozet?.terminaller.length ?? 0})` },
            ]}
          />
        </Card.Header>
        <Card.Body className="p-0">
          {gorunum === "hareketler" && (
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "32px" }}>
                    <Form.Check
                      type="checkbox"
                      checked={hepsiSecili}
                      disabled={!secilebilirler.length}
                      onChange={() => setSecilenler(hepsiSecili ? new Set() : new Set(secilebilirler.map((h) => h.vomsisId)))}
                    />
                  </th>
                  <th>Tarih</th>
                  <th>Terminal</th>
                  <th>Kart</th>
                  <th>İşlem</th>
                  <th className="text-center">Taksit</th>
                  <th className="text-end">Brüt</th>
                  <th className="text-end">Komisyon</th>
                  <th className="text-end">Net</th>
                  <th>Valör</th>
                  <th>Banka Fişi</th>
                </tr>
              </thead>
              <tbody>
                {liste.satirlar.map((h) => (
                  <tr key={h.vomsisId}>
                    <td>
                      <Form.Check type="checkbox" checked={secilenler.has(h.vomsisId)} disabled={h.bankaHareketId !== null} onChange={() => secimiDegistir(h.vomsisId)} />
                    </td>
                    <td className="font-monospace text-nowrap">
                      {gunYaz(h.islemTarihi)} {h.saat?.slice(0, 5) || ""}
                    </td>
                    <td className="text-nowrap">
                      {h.bankaAdi} - {h.terminalAdi}
                    </td>
                    <td className="font-monospace text-nowrap">
                      {h.kartNo || "-"} <span className="text-muted">{h.kartTipi || ""}</span>
                    </td>
                    <td>
                      {h.islemTipi || "-"} <span className="text-muted">{h.aciklama || ""}</span>
                    </td>
                    <td className="text-center">{h.taksitSayisi || ""}</td>
                    <td className="text-end font-monospace text-nowrap">{paraYaz(h.brut)}</td>
                    <td className="text-end font-monospace text-nowrap text-danger">
                      {paraYaz(h.komisyon)}
                      {h.komisyonOrani !== null && <span className="text-muted"> %{paraYaz(h.komisyonOrani)}</span>}
                    </td>
                    <td className="text-end font-monospace fw-bold text-nowrap text-success">{paraYaz(h.net)}</td>
                    <td className="font-monospace text-nowrap">{gunYaz(h.valor)}</td>
                    <td>{h.bankaHareketId && h.bankaHareketId > 0 ? <Badge bg="success">#{h.bankaHareketId}</Badge> : h.bankaHareketId === -1 ? <Badge bg="secondary">Kesiliyor</Badge> : ""}</td>
                  </tr>
                ))}
                {liste.satirlar.length === 0 && !yukleniyor && (
                  <tr>
                    <td colSpan={11} className="text-center text-muted py-3">
                      Bu ölçütlere uyan POS hareketi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}

          {gorunum === "gunluk" && (
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th>Tarih</th>
                  <th>Terminal</th>
                  <th>Döviz</th>
                  <th className="text-end">İşlem</th>
                  <th className="text-end">Brüt</th>
                  <th className="text-end">Komisyon</th>
                  <th className="text-end">Net</th>
                  <th>Valör</th>
                </tr>
              </thead>
              <tbody>
                {liste.gunluk.map((g) => (
                  <tr key={`${g.islemTarihi}-${g.vomsisTerminalId}-${g.doviz}`}>
                    <td className="font-monospace">{gunYaz(g.islemTarihi)}</td>
                    <td>
                      {g.bankaAdi} - {g.terminalAdi}
                    </td>
                    <td>{g.doviz}</td>
                    <td className="text-end">{g.adet}</td>
                    <td className="text-end font-monospace">{paraYaz(g.brut)}</td>
                    <td className="text-end font-monospace text-danger">{paraYaz(g.komisyon)}</td>
                    <td className="text-end font-monospace fw-bold text-success">{paraYaz(g.net)}</td>
                    <td className="font-monospace">{gunYaz(g.valor)}</td>
                  </tr>
                ))}
                {liste.gunluk.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-3">
                      Kayıt yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}

          {gorunum === "terminaller" && (
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th>Banka</th>
                  <th>Terminal Adı</th>
                  <th>Terminal No</th>
                  <th>İşyeri No</th>
                  <th>İşyeri Adı</th>
                  <th>Döviz</th>
                  <th className="text-end">Tek Çekim Komisyon %</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {ozet?.terminaller.map((t) => (
                  <tr key={t.vomsisTerminalId}>
                    <td className="fw-semibold">{t.bankaAdi}</td>
                    <td>{t.ozelAd || "-"}</td>
                    <td className="font-monospace">{t.terminalNo || "-"}</td>
                    <td className="font-monospace">{t.isyeriNo || "-"}</td>
                    <td>{t.isyeriAdi || "-"}</td>
                    <td>{t.doviz || "-"}</td>
                    <td className="text-end font-monospace">{paraYaz(t.komisyonOrani)}</td>
                    <td>
                      <Badge bg={t.aktif ? "success" : "secondary"}>{t.aktif ? "Aktif" : "Pasif"}</Badge>
                    </td>
                  </tr>
                ))}
                {!ozet?.terminaller.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-3">
                      Terminal yok. "Bankadan Güncelle" ile çekin.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
        {gorunum === "hareketler" && sayfaSayisi > 1 && (
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

      <Modal show={fisAcik} onHide={fisKesiliyor ? undefined : () => setFisAcik(false)} centered>
        <Modal.Header closeButton={!fisKesiliyor} className="py-2">
          <Modal.Title className="fs-6 fw-bold">POS Hareketlerinden Banka Fişi</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <div className="mb-2">
            {seciliSatirlar.length} işlemin net toplamı için <b>0- Havale Alma</b> fişi kesilir:{" "}
            <span className="font-monospace fw-bold text-success">
              {paraYaz(seciliNet)} {seciliDovizler[0]}
            </span>
          </div>
          <Form.Label className="fw-bold text-secondary mb-1">Banka Hesabı</Form.Label>
          <Form.Select size="sm" className="mb-2" value={bankaId} onChange={(e) => setBankaId(e.target.value)}>
            <option value="">Seçiniz</option>
            {kartlar.map((k) => (
              <option key={k.bankaId} value={k.bankaId}>
                {k.hesapNo} - {k.hesapAdi}
              </option>
            ))}
          </Form.Select>
          <Form.Label className="fw-bold text-secondary mb-1">Fiş Tarihi</Form.Label>
          <Form.Control type="date" size="sm" className="mb-2" style={{ maxWidth: "170px" }} value={fisTarihi} onChange={(e) => setFisTarihi(e.target.value)} />
          <Form.Label className="fw-bold text-secondary mb-1">Cari</Form.Label>
          <div className="d-flex align-items-center gap-2 mb-2">
            <div className="flex-grow-1 border rounded px-2 py-1 bg-light">{cari ? `${cari.kod} - ${cari.ad}` : "Carisiz (fişte cari olmaz)"}</div>
            <Button size="sm" variant="outline-primary" onClick={() => setCariSecAcik(true)}>
              <IconArrowsExchange size={16} className="me-1" />
              Seç
            </Button>
            {cari && (
              <Button size="sm" variant="light" className="border" onClick={() => setCari(null)}>
                Kaldır
              </Button>
            )}
          </div>
          {seciliDovizler[0] && !["TL", "TRY"].includes(seciliDovizler[0].toUpperCase()) && (
            <>
              <Form.Label className="fw-bold text-secondary mb-1">Kur ({seciliDovizler[0]} → TL)</Form.Label>
              <Form.Control type="text" size="sm" inputMode="decimal" value={kur} onChange={(e) => setKur(e.target.value)} placeholder="Boş bırakılırsa fiş günündeki sistem kuru kullanılır" />
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" disabled={fisKesiliyor} onClick={() => setFisAcik(false)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" disabled={fisKesiliyor || !bankaId || !fisTarihi} onClick={fisKes}>
            {fisKesiliyor && <Spinner size="sm" className="me-1" />}
            Fişi Kes
          </Button>
        </Modal.Footer>
      </Modal>

      <CariSecModal
        show={cariSecAcik}
        onHide={() => setCariSecAcik(false)}
        onSec={(c) => {
          setCari(c);
          setCariSecAcik(false);
        }}
      />

      <EsitlemeModal<EBankaPosEsitlemeSonucu>
        show={esitlemeAcik}
        sonEsitleme={ozet?.sonEsitleme ?? null}
        varsayilanGun={14}
        calistir={(bas, bit) => EBankaService.posEsitle(bas, bit)}
        aciklama="POS terminalleri ve seçilen aralıktaki POS hareketleri çekilir (banka 14 günlük dilimlerle verir; uzun aralık uzun sürer). Daha önce çekilmiş hareketler yeniden eklenmez."
        onHide={() => setEsitlemeAcik(false)}
        onBitti={(s) => {
          setEsitlemeAcik(false);
          bildir("success", `${s.terminalAdedi} terminal güncellendi, ${s.yeniHareket} yeni POS hareketi eklendi${s.guncellenenHareket ? `, ${s.guncellenenHareket} hareket güncellendi` : ""}.`);
          ozetYukle();
          listele(1);
        }}
      />
    </div>
  );
};

export default EBankaPosPage;
