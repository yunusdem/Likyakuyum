import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { PosIslem, PosIslemListesi, PosIslemService } from "../../services/posIslemService";
import { SekmeDugmeleri, bugun, gunOnce, paraYaz, useBildirim, zamanYaz } from "../ebanka/ebankaOrtak";
import { PosModRozeti } from "./PosCihazlariPage";

// F- Banka / POS > F- POS İşlemleri (docs/POS_ENTEGRASYON_YOL_HARITASI.md, K18)
// Cihazdan alınan tahsilatlar + bankanın sonradan bildirdiği POS hareketleri; elle işaret ve iade işareti buradan da yapılır.

const SAYFA_BOYUTU = 100;
type Gorunum = "" | "onay" | "ret" | "belirsiz" | "elle" | "iade" | "fissiz" | "banka";
const BELGE_ADI: Record<string, string> = { perakende: "Perakende", sarraf: "Sarraf", deneme: "Deneme" };
const gunYaz = (g: string | null): string => (g ? g.split("-").reverse().join(".") : "-");

const DurumRozeti: React.FC<{ i: PosIslem }> = ({ i }) => {
  if (i.durum === "ONAY") {
    return (
      <Badge bg={i.elle ? "warning" : "success"} text={i.elle ? "dark" : undefined}>
        {i.elle ? "Elle alındı" : "Onaylandı"}
      </Badge>
    );
  }
  if (i.durum === "BELIRSIZ") {
    return (
      <Badge bg="warning" text="dark">
        Belirsiz
      </Badge>
    );
  }
  if (i.durum === "BEKLIYOR") return <Badge bg="primary">Cihazda bekliyor</Badge>;
  return <Badge bg="danger">{i.durum === "IPTAL" ? "İptal" : i.elle ? "Elle alınmadı" : "Reddedildi"}</Badge>;
};

export const PosIslemleriPage: React.FC = () => {
  const [liste, setListe] = useState<PosIslemListesi | null>(null);
  const [gorunum, setGorunum] = useState<Gorunum>("");
  const [baslangic, setBaslangic] = useState(gunOnce(7));
  const [bitis, setBitis] = useState(bugun());
  const [posTerminalId, setPosTerminalId] = useState("");
  const [arama, setArama] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [calisan, setCalisan] = useState<number | null>(null);
  const { bildir, bildirimKutusu } = useBildirim();

  const listele = useCallback(
    async (istenenSayfa: number, istenenGorunum: Gorunum) => {
      setYukleniyor(true);
      try {
        setListe(
          await PosIslemService.getIslemler({
            baslangic,
            bitis,
            durum: istenenGorunum === "banka" ? undefined : istenenGorunum || undefined,
            posTerminalId: Number(posTerminalId) || undefined,
            arama: arama.trim() || undefined,
            sayfa: istenenSayfa,
            sayfaBoyutu: SAYFA_BOYUTU,
          })
        );
        setSayfa(istenenSayfa);
      } catch (err: any) {
        bildir("danger", err?.message || "POS işlemleri okunamadı.");
      } finally {
        setYukleniyor(false);
      }
    },
    [baslangic, bitis, posTerminalId, arama, bildir]
  );

  // Açılışta bir kez; sonraki listelemeler "Listele" ya da sekme değişimiyle
  useEffect(() => {
    listele(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gorunumSec = (g: Gorunum) => {
    setGorunum(g);
    listele(1, g);
  };

  const isaretle = async (i: PosIslem, is: () => Promise<PosIslem>) => {
    setCalisan(i.posIslemId);
    try {
      await is();
      await listele(sayfa, gorunum);
    } catch (err: any) {
      bildir("danger", err?.message || "İşaret kaydedilemedi.");
    } finally {
      setCalisan(null);
    }
  };

  const sayfaSayisi = Math.max(1, Math.ceil((liste?.toplam || 0) / SAYFA_BOYUTU));
  const eslesmeyenBanka = useMemo(() => (liste?.bankaHareketleri || []).filter((h) => h.posIslemId === null).length, [liste]);

  return (
    <div className="pos-islemleri-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="F- POS İşlemleri"
        onRefresh={() => listele(sayfa, gorunum)}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor}
        rightContent={<PosModRozeti mod={liste?.mod} />}
      />
      {bildirimKutusu}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              listele(1, gorunum);
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
                <Form.Label className="small fw-bold text-secondary mb-1">Cihaz</Form.Label>
                <Form.Select size="sm" value={posTerminalId} onChange={(e) => setPosTerminalId(e.target.value)}>
                  <option value="">Tümü</option>
                  {liste?.terminaller.map((t) => (
                    <option key={t.posTerminalId} value={t.posTerminalId}>
                      {t.ad}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xl={3} md={8} xs={9}>
                <Form.Label className="small fw-bold text-secondary mb-1">Ara</Form.Label>
                <Form.Control type="text" size="sm" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Belge no, onay kodu, kart no, banka" />
              </Col>
              <Col xl={1} md={4} xs={3}>
                <Button type="submit" size="sm" variant="outline-primary" className="w-100" disabled={yukleniyor}>
                  <IconSearch size={16} />
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Header className="bg-white py-2">
          <SekmeDugmeleri<Gorunum>
            secili={gorunum}
            onSec={gorunumSec}
            secenekler={[
              { anahtar: "", ad: "Tümü" },
              { anahtar: "onay", ad: "Onaylanan" },
              { anahtar: "ret", ad: "Reddedilen / İptal" },
              { anahtar: "belirsiz", ad: "Belirsiz" },
              { anahtar: "elle", ad: "Elle İşaretlenen" },
              { anahtar: "iade", ad: "İade" },
              { anahtar: "fissiz", ad: "Fişi Kaydedilmemiş" },
              { anahtar: "banka", ad: `Banka Hareketleri (${liste?.bankaHareketleri.length ?? 0})` },
            ]}
          />
        </Card.Header>
        <Card.Body className="p-0">
          {gorunum !== "banka" && (
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th>Zaman</th>
                  <th>Cihaz</th>
                  <th>Belge</th>
                  <th className="text-end">Tutar</th>
                  <th>Durum</th>
                  <th>Banka / Onay</th>
                  <th>POS Kartı</th>
                  <th>Bankada</th>
                  <th>Kullanıcı</th>
                  <th className="text-end">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {liste?.satirlar.map((i) => (
                  <tr key={i.posIslemId}>
                    <td className="font-monospace text-nowrap">{zamanYaz(i.olusturma)}</td>
                    <td className="text-nowrap">
                      {i.terminalAd || "-"}
                      {i.mod === "test" && <span className="text-muted"> (test)</span>}
                    </td>
                    <td className="text-nowrap">
                      {BELGE_ADI[i.belgeTuru] || i.belgeTuru} <span className="font-monospace">{i.belgeNo || ""}</span>
                      {i.durum === "ONAY" && !i.belgeId && (
                        <Badge bg="danger" className="ms-1">
                          Fiş yok
                        </Badge>
                      )}
                    </td>
                    <td className="text-end font-monospace fw-bold text-nowrap">{paraYaz(i.tutar)}</td>
                    <td>
                      <DurumRozeti i={i} />
                      {i.iadeDurumu > 0 && (
                        <Badge bg={i.iadeDurumu === 2 ? "secondary" : "danger"} className="ms-1">
                          {i.iadeDurumu === 2 ? "İade edildi" : "İade bekliyor"}
                        </Badge>
                      )}
                      {i.elle && (
                        <div className="text-muted">
                          {i.elleKullanici || "-"} · {zamanYaz(i.elleZamani)}
                        </div>
                      )}
                      {i.iadeDurumu > 0 && i.iadeZamani && (
                        <div className="text-muted">
                          {i.iadeKullanici || "Cihaz"} · {zamanYaz(i.iadeZamani)}
                        </div>
                      )}
                      {i.durum !== "ONAY" && i.hata && <div className="text-danger">{i.hata}</div>}
                    </td>
                    <td>
                      {[i.bankaAdi, i.taksit && i.taksit > 1 ? `${i.taksit} taksit` : null].filter(Boolean).join(" · ") || "-"}
                      {i.onayKodu && <div className="font-monospace text-muted">{i.onayKodu}</div>}
                    </td>
                    <td>{i.posCihaziAd || "-"}</td>
                    <td>{i.vomsisId ? <Badge bg="success">Eşleşti</Badge> : ""}</td>
                    <td>{i.kullanici || "-"}</td>
                    <td className="text-end text-nowrap">
                      {(i.durum === "BELIRSIZ" || i.durum === "BEKLIYOR") && (
                        <>
                          <Button size="sm" variant="success" className="me-1" disabled={calisan !== null} onClick={() => isaretle(i, () => PosIslemService.elleIsaretle(i.posIslemId, true))}>
                            Alındı
                          </Button>
                          <Button size="sm" variant="outline-danger" disabled={calisan !== null} onClick={() => isaretle(i, () => PosIslemService.elleIsaretle(i.posIslemId, false))}>
                            Alınmadı
                          </Button>
                        </>
                      )}
                      {i.durum === "ONAY" && i.iadeDurumu === 0 && (
                        <Button size="sm" variant="outline-danger" disabled={calisan !== null} onClick={() => isaretle(i, () => PosIslemService.iadeIsaretle(i.posIslemId, 1))}>
                          İade Bekliyor
                        </Button>
                      )}
                      {i.durum === "ONAY" && i.iadeDurumu === 1 && (
                        <>
                          <Button size="sm" variant="primary" className="me-1" disabled={calisan !== null} onClick={() => isaretle(i, () => PosIslemService.iadeIsaretle(i.posIslemId, 2))}>
                            İade Edildi
                          </Button>
                          <Button size="sm" variant="light" className="border" disabled={calisan !== null} onClick={() => isaretle(i, () => PosIslemService.iadeIsaretle(i.posIslemId, 0))}>
                            Kaldır
                          </Button>
                        </>
                      )}
                      {i.durum === "ONAY" && i.iadeDurumu === 2 && (
                        <Button size="sm" variant="light" className="border" disabled={calisan !== null} onClick={() => isaretle(i, () => PosIslemService.iadeIsaretle(i.posIslemId, 0))}>
                          İade İşaretini Kaldır
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!liste?.satirlar.length && !yukleniyor && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-3">
                      Bu ölçütlere uyan POS işlemi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}

          {gorunum === "banka" && (
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th>Tarih</th>
                  <th>Banka</th>
                  <th>Kart</th>
                  <th className="text-end">Tutar</th>
                  <th className="text-center">Taksit</th>
                  <th>Provizyon</th>
                  <th>Cihaz Tahsilatı</th>
                </tr>
              </thead>
              <tbody>
                {liste?.bankaHareketleri.map((h) => (
                  <tr key={h.vomsisId}>
                    <td className="font-monospace text-nowrap">
                      {gunYaz(h.islemTarihi)} {h.saat?.slice(0, 5) || ""}
                    </td>
                    <td>{h.bankaAdi || "-"}</td>
                    <td className="font-monospace">{h.kartNo || "-"}</td>
                    <td className="text-end font-monospace fw-bold">{paraYaz(h.brut)}</td>
                    <td className="text-center">{h.taksitSayisi || ""}</td>
                    <td className="font-monospace">{h.provizyonNo || "-"}</td>
                    <td>{h.posIslemId ? <Badge bg="success">Eşleşti (#{h.posIslemId})</Badge> : <Badge bg="secondary">Karşılığı yok</Badge>}</td>
                  </tr>
                ))}
                {!liste?.bankaHareketleri.length && !yukleniyor && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-3">
                      Bu aralıkta banka POS hareketi yok. Hareketler e-Banka › POS Terminalleri ve Hareketleri ekranından güncellenir.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
        <Card.Footer className="bg-white py-2 d-flex align-items-center justify-content-between gap-2 small">
          <span className="text-muted">
            {gorunum === "banka" ? `${eslesmeyenBanka} banka hareketinin cihaz tahsilatı karşılığı yok` : `${liste?.toplam ?? 0} işlem`}
          </span>
          {gorunum !== "banka" && sayfaSayisi > 1 && (
            <span className="d-flex align-items-center gap-2">
              <span className="text-muted">
                Sayfa {sayfa} / {sayfaSayisi}
              </span>
              <Button size="sm" variant="light" className="border" disabled={yukleniyor || sayfa <= 1} onClick={() => listele(sayfa - 1, gorunum)}>
                <IconChevronLeft size={16} />
              </Button>
              <Button size="sm" variant="light" className="border" disabled={yukleniyor || sayfa >= sayfaSayisi} onClick={() => listele(sayfa + 1, gorunum)}>
                <IconChevronRight size={16} />
              </Button>
            </span>
          )}
        </Card.Footer>
      </Card>
    </div>
  );
};

export default PosIslemleriPage;
