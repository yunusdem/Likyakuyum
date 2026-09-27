import React, { useEffect, useState, useMemo } from "react";
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
} from "react-bootstrap";
import {
  IconSearch,
  IconBuildingStore,
  IconDiamond,
  IconCoin,
  IconCurrencyDollar,
  IconEdit,
  IconLayersLinked,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EtiketService, AltinUrunItem, OzelUrunItem } from "../../services/etiketService";
import { printReportTable, PrintColumn } from "../../utils/printReport";

interface UnifiedProduct {
  id: number;
  tur: "ALTIN" | "ÖZEL / PIRLANTA";
  barkod: string;
  urunNo: number;
  grupKodu: string;
  ayar: string;
  model: string;
  ureticiFirma: string;
  banko: string;
  miktar: number;
  hasGram: number;
  karat: number;
  maliyet: number;
  maliyetParaKodu: string;
  satisFiyati: number;
  satisParaKodu: string;
  satildi: boolean;
  yazdirildi: boolean;
  tarih: string;
}

export const VitrinStokTakibiPage: React.FC = () => {
  const navigate = useNavigate();

  const [altinUrunler, setAltinUrunler] = useState<AltinUrunItem[]>([]);
  const [ozelUrunler, setOzelUrunler] = useState<OzelUrunItem[]>([]);
  const [bankolar, setBankolar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtreler
  const [selectedBanko, setSelectedBanko] = useState<string>("all");
  const [selectedUrunTipi, setSelectedUrunTipi] = useState<string>("all");
  const [selectedDurum, setSelectedDurum] = useState<string>("stok");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [altinList, ozelList, bankoList] = await Promise.all([
        EtiketService.getAltinUrunler().catch(() => []),
        EtiketService.getOzelUrunler().catch(() => []),
        EtiketService.getBankolar().catch(() => []),
      ]);

      setAltinUrunler(altinList || []);
      setOzelUrunler(ozelList || []);
      setBankolar(bankoList || []);
    } catch (err: any) {
      setError(err.message || "Vitrin stok verileri yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Yalnızca Sistemde Kayıtlı Olan Bankolar
  const bankoOptions = useMemo<string[]>(() => {
    const set = new Set<string>();

    // 1. Banko tanımlarından al (bankoAdi veya bankoKodu)
    bankolar.forEach((b: any) => {
      const name = (b.bankoAdi || b.bankoKodu || "").trim();
      if (name) {
        set.add(name);
      }
    });

    // 2. Ürünlerde atanmış bankolar varsa onları da ekle
    altinUrunler.forEach((a) => {
      const name = (a.banko || "").trim();
      if (name) {
        set.add(name);
      }
    });

    ozelUrunler.forEach((o) => {
      const name = (o.banko || "").trim();
      if (name) {
        set.add(name);
      }
    });

    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
  }, [bankolar, altinUrunler, ozelUrunler]);

  // Birleştirilmiş Ürün Listesi
  const unifiedProducts = useMemo<UnifiedProduct[]>(() => {
    const list: UnifiedProduct[] = [];

    if (selectedUrunTipi === "all" || selectedUrunTipi === "altin") {
      altinUrunler.forEach((a) => {
        list.push({
          id: a.altinUrunId,
          tur: "ALTIN",
          barkod: a.barkod || `#${a.urunNo}`,
          urunNo: a.urunNo,
          grupKodu: a.grupKodu,
          ayar: a.ayar || "-",
          model: a.model || "-",
          ureticiFirma: a.ureticiFirma || "-",
          banko: (a.banko || "").trim() || "-",
          miktar: a.miktar || 1,
          hasGram: a.hasGram || 0,
          karat: 0,
          maliyet: a.maliyet || 0,
          maliyetParaKodu: a.maliyetParaKodu || "USD",
          satisFiyati: a.satisFiyati || 0,
          satisParaKodu: a.satisParaKodu || "USD",
          satildi: Boolean(a.satildi),
          yazdirildi: Boolean(a.yazdirildi),
          tarih: a.tarih,
        });
      });
    }

    if (selectedUrunTipi === "all" || selectedUrunTipi === "ozel") {
      ozelUrunler.forEach((o) => {
        list.push({
          id: o.ozelUrunId,
          tur: "ÖZEL / PIRLANTA",
          barkod: o.barkod || `#${o.urunNo}`,
          urunNo: o.urunNo,
          grupKodu: o.grupKodu,
          ayar: o.ayar || "-",
          model: o.modelOzellik1 || o.tasCinsi || "Pırlanta",
          ureticiFirma: o.ureticiFirma || "-",
          banko: (o.banko || "").trim() || "-",
          miktar: o.miktar || 1,
          hasGram: 0,
          karat: Number(o.tasMiktar || 0),
          maliyet: o.maliyet || 0,
          maliyetParaKodu: o.maliyetParaKodu || "USD",
          satisFiyati: o.satisFiyati || 0,
          satisParaKodu: o.satisParaKodu || "USD",
          satildi: Boolean(o.satildi),
          yazdirildi: Boolean(o.yazdirildi),
          tarih: o.tarih,
        });
      });
    }

    return list;
  }, [altinUrunler, ozelUrunler, selectedUrunTipi]);

  // Filtreleme
  const filteredProducts = useMemo(() => {
    return unifiedProducts.filter((item) => {
      if (selectedBanko !== "all" && item.banko !== selectedBanko) {
        return false;
      }
      if (selectedDurum === "stok" && item.satildi) return false;
      if (selectedDurum === "satildi" && !item.satildi) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.barkod.toLowerCase().includes(term) ||
        item.grupKodu.toLowerCase().includes(term) ||
        item.model.toLowerCase().includes(term) ||
        item.ureticiFirma.toLowerCase().includes(term) ||
        item.banko.toLowerCase().includes(term) ||
        item.ayar.toLowerCase().includes(term)
      );
    });
  }, [unifiedProducts, selectedBanko, selectedDurum, searchTerm]);

  // İstatistikler
  const stats = useMemo(() => {
    let totalAdet = 0;
    let totalHasGram = 0;
    let totalKarat = 0;
    let totalSatisUsd = 0;

    filteredProducts.forEach((p) => {
      totalAdet += p.miktar || 1;
      totalHasGram += p.hasGram || 0;
      totalKarat += p.karat || 0;
      totalSatisUsd += p.satisFiyati || 0;
    });

    return { totalAdet, totalHasGram, totalKarat, totalSatisUsd };
  }, [filteredProducts]);

  const handlePrint = () => {
    const columns: PrintColumn<UnifiedProduct>[] = [
      { header: "Barkod", key: "barkod" },
      { header: "Tür", key: "tur" },
      { header: "Grup", key: "grupKodu" },
      { header: "Ayar", key: "ayar" },
      { header: "Model / Tanım", key: "model" },
      { header: "Banko", key: "banko" },
      { header: "Adet", render: (item) => String(item.miktar) },
      { header: "Has Gr.", render: (item) => Number(item.hasGram || 0).toFixed(2) },
      { header: "Karat (ct)", render: (item) => Number(item.karat || 0).toFixed(2) },
      { header: "Satış Fiyatı", render: (item) => `${Number(item.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.satisParaKodu}` },
      { header: "Durum", render: (item) => (item.satildi ? "Satıldı" : "Vitrinde") },
    ];

    printReportTable({
      title: `Vitrin & Stok Takip Raporu (${selectedBanko === "all" ? "Tüm Bankolar" : selectedBanko})`,
      subtitle: `Toplam ${filteredProducts.length} ürün listelenmiştir.`,
      columns,
      data: filteredProducts,
    });
  };

  const handleRowAction = (item: UnifiedProduct) => {
    if (item.tur === "ALTIN") {
      navigate(`/etiket/altin-urun-duzeltme?id=${item.id}`);
    } else {
      navigate(`/etiket/ozel-urun-duzeltme?id=${item.id}`);
    }
  };

  return (
    <div className="container-fluid p-2">
      <ERPToolbar
        pageTitle="C- Vitrin Stok Takibi"
        pageIcon={<IconBuildingStore size={20} />}
        onRefresh={loadData}
        onPrint={handlePrint}
        hideNew={true}
        hideSave={true}
        hideDelete={true}
      />

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 mb-2">
          {error}
        </Alert>
      )}

      {/* Özet İstatistik Kartları */}
      <Row className="g-2 mb-2">
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-primary bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Vitrindeki Ürün Sayısı</div>
                <div className="fs-5 fw-bold text-primary">{stats.totalAdet.toLocaleString("tr-TR")} Adet</div>
              </div>
              <div className="p-2 bg-primary text-white rounded-3">
                <IconLayersLinked size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-warning bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Has Altın</div>
                <div className="fs-5 fw-bold text-warning-emphasis">
                  {stats.totalHasGram.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr
                </div>
              </div>
              <div className="p-2 bg-warning text-dark rounded-3">
                <IconCoin size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-info bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Pırlanta Karatı</div>
                <div className="fs-5 fw-bold text-info-emphasis">
                  {stats.totalKarat.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ct
                </div>
              </div>
              <div className="p-2 bg-info text-white rounded-3">
                <IconDiamond size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-success bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Vitrin Satış Değeri</div>
                <div className="fs-5 fw-bold text-success">
                  {stats.totalSatisUsd.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
              <div className="p-2 bg-success text-white rounded-3">
                <IconCurrencyDollar size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtre ve Arama Çubuğu */}
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-center">
            <Col xs={12} sm={6} md={3}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Banko</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedBanko}
                  onChange={(e) => setSelectedBanko(e.target.value)}
                >
                  <option value="all">Tüm Bankolar</option>
                  {bankoOptions.map((bName) => (
                    <option key={bName} value={bName}>
                      {bName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Ürün Türü</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedUrunTipi}
                  onChange={(e) => setSelectedUrunTipi(e.target.value)}
                >
                  <option value="all">Tümü (Altın + Özel)</option>
                  <option value="altin">Yalnız Altın</option>
                  <option value="ozel">Yalnız Pırlanta / Özel</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Stok Durumu</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedDurum}
                  onChange={(e) => setSelectedDurum(e.target.value)}
                >
                  <option value="stok">Vitrinde / Stokta Olanlar</option>
                  <option value="satildi">Satılan Ürünler</option>
                  <option value="all">Tüm Kayıtlar</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={5}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Hızlı Arama</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light">
                    <IconSearch size={16} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Barkod, Model, Ayar, Üretici veya Grup Kodu ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Button variant="outline-secondary" onClick={() => setSearchTerm("")}>
                      Temizle
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Ürün Listesi Tablosu */}
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 350px)", minHeight: "300px" }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: "40px" }} className="text-center">#</th>
                <th style={{ width: "130px" }}>Barkod</th>
                <th>Ürün Türü</th>
                <th>Grup</th>
                <th>Ayar</th>
                <th>Model / Açıklama</th>
                <th>Banko</th>
                <th className="text-center">Adet</th>
                <th className="text-end">Has Gr.</th>
                <th className="text-end">Karat (ct)</th>
                <th className="text-end">Satış Fiyatı</th>
                <th className="text-center">Durum</th>
                <th style={{ width: "80px" }} className="text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="text-center py-5">
                    <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                    Vitrin stokları taranıyor...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-5 text-muted">
                    Seçilen kriterlere uygun ürün bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => (
                  <tr
                    key={`${p.tur}-${p.id}-${idx}`}
                    onDoubleClick={() => handleRowAction(p)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="text-center text-muted small">{idx + 1}</td>
                    <td className="fw-bold font-monospace text-primary">{p.barkod}</td>
                    <td>
                      {p.tur === "ALTIN" ? (
                        <Badge bg="warning" text="dark" className="fw-semibold">
                          <IconCoin size={12} className="me-1" /> Altın
                        </Badge>
                      ) : (
                        <Badge bg="info" className="fw-semibold text-white">
                          <IconDiamond size={12} className="me-1" /> Pırlanta
                        </Badge>
                      )}
                    </td>
                    <td className="fw-semibold">{p.grupKodu}</td>
                    <td>{p.ayar}</td>
                    <td className="text-truncate" style={{ maxWidth: "220px" }} title={p.model}>
                      {p.model}
                    </td>
                    <td>
                      <Badge bg="light" text="dark" className="border">
                        {p.banko}
                      </Badge>
                    </td>
                    <td className="text-center fw-bold">{p.miktar}</td>
                    <td className="text-end fw-semibold text-warning-emphasis">
                      {p.hasGram > 0 ? Number(p.hasGram).toFixed(2) : "-"}
                    </td>
                    <td className="text-end fw-semibold text-info-emphasis">
                      {p.karat > 0 ? Number(p.karat).toFixed(2) : "-"}
                    </td>
                    <td className="text-end fw-bold text-success">
                      {Number(p.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {p.satisParaKodu}
                    </td>
                    <td className="text-center">
                      {p.satildi ? (
                        <Badge bg="danger" className="fw-normal">Satıldı</Badge>
                      ) : (
                        <Badge bg="success" className="fw-normal">Vitrinde</Badge>
                      )}
                    </td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="py-0 px-1.5"
                        title="Düzenle / İncele"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowAction(p);
                        }}
                      >
                        <IconEdit size={14} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
        <Card.Footer className="bg-light py-1.5 px-3 d-flex justify-content-between align-items-center small text-muted">
          <span>Toplam <strong>{filteredProducts.length}</strong> ürün listeleniyor</span>
          <span>Çift tıklayarak ürün kartına gidebilirsiniz</span>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default VitrinStokTakibiPage;
