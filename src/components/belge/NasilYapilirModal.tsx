import React, { useEffect, useState } from "react";
import { Accordion, Form, Modal, Spinner, Table } from "react-bootstrap";
import { BelgeService, type AlanKatalogu } from "../../services/belgeService";

/**
 * "Nasıl yapılır?" (docs/FIS_TASARIM_YOL_HARITASI.md, bölüm 7): şablonu çıkarma / ekleme, dosyanın dili,
 * değiştirilebilen ayarlar, kilitli alanlar, logo / imza ve seçili belgenin kullanılabilir alanları.
 */
export const NasilYapilirModal: React.FC<{ show: boolean; onHide: () => void; tur: string; turAdi: string }> = ({ show, onHide, tur, turAdi }) => {
  const [katalog, setKatalog] = useState<AlanKatalogu | null>(null);
  const [ara, setAra] = useState("");
  useEffect(() => {
    if (!show || !tur) return;
    setKatalog(null);
    BelgeService.sablonAlanlari(tur).then(setKatalog).catch(() => setKatalog({ alanlar: [], listeler: {}, ornek: {} }));
  }, [show, tur]);

  const ornekDeger = (yol: string) => {
    const v = yol.split(".").reduce<any>((x, k) => (x == null ? undefined : x[k]), katalog?.ornek);
    return v === undefined || v === null || typeof v === "object" ? "" : String(v);
  };
  const a = ara.toLocaleLowerCase("tr-TR");
  const uyar = (yol: string) => !a || yol.toLocaleLowerCase("tr-TR").includes(a) || (katalog?.aciklamalar?.[yol] || "").toLocaleLowerCase("tr-TR").includes(a);
  const kod = (t: string) => <code style={{ fontSize: 12 }}>{t}</code>;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-bold">Nasıl yapılır? — Belge Tasarımı</Modal.Title></Modal.Header>
      <Modal.Body className="small">
        <Accordion defaultActiveKey="1" alwaysOpen>
          <Accordion.Item eventKey="0">
            <Accordion.Header>Ekranda düzenleme (önerilen)</Accordion.Header>
            <Accordion.Body>
              <ol className="mb-0">
                <li>Soldan belgeyi seçin, <b>Düzenle</b>'ye basın.</li>
                <li>Öğeleri sürükleyerek taşıyın, sağ-alt köşedeki mavi kareden boyutlandırın. Oklar 0,5 pt, Shift + oklar 5 pt kaydırır.</li>
                <li>Sağ panelden yazı, boyut, hizalama, kalınlık, renk ve koşulu değiştirin. Soldaki <b>Alanlar</b> listesinden tıklayarak veri alanı ekleyin.</li>
                <li><b>Kaydet</b>. Sistem şablonu denetler; hata varsa kaydetmez ve hatalı öğeyi gösterir.</li>
                <li>Beğenmezseniz <b>Önceki Sürüm</b> ya da <b>Varsayılana Dön</b>. Eski düzen silinmez.</li>
              </ol>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Şablonu çıkarma ve ekleme (dosya ile)</Accordion.Header>
            <Accordion.Body>
              <div className="fw-semibold">Çıkarma (indirme)</div>
              <ol>
                <li>Belgeyi seçin (ör. {turAdi || "e-Döviz Fişi"}).</li>
                <li><b>Şablonu İndir</b> → bilgisayara {kod(`${tur || "DOVIZ_FIS"}.json`)} dosyası iner.</li>
              </ol>
              <div className="fw-semibold">Ekleme (yükleme)</div>
              <ol className="mb-0">
                <li>Aynı ekranda <b>Şablonu Yükle</b> → {kod(".json")} dosyasını seçin.</li>
                <li>Sistem dosyayı denetler. Hata varsa kaydetmez; hangi öğenin neden hatalı olduğunu listeler.</li>
                <li>Geçerse önizleme açılır; <b>Kaydet ve Kullan</b> ile etkinleşir, önceki düzen sürüm olarak saklanır.</li>
                <li>Hazır bir düzenle başlamak için <b>Örnekler</b> menüsünü kullanın.</li>
              </ol>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>Dosyanın dili (JSON)</Accordion.Header>
            <Accordion.Body>
              <p>Dosya <b>JSON</b> biçimindedir; Not Defteri ile açılıp düzenlenebilir, <b>UTF-8</b> olarak kaydedilmelidir.
                Ölçüler <b>punto (pt)</b>: 80 mm kâğıt ≈ 227 pt, A4 = 595 pt genişlik. {kod("x")} soldan, {kod("y")} yukarıdan uzaklıktır
                (kenar boşluğundan sonra).</p>
              <p className="mb-1">Her öğe {kod('{ "tip": ..., "x": ..., "y": ... }')} biçimindedir. Değiştirilebilenler:</p>
              <Table size="sm" bordered className="mb-2">
                <thead className="table-light"><tr><th>Ne değişir</th><th>Alan</th><th>Örnek</th></tr></thead>
                <tbody>
                  <tr><td>Yer</td><td>{kod("x")}, {kod("y")}</td><td>{kod('"y": 120')} → 120 pt aşağı</td></tr>
                  <tr><td>Genişlik / yükseklik</td><td>{kod("g")}, {kod("h")}</td><td>{kod('"g": 200')}</td></tr>
                  <tr><td>Yazı boyutu / kalınlık</td><td>{kod("boyut")}, {kod("kalin")}</td><td>{kod('"boyut": 9, "kalin": true')}</td></tr>
                  <tr><td>Hizalama</td><td>{kod("hiza")}</td><td>{kod('"left"')}, {kod('"center"')}, {kod('"right"')}</td></tr>
                  <tr><td>Sabit yazı</td><td>{kod("metin")}</td><td>{kod('"metin": "Bizi tercih ettiğiniz için teşekkürler"')}</td></tr>
                  <tr><td>Veri alanı</td><td>{kod("{{alan}}")}</td><td>{kod('"metin": "Belge No: {{belgeNo}}"')}</td></tr>
                  <tr><td>Sayı biçimi</td><td>{kod("{{alan|sayi}}")}</td><td>{kod("|sayi")} 2 hane, {kod("|sayi:3")} 3 hane, {kod("|tl")} {kod("|doviz")} {kod("|kurb")} firma kuruş ayarı, {kod("|buyuk")} BÜYÜK HARF</td></tr>
                  <tr><td>Kalın parça</td><td>{kod("**yazı**")}</td><td>{kod('"Fiş No: **{{fisNo}}**"')}</td></tr>
                  <tr><td>Koşul</td><td>{kod("kosul")}</td><td>{kod('"kosul": "{{ettn}}"')} doluysa basılır; {kod('"!{{satim}}"')} alışta basılır</td></tr>
                  <tr><td>Boşsa yukarı kaysın</td><td>{kod("daralt")}</td><td>{kod('"daralt": true')}</td></tr>
                  <tr><td>Logo / imza</td><td>{kod('"tip": "logo"')} / {kod('"tip": "imza"')}, {kod("gorsel")}</td><td>{kod('{ "tip": "imza", "gorsel": "Kaşe", "x": 120, "y": 700, "g": 90, "h": 45 }')}</td></tr>
                  <tr><td>Renk / zemin</td><td>{kod("renk")}, {kod("zemin")}</td><td>{kod('"renk": "#b00020"')}</td></tr>
                </tbody>
              </Table>
              <p className="mb-1">Öğe türleri: {kod("metin")} {kod("satirlar")} {kod("tablo")} {kod("liste")} {kod("kutu")} {kod("cizgi")} {kod("resim")} {kod("logo")} {kod("imza")} {kod("qr")} {kod("filigran")}.
                Satırlar öğesinde {kod("?")} ile başlayan satır, alanı boşsa basılmaz.</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="3">
            <Accordion.Header>Kilitli (yasal zorunlu) alanlar</Accordion.Header>
            <Accordion.Body>
              <p className="mb-1">{kod('"zorunlu": true')} işaretli öğeler (belge no, tarih, firma ve müşteri bilgileri, ETTN, karekod, tutarlar …)
                yasal alanlardır: <b>yeri, boyutu ve etiket yazısı değişebilir</b>; silinemez, türü ve koşulu değiştirilemez, içindeki veri alanları
                ({kod("{{...}}")}) çıkarılamaz. Dosyadan silinirse yükleme reddedilir. Editörde kilit simgesiyle gösterilir.</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="4">
            <Accordion.Header>Logo ve imza / kaşe</Accordion.Header>
            <Accordion.Body>
              <p className="mb-1"><b>Logolar ve İmzalar</b> penceresinden PNG / JPG (en çok 1 MB) yükleyin ve bir ad verin (ör. "Kaşe").
                İmza ve kaşe için arka planı saydam PNG önerilir. Sonra editörde <b>Logo</b> / <b>İmza / Kaşe</b> düğmesinden seçin ya da dosyada
                {kod('"gorsel": "Kaşe"')} yazın. Her belgede ayrı seçilir. 80 mm fişlerde görseller siyah-beyaz basılır.</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="5">
            <Accordion.Header>Kullanılabilir alanlar — {turAdi}</Accordion.Header>
            <Accordion.Body>
              {!katalog ? <div className="d-flex align-items-center gap-2"><Spinner size="sm" /> Yükleniyor…</div> : (
                <>
                  <Form.Control size="sm" placeholder="Alan ara…" value={ara} onChange={(e) => setAra(e.target.value)} className="mb-2" />
                  <Table size="sm" bordered hover className="mb-2">
                    <thead className="table-light"><tr><th>Alan</th><th>Açıklama</th><th>Örnek değer</th></tr></thead>
                    <tbody>
                      {katalog.alanlar.filter(uyar).map((yol) => (
                        <tr key={yol}><td>{kod(`{{${yol}}}`)}</td><td>{katalog.aciklamalar?.[yol] || ""}</td><td className="text-muted">{ornekDeger(yol)}</td></tr>
                      ))}
                    </tbody>
                  </Table>
                  {Object.entries(katalog.listeler).map(([kaynak, l]) => (
                    <div key={kaynak} className="mb-2">
                      <div className="fw-semibold">Liste {kod(kaynak)} — yalnız {kod(`"tip": "liste", "kaynak": "${kaynak}"`)} içinde, her kayıt için:</div>
                      <Table size="sm" bordered className="mb-0">
                        <tbody>
                          {[...l, "sira"].filter(uyar).map((yol) => <tr key={yol}><td>{kod(`{{${yol}}}`)}</td><td>{katalog.aciklamalar?.[yol] || ""}</td></tr>)}
                        </tbody>
                      </Table>
                    </div>
                  ))}
                </>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Modal.Body>
    </Modal>
  );
};
