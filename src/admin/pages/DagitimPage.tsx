import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconRefresh, IconRocket, IconFlask, IconFileText } from "@tabler/icons-react";
import { adminApi, CommitOzeti, DagitimDurum, DagitimDurumu, DagitimHedef, DagitimKaydi, tarihYaz } from "../services/adminApi";

/**
 * Dağıtım (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md): likyakuyum.com = TEST, likyaerp.com = CANLI.
 *   "Test'i Güncelle": test kopyası origin/main'e çekilir.  "Canlıya Geçir": canlı, testte ÇALIŞAN commit'e çekilir.
 * İş sunucudaki Görev Zamanlayıcı görevinde koşar; burada adım, log ve sonuç izlenir. Hata olursa betik önceki
 * sürüme kendisi döner, sonuç kırmızı görünür ve mail gider.
 */
const DURUM: Record<DagitimDurum, { metin: string; renk: string }> = {
  CALISIYOR: { metin: "Çalışıyor", renk: "warning" },
  BASARILI: { metin: "Başarılı", renk: "success" },
  HATA: { metin: "Hata", renk: "danger" },
  GERI_DONDU: { metin: "Hata — geri dönüldü", renk: "danger" },
  GERI_DONUS_HATASI: { metin: "Hata — geri dönüş de kaldı", renk: "danger" },
};

const HEDEF: Record<DagitimHedef, string> = { canli: "Canlı (likyaerp.com)", test: "Test (likyakuyum.com)" };

const kisa = (c: string | null | undefined) => (c ? c.slice(0, 9) : "-");

const CommitListesi: React.FC<{ liste: CommitOzeti[]; bos: string }> = ({ liste, bos }) =>
  liste.length === 0 ? (
    <div className="text-muted small">{bos}</div>
  ) : (
    <Table size="sm" className="mb-0 small align-middle">
      <tbody>
        {liste.map((c) => (
          <tr key={c.commit}>
            <td className="text-muted font-monospace" style={{ width: 90 }}>
              {c.kisa}
            </td>
            <td>{c.baslik}</td>
            <td className="text-muted text-nowrap" style={{ width: 170 }}>
              {c.yazar} · {c.tarih}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

const OrtamKarti: React.FC<{ baslik: string; alt: string; d: DagitimDurumu["canli"]; renk: string }> = ({ baslik, alt, d, renk }) => (
  <Card className={`border-${renk} h-100`}>
    <Card.Body className="py-3">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="fw-semibold">{baslik}</div>
          <div className="text-muted small">{alt}</div>
        </div>
        <Badge bg={renk} className="font-monospace">
          {d.kisa || "?"}
        </Badge>
      </div>
      {d.ozet ? (
        <div className="small mt-2">
          <div>{d.ozet.baslik}</div>
          <div className="text-muted">
            {d.ozet.yazar} · {d.ozet.tarih}
          </div>
        </div>
      ) : (
        <div className="small text-muted mt-2">Commit bilgisi okunamadı.</div>
      )}
    </Card.Body>
  </Card>
);

const DagitimPage: React.FC = () => {
  const [durum, setDurum] = useState<DagitimDurumu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [onay, setOnay] = useState<DagitimHedef | null>(null);
  const [baslatiliyor, setBaslatiliyor] = useState(false);
  const [logId, setLogId] = useState<number | null>(null);
  const [log, setLog] = useState<{ kayit: DagitimKaydi; log: string } | null>(null);
  const logKutusu = useRef<HTMLPreElement>(null);

  const yukle = useCallback(async (yenile: boolean) => {
    setYukleniyor(true);
    try {
      const d = await adminApi.dagitimDurum(yenile);
      setDurum(d);
      setHata(null);
      if (d.calisan && logId === null) setLogId(d.calisan.dagitimId);
    } catch (e: any) {
      setHata(e?.message || "Durum alınamadı.");
    } finally {
      setYukleniyor(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    yukle(true);
    adminApi.dagitimGoruldu().then(() => window.dispatchEvent(new Event("likya-admin-dagitim-degisti"))).catch(() => undefined);
  }, [yukle]);

  // Çalışan dağıtım varken durum 5 sn'de bir, log 3 sn'de bir yenilenir
  const calisiyor = !!durum?.calisan;
  useEffect(() => {
    if (!calisiyor) return;
    const z = setInterval(() => yukle(false), 5000);
    return () => clearInterval(z);
  }, [calisiyor, yukle]);

  useEffect(() => {
    if (logId === null) return;
    let aktif = true;
    const oku = () =>
      adminApi
        .dagitimLog(logId)
        .then((l) => {
          if (!aktif) return;
          setLog(l);
          requestAnimationFrame(() => {
            if (logKutusu.current) logKutusu.current.scrollTop = logKutusu.current.scrollHeight;
          });
        })
        .catch(() => undefined);
    oku();
    const z = setInterval(() => {
      if (log?.kayit.durum === "CALISIYOR" || calisiyor) oku();
    }, 3000);
    return () => {
      aktif = false;
      clearInterval(z);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId, calisiyor]);

  // Dağıtım bitince son durum ve menü sayacı yenilensin
  const oncekiCalisiyor = useRef(calisiyor);
  useEffect(() => {
    if (oncekiCalisiyor.current && !calisiyor) {
      yukle(true);
      adminApi.dagitimGoruldu().then(() => window.dispatchEvent(new Event("likya-admin-dagitim-degisti"))).catch(() => undefined);
    }
    oncekiCalisiyor.current = calisiyor;
  }, [calisiyor, yukle]);

  const baslat = async () => {
    if (!onay) return;
    setBaslatiliyor(true);
    try {
      const k = await adminApi.dagitimBaslat(onay);
      setOnay(null);
      setLogId(k.dagitimId);
      setLog(null);
      window.dispatchEvent(new Event("likya-admin-dagitim-degisti"));
      await yukle(false);
    } catch (e: any) {
      setHata(e?.message || "Başlatılamadı.");
      setOnay(null);
    } finally {
      setBaslatiliyor(false);
    }
  };

  const canliHazir = !!durum && durum.kurulu && !durum.calisan && !!durum.test.commit && durum.test.commit !== durum.canli.commit;
  const testHazir = !!durum && durum.kurulu && !durum.calisan && !!durum.uzak.commit && durum.uzak.commit !== durum.test.commit;

  return (
    <>
      <Card className="shadow-sm mb-3">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 className="mb-1">Dağıtım</h5>
              <p className="text-muted small mb-0">
                Her push önce <strong>test</strong>e (likyakuyum.com) alınır; testler bitince <strong>canlı</strong>ya (likyaerp.com) geçirilir.
                Kurulum hata verirse önceki sürüme kendiliğinden dönülür ve e-posta gider.
              </p>
            </div>
            <Button variant="outline-secondary" size="sm" disabled={yukleniyor} onClick={() => yukle(true)}>
              {yukleniyor ? <Spinner animation="border" size="sm" /> : <IconRefresh size={16} />} Yenile
            </Button>
          </div>

          {hata && (
            <Alert variant="danger" dismissible onClose={() => setHata(null)}>
              {hata}
            </Alert>
          )}
          {durum && !durum.kurulu && <Alert variant="warning">{durum.kurulumNotu || "Dağıtım bu sunucuda kurulu değil."}</Alert>}
          {durum?.uzakHata && <Alert variant="warning">Uzak depo okunamadı: {durum.uzakHata}</Alert>}
          {durum && durum.ortam === "test" && (
            <Alert variant="info" className="py-2 small">
              Bu panel <strong>test</strong> backend'ine bağlı. Canlıya geçiş canlı ortamın panelinden (admin.likyakuyum.com) yapılır.
            </Alert>
          )}

          {!durum ? (
            <Spinner animation="border" />
          ) : (
            <>
              <Row className="g-3 mb-3">
                <Col md={4}>
                  <OrtamKarti baslik="GitHub (origin/main)" alt="Son push edilen kod" d={durum.uzak} renk="secondary" />
                </Col>
                <Col md={4}>
                  <OrtamKarti baslik="Test" alt="likyakuyum.com" d={durum.test} renk="warning" />
                </Col>
                <Col md={4}>
                  <OrtamKarti baslik="Canlı" alt="likyaerp.com" d={durum.canli} renk="success" />
                </Col>
              </Row>

              {durum.calisan && (
                <Alert variant="warning" className="d-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" />
                  <div>
                    <strong>
                      #{durum.calisan.dagitimId} {HEDEF[durum.calisan.hedef]}
                    </strong>{" "}
                    çalışıyor — {durum.calisan.adim || "başlatılıyor"} · başlatan {durum.calisan.baslatan || "-"} · {tarihYaz(durum.calisan.baslangic)}
                  </div>
                </Alert>
              )}

              <Row className="g-3">
                <Col lg={6}>
                  <Card className="h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="fw-semibold">
                          <IconFlask size={18} className="me-1 text-warning" />
                          Teste gidecek commit'ler ({durum.testeGidecek.length})
                        </div>
                        <Button variant="warning" size="sm" disabled={!testHazir} onClick={() => setOnay("test")}>
                          Test'i Güncelle
                        </Button>
                      </div>
                      <CommitListesi liste={durum.testeGidecek} bos={durum.uzak.commit ? "Test güncel." : "Uzak depo okunamadı."} />
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={6}>
                  <Card className="h-100 border-success">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="fw-semibold">
                          <IconRocket size={18} className="me-1 text-success" />
                          Canlıya gidecek commit'ler ({durum.canliyaGidecek.length})
                        </div>
                        <Button variant="success" size="sm" disabled={!canliHazir || durum.ortam === "test"} onClick={() => setOnay("canli")}>
                          Canlıya Geçir
                        </Button>
                      </div>
                      <CommitListesi liste={durum.canliyaGidecek} bos={durum.test.commit ? "Canlı testteki sürümde." : "Test kopyası okunamadı."} />
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Card.Body>
      </Card>

      {log && (
        <Card className="shadow-sm mb-3">
          <Card.Body className="p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">
                <IconFileText size={18} className="me-1" />
                Log #{log.kayit.dagitimId} · {HEDEF[log.kayit.hedef]} ·{" "}
                <Badge bg={DURUM[log.kayit.durum].renk} text={log.kayit.durum === "CALISIYOR" ? "dark" : undefined}>
                  {DURUM[log.kayit.durum].metin}
                </Badge>
                {log.kayit.mesaj && <span className="text-muted small ms-2">{log.kayit.mesaj}</span>}
              </div>
              <Button variant="link" size="sm" onClick={() => setLog(null)}>
                Kapat
              </Button>
            </div>
            <pre ref={logKutusu} className="bg-dark text-light rounded p-3 small mb-0" style={{ maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap" }}>
              {log.log || "(henüz log yok)"}
            </pre>
          </Card.Body>
        </Card>
      )}

      {durum && (
        <Card className="shadow-sm">
          <Card.Body className="p-4">
            <h6 className="mb-3">Geçmiş</h6>
            {durum.gecmis.length === 0 ? (
              <div className="text-muted small">Henüz dağıtım yapılmadı.</div>
            ) : (
              <Table responsive hover size="sm" className="align-middle mb-0 small">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Hedef</th>
                    <th>Önceki → Yeni</th>
                    <th>Başlatan</th>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Durum</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {durum.gecmis.map((k) => (
                    <tr key={k.dagitimId}>
                      <td>{k.dagitimId}</td>
                      <td>{HEDEF[k.hedef]}</td>
                      <td className="font-monospace">
                        {kisa(k.oncekiCommit)} → {kisa(k.hedefCommit)}
                      </td>
                      <td>{k.baslatan || "-"}</td>
                      <td>{tarihYaz(k.baslangic)}</td>
                      <td>{k.bitis ? tarihYaz(k.bitis) : "-"}</td>
                      <td>
                        <Badge bg={DURUM[k.durum].renk} text={k.durum === "CALISIYOR" ? "dark" : undefined}>
                          {DURUM[k.durum].metin}
                        </Badge>
                        {k.mesaj && (
                          <div className="text-muted" style={{ maxWidth: 360 }}>
                            {k.mesaj}
                          </div>
                        )}
                      </td>
                      <td>
                        <Button variant="outline-secondary" size="sm" onClick={() => setLogId(k.dagitimId)}>
                          Log
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}

      <Modal show={!!onay} onHide={() => !baslatiliyor && setOnay(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{onay === "canli" ? "Canlıya geçirilsin mi?" : "Test güncellensin mi?"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {onay === "canli" ? (
            <>
              <p>
                <strong>likyaerp.com</strong> testteki sürüme ({kisa(durum?.test.commit)}) çekilecek. Kullanıcılar kurulum sırasında birkaç saniye
                kesinti görebilir; şema göçleri canlı veritabanlarına uygulanır (geri alınmaz).
              </p>
              <p className="mb-0 small text-muted">Uygulanacak {durum?.canliyaGidecek.length} commit yukarıdaki listede.</p>
            </>
          ) : (
            <p className="mb-0">
              <strong>likyakuyum.com</strong> GitHub'daki son koda ({kisa(durum?.uzak.commit)}) çekilecek; {durum?.testeGidecek.length} commit uygulanacak.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={baslatiliyor} onClick={() => setOnay(null)}>
            Vazgeç
          </Button>
          <Button variant={onay === "canli" ? "success" : "warning"} disabled={baslatiliyor} onClick={baslat}>
            {baslatiliyor ? <Spinner animation="border" size="sm" /> : onay === "canli" ? "Evet, Canlıya Geçir" : "Evet, Güncelle"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DagitimPage;
