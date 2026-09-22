import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconCheck, IconFileInvoice, IconLink, IconReceipt, IconSearch, IconUnlink, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaService, MutabakatDurumu, MutabakatFisi, MutabakatListesi, MutabakatSatiri } from "../../services/ebankaService";
import { bugun, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";
import { fisKesimAdresi } from "./useEBankaFisKesimi";

// F- e-Banka > J- Tahsilat / Ödeme Mutabakatı (docs/TAHSILAT_MUTABAKATI_YOL_HARITASI.md)
// Bankaya giren / çıkan her para: karşılığında fiş var mı, fişin faturası kesilmiş / gelmiş mi.

const DURUM: Record<MutabakatDurumu, { ad: string; renk: string; koyu?: boolean }> = {
  faturalandi: { ad: "Faturalandı", renk: "success" },
  faturasiz: { ad: "Fişi var, faturası yok", renk: "warning", koyu: true },
  oneri: { ad: "Eşleşme bekliyor", renk: "info", koyu: true },
  fissiz: { ad: "Fişi yok", renk: "danger" },
  gerekmez: { ad: "Fatura gerektirmez", renk: "secondary" },
  virman: { ad: "Hesaplar arası virman", renk: "light", koyu: true },
};

const FIS_TURU: Record<string, string> = { doviz: "Döviz fişi", sarraf: "Sarraf fişi", perakende: "Perakende" };

const gunYaz = (g: string | null) => (g ? g.slice(0, 10).split("-").reverse().join(".") : "-");

/** Fişin faturası e-Belge kaynak listesinden kesilir; perakende faturası kendi ekranında kesildiği için oraya yönlendirilmez. */
const faturaAdresi = (f: MutabakatFisi): string | null => {
  if (f.fisTuru === "perakende") return null;
  const q = new URLSearchParams({ kaynak: f.fisTuru === "doviz" ? "DOVIZ" : "FATURA", ...(f.tarih ? { tarih: f.tarih.slice(0, 10) } : {}), ...(f.fisNo ? { ara: f.fisNo } : {}) });
  return `/e-belge/kaynak?${q.toString()}`;
};

/** Fişi olmayan paradan kesilebilecek fişler; perakende faturası yalnız satış (gelen para) için. */
const KESILECEK_FISLER: { ad: string; yol: string; yalnizGelen?: boolean }[] = [
  { ad: "Döviz fişi", yol: "/vezne/doviz-fisi-kayit" },
  { ad: "Sarraf fişi", yol: "/vezne/sarraf-fisi-kayit" },
  { ad: "Perakende fişi", yol: "/vezne/perakende-fisi-kayit", yalnizGelen: true },
];

export const EBankaMutabakatPage: React.FC = () => {
  const navigate = useNavigate();
  // Fiş ekranından dönüşte aynı tarih aralığı ve aynı hareket açılır
  const [searchParams] = useSearchParams();
  const tarihParam = (ad: string) => (/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get(ad) || "") ? (searchParams.get(ad) as string) : bugun());
  const [baslangic, setBaslangic] = useState(() => tarihParam("baslangic"));
  const [bitis, setBitis] = useState(() => tarihParam("bitis"));
  const acilacak = Number(searchParams.get("ac")) || 0;
  const [yon, setYon] = useState("");
  const [durumSuzgeci, setDurumSuzgeci] = useState<"" | MutabakatDurumu | "farkli">("");
  const [veri, setVeri] = useState<MutabakatListesi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [secili, setSecili] = useState<MutabakatSatiri | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [gerekmezNotu, setGerekmezNotu] = useState("");
  const { bildir, bildirimKutusu } = useBildirim();

  const listele = useCallback(async () => {
    if (baslangic > bitis) return bildir("warning", "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    setYukleniyor(true);
    try {
      const v = await EBankaService.getMutabakat({ baslangic, bitis, yon });
      setVeri(v);
      // Açık detay penceresi güncel veriyle yenilensin
      setSecili((s) => (s ? v.satirlar.find((x) => x.vomsisId === s.vomsisId) || null : null));
      return v;
    } catch (err: any) {
      bildir("danger", err?.message || "Mutabakat listelenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, yon, bildir]);

  // Açılışta bugünün listesi kendiliğinden gelir; sonraki listelemeler "Listele" ile
  useEffect(() => {
    listele().then((v) => {
      const s = acilacak && v ? v.satirlar.find((x) => x.vomsisId === acilacak) : null;
      if (s) detayAc(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const satirlar = useMemo(
    () => (veri?.satirlar || []).filter((s) => !durumSuzgeci || (durumSuzgeci === "farkli" ? s.fark !== null && s.fark !== 0 : s.durum === durumSuzgeci)),
    [veri, durumSuzgeci]
  );

  const islem = async (is: () => Promise<void>, mesaj: string) => {
    setCalisiyor(true);
    try {
      await is();
      bildir("success", mesaj);
      await listele();
    } catch (err: any) {
      bildir("danger", err?.message || "İşlem yapılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  const detayAc = (s: MutabakatSatiri) => {
    setSecili(s);
    setGerekmezNotu(s.not || "");
  };

  const fisSatiri = (s: MutabakatSatiri, f: MutabakatFisi, eslenmis: boolean) => {
    const adres = faturaAdresi(f);
    return (
      <tr key={`${f.fisTuru}-${f.fisId}`}>
        <td className="text-nowrap">{FIS_TURU[f.fisTuru]}</td>
        <td className="font-monospace">{f.fisNo || `#${f.fisId}`}</td>
        <td className="font-monospace text-nowrap">{gunYaz(f.tarih)}</td>
        <td>{f.cariAdi || "-"}</td>
        <td className="text-end font-monospace text-nowrap">
          {paraYaz(f.tutar)}
          {Math.abs(f.fisToplami - f.tutar) >= 0.01 && <div className="text-muted small">fiş toplamı {paraYaz(f.fisToplami)}</div>}
        </td>
        {!eslenmis && <td className={`text-end font-monospace text-nowrap ${f.fark ? "text-danger fw-bold" : "text-success"}`}>{f.fark ? paraYaz(f.fark) : "Tutuyor"}</td>}
        <td>
          {f.faturali ? (
            <Badge bg="success">{f.faturaBilgisi || "Faturalı"}</Badge>
          ) : (
            <Badge bg="warning" text="dark">
              {f.yon === "giden" && f.fisTuru !== "perakende" ? "Gelen fatura yok" : "Faturası yok"}
            </Badge>
          )}
          {eslenmis && f.otomatik && <div className="text-muted small">otomatik eşlendi</div>}
          {!eslenmis && f.baskaHarekette && <div className="text-muted small">başka bir banka hareketine de eşli</div>}
        </td>
        <td className="text-end text-nowrap">
          {eslenmis ? (
            <>
              {!f.faturali && f.yon === "gelen" && adres && (
                <Button size="sm" variant="outline-primary" className="py-0 me-1" onClick={() => navigate(adres)}>
                  <IconFileInvoice size={14} className="me-1" />
                  Fatura kes
                </Button>
              )}
              <Button size="sm" variant="light" className="border py-0 text-danger" disabled={calisiyor} title="Eşleşmeyi kaldır"
                onClick={() => islem(() => EBankaService.mutabakatEslemeKaldir(s.vomsisId, f.fisTuru, f.fisId), "Eşleşme kaldırıldı.")}>
                <IconUnlink size={14} />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline-primary" className="py-0" disabled={calisiyor}
              onClick={() => islem(() => EBankaService.mutabakatEsle(s.vomsisId, f.fisTuru, f.fisId), "Fiş eşlendi.")}>
              <IconLink size={14} className="me-1" />
              Eşle
            </Button>
          )}
        </td>
      </tr>
    );
  };

  const o = veri?.ozet;
  return (
    <div className="ebanka-mutabakat-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="J- Tahsilat / Ödeme Mutabakatı"
        onRefresh={listele}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor || calisiyor}
        modeText={`${o?.toplam ?? 0} banka hareketi`}
      />
      {bildirimKutusu}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              listele();
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
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Para</Form.Label>
                <Form.Select size="sm" value={yon} onChange={(e) => setYon(e.target.value)}>
                  <option value="">Gelen ve giden</option>
                  <option value="gelen">Gelen (tahsilat)</option>
                  <option value="giden">Giden (ödeme)</option>
                </Form.Select>
              </Col>
              <Col xl={3} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Durum</Form.Label>
                <Form.Select size="sm" value={durumSuzgeci} onChange={(e) => setDurumSuzgeci(e.target.value as typeof durumSuzgeci)}>
                  <option value="">Tümü</option>
                  {(Object.keys(DURUM) as MutabakatDurumu[]).map((d) => (
                    <option key={d} value={d}>
                      {DURUM[d].ad} ({o?.[d] ?? 0})
                    </option>
                  ))}
                  <option value="farkli">Tutar farkı olanlar ({o?.farkli ?? 0})</option>
                </Form.Select>
              </Col>
              <Col xl={3} md={12}>
                <Button type="submit" size="sm" variant="outline-primary" className="w-100" disabled={yukleniyor}>
                  {yukleniyor ? <Spinner size="sm" className="me-1" /> : <IconSearch size={16} className="me-1" />}
                  Listele
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {o && o.toplam > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2 small">
          {(["faturalandi", "faturasiz", "oneri", "fissiz", "gerekmez"] as MutabakatDurumu[]).map((d) => (
            <Badge key={d} bg={DURUM[d].renk} text={DURUM[d].koyu ? "dark" : undefined} className="px-2 py-1" style={{ cursor: "pointer" }} onClick={() => setDurumSuzgeci(d)}>
              {DURUM[d].ad}: {o[d]}
            </Badge>
          ))}
          {o.farkli > 0 && (
            <Badge bg="danger" className="px-2 py-1" style={{ cursor: "pointer" }} onClick={() => setDurumSuzgeci("farkli")}>
              Tutar farkı: {o.farkli}
            </Badge>
          )}
        </div>
      )}

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th>Tarih</th>
                <th>Hesap</th>
                <th>Karşı Taraf / Cari</th>
                <th>Açıklama</th>
                <th className="text-end">Tutar</th>
                <th>Durum</th>
                <th>Fiş</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.vomsisId} style={{ cursor: "pointer" }} onClick={() => detayAc(s)}>
                  <td className="font-monospace text-nowrap">{zamanYaz(s.tarih)}</td>
                  <td className="text-nowrap">
                    {s.bankaAdi} {s.doviz}
                  </td>
                  <td>
                    {s.karsiTaraf || "-"}
                    {s.cari && <div className="text-muted">{s.cari.ad}</div>}
                  </td>
                  <td className="text-truncate" style={{ maxWidth: "260px" }} title={s.aciklama || ""}>
                    {s.aciklama || ""}
                  </td>
                  <td className={`text-end font-monospace fw-bold text-nowrap ${s.yon === "giden" ? "text-danger" : "text-success"}`}>
                    {s.yon === "giden" ? "-" : "+"}
                    {paraYaz(s.tutar)}
                  </td>
                  <td>
                    <Badge bg={DURUM[s.durum].renk} text={DURUM[s.durum].koyu ? "dark" : undefined} className={s.durum === "virman" ? "border" : undefined}>
                      {DURUM[s.durum].ad}
                    </Badge>
                    {s.fark !== null && s.fark !== 0 && <div className="text-danger fw-bold">Tutar farkı {paraYaz(s.fark)}</div>}
                  </td>
                  <td className="text-nowrap">
                    {s.fisler.length
                      ? s.fisler.map((f) => (
                          <div key={`${f.fisTuru}-${f.fisId}`}>
                            {FIS_TURU[f.fisTuru]} {f.fisNo || `#${f.fisId}`}
                          </div>
                        ))
                      : s.adaylar.length
                        ? `${s.adaylar.length} aday`
                        : ""}
                  </td>
                </tr>
              ))}
              {satirlar.length === 0 && !yukleniyor && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-3">
                    {veri ? "Bu ölçütlere uyan banka hareketi yok." : "Tarih seçip Listele'ye basın."}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!secili} onHide={() => setSecili(null)} size="xl" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Banka Hareketi — Fiş ve Fatura</Modal.Title>
        </Modal.Header>
        {secili && (
          <Modal.Body className="small">
            <Row className="g-1 mb-3">
              <Col md={2} className="text-secondary fw-bold">Tarih</Col>
              <Col md={4} className="font-monospace">{zamanYaz(secili.tarih)}</Col>
              <Col md={2} className="text-secondary fw-bold">Tutar</Col>
              <Col md={4} className={`font-monospace fw-bold ${secili.yon === "giden" ? "text-danger" : "text-success"}`}>
                {secili.yon === "giden" ? "Giden -" : "Gelen +"}
                {paraYaz(secili.tutar)} {secili.doviz}
              </Col>
              <Col md={2} className="text-secondary fw-bold">Hesap</Col>
              <Col md={4}>{secili.bankaAdi} {secili.doviz} - {secili.hesapNo}</Col>
              <Col md={2} className="text-secondary fw-bold">Karşı taraf</Col>
              <Col md={4}>{secili.karsiTaraf || "-"}</Col>
              <Col md={2} className="text-secondary fw-bold">Cari</Col>
              <Col md={4}>{secili.cari ? secili.cari.ad : <span className="text-muted">Bulunamadı ({secili.cariNedeni})</span>}</Col>
              <Col md={2} className="text-secondary fw-bold">Açıklama</Col>
              <Col md={4}>{secili.aciklama || "-"}</Col>
              <Col md={2} className="text-secondary fw-bold">Durum</Col>
              <Col md={10}>
                <Badge bg={DURUM[secili.durum].renk} text={DURUM[secili.durum].koyu ? "dark" : undefined}>{DURUM[secili.durum].ad}</Badge>
                {secili.fark !== null && secili.fark !== 0 && (
                  <span className="ms-2 text-danger fw-bold">Banka tutarı ile fiş tutarı arasında {paraYaz(secili.fark)} fark var.</span>
                )}
              </Col>
            </Row>

            {secili.fisler.length > 0 && (
              <>
                <div className="fw-bold text-secondary mb-1">Eşlenen fişler</div>
                <Table size="sm" className="mb-3 align-middle">
                  <tbody>{secili.fisler.map((f) => fisSatiri(secili, f, true))}</tbody>
                </Table>
              </>
            )}

            {secili.durum !== "virman" && secili.fisler.length === 0 && (
              <>
                <div className="fw-bold text-secondary mb-1">Aday fişler</div>
                {secili.adaylar.length ? (
                  <Table size="sm" className="mb-3 align-middle">
                    <thead>
                      <tr className="text-muted">
                        <th>Tür</th>
                        <th>No</th>
                        <th>Tarih</th>
                        <th>Cari</th>
                        <th className="text-end">Fiş tutarı</th>
                        <th className="text-end">Fark</th>
                        <th>Fatura</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>{secili.adaylar.map((f) => fisSatiri(secili, f, false))}</tbody>
                  </Table>
                ) : (
                  <Alert variant="light" className="border py-2">
                    {secili.cari
                      ? "Bu carinin bu tarihe yakın (7 gün önce – 3 gün sonra) uygun fişi yok."
                      : "Karşı taraf bir cariyle eşleşmediği için fiş aranamadı. e-Banka > Bekleyenler'de cariyi belirleyin."}
                  </Alert>
                )}
              </>
            )}

            {secili.durum !== "virman" && secili.fisler.length === 0 && !secili.faturaGerekmez && (
              <div className="border rounded p-2 mb-2">
                <div className="fw-bold text-secondary mb-1">Fiş kes</div>
                <div className="text-muted mb-2">
                  Fiş ekranı {secili.cari ? "cari, " : ""}tarih ve {secili.yon === "gelen" ? "satış" : "alış"} işlemi dolu açılır; tutarı satırlara girip kaydedince fiş bu banka hareketiyle eşlenir.
                  {!secili.cari && " Cari bulunamadığı için fiş ekranında seçmeniz gerekir."}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {KESILECEK_FISLER.filter((k) => !k.yalnizGelen || secili.yon === "gelen").map((k) => (
                    <Button key={k.yol} size="sm" variant="outline-primary"
                      onClick={() => navigate(fisKesimAdresi(k.yol, {
                        vomsisId: secili.vomsisId, cariId: secili.cari?.cariKartId ?? null, tarih: (secili.tarih || bugun()).slice(0, 10),
                        tip: secili.yon === "gelen" ? 1 : 0, tutar: secili.tutar, paraKodu: secili.doviz || "TL", baslangic, bitis,
                      }))}>
                      <IconReceipt size={14} className="me-1" />
                      {k.ad}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {secili.durum !== "virman" && secili.fisler.length === 0 && (
              <div className="border rounded p-2 bg-light">
                <div className="fw-bold text-secondary mb-1">Fatura gerektirmez</div>
                <div className="text-muted mb-2">Kapora, avans, borç tahsilatı gibi fiş/fatura gerektirmeyen paralar için işaretleyin.</div>
                <div className="d-flex gap-2">
                  <Form.Control size="sm" placeholder="Not (isteğe bağlı)" maxLength={250} value={gerekmezNotu} onChange={(e) => setGerekmezNotu(e.target.value)} />
                  {secili.faturaGerekmez ? (
                    <Button size="sm" variant="outline-secondary" className="text-nowrap" disabled={calisiyor}
                      onClick={() => islem(() => EBankaService.mutabakatFaturaGerekmez(secili.vomsisId, false), "İşaret kaldırıldı.")}>
                      <IconX size={14} className="me-1" />
                      İşareti Kaldır
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="text-nowrap" disabled={calisiyor}
                      onClick={() => islem(() => EBankaService.mutabakatFaturaGerekmez(secili.vomsisId, true, gerekmezNotu), "Fatura gerektirmez olarak işaretlendi.")}>
                      <IconCheck size={14} className="me-1" />
                      Fatura Gerektirmez
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Modal.Body>
        )}
      </Modal>
    </div>
  );
};

export default EBankaMutabakatPage;
