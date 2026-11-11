import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Modal, Button, Table, Badge, InputGroup, Form } from "react-bootstrap";
import {
  IconSearch,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconUserCheck,
} from "@tabler/icons-react";
import { CariKartItem } from "../../services/cariService";

interface CariRowProps {
  cari: CariKartItem;
  isSelected: boolean;
  onToggle: (id: number) => void;
}

const CariRow = React.memo<CariRowProps>(({ cari, isSelected, onToggle }) => {
  const cId = Number(cari.id);
  return (
    <tr
      className={isSelected ? "table-primary" : ""}
      style={{ cursor: "pointer", userSelect: "none" }}
      onClick={() => onToggle(cId)}
    >
      <td
        className="text-center"
        style={{ width: "45px" }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(cId);
        }}
      >
        <input
          type="checkbox"
          className="form-check-input m-0"
          checked={isSelected}
          onChange={() => onToggle(cId)}
          style={{ cursor: "pointer" }}
        />
      </td>
      <td className="font-monospace fw-bold small text-primary" style={{ width: "140px" }}>
        {cari.kod}
      </td>
      <td className="fw-semibold text-dark">{cari.ad}</td>
      <td className="small text-muted" style={{ width: "160px" }}>
        {cari.yetkiliKisi || "-"}
      </td>
    </tr>
  );
});
CariRow.displayName = "CariRow";

export interface CariKartAtamaModalProps {
  show: boolean;
  onHide: () => void;
  userTitle: string;
  cariSinirlamaTipi?: number;
  initialSelectedIds: number[];
  cariListesi: CariKartItem[];
  isLoading: boolean;
  onApply: (selectedIds: number[]) => void;
}

export const CariKartAtamaModal: React.FC<CariKartAtamaModalProps> = ({
  show,
  onHide,
  userTitle,
  cariSinirlamaTipi = 0,
  initialSelectedIds,
  cariListesi,
  isLoading,
  onApply,
}) => {
  const [selectedSet, setSelectedSet] = useState<Set<number>>(() => new Set());
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (show) {
      setSelectedSet(new Set((initialSelectedIds || []).map(Number)));
      setSearchText("");
    }
  }, [show, initialSelectedIds]);

  const filteredList = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");
    if (!q) return cariListesi;
    return cariListesi.filter((c) => {
      const kod = (c.kod || "").toLocaleLowerCase("tr-TR");
      const ad = (c.ad || "").toLocaleLowerCase("tr-TR");
      const yetkili = (c.yetkiliKisi || "").toLocaleLowerCase("tr-TR");
      return kod.includes(q) || ad.includes(q) || yetkili.includes(q);
    });
  }, [cariListesi, searchText]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredList.length === 0) return false;
    return filteredList.every((c) => selectedSet.has(Number(c.id)));
  }, [filteredList, selectedSet]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredList.length === 0) return false;
    return filteredList.some((c) => selectedSet.has(Number(c.id)));
  }, [filteredList, selectedSet]);

  const handleToggle = useCallback((id: number) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAllFiltered = useCallback(() => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        for (const c of filteredList) {
          next.delete(Number(c.id));
        }
      } else {
        for (const c of filteredList) {
          next.add(Number(c.id));
        }
      }
      return next;
    });
  }, [filteredList, isAllFilteredSelected]);

  const handleSelectAll = useCallback(() => {
    if (searchText.trim()) {
      handleToggleAllFiltered();
    } else {
      setSelectedSet(new Set(cariListesi.map((c) => Number(c.id))));
    }
  }, [searchText, handleToggleAllFiltered, cariListesi]);

  const handleClearSelection = useCallback(() => {
    if (searchText.trim()) {
      setSelectedSet((prev) => {
        const next = new Set(prev);
        for (const c of filteredList) {
          next.delete(Number(c.id));
        }
        return next;
      });
    } else {
      setSelectedSet(new Set());
    }
  }, [searchText, filteredList]);

  const handleApply = () => {
    onApply(Array.from(selectedSet));
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="bg-light py-2">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
          <IconUserCheck size={20} className="text-primary" />
          <span>Kullanıcı Cari Kart Atama</span>
          <Badge bg="primary" className="ms-1 fw-normal">
            {userTitle}
          </Badge>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div className="alert alert-info py-2 px-3 small mb-3 d-flex align-items-center gap-2">
          <IconAlertCircle size={18} className="flex-shrink-0" />
          <div>
            <strong>Cari Sınırlama Modu: </strong>
            {cariSinirlamaTipi === 1 ? (
              <span>
                <strong className="text-success">İzin Verilen Cariler</strong> — Kullanıcı yalnızca aşağıda seçilen cari kartları görebilir.
              </span>
            ) : cariSinirlamaTipi === 2 ? (
              <span>
                <strong className="text-danger">Yasaklanan Cariler</strong> — Kullanıcı aşağıda seçilen cari kartlar <u>dışındaki</u> tüm carileri görebilir (seçilenler gizlenir).
              </span>
            ) : (
              <span>Sınırlama yok (seçilen cariler genel sekmesinden mod açıldığında geçerli olur).</span>
            )}
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: "220px" }}>
            <InputGroup size="sm">
              <InputGroup.Text className="bg-white">
                <IconSearch size={14} className="text-muted" />
              </InputGroup.Text>
              <Form.Control
                placeholder="Cari kodu veya adı ile filtrele..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                autoFocus
              />
              {searchText && (
                <Button variant="outline-secondary" size="sm" onClick={() => setSearchText("")}>
                  <IconX size={14} />
                </Button>
              )}
            </InputGroup>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Button
              variant={isAllFilteredSelected ? "outline-danger" : "outline-primary"}
              size="sm"
              className="py-1 px-2.5 fw-semibold d-flex align-items-center gap-1"
              style={{ fontSize: "12px" }}
              onClick={handleSelectAll}
              title={
                isAllFilteredSelected
                  ? "Filtrelenenlerin tümünün seçimini kaldır"
                  : searchText.trim()
                  ? "Filtrelenen carilerin tümünü seç"
                  : "Tüm carileri seç"
              }
            >
              <IconCheck size={14} />
              <span>{isAllFilteredSelected ? "Tümünü Kaldır" : "Tümünü Seç"}</span>
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              className="py-1 px-2"
              style={{ fontSize: "12px" }}
              onClick={handleClearSelection}
            >
              Seçimi Temizle
            </Button>
            <Badge bg="light" className="text-dark border py-2 px-2 small">
              Seçili: <strong>{selectedSet.size}</strong> / {cariListesi.length}
              {searchText.trim() && (
                <span className="text-muted ms-1">({filteredList.length} filtrelendi)</span>
              )}
            </Badge>
          </div>
        </div>

        <div
          className="border rounded table-responsive bg-white"
          style={{ maxHeight: "380px", overflowY: "auto" }}
        >
          {isLoading ? (
            <div className="text-center py-5 text-muted small">
              Cari kartlar yükleniyor, lütfen bekleyiniz...
            </div>
          ) : cariListesi.length === 0 ? (
            <div className="text-center py-5 text-muted small">Kayıtlı cari kart bulunamadı.</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-5 text-muted small">Aramaya uygun cari kart bulunamadı.</div>
          ) : (
            <Table hover size="sm" className="mb-0 align-middle">
              <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                <tr>
                  <th style={{ width: "45px" }} className="text-center align-middle">
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={isAllFilteredSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = !isAllFilteredSelected && isSomeFilteredSelected;
                        }
                      }}
                      onChange={handleToggleAllFiltered}
                      title={isAllFilteredSelected ? "Tümünün Seçimini Kaldır" : "Tümünü Seç"}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th style={{ width: "140px" }}>Cari Kodu</th>
                  <th>Cari Ünvanı / Adı</th>
                  <th style={{ width: "160px" }}>Yetkili / Şehir</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((cari) => (
                  <CariRow
                    key={cari.id}
                    cari={cari}
                    isSelected={selectedSet.has(Number(cari.id))}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
        <span className="small text-muted">
          <strong>{selectedSet.size}</strong> cari kart atanmak üzere belirlendi.
        </span>
        <div className="d-flex gap-2">
          <Button variant="secondary" size="sm" onClick={onHide}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply}>
            Uygula & Tamam
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};
export default CariKartAtamaModal;

