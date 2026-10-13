import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Card,
  Table,
  Button,
  Form,
  InputGroup,
  Badge,
  Spinner,
  Alert,
  Row,
  Col,
  Modal,
} from "react-bootstrap";
import {
  IconSearch,
  IconBarcode,
  IconCoin,
  IconDiamond,
  IconEdit,
  IconRefresh,
  IconMaximize,
  IconMinimize,
  IconLayoutGrid,
  IconTable,
  IconBuildingStore,
  IconScale,
  IconTag,
  IconCash,
  IconSparkles,
  IconPrinter,
  IconFileSpreadsheet,
  IconExternalLink,
  IconPhoto,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EtiketService, AltinUrunItem, OzelUrunItem } from "../../services/etiketService";
import { printReportTable, PrintColumn } from "../../utils/printReport";

export interface ConsinyeUrunPanoPageProps {
  tip: "altin" | "ozel";
}

export const ConsinyeUrunPanoPage: React.FC<ConsinyeUrunPanoPageProps> = ({ tip }) => {
  const navigate = useNavigate();

  const isAltin = tip === "altin";
  const pageTitle = isAltin ? "F- Consinye Altın Ürün" : "G- Consinye Özel Ürün";
  const pageSubtitle = isAltin
    ? "Konsinye olarak kaydedilmiş tüm altın mücevher ve sarrafiye ürünleri canlı takip panosu"
    : "Konsinye olarak kaydedilmiş tüm pırlanta ve özel tasarım ürünleri canlı takip panosu";

  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Görünüm modu: "pano" (kartlar) | "tablo" (liste)
  const [viewMode, setViewMode] = useState<"pano" | "tablo">("pano");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const panoContainerRef = useRef<HTMLDivElement>(null);

  // Filtreler
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedAyar, setSelectedAyar] = useState<string>("all");
  const [selectedDurum, setSelectedDurum] = useState<string>("stok"); // "stok" | "satildi" | "all"
  const [selectedFirma, setSelectedFirma] = useState<string>("all");

  // Detay Modalı
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Veri yükleme
  const loadData = useCallback(async (isSilent: boolean = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      setError(null);

      if (isAltin) {
        const list = await EtiketService.getAltinUrunler();
        // Sadece konsinye olanları al
        const konsinyeList = (list || []).filter((item) => Boolean(item.konsinye));
        setItems(konsinyeList);
      } else {
        const list = await EtiketService.getOzelUrunler();
        // Sadece konsinye olanları al
        const konsinyeList = (list || []).filter((item) => Boolean(item.konsinye));
        setItems(konsinyeList);
      }
    } catch (err: any) {
      if (!isSilent) {
        setError(err.message || "Konsinye ürünler yüklenirken bir hata oluştu.");
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [isAltin]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Canlı Otomatik Güncelleme (BroadcastChannel + Storage Event + Window Events + 2s Polling)
  useEffect(() => {
    let bcKatalog: BroadcastChannel | null = null;
    let bcConsinye: BroadcastChannel | null = null;
    try {
      bcKatalog = new BroadcastChannel("likya_katalog_tv");
      bcKatalog.onmessage = () => {
        loadData(true);
      };
    } catch {}

    try {
      bcConsinye = new BroadcastChannel("likya_consinye_channel");
      bcConsinye.onmessage = () => {
        loadData(true);
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "likya_katalog_tv_update" || e.key === "likya_consinye_update") {
        loadData(true);
      }
    };
    window.addEventListener("storage", handleStorage);

    const handleCustomEvent = () => {
      loadData(true);
    };
    window.addEventListener("likya_consinye_update", handleCustomEvent);
    window.addEventListener("likya_katalog_tv_update", handleCustomEvent);
    window.addEventListener("focus", handleCustomEvent);

    // 2 saniyede bir canlı arka plan kontrolü
    const interval = setInterval(() => {
      loadData(true);
    }, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("likya_consinye_update", handleCustomEvent);
      window.removeEventListener("likya_katalog_tv_update", handleCustomEvent);
      window.removeEventListener("focus", handleCustomEvent);
      if (bcKatalog) bcKatalog.close();
      if (bcConsinye) bcConsinye.close();
    };
  }, [loadData]);

  // Filtreleme seçenekleri
  const uniqueAyarlar = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.ayar) set.add(String(it.ayar).trim());
      if (it.mamulTipi) set.add(String(it.mamulTipi).trim());
    });
    return Array.from(set).sort();
  }, [items]);

  const uniqueFirmalar = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.ureticiFirma) set.add(String(it.ureticiFirma).trim());
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtrelenmiş Liste
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Ayar / Mamul tipi
      if (selectedAyar !== "all") {
        const itemAyar = String(item.ayar || item.mamulTipi || "").trim();
        if (itemAyar !== selectedAyar) return false;
      }

      // Üretici / Konsinye Veren Firma
      if (selectedFirma !== "all") {
        const itemFirma = String(item.ureticiFirma || "").trim();
        if (itemFirma !== selectedFirma) return false;
      }

      // Durum
      if (selectedDurum === "stok" && item.satildi) return false;
      if (selectedDurum === "satildi" && !item.satildi) return false;

      // Arama
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.barkod && item.barkod.toLowerCase().includes(term)) ||
        (item.model && item.model.toLowerCase().includes(term)) ||
        (item.ureticiFirma && item.ureticiFirma.toLowerCase().includes(term)) ||
        (item.banko && item.banko.toLowerCase().includes(term)) ||
        (item.grupKodu && item.grupKodu.toLowerCase().includes(term)) ||
        (item.orjinalKod && item.orjinalKod.toLowerCase().includes(term)) ||
        String(item.urunNo).includes(term)
      );
    });
  }, [items, selectedAyar, selectedFirma, selectedDurum, searchTerm]);

  // Özet İstatistikler (KPI)
  const stats = useMemo(() => {
    let toplamMiktar = 0;
    let toplamHas = 0;
    let toplamKarat = 0;
    let toplamMaliyet = 0;
    let toplamSatis = 0;
    let stoktaAdet = 0;
    let satildiAdet = 0;

    filteredItems.forEach((it) => {
      toplamMiktar += Number(it.miktar || it.monturGram || 0);
      toplamHas += Number(it.hasGram || 0);
      toplamKarat += Number(it.toplamKarat || 0);
      toplamMaliyet += Number(it.maliyet || 0);
      toplamSatis += Number(it.satisFiyati || 0);
      if (it.satildi) satildiAdet++;
      else stoktaAdet++;
    });

    return {
      toplamAdet: filteredItems.length,
      stoktaAdet,
      satildiAdet,
      toplamMiktar,
      toplamHas,
      toplamKarat,
      toplamMaliyet,
      toplamSatis,
    };
  }, [filteredItems]);

  // Sayı Formatlayıcı
  const formatNum = (val: number, fraction: number = 2) => {
    return new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(val || 0);
  };

  // Fiyat Formatlayıcı
  const formatPrice = (val: number, paraBirimi: string = "₺") => {
    const formatted = formatNum(val, 2);
    const p = (paraBirimi || "").toUpperCase().trim();
    let sembol = "₺";
    if (p === "USD" || p === "$") sembol = "$";
    else if (p === "EUR" || p === "€") sembol = "€";
    else if (p === "GBP" || p === "£") sembol = "£";
    return `${formatted} ${sembol}`;
  };

  // Tam Ekran Değiştirici
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (panoContainerRef.current?.requestFullscreen) {
        panoContainerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Düzenleme Sayfasına Git
  const handleEditItem = (item: any) => {
    if (!item) return;
    const idVal = item.altinUrunId || item.ozelUrunId || item.id || "";
    const barkodVal = item.barkod || "";
    if (isAltin) {
      navigate(`/etiket/altin-urun-duzeltme?id=${encodeURIComponent(idVal)}&barkod=${encodeURIComponent(barkodVal)}`);
    } else {
      navigate(`/etiket/ozel-urun-duzeltme?id=${encodeURIComponent(idVal)}&barkod=${encodeURIComponent(barkodVal)}`);
    }
  };

  // Yazdırma / Excel
  const handlePrint = () => {
    const columns: PrintColumn<any>[] = [
      { header: "Barkod", key: "barkod" },
      { header: isAltin ? "Ayar" : "Mamul Tipi", render: (it: any) => it.ayar || it.mamulTipi || "-" },
      { header: "Model", key: "model" },
      { header: "Miktar", render: (it: any) => `${formatNum(it.miktar || it.monturGram || 0)} Gr` },
      { header: "Maliyet", render: (it: any) => formatPrice(it.maliyet, it.maliyetParaKodu) },
      { header: "Satış Fiyatı", render: (it: any) => formatPrice(it.satisFiyati, it.satisParaKodu) },
      { header: "Firma / Sahip", key: "ureticiFirma" },
      { header: "Durum", render: (it: any) => (it.satildi ? "Satıldı" : "Stokta") },
    ];
    printReportTable({
      title: `${pageTitle} Listesi`,
      subtitle: `Toplam ${filteredItems.length} Konsinye Kaydı`,
      columns,
      data: filteredItems,
    });
  };

  // Resim çözümleme (varsa veri döndürür, yoksa null)
  const resolveItemImage = (it: any): string | null => {
    if (!it) return null;
    if (it.resim) {
      const r = String(it.resim).trim();
      if (r && r !== "/images/placeholder-jewelry.svg" && r !== "null" && r !== "undefined") {
        if (r.startsWith("data:") || r.startsWith("http")) return r;
        return `data:image/jpeg;base64,${r}`;
      }
    }
    if (it.resimler && Array.isArray(it.resimler) && it.resimler.length > 0) {
      const first = it.resimler[0];
      if (typeof first === "string") {
        const r = first.trim();
        if (r && r !== "/images/placeholder-jewelry.svg" && r !== "null" && r !== "undefined") {
          return r.startsWith("data:") || r.startsWith("http") ? r : `data:image/jpeg;base64,${r}`;
        }
      }
      if (first?.resimData) {
        const r = String(first.resimData).trim();
        if (r && r !== "/images/placeholder-jewelry.svg" && r !== "null" && r !== "undefined") {
          return r.startsWith("data:") ? r : `data:image/jpeg;base64,${r}`;
        }
      }
    }
    return null;
  };

  return (
    <div ref={panoContainerRef} className={`consinye-pano-page p-3 ${isFullscreen ? "bg-dark text-white min-vh-100 p-4" : ""}`}>
      {/* ─── ERP TOOLBAR (KONSİNYE PANOSU BAŞLIĞI VE VİTRİN/TABLO SEÇİMİ DÜZENLEMENİN SOLUNDA) ─── */}
      <ERPToolbar
        pageTitle={
          <div className="d-flex align-items-center gap-2">
            <span>{pageTitle}</span>
            <span
              className="badge px-2 py-0.5 rounded-pill fw-bold"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1e293b",
                fontSize: "11px",
                letterSpacing: "0.3px",
              }}
            >
              KONSİNYE PANOSU
            </span>
            <span
              className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill fw-semibold d-flex align-items-center gap-1"
              style={{ fontSize: "11px" }}
            >
              <span className="spinner-grow spinner-grow-sm" style={{ width: "5px", height: "5px" }} />
              Canlı
            </span>
          </div>
        }
        pageIcon={isAltin ? <IconCoin size={20} className="text-warning" /> : <IconDiamond size={20} className="text-info" />}
        onRefresh={() => loadData(false)}
        onPrint={handlePrint}
        rightContent={
          <div className="d-flex align-items-center gap-1.5 me-1">
            <div className="btn-group btn-group-sm" role="group">
              <Button
                variant={viewMode === "pano" ? "primary" : "outline-secondary"}
                size="sm"
                onClick={() => setViewMode("pano")}
                className="py-1 px-2.5 d-flex align-items-center gap-1 fw-medium"
                style={{ fontSize: "12px", height: "28px" }}
                title="Vitrin Panosu Görünümü"
              >
                <IconLayoutGrid size={14} />
                <span className="d-none d-sm-inline">Vitrin Panosu</span>
              </Button>
              <Button
                variant={viewMode === "tablo" ? "primary" : "outline-secondary"}
                size="sm"
                onClick={() => setViewMode("tablo")}
                className="py-1 px-2.5 d-flex align-items-center gap-1 fw-medium"
                style={{ fontSize: "12px", height: "28px" }}
                title="Tablo Listesi Görünümü"
              >
                <IconTable size={14} />
                <span className="d-none d-sm-inline">Tablo Listesi</span>
              </Button>
            </div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={toggleFullscreen}
              className="py-1 px-2 d-flex align-items-center gap-1"
              style={{ fontSize: "12px", height: "28px" }}
              title={isFullscreen ? "Tam Ekrandan Çık (F)" : "Tam Ekran Pano (F)"}
            >
              {isFullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
            </Button>
          </div>
        }
      />

      {/* ─── KPI ÖZET KARTLARI (KOMPAKT & ŞIK) ─── */}
      <Row className="g-2 mb-2.5">
        <Col xs={6} md={3}>
          <Card className="border-0 shadow-xs h-100" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", borderRadius: "10px" }}>
            <Card.Body className="py-2 px-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "0.3px" }}>
                  Toplam Konsinye
                </div>
                <div className="fs-5 fw-bolder text-dark lh-1 my-1">
                  {stats.toplamAdet} <span className="fs-7 fw-normal">Adet</span>
                </div>
                <div className="small text-muted" style={{ fontSize: "0.72rem" }}>
                  <span className="text-success fw-semibold">{stats.stoktaAdet} Stokta</span> •{" "}
                  <span className="text-danger fw-semibold">{stats.satildiAdet} Satıldı</span>
                </div>
              </div>
              <div className="p-2 rounded-circle bg-white shadow-xs text-warning flex-shrink-0">
                <IconBuildingStore size={20} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={3}>
          <Card className="border-0 shadow-xs h-100" style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", borderRadius: "10px" }}>
            <Card.Body className="py-2 px-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "0.3px" }}>
                  {isAltin ? "Toplam Ağırlık / Has" : "Montür & Karat"}
                </div>
                <div className="fs-5 fw-bolder text-dark lh-1 my-1">
                  {formatNum(stats.toplamMiktar)} <span className="fs-7 fw-normal">Gr</span>
                </div>
                <div className="small text-muted" style={{ fontSize: "0.72rem" }}>
                  {isAltin ? (
                    <span>Has: <strong>{formatNum(stats.toplamHas, 3)} Gr</strong></span>
                  ) : (
                    <span>Pırlanta: <strong>{formatNum(stats.toplamKarat, 2)} Ct</strong></span>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-circle bg-white shadow-xs text-primary flex-shrink-0">
                <IconScale size={20} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={3}>
          <Card className="border-0 shadow-xs h-100" style={{ background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)", borderRadius: "10px" }}>
            <Card.Body className="py-2 px-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "0.3px" }}>
                  Konsinye Satış Değeri
                </div>
                <div className="fs-5 fw-bolder text-success lh-1 my-1">
                  {formatNum(stats.toplamSatis)} <span className="fs-7 fw-normal">₺</span>
                </div>
                <div className="small text-muted" style={{ fontSize: "0.72rem" }}>
                  Etiket Satış Toplamı
                </div>
              </div>
              <div className="p-2 rounded-circle bg-white shadow-xs text-success flex-shrink-0">
                <IconCash size={20} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={3}>
          <Card className="border-0 shadow-xs h-100" style={{ background: "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)", borderRadius: "10px" }}>
            <Card.Body className="py-2 px-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "0.3px" }}>
                  Konsinye Maliyet
                </div>
                <div className="fs-5 fw-bolder text-dark lh-1 my-1">
                  {formatNum(stats.toplamMaliyet)} <span className="fs-7 fw-normal">₺</span>
                </div>
                <div className="small text-muted" style={{ fontSize: "0.72rem" }}>
                  Toplam Konsinye Maliyeti
                </div>
              </div>
              <div className="p-2 rounded-circle bg-white shadow-xs text-purple flex-shrink-0">
                <IconTag size={20} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ─── FİLTRELER: AYAR TİPİ, KONSİNYE VEREN FİRMALAR, STOKTAKİLER (YAN YANA & ÇOK DAHA KISA) ─── */}
      <div
        className="d-flex align-items-center gap-2 flex-wrap flex-lg-nowrap px-3 py-1.5 bg-white rounded-2 border shadow-2xs mb-3"
        style={{ fontSize: "13px" }}
      >
        {/* Arama Inputu */}
        <div className="flex-grow-1" style={{ minWidth: "180px" }}>
          <InputGroup size="sm">
            <InputGroup.Text className="bg-light border-end-0 text-muted px-2.5">
              <IconSearch size={14} />
            </InputGroup.Text>
            <Form.Control
              placeholder="Barkod, model, firma veya açıklama ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-start-0 shadow-none"
              style={{ fontSize: "12.5px", height: "30px" }}
            />
            {searchTerm && (
              <Button
                variant="outline-secondary"
                size="sm"
                className="border-start-0 bg-white px-2"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </Button>
            )}
          </InputGroup>
        </div>

        {/* Ayar / Mamul Tipi */}
        <div style={{ minWidth: "170px", flexShrink: 0 }}>
          <Form.Select
            size="sm"
            value={selectedAyar}
            onChange={(e) => setSelectedAyar(e.target.value)}
            className="shadow-none border-secondary-subtle"
            style={{ fontSize: "12.5px", height: "30px", backgroundColor: selectedAyar !== "all" ? "#fef3c7" : "#ffffff" }}
          >
            <option value="all">Tüm Ayarlar / Tipler</option>
            {uniqueAyarlar.map((ay) => (
              <option key={ay} value={ay}>
                {ay}
              </option>
            ))}
          </Form.Select>
        </div>

        {/* Konsinye Veren Firmalar */}
        <div style={{ minWidth: "210px", flexShrink: 0 }}>
          <Form.Select
            size="sm"
            value={selectedFirma}
            onChange={(e) => setSelectedFirma(e.target.value)}
            className="shadow-none border-secondary-subtle"
            style={{ fontSize: "12.5px", height: "30px", backgroundColor: selectedFirma !== "all" ? "#e0f2fe" : "#ffffff" }}
          >
            <option value="all">Tüm Konsinye Veren Firmalar</option>
            {uniqueFirmalar.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Form.Select>
        </div>

        {/* Stoktakiler Durumu */}
        <div style={{ minWidth: "165px", flexShrink: 0 }}>
          <Form.Select
            size="sm"
            value={selectedDurum}
            onChange={(e) => setSelectedDurum(e.target.value)}
            className="shadow-none border-secondary-subtle"
            style={{ fontSize: "12.5px", height: "30px", backgroundColor: selectedDurum !== "stok" ? "#f1f5f9" : "#ffffff" }}
          >
            <option value="stok">Yalnızca Stoktakiler</option>
            <option value="all">Tümü (Stokta + Satıldı)</option>
            <option value="satildi">Yalnızca Satılanlar</option>
          </Form.Select>
        </div>

        {/* Filtreleri Sıfırla (Aktif Filtre Varsa) */}
        {(searchTerm || selectedAyar !== "all" || selectedFirma !== "all" || selectedDurum !== "stok") && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setSelectedAyar("all");
              setSelectedFirma("all");
              setSelectedDurum("stok");
            }}
            className="px-2.5 py-0 d-flex align-items-center gap-1 flex-shrink-0"
            style={{ height: "30px", fontSize: "12px" }}
            title="Tüm Filtreleri Temizle"
          >
            <span>Temizle</span>
          </Button>
        )}
      </div>

      {/* ─── İÇERİK: PANO VEYA TABLO ─── */}
      {isLoading ? (
        <div className="text-center p-5">
          <Spinner animation="border" variant="warning" style={{ width: "3rem", height: "3rem" }} />
          <h5 className="mt-3 text-muted">Konsinye Ürünler Yükleniyor...</h5>
        </div>
      ) : error ? (
        <Alert variant="danger">
          <Alert.Heading>Hata Oluştu</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" size="sm" onClick={() => loadData(false)}>
            Yeniden Dene
          </Button>
        </Alert>
      ) : filteredItems.length === 0 ? (
        <Card className="text-center p-5 border-0 shadow-sm">
          <div className="mb-3 text-muted">
            <IconBuildingStore size={48} className="text-warning opacity-75" />
          </div>
          <h5 className="fw-bold">Konsinye Ürün Bulunamadı</h5>
          <p className="text-muted small mb-3">
            {searchTerm || selectedAyar !== "all" || selectedFirma !== "all"
              ? "Arama kriterlerinize uygun konsinye kayıt bulunamadı."
              : isAltin
              ? "Altın Ürün Barkodlama ekranından 'Konsinye' kutusu işaretlenerek kaydedilmiş ürün bulunmamaktadır."
              : "Özel Ürün Barkodlama ekranından 'Konsinye' kutusu işaretlenerek kaydedilmiş ürün bulunmamaktadır."}
          </p>
          <div>
            <Button
              variant="warning"
              size="sm"
              onClick={() => {
                navigate(isAltin ? "/etiket/altin-urun-barkodlama" : "/etiket/ozel-urun-barkodlama");
              }}
            >
              + Yeni Konsinye Ürün Ekle
            </Button>
          </div>
        </Card>
      ) : viewMode === "pano" ? (
        /* ─── 1. VİTRİN PANO GÖRÜNÜMÜ (SHOWCASE CARDS) ─── */
        <Row className="g-3">
          {filteredItems.map((item) => {
            const itemKey = String(item.altinUrunId || item.ozelUrunId || item.barkod || "");
            const imgSrc = resolveItemImage(item);
            const hasValidImage = Boolean(imgSrc && !imageErrorMap[itemKey]);
            return (
              <Col key={item.altinUrunId || item.ozelUrunId || item.barkod} xs={12} sm={6} md={4} lg={3} xl={2.4}>
                <Card
                  className="border h-100 shadow-sm position-relative product-pano-card transition-all"
                  style={{
                    borderRadius: "14px",
                    overflow: "hidden",
                    cursor: "pointer",
                    borderColor: "#e2e8f0",
                  }}
                  onClick={() => {
                    setSelectedItem(item);
                    setShowDetailModal(true);
                  }}
                >
                  {/* Üst Rozetler */}
                  <div className="position-absolute top-0 start-0 w-100 p-2 d-flex justify-content-between align-items-center" style={{ zIndex: 10 }}>
                    <Badge
                      bg="warning"
                      text="dark"
                      className="shadow-sm fw-bold px-2 py-1 d-flex align-items-center gap-1"
                      style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
                    >
                      <IconSparkles size={11} />
                      KONSİNYE
                    </Badge>
                    <Badge
                      bg={item.satildi ? "danger" : "success"}
                      className="shadow-sm fw-semibold px-2 py-0.5"
                      style={{ fontSize: "0.68rem" }}
                    >
                      {item.satildi ? "Satıldı" : "Stokta"}
                    </Badge>
                  </div>

                  {/* Ürün Görseli */}
                  <div
                    className="position-relative bg-light d-flex align-items-center justify-content-center overflow-hidden"
                    style={{ height: "180px" }}
                  >
                    {hasValidImage ? (
                      <img
                        src={imgSrc!}
                        alt={item.model || "Konsinye Ürün"}
                        style={{
                          maxHeight: "100%",
                          maxWidth: "100%",
                          objectFit: "contain",
                          padding: "8px",
                          transition: "transform 0.25s ease",
                        }}
                        onError={() => setImageErrorMap((prev) => ({ ...prev, [itemKey]: true }))}
                      />
                    ) : (
                      <div className="d-flex flex-column align-items-center justify-content-center text-muted p-3 text-center">
                        <IconPhoto size={26} className="text-secondary opacity-40 mb-1" />
                        <span className="text-secondary small fw-medium" style={{ fontSize: "11px", letterSpacing: "0.2px" }}>
                          Görsel Yok
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Kart Gövdesi */}
                  <Card.Body className="p-3 d-flex flex-column justify-content-between">
                    <div>
                      {/* Model & Ayar */}
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="badge rounded-pill bg-dark bg-opacity-75 text-warning" style={{ fontSize: "0.65rem" }}>
                          {item.ayar || item.mamulTipi || (isAltin ? "ALTIN" : "ÖZEL")}
                        </span>
                        {item.ureticiFirma && (
                          <span className="text-muted small text-truncate" style={{ fontSize: "0.7rem", maxWidth: "110px" }} title={item.ureticiFirma}>
                            {item.ureticiFirma}
                          </span>
                        )}
                      </div>

                      <h6 className="fw-bold mb-1 text-truncate" title={item.model || "İsimsiz Model"}>
                        {item.model || (isAltin ? "Altın Mücevher" : "Özel Tasarım")}
                      </h6>

                      {/* Barkod Rozeti */}
                      <div className="d-inline-flex align-items-center gap-1 font-monospace text-muted small mb-2 px-1.5 py-0.5 rounded bg-light border" style={{ fontSize: "0.72rem" }}>
                        <IconBarcode size={14} className="text-secondary" />
                        <span>{item.barkod || `${item.grupKodu}-${item.urunNo}`}</span>
                      </div>

                      {/* Ağırlık / Gramaj */}
                      <div className="d-flex align-items-center justify-content-between py-1 border-top border-bottom my-1.5 small">
                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                          <IconScale size={13} className="me-1 text-warning" />
                          Ağırlık:
                        </span>
                        <span className="fw-bold">
                          {formatNum(item.miktar || item.monturGram || 0)} Gr
                        </span>
                      </div>

                      {isAltin && item.hasGram > 0 && (
                        <div className="d-flex align-items-center justify-content-between small text-muted" style={{ fontSize: "0.72rem" }}>
                          <span>Has Değer:</span>
                          <span className="fw-semibold">{formatNum(item.hasGram, 3)} Gr</span>
                        </div>
                      )}

                      {!isAltin && item.toplamKarat > 0 && (
                        <div className="d-flex align-items-center justify-content-between small text-muted" style={{ fontSize: "0.72rem" }}>
                          <span>Toplam Karat:</span>
                          <span className="fw-semibold">{formatNum(item.toplamKarat, 2)} Ct</span>
                        </div>
                      )}
                    </div>

                    {/* Fiyat ve Hızlı Buton */}
                    <div className="mt-2 pt-1 border-top">
                      <div className="d-flex align-items-baseline justify-content-between">
                        <span className="text-muted small" style={{ fontSize: "0.7rem" }}>Satış Fiyatı:</span>
                        <span className="fw-bolder text-success fs-6">
                          {formatPrice(item.satisFiyati, item.satisParaKodu)}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-1.5 mt-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="w-100 py-1 d-flex align-items-center justify-content-center gap-1"
                          style={{ fontSize: "0.75rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditItem(item);
                          }}
                          title="Ürün Kaydını Düzelt / İncele"
                        >
                          <IconEdit size={13} />
                          <span>Düzelt</span>
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        /* ─── 2. DETAYLI TABLO LİSTE GÖRÜNÜMÜ (TABLE VIEW) ─── */
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <Table hover striped className="mb-0 align-middle small">
              <thead className="table-dark">
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th style={{ width: "50px" }}>Görsel</th>
                  <th>Barkod</th>
                  <th>Model / Tanım</th>
                  <th>{isAltin ? "Ayar" : "Mamul Tipi"}</th>
                  <th className="text-end">Miktar (Gr)</th>
                  {isAltin && <th className="text-end">Has (Gr)</th>}
                  {!isAltin && <th className="text-end">Karat (Ct)</th>}
                  <th className="text-end">Maliyet</th>
                  <th className="text-end">Satış Fiyatı</th>
                  <th>Konsinye Firma / Sahip</th>
                  <th>Banko</th>
                  <th className="text-center">Durum</th>
                  <th className="text-center" style={{ width: "90px" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const itemKey = String(item.altinUrunId || item.ozelUrunId || item.barkod || idx);
                  const imgSrc = resolveItemImage(item);
                  const hasValidImage = Boolean(imgSrc && !imageErrorMap[itemKey]);
                  return (
                    <tr
                      key={item.altinUrunId || item.ozelUrunId || item.barkod}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDetailModal(true);
                      }}
                    >
                      <td>{idx + 1}</td>
                      <td>
                        {hasValidImage ? (
                          <img
                            src={imgSrc!}
                            alt="Ürün"
                            style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "4px" }}
                            onError={() => setImageErrorMap((prev) => ({ ...prev, [itemKey]: true }))}
                          />
                        ) : (
                          <span
                            className="badge bg-light text-muted border py-1 px-1 fw-normal text-nowrap d-inline-block text-center"
                            style={{ fontSize: "9px", minWidth: "48px" }}
                          >
                            Görsel Yok
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="font-monospace fw-bold text-dark">{item.barkod || `${item.grupKodu}-${item.urunNo}`}</span>
                        <Badge bg="warning" text="dark" className="ms-1 py-0.5 px-1" style={{ fontSize: "9px" }}>
                          KONSİNYE
                        </Badge>
                      </td>
                      <td>
                        <span className="fw-semibold">{item.model || "-"}</span>
                        {item.orjinalKod && <div className="text-muted font-monospace" style={{ fontSize: "10px" }}>{item.orjinalKod}</div>}
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border">
                          {item.ayar || item.mamulTipi || "-"}
                        </Badge>
                      </td>
                      <td className="text-end fw-bold">{formatNum(item.miktar || item.monturGram || 0)}</td>
                      {isAltin && <td className="text-end">{formatNum(item.hasGram, 3)}</td>}
                      {!isAltin && <td className="text-end">{formatNum(item.toplamKarat, 2)}</td>}
                      <td className="text-end text-muted">{formatPrice(item.maliyet, item.maliyetParaKodu)}</td>
                      <td className="text-end fw-bold text-success">{formatPrice(item.satisFiyati, item.satisParaKodu)}</td>
                      <td>{item.ureticiFirma || "-"}</td>
                      <td>{item.banko || "-"}</td>
                      <td className="text-center">
                        <Badge bg={item.satildi ? "danger" : "success"}>
                          {item.satildi ? "Satıldı" : "Stokta"}
                        </Badge>
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="py-0.5 px-2"
                          onClick={() => handleEditItem(item)}
                          title="Düzelt"
                        >
                          <IconEdit size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={5}>Toplam ({filteredItems.length} Konsinye Ürün)</td>
                  <td className="text-end">{formatNum(stats.toplamMiktar)} Gr</td>
                  {isAltin && <td className="text-end">{formatNum(stats.toplamHas, 3)} Gr</td>}
                  {!isAltin && <td className="text-end">{formatNum(stats.toplamKarat, 2)} Ct</td>}
                  <td className="text-end">{formatNum(stats.toplamMaliyet)} ₺</td>
                  <td className="text-end text-success">{formatNum(stats.toplamSatis)} ₺</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </Table>
          </div>
        </Card>
      )}

      {/* ─── DETAY MODALI ─── */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <Badge bg="warning" text="dark">KONSİNYE</Badge>
            <span>{selectedItem?.model || "Konsinye Ürün Detayı"}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedItem && (() => {
            const modalKey = `modal_${selectedItem.altinUrunId || selectedItem.ozelUrunId || selectedItem.barkod || ""}`;
            const modalImg = resolveItemImage(selectedItem);
            const modalHasValid = Boolean(modalImg && !imageErrorMap[modalKey]);
            return (
              <Row className="g-4 align-items-center">
                <Col xs={12} md={5} className="text-center">
                  <div
                    className="p-3 bg-light rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                    style={{ height: "260px" }}
                  >
                    {modalHasValid ? (
                      <img
                        src={modalImg!}
                        alt={selectedItem.model}
                        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                        onError={() => setImageErrorMap((prev) => ({ ...prev, [modalKey]: true }))}
                      />
                    ) : (
                      <div className="d-flex flex-column align-items-center justify-content-center text-muted p-4 text-center">
                        <IconPhoto size={36} className="text-secondary opacity-40 mb-2" />
                        <span className="text-secondary fw-medium" style={{ fontSize: "12px" }}>
                          Görsel Yok
                        </span>
                      </div>
                    )}
                  </div>
                </Col>
              <Col xs={12} md={7}>
                <div className="mb-2">
                  <span className="badge bg-warning text-dark me-2">KONSİNYE ÜRÜN</span>
                  <span className={`badge ${selectedItem.satildi ? "bg-danger" : "bg-success"}`}>
                    {selectedItem.satildi ? "Satıldı" : "Stokta"}
                  </span>
                </div>
                <h4 className="fw-bold mb-1">{selectedItem.model || "İsimsiz Model"}</h4>
                <div className="font-monospace text-muted mb-3">Barkod: <strong>{selectedItem.barkod}</strong></div>

                <div className="list-group list-group-flush small">
                  <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                    <span className="text-muted">{isAltin ? "Ayar:" : "Mamul Tipi:"}</span>
                    <span className="fw-bold">{selectedItem.ayar || selectedItem.mamulTipi || "-"}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                    <span className="text-muted">Ağırlık / Gramaj:</span>
                    <span className="fw-bold">{formatNum(selectedItem.miktar || selectedItem.monturGram || 0)} Gr</span>
                  </div>
                  {isAltin && selectedItem.hasGram > 0 && (
                    <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Has Gram:</span>
                      <span className="fw-bold">{formatNum(selectedItem.hasGram, 3)} Gr</span>
                    </div>
                  )}
                  {!isAltin && selectedItem.toplamKarat > 0 && (
                    <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Toplam Karat:</span>
                      <span className="fw-bold">{formatNum(selectedItem.toplamKarat, 2)} Ct</span>
                    </div>
                  )}
                  <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                    <span className="text-muted">Konsinye Veren / Üretici Firma:</span>
                    <span className="fw-semibold text-primary">{selectedItem.ureticiFirma || "-"}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                    <span className="text-muted">Vezne / Banko:</span>
                    <span>{selectedItem.banko || selectedItem.vezneAd || "-"}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between px-0 py-1.5">
                    <span className="text-muted">Maliyet:</span>
                    <span>{formatPrice(selectedItem.maliyet, selectedItem.maliyetParaKodu)}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between px-0 py-1.5 bg-light px-2 rounded mt-1">
                    <span className="fw-bold text-dark">Satış Fiyatı:</span>
                    <span className="fw-bolder text-success fs-5">
                      {formatPrice(selectedItem.satisFiyati, selectedItem.satisParaKodu)}
                    </span>
                  </div>
                </div>
              </Col>
            </Row>
          );
        })()}
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowDetailModal(false)}>
            Kapat
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowDetailModal(false);
              handleEditItem(selectedItem);
            }}
          >
            <IconEdit size={15} className="me-1" />
            Düzenleme Ekranına Git
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ConsinyeUrunPanoPage;
