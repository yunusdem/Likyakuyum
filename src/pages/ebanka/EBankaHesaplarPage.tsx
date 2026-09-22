import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, Form, Table } from "react-bootstrap";
import ERPToolbar from "../../components/common/ERPToolbar";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { EBankaHesap, EBankaService } from "../../services/ebankaService";
import { ibanYaz, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > B- Hesaplar: Vomsis hesabı ↔ Banka Hesap Kartı eşlemesi (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E6)

const ibanSade = (v: string | null | undefined) => (v || "").replace(/\s+/g, "").toUpperCase();

export const EBankaHesaplarPage: React.FC = () => {
  const [hesaplar, setHesaplar] = useState<EBankaHesap[]>([]);
  const [kartlar, setKartlar] = useState<BankaHesapItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydedilen, setKaydedilen] = useState<number | null>(null);
  const { bildir, bildirimKutusu } = useBildirim();

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [h, k] = await Promise.all([EBankaService.getHesaplar(), BankaService.getBankalar()]);
      setHesaplar(h);
      setKartlar(k);
    } catch (err: any) {
      bildir("danger", err?.message || "Hesaplar okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bildir]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const esle = async (h: EBankaHesap, bankaId: number | null) => {
    setKaydedilen(h.vomsisHesapId);
    try {
      setHesaplar(await EBankaService.hesapEsle(h.vomsisHesapId, bankaId));
      bildir("success", bankaId ? "Hesap eşlendi." : "Hesap eşlemesi kaldırıldı.");
    } catch (err: any) {
      bildir("danger", err?.message || "Eşleme kaydedilemedi.");
    } finally {
      setKaydedilen(null);
    }
  };

  // Bir Banka Hesap Kartı yalnızca tek Vomsis hesabına bağlanabilsin
  const kullanilanKartlar = new Map(hesaplar.filter((h) => h.bankaId).map((h) => [h.bankaId as number, h.vomsisHesapId]));
  const eslesmeyen = hesaplar.filter((h) => h.aktif && !h.bankaId).length;

  return (
    <div className="ebanka-hesaplar-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="B- e-Banka Hesaplar"
        onRefresh={yukle}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor}
        modeText={`${hesaplar.length} hesap`}
        rightContent={
          eslesmeyen > 0 && (
            <Badge bg="warning" text="dark" className="px-2 py-1 fs-7">
              {eslesmeyen} eşleşmemiş
            </Badge>
          )
        }
      />
      {bildirimKutusu}

      <Alert variant="light" className="border small py-2">
        IBAN'ı tutan Banka Hesap Kartı güncelleme sırasında kendiliğinden bağlanır. Eşleşmeyenleri buradan seçin; bir hesabın hareketleri ancak
        bir Banka Hesap Kartı'na bağlıysa banka fişine aktarılır.
      </Alert>

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th>Banka</th>
                <th>Şube</th>
                <th>Hesap No</th>
                <th>IBAN</th>
                <th>Döviz</th>
                <th className="text-end">Bakiye</th>
                <th className="text-end">Kullanılabilir</th>
                <th style={{ minWidth: "280px" }}>Banka Hesap Kartı</th>
                <th>Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {hesaplar.map((h) => (
                <tr key={h.vomsisHesapId} className={h.aktif ? undefined : "text-muted"}>
                  <td className="fw-semibold">
                    {h.bankaAdi}
                    {!h.aktif && (
                      <Badge bg="secondary" className="ms-1">
                        Pasif
                      </Badge>
                    )}
                  </td>
                  <td>{h.subeAdi || h.subeKodu || "-"}</td>
                  <td className="font-monospace">{h.hesapNo || "-"}</td>
                  <td className="font-monospace">{ibanYaz(h.iban)}</td>
                  <td>{h.doviz}</td>
                  <td className="text-end font-monospace fw-bold">{paraYaz(h.bakiye)}</td>
                  <td className="text-end font-monospace">{paraYaz(h.kullanilabilirBakiye)}</td>
                  <td>
                    <Form.Select
                      size="sm"
                      value={h.bankaId ?? ""}
                      disabled={kaydedilen !== null}
                      className={h.aktif && !h.bankaId ? "border-warning" : undefined}
                      onChange={(e) => esle(h, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Eşleşmedi</option>
                      {kartlar
                        .filter((k) => {
                          const sahibi = kullanilanKartlar.get(k.bankaId);
                          return sahibi === undefined || sahibi === h.vomsisHesapId;
                        })
                        .map((k) => (
                          <option key={k.bankaId} value={k.bankaId}>
                            {k.hesapNo} - {k.hesapAdi}
                            {k.iban && ibanSade(k.iban) === ibanSade(h.iban) ? " (IBAN aynı)" : ""}
                          </option>
                        ))}
                    </Form.Select>
                  </td>
                  <td className="font-monospace">{zamanYaz(h.guncellemeZamani)}</td>
                </tr>
              ))}
              {hesaplar.length === 0 && !yukleniyor && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-3">
                    Hesap yok. Özet ekranından "Bankadan Güncelle" ile çekin.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default EBankaHesaplarPage;
