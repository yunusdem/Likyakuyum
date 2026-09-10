import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconInbox, IconCloudDownload } from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import EBelgeDetayModal from "./EBelgeDetayModal";
import {
  EbelgeGelenSatiri,
  ebelgeRedKabulRozet,
  ebelgeService,
  ebelgeTarihSaat,
  ebelgeTicariMi,
  ebelgeTutar,
} from "../../services/ebelgeService";

/**
 * E-Belge Gelen Kutusu (Faz 3 — okuma)
 *
 * Liste yerel aynadan (TODVZ_EBELGE_GELEN) okunur; "Senkronize Et" ICE'ye çıkar.
 * Böylece ekran her açılışta entegratöre yük bindirmez ve internet yokken de çalışır.
 *
 * Arayüz kuralları: docs/ice-baglanti.md §15
 */

type AlertInfo = { type: "success" | "danger" | "warning" | "info"; message: string } | null;

const SAYFA_BOYUTU = 50;

const bugunISO = () => new Date().toISOString().slice(0, 10);
const gunOnceISO = (gun: number) =>
  new Date(Date.now() - gun * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const EBelgeGelenPage: React.FC = () => {
  const [kayitlar, setKayitlar] = useState<EbelgeGelenSatiri[]>([]);
  const [toplam, setToplam] = useState<number>(0);
  const [sayfa, setSayfa] = useState<number>(1);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);
  const [senkronEdiliyor, setSenkronEdiliyor] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>(null);
  const [seciliUuid, setSeciliUuid] = useState<string | null>(null);
  const [acikUuid, setAcikUuid] = useState<string | null>(null);

  const [baslangicTarihi, setBaslangicTarihi] = useState<string>(gunOnceISO(30));
  const [bitisTarihi, setBitisTarihi] = useState<string>(bugunISO());
  const [arama, setArama] = useState<string>("");
  const [redKabulFiltre, setRedKabulFiltre] = useState<"TUMU" | "BEKLEYEN" | "Kabul" | "Red">("TUMU");

  const listeYukle = useCallback(
    async (hedefSayfa = sayfa) => {
      setYukleniyor(true);
      try {
        const sonuc = await ebelgeService.listGelen({
          sayfa: hedefSayfa,
          boyut: SAYFA_BOYUTU,
          baslangicTarihi: baslangicTarihi || undefined,
          bitisTarihi: bitisTarihi ? `${bitisTarihi}T23:59:59` : undefined,
          arama: arama.trim() || undefined,
          redKabul: redKabulFiltre === "TUMU" ? undefined : redKabulFiltre,
        });
        setKayitlar(sonuc.kayitlar);
        setToplam(sonuc.toplam);
        setSayfa(hedefSayfa);
      } catch (err: any) {
        setAlertInfo({ type: "danger", message: err?.message || "Liste alınamadı." });
      } finally {
        setYukleniyor(false);
      }
    },
    [sayfa, baslangicTarihi, bitisTarihi, arama, redKabulFiltre]
  );

  useEffect(() => {
    listeYukle(1);
    // İlk yükleme; filtre değişimlerinde "Filtrele" düğmesi kullanılır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const senkronizeEt = async () => {
    setSenkronEdiliyor(true);
    setAlertInfo(null);
    try {
      const sonuc = await ebelgeService.senkronizeGelen(30, 200);
      setAlertInfo({
        type: "success",
        message:
          `Senkronizasyon tamamlandı: ${sonuc.yazilan} belge güncellendi ` +
          `(entegratörde toplam ${sonuc.toplamIce}, çekilen ${sonuc.cekilen}, ${sonuc.sureMs} ms).`,
      });
      await listeYukle(1);
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Senkronizasyon yapılamadı." });
    } finally {
      setSenkronEdiliyor(false);
    }
  };

  const sonSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);

  return (
    <div className="ebelge-gelen-container container-fluid px-2 py-2">
      <ERPToolbar
        pageTitle="E- Belge Gelen Kutusu"
        pageIcon={<IconInbox size={22} className="text-primary" />}
        onRefresh={() => listeYukle(sayfa)}
        onSearch={() => {
          const kutu = document.querySelector<HTMLInputElement>("input[placeholder*='Ara' i]");
          kutu?.focus();
        }}
        onPrint={() => window.print()}
        disabled={yukleniyor || senkronEdiliyor}
      />

      {/* Kapsam: ICE gelen kutusu yalnız e-Fatura döndürür. Diğer türler burada listelenmez. */}
      <Alert variant="secondary" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
        Bu liste yalnızca <strong>gelen e-Fatura</strong> belgelerini kapsar. Gelen{" "}
        <strong>e-İrsaliye</strong> için e-İrsaliye ekranını kullanın; e-Arşiv ve e-Gider
        yalnızca giden belge türleridir, gelen kutusuna düşmez.
      </Alert>

      {alertInfo && (
        <Alert
          variant={alertInfo.type}
          dismissible
          onClose={() => setAlertInfo(null)}
          className="py-2 px-3 mb-3 border rounded shadow-2xs small fw-medium"
        >
          {alertInfo.message}
        </Alert>
      )}

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <Row className="g-2 align-items-end">
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Başlangıç</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                className="custom-date-input"
                value={baslangicTarihi}
                onChange={(e) => setBaslangicTarihi(e.target.value)}
              />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Bitiş</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                className="custom-date-input"
                value={bitisTarihi}
                onChange={(e) => setBitisTarihi(e.target.value)}
              />
            </Col>
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="small mb-1">Ara</Form.Label>
              <Form.Control
                size="sm"
                type="search"
                placeholder="Belge no, unvan veya ETTN ile Ara…"
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    listeYukle(1);
                  }
                }}
              />
            </Col>
            <Col xs={6} md={4} lg={2}>
              <Form.Label className="small mb-1">Cevap Durumu</Form.Label>
              <Form.Select
                size="sm"
                value={redKabulFiltre}
                onChange={(e) => setRedKabulFiltre(e.target.value as any)}
              >
                <option value="TUMU">Tümü</option>
                <option value="BEKLEYEN">Cevap bekleyen</option>
                <option value="Kabul">Kabul edilen</option>
                <option value="Red">Reddedilen</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={8} lg={2} className="d-flex gap-2">
              <Button size="sm" variant="primary" onClick={() => listeYukle(1)} disabled={yukleniyor}>
                Filtrele
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={senkronizeEt}
                disabled={senkronEdiliyor}
                className="d-flex align-items-center gap-1 flex-shrink-0"
                title="Entegratörden son 30 günün belgelerini çeker"
              >
                {senkronEdiliyor ? <Spinner animation="border" size="sm" /> : <IconCloudDownload size={16} />}
                Senkronize Et
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden">
        <Card.Body className="p-3 bg-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Gelen Belgeler
            </span>
            <span className="text-secondary small">
              {toplam.toLocaleString("tr-TR")} kayıt · sayfa {sayfa}/{sonSayfa}
            </span>
          </div>

          <div className="table-responsive">
            <Table className="table table-sm custom-document-table mb-0" hover>
              <thead>
                <tr>
                  <th style={{ width: "110px" }}>Tarih</th>
                  <th style={{ width: "150px" }}>Belge No</th>
                  <th>Gönderen</th>
                  <th style={{ width: "130px" }} className="text-end">
                    Tutar
                  </th>
                  <th style={{ width: "120px" }}>Senaryo</th>
                  <th style={{ width: "140px" }}>GİB Statüsü</th>
                  <th style={{ width: "130px" }}>Cevap</th>
                </tr>
              </thead>
              <tbody>
                {yukleniyor ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span className="small text-secondary">Yükleniyor…</span>
                    </td>
                  </tr>
                ) : kayitlar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4 small">
                      Kayıt yok. Entegratörden belge çekmek için <strong>Senkronize Et</strong> düğmesini kullanın.
                    </td>
                  </tr>
                ) : (
                  kayitlar.map((satir) => {
                    const rozet = ebelgeRedKabulRozet(satir.redKabul);
                    return (
                      <tr
                        key={satir.uuid}
                        className={seciliUuid === satir.uuid ? "table-active" : undefined}
                        onClick={() => setSeciliUuid(satir.uuid)}
                        onDoubleClick={() => setAcikUuid(satir.uuid)}
                        style={{ cursor: "pointer" }}
                        title="Detay için çift tıklayın"
                      >
                        <td>{ebelgeTarihSaat(satir.duzenlemeTarihi).slice(0, 10)}</td>
                        <td className="font-monospace">{satir.belgeNo || "-"}</td>
                        <td className="text-truncate" style={{ maxWidth: "320px" }} title={satir.supplier || ""}>
                          {satir.supplier || satir.sender || "-"}
                        </td>
                        <td className="text-end font-monospace">
                          {ebelgeTutar(satir.tutar, satir.paraBirimi)}
                        </td>
                        <td>
                          {satir.profil || "-"}
                          {ebelgeTicariMi(satir.profil) && (
                            <Badge bg="info-subtle" text="info" className="ms-1">
                              Ticari
                            </Badge>
                          )}
                        </td>
                        <td className="text-truncate" style={{ maxWidth: "160px" }} title={satir.gibStatuAciklama || ""}>
                          {satir.statu || satir.gibStatuAciklama || "-"}
                        </td>
                        <td>
                          {ebelgeTicariMi(satir.profil) || satir.redKabul ? (
                            <Badge bg={rozet.bg} text={rozet.text}>
                              {rozet.etiket}
                            </Badge>
                          ) : (
                            <span className="text-secondary small">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>

          {toplam > SAYFA_BOYUTU && (
            <div className="d-flex align-items-center justify-content-end gap-2 mt-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={sayfa <= 1 || yukleniyor}
                onClick={() => listeYukle(sayfa - 1)}
              >
                Önceki
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={sayfa >= sonSayfa || yukleniyor}
                onClick={() => listeYukle(sayfa + 1)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      <EBelgeDetayModal
        uuid={acikUuid}
        onClose={() => setAcikUuid(null)}
        onCevapVerildi={() => listeYukle(sayfa)}
      />
    </div>
  );
};

export default EBelgeGelenPage;
