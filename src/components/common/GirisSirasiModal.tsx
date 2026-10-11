import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Table } from "react-bootstrap";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { GIRIS_SIRASI_OLAYI, ekranAlanlari, girisSirasiService } from "../../services/girisSirasiService";
import { ayarListesi } from "../../utils/girisSirasi";

/**
 * Giriş Sırası penceresi (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, Faz 7): kullanıcı, bulunduğu ekranın alanlarını
 * Enter ile hangi sırayla dolaşacağını ve hangilerini atlayacağını kendisi belirler. Kayıt kullanıcıya özeldir.
 * Sağ tık menüsü ve araç çubuğu `erp-giris-sirasi` olayıyla açar; App'te bir kez bağlıdır.
 */

type Satir = { alan: string; etiket: string; zorunlu: boolean; atla: boolean };

const GirisSirasiModal: React.FC = () => {
  const [ekran, setEkran] = useState<string | null>(null);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [secili, setSecili] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    const ac = async (e: Event) => {
      const ad = (e as CustomEvent<{ ekran: string }>).detail?.ekran;
      if (!ad) return;
      await girisSirasiService.hazirla();
      setSatirlar(ayarListesi(ekranAlanlari(ad), girisSirasiService.kayit(ad)));
      setSecili(0);
      setHata(null);
      setEkran(ad);
    };
    window.addEventListener(GIRIS_SIRASI_OLAYI, ac);
    return () => window.removeEventListener(GIRIS_SIRASI_OLAYI, ac);
  }, []);

  const kapat = () => setEkran(null);

  const tasi = (i: number, yon: -1 | 1) => {
    const j = i + yon;
    if (j < 0 || j >= satirlar.length) return;
    const yeni = [...satirlar];
    [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
    setSatirlar(yeni);
    setSecili(j);
  };

  const kaydet = async () => {
    if (!ekran) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      // Şu an görünmeyen ama kayıtta olan alanlar sonda korunur
      const gorunen = new Set(satirlar.map((s) => s.alan));
      const gizli = (girisSirasiService.kayit(ekran) || []).filter((k) => !gorunen.has(k.alan));
      await girisSirasiService.kaydet(ekran, [...satirlar.map((s) => ({ alan: s.alan, atla: s.atla })), ...gizli]);
      kapat();
    } catch (e: any) {
      setHata(e?.message || "Giriş sırası kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const varsayilan = async () => {
    if (!ekran) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      await girisSirasiService.sifirla(ekran);
      kapat();
    } catch (e: any) {
      setHata(e?.message || "Varsayılana dönülemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const tusla = (e: React.KeyboardEvent) => {
    if (!e.altKey || !satirlar.length) return;
    if (e.key === "ArrowUp") { e.preventDefault(); tasi(secili, -1); }
    if (e.key === "ArrowDown") { e.preventDefault(); tasi(secili, 1); }
  };

  return (
    <Modal show={!!ekran} onHide={kapat} centered size="lg" onKeyDown={tusla}>
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6 fw-semibold">Giriş Sırası{ekran?.endsWith(".detay") ? " — Satır Alanları" : ""}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        {hata && <Alert variant="danger" className="py-1 px-2 small mb-2">{hata}</Alert>}
        {satirlar.length === 0 ? (
          <div className="text-muted small p-3 text-center">Bu ekranda sırası ayarlanabilen alan yok.</div>
        ) : (
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <Table size="sm" hover className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}>Sıra</th>
                  <th>Alan</th>
                  <th style={{ width: 70 }} className="text-center">Atla</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => (
                  <tr key={s.alan} className={i === secili ? "table-primary" : undefined} onClick={() => setSecili(i)} data-no-erp-context="true">
                    <td className="text-muted">{i + 1}</td>
                    <td>{s.etiket}</td>
                    <td className="text-center">
                      {s.zorunlu ? (
                        <span className="text-muted" title="Zorunlu alan atlanamaz">—</span>
                      ) : (
                        <Form.Check
                          type="checkbox"
                          checked={s.atla}
                          onChange={(e) => setSatirlar(satirlar.map((x, k) => (k === i ? { ...x, atla: e.target.checked } : x)))}
                          aria-label={`${s.etiket} atla`}
                        />
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="link" className="p-0 me-2" disabled={i === 0} onClick={() => tasi(i, -1)} title="Yukarı (Alt+↑)">
                        <IconArrowUp size={15} />
                      </Button>
                      <Button size="sm" variant="link" className="p-0" disabled={i === satirlar.length - 1} onClick={() => tasi(i, 1)} title="Aşağı (Alt+↓)">
                        <IconArrowDown size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2 justify-content-between">
        <Button size="sm" variant="outline-secondary" onClick={varsayilan} disabled={kaydediliyor}>
          Varsayılana Dön
        </Button>
        <div className="d-flex gap-2">
          <Button size="sm" variant="secondary" onClick={kapat} disabled={kaydediliyor}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" onClick={kaydet} disabled={kaydediliyor || satirlar.length === 0}>
            Kaydet
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default GirisSirasiModal;
