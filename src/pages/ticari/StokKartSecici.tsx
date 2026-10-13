import React, { useCallback } from "react";
import { Badge } from "react-bootstrap";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";
import { StokKart, miktarYaz, para } from "../../services/ticariService";

interface Props {
  show: boolean;
  kartlar: StokKart[];
  yukleniyor?: boolean;
  aramaMetni?: string;
  /** Satış fişinde pasif kart seçilemez */
  pasifSecilemez?: boolean;
  onHide: () => void;
  onSelect: (k: StokKart) => void;
  /** "Yeni ürün" düğmesi (yalnız stok yönetim yetkisi olanda) */
  onYeni?: () => void;
}

const kolonlar: LookupColumn<StokKart>[] = [
  { header: "Kod", width: "110px", render: (k) => <span className="font-monospace fw-bold">{k.kod}</span>, highlight: true },
  { header: "Ürün Adı", render: (k) => <span className="fw-semibold">{k.ad}</span>, highlight: true },
  { header: "Barkod", width: "140px", render: (k) => <span className="font-monospace small">{k.barkodlar[0] || ""}{k.barkodlar.length > 1 ? ` +${k.barkodlar.length - 1}` : ""}</span> },
  { header: "Grup", width: "120px", render: (k) => <span className="small">{k.grupAdi || ""}</span> },
  { header: "Fiyat", width: "120px", align: "right", render: (k) => (k.satisFiyati !== null ? `${para(k.satisFiyati)} ${k.paraKodu || "TL"}` : "") },
  { header: "Stok", width: "100px", align: "right", render: (k) => <span className={k.bakiye < 0 ? "text-danger fw-bold" : "fw-bold"}>{miktarYaz(k.bakiye)} {k.birim}</span> },
  { header: "", width: "60px", align: "center", render: (k) => (k.aktif ? null : <Badge bg="secondary">Pasif</Badge>) },
];

/** Stok kartı seçme penceresi (F4 / dürbün): kod, ad ya da barkodla arar */
export const StokKartSecici: React.FC<Props> = ({ show, kartlar, yukleniyor, aramaMetni, pasifSecilemez, onHide, onSelect, onYeni }) => {
  const suz = useCallback((k: StokKart, t: string) => {
    const a = t.toLocaleLowerCase("tr-TR");
    return k.kod.toLocaleLowerCase("tr-TR").includes(a) || k.ad.toLocaleLowerCase("tr-TR").includes(a) || k.barkodlar.some((b) => b.includes(t)) || (k.grupAdi || "").toLocaleLowerCase("tr-TR").includes(a);
  }, []);
  return (
    <LookupModal<StokKart>
      show={show}
      onHide={onHide}
      title="Stok Kartı Seç"
      items={kartlar}
      isLoading={yukleniyor}
      initialSearchTerm={aramaMetni || ""}
      searchPlaceholder="Kod, ürün adı ya da barkod..."
      columns={kolonlar}
      filterFn={suz}
      onSelect={onSelect}
      onAddNew={onYeni}
      addNewLabel="Yeni ürün"
      isItemDisabled={pasifSecilemez ? (k) => !k.aktif : undefined}
      selectOnDoubleClick
    />
  );
};

export default StokKartSecici;
