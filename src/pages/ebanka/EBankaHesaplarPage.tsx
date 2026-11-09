import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { IconCheck, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { EBankaHesap, EBankaService } from "../../services/ebankaService";
import { ibanYaz, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > B- Hesaplar: Vomsis hesabı ↔ Banka Hesap Kartı eşlemesi (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E6);
// eşleşmeyen hesaba yeni kart açma, eşleşen kartın adını değiştirme (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M22)

const ibanSade = (v: string | null | undefined) => (v || "").replace(/\s+/g, "").toUpperCase();

/** Banka adı eşleştirmesi için sade yazım: "GARANTİ BBVA" ≈ "Garanti Bankası" (ilk kelime) */
const sadeAd = (v: string | null | undefined) =>
  (v || "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").trim();

/** Satırda açık düzenleme: yeni kart (vomsisHesapId) ya da kart adı (bankaId) */
type Duzenleme = { tur: "yeni"; vomsisHesapId: number; ad: string } | { tur: "ad"; bankaId: number; vomsisHesapId: number; ad: string };

export const EBankaHesaplarPage: React.FC = () => {
  const [hesaplar, setHesaplar] = useState<EBankaHesap[]>([]);
  const [kartlar, setKartlar] = useState<BankaHesapItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydedilen, setKaydedilen] = useState<number | null>(null);
  const [duzenleme, setDuzenleme] = useState<Duzenleme | null>(null);
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

  /** Eşleşmeyen hesaba yeni Banka Hesap Kartı: kod sıradaki hesap no, IBAN / şube e-Banka'dan, banka adı tanımlardan (M22) */
  const yeniKart = async (h: EBankaHesap, ad: string) => {
    const hesapAdi = ad.trim();
    if (!hesapAdi) return bildir("warning", "Kartın adını yazın.");
    setKaydedilen(h.vomsisHesapId);
    try {
      const [hesapNo, tanimlar] = await Promise.all([BankaService.getNextHesapNo(), BankaService.getLookups().catch(() => null)]);
      const ilk = sadeAd(h.bankaAdi).split(/\s+/)[0] || "";
      const bankaAdi = ilk ? (tanimlar?.bankaAdlari || []).find((b) => sadeAd(b.ad || b.bankaAdi).startsWith(ilk)) : undefined;
      const kart = await BankaService.saveBanka({
        hesapNo, hesapAdi, iban: h.iban || null, subeAdi: h.subeAdi || null, bankaAdiId: bankaAdi?.id ?? null,
        eFaturadaGozuksun: false, devir: 0, aktif: true,
      });
      setHesaplar(await EBankaService.hesapEsle(h.vomsisHesapId, kart.bankaId));
      setKartlar(await BankaService.getBankalar());
      setDuzenleme(null);
      bildir("success", `${hesapNo} - ${hesapAdi} kartı açıldı ve hesaba bağlandı.`);
    } catch (err: any) {
      bildir("danger", err?.message || "Kart açılamadı.");
    } finally {
      setKaydedilen(null);
    }
  };

  /** Eşleşen kartın adı: kartın diğer bilgileri aynen kalır; fişlerde bu ad görünür (M22, M28) */
  const kartAdiKaydet = async (bankaId: number, vomsisHesapId: number, ad: string) => {
    const k = kartlar.find((x) => x.bankaId === bankaId);
    const hesapAdi = ad.trim();
    if (!k) return;
    if (!hesapAdi) return bildir("warning", "Kartın adını yazın.");
    setKaydedilen(vomsisHesapId);
    try {
      await BankaService.saveBanka({
        bankaId: k.bankaId, hesapNo: k.hesapNo, hesapAdi, iban: k.iban ?? null, subeAdi: k.subeAdi ?? null, bankaAdiId: k.bankaAdiId ?? null,
        eFaturadaGozuksun: k.eFaturadaGozuksun, muhHesapKodlari: k.muhHesapKodlari ?? null, devir: k.devir, aktif: k.aktif,
      });
      setKartlar(await BankaService.getBankalar());
      setDuzenleme(null);
      bildir("success", `Kartın adı "${hesapAdi}" olarak kaydedildi.`);
    } catch (err: any) {
      bildir("danger", err?.message || "Kartın adı kaydedilemedi.");
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
        <div className="fw-bold mb-1">Hesap nasıl eşlenir?</div>
        Her banka hesabının satırında, <b>Banka Hesap Kartı</b> sütunundaki listeden programdaki kartı seçin. Kart yoksa <b>Yeni kart</b> ile adını
        yazıp açın (kod, IBAN, şube ve banka adı kendiliğinden dolar). Kartın adını kalemle değiştirebilirsiniz; Sarraf fişinin ödeme satırında bu
        ad görünür. IBAN'ı tutan kart güncelleme sırasında kendiliğinden bağlanır; hareketler ancak bir karta bağlı hesaptan fişe aktarılır.
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
                <th style={{ minWidth: "340px" }}>Banka Hesap Kartı</th>
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
                    {duzenleme && duzenleme.vomsisHesapId === h.vomsisHesapId ? (
                      <div className="d-flex gap-1 align-items-center">
                        <Form.Control
                          size="sm"
                          autoFocus
                          maxLength={60}
                          placeholder={duzenleme.tur === "yeni" ? "Yeni kartın adı" : "Kartın adı"}
                          value={duzenleme.ad}
                          disabled={kaydedilen !== null}
                          onChange={(e) => setDuzenleme({ ...duzenleme, ad: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setDuzenleme(null);
                            if (e.key === "Enter") duzenleme.tur === "yeni" ? yeniKart(h, duzenleme.ad) : kartAdiKaydet(duzenleme.bankaId, h.vomsisHesapId, duzenleme.ad);
                          }}
                        />
                        <Button size="sm" variant="success" className="py-0" disabled={kaydedilen !== null} title={duzenleme.tur === "yeni" ? "Kartı aç ve bağla" : "Adı kaydet"}
                          onClick={() => (duzenleme.tur === "yeni" ? yeniKart(h, duzenleme.ad) : kartAdiKaydet(duzenleme.bankaId, h.vomsisHesapId, duzenleme.ad))}>
                          {kaydedilen === h.vomsisHesapId ? <Spinner size="sm" style={{ width: 12, height: 12 }} /> : <IconCheck size={14} />}
                        </Button>
                        <Button size="sm" variant="light" className="border py-0" disabled={kaydedilen !== null} title="Vazgeç" onClick={() => setDuzenleme(null)}>
                          <IconX size={14} />
                        </Button>
                      </div>
                    ) : (
                    <div className="d-flex gap-1 align-items-center">
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
                    {h.bankaId ? (
                      <Button size="sm" variant="light" className="border py-0 text-nowrap" disabled={kaydedilen !== null} title="Kartın adını değiştir"
                        onClick={() => setDuzenleme({ tur: "ad", bankaId: h.bankaId as number, vomsisHesapId: h.vomsisHesapId, ad: kartlar.find((k) => k.bankaId === h.bankaId)?.hesapAdi || "" })}>
                        <IconPencil size={14} />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline-primary" className="py-0 text-nowrap" disabled={kaydedilen !== null} title="Bu hesap için yeni Banka Hesap Kartı aç"
                        onClick={() => setDuzenleme({ tur: "yeni", vomsisHesapId: h.vomsisHesapId, ad: [h.bankaAdi, h.doviz, h.hesapNo].filter(Boolean).join(" ") })}>
                        <IconPlus size={14} className="me-1" />Yeni kart
                      </Button>
                    )}
                    </div>
                    )}
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
