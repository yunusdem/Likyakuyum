import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconArrowsExchange, IconBan, IconPlayerPlay } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaBekleyen, EBankaBekleyenler, EBankaCari, EBankaService } from "../../services/ebankaService";
import { CariSecModal, ModRozeti, aktarimOzeti, ibanYaz, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > D- Bekleyenler: banka fişine aktarım kuyruğu (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 2)

const FIS_TIPI = ["0- Havale Alma", "1- Havale / EFT Gönderme"];

const KARAR: Record<string, { ad: string; renk: string }> = {
  aktar: { ad: "Otomatik aktarılacak", renk: "success" },
  bekle: { ad: "Karar bekliyor", renk: "warning" },
  aktarma: { ad: "Aktarılmayacak", renk: "secondary" },
};

const karsiTaraf = (h: EBankaBekleyen): string => h.karsiUnvan || h.gonderenUnvan || h.gonderenAd || "";

export const EBankaBekleyenlerPage: React.FC = () => {
  const [veri, setVeri] = useState<EBankaBekleyenler | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [calisiyor, setCalisiyor] = useState(false);
  const [suzgec, setSuzgec] = useState<"" | "aktar" | "bekle" | "aktarma">("");
  const [secilenler, setSecilenler] = useState<Set<number>>(new Set());

  const [aktarilan, setAktarilan] = useState<EBankaBekleyen | null>(null);
  const [cari, setCari] = useState<EBankaCari | null>(null);
  const [kur, setKur] = useState("");
  const [cariSecAcik, setCariSecAcik] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const { bildir, bildirimKutusu } = useBildirim();

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setVeri(await EBankaService.getBekleyenler());
      setSecilenler(new Set());
    } catch (err: any) {
      bildir("danger", err?.message || "Bekleyenler okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bildir]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const canli = veri?.mod === "canli";
  const satirlar = useMemo(() => (veri?.satirlar || []).filter((h) => !suzgec || h.plan.karar === suzgec), [veri, suzgec]);
  const sayilar = useMemo(() => {
    const s = { aktar: 0, bekle: 0, aktarma: 0 };
    for (const h of veri?.satirlar || []) s[h.plan.karar]++;
    return s;
  }, [veri]);

  const otomatikCalistir = async () => {
    setCalisiyor(true);
    try {
      const sonuc = await EBankaService.aktarimCalistir();
      bildir(sonuc.hatali ? "warning" : "success", aktarimOzeti(sonuc));
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "Aktarım çalıştırılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  const aktarilmayacakIsaretle = async () => {
    if (!secilenler.size) return;
    setCalisiyor(true);
    try {
      const { degisen } = await EBankaService.aktarimDurumu([...secilenler], true);
      bildir("success", `${degisen} hareket aktarılmayacak olarak işaretlendi.`);
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "İşaretlenemedi.");
    } finally {
      setCalisiyor(false);
    }
  };

  const aktarPenceresiniAc = (h: EBankaBekleyen) => {
    setAktarilan(h);
    setCari(h.plan.cari);
    setKur("");
  };

  const elleAktar = async () => {
    if (!aktarilan) return;
    setKaydediliyor(true);
    try {
      const { bankaHareketId } = await EBankaService.elleAktar(aktarilan.vomsisId, cari?.cariKartId ?? null, kur ? Number(kur.replace(",", ".")) : null);
      bildir("success", `Banka fişi kesildi: #${bankaHareketId}`);
      setAktarilan(null);
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "Aktarılamadı.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const hepsiSecili = satirlar.length > 0 && satirlar.every((h) => secilenler.has(h.vomsisId));
  const secimiDegistir = (id: number) =>
    setSecilenler((onceki) => {
      const yeni = new Set(onceki);
      if (!yeni.delete(id)) yeni.add(id);
      return yeni;
    });

  return (
    <div className="ebanka-bekleyenler-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="D- e-Banka Bekleyenler"
        onRefresh={yukle}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor || calisiyor}
        modeText={`${veri?.satirlar.length ?? 0} hareket`}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <ModRozeti mod={veri?.mod} />
            <Button size="sm" variant="primary" disabled={!canli || calisiyor || !sayilar.aktar} onClick={otomatikCalistir}>
              {calisiyor ? <Spinner size="sm" className="me-1" /> : <IconPlayerPlay size={16} className="me-1" />}
              Otomatik Aktarımı Çalıştır
            </Button>
          </div>
        }
      />
      {bildirimKutusu}

      {veri && !veri.aktarimBaslangic && (
        <Alert variant="warning" className="small py-2">
          Aktarım başlangıç tarihi girilmemiş; bu yüzden hiçbir hareket aktarım kuyruğuna alınmıyor. <Link to="/ebanka/ayarlar">Ayarlar ekranından girin.</Link>
        </Alert>
      )}
      {veri && veri.aktarimBaslangic && !canli && (
        <Alert variant="light" className="border small py-2">
          Test (örnek veri) modunda <b>banka fişi kesilmez</b>. Aşağıda yalnızca Canlı modda her harekete ne olacağı gösterilir.
        </Alert>
      )}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-2 d-flex flex-wrap align-items-center gap-2">
          <Form.Select size="sm" style={{ width: "260px" }} value={suzgec} onChange={(e) => setSuzgec(e.target.value as typeof suzgec)}>
            <option value="">Tümü ({veri?.satirlar.length ?? 0})</option>
            <option value="aktar">Otomatik aktarılacak ({sayilar.aktar})</option>
            <option value="bekle">Karar bekliyor ({sayilar.bekle})</option>
            <option value="aktarma">Aktarılmayacak ({sayilar.aktarma})</option>
          </Form.Select>
          <Button size="sm" variant="outline-secondary" disabled={!secilenler.size || calisiyor} onClick={aktarilmayacakIsaretle}>
            <IconBan size={16} className="me-1" />
            Seçilenleri Aktarılmayacak İşaretle ({secilenler.size})
          </Button>
          {veri?.aktarimBaslangic && <span className="small text-muted ms-auto">Aktarım başlangıcı: {veri.aktarimBaslangic.split("-").reverse().join(".")}</span>}
        </Card.Body>
      </Card>

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "32px" }}>
                  <Form.Check
                    type="checkbox"
                    checked={hepsiSecili}
                    onChange={() => setSecilenler(hepsiSecili ? new Set() : new Set(satirlar.map((h) => h.vomsisId)))}
                  />
                </th>
                <th style={{ width: "125px" }}>Tarih</th>
                <th>Hesap</th>
                <th>Tip</th>
                <th>Karşı Taraf</th>
                <th>Açıklama</th>
                <th className="text-end">Tutar</th>
                <th>Otomatik Aktarımda</th>
                <th style={{ width: "90px" }}></th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((h) => (
                <tr key={h.vomsisId}>
                  <td>
                    <Form.Check type="checkbox" checked={secilenler.has(h.vomsisId)} onChange={() => secimiDegistir(h.vomsisId)} />
                  </td>
                  <td className="font-monospace text-nowrap">{zamanYaz(h.sistemTarihi)}</td>
                  <td className="text-nowrap">
                    {h.bankaAdi} {h.doviz}
                  </td>
                  <td className="text-nowrap">{h.tipAdi || h.tipKodu || "-"}</td>
                  <td>
                    {karsiTaraf(h) || "-"}
                    {(h.karsiVkn || h.gonderenVkn || h.gonderenTckn) && <div className="text-muted font-monospace">{h.karsiVkn || h.gonderenVkn || h.gonderenTckn}</div>}
                  </td>
                  <td className="text-truncate" style={{ maxWidth: "260px" }} title={h.aciklama || ""}>
                    {h.aciklama || ""}
                  </td>
                  <td className={`text-end font-monospace fw-bold text-nowrap ${h.tutar < 0 ? "text-danger" : "text-success"}`}>{paraYaz(h.tutar)}</td>
                  <td>
                    <Badge bg={KARAR[h.plan.karar].renk} text={h.plan.karar === "bekle" ? "dark" : undefined}>
                      {KARAR[h.plan.karar].ad}
                    </Badge>
                    <div className="text-muted">
                      {h.plan.neden}
                      {h.plan.cari && <> → {h.plan.cari.ad}</>}
                    </div>
                  </td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-primary" className="py-0" disabled={!canli || !h.bankaId || calisiyor} onClick={() => aktarPenceresiniAc(h)}>
                      Aktar…
                    </Button>
                  </td>
                </tr>
              ))}
              {satirlar.length === 0 && !yukleniyor && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-3">
                    Bekleyen hareket yok.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!aktarilan} onHide={kaydediliyor ? undefined : () => setAktarilan(null)} centered>
        <Modal.Header closeButton={!kaydediliyor} className="py-2">
          <Modal.Title className="fs-6 fw-bold">Banka Fişine Aktar</Modal.Title>
        </Modal.Header>
        {aktarilan && (
          <Modal.Body className="small">
            <Row className="g-2 mb-2">
              <Col xs={4} className="text-secondary fw-bold">
                Fiş Tipi
              </Col>
              <Col xs={8}>{FIS_TIPI[aktarilan.plan.islemTipi]}</Col>
              <Col xs={4} className="text-secondary fw-bold">
                Hesap
              </Col>
              <Col xs={8}>
                {aktarilan.bankaAdi} {aktarilan.doviz} - {aktarilan.hesapNo}
              </Col>
              <Col xs={4} className="text-secondary fw-bold">
                Tarih
              </Col>
              <Col xs={8} className="font-monospace">
                {zamanYaz(aktarilan.sistemTarihi)}
              </Col>
              <Col xs={4} className="text-secondary fw-bold">
                Tutar
              </Col>
              <Col xs={8} className="font-monospace fw-bold">
                {paraYaz(Math.abs(aktarilan.tutar))} {aktarilan.doviz}
              </Col>
              <Col xs={4} className="text-secondary fw-bold">
                Karşı Taraf
              </Col>
              <Col xs={8}>
                {karsiTaraf(aktarilan) || "-"}
                <div className="text-muted font-monospace">{[aktarilan.karsiVkn || aktarilan.gonderenVkn || aktarilan.gonderenTckn, aktarilan.karsiIban && ibanYaz(aktarilan.karsiIban)].filter(Boolean).join(" · ")}</div>
              </Col>
              <Col xs={4} className="text-secondary fw-bold">
                Açıklama
              </Col>
              <Col xs={8}>{aktarilan.aciklama || "-"}</Col>
            </Row>
            <hr className="my-2" />
            <Form.Label className="fw-bold text-secondary mb-1">Cari</Form.Label>
            <div className="d-flex align-items-center gap-2 mb-1">
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
            <div className="text-muted mb-2">
              Cari kayıtlı değilse{" "}
              <a href="/cari/kart-kayit" target="_blank" rel="noreferrer">
                yeni sekmede cari kartı açın
              </a>
              , sonra buradan seçin. Seçtiğiniz cari bu IBAN için hatırlanır; sonraki hareketler kendiliğinden eşleşir.
            </div>
            {!aktarilan.plan.tlMi && (
              <>
                <Form.Label className="fw-bold text-secondary mb-1">Kur ({aktarilan.doviz} → TL)</Form.Label>
                <Form.Control type="text" size="sm" inputMode="decimal" value={kur} onChange={(e) => setKur(e.target.value)} placeholder="Boş bırakılırsa hareket günündeki sistem kuru kullanılır" />
              </>
            )}
          </Modal.Body>
        )}
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" disabled={kaydediliyor} onClick={() => setAktarilan(null)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" disabled={kaydediliyor} onClick={elleAktar}>
            {kaydediliyor && <Spinner size="sm" className="me-1" />}
            Fişi Kes
          </Button>
        </Modal.Footer>
      </Modal>

      <CariSecModal
        show={cariSecAcik}
        ilkArama={aktarilan ? aktarilan.karsiVkn || aktarilan.gonderenVkn || aktarilan.gonderenTckn || karsiTaraf(aktarilan).slice(0, 20) : ""}
        onHide={() => setCariSecAcik(false)}
        onSec={(c) => {
          setCari(c);
          setCariSecAcik(false);
        }}
      />
    </div>
  );
};

export default EBankaBekleyenlerPage;
