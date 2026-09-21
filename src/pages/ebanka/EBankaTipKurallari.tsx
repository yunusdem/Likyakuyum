import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Table } from "react-bootstrap";
import { EBankaService, EBankaTipKurali, EBankaTipKuraliSatiri } from "../../services/ebankaService";
import { BildirimTuru, CariSecModal } from "./ebankaOrtak";

// F- e-Banka > Ayarlar: hareket tipi başına aktarım kuralı ve varsayılan cari (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E14, E19, E27, E28)

export const EBankaTipKurallari: React.FC<{ bildir: (type: BildirimTuru, message: string) => void }> = ({ bildir }) => {
  const [satirlar, setSatirlar] = useState<EBankaTipKuraliSatiri[]>([]);
  const [kaydedilen, setKaydedilen] = useState<string | null>(null);
  const [cariSecilen, setCariSecilen] = useState<EBankaTipKuraliSatiri | null>(null);

  const yukle = useCallback(async () => {
    try {
      setSatirlar(await EBankaService.getTipKurallari());
    } catch {
      setSatirlar([]);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const kaydet = async (s: EBankaTipKuraliSatiri, kural: EBankaTipKurali, cariKartId: number | null) => {
    setKaydedilen(s.tipKodu);
    try {
      setSatirlar(await EBankaService.saveTipKurali(s.tipKodu, kural, cariKartId));
    } catch (err: any) {
      bildir("danger", err?.message || "Kural kaydedilemedi.");
    } finally {
      setKaydedilen(null);
    }
  };

  return (
    <Card className="border shadow-sm mb-3 w-100 bg-white">
      <Card.Header className="bg-white py-2 small fw-bold text-secondary">Hareket Tipi Kuralları</Card.Header>
      <Card.Body className="p-0">
        <div className="small text-muted px-3 py-2 border-bottom">
          Karşı tarafı cari olmayan tiplere (masraf, faiz, vergi, SGK…) varsayılan cari bağlarsanız o tipin hareketleri kendiliğinden fişe aktarılır. POS yatan
          tipleri varsayılan olarak aktarılmaz: tahsilat ödeme anında işlendiği için ikinci kez fiş olmasın.
        </div>
        <div style={{ maxHeight: "420px", overflowY: "auto" }}>
          <Table size="sm" hover className="mb-0 small align-middle">
            <thead className="table-light" style={{ position: "sticky", top: 0 }}>
              <tr>
                <th>Hareket Tipi</th>
                <th style={{ width: "250px" }}>Kural</th>
                <th>Varsayılan Cari</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.tipKodu}>
                  <td>
                    {s.tipAdi} <span className="text-muted font-monospace">({s.tipKodu})</span>
                  </td>
                  <td>
                    <Form.Select
                      size="sm"
                      value={s.kural}
                      disabled={kaydedilen !== null}
                      onChange={(e) => kaydet(s, Number(e.target.value) as EBankaTipKurali, s.cariKartId)}
                    >
                      <option value={0}>Otomatik aktar</option>
                      <option value={1}>Bekleyenler'de kalsın (elle)</option>
                      <option value={2}>Aktarma</option>
                    </Form.Select>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className={s.cariKartId ? "fw-semibold" : "text-muted"}>{s.cariKartId ? `${s.cariKod} - ${s.cariAdi}` : "Yok (karşı taraftan eşleştirilir)"}</span>
                      <Button size="sm" variant="outline-primary" className="py-0 ms-auto" disabled={kaydedilen !== null} onClick={() => setCariSecilen(s)}>
                        Seç
                      </Button>
                      {s.cariKartId && (
                        <Button size="sm" variant="light" className="border py-0" disabled={kaydedilen !== null} onClick={() => kaydet(s, s.kural, null)}>
                          Kaldır
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {satirlar.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-3">
                    Hareket tipleri ilk "Vomsis'ten Güncelle" ile gelir.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>

      <CariSecModal
        show={!!cariSecilen}
        onHide={() => setCariSecilen(null)}
        onSec={(c) => {
          if (cariSecilen) kaydet(cariSecilen, cariSecilen.kural, c.cariKartId);
          setCariSecilen(null);
        }}
      />
    </Card>
  );
};

export default EBankaTipKurallari;
