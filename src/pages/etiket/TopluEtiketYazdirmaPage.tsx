import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, Table, Badge } from "react-bootstrap";
import { IconStack2, IconCheck, IconAlertTriangle, IconChecklist, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import { EtiketService, AltinUrunItem, OzelUrunItem, EtiketSablonItem } from "../../services/etiketService";
import { PrinterService, YaziciItem } from "../../services/printerService";

type SatirTip = "altin" | "ozel";
interface GridSatir {
  key: string;
  tip: SatirTip;
  id: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  aciklama: string;
  ureticiFirma?: string | null;
  yazdirildi: boolean;
  raw: AltinUrunItem | OzelUrunItem;
}

export const TopluEtiketYazdirmaPage: React.FC = () => {
  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [grupKodlari, setGrupKodlari] = useState<string[]>([]);
  const [ureticiFirmalar, setUreticiFirmalar] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [tipFiltre, setTipFiltre] = useState<"hepsi" | SatirTip>("hepsi");
  const [grupFiltre, setGrupFiltre] = useState("");
  const [ureticiFiltre, setUreticiFiltre] = useState("");
  const [baslangicTarihi, setBaslangicTarihi] = useState("");
  const [bitisTarihi, setBitisTarihi] = useState("");
  const [yazdirildiFiltre, setYazdirildiFiltre] = useState<"hepsi" | "evet" | "hayir">("hayir");

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showPrintModal, setShowPrintModal] = useState(false);

  const tipFiltreRef = useRef<HTMLSelectElement | null>(null);
  const grupFiltreRef = useRef<HTMLSelectElement | null>(null);
  const ureticiFiltreRef = useRef<HTMLSelectElement | null>(null);
  const baslangicTarihiRef = useRef<HTMLInputElement | null>(null);
  const bitisTarihiRef = useRef<HTMLInputElement | null>(null);
  const yazdirildiFiltreRef = useRef<HTMLSelectElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // Ok tuşları (Aşağı/Yukarı) ve Enter ile bir sonraki/önceki filtre alanına geçiş
  const handleFieldKeyDown = (
    e: React.KeyboardEvent<any>,
    nextRef?: React.RefObject<any>,
    prevRef?: React.RefObject<any>
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      nextRef?.current?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const filter: any = {
        grupKodu: grupFiltre || undefined,
        ureticiFirma: ureticiFiltre || undefined,
        baslangicTarihi: baslangicTarihi || undefined,
        bitisTarihi: bitisTarihi || undefined,
        yazdirildi: yazdirildiFiltre === "hepsi" ? undefined : yazdirildiFiltre === "evet",
        limit: 1000,
      };
      const [altin, ozel, sabl, yzc, grupKodlariRes, ureticiFirmalarRes] = await Promise.all([
        tipFiltre === "ozel" ? Promise.resolve([]) : EtiketService.getAltinUrunler(filter),
        tipFiltre === "altin" ? Promise.resolve([]) : EtiketService.getOzelUrunler(filter),
        EtiketService.getSablonlar(),
        PrinterService.getYazicilar().catch(() => []),
        EtiketService.getGrupKodlari().catch(() => []),
        EtiketService.getUreticiFirmalar().catch(() => []),
      ]);
      setAltinList(altin);
      setOzelList(ozel);
      setSablonlar(sabl);
      setYazicilar(yzc);
      setGrupKodlari(grupKodlariRes);
      setUreticiFirmalar(ureticiFirmalarRes);
      setSelectedKeys(new Set());
    } catch (err: any) {
      showNotif("danger", err?.message || "Veriler yüklenemedi.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipFiltre, grupFiltre, ureticiFiltre, baslangicTarihi, bitisTarihi, yazdirildiFiltre]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const gridRows: GridSatir[] = useMemo(() => {
    const altinRows: GridSatir[] = altinList.map((it) => ({
      key: `altin-${it.altinUrunId}`,
      tip: "altin",
      id: it.altinUrunId,
      tarih: it.tarih,
      grupKodu: it.grupKodu,
      urunNo: it.urunNo,
      barkod: it.barkod,
      aciklama: it.model || "Sarrafiye",
      ureticiFirma: it.ureticiFirma,
      yazdirildi: it.yazdirildi,
      raw: it,
    }));
    const ozelRows: GridSatir[] = ozelList.map((it) => ({
      key: `ozel-${it.ozelUrunId}`,
      tip: "ozel",
      id: it.ozelUrunId,
      tarih: it.tarih,
      grupKodu: it.grupKodu,
      urunNo: it.urunNo,
      barkod: it.barkod,
      aciklama: it.mamulTipi || "Özel Ürün",
      ureticiFirma: it.ureticiFirma,
      yazdirildi: it.yazdirildi,
      raw: it,
    }));
    return [...altinRows, ...ozelRows].sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
  }, [altinList, ozelList]);

  const allSelected = gridRows.length > 0 && gridRows.every((r) => selectedKeys.has(r.key));
  const toggleAll = () => {
    if (allSelected) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(gridRows.map((r) => r.key)));
  };
  const toggleRow = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const selectedRows = gridRows.filter((r) => selectedKeys.has(r.key));

  const handleMarkYazdirildi = useCallback(async (yazdirildi: boolean) => {
    if (selectedRows.length === 0) {
      showNotif("warning", "Lütfen en az bir ürün seçiniz.");
      return;
    }
    try {
      const altinIds = selectedRows.filter((r) => r.tip === "altin").map((r) => r.id);
      const ozelIds = selectedRows.filter((r) => r.tip === "ozel").map((r) => r.id);
      if (altinIds.length) await EtiketService.markAltinUrunYazdirildi(altinIds, yazdirildi);
      if (ozelIds.length) await EtiketService.markOzelUrunYazdirildi(ozelIds, yazdirildi);
      showNotif("success", `${selectedRows.length} ürün ${yazdirildi ? "yazdırıldı" : "yazdırılmadı"} olarak işaretlendi.`);
      await loadAll();
    } catch (err: any) {
      showNotif("danger", err?.message || "İşlem başarısız oldu.");
    }
  }, [selectedRows, loadAll]);

  const varsayilanSablon = sablonlar.find((s) => s.varsayilan) || sablonlar[0] || null;

  const printItems: EtiketYazdirItem[] = selectedRows.map((r) => {
    if (r.tip === "altin") {
      const it = r.raw as AltinUrunItem;
      return {
        id: `altin-${it.altinUrunId}`,
        barkod: it.barkod || `${it.grupKodu}${it.urunNo}`,
        fields: {
          grupUrunNo: `${it.grupKodu}-${it.urunNo}`,
          ayar: it.ayar || "-",
          has: String(it.hasGram || 0),
          gram: String(it.miktar || 0),
          fiyat: `${it.satisFiyati} ${it.satisParaKodu}`,
        },
      };
    }
    const it = r.raw as OzelUrunItem;
    return {
      id: `ozel-${it.ozelUrunId}`,
      barkod: it.barkod || `${it.grupKodu}${it.urunNo}`,
      fields: {
        grupUrunNo: `${it.grupKodu}-${it.urunNo}`,
        montur: it.ayar || "-",
        tasCinsi: it.tasCinsi || "-",
        fiyat: `${it.satisFiyati} ${it.satisParaKodu}`,
      },
    };
  });

  return (
    <div className="toplu-etiket-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="C- Toplu Etiket Yazdırma"
        pageIcon={<IconStack2 size={20} />}
        hideDelete
        hideSearch
        hideNavigation
        onRefresh={loadAll}
        onPrint={() => (selectedRows.length ? setShowPrintModal(true) : showNotif("warning", "Lütfen en az bir ürün seçiniz."))}
        modeText={`${gridRows.length} kayıt listeleniyor, ${selectedRows.length} seçili`}
      />

      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            {notification.type === "success" ? (
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      <Card className="shadow-sm border-0 mb-3">
        <Card.Header className="bg-light py-2 px-3 border-bottom d-flex align-items-center gap-2">
          <IconStack2 size={18} className="text-primary" />
          <span className="fw-bold text-dark">Filtreler</span>
        </Card.Header>
        <Card.Body className="p-3">
          <Row className="g-2">
            <Col md={2}>
              <Form.Label className="small fw-bold text-secondary">Ürün Tipi</Form.Label>
              <Form.Select
                ref={tipFiltreRef}
                size="sm"
                value={tipFiltre}
                onChange={(e) => setTipFiltre(e.target.value as any)}
                onKeyDown={(e) => handleFieldKeyDown(e, grupFiltreRef)}
              >
                <option value="hepsi">Hepsi</option>
                <option value="altin">Altın / Sarrafiye</option>
                <option value="ozel">Özel / Pırlanta</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-secondary">Ürün Grubu</Form.Label>
              <Form.Select
                ref={grupFiltreRef}
                size="sm"
                value={grupFiltre}
                onChange={(e) => setGrupFiltre(e.target.value)}
                onKeyDown={(e) => handleFieldKeyDown(e, ureticiFiltreRef, tipFiltreRef)}
              >
                <option value="">Tümü</option>
                {grupKodlari.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-secondary">Üretici Firma</Form.Label>
              <Form.Select
                ref={ureticiFiltreRef}
                size="sm"
                value={ureticiFiltre}
                onChange={(e) => setUreticiFiltre(e.target.value)}
                onKeyDown={(e) => handleFieldKeyDown(e, baslangicTarihiRef, grupFiltreRef)}
              >
                <option value="">Tümü</option>
                {ureticiFirmalar.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-secondary">Başlangıç Tarihi</Form.Label>
              <Form.Control
                ref={baslangicTarihiRef}
                type="date"
                size="sm"
                value={baslangicTarihi}
                onChange={(e) => setBaslangicTarihi(e.target.value)}
                onKeyDown={(e) => handleFieldKeyDown(e, bitisTarihiRef, ureticiFiltreRef)}
              />
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-secondary">Bitiş Tarihi</Form.Label>
              <Form.Control
                ref={bitisTarihiRef}
                type="date"
                size="sm"
                value={bitisTarihi}
                onChange={(e) => setBitisTarihi(e.target.value)}
                onKeyDown={(e) => handleFieldKeyDown(e, yazdirildiFiltreRef, baslangicTarihiRef)}
              />
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold text-secondary">Yazdırıldı Durumu</Form.Label>
              <Form.Select
                ref={yazdirildiFiltreRef}
                size="sm"
                value={yazdirildiFiltre}
                onChange={(e) => setYazdirildiFiltre(e.target.value as any)}
                onKeyDown={(e) => handleFieldKeyDown(e, undefined, bitisTarihiRef)}
              >
                <option value="hepsi">Hepsi</option>
                <option value="hayir">Yazdırılmayanlar</option>
                <option value="evet">Yazdırılanlar</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0 mb-3">
        <Card.Header className="bg-light py-2 px-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <IconChecklist size={18} className="text-primary" />
            <span className="fw-bold text-dark">Ürün Listesi ({gridRows.length})</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            {selectedRows.some((r) => r.yazdirildi) && (
              <Button
                variant="outline-warning"
                size="sm"
                onClick={() => handleMarkYazdirildi(false)}
                disabled={selectedRows.length === 0}
                className="d-flex align-items-center gap-1 fw-bold text-dark"
                title="Seçili ürünleri yazdırılmadı durumuna geri döndür"
              >
                <IconX size={14} /> Yazdırılmadı Olarak İşaretle
              </Button>
            )}
            {(!selectedRows.length || selectedRows.some((r) => !r.yazdirildi)) && (
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => handleMarkYazdirildi(true)}
                disabled={selectedRows.length === 0}
                className="d-flex align-items-center gap-1 fw-bold"
                title="Seçili ürünleri yazdırıldı olarak işaretle"
              >
                <IconCheck size={14} /> Yazdırıldı Olarak İşaretle
              </Button>
            )}
          </div>
        </Card.Header>
        <div style={{ maxHeight: "480px", overflowY: "auto" }}>
          <Table hover responsive size="sm" className="mb-0 align-middle">
            <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: "40px" }} className="text-center">
                  <Form.Check checked={allSelected} onChange={toggleAll} />
                </th>
                <th style={{ width: "90px" }}>Tip</th>
                <th style={{ width: "100px" }}>Tarih</th>
                <th style={{ width: "120px" }}>Barkod</th>
                <th style={{ width: "100px" }}>Grup-No</th>
                <th>Açıklama</th>
                <th>Üretici</th>
                <th style={{ width: "100px" }} className="text-center">Yazdırıldı</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">Filtre kriterlerine uygun kayıt bulunamadı.</td>
                </tr>
              ) : (
                gridRows.map((r) => (
                  <tr key={r.key} onClick={() => toggleRow(r.key)} style={{ cursor: "pointer" }} className={selectedKeys.has(r.key) ? "table-primary" : ""}>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Form.Check checked={selectedKeys.has(r.key)} onChange={() => toggleRow(r.key)} />
                    </td>
                    <td>
                      <Badge bg={r.tip === "altin" ? "warning" : "info"}>{r.tip === "altin" ? "Altın" : "Özel"}</Badge>
                    </td>
                    <td className="small">{new Date(r.tarih).toLocaleDateString("tr-TR")}</td>
                    <td className="font-monospace small fw-bold text-primary">{r.barkod || "-"}</td>
                    <td className="font-monospace small">{r.grupKodu}-{r.urunNo}</td>
                    <td className="small">{r.aciklama}</td>
                    <td className="small">{r.ureticiFirma || "-"}</td>
                    <td className="text-center">
                      <Badge bg={r.yazdirildi ? "success" : "secondary"}>{r.yazdirildi ? "Evet" : "Hayır"}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title={`Toplu Etiket Yazdırma (${selectedRows.length} ürün)`}
        sablon={varsayilanSablon}
        items={printItems}
        yazicilar={yazicilar}
        onAfterPrint={() => handleMarkYazdirildi(true)}
      />
    </div>
  );
};

export default TopluEtiketYazdirmaPage;
