import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, ProgressBar, Row, Spinner, Table } from "react-bootstrap";
import { FirmaDto, gunYaz, tarihYaz } from "../services/adminApi";
import {
  aktarimApi,
  AktarimIsi,
  AktarimRaporu,
  boyutYaz,
  CiftRolu,
  DogrulamaKontrolu,
  DogrulamaRaporu,
  Engel,
  IncelemeSonucu,
  YuklemeBilgisi,
} from "../services/aktarimApi";

/**
 * Firma kartı › Veri Aktar (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K6, K10).
 * Eski programın yedeği sürükle-bırak ya da dosya seçerek yüklenir → incelenir → firma kodu yazılarak aktarılır.
 * Aktarım tek işlemde yapılır ve COMMIT'ten önce kaynakla karşılaştırılır; fark varsa hiçbir şey yazılmaz.
 */

const ROL_ADI: Record<CiftRolu, string> = { RESMI: "Resmî (e-Döviz gönderen)", CALISMA: "Çalışma (fişleri resmîye aktarılan)" };
const GRUP_ADI: Record<string, string> = {
  SATIR_SAYISI: "Satır sayısı",
  ICERIK: "Satır içerikleri",
  DOLULUK: "Doluluk",
  SAYISAL_TOPLAM: "Tutar toplamları",
  E_DOVIZ: "e-Döviz",
  KULLANICI: "Kullanıcılar",
  KIMLIK: "Kimlik sayaçları",
  SEMA: "Şema",
  GORUNUM: "Eski programın gösterdiği (belge tutarı / bakiye)",
  EK: "e-Döviz işaretleri / çift",
};
const yerelZaman = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("tr-TR") : "-");
const sayi = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n.toLocaleString("tr-TR"));

const EngelListesi: React.FC<{ engeller: Engel[] }> = ({ engeller }) =>
  engeller.length ? (
    <>
      {engeller.map((e, i) => (
        <Alert key={i} variant={e.seviye === "ENGEL" ? "danger" : "warning"} className="py-2 mb-2 small">
          <strong>{e.seviye === "ENGEL" ? "Aktarımı engelliyor: " : "Uyarı: "}</strong>
          {e.mesaj}
        </Alert>
      ))}
    </>
  ) : null;

const KontrolRozeti: React.FC<{ d: DogrulamaKontrolu["durum"] }> = ({ d }) => (
  <Badge bg={d === "TAMAM" ? "success" : d === "FARK" ? "danger" : d === "UYARI" ? "warning" : "secondary"} text={d === "UYARI" ? "dark" : undefined}>
    {d === "TAMAM" ? "Tamam" : d === "FARK" ? "Fark" : d === "UYARI" ? "Uyarı" : "Bilgi"}
  </Badge>
);

const DogrulamaPaneli: React.FC<{ rapor: DogrulamaRaporu; baslik: string }> = ({ rapor, baslik }) => {
  const [hepsi, setHepsi] = useState(false);
  const gosterilen = rapor.kontroller.filter((k) => hepsi || k.durum === "FARK" || k.durum === "UYARI" || k.durum === "BILGI");
  const gruplar = [...new Set(rapor.kontroller.map((k) => k.grup))];
  return (
    <div className="mt-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h6 className="mb-0">
          {baslik}: {rapor.basarili ? <Badge bg="success">Fark yok</Badge> : <Badge bg="danger">{rapor.ozet.fark} fark</Badge>}
        </h6>
        <Form.Check type="switch" id={`hepsi-${baslik}`} label="Bütün kontrolleri göster" checked={hepsi} onChange={(e) => setHepsi(e.target.checked)} />
      </div>
      <div className="small text-muted mb-2">
        {sayi(rapor.ozet.tablo)} tablo, {sayi(rapor.ozet.satir)} satır · {sayi(rapor.ozet.tamam)} kontrol tamam, {rapor.ozet.fark} fark, {rapor.ozet.uyari} uyarı ·{" "}
        {yerelZaman(rapor.zaman)} · {Math.round(rapor.sureMs / 100) / 10} sn
      </div>
      <div className="small mb-2">
        {gruplar.map((g) => {
          const k = rapor.kontroller.filter((x) => x.grup === g);
          const fark = k.filter((x) => x.durum === "FARK").length;
          return (
            <Badge key={g} bg={fark ? "danger" : "light"} text={fark ? undefined : "dark"} className="me-1 mb-1 fw-normal">
              {GRUP_ADI[g] || g}: {fark ? `${fark} fark` : `${k.length} tamam`}
            </Badge>
          );
        })}
      </div>
      {gosterilen.length > 0 && (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <Table size="sm" responsive className="align-middle small mb-0">
            <thead>
              <tr>
                <th></th>
                <th>Kontrol</th>
                <th>Tablo</th>
                <th className="text-end">Kaynak (eski)</th>
                <th className="text-end">Hedef (firma)</th>
                <th>Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {gosterilen.map((k, i) => (
                <tr key={i}>
                  <td>
                    <KontrolRozeti d={k.durum} />
                  </td>
                  <td>
                    <span className="text-muted">{GRUP_ADI[k.grup] || k.grup} · </span>
                    {k.ad}
                  </td>
                  <td>{k.tablo || "-"}</td>
                  <td className="text-end">{k.kaynak ?? "-"}</td>
                  <td className="text-end">{k.hedef ?? "-"}</td>
                  <td>
                    {k.ayrinti}
                    {k.ornekler?.length ? <div className="text-muted">{k.ornekler.slice(0, 5).join(" · ")}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
};

const IncelemePaneli: React.FC<{ s: IncelemeSonucu }> = ({ s }) => {
  const o = s.ozet;
  // Çalışma alanı (A): kendi gönderim günlüğü yok, belgeleri eşi (resmî alan) gönderir; "gönderilmemiş" sayısı yanıltıcı olur
  const calismaAlani = !!o && (o.alan.fisleriAktarilacak === true || (!o.eDoviz.logVar && o.bagliVeritabanlari.length > 0));
  return (
    <div>
      <EngelListesi engeller={s.engeller} />
      {o && (
        <>
          <Row className="g-3 small">
            <Col md={6}>
              <Table size="sm" className="mb-0">
                <tbody>
                  <tr><th className="text-muted fw-normal">Eski veritabanı</th><td>{o.yedek.dbAdi} ({o.yedek.sqlSurumu})</td></tr>
                  <tr><th className="text-muted fw-normal">Yedek tarihi</th><td>{tarihYaz(o.yedek.tarih)}</td></tr>
                  <tr><th className="text-muted fw-normal">Eski program sürümü</th><td>{o.programSurumu || "-"}</td></tr>
                  <tr><th className="text-muted fw-normal">Firma (yedekteki)</th><td>{o.firma.ad || "-"}{o.firma.vkn ? ` · VKN ${o.firma.vkn}` : ""}</td></tr>
                  <tr><th className="text-muted fw-normal">Kullanıcılar</th><td>{o.kullanicilar.join(", ") || "-"}</td></tr>
                </tbody>
              </Table>
            </Col>
            <Col md={6}>
              <Table size="sm" className="mb-0">
                <tbody>
                  <tr><th className="text-muted fw-normal">Döviz fişi</th><td>{sayi(o.fis.doviz.adet)} ({gunYaz(o.fis.doviz.ilk)} – {gunYaz(o.fis.doviz.son)})</td></tr>
                  <tr><th className="text-muted fw-normal">Sarraf fişi</th><td>{sayi(o.fis.sarraf.adet)}</td></tr>
                  <tr><th className="text-muted fw-normal">Cari kart / hareket</th><td>{sayi(o.fis.cariKart)} / {sayi(o.fis.cariHareket)}</td></tr>
                  <tr><th className="text-muted fw-normal">Tablo / toplam satır</th><td>{o.nesneler.tablo} / {sayi(o.toplamSatir)}</td></tr>
                  <tr>
                    <th className="text-muted fw-normal">Bağlı veritabanı</th>
                    <td>{o.bagliVeritabanlari.length ? o.bagliVeritabanlari.map((b) => b.db).join(", ") : "Yok"}{o.alan.fisleriAktarilacak !== null ? ` · ${o.alan.fisleriAktarilacak ? "çalışma alanı" : "resmî alan"}` : ""}</td>
                  </tr>
                </tbody>
              </Table>
            </Col>
          </Row>
          {o.eDoviz.seriler.length > 0 && (
            <>
              <h6 className="mt-3">e-Döviz serileri {o.eDoviz.logVar || calismaAlani ? "" : <span className="text-muted small fw-normal">(eski programın gönderim günlüğü boş)</span>}</h6>
              {calismaAlani && (
                <Alert variant="info" className="small py-2">
                  Bu bir <strong>çalışma alanı</strong>: e-Döviz belgeleri eşi olan resmî alandan ({o.bagliVeritabanlari.map((b) => b.db).join(", ")}) gönderilir.
                  Gönderim durumu eşin incelemesinde görünür; bu firmadan e-Döviz gönderilmez.
                </Alert>
              )}
              <Table size="sm" responsive className="small align-middle">
                <thead>
                  <tr>
                    <th>Seri</th>
                    <th className="text-end">Sıradaki no</th>
                    <th className="text-end">Belge</th>
                    <th>Son belge</th>
                    <th className="text-end">Gönderilmiş</th>
                    <th>Son gönderilen</th>
                    <th className="text-end">Gönderilmemiş</th>
                    <th>Tarih aralığı</th>
                  </tr>
                </thead>
                <tbody>
                  {o.eDoviz.seriler.map((x) => (
                    <tr key={x.seri}>
                      <td>{x.seri}</td>
                      <td className="text-end">{sayi(x.numaratorSiradaki)}</td>
                      <td className="text-end">{sayi(x.belgeSayisi)}</td>
                      <td>{x.sonBelge || "-"}</td>
                      <td className="text-end">{calismaAlani ? "-" : sayi(x.gonderilen)}</td>
                      <td>{calismaAlani ? "-" : x.sonGonderilen || "-"}</td>
                      <td className="text-end">{calismaAlani ? "-" : x.gonderilmeyen ? <strong>{sayi(x.gonderilmeyen)}</strong> : 0}</td>
                      <td className="text-nowrap">{!calismaAlani && x.gonderilmeyen ? `${gunYaz(x.ilkGonderilmeyenTarih)} – ${gunYaz(x.sonGonderilmeyenTarih)}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="small text-muted">
                Gönderilmiş belgeler aktarımda "Gönderildi — eski programla" işaretlenir ve yeniden gönderilemez. Gönderilmemişler aynı numarayla ICE'den gönderilir.
                Son gönderilen numaraları eski entegratörün portalıyla karşılaştırın.
              </div>
            </>
          )}
          {s.plan && (
            <div className="small mt-3">
              <strong>Aktarım planı:</strong> {s.plan.kopyalanacak} tablo kopyalanacak
              {s.plan.sablonTemizlenecek.length ? `; şablondan temizlenecek: ${s.plan.sablonTemizlenecek.join(", ")}` : ""}.
              {s.plan.kurallar.length > 0 && (
                <ul className="mb-0 mt-1">
                  {s.plan.kurallar.map((k, i) => (
                    <li key={i}>
                      {k.tablo}.{k.kolon}: {k.aciklama}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {s.firmaDolu && (s.firmaDolu.fis > 0 || s.firmaDolu.sarrafFisi > 0) && (
            <Alert variant="warning" className="small mt-3 mb-0">
              Bu firmada şu an {sayi(s.firmaDolu.fis)} döviz fişi ve {sayi(s.firmaDolu.sarrafFisi)} sarraf fişi var. Aktarım bunları silip yedektekilerle
              değiştirir (yeniden aktarım). Aktarımdan önce firmanın yedeği otomatik alınır.
            </Alert>
          )}
        </>
      )}
    </div>
  );
};

const RaporPaneli: React.FC<{ r: AktarimRaporu }> = ({ r }) => (
  <div>
    {r.basarili ? (
      <Alert variant="success" className="py-2 small mb-2">
        Aktarım tamamlandı ({yerelZaman(r.zaman)}, @{r.yapan}): {r.aktarim?.tablolar.filter((t) => t.islem === "KOPYALA").length} tablo,{" "}
        {sayi(r.aktarim?.tablolar.reduce((x, t) => x + t.yazilan, 0))} satır, {Math.round((r.aktarim?.sureMs || 0) / 1000)} sn.
        {r.dogrulama?.basarili ? " Doğrulama: kaynakla birebir aynı." : ""}
      </Alert>
    ) : (
      <Alert variant="danger" className="py-2 small mb-2">
        Aktarım yapılmadı, firma veritabanı değişmedi: {r.hata}
      </Alert>
    )}
    <EngelListesi engeller={r.engeller} />
    {r.aktarim && (
      <ul className="small mb-2">
        {r.aktarim.notlar.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
        {r.aktarim.korunanKullanicilar.length > 0 && <li>Firma açılışındaki kullanıcı korundu: {r.aktarim.korunanKullanicilar.join(", ")}</li>}
        {r.kullaniciEslemesi > 0 && <li>{r.kullaniciEslemesi} merkez kullanıcısının firma bağlantısı güncellendi.</li>}
        {r.aktarim.onYedek && <li>Aktarım öncesi yedek: {r.aktarim.onYedek}</li>}
      </ul>
    )}
    {r.basarili && r.cift?.rol === "CALISMA" && (
      <Alert variant="info" className="small py-2">
        Bu firma çiftin <strong>çalışma</strong> tarafı: e-Döviz yalnız eşi <strong>{r.cift.esHedefDb}</strong> firmasından gönderilir. Bu firmaya e-Belge (ICE) ayarı
        girmeyin; e-Belge menüsünü Modüller sekmesinden gizleyebilirsiniz.
      </Alert>
    )}
    {r.basarili && (
      <div className="small text-muted mb-2">
        Sonraki adım: Kullanıcılar sekmesinden "İçe Aktar" ile eski programın kullanıcılarını merkeze alın (eski şifreleriyle girebilirler; isterseniz geçici şifre verin).
      </div>
    )}
    {r.dogrulama && <DogrulamaPaneli rapor={r.dogrulama} baslik="Aktarım doğrulaması" />}
  </div>
);

const FirmaVeriAktar: React.FC<{ firma: FirmaDto }> = ({ firma }) => {
  const firmaId = firma.firmaId;
  const [liste, setListe] = useState<YuklemeBilgisi[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [surukle, setSurukle] = useState(false);
  const [yukleme, setYukleme] = useState<{ ad: string; yuklenen: number; toplam: number } | null>(null);
  const iptal = useRef<{ iptal: boolean }>({ iptal: false });
  const [is, setIs] = useState<AktarimIsi | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [rapor, setRapor] = useState<{ inceleme: IncelemeSonucu | null; rapor: AktarimRaporu | null; dogrulama: DogrulamaRaporu | null } | null>(null);
  const [aktarModal, setAktarModal] = useState(false);
  const [onay, setOnay] = useState("");
  const [esFirmaId, setEsFirmaId] = useState<number | "">("");
  const [rol, setRol] = useState<CiftRolu | "">("");
  const [eskiKapandi, setEskiKapandi] = useState(false);
  const [taslakOnay, setTaslakOnay] = useState(false);
  const [firmaOnay, setFirmaOnay] = useState(false);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);

  const listele = useCallback(async () => {
    try {
      setListe(await aktarimApi.yuklemeler(firmaId));
    } catch (err: any) {
      setHata(err?.message || "Yüklemeler getirilemedi.");
    }
  }, [firmaId]);

  const raporAc = useCallback(
    async (yuklemeId: string) => {
      setSecili(yuklemeId);
      try {
        setRapor(await aktarimApi.rapor(firmaId, yuklemeId));
      } catch (err: any) {
        setHata(err?.message || "Rapor getirilemedi.");
      }
    },
    [firmaId]
  );

  useEffect(() => {
    listele();
  }, [listele]);

  // Çalışan işi izle
  useEffect(() => {
    if (!is || is.durum !== "CALISIYOR") return;
    const t = setTimeout(async () => {
      try {
        const yeni = await aktarimApi.isDurumu(firmaId, is.isId);
        setIs(yeni);
        if (yeni.durum !== "CALISIYOR") {
          await listele();
          await raporAc(yeni.yuklemeId);
          if (yeni.durum === "HATA" && yeni.tur !== "AKTAR") setHata(yeni.hata);
        }
      } catch (err: any) {
        setHata(err?.message || "İş durumu alınamadı.");
        setIs(null);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [is, firmaId, listele, raporAc]);

  const dosyaYukle = async (dosya: File | undefined) => {
    if (!dosya) return;
    setHata(null);
    const u = dosya.name.toLowerCase();
    if (!u.endsWith(".bak") && !u.endsWith(".zip")) return setHata("Yalnız .bak (SQL Server yedeği) ya da içinde .bak olan .zip yüklenebilir.");
    iptal.current = { iptal: false };
    setYukleme({ ad: dosya.name, yuklenen: 0, toplam: dosya.size });
    try {
      const b = await aktarimApi.yedekYukle(firmaId, dosya, (yuklenen, toplam) => setYukleme({ ad: dosya.name, yuklenen, toplam }), iptal.current);
      await listele();
      // Yükleme biter bitmez inceleme başlar
      setIs(await aktarimApi.incele(firmaId, b.yuklemeId));
      setSecili(b.yuklemeId);
      setRapor(null);
    } catch (err: any) {
      setHata(err?.message || "Yükleme yapılamadı.");
      await listele();
    } finally {
      setYukleme(null);
    }
  };

  const isBaslat = async (yuklemeId: string, f: () => Promise<AktarimIsi>) => {
    setHata(null);
    setSecili(yuklemeId);
    try {
      setIs(await f());
    } catch (err: any) {
      setHata(err?.message || "İş başlatılamadı.");
    }
  };

  const aktarModalAc = () => {
    const ins = rapor?.inceleme;
    setOnay("");
    setEskiKapandi(false);
    setTaslakOnay(false);
    setFirmaOnay(false);
    setEsFirmaId(ins?.esAdaylari.length === 1 ? ins.esAdaylari[0].firmaId : "");
    setRol(ins?.onerilenRol || "");
    setAktarModal(true);
  };

  const aktarBaslat = async () => {
    if (!secili) return;
    setAktarModal(false);
    await isBaslat(secili, () =>
      aktarimApi.aktar(firmaId, secili, { onay, esFirmaId: esFirmaId === "" ? null : esFirmaId, rol: esFirmaId === "" || rol === "" ? null : rol, taslakOnay, firmaOnay })
    );
  };

  const calisiyor = !!is && is.durum === "CALISIYOR";
  const ins = rapor?.inceleme;
  // Taslak kural engeli (sarraf fişi, K8) pencerede ayrı onayla aşılır; diğer engeller aktarımı kapatır
  const taslakVar = (ins?.engeller || []).some((e) => e.kod === "TASLAK_KURAL");
  // Yanlış firmaya yedek şüphesi: pencerede ayrı onayla geçilir
  const yanlisFirma = (ins?.engeller || []).filter((e) => e.kod === "YANLIS_FIRMA");
  const ONAYLI_ENGELLER = ["TASLAK_KURAL", "YANLIS_FIRMA"];
  const aktarilabilir = !!ins?.ozet?.eskiProgram && !(ins?.engeller || []).some((e) => e.seviye === "ENGEL" && !ONAYLI_ENGELLER.includes(e.kod));
  const bagli = (ins?.ozet?.bagliVeritabanlari.length || 0) > 0;

  return (
    <div>
      <div className="text-muted small mb-3">
        Eski programın SQL Server yedeğini (.bak ya da içinde .bak olan .zip, en çok 5 GB) yükleyin. Yedek incelenir, sonra firma kodunu yazarak bu firmanın
        veritabanına aktarırsınız. Aktarım tek işlemde yapılır ve bitmeden önce kaynakla satır satır karşılaştırılır; tek fark varsa hiçbir şey yazılmaz.
        Geçiş günü: eski programı kapatın, e-Döviz gönderimini durdurun, son yedeği alıp yükleyin.
      </div>
      {hata && (
        <Alert variant="danger" dismissible onClose={() => setHata(null)} className="small">
          {hata}
        </Alert>
      )}

      <div
        data-test="aktarim-birakma-alani"
        className={`border rounded-3 p-4 text-center mb-3 ${surukle ? "border-primary bg-light" : "border-secondary-subtle"}`}
        style={{ borderStyle: "dashed", borderWidth: 2 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!yukleme && !calisiyor) setSurukle(true);
        }}
        onDragLeave={() => setSurukle(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurukle(false);
          if (!yukleme && !calisiyor) dosyaYukle(e.dataTransfer.files?.[0]);
        }}
      >
        {yukleme ? (
          <div>
            <div className="small mb-2">
              {yukleme.ad} yükleniyor: {boyutYaz(yukleme.yuklenen)} / {boyutYaz(yukleme.toplam)}
            </div>
            <ProgressBar now={yukleme.toplam ? (yukleme.yuklenen / yukleme.toplam) * 100 : 0} animated label={`${Math.floor(yukleme.toplam ? (yukleme.yuklenen / yukleme.toplam) * 100 : 0)}%`} />
            <Button size="sm" variant="link" className="mt-1" onClick={() => (iptal.current.iptal = true)}>
              İptal
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-2">Yedek dosyasını buraya sürükleyip bırakın</div>
            <Button size="sm" className="btn-adm" disabled={calisiyor} onClick={() => dosyaGirdisi.current?.click()}>
              Dosya Seç
            </Button>
            <input
              ref={dosyaGirdisi}
              type="file"
              accept=".bak,.zip"
              className="d-none"
              data-test="aktarim-dosya"
              onChange={(e) => {
                dosyaYukle(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {is && (
        <Alert variant={is.durum === "HATA" ? "danger" : is.durum === "BITTI" ? "success" : "info"} className="small py-2">
          <div className="d-flex justify-content-between">
            <span>
              {is.tur === "INCELE" ? "İnceleme" : is.tur === "AKTAR" ? "Aktarım" : "Doğrulama"}: {is.durum === "HATA" ? is.hata : is.mesaj}
            </span>
            {calisiyor && <Spinner animation="border" size="sm" />}
          </div>
          {calisiyor && <ProgressBar now={is.yuzde} className="mt-2" style={{ height: 6 }} />}
        </Alert>
      )}

      {liste === null ? (
        <Spinner animation="border" size="sm" />
      ) : liste.length === 0 ? (
        <div className="text-muted small">Henüz yükleme yok. Yüklemeler 7 gün tutulur.</div>
      ) : (
        <Table size="sm" responsive className="align-middle small">
          <thead>
            <tr>
              <th>Dosya</th>
              <th>Boyut</th>
              <th>Yüklenme</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((b) => (
              <tr key={b.yuklemeId} className={secili === b.yuklemeId ? "table-active" : ""}>
                <td>{b.dosyaAdi}</td>
                <td className="text-nowrap">{boyutYaz(b.yedekBoyutu ?? b.boyut)}</td>
                <td className="text-nowrap">{yerelZaman(b.bitis || b.baslangic)}</td>
                <td>
                  {b.durum === "HATA" ? (
                    <Badge bg="danger" title={b.hata || ""}>Hatalı</Badge>
                  ) : b.durum === "YUKLENIYOR" ? (
                    <Badge bg="secondary">Yarım</Badge>
                  ) : (
                    <>
                      {b.incelendi && <Badge bg="light" text="dark" className="me-1">İncelendi</Badge>}
                      {b.aktarildi === true && <Badge bg="success" className="me-1">Aktarıldı</Badge>}
                      {b.aktarildi === false && <Badge bg="danger" className="me-1">Aktarılamadı</Badge>}
                      {b.dogrulandi === true && <Badge bg="success">Doğrulandı</Badge>}
                      {b.dogrulandi === false && <Badge bg="danger">Doğrulama farkı</Badge>}
                    </>
                  )}
                </td>
                <td className="text-end text-nowrap">
                  {b.durum === "HAZIR" && (
                    <>
                      <Button size="sm" variant="outline-secondary" className="me-1" disabled={calisiyor} onClick={() => isBaslat(b.yuklemeId, () => aktarimApi.incele(firmaId, b.yuklemeId))}>
                        İncele
                      </Button>
                      <Button size="sm" variant="outline-secondary" className="me-1" disabled={calisiyor || !b.incelendi} onClick={() => raporAc(b.yuklemeId)}>
                        Sonuç
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        disabled={calisiyor || !b.aktarildi}
                        title="Yedek ile firma veritabanını yeniden karşılaştırır (aktarımdan hemen sonra anlamlıdır)"
                        onClick={() => isBaslat(b.yuklemeId, () => aktarimApi.dogrula(firmaId, b.yuklemeId))}
                      >
                        Doğrula
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={calisiyor}
                    onClick={async () => {
                      if (!window.confirm(`${b.dosyaAdi} yüklemesi silinsin mi? (Firma veritabanına dokunulmaz.)`)) return;
                      try {
                        await aktarimApi.yuklemeSil(firmaId, b.yuklemeId);
                        if (secili === b.yuklemeId) {
                          setSecili(null);
                          setRapor(null);
                        }
                        await listele();
                      } catch (err: any) {
                        setHata(err?.message || "Silinemedi.");
                      }
                    }}
                  >
                    Sil
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {secili && rapor && (
        <div className="border rounded-3 p-3 mt-3" data-test="aktarim-sonuc">
          {rapor.inceleme ? (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">İnceleme</h6>
                <Button size="sm" className="btn-adm" disabled={calisiyor || !aktarilabilir} onClick={aktarModalAc}>
                  {rapor.rapor?.basarili ? "Yeniden Aktar" : "Aktar"}
                </Button>
              </div>
              <IncelemePaneli s={rapor.inceleme} />
            </>
          ) : (
            <div className="text-muted small">Bu yükleme henüz incelenmedi.</div>
          )}
          {rapor.rapor && (
            <>
              <hr />
              <h6>Aktarım</h6>
              <RaporPaneli r={rapor.rapor} />
            </>
          )}
          {rapor.dogrulama && (
            <>
              <hr />
              <DogrulamaPaneli rapor={rapor.dogrulama} baslik="Sonradan doğrulama" />
            </>
          )}
        </div>
      )}

      <Modal show={aktarModal} onHide={() => setAktarModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{firma.unvan}: veri aktarımı</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <p>
            Yedek, <strong>{firma.dbName}</strong> veritabanına aktarılacak. Bu firmadaki mevcut fiş ve tanımlar yedektekilerle değişir; aktarımdan önce firmanın yedeği
            alınır ve firmadaki açık oturumlar kapatılır.
          </p>
          {bagli && (
            <div className="border rounded p-2 mb-3">
              <div className="mb-2">
                Bu veritabanı eski programda <strong>{ins?.ozet?.bagliVeritabanlari.map((b) => b.db).join(", ")}</strong> ile bağlı (R/A çifti). Eşinin aktarıldığı/aktarılacağı
                firmayı seçin:
              </div>
              <Form.Select size="sm" className="mb-2" value={esFirmaId} onChange={(e) => setEsFirmaId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Çift olmadan aktar (tetikler ve eşleme kurulmaz)</option>
                {ins?.esAdaylari.map((f) => (
                  <option key={f.firmaId} value={f.firmaId}>
                    {f.firmaKodu} · {f.unvan} ({f.dbName})
                  </option>
                ))}
              </Form.Select>
              {esFirmaId !== "" && (
                <Form.Select size="sm" value={rol} onChange={(e) => setRol(e.target.value as CiftRolu | "")}>
                  <option value="">Rol: yedekten bul</option>
                  {(["RESMI", "CALISMA"] as CiftRolu[]).map((r) => (
                    <option key={r} value={r}>
                      {ROL_ADI[r]}
                      {ins?.onerilenRol === r ? " — önerilen" : ""}
                    </option>
                  ))}
                </Form.Select>
              )}
              {!ins?.esAdaylari.length && <div className="text-danger mt-1">Aynı müşteri numarasında eş firma yok; önce eş firmayı açın.</div>}
            </div>
          )}
          {yanlisFirma.length > 0 && (
            <Alert variant="danger" className="py-2">
              <strong>Bu yedek bu firmaya ait görünmüyor:</strong>
              <ul className="mb-1 mt-1">
                {yanlisFirma.map((e, i) => (
                  <li key={i}>{e.mesaj}</li>
                ))}
              </ul>
              <Form.Check id="firmaOnay" label="Yedeğin bu firmaya ait olduğunu kontrol ettim" checked={firmaOnay} onChange={(e) => setFirmaOnay(e.target.checked)} />
            </Alert>
          )}
          {taslakVar && (
            <Alert variant="warning" className="py-2">
              Sarraf fişleri eski sürümden <strong>taslak kurallarla</strong> çevrilir (gerçek kuyumcu verisiyle henüz doğrulanmadı). Önce bir deneme firmasına
              aktarıp fişleri eski programla karşılaştırın.
              <Form.Check id="taslakOnay" className="mt-2" label="Deneme aktarımını kontrol ettim, taslak kuralları onaylıyorum" checked={taslakOnay} onChange={(e) => setTaslakOnay(e.target.checked)} />
            </Alert>
          )}
          <Form.Check
            id="eskiKapandi"
            className="mb-2"
            label="Eski program kapatıldı ve e-Döviz gönderimi durduruldu (bu yedekten sonra kayıt girilmedi)"
            checked={eskiKapandi}
            onChange={(e) => setEskiKapandi(e.target.checked)}
          />
          <Form.Group controlId="aktarOnay">
            <Form.Label>
              Onaylamak için firma kodunu yazın: <strong>{firma.firmaKodu}</strong>
            </Form.Label>
            <Form.Control size="sm" autoComplete="off" value={onay} onChange={(e) => setOnay(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setAktarModal(false)}>
            Vazgeç
          </Button>
          <Button className="btn-adm" disabled={!eskiKapandi || (taslakVar && !taslakOnay) || (yanlisFirma.length > 0 && !firmaOnay) || onay.trim().toUpperCase() !== firma.firmaKodu.toUpperCase()} onClick={aktarBaslat}>
            Aktar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FirmaVeriAktar;
