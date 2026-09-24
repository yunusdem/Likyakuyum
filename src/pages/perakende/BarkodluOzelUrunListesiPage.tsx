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
  IconDiamond,
  IconEdit,
  IconCheck,
  IconX,
  IconLayersLinked,
  IconScale,
  IconCash,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EtiketService, OzelUrunItem } from "../../services/etiketService";
import { printReportTable, PrintColumn } from "../../utils/printReport";

export const BarkodluOzelUrunListesiPage: React.FC = () => {
  const navigate = useNavigate();

  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
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
      const list = await EtiketService.getOzelUrunler();
      setOzelList(list || []);
    } catch (err: any) {
      setError(err.message || "Barkodlu özel ürün listesi alınırken bir hata oluştu.");
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
    ozelList.forEach((a) => {
      if (a.grupKodu) set.add(a.grupKodu);
    });
    return Array.from(set).sort();
  }, [ozelList]);

  // Ayarlar listesi
  const uniqueAyarlar = useMemo(() => {
    const set = new Set<string>();
    ozelList.forEach((a) => {
      if (a.ayar) set.add(a.ayar);
    });
    return Array.from(set).sort();
  }, [ozelList]);

  // Filtreleme
  const filteredList = useMemo(() => {
    return ozelList.filter((item) => {
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
        (item.modelOzellik1 && item.modelOzellik1.toLowerCase().includes(term)) ||
        (item.modelOzellik2 && item.modelOzellik2.toLowerCase().includes(term)) ||
        (item.ureticiFirma && item.ureticiFirma.toLowerCase().includes(term)) ||
        (item.banko && item.banko.toLowerCase().includes(term)) ||
        (item.tasCinsi && item.tasCinsi.toLowerCase().includes(term)) ||
        (item.tasRenk && item.tasRenk.toLowerCase().includes(term)) ||
        (item.tasSaflik && item.tasSaflik.toLowerCase().includes(term)) ||
        String(item.urunNo).includes(term)
      );
    });
  }, [ozelList, selectedAyar, selectedGrup, selectedDurum, searchTerm]);

  // Özet İstatistikler
  const summary = useMemo(() => {
    let totalAdet = 0;
    let totalGram = 0;
    let totalKarat = 0;
    let totalMaliyet = 0;
    let totalSatis = 0;

    filteredList.forEach((item) => {
      totalAdet += 1;
      totalGram += Number(item.miktar || 0);
      totalKarat += Number(item.tasMiktar || 0);
      totalMaliyet += item.maliyet || 0;
      totalSatis += item.satisFiyati || 0;
    });

    return { totalAdet, totalGram, totalKarat, totalMaliyet, totalSatis };
  }, [filteredList]);

  const handlePrint = () => {
    const columns: PrintColumn<OzelUrunItem>[] = [
      { header: "Barkod", key: "barkod" },
      { header: "Tarih", render: (item) => (item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-") },
      { header: "Grup", key: "grupKodu" },
      { header: "Ürün No", key: "urunNo" },
      { header: "Ayar", key: "ayar" },
      { header: "Model / Tanım", render: (item) => item.modelOzellik1 || item.tasCinsi || "-" },
      { header: "Taş Detayı", render: (item) => `${item.tasCinsi || "Taş"} ${item.tasMiktar || 0}ct ${item.tasRenk || ""} ${item.tasSaflik || ""}`.trim() },
      { header: "Karat (ct)", render: (item) => Number(item.tasMiktar || 0).toFixed(2) },
      { header: "Gr.", render: (item) => Number(item.miktar || 0).toFixed(2) },
      { header: "Satış Fiyatı", render: (item) => `${Number(item.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.satisParaKodu || "USD"}` },
      { header: "Durum", render: (item) => (item.satildi ? "Satıldı" : "Stokta") },
    ];

    printReportTable({
      title: "Barkodlu Özel / Pırlanta Ürün Listesi",
      subtitle: `Toplam ${filteredList.length} kayıt listelenmiştir.`,
      columns,
      data: filteredList,
    });
  };

  const handleNew = () => {
    navigate("/etiket/ozel-urun-barkodlama");
  };

  const handleEdit = (item: OzelUrunItem) => {
    navigate(`/etiket/ozel-urun-duzeltme?id=${item.ozelUrunId}`);
  };

  return (
    <div className="container-fluid p-2">
      <ERPToolbar
        pageTitle="E- Barkodlu Özel Ürün Listesi"
        pageIcon={<IconDiamond size={20} />}
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
                <div className="text-muted small fw-semibold">Toplam Özel Ürün</div>
                <div className="fs-5 fw-bold text-primary">{summary.totalAdet.toLocaleString("tr-TR")} Adet</div>
              </div>
              <div className="p-2 bg-primary text-white rounded-3">
                <IconLayersLinked size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-info bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Karat (ct)</div>
                <div className="fs-5 fw-bold text-info-emphasis">
                  {summary.totalKarat.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ct
                </div>
              </div>
              <div className="p-2 bg-info text-white rounded-3">
                <IconDiamond size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-secondary bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Brüt Gram</div>
                <div className="fs-5 fw-bold text-dark">
                  {summary.totalGram.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr
                </div>
              </div>
              <div className="p-2 bg-secondary text-white rounded-3">
                <IconScale size={22} />
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
                <IconCash size={22} />
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
                    placeholder="Barkod, Taş (Pırlanta, F VS1), Model, Orjinal Kod ara..."
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
                <th>Taş Özeti</th>
                <th className="text-end">Karat (ct)</th>
                <th className="text-end">Brüt Gr.</th>
                <th className="text-end">Satış Fiyatı</th>
                <th className="text-center">Yazdırıldı</th>
                <th className="text-center">Durum</th>
                <th style={{ width: "80px" }} className="text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="text-center py-5">
                    <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                    Barkodlu özel ürün listesi yükleniyor...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-5 text-muted">
                    Seçilen kriterlere uygun özel ürün kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const stoneSummary = `${item.tasCinsi || "Pırlanta"} ${item.tasMiktar || 0}ct ${item.tasRenk || ""} ${item.tasSaflik || ""}`.trim();

                  return (
                    <tr
                      key={item.ozelUrunId || idx}
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
                        <Badge bg="info" className="border text-white">
                          {item.ayar || "-"}
                        </Badge>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: "180px" }} title={item.modelOzellik1 || ""}>
                        {item.modelOzellik1 || "-"}
                      </td>
                      <td className="small text-truncate" style={{ maxWidth: "240px" }} title={stoneSummary || "-"}>
                        {stoneSummary || "-"}
                      </td>
                      <td className="text-end fw-bold text-info-emphasis">
                        {Number(item.tasMiktar || 0).toFixed(2)}
                      </td>
                      <td className="text-end fw-semibold">
                        {Number(item.miktar || 0).toFixed(2)}
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
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
        <Card.Footer className="bg-light py-1.5 px-3 d-flex justify-content-between align-items-center small text-muted">
          <span>Toplam <strong>{filteredList.length}</strong> özel ürün listeleniyor</span>
          <span>Çift tıklayarak özel ürün düzeltme ekranına gidebilirsiniz</span>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default BarkodluOzelUrunListesiPage;
