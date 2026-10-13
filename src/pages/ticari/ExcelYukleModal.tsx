import React, { useState } from "react";
import { Alert, Badge, Button, Modal, Spinner, Table } from "react-bootstrap";
import { IconAlertTriangle, IconCheck, IconDownload, IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";
import { useToast } from "../../context/ToastContext";
import { indirBlob } from "../../services/raporService";
import { ExcelOnizleme, TicariService, dosyaOku } from "../../services/ticariService";

/** Örnek dosyadaki sütunlar (sunucudaki EXCEL_SUTUNLARI ile aynı sıra; ekranda örnek görsel olarak gösterilir) */
const SUTUNLAR: { baslik: string; zorunlu?: boolean; ornek: string; not: string }[] = [
  { baslik: "Kod", ornek: "KLM001", not: "Boşsa otomatik. Varsa o kart güncellenir." },
  { baslik: "Ürün Adı", zorunlu: true, ornek: "Tükenmez Kalem Mavi", not: "Zorunlu" },
  { baslik: "Barkod", ornek: "8690000000011", not: "Birden fazlaysa ; ile" },
  { baslik: "Grup", ornek: "Kırtasiye", not: "Yoksa açılır" },
  { baslik: "Birim", ornek: "Adet", not: "Adet, Kg, Gr, Lt, Metre, Paket, Kutu" },
  { baslik: "KDV %", ornek: "20", not: "0, 1, 8, 10, 18, 20" },
  { baslik: "Satış Fiyatı", ornek: "25,50", not: "Sayı" },
  { baslik: "Fiyat KDV Dahil", ornek: "E", not: "E / H" },
  { baslik: "Para Birimi", ornek: "TL", not: "TL, USD, EUR…" },
  { baslik: "Alış Fiyatı", ornek: "15", not: "KDV hariç" },
  { baslik: "En Az Stok", ornek: "10", not: "Uyarı sınırı" },
  { baslik: "Açılış Miktarı", ornek: "100", not: "Stoğa girer" },
  { baslik: "Aktif", ornek: "E", not: "E / H" },
  { baslik: "Açıklama", ornek: "", not: "Serbest" },
];

interface Props { show: boolean; onHide: () => void; onYuklendi: () => void; }

/** Excel'den stok kartı yükleme (T20): örnek dosya + sütun görseli, önizlemede hatalı hücreler kırmızı, hata varken yükleme kapalı */
export const ExcelYukleModal: React.FC<Props> = ({ show, onHide, onYuklendi }) => {
  const { showSuccess, showError } = useToast();
  const [dosya, setDosya] = useState<{ ad: string; veri: string } | null>(null);
  const [onizleme, setOnizleme] = useState<ExcelOnizleme | null>(null);
  const [mesgul, setMesgul] = useState<"" | "onizle" | "yukle" | "ornek">("");
  const [hata, setHata] = useState<string | null>(null);

  const kapat = () => { setDosya(null); setOnizleme(null); setHata(null); onHide(); };

  const ornekIndir = async () => {
    setMesgul("ornek");
    try { indirBlob(await TicariService.excelOrnek(), "stok_kartlari_ornek.xlsx"); }
    catch (e: any) { showError(e?.message || "Örnek dosya indirilemedi."); }
    finally { setMesgul(""); }
  };

  const sec = async (f?: File | null) => {
    if (!f) return;
    setHata(null); setOnizleme(null);
    if (!/\.xlsx$/i.test(f.name)) { setHata("Yalnız .xlsx dosyası yüklenebilir. Excel'de Farklı Kaydet › Excel Çalışma Kitabı (.xlsx) seçin."); return; }
    const veri = await dosyaOku(f);
    setDosya({ ad: f.name, veri });
    setMesgul("onizle");
    try { setOnizleme(await TicariService.excelOnizle(veri)); }
    catch (e: any) { setHata(e?.message || "Dosya okunamadı."); }
    finally { setMesgul(""); }
  };

  const yukle = async () => {
    if (!dosya || !onizleme?.yuklenebilir) return;
    setMesgul("yukle");
    try {
      const r = await TicariService.excelYukle(dosya.veri);
      showSuccess(`${r.yeni} yeni kart açıldı, ${r.guncellenen} kart güncellendi.${r.acilisFisNo ? ` Açılış stoğu ${r.acilisFisNo} numaralı giriş fişiyle girildi.` : ""}`);
      onYuklendi();
      kapat();
    } catch (e: any) {
      setHata(e?.message || "Yükleme yapılamadı.");
      if (e?.ayrinti?.onizleme) setOnizleme(e.ayrinti.onizleme);
    } finally {
      setMesgul("");
    }
  };

  const hucreHatasi = (s: ExcelOnizleme["satirlar"][number], baslik: string) => s.hatalar.filter((h) => h.sutun === baslik).map((h) => h.mesaj).join(" ");
  const ANAHTAR: Record<string, string> = { "Kod": "kod", "Ürün Adı": "ad", "Barkod": "barkod", "Grup": "grup", "Birim": "birim", "KDV %": "kdvOrani", "Satış Fiyatı": "satisFiyati",
    "Fiyat KDV Dahil": "fiyatKdvDahil", "Para Birimi": "paraBirimi", "Alış Fiyatı": "alisFiyati", "En Az Stok": "enAzStok", "Açılış Miktarı": "acilisMiktari", "Aktif": "aktif", "Açıklama": "aciklama" };
  const satirlar = onizleme ? [...onizleme.satirlar].sort((a, b) => (b.hatalar.length ? 1 : 0) - (a.hatalar.length ? 1 : 0) || a.satir - b.satir) : [];

  return (
    <Modal show={show} onHide={kapat} size="xl" centered backdrop="static">
      <Modal.Header closeButton className="bg-light py-2">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2"><IconFileSpreadsheet size={18} className="text-success" />Excel'den Stok Kartı Yükleme</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <Button size="sm" variant="outline-success" disabled={mesgul === "ornek"} onClick={ornekIndir}>
            {mesgul === "ornek" ? <Spinner size="sm" className="me-1" /> : <IconDownload size={15} className="me-1" />}Örnek Excel indir
          </Button>
          <label className="btn btn-sm btn-primary mb-0">
            <IconUpload size={15} className="me-1" />Dosya seç (.xlsx)
            <input type="file" accept=".xlsx" hidden onChange={(e) => { void sec(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {dosya && <span className="small text-muted">{dosya.ad}</span>}
          {mesgul === "onizle" && <span className="small"><Spinner size="sm" className="me-1" />Dosya denetleniyor...</span>}
        </div>

        {!onizleme && (
          <>
            <div className="small text-muted mb-1">Dosyanın ilk satırı bu başlıklar olmalı (sıra serbest). Örnek Excel'i indirip doldurmanız en kolayı:</div>
            <div className="table-responsive border rounded">
              <Table size="sm" bordered className="mb-0 small text-nowrap">
                <thead>
                  <tr>{SUTUNLAR.map((s) => <th key={s.baslik} style={{ background: "#1F4E79", color: "#fff" }}>{s.baslik}{s.zorunlu && " *"}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>{SUTUNLAR.map((s) => <td key={s.baslik} className="font-monospace">{s.ornek}</td>)}</tr>
                  <tr className="text-muted fst-italic">{SUTUNLAR.map((s) => <td key={s.baslik}>{s.not}</td>)}</tr>
                </tbody>
              </Table>
            </div>
            <ul className="small text-muted mt-2 mb-0">
              <li>Kod ya da barkod mevcut bir kartla eşleşirse kart güncellenir; boş bıraktığınız hücreler kartta değişmez.</li>
              <li>Açılış Miktarı doluysa tüm açılışlar tek bir "Excel açılış" stok giriş fişiyle girilir (Stok Giriş Listesi'nde görünür).</li>
              <li>Dosyada tek bir hata bile varsa hiçbir şey yüklenmez; önizlemede kırmızı hücreleri düzeltip dosyayı yeniden seçin.</li>
            </ul>
          </>
        )}

        {hata && <Alert variant="danger" className="py-2 mt-2">{hata}</Alert>}

        {onizleme && (
          <>
            {onizleme.sutunHatalari.length > 0 && (
              <Alert variant="danger" className="py-2 mt-2">
                <div className="fw-bold mb-1"><IconAlertTriangle size={16} className="me-1" />Sütunları düzeltin:</div>
                <ul className="mb-0 small">{onizleme.sutunHatalari.map((h) => <li key={h}>{h}</li>)}</ul>
              </Alert>
            )}
            {onizleme.hataliSatir > 0 && (
              <Alert variant="danger" className="py-2 mt-2 small mb-2">
                <b>{onizleme.hataliSatir}</b> satırda hata var. Kırmızı hücrelerin üzerine gelince açıklaması görünür; Excel'de düzeltip dosyayı yeniden seçin.
              </Alert>
            )}
            {onizleme.bilgiler.map((b) => <Alert key={b} variant="info" className="py-1 mt-1 small mb-1">{b}</Alert>)}
            <div className="d-flex gap-2 small my-2">
              <Badge bg="success">{onizleme.yeni} yeni</Badge>
              <Badge bg="primary">{onizleme.guncellenecek} güncellenecek</Badge>
              <Badge bg={onizleme.hataliSatir ? "danger" : "secondary"}>{onizleme.hataliSatir} hatalı satır</Badge>
            </div>
            <div className="table-responsive border rounded" style={{ maxHeight: "50vh" }}>
              <Table size="sm" bordered className="mb-0 small text-nowrap align-middle">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Satır</th><th>Durum</th><th>Düzeltilecekler</th>
                    {SUTUNLAR.map((s) => <th key={s.baslik}>{s.baslik}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s) => (
                    <tr key={s.satir}>
                      <td className="text-muted">{s.satir}</td>
                      <td>{s.hatalar.length ? <Badge bg="danger">Hatalı</Badge> : s.durum === "YENI" ? <Badge bg="success">Yeni</Badge> : <Badge bg="primary" title={`${s.eslesenKod} güncellenir`}>Güncelle</Badge>}</td>
                      <td className="text-danger" style={{ whiteSpace: "normal", minWidth: 300, maxWidth: 420 }}>
                        {s.hatalar.map((h, i) => <div key={i}><b>{h.sutun}:</b> {h.mesaj}</div>)}
                      </td>
                      {SUTUNLAR.map((c) => {
                        const h = hucreHatasi(s, c.baslik);
                        // Tema tablo hücresine gölgeyle renk veriyor; kırmızı gölgeyle zorlanır
                        return <td key={c.baslik} title={h || undefined} style={h ? { boxShadow: "inset 0 0 0 9999px #fde2e2", color: "#991b1b", fontWeight: 700, border: "1px solid #f87171" } : undefined}>{s.deger[ANAHTAR[c.baslik]] || (h ? "(boş)" : "")}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="bg-light py-2">
        <Button size="sm" variant="outline-secondary" onClick={kapat}>Kapat</Button>
        <Button size="sm" variant="success" disabled={!onizleme?.yuklenebilir || mesgul !== ""} onClick={yukle}
          title={onizleme && !onizleme.yuklenebilir ? "Önce hataları düzeltin" : undefined}>
          {mesgul === "yukle" ? <Spinner size="sm" className="me-1" /> : <IconCheck size={15} className="me-1" />}
          Yükle{onizleme?.yuklenebilir ? ` (${onizleme.yeni + onizleme.guncellenecek} ürün)` : ""}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ExcelYukleModal;
