import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconAdjustments, IconDeviceFloppy } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { StokAyarlari, TicariService } from "../../services/ticariService";
import { useTicariYetki } from "./useTicariYetki";

const DAVRANISLAR: { deger: StokAyarlari["eksiStok"]; ad: string; aciklama: string }[] = [
  { deger: "UYAR", ad: "Uyar ama sat", aciklama: "Stok yetmezse kaydetmeden önce uyarı çıkar; onaylanırsa satış yapılır, stok eksiye düşer." },
  { deger: "ENGELLE", ad: "Engelle", aciklama: "Stok yetmezse satış kaydedilmez." },
  { deger: "SESSIZ", ad: "Sessizce sat", aciklama: "Uyarı çıkmaz; stok eksiye düşebilir." },
];

/** J- Stok Ayarları (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T8, T21): eksi stok davranışı ve stok yönetim yetkisi */
export const StokAyarlariPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [ayar, setAyar] = useState<StokAyarlari | null>(null);
  const [eksiStok, setEksiStok] = useState<StokAyarlari["eksiStok"]>("UYAR");
  const [yetkililer, setYetkililer] = useState<number[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const a = await TicariService.ayarlar();
      setAyar(a);
      setEksiStok(a.eksiStok);
      setYetkililer(a.kullanicilar.filter((k) => k.yetkili).map((k) => k.kullaniciId));
    } catch (e: any) {
      setHata(e?.message || "Ayarlar alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  };
  useEffect(() => { if (!yetki.yukleniyor && yetki.sistemYoneticisi) void yukle(); else if (!yetki.yukleniyor) setYukleniyor(false); }, [yetki.yukleniyor, yetki.sistemYoneticisi]); // eslint-disable-line react-hooks/exhaustive-deps

  const kaydet = async () => {
    setKaydediliyor(true);
    try {
      const a = await TicariService.ayarKaydet({ eksiStok, yetkiliKullanicilar: yetkililer });
      setAyar(a);
      showSuccess("Stok ayarları kaydedildi.");
    } catch (e: any) {
      showError(e?.message || "Ayarlar kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="J- Stok Ayarları" pageIcon={<IconAdjustments size={20} />} onSave={yetki.sistemYoneticisi ? kaydet : undefined}
        onRefresh={yukle} hideNew hideDelete hidePrint hideSave={!yetki.sistemYoneticisi} disabled={kaydediliyor} />
      {!yetki.yukleniyor && !yetki.sistemYoneticisi && <Alert variant="warning" className="py-2">Stok ayarlarını yalnız sistem yöneticisi değiştirebilir.</Alert>}
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {yukleniyor ? (
        <div className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</div>
      ) : ayar && (
        <Row className="g-2">
          <Col lg={5}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Stok yetmediğinde satış</Card.Header>
              <Card.Body className="p-3">
                {DAVRANISLAR.map((d) => (
                  <Form.Check key={d.deger} type="radio" id={`eksi-${d.deger}`} name="eksiStok" className="mb-3"
                    checked={eksiStok === d.deger} onChange={() => setEksiStok(d.deger)}
                    label={<div><div className="fw-semibold">{d.ad}</div><div className="small text-muted">{d.aciklama}</div></div>} />
                ))}
                <div className="small text-muted border-top pt-2">Aynı kural stok giriş fişinin düzeltilmesinde ve silinmesinde de geçerlidir.</div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={7}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Stok yönetim yetkisi</Card.Header>
              <Card.Body className="p-2">
                <div className="small text-muted mb-2 px-1">
                  Stok Kartları, Ürün Grupları, Excel'den yükleme ve Stok Giriş Fişi ekranlarını sistem yöneticileri her zaman kullanır.
                  Diğer kullanıcılara buradan yetki verilir. Satış fişi ve raporlar herkese açıktır.
                </div>
                <div className="table-responsive" style={{ maxHeight: 420 }}>
                  <Table size="sm" hover bordered className="align-middle mb-0">
                    <thead className="table-light sticky-top">
                      <tr className="small text-secondary"><th style={{ width: 60 }} className="text-center">Yetki</th><th>Kullanıcı</th><th style={{ width: 150 }}></th></tr>
                    </thead>
                    <tbody>
                      {ayar.kullanicilar.map((k) => (
                        <tr key={k.kullaniciId}>
                          <td className="text-center">
                            <Form.Check aria-label={k.ad} disabled={k.yonetici} checked={k.yonetici || yetkililer.includes(k.kullaniciId)}
                              onChange={(e) => setYetkililer((p) => (e.target.checked ? [...p, k.kullaniciId] : p.filter((x) => x !== k.kullaniciId)))} />
                          </td>
                          <td className="fw-semibold">{k.ad}</td>
                          <td className="text-center">{k.yonetici ? <Badge bg="primary">Sistem yöneticisi</Badge> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
          {yetki.sistemYoneticisi && (
            <Col xs={12} className="text-end">
              <Button variant="primary" disabled={kaydediliyor} onClick={kaydet}>
                {kaydediliyor ? <Spinner size="sm" className="me-1" /> : <IconDeviceFloppy size={16} className="me-1" />}Kaydet
              </Button>
            </Col>
          )}
        </Row>
      )}
    </div>
  );
};

export default StokAyarlariPage;
