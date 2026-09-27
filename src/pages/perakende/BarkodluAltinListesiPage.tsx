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
  IconBarcode,
  IconCoin,
  IconEdit,
  IconCheck,
  IconX,
  IconLayersLinked,
  IconScale,
  IconCash,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EtiketService, AltinUrunItem } from "../../services/etiketService";
import { printReportTable, PrintColumn } from "../../utils/printReport";

export const BarkodluAltinListesiPage: React.FC = () => {
  const navigate = useNavigate();

  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtreler
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedAyar, setSelectedAyar] = useState<string>("all");
  const [selectedDurum, setSelectedDurum] = useState<string>("all");
  const [selectedGrup, setSelectedGrup] = useState<string>("all");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await EtiketService.getAltinUrunler();
      setAltinList(list || []);
    } catch (err: any) {
      setError(err.message || "Barkodlu altın listesi alınırken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Gruplar listesi
  const uniqueGruplar = useMemo(() => {
    const set = new Set<string>();
    altinList.forEach((a) => {
      if (a.grupKodu) set.add(a.grupKodu);
    });
    return Array.from(set).sort();
  }, [altinList]);

  // Ayarlar listesi
  const uniqueAyarlar = useMemo(() => {
    const set = new Set<string>();
    altinList.forEach((a) => {
      if (a.ayar) set.add(a.ayar);
    });
    return Array.from(set).sort();
  }, [altinList]);

  // Filtreleme
  const filteredList = useMemo(() => {
    return altinList.filter((item) => {
      if (selectedAyar !== "all" && item.ayar !== selectedAyar) return false;
      if (selectedGrup !== "all" && item.grupKodu !== selectedGrup) return false;
      if (selectedDurum === "stok" && item.satildi) return false;
      if (selectedDurum === "satildi" && !item.satildi) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.barkod && item.barkod.toLowerCase().includes(term)) ||
        (item.orjinalKod && item.orjinalKod.toLowerCase().includes(term)) ||
        (item.grupKodu && item.grupKodu.toLowerCase().includes(term)) ||
        (item.model && item.model.toLowerCase().includes(term)) ||
        (item.ureticiFirma && item.ureticiFirma.toLowerCase().includes(term)) ||
        (item.banko && item.banko.toLowerCase().includes(term)) ||
        String(item.urunNo).includes(term)
      );
    });
  }, [altinList, selectedAyar, selectedGrup, selectedDurum, searchTerm]);

  // Özet İstatistikler
  const summary = useMemo(() => {
    let totalAdet = 0;
    let totalHasGram = 0;
    let totalMaliyet = 0;
    let totalSatis = 0;

    filteredList.forEach((item) => {
      totalAdet += item.miktar || 1;
      totalHasGram += item.hasGram || 0;
      totalMaliyet += item.maliyet || 0;
      totalSatis += item.satisFiyati || 0;
    });

    return { totalAdet, totalHasGram, totalMaliyet, totalSatis };
  }, [filteredList]);

  const handlePrint = () => {
    const columns: PrintColumn<AltinUrunItem>[] = [
      { header: "Barkod", key: "barkod" },
      { header: "Tarih", render: (item) => (item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-") },
      { header: "Grup", key: "grupKodu" },
      { header: "Ürün No", key: "urunNo" },
      { header: "Ayar", key: "ayar" },
      { header: "Model / Açıklama", key: "model" },
      { header: "Üretici", key: "ureticiFirma" },
      { header: "Banko", key: "banko" },
      { header: "Adet", render: (item) => String(item.miktar || 1) },
      { header: "Has Gr.", render: (item) => Number(item.hasGram || 0).toFixed(2) },
      { header: "Maliyet", render: (item) => `${Number(item.maliyet || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.maliyetParaKodu || "USD"}` },
      { header: "Satış Fiyatı", render: (item) => `${Number(item.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.satisParaKodu || "USD"}` },
      { header: "Durum", render: (item) => (item.satildi ? "Satıldı" : "Stokta") },
    ];

    printReportTable({
      title: "Barkodlu Altın Ürün Listesi",
      subtitle: `Toplam ${filteredList.length} kayıt listelenmiştir.`,
      columns,
      data: filteredList,
    });
  };

  const handleNew = () => {
    navigate("/etiket/altin-urun-barkodlama");
  };

  const handleEdit = (item: AltinUrunItem) => {
    navigate(`/etiket/altin-urun-duzeltme?id=${item.altinUrunId}`);
  };

  return (
    <div className="container-fluid p-2">
      <ERPToolbar
        pageTitle="D- Barkodlu Altın Listesi"
        pageIcon={<IconCoin size={20} />}
        onNew={handleNew}
        onRefresh={loadData}
        onPrint={handlePrint}
        hideSave={true}
        hideDelete={true}
      />

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 mb-2">
          {error}
        </Alert>
      )}

      {/* İstatistik Kartları */}
      <Row className="g-2 mb-2">
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-primary bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Ürün Adedi</div>
                <div className="fs-5 fw-bold text-primary">{summary.totalAdet.toLocaleString("tr-TR")} Adet</div>
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
                  {summary.totalHasGram.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr
                </div>
              </div>
              <div className="p-2 bg-warning text-dark rounded-3">
                <IconScale size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-secondary bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Maliyet</div>
                <div className="fs-5 fw-bold text-dark">
                  {summary.totalMaliyet.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
              <div className="p-2 bg-secondary text-white rounded-3">
                <IconCash size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-success bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Satış Değeri</div>
                <div className="fs-5 fw-bold text-success">
                  {summary.totalSatis.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
              <div className="p-2 bg-success text-white rounded-3">
                <IconCoin size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtre ve Arama Alanı */}
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-center">
            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Grup Kodu</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedGrup}
                  onChange={(e) => setSelectedGrup(e.target.value)}
                >
                  <option value="all">Tüm Gruplar</option>
                  {uniqueGruplar.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Ayar</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedAyar}
                  onChange={(e) => setSelectedAyar(e.target.value)}
                >
                  <option value="all">Tüm Ayarlar</option>
                  {uniqueAyarlar.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Durum</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedDurum}
                  onChange={(e) => setSelectedDurum(e.target.value)}
                >
                  <option value="all">Tüm Kayıtlar</option>
                  <option value="stok">Yalnız Stokta Olanlar</option>
                  <option value="satildi">Satılanlar</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={6}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Hızlı Arama</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light">
                    <IconSearch size={16} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Barkod, Ürün No, Model, Orjinal Kod, Üretici veya Banko ara..."
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

      {/* Tablo */}
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 350px)", minHeight: "300px" }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: "40px" }} className="text-center">#</th>
                <th style={{ width: "130px" }}>Barkod</th>
                <th>Tarih</th>
                <th>Grup</th>
                <th>Ürün No</th>
                <th>Ayar</th>
                <th>Model / Tanım</th>
                <th>Üretici Firma</th>
                <th>Banko</th>
                <th className="text-center">Adet</th>
                <th className="text-end">Has Gr.</th>
                <th className="text-end">Maliyet</th>
                <th className="text-end">Satış Fiyatı</th>
                <th className="text-center">Yazdırıldı</th>
                <th className="text-center">Durum</th>
                <th style={{ width: "80px" }} className="text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={16} className="text-center py-5">
                    <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                    Barkodlu altın listesi yükleniyor...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-5 text-muted">
                    Seçilen kriterlere uygun altın ürün kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr
                    key={item.altinUrunId || idx}
                    onDoubleClick={() => handleEdit(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="text-center text-muted small">{idx + 1}</td>
                    <td className="fw-bold font-monospace text-primary">
                      {item.barkod || `#${item.urunNo}`}
                    </td>
                    <td className="small text-muted">
                      {item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-"}
                    </td>
                    <td className="fw-semibold">{item.grupKodu}</td>
                    <td className="font-monospace text-center">{item.urunNo}</td>
                    <td>
                      <Badge bg="warning" text="dark" className="border">
                        {item.ayar || "-"}
                      </Badge>
                    </td>
                    <td className="text-truncate" style={{ maxWidth: "200px" }} title={item.model || ""}>
                      {item.model || "-"}
                    </td>
                    <td className="small">{item.ureticiFirma || "-"}</td>
                    <td>
                      <Badge bg="light" text="dark" className="border">
                        {item.banko || "-"}
                      </Badge>
                    </td>
                    <td className="text-center fw-bold">{item.miktar || 1}</td>
                    <td className="text-end fw-semibold text-warning-emphasis">
                      {Number(item.hasGram || 0).toFixed(2)}
                    </td>
                    <td className="text-end small">
                      {Number(item.maliyet || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {item.maliyetParaKodu || "USD"}
                    </td>
                    <td className="text-end fw-bold text-success">
                      {Number(item.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {item.satisParaKodu || "USD"}
                    </td>
                    <td className="text-center">
                      {item.yazdirildi ? (
                        <Badge bg="success" className="p-1"><IconCheck size={14} /></Badge>
                      ) : (
                        <Badge bg="secondary" className="p-1"><IconX size={14} /></Badge>
                      )}
                    </td>
                    <td className="text-center">
                      {item.satildi ? (
                        <Badge bg="danger">Satıldı</Badge>
                      ) : (
                        <Badge bg="success">Stokta</Badge>
                      )}
                    </td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="py-0 px-1.5"
                        title="Düzelt / İncele"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(item);
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
          <span>Toplam <strong>{filteredList.length}</strong> altın ürün listeleniyor</span>
          <span>Çift tıklayarak altın ürün düzeltme ekranına gidebilirsiniz</span>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default BarkodluAltinListesiPage;
