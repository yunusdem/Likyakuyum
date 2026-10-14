import { DovizFisService, SaveDovizFisPayload } from "../../../services/dovizFisService";
import { dovizFisHtml } from "../../../utils/belgeSablon/fisCikti";
import { dovizSatir, urunKuru, yuvarla2 } from "../../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { fisiBas, odemeVeyaNakit, simdi } from "./ortak";
import type { KaydetBaglami, KaydetSonucu } from "./tipler";

/**
 * Döviz hızlı alış/satış → mevcut POST /doviz-fis/kaydet (U7). Satır, BSMV/KMV/komisyon DovizFisiPage ile aynı. Döviz fişinde ödeme
 * modeli yok: tamamı nakit (vezne TL) ya da tamamı banka hesabı (BANKA_HESABI_ID = bankanın cari kartı).
 */
const ANONIM = "İsim beyan edilmemiştir";

export function dovizYuku(b: KaydetBaglami): SaveDovizFisPayload {
  const { tarih, saat } = simdi();
  const m = b.musteri;
  const anonim = m.tur === "anonim";
  const sekil = b.veri.kmvSekli;
  const odemeler = odemeVeyaNakit(b);
  const banka = odemeler.find((o) => o.tur === 3);
  const satirlar = b.sepet.map((s, i) => {
    const h = dovizSatir(s, b.tip, sekil);
    return {
      satirNo: i,
      paraId: Number(s.urunId),
      paraKodu: s.kod || undefined,
      paraAdi: s.ad,
      miktar: s.miktar,
      kur: s.birimFiyat,
      iscilik: 0,
      giseKuru: s.birimFiyat,
      tutar: h.tutar,
      komisyonOrani: Number(s.ek?.komisyonOrani) || 0,
      komisyon: h.komisyon,
      bmvOrani: b.tip === 0 ? 0 : Number(s.ek?.bmvOrani) || 0,
      bmv: h.bmv,
      kmvOrani: b.tip === 0 ? 0 : Number(s.ek?.kmvOrani) || 0,
      kmv: h.kmv,
      kdvOrani: 0,
      kdv: 0,
    };
  });
  return {
    vezneId: b.veri.vezne?.id || undefined,
    tip: b.tip,
    tarih,
    zaman: saat,
    kurTuru: 0,
    istatistikId: b.istatistik?.id ?? null,
    cariKartId: m.tur === "kayitli" ? m.cariKartId ?? null : null,
    unvan: anonim ? ANONIM : m.unvan.trim(),
    kisilikTipi: anonim ? 0 : m.kisilikTipi ?? 1,
    hukukiYapiId: !anonim && (m.kisilikTipi ?? 1) === 1 ? 1 : null,
    vergiKimlikNo: anonim ? undefined : m.vknTckn || undefined,
    adres: anonim ? undefined : m.adres || undefined,
    il: anonim ? undefined : m.il || undefined,
    ilce: anonim ? undefined : m.ilce || undefined,
    telefonNo: anonim ? undefined : m.telefon || undefined,
    eposta: anonim ? undefined : m.eposta || undefined,
    toplamTutar: b.toplam.araToplam,
    yuvarlama: 0,
    odemeTutari: b.toplam.genelToplam,
    bankaHesabiId: banka?.bankaId ?? null,
    masakListesindeVar: false,
    kullaniciId: b.kullanici.id || undefined,
    satirlar,
  };
}

export async function dovizKaydet(b: KaydetBaglami): Promise<KaydetSonucu> {
  const odemeler = odemeVeyaNakit(b);
  if (odemeler.some((o) => o.tur === 1 || o.tur === 2)) throw new Error("Döviz fişinde yalnız nakit ya da banka hesabı kullanılabilir.");
  const banka = odemeler.filter((o) => o.tur === 3);
  if (banka.length && (banka.length > 1 || odemeler.length > 1)) throw new Error("Döviz fişinde banka hesabı tek ödeme olmalı (tutarın tamamı).");
  if (!b.istatistik) throw new Error(`${b.tip === 1 ? "Satış" : "Alış"} için istatistik tanımı bulunamadı (Ayarlar › İstatistik Tanımları / Firma Tanımları).`);
  const yuk = dovizYuku(b);
  const r: any = await DovizFisService.saveFis(yuk);
  const id = Number(r?.fisId) || 0;
  const no = String(r?.belgeNo || r?.seriNo || "");
  if (!id) throw new Error("Fiş kaydedildi ancak numarası alınamadı; Döviz fiş listesinden kontrol edin.");
  const uyarilar: string[] = [];
  const t = b.veri.tanim || {};
  const usd = urunKuru(b.veri.kurlar, { kod: "USD", urunTipi: 0 }, b.tip);
  const satirlar = yuk.satirlar;
  const snap = {
    fisId: id,
    tip: b.tip,
    tarih: yuk.tarih,
    saat: yuk.zaman,
    seriNo: r?.seriNo || "",
    belgeNo: r?.belgeNo || "",
    unvan: yuk.unvan,
    vergiKimlikNo: yuk.vergiKimlikNo || "",
    detayIl: b.musteri.il,
    detayIlce: b.musteri.ilce,
    detayUyruk: "",
    detayPasaportNo: "",
    detayMeslek: "",
    detayCariTipi: "",
    vezneKod: b.veri.vezne?.kod || "",
    istatistikKodu: b.istatistik?.kod || "",
    lines: satirlar.map((l) => ({ paraKodu: l.paraKodu, paraAdi: l.paraAdi, miktar: l.miktar, kur: l.kur, tutar: l.tutar, bmv: l.bmv, kmv: l.kmv, kmvOrani: l.kmvOrani, komisyon: l.komisyon })),
    toplamTutar: yuk.toplamTutar,
    odemeTutari: yuk.odemeTutari,
    bsmvTutari: yuvarla2(satirlar.reduce((a, l) => a + (l.bmv || 0), 0)),
    kmvTutari: yuvarla2(satirlar.reduce((a, l) => a + (l.kmv || 0), 0)),
    komisyonTutari: yuvarla2(satirlar.reduce((a, l) => a + (l.komisyon || 0), 0)),
    giseUsdKuru: usd,
    dovizKurusSayisi: Number(t.DOVIZ_KURUS_SAYISI) || 2,
    kurKurusSayisi: Number(t.KUR_KURUS_SAYISI) || 4,
    tlKurusSayisi: Math.max(2, Number(t.TL_KURUS_SAYISI) || 2),
  };
  const baski = await fisiBas(b, "doviz", () => dovizFisHtml(snap), `Doviz_Fisi_${no}`);
  if (baski) uyarilar.push(baski);
  return { fisId: id, fisNo: no, uyarilar };
}
