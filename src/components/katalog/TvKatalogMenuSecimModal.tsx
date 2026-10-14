import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Button, Form, InputGroup, Badge, Spinner } from "react-bootstrap";
import {
  IconDeviceTv,
  IconSearch,
  IconExternalLink,
  IconDiamond,
  IconCoins,
  IconSparkles,
  IconListDetails,
  IconX,
} from "@tabler/icons-react";
import { MenuItem, MenuService, KatalogUrun } from "../../services/menuService";

interface TvKatalogMenuSecimModalProps {
  show: boolean;
  onClose: () => void;
}

export const TvKatalogMenuSecimModal: React.FC<TvKatalogMenuSecimModalProps> = ({
  show,
  onClose,
}) => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [products, setProducts] = useState<KatalogUrun[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "altin" | "ozel">("all");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [menuList, productList] = await Promise.all([
        MenuService.getMenus(),
        MenuService.getKatalogUrunleri().catch(() => [] as KatalogUrun[]),
      ]);
      setMenus(menuList);
      setProducts(productList);
    } catch (err) {
      console.error("Menüler ve ürünler yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      setSearch("");
      setFilterType("all");
      loadData();
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 80);
    }
  }, [show]);

  // Her menü için ürün sayılarını hesapla
  const menuStats = useMemo(() => {
    const stats: Record<number, { altin: number; ozel: number; toplam: number }> = {};
    menus.forEach((m) => {
      stats[m.menuId] = { altin: 0, ozel: 0, toplam: 0 };
    });

    products.forEach((p) => {
      if (p.menuId && stats[p.menuId]) {
        if (p.urunTipi === "altin") {
          stats[p.menuId].altin += 1;
        } else if (p.urunTipi === "ozel") {
          stats[p.menuId].ozel += 1;
        }
        stats[p.menuId].toplam += 1;
      }
    });

    return stats;
  }, [menus, products]);

  // Genel toplamlar
  const genelStats = useMemo(() => {
    let altin = 0;
    let ozel = 0;
    products.forEach((p) => {
      if (p.urunTipi === "altin") altin += 1;
      else if (p.urunTipi === "ozel") ozel += 1;
    });
    return { altin, ozel, toplam: products.length };
  }, [products]);

  // Filtreleme mantığı
  const filteredMenus = useMemo(() => {
    return menus.filter((m) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        m.menuAdi.toLowerCase().includes(q) ||
        (m.aciklama && m.aciklama.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const stat = menuStats[m.menuId] || { altin: 0, ozel: 0, toplam: 0 };
      if (filterType === "altin") {
        return stat.altin > 0;
      }
      if (filterType === "ozel") {
        return stat.ozel > 0;
      }
      return true;
    });
  }, [menus, search, filterType, menuStats]);

  const handleOpenKatalog = (menuId?: number | null) => {
    const url = menuId ? `/tv-katalog?menuId=${menuId}` : `/tv-katalog`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered backdrop="static" className="tv-menu-modal">
      <Modal.Header closeButton className="bg-light py-2.5 px-3 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center justify-content-center rounded-2 bg-primary text-white shadow-xs"
            style={{ width: "32px", height: "32px" }}
          >
            <IconDeviceTv size={20} strokeWidth={2} />
          </div>
          <div>
            <Modal.Title className="fs-6 fw-bold mb-0 text-dark">
              Katalog & TV Menüsü Aç
            </Modal.Title>
            <small className="text-muted" style={{ fontSize: "12px" }}>
              Yeni sekmede açmak istediğiniz menüyü seçiniz (Altın & Özel Ürünler)
            </small>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3">
        <style>{`
          .tv-menu-item-card {
            transition: all 0.15s ease-in-out;
            cursor: pointer;
            border: 1px solid #e2e8f0;
          }
          .tv-menu-item-card:hover {
            transform: translateY(-1px);
            border-color: #3b82f6 !important;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.12) !important;
            background-color: #f8fafc !important;
          }
          .tv-menu-item-card:hover .action-open-icon {
            transform: scale(1.15);
            color: #2563eb !important;
          }
          .action-open-icon {
            transition: transform 0.15s ease;
          }
        `}</style>

        {/* Arama ve Filtre Butonları */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <InputGroup style={{ maxWidth: "320px", flex: 1 }} size="sm">
            <InputGroup.Text className="bg-white border-end-0">
              <IconSearch size={15} className="text-secondary" />
            </InputGroup.Text>
            <Form.Control
              ref={searchInputRef}
              type="text"
              placeholder="Menü adı veya açıklama ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-start-0 ps-0 shadow-none"
            />
            {search && (
              <Button
                variant="light"
                size="sm"
                className="border border-start-0"
                onClick={() => setSearch("")}
              >
                <IconX size={14} />
              </Button>
            )}
          </InputGroup>

          {/* Kategori Filtre Butonları */}
          <div className="d-inline-flex align-items-center gap-1 bg-light p-1 rounded-2 border">
            <button
              type="button"
              className={`btn btn-xs px-2.5 py-1 rounded-1 fw-semibold ${
                filterType === "all" ? "btn-primary shadow-xs" : "btn-light text-secondary"
              }`}
              style={{ fontSize: "11.5px" }}
              onClick={() => setFilterType("all")}
            >
              Tüm Menüler ({menus.length})
            </button>
            <button
              type="button"
              className={`btn btn-xs px-2.5 py-1 rounded-1 fw-semibold d-inline-flex align-items-center gap-1 ${
                filterType === "altin" ? "btn-warning text-dark shadow-xs" : "btn-light text-secondary"
              }`}
              style={{ fontSize: "11.5px" }}
              onClick={() => setFilterType("altin")}
            >
              <IconCoins size={13} style={{ color: "#d97706" }} />
              <span>Altın Ürünlü</span>
            </button>
            <button
              type="button"
              className={`btn btn-xs px-2.5 py-1 rounded-1 fw-semibold d-inline-flex align-items-center gap-1 ${
                filterType === "ozel" ? "btn-info text-white shadow-xs" : "btn-light text-secondary"
              }`}
              style={{ fontSize: "11.5px" }}
              onClick={() => setFilterType("ozel")}
            >
              <IconDiamond size={13} />
              <span>Özel Ürünlü</span>
            </button>
          </div>
        </div>

        {/* Yükleniyor Göstergesi */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" size="sm" className="me-2" />
            <span className="text-muted small">Menüler ve ürün sayıları yükleniyor...</span>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2" style={{ maxHeight: "420px", overflowY: "auto" }}>
            {/* 1. ÖNE ÇIKAN SEÇENEK: TÜM KATALOG (GENEL TV SUNUMU) */}
            {(!search.trim() || "tüm ürünler genel katalog".includes(search.trim().toLowerCase())) && filterType === "all" && (
              <div
                className="tv-menu-item-card p-2.5 rounded-3 bg-white shadow-xs d-flex align-items-center justify-content-between"
                onClick={() => handleOpenKatalog(null)}
                title="Tüm kayıtlı katalog ürünlerini sırayla sunan genel TV ekranını yeni sekmede aç"
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                      color: "#ffffff",
                    }}
                  >
                    <IconSparkles size={22} />
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-0.5">
                      <span className="fw-bold text-dark fs-6">🌟 Genel Katalog (Tüm Ürünler)</span>
                      <Badge bg="primary-subtle" className="text-primary border border-primary-subtle fw-semibold" style={{ fontSize: "10.5px" }}>
                        Tüm Menüler Bir Arada
                      </Badge>
                    </div>
                    <div className="text-muted small d-flex align-items-center gap-2" style={{ fontSize: "11.5px" }}>
                      <span>Tüm altın ve özel ürünleri kesintisiz TV sunumu olarak gösterir</span>
                      <span className="text-muted">•</span>
                      <span className="text-dark fw-medium">{genelStats.toplam} Ürün Kayıtlı</span>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                  <div className="d-none d-sm-flex align-items-center gap-1.5 me-2">
                    <span className="badge bg-warning-subtle text-dark border border-warning-subtle px-2 py-1" style={{ fontSize: "11px" }}>
                      🟡 {genelStats.altin} Altın
                    </span>
                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1" style={{ fontSize: "11px" }}>
                      💎 {genelStats.ozel} Özel
                    </span>
                  </div>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    className="d-inline-flex align-items-center gap-1 px-2.5 py-1 fw-semibold shadow-xs"
                    style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                  >
                    <span>Yeni Sekmede Aç</span>
                    <IconExternalLink size={14} className="action-open-icon" />
                  </Button>
                </div>
              </div>
            )}

            {/* 2. MENÜ LİSTESİ */}
            {filteredMenus.length > 0 ? (
              filteredMenus.map((m) => {
                const stat = menuStats[m.menuId] || { altin: 0, ozel: 0, toplam: 0 };
                return (
                  <div
                    key={m.menuId}
                    className="tv-menu-item-card p-2.5 rounded-3 bg-white shadow-xs d-flex align-items-center justify-content-between"
                    onClick={() => handleOpenKatalog(m.menuId)}
                    title={`"${m.menuAdi}" menüsünün TV Katalog ekranını yeni sekmede aç`}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: "40px",
                          height: "40px",
                          backgroundColor: "#f0f9ff",
                          color: "#0284c7",
                          border: "1px solid #bae6fd",
                        }}
                      >
                        <IconListDetails size={20} />
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-0.5">
                          <span className="fw-bold text-dark fs-6">{m.menuAdi}</span>
                          {!m.aktif && (
                            <Badge bg="secondary" style={{ fontSize: "10px" }}>
                              Pasif
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted small" style={{ fontSize: "11.5px" }}>
                          {m.aciklama || "Açıklama belirtilmemiş"}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                      <div className="d-none d-sm-flex align-items-center gap-1.5 me-2">
                        {stat.altin > 0 && (
                          <span
                            className="badge bg-warning-subtle text-dark border border-warning-subtle px-2 py-1"
                            style={{ fontSize: "11px" }}
                            title={`${stat.altin} Adet Altın Ürün`}
                          >
                            🟡 {stat.altin} Altın
                          </span>
                        )}
                        {stat.ozel > 0 && (
                          <span
                            className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1"
                            style={{ fontSize: "11px" }}
                            title={`${stat.ozel} Adet Özel Ürün`}
                          >
                            💎 {stat.ozel} Özel
                          </span>
                        )}
                        {stat.toplam === 0 && (
                          <span className="badge bg-light text-muted border px-2 py-1" style={{ fontSize: "11px" }}>
                            0 Ürün
                          </span>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className="d-inline-flex align-items-center gap-1 px-2.5 py-1 fw-semibold shadow-xs"
                        style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                      >
                        <span>Menüyü Aç</span>
                        <IconExternalLink size={14} className="action-open-icon" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 bg-light rounded-3 border">
                <IconListDetails size={32} className="text-secondary opacity-50 mb-2" />
                <div className="text-secondary fw-semibold">Arama kriterlerine uygun menü bulunamadı.</div>
                <small className="text-muted">Arama filtrenizi temizleyerek tekrar deneyebilirsiniz.</small>
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-between">
        <small className="text-muted" style={{ fontSize: "11.5px" }}>
          💡 Menüye tıkladığınızda tam ekran TV sunumu yeni bir sekmede hemen başlar.
        </small>
        <Button variant="secondary" size="sm" onClick={onClose} className="px-3">
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
