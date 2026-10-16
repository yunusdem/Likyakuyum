import { SarrafFisService, SaveSarrafFisPayload } from "../../../services/sarrafFisService";
import { sarrafFisHtml } from "../../../utils/belgeSablon/fisCikti";
import type { PosKarti } from "../../../components/pos/PosTahsilat";
import { SepetOdemesi, adetliMi, milyemOrani, sarrafSatir, urunKuru, yuvarla2, yuvarla4 } from "../../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { oranlaDagit } from "../../../../Backend/src/services/ticari/ticariHesap";
import { TL_PARA_KODLARI, fisiBas, odemeVeyaNakit, pesinOdemeler, posSatirlari, simdi } from "./ortak";
import type { KaydetBaglami, KaydetSonucu } from "./tipler";

/**
 * Sarraf hızlı satışı / alışı → mevcut POST /sarraf-fis (U6, H10). Satırlar SarrafFisiPage ile aynı: ziynet/döviz adet × kur,
 * gram ürün has (gram × milyem) + işçilik has × has kuru. Cari ödemesi has olarak cariye (H10); nakit / POS / banka TL.
 */
const ANONIM = "İsim beyan edilmemiştir";

export function sarrafYuku(b: KaydetBaglami, kartlar: Record<string, PosKarti> = {}): SaveSarrafFisPayload {
  const { tarih, saat } = simdi();
  const m = b.musteri;
  const anonim = m.tur === "anonim";
  const hasKuru = urunKuru(b.veri.kurlar, { kod: "HAS", urunTipi: 1 }, b.tip);
  const gumusKuru = urunKuru(b.veri.kurlar, { kod: "GMS", urunTipi: 2 }, b.tip);
  const has = b.veri.paralar.find((p) => String(p.kod).trim().toUpperCase() === "HAS");
  const tl = b.veri.paralar.find((p) => TL_PARA_KODLARI.includes(String(p.kod).trim().toUpperCase()));

  // İskonto kurdan düşülür (14.10.2026 karar): satır tutarlarına oranla dağıtılır, kur = yeni tutar ÷ (adet ya da has + işçilik has).
  // Ödeme satırı olarak yazılsaydı eski kayıt yordamı onu vezneye nakit sayıyordu (vezne fazla görünüyordu).
  const hamlar = b.sepet.map((s) => sarrafSatir(s));
  const iskonto = b.tip === 1 ? b.toplam.indirim : 0;
  const paylar = iskonto > 0 ? oranlaDagit(hamlar.map((h) => h.tutar), iskonto) : hamlar.map(() => 0);
  const satirlar = b.sepet.map((s, i) => {
    const h = hamlar[i];
    const adetli = adetliMi(s.urunTipi);
    const tutar = yuvarla2(h.tutar - paylar[i]);
    const bolen = adetli ? s.miktar : h.hasGram + h.iscilikHasGram;
    const kur = paylar[i] > 0 && bolen > 0 ? yuvarla4(tutar / bolen) : s.birimFiyat;
    return {
      satirNo: i + 1,
      urunId: Number(s.urunId),
      miktar: s.miktar,
      // TODVZ_SARRAF_FISI_SATIRI.MILYEM tamsayıdır (binde: 916); 0,916 gönderilirse 0 saklanır
      milyem: adetli ? 0 : Math.round(milyemOrani(s.ek?.milyem) * 1000),
      hasGram: h.hasGram,
      adet: adetli ? s.miktar : 0,
      iscilikiMiktari: adetli ? 0 : Number(s.ek?.iscilik) || 0,
      iscilikHasGram: h.iscilikHasGram,
      iscilikHesaplamaSekli: 0,
      aciklama: null,
      kur,
      // İskonto kurdan düşüldüyse iskontosuz kur: sunucu kur yetkisini bununla denetler (iskonto kur değişikliği sayılmaz)
      ...(paylar[i] > 0 && { iskontosuzKur: s.birimFiyat }),
      tutar,
      urunTipi: Number(s.urunTipi) || 0,
      karat: null,
    };
  });

  const odemeler = odemeVeyaNakit(b);
  // Tek ödeme cariye ve satırların hepsi gram ürünse has toplamı birebir cariye gider; yoksa tutar ÷ has kuru
  const tamHas = !(iskonto > 0) && odemeler.length === 1 && odemeler[0].tur === 1 && b.sepet.every((s) => !adetliMi(s.urunTipi));
  const odemeSatirlari = odemeler.map((o: SepetOdemesi, i) => {
    const kart = o.tur === 2 ? kartlar[o.anahtar] : undefined;
    const tlOrtak = { satirNo: i + 1, adet: o.tutar, miktar: o.tutar, milyem: 0, hasGram: 0, kur: 1, tutar: o.tutar, paraKodu: "TL" };
    if (o.tur === 1) {
      const hasGram = tamHas ? b.toplam.hasToplam : hasKuru > 0 ? yuvarla4(o.tutar / hasKuru) : 0;
      return {
        satirNo: i + 1, islemeYeri: 1, odemeAraciTuru: 1, cariKartId: m.cariKartId ?? null, cariKod: m.cariKod ?? null, cariUnvan: m.unvan || null,
        paraId: has?.paraId ?? null, paraKodu: "HAS", paraAdi: has?.ad ?? "HAS ALTIN",
        adet: 0, miktar: hasGram, milyem: 0, hasGram, kur: hasKuru, tutar: tamHas ? yuvarla2(hasGram * hasKuru) : o.tutar,
      };
    }
    if (o.tur === 2) {
      const pid = kart?.posCihaziId ?? o.posCihaziId ?? null;
      return { ...tlOrtak, islemeYeri: 3, odemeAraciTuru: 2, posCihaziId: pid, bankaId: pid, cariKartId: null, cariKod: kart?.kod ?? o.posKod ?? null, paraAdi: kart?.ad ?? o.posAdi ?? "POS" };
    }
    if (o.tur === 3) return { ...tlOrtak, islemeYeri: 2, odemeAraciTuru: 3, bankaId: o.bankaId ?? null, cariKartId: null, cariKod: o.bankaHesapNo ?? null, paraAdi: o.bankaAdi ?? "BANKA" };
    return { ...tlOrtak, islemeYeri: 0, odemeAraciTuru: 0, paraId: tl?.paraId ?? null, paraAdi: tl?.ad ?? "TÜRK LİRASI" };
  });

  return {
    sarrafFisiId: null,
    vezneId: b.veri.vezne?.id || 1,
    cariKartId: m.tur === "kayitli" ? m.cariKartId ?? null : null,
    tarih,
    saat: `${tarih}T${saat}:00`,
    fisNo: null,
    seriNo: null,
    belgeNo: null,
    irsaliyeNo: null,
    tip: b.tip,
    altinHasKuru: hasKuru,
    gumusHasKuru: gumusKuru,
    alisKuru: 0,
    satisKuru: 0,
    kdvOrani: null,
    kdv: 0,
    istatistikId: b.istatistik?.id ?? null,
    istatistikKodu: b.istatistik?.kod ?? null,
    unvan: anonim ? ANONIM : m.unvan.trim(),
    kisilikTipi: anonim ? 0 : m.kisilikTipi ?? null,
    vergiKimlikNo: anonim ? null : m.vknTckn || null,
    adres: anonim ? null : m.adres || null,
    telefonNo: anonim ? null : m.telefon || null,
    eposta: anonim ? null : m.eposta || null,
    belgeTuru: m.mukellef ? 1 : 0,
    masakListesindeVar: false,
    yazdirilanBelgeTipi: 0,
    kullaniciId: b.kullanici.id || 1,
    satirlar,
    odemeSatirlari,
  } as SaveSarrafFisPayload;
}

export async function sarrafKaydet(b: KaydetBaglami): Promise<KaydetSonucu> {
  const odemeler = odemeVeyaNakit(b);
  if (b.tip === 0 && odemeler.some((o) => o.tur === 2)) throw new Error("Alışta POS ile ödeme yapılamaz.");
  if (odemeler.some((o) => o.tur === 1) && !(urunKuru(b.veri.kurlar, { kod: "HAS", urunTipi: 1 }, b.tip) > 0)) throw new Error("Has altın kuru yok; cari ödemesi has olarak yazılamaz.");
  const yuk = sarrafYuku(b);
  const r = await SarrafFisService.saveFis(yuk);
  const id = Number(r?.sarrafFisiId) || 0;
  const no = String(r?.fisNo || "");
  if (!id) throw new Error("Fiş kaydedildi ancak numarası alınamadı; Sarraf fiş listesinden kontrol edin.");
  const uyarilar: string[] = [];

  if (b.tip === 1 && odemeler.some((o) => o.tur === 2)) {
    const m = b.musteri;
    const pos = await b.pos.tahsilEt({
      belgeTuru: "sarraf",
      belgeNo: no,
      belgeTipi: m.mukellef ? "efatura" : "earsiv",
      belgeId: id,
      kayitSonrasi: true,
      vezneId: b.veri.vezne?.id ?? null,
      aliciAd: yuk.unvan || null,
      aliciVkn: m.tur === "anonim" ? null : m.vknTckn || null,
      pesinOdemeler: pesinOdemeler(odemeler),
      satirlar: posSatirlari(odemeler),
      kalemler: b.sepet.map((s, i) => ({ ad: s.ad, miktar: adetliMi(s.urunTipi) ? s.miktar : 1, tutar: Number(yuk.satirlar[i].tutar) || 0, kdvOrani: 0 })),
    });
    if (Object.keys(pos.kartlar).length) await SarrafFisService.saveFis({ ...sarrafYuku(b, pos.kartlar), sarrafFisiId: id, fisNo: no, belgeNo: no, tarih: yuk.tarih, saat: yuk.saat });
    await b.pos.kaydedildi("sarraf", id, no);
    if (!pos.tamam) uyarilar.push(`Fiş ${no} kaydedildi ancak POS tahsilatı alınmadı. Sarraf Fişi Düzeltme'den ödemeyi düzeltin.`);
  }

  const toplamTutar = b.toplam.genelToplam; // iskonto kurdan düşülmüş fiş tutarı
  const odenen = yuvarla2(yuk.odemeSatirlari.reduce((a, o) => a + (Number(o.tutar) || 0), 0));
  const snap = {
    fisId: id,
    fisNo: no,
    seriNo: null,
    belgeNo: no,
    tip: b.tip,
    tarih: yuk.tarih,
    saat: String(yuk.saat || "").slice(11, 16),
    unvan: yuk.unvan,
    vergiKimlikNo: yuk.vergiKimlikNo || "",
    detayIl: b.musteri.il,
    detayIlce: b.musteri.ilce,
    detayAdres: yuk.adres || "",
    detayTelefonNo: yuk.telefonNo || "",
    detayPasaportNo: "",
    vezneKod: b.veri.vezne?.kod || "",
    kullaniciAdi: b.kullanici.ad || "Kasiyer",
    satirlar: yuk.satirlar.map((l, i) => ({ ...l, urunKodu: b.sepet[i].kod, urunAdi: b.sepet[i].ad })),
    odemeSatirlari: yuk.odemeSatirlari.map((o) => ({ satirNo: o.satirNo, odemeAraciTuru: o.odemeAraciTuru, paraKodu: o.paraKodu, paraAdi: o.paraAdi, adet: o.adet || "", miktar: o.miktar || "", milyem: "", hasGram: o.hasGram || "", kur: o.kur, tutar: o.tutar })),
    toplamTutar,
    toplamHas: b.toplam.hasToplam,
    odenenTutar: odenen,
    kalanTutar: yuvarla2(toplamTutar - odenen),
  };
  const baski = await fisiBas(b, "sarraf", (bicim) => sarrafFisHtml(snap, bicim), `Sarraf_Fisi_${no}`);
  if (baski) uyarilar.push(baski);
  return { fisId: id, fisNo: no, uyarilar };
}
