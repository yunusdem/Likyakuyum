import React, { useCallback, useEffect, useState } from "react";
import { AdisyonService, HazirlikYeri, adisyonOlaylarinaBaglan } from "../../services/adisyonService";
import { MutfakEkrani } from "./MutfakEkrani";

/**
 * Adisyon › Mutfak Ekranı (D5): PC oturumuyla bütün ekranlı hazırlık yerleri ya da biri. Mutfak tableti için personel girişi
 * gerekmez: Tanımlar › Hazırlık yerleri › "Ekran bağlantısı" ile /mutfak adresi verilir.
 */
export const AdisyonMutfakPage: React.FC = () => {
  const [yerler, setYerler] = useState<HazirlikYeri[]>([]);
  const [yerId, setYerId] = useState<number | null>(null);
  useEffect(() => { AdisyonService.yerler().then((l) => setYerler(l.filter((y) => y.aktif && y.ekran))).catch(() => setYerler([])); }, []);
  const yukle = useCallback(() => AdisyonService.mutfakSiparisler(yerId), [yerId]);
  const hazir = useCallback((ids: number[], h: boolean) => AdisyonService.mutfakHazir(ids, h), []);
  const olayBaglan = useCallback((cb: any) => adisyonOlaylarinaBaglan(cb), []);
  const secici = (
    <select aria-label="Hazırlık yeri" value={yerId ?? ""} onChange={(e) => setYerId(e.target.value ? Number(e.target.value) : null)}
      style={{ background: "#1e293b", color: "#fff", border: "1px solid #475569", borderRadius: 8, padding: "4px 8px" }}>
      <option value="">Bütün yerler</option>
      {yerler.map((y) => <option key={y.yerId} value={y.yerId}>{y.ad}</option>)}
    </select>
  );
  return (
    <div className="container-fluid py-3">
      <MutfakEkrani key={String(yerId)} baslik="Mutfak Ekranı" yukle={yukle} hazir={hazir} olayBaglan={olayBaglan} ust={secici} />
    </div>
  );
};

export default AdisyonMutfakPage;
