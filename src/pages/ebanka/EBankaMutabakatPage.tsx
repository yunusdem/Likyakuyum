import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconCheck, IconEdit, IconFileInvoice, IconLink, IconListCheck, IconReceipt, IconSearch, IconUnlink, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaService, MutabakatDurumu, MutabakatFisi, MutabakatListesi, MutabakatSatiri } from "../../services/ebankaService";
import { bugun, CariSecModal, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";
import { useUrunOzellikleri } from "../../hooks/useUrunOzellikleri";
import { fisDuzenlemeAdresi, fisKesimAdresi } from "./useEBankaFisKesimi";
import { useAuth } from "../../context/AuthContext";
import { kuyumLisansiMi } from "../../config/kullaniciGorunum";
import { ebelgeService } from "../../services/ebelgeService";
import EBankaBelgeKes from "./EBankaBelgeKes";
import EBankaFaturaKes, { FaturaKesIsi } from "./EBankaFaturaKes";
import { TopluIslem, eslenecekAday, nedenAl, faturalanacakFisler, gerekmezIsaretlenebilir, onaylanacakCari, topluKarar, uygunSayisi } from "./ebankaToplu";

// F- e-Banka > D- e-Banka Muhasebeleştirme (docs/TAHSILAT_MUTABAKATI_YOL_HARITASI.md, docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md,
// docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md: Düzenle, e-Banka içinde Fatura kes, satır seçimi + toplu işlemler)
// Bankaya giren / çıkan her para: karşılığında fiş var mı, fişin faturası kesilmiş / gelmiş mi.
// Kuyum lisansında fiş açılmaz: hareketten doğrudan belge kesilir (gelen → satış faturası, giden → e-Gider pusulası) ve
// ekranda "fiş" yerine "belge" yazar (EF3, EF4, EF26).

type DurumGorunumu = Record<MutabakatDurumu, { ad: string; renk: string; koyu?: boolean }>;
const DURUM_GENEL: DurumGorunumu = {
  faturalandi: { ad: "Faturalandı", renk: "success" },
  faturasiz: { ad: "Fişi var, faturası yok", renk: "warning", koyu: true },
  oneri: { ad: "Eşleşme bekliyor", renk: "info", koyu: true },
  fissiz: { ad: "Fişi yok", renk: "danger" },
  gerekmez: { ad: "Fatura gerektirmez", renk: "secondary" },
  virman: { ad: "Hesaplar arası virman", renk: "light", koyu: true },
};
const DURUM_KUYUM: DurumGorunumu = {
  ...DURUM_GENEL,
  faturasiz: { ad: "Belgesi var, faturası yok", renk: "warning", koyu: true },
  fissiz: { ad: "Belge kesilmedi", renk: "danger" },
};

const BELGE_TURU: Record<string, string> = { EFatura: "e-Fatura", EArsiv: "e-Arşiv", EGider: "e-Gider pusulası" };

const FIS_TURU: Record<string, string> = { doviz: "Döviz fişi", sarraf: "Sarraf fişi", perakende: "Perakende" };

const gunYaz = (g: string | null) => (g ? g.slice(0, 10).split("-").reverse().join(".") : "-");

const TOPLU_ADI: Record<TopluIslem, string> = { esle: "Eşle", faturalandir: "Faturalandır", cari: "Cari onayla", gerekmez: "Fatura gerektirmez" };

/** Fişi olmayan paradan kesilebilecek fişler; perakende faturası yalnız satış (gelen para) için. */
const KESILECEK_FISLER: { ad: string; yol: string; yalnizGelen?: boolean; ozellik: "doviz" | "sarraf" | "perakende" }[] = [
  { ad: "Döviz fişi", yol: "/vezne/doviz-fisi-kayit", ozellik: "doviz" },
  { ad: "Sarraf fişi", yol: "/vezne/sarraf-fisi-kayit", ozellik: "sarraf" },
  { ad: "Perakende fişi", yol: "/vezne/perakende-fisi-kayit", yalnizGelen: true, ozellik: "perakende" },
];

export const EBankaMutabakatPage: React.FC = () => {
  const navigate = useNavigate();
  // Lisansta olmayan fiş türü için "Fiş kes" düğmesi çizilmez
  const ozellik = useUrunOzellikleri();
  const { user } = useAuth();
  const kuyum = kuyumLisansiMi(user);
  const DURUM = kuyum ? DURUM_KUYUM : DURUM_GENEL;
  /** Kuyum'da ekranda "fiş" yerine "belge" (EF3) */
  const fisKelimesi = kuyum ? "belge" : "fiş";
  const fisTuruAdi: Record<string, string> = kuyum ? { doviz: "Döviz", sarraf: "Sarraf", perakende: "Perakende" } : FIS_TURU;
  const [goruntu, setGoruntu] = useState<{ baslik: string; url: string; html: string | null } | null>(null);
  const belgeGoster = async (b: { uuid: string; belgeNo: string; belgeTuru: string }) => {
    try {
      const g = b.belgeTuru === "EGider" ? { url: await ebelgeService.giderPdf(b.uuid), html: null } : await ebelgeService.getGidenOnizleme(b.uuid);
      setGoruntu({ baslik: `${BELGE_TURU[b.belgeTuru] || b.belgeTuru} ${b.belgeNo}`, ...g });
    } catch (err: any) {
      bildir("danger", err?.message || "Belge görüntüsü alınamadı.");
    }
  };
  // Fiş ekranından dönüşte aynı tarih aralığı ve aynı hareket açılır
  const [searchParams] = useSearchParams();
  const tarihParam = (ad: string) => (/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get(ad) || "") ? (searchParams.get(ad) as string) : bugun());
  const [baslangic, setBaslangic] = useState(() => tarihParam("baslangic"));
  const [bitis, setBitis] = useState(() => tarihParam("bitis"));
  const acilacak = Number(searchParams.get("ac")) || 0;
  const [yon, setYon] = useState("");
  const [durumSuzgeci, setDurumSuzgeci] = useState<"" | MutabakatDurumu | "farkli">("");
  const [veri, setVeri] = useState<MutabakatListesi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [secili, setSecili] = useState<MutabakatSatiri | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [gerekmezNotu, setGerekmezNotu] = useState("");
  const [cariSec, setCariSec] = useState(false);
  const { bildir, bildirimKutusu } = useBildirim();
  // e-Banka içinde fatura kesme penceresi: tek fiş ya da seçili hareketlerin fişleri (M8, M9)
  const [faturaIsleri, setFaturaIsleri] = useState<{ isler: FaturaKesIsi[]; atlananlar: { ad: string; neden: string }[] } | null>(null);
  // Seçili hareketler (vomsisId) ve toplu işlem sonucu (M9)
  const [secim, setSecim] = useState<Set<number>>(new Set());
  const [topluSonuc, setTopluSonuc] = useState<{ baslik: string; satirlar: { ad: string; sonuc: "Tamam" | "Atlandı" | "Hata"; mesaj: string }[] } | null>(null);

  const listele = useCallback(async () => {
    if (baslangic > bitis) return bildir("warning", "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    setYukleniyor(true);
    try {
      const v = await EBankaService.getMutabakat({ baslangic, bitis, yon });
      setVeri(v);
      // Seçim yalnız listede kalan hareketler için korunur
      setSecim((o) => new Set(v.satirlar.filter((x) => o.has(x.vomsisId)).map((x) => x.vomsisId)));
      // Açık detay penceresi güncel veriyle yenilensin
      setSecili((s) => (s ? v.satirlar.find((x) => x.vomsisId === s.vomsisId) || null : null));
      return v;
    } catch (err: any) {
      bildir("danger", err?.message || "Mutabakat listelenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, yon, bildir]);

  // Açılışta bugünün listesi kendiliğinden gelir; sonraki listelemeler "Listele" ile
  useEffect(() => {
    listele().then((v) => {
      const s = acilacak && v ? v.satirlar.find((x) => x.vomsisId === acilacak) : null;
      if (s) detayAc(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const satirlar = useMemo(
    () => (veri?.satirlar || []).filter((s) => !durumSuzgeci || (durumSuzgeci === "farkli" ? s.fark !== null && s.fark !== 0 : s.durum === durumSuzgeci)),
    [veri, durumSuzgeci]
  );

  const islem = async (is: () => Promise<void>, mesaj: string) => {
    setCalisiyor(true);
    try {
      await is();
      bildir("success", mesaj);
      await listele();
    } catch (err: any) {
      bildir("danger", err?.message || "İşlem yapılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  // ─── Toplu işlemler (M9) ───────────────────────────────────────────────────
  const seciliSatirlar = useMemo(() => (veri?.satirlar || []).filter((x) => secim.has(x.vomsisId)), [veri, secim]);
  const gorunenSecili = satirlar.length > 0 && satirlar.every((x) => secim.has(x.vomsisId));
  const satirAdi = (x: MutabakatSatiri) => `${zamanYaz(x.tarih)} · ${x.karsiTaraf || x.cari?.ad || "-"} · ${x.yon === "giden" ? "-" : "+"}${paraYaz(x.tutar)}`;
  const secimDegistir = (vomsisId: number, secili: boolean) =>
    setSecim((o) => {
      const y = new Set(o);
      if (secili) y.add(vomsisId);
      else y.delete(vomsisId);
      return y;
    });
  const tumunuSec = (secili: boolean) =>
    setSecim((o) => {
      const y = new Set(o);
      for (const x of satirlar) {
        if (secili) y.add(x.vomsisId);
        else y.delete(x.vomsisId);
      }
      return y;
    });

  const topluCalistir = async (tur: TopluIslem) => {
    const secili = seciliSatirlar;
    if (!secili.length) return;
    if (tur === "faturalandir") {
      const isler: FaturaKesIsi[] = [];
      const atlananlar: { ad: string; neden: string }[] = [];
      for (const x of secili) {
        const k = faturalanacakFisler(x);
        if (k.tamam) k.deger.forEach((f) => isler.push({ vomsisId: x.vomsisId, fis: f }));
        // Kuyum'da fişsiz hareketin belgesi pencereden kesilir (altın ve gram seçilir)
        else atlananlar.push({ ad: satirAdi(x), neden: kuyum && nedenAl(k) === "Eşli fiş yok" ? "Belge, hareket penceresinden kesilir (altın / gram seçimi gerekir)" : nedenAl(k) });
      }
      if (!isler.length) return bildir("warning", `Seçili hareketlerde faturası kesilecek eşli ${fisKelimesi} yok.`);
      setFaturaIsleri({ isler, atlananlar });
      return;
    }
    const uygun = uygunSayisi(tur, secili);
    if (!uygun) return bildir("warning", `Seçili hareketlerin hiçbiri "${TOPLU_ADI[tur]}" için uygun değil.`);
    const atlanacak = secili.length - uygun;
    const onayMetni = `${uygun} harekete "${TOPLU_ADI[tur]}" uygulanacak${atlanacak ? ` (${atlanacak} hareket uygun değil, atlanır)` : ""}.`;
    let not = "";
    if (tur === "gerekmez") {
      const cevap = window.prompt(`${onayMetni}\n\nNot (isteğe bağlı; kapora, avans, borç tahsilatı gibi):`, "");
      if (cevap === null) return;
      not = cevap.trim().slice(0, 250);
    } else if (!window.confirm(`${onayMetni} Devam edilsin mi?`)) return;
    setCalisiyor(true);
    const sonuc: { ad: string; sonuc: "Tamam" | "Atlandı" | "Hata"; mesaj: string }[] = [];
    for (const x of secili) {
      const ad = satirAdi(x);
      const karar = topluKarar(tur, x);
      if (!karar.tamam) {
        sonuc.push({ ad, sonuc: "Atlandı", mesaj: nedenAl(karar) });
        continue;
      }
      try {
        if (tur === "esle") {
          const k = eslenecekAday(x);
          if (!k.tamam) continue;
          await EBankaService.mutabakatEsle(x.vomsisId, k.deger.fisTuru, k.deger.fisId);
          sonuc.push({ ad, sonuc: "Tamam", mesaj: `${fisTuruAdi[k.deger.fisTuru]} ${k.deger.fisNo || `#${k.deger.fisId}`} eşlendi` });
        } else if (tur === "cari") {
          const k = onaylanacakCari(x);
          if (!k.tamam) continue;
          await EBankaService.mutabakatCariOnayla(x.vomsisId, k.deger);
          sonuc.push({ ad, sonuc: "Tamam", mesaj: `Cari onaylandı: ${x.oneriCari?.ad || ""}` });
        } else if (tur === "gerekmez" && gerekmezIsaretlenebilir(x).tamam) {
          await EBankaService.mutabakatFaturaGerekmez(x.vomsisId, true, not || undefined);
          sonuc.push({ ad, sonuc: "Tamam", mesaj: "Fatura gerektirmez olarak işaretlendi" });
        }
      } catch (err: any) {
        sonuc.push({ ad, sonuc: "Hata", mesaj: err?.message || "İşlem yapılamadı." });
      }
    }
    setCalisiyor(false);
    setTopluSonuc({ baslik: `Toplu işlem — ${TOPLU_ADI[tur]}`, satirlar: sonuc });
    await listele();
  };

  const detayAc = (s: MutabakatSatiri) => {
    setSecili(s);
    setGerekmezNotu(s.not || "");
  };

  /** Eşli fişin düzeltme ekranı: kaydedince bu harekete dönülür (M6) */
  const fisDuzenle = (s: MutabakatSatiri, f: MutabakatFisi) =>
    navigate(fisDuzenlemeAdresi(f.fisTuru, f.fisId, {
      vomsisId: s.vomsisId, tip: s.yon === "gelen" ? 1 : 0, tutar: s.tutar, paraKodu: s.doviz || "TL", tutarTl: s.tlKarsilik, baslangic, bitis,
    }));

  const fisSatiri = (s: MutabakatSatiri, f: MutabakatFisi, eslenmis: boolean) => {
    return (
      <tr key={`${f.fisTuru}-${f.fisId}`}>
        <td className="text-nowrap">{fisTuruAdi[f.fisTuru]}</td>
        <td className="font-monospace">{f.fisNo || `#${f.fisId}`}</td>
        <td className="font-monospace text-nowrap">{gunYaz(f.tarih)}</td>
        <td>{f.cariAdi || "-"}</td>
        <td className="text-end font-monospace text-nowrap">
          {paraYaz(f.tutar)}
          {Math.abs(f.fisToplami - f.tutar) >= 0.01 && <div className="text-muted small">{fisKelimesi} toplamı {paraYaz(f.fisToplami)}</div>}
        </td>
        {!eslenmis && (
          <td className={`text-end font-monospace text-nowrap ${f.uyum === "tam" ? "text-success" : f.uyum === "yakin" ? "text-warning-emphasis fw-bold" : "text-danger"}`}>
            {f.fark === undefined ? "-" : f.uyum === "tam" ? "Tutuyor" : paraYaz(f.fark)}
            {f.uyum === "yakin" && <div className="small fw-normal">±%1 içinde</div>}
          </td>
        )}
        <td>
          {f.faturali ? (
            <Badge bg="success">{f.faturaBilgisi || "Faturalı"}</Badge>
          ) : (
            <Badge bg="warning" text="dark">
              {f.yon === "giden" && f.fisTuru !== "perakende" ? "Gelen fatura yok" : "Faturası yok"}
            </Badge>
          )}
          {eslenmis && f.otomatik && <div className="text-muted small">otomatik eşlendi</div>}
          {!eslenmis && f.baskaHarekette && <div className="text-muted small">başka bir banka hareketine de eşli</div>}
        </td>
        <td className="text-end text-nowrap">
          {eslenmis ? (
            <>
              <Button size="sm" variant="outline-secondary" className="py-0 me-1" disabled={calisiyor} title={`${kuyum ? "Belgeyi" : "Fişi"} düzeltme ekranında aç; kaydedince buraya dönülür`}
                onClick={() => fisDuzenle(s, f)}>
                <IconEdit size={14} className="me-1" />
                Düzenle
              </Button>
              {/* Eşli fişte faturası yoksa her zaman (gelen / giden); perakende faturası kendi ekranında (M7, M8) */}
              {!f.faturali && f.fisTuru !== "perakende" && (
                <Button size="sm" variant="outline-primary" className="py-0 me-1" disabled={calisiyor}
                  onClick={() => setFaturaIsleri({ isler: [{ vomsisId: s.vomsisId, fis: f }], atlananlar: [] })}>
                  <IconFileInvoice size={14} className="me-1" />
                  Fatura kes
                </Button>
              )}
              <Button size="sm" variant="light" className="border py-0 text-danger" disabled={calisiyor} title="Eşleşmeyi kaldır"
                onClick={() => islem(() => EBankaService.mutabakatEslemeKaldir(s.vomsisId, f.fisTuru, f.fisId), "Eşleşme kaldırıldı.")}>
                <IconUnlink size={14} />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline-primary" className="py-0" disabled={calisiyor}
              onClick={() => islem(() => EBankaService.mutabakatEsle(s.vomsisId, f.fisTuru, f.fisId), kuyum ? "Belge eşlendi." : "Fiş eşlendi.")}>
              <IconLink size={14} className="me-1" />
              Eşle
            </Button>
          )}
        </td>
      </tr>
    );
  };

  const o = veri?.ozet;
  return (
    <div className="ebanka-mutabakat-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="D- e-Banka Muhasebeleştirme"
        onRefresh={listele}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor || calisiyor}
        modeText={`${o?.toplam ?? 0} banka hareketi`}
      />
      {bildirimKutusu}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              listele();
            }}
          >
            <Row className="g-2 align-items-end">
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Başlangıç</Form.Label>
                <Form.Control type="date" size="sm" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
              </Col>
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Bitiş</Form.Label>
                <Form.Control type="date" size="sm" value={bitis} onChange={(e) => setBitis(e.target.value)} />
              </Col>
              <Col xl={2} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Para</Form.Label>
                <Form.Select size="sm" value={yon} onChange={(e) => setYon(e.target.value)}>
                  <option value="">Gelen ve giden</option>
                  <option value="gelen">Gelen (tahsilat)</option>
                  <option value="giden">Giden (ödeme)</option>
                </Form.Select>
              </Col>
              <Col xl={3} md={3} xs={6}>
                <Form.Label className="small fw-bold text-secondary mb-1">Durum</Form.Label>
                <Form.Select size="sm" value={durumSuzgeci} onChange={(e) => setDurumSuzgeci(e.target.value as typeof durumSuzgeci)}>
                  <option value="">Tümü</option>
                  {(Object.keys(DURUM) as MutabakatDurumu[]).map((d) => (
                    <option key={d} value={d}>
                      {DURUM[d].ad} ({o?.[d] ?? 0})
                    </option>
                  ))}
                  <option value="farkli">Tutar farkı olanlar ({o?.farkli ?? 0})</option>
                </Form.Select>
              </Col>
              <Col xl={3} md={12}>
                <Button type="submit" size="sm" variant="outline-primary" className="w-100" disabled={yukleniyor}>
                  {yukleniyor ? <Spinner size="sm" className="me-1" /> : <IconSearch size={16} className="me-1" />}
                  Listele
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {o && o.toplam > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2 small">
          {(["faturalandi", "faturasiz", "oneri", "fissiz", "gerekmez"] as MutabakatDurumu[]).map((d) => (
            <Badge key={d} bg={DURUM[d].renk} text={DURUM[d].koyu ? "dark" : undefined} className="px-2 py-1" style={{ cursor: "pointer" }} onClick={() => setDurumSuzgeci(d)}>
              {DURUM[d].ad}: {o[d]}
            </Badge>
          ))}
          {o.farkli > 0 && (
            <Badge bg="danger" className="px-2 py-1" style={{ cursor: "pointer" }} onClick={() => setDurumSuzgeci("farkli")}>
              Tutar farkı: {o.farkli}
            </Badge>
          )}
        </div>
      )}

      {secim.size > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 p-2 border rounded bg-light small">
          <IconListCheck size={16} className="text-secondary" />
          <span className="fw-bold">{secim.size} hareket seçili</span>
          {(["esle", "faturalandir", "cari", "gerekmez"] as TopluIslem[]).map((t) => {
            const n = uygunSayisi(t, seciliSatirlar);
            return (
              <Button key={t} size="sm" variant={t === "faturalandir" ? "primary" : "outline-primary"} className="py-0" disabled={calisiyor || !n}
                title={n ? `${n} hareket uygun` : "Seçili hareketlerin hiçbiri uygun değil"} onClick={() => topluCalistir(t)}>
                {TOPLU_ADI[t]} ({n})
              </Button>
            );
          })}
          <Button size="sm" variant="link" className="py-0 ms-auto" disabled={calisiyor} onClick={() => setSecim(new Set())}>
            Seçimi kaldır
          </Button>
        </div>
      )}

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 28 }}>
                  <Form.Check aria-label="Görünen hareketlerin tümünü seç" checked={gorunenSecili} disabled={!satirlar.length || calisiyor}
                    title="Görünen hareketlerin tümünü seç / bırak" onChange={(e) => tumunuSec(e.target.checked)} />
                </th>
                <th>Tarih</th>
                <th>Hesap</th>
                <th>Karşı Taraf / Cari</th>
                <th>Açıklama</th>
                <th className="text-end">Tutar</th>
                <th>Durum</th>
                <th>{kuyum ? "Belge" : "Fiş"}</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.vomsisId} style={{ cursor: "pointer" }} className={secim.has(s.vomsisId) ? "table-active" : undefined} onClick={() => detayAc(s)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Form.Check aria-label="Hareketi seç" checked={secim.has(s.vomsisId)} disabled={calisiyor} onChange={(e) => secimDegistir(s.vomsisId, e.target.checked)} />
                  </td>
                  <td className="font-monospace text-nowrap">{zamanYaz(s.tarih)}</td>
                  <td className="text-nowrap">
                    {s.bankaAdi} {s.doviz}
                  </td>
                  <td>
                    {s.karsiTaraf || "-"}
                    {s.cari && <div className="text-muted">{s.cari.ad}</div>}
                    {!s.cari && s.oneriCari && <div className="text-info-emphasis fst-italic">Önerilen: {s.oneriCari.ad}</div>}
                  </td>
                  <td className="text-truncate" style={{ maxWidth: "260px" }} title={s.aciklama || ""}>
                    {s.aciklama || ""}
                  </td>
                  <td className={`text-end font-monospace fw-bold text-nowrap ${s.yon === "giden" ? "text-danger" : "text-success"}`}>
                    {s.yon === "giden" ? "-" : "+"}
                    {paraYaz(s.tutar)}
                  </td>
                  <td>
                    <Badge bg={DURUM[s.durum].renk} text={DURUM[s.durum].koyu ? "dark" : undefined} className={s.durum === "virman" ? "border" : undefined}>
                      {DURUM[s.durum].ad}
                    </Badge>
                    {s.fark !== null && s.fark !== 0 && <div className="text-danger fw-bold">Tutar farkı {paraYaz(s.fark)}</div>}
                  </td>
                  <td className="text-nowrap">
                    {(s.belgeler || []).map((b) => (
                      <div key={b.uuid}>
                        {BELGE_TURU[b.belgeTuru] || b.belgeTuru} {b.belgeNo}
                      </div>
                    ))}
                    {s.belgeler?.length
                      ? null
                      : s.fisler.length
                      ? s.fisler.map((f) => (
                          <div key={`${f.fisTuru}-${f.fisId}`}>
                            {fisTuruAdi[f.fisTuru]} {f.fisNo || `#${f.fisId}`}
                          </div>
                        ))
                      : s.adaylar.length
                        ? `${s.adaylar.length} aday`
                        : ""}
                  </td>
                </tr>
              ))}
              {satirlar.length === 0 && !yukleniyor && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-3">
                    {veri ? "Bu ölçütlere uyan banka hareketi yok." : "Tarih seçip Listele'ye basın."}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!secili} onHide={() => setSecili(null)} size="xl" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Banka Hareketi — {kuyum ? "Belge" : "Fiş"} ve Fatura</Modal.Title>
        </Modal.Header>
        {secili && (
          <Modal.Body className="small">
            <Row className="g-1 mb-3">
              <Col md={2} className="text-secondary fw-bold">Tarih</Col>
              <Col md={4} className="font-monospace">{zamanYaz(secili.tarih)}</Col>
              <Col md={2} className="text-secondary fw-bold">Tutar</Col>
              <Col md={4} className={`font-monospace fw-bold ${secili.yon === "giden" ? "text-danger" : "text-success"}`}>
                {secili.yon === "giden" ? "Giden -" : "Gelen +"}
                {paraYaz(secili.tutar)} {secili.doviz}
                {secili.kur !== null && secili.tlKarsilik !== null && (
                  <span className="text-muted fw-normal ms-2">≈ {paraYaz(secili.tlKarsilik)} TL (kur {secili.kur.toLocaleString("tr-TR", { maximumFractionDigits: 4 })})</span>
                )}
              </Col>
              <Col md={2} className="text-secondary fw-bold">Hesap</Col>
              <Col md={4}>{secili.bankaAdi} {secili.doviz} - {secili.hesapNo}</Col>
              <Col md={2} className="text-secondary fw-bold">Karşı taraf</Col>
              <Col md={4}>{secili.karsiTaraf || "-"}</Col>
              <Col md={2} className="text-secondary fw-bold">Cari</Col>
              <Col md={4}>
                {secili.cari ? (
                  <>
                    {secili.cari.ad} <span className="text-muted">({secili.cariNedeni})</span>
                    {secili.cariNedeni === "Kullanıcı onayladı" && (
                      <Button size="sm" variant="link" className="p-0 ms-2 align-baseline" disabled={calisiyor}
                        onClick={() => islem(() => EBankaService.mutabakatCariOnayla(secili.vomsisId, null), "Cari onayı kaldırıldı.")}>
                        kaldır
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="text-muted">{secili.oneriCari ? secili.cariNedeni : `Bulunamadı (${secili.cariNedeni})`}</span>
                )}
                {!secili.cari && secili.durum !== "virman" && (
                  <div className="d-flex gap-2 mt-1">
                    {secili.oneriCari && (
                      <Button size="sm" variant="outline-success" className="py-0" disabled={calisiyor}
                        onClick={() => islem(() => EBankaService.mutabakatCariOnayla(secili.vomsisId, secili.oneriCari!.cariKartId), "Cari onaylandı.")}>
                        <IconCheck size={14} className="me-1" />
                        {secili.oneriCari.ad} — Onayla
                      </Button>
                    )}
                    <Button size="sm" variant="outline-secondary" className="py-0" disabled={calisiyor} onClick={() => setCariSec(true)}>
                      Cari seç
                    </Button>
                  </div>
                )}
              </Col>
              <Col md={2} className="text-secondary fw-bold">Açıklama</Col>
              <Col md={4}>{secili.aciklama || "-"}</Col>
              <Col md={2} className="text-secondary fw-bold">Durum</Col>
              <Col md={10}>
                <Badge bg={DURUM[secili.durum].renk} text={DURUM[secili.durum].koyu ? "dark" : undefined}>{DURUM[secili.durum].ad}</Badge>
                {secili.fark !== null && secili.fark !== 0 && (
                  <span className="ms-2 text-danger fw-bold">Banka tutarı ile {fisKelimesi} tutarı arasında {paraYaz(secili.fark)} fark var.</span>
                )}
              </Col>
            </Row>

            {(secili.belgeler || []).length > 0 && (
              <>
                <div className="fw-bold text-secondary mb-1">Kesilen belgeler</div>
                <Table size="sm" className="mb-3 align-middle">
                  <tbody>
                    {(secili.belgeler || []).map((b) => (
                      <tr key={b.uuid}>
                        <td className="text-nowrap">{BELGE_TURU[b.belgeTuru] || b.belgeTuru}</td>
                        <td className="font-monospace">{b.belgeNo}</td>
                        <td className="font-monospace text-nowrap">{gunYaz(b.tarih)}</td>
                        <td className="text-end font-monospace text-nowrap">{paraYaz(b.tutar)}</td>
                        <td>
                          <Badge bg={b.durum === "GONDERILDI" ? "success" : "info"} text={b.durum === "GONDERILDI" ? undefined : "dark"}>
                            {b.durum === "GONDERILDI" ? "Gönderildi" : "Gönderim sürüyor"}
                          </Badge>
                        </td>
                        <td className="text-end text-nowrap">
                          <Button size="sm" variant="outline-primary" className="py-0 me-1" onClick={() => belgeGoster(b)}>
                            <IconFileInvoice size={14} className="me-1" />
                            Göster
                          </Button>
                          <Button size="sm" variant="light" className="border py-0 text-danger" disabled={calisiyor}
                            title="Alıcı e-Faturayı reddettiyse: belge giden kutusunda kalır, bu hareket yeniden belge kesilebilir olur"
                            onClick={() => {
                              if (window.confirm(`${b.belgeNo} bu hareketten ayrılsın mı? Belge silinmez; hareket yeniden "Belge kesilmedi" olur.`))
                                islem(() => EBankaService.belgeBagKaldir(secili.vomsisId, b.uuid), "Belgenin bağı kaldırıldı.");
                            }}>
                            <IconUnlink size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}

            {secili.fisler.length > 0 && (
              <>
                <div className="fw-bold text-secondary mb-1">Eşlenen {kuyum ? "belgeler" : "fişler"}</div>
                <Table size="sm" className="mb-3 align-middle">
                  <tbody>{secili.fisler.map((f) => fisSatiri(secili, f, true))}</tbody>
                </Table>
                {secili.fisleKarsilandi && (
                  <div className="text-muted mb-3">Banka girişi {kuyum ? "belgenin" : "fişin"} Hesap satırından sayılıyor; bu hareket için ayrıca banka fişi kesilmez (kesilmişse iptal edildi).</div>
                )}
              </>
            )}

            {secili.durum !== "virman" && secili.fisler.length === 0 && !secili.belgeler?.length && (!kuyum || secili.adaylar.length > 0) && (
              <>
                <div className="fw-bold text-secondary mb-1">Aday {kuyum ? "belgeler (kesilmiş fişler)" : "fişler"}</div>
                {secili.adaylar.length ? (
                  <>
                  {secili.adaylar.every((f) => f.uyum === "uzak") && (
                    <div className="text-muted mb-1">Tutarı tutan (±%1) {fisKelimesi} yok; carinin bu tarihlere yakın diğer {kuyum ? "belgeleri" : "fişleri"} aşağıda, elle eşleyebilirsiniz.</div>
                  )}
                  <Table size="sm" className="mb-3 align-middle">
                    <thead>
                      <tr className="text-muted">
                        <th>Tür</th>
                        <th>No</th>
                        <th>Tarih</th>
                        <th>Cari</th>
                        <th className="text-end">{kuyum ? "Belge" : "Fiş"} tutarı</th>
                        <th className="text-end">Fark</th>
                        <th>Fatura</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>{secili.adaylar.map((f) => fisSatiri(secili, f, false))}</tbody>
                  </Table>
                  </>
                ) : (
                  <Alert variant="light" className="border py-2">
                    {secili.cari
                      ? "Bu carinin bu tarihe yakın (7 gün önce – 3 gün sonra) uygun fişi yok."
                      : "Karşı taraf bir cariyle eşleşmediği için fiş aranamadı. Yukarıdan cariyi onaylayın ya da seçin."}
                  </Alert>
                )}
              </>
            )}

            {kuyum && secili.durum !== "virman" && secili.fisler.length === 0 && !secili.belgeler?.length && !secili.faturaGerekmez && (
              <EBankaBelgeKes
                key={secili.vomsisId}
                satir={secili}
                onBitti={(mesaj) => {
                  bildir("success", mesaj);
                  listele();
                }}
              />
            )}

            {!kuyum && secili.durum !== "virman" && secili.fisler.length === 0 && !secili.faturaGerekmez && (
              <div className="border rounded p-2 mb-2">
                <div className="fw-bold text-secondary mb-1">Fiş kes</div>
                <div className="text-muted mb-2">
                  Fiş ekranı {secili.cari ? "cari, " : ""}tarih, {secili.yon === "gelen" ? "satış" : "alış"} işlemi ve ödeme kısmına banka hesabı + tutar dolu açılır; ürün seçildiğinde miktar tutardan hesaplanır. Kaydedince fiş bu banka hareketiyle eşlenir.
                  {!secili.cari && " Cari bulunamadığı için fiş ekranında seçmeniz gerekir."}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {KESILECEK_FISLER.filter((k) => ozellik[k.ozellik] && (!k.yalnizGelen || secili.yon === "gelen")).map((k) => (
                    <Button key={k.yol} size="sm" variant="outline-primary"
                      onClick={() => navigate(fisKesimAdresi(k.yol, {
                        vomsisId: secili.vomsisId, cariId: secili.cari?.cariKartId ?? null, tarih: (secili.tarih || bugun()).slice(0, 10),
                        tip: secili.yon === "gelen" ? 1 : 0, tutar: secili.tutar, paraKodu: secili.doviz || "TL", baslangic, bitis,
                        bankaId: secili.bankaId, tutarTl: secili.tlKarsilik, karsiAd: secili.karsiTaraf, karsiNo: secili.karsiNo,
                      }))}>
                      <IconReceipt size={14} className="me-1" />
                      {k.ad}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {secili.durum !== "virman" && secili.fisler.length === 0 && !secili.belgeler?.length && (
              <div className="border rounded p-2 bg-light">
                <div className="fw-bold text-secondary mb-1">Fatura gerektirmez</div>
                <div className="text-muted mb-2">Kapora, avans, borç tahsilatı gibi {fisKelimesi}/fatura gerektirmeyen paralar için işaretleyin.</div>
                <div className="d-flex gap-2">
                  <Form.Control size="sm" placeholder="Not (isteğe bağlı)" maxLength={250} value={gerekmezNotu} onChange={(e) => setGerekmezNotu(e.target.value)} />
                  {secili.faturaGerekmez ? (
                    <Button size="sm" variant="outline-secondary" className="text-nowrap" disabled={calisiyor}
                      onClick={() => islem(() => EBankaService.mutabakatFaturaGerekmez(secili.vomsisId, false), "İşaret kaldırıldı.")}>
                      <IconX size={14} className="me-1" />
                      İşareti Kaldır
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="text-nowrap" disabled={calisiyor}
                      onClick={() => islem(() => EBankaService.mutabakatFaturaGerekmez(secili.vomsisId, true, gerekmezNotu), "Fatura gerektirmez olarak işaretlendi.")}>
                      <IconCheck size={14} className="me-1" />
                      Fatura Gerektirmez
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Modal.Body>
        )}
      </Modal>

      <Modal show={!!goruntu} onHide={() => {
        if (goruntu?.url) URL.revokeObjectURL(goruntu.url);
        setGoruntu(null);
      }} size="xl" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">{goruntu?.baslik}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {goruntu?.html ? (
            <iframe title="Belge" sandbox="allow-scripts" srcDoc={goruntu.html} className="w-100 border-0" style={{ height: "80vh" }} />
          ) : goruntu?.url ? (
            <iframe title="Belge" src={goruntu.url} className="w-100 border-0" style={{ height: "80vh" }} />
          ) : null}
        </Modal.Body>
      </Modal>

      <EBankaFaturaKes
        isler={faturaIsleri?.isler ?? null}
        atlananlar={faturaIsleri?.atlananlar}
        onKapat={(degisti) => {
          setFaturaIsleri(null);
          if (degisti) listele();
        }}
      />

      <Modal show={!!topluSonuc} onHide={() => setTopluSonuc(null)} size="lg" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">{topluSonuc?.baslik}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          {topluSonuc && (
            <>
              <div className="mb-2">
                {topluSonuc.satirlar.filter((x) => x.sonuc === "Tamam").length} tamam · {topluSonuc.satirlar.filter((x) => x.sonuc === "Atlandı").length} atlandı ·{" "}
                {topluSonuc.satirlar.filter((x) => x.sonuc === "Hata").length} hata
              </div>
              <Table size="sm" className="mb-0 align-middle">
                <tbody>
                  {topluSonuc.satirlar.map((x, i) => (
                    <tr key={i}>
                      <td>{x.ad}</td>
                      <td>
                        <Badge bg={x.sonuc === "Tamam" ? "success" : x.sonuc === "Hata" ? "danger" : "secondary"}>{x.sonuc}</Badge>
                      </td>
                      <td>{x.mesaj}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>

      <CariSecModal
        show={cariSec}
        ilkArama={(secili?.karsiTaraf || "").split(" ")[0]}
        onHide={() => setCariSec(false)}
        onSec={(c) => {
          setCariSec(false);
          if (secili) islem(() => EBankaService.mutabakatCariOnayla(secili.vomsisId, c.cariKartId), `Cari kaydedildi: ${c.ad}`);
        }}
      />
    </div>
  );
};

export default EBankaMutabakatPage;
