import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "react-bootstrap";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";
import { StokKart, TicariService, miktarYaz, para } from "../../services/ticariService";

interface Props {
  show: boolean;
  /** Hazır liste (verilmezse sunucuda aranır: ilk 200 kart, yazdıkça kod / ad / barkod araması) */
  kartlar?: StokKart[];
  yukleniyor?: boolean;
  aramaMetni?: string;
  /** Sunucu aramasında yalnız aktif kartlar */
  yalnizAktif?: boolean;
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

/** Sunucu araması: 250 ms bekleyip kod / ad / barkodla en çok 200 kart getirir (G2: tam liste tarayıcıya çekilmez) */
export function useSunucuKartAramasi(acik: boolean, yalnizAktif?: boolean) {
  const [kartlar, setKartlar] = useState<StokKart[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const istek = useRef(0);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ara = useCallback((metin: string) => {
    if (zaman.current) clearTimeout(zaman.current);
    const no = ++istek.current;
    setYukleniyor(true);
    zaman.current = setTimeout(() => {
      TicariService.kartlar({ arama: metin.trim() || undefined, aktif: yalnizAktif ? true : null, limit: 200 })
        .then((l) => { if (no === istek.current) setKartlar(l); })
        .catch(() => { if (no === istek.current) setKartlar([]); })
        .finally(() => { if (no === istek.current) setYukleniyor(false); });
    }, metin.trim() ? 250 : 0);
  }, [yalnizAktif]);
  useEffect(() => { if (!acik) { istek.current++; setYukleniyor(false); } }, [acik]);
  return { kartlar, yukleniyor, ara };
}

/** Stok kartı seçme penceresi (F4 / dürbün): kod, ad ya da barkodla arar */
export const StokKartSecici: React.FC<Props> = ({ show, kartlar, yukleniyor, aramaMetni, yalnizAktif, pasifSecilemez, onHide, onSelect, onYeni }) => {
  const sunucu = useSunucuKartAramasi(show && !kartlar, yalnizAktif);
  const sunucuda = !kartlar;
  const suz = useCallback((k: StokKart, t: string) => {
    const a = t.toLocaleLowerCase("tr-TR");
    return k.kod.toLocaleLowerCase("tr-TR").includes(a) || k.ad.toLocaleLowerCase("tr-TR").includes(a) || k.barkodlar.some((b) => b.includes(t)) || (k.grupAdi || "").toLocaleLowerCase("tr-TR").includes(a);
  }, []);
  // Sunucu araması: liste zaten süzülmüş gelir, tarayıcıda yeniden süzülmez
  const suzme = useCallback(() => true, []);
  return (
    <LookupModal<StokKart>
      show={show}
      onHide={onHide}
      title="Stok Kartı Seç"
      items={sunucuda ? sunucu.kartlar : kartlar!}
      isLoading={sunucuda ? sunucu.yukleniyor : yukleniyor}
      initialSearchTerm={aramaMetni || ""}
      searchPlaceholder="Kod, ürün adı ya da barkod..."
      columns={kolonlar}
      filterFn={sunucuda ? suzme : suz}
      onSearchTermChange={sunucuda ? sunucu.ara : undefined}
      onSelect={onSelect}
      onAddNew={onYeni}
      addNewLabel="Yeni ürün"
      isItemDisabled={pasifSecilemez ? (k) => !k.aktif : undefined}
      selectOnDoubleClick
    />
  );
};

export default StokKartSecici;
