import { PerakendeService, SavePerakendeFaturaPayload } from "../../../services/perakendeService";
import { perakendeFisHtml } from "../../../utils/belgeSablon/fisCikti";
import { DEFAULT_CUSTOMER_NAME, detectScenario } from "../../vezne/PerakendeFisiPage";
import type { PosKarti } from "../../../components/pos/PosTahsilat";
import { SepetOdemesi, adetliMi, perakendeSatir, yuvarla4 } from "../../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { TL_PARA_KODLARI, fisiBas, odemeVeyaNakit, pesinOdemeler, posSatirlari, simdi } from "./ortak";
import type { KaydetBaglami, KaydetSonucu } from "./tipler";

/**
 * Perakende hızlı satışı → mevcut POST /perakende/fatura (U4). Satır, ödeme ve POS akışı PerakendeFisiPage ile aynı:
 * ürün tanımı satırında AYAR = ürün kodu (vezne stoğu buradan düşer), gram satırında GRAM = satılan gram, ziynette adet.
 */
export function perakendeYuku(b: KaydetBaglami, kartlar: Record<string, PosKarti> = {}): SavePerakendeFaturaPayload {
  const { tarih, saat } = simdi();
  const tl = b.veri.paralar.find((p) => TL_PARA_KODLARI.includes(String(p.kod).trim().toUpperCase()));
  const m = b.musteri;
  const anonim = m.tur === "anonim";
  const vkn = anonim ? "" : m.vknTckn;
  const senaryo = m.mukellef ? "TICARIFATURA" : detectScenario(vkn, {}, m.unvan);

  const satirlar = b.sepet.map((s) => {
    const h = perakendeSatir(s);
    if (s.tur === "para") {
      const p = b.veri.paralar.find((x) => x.paraId === s.urunId);
      const adetli = adetliMi(s.urunTipi);
      const gram = adetli ? yuvarla4((Number(p?.gramaj) || 0) * s.miktar) : s.miktar;
      return { altinUrunId: null, barkod: null, urunAdi: s.ad, ayar: s.kod || p?.kod || null, miktar: s.miktar, birim: adetli ? "Adet" : "Gram", gram, hasGram: yuvarla4(gram * (Number(p?.hasOrani) || 0)), birimFiyat: h.haricFiyat, kdvOrani: s.kdvOrani };
    }
    if (s.tur === "barkod") {
      return { altinUrunId: s.ek?.altinUrunId ?? null, barkod: s.ek?.barkod ?? null, urunAdi: s.ad, ayar: s.ek?.ayar ?? null, miktar: 1, birim: s.birim || "Adet", gram: Number(s.ek?.gram) || 0, hasGram: Number(s.ek?.hasGram) || 0, birimFiyat: h.haricFiyat, kdvOrani: s.kdvOrani };
    }
    return { altinUrunId: null, barkod: null, urunAdi: s.ad, ayar: null, miktar: s.miktar, birim: s.birim || "Adet", gram: 0, hasGram: 0, birimFiyat: h.haricFiyat, kdvOrani: s.kdvOrani };
  });

  const odemeler = odemeVeyaNakit(b).map((o: SepetOdemesi, i) => {
    const kart = o.tur === 2 ? kartlar[o.anahtar] : undefined;
    const ortak = { satirNo: i + 1, odemeAraciTuru: o.tur, miktar: o.tutar, kur: 1, tutar: o.tutar, paraKodu: "TL" };
    if (o.tur === 1) return { ...ortak, cariKartId: m.cariKartId ?? null, cariKod: m.cariKod ?? null, cariUnvan: m.unvan || null, paraAdi: "VERESİYE" };
    if (o.tur === 2) return { ...ortak, posCihaziId: kart?.posCihaziId ?? o.posCihaziId ?? null, cariKod: kart?.kod ?? o.posKod ?? null, paraAdi: kart?.ad ?? o.posAdi ?? "KREDİ KARTI / POS" };
    if (o.tur === 3) return { ...ortak, cariKartId: null, cariKod: o.bankaHesapNo ?? null, paraAdi: o.bankaAdi ?? "BANKA HAVALE / EFT" };
    return { ...ortak, paraId: tl?.paraId ?? 1, paraAdi: "TÜRK LİRASI" };
  });

  return {
    faturaId: null,
    vezneId: b.veri.vezne?.id || 1,
    faturaNo: "",
    tarih: `${tarih}T${saat}:00`,
    faturaTipi: 1,
    senaryo,
    cariKartId: m.tur === "kayitli" ? m.cariKartId ?? null : null,
    aliciVknTckn: vkn || "11111111111",
    aliciUnvan: anonim ? DEFAULT_CUSTOMER_NAME : m.unvan.trim(),
    adres: m.adres.trim() || undefined,
    ilce: m.ilce.trim() || undefined,
    il: m.il.trim() || undefined,
    vergiDairesi: m.vergiDairesi.trim() || undefined,
    telefon: m.telefon.trim() || undefined,
    eposta: m.eposta.trim() || undefined,
    paraId: 1,
    kur: 1,
    iskontoId: null,
    iskontoKodu: "",
    iskontoOrani: b.indirim?.turu === 1 ? b.indirim.deger : 0,
    iskontoTutari: b.toplam.indirim,
    satirlar,
    odemeler,
  } as SavePerakendeFaturaPayload;
}

export async function perakendeKaydet(b: KaydetBaglami): Promise<KaydetSonucu> {
  const yuk = perakendeYuku(b);
  const sonuc: any = await PerakendeService.createInvoice(yuk);
  const id = Number(sonuc?.faturaId) || 0;
  const no = String(sonuc?.faturaNo || "");
  if (!id) throw new Error("Fiş kaydedildi ancak numarası alınamadı; Perakende satış listesinden kontrol edin.");
  const uyarilar: string[] = [];
  const odemeler = odemeVeyaNakit(b);

  // POS: fiş önce kaydedilir, kart sonra çekilir (POS_ENTEGRASYON K28); vazgeçilirse fiş kayıtlı kalır (K29)
  if (odemeler.some((o) => o.tur === 2)) {
    const m = b.musteri;
    const pos = await b.pos.tahsilEt({
      belgeTuru: "perakende",
      belgeNo: no,
      belgeTipi: yuk.senaryo === "EARSIVFATURA" ? "earsiv" : "efatura",
      belgeId: id,
      kayitSonrasi: true,
      vezneId: b.veri.vezne?.id ?? null,
      aliciAd: yuk.aliciUnvan || null,
      aliciVkn: m.tur === "anonim" ? null : m.vknTckn || null,
      pesinOdemeler: pesinOdemeler(odemeler),
      kalemler: b.sepet.map((s) => {
        const h = perakendeSatir(s);
        return { ad: [s.ad, s.tur === "para" && s.kod ? `${s.kod}` : ""].filter(Boolean).join(" "), miktar: s.miktar, tutar: h.toplam, kdvOrani: s.kdvOrani };
      }),
      satirlar: posSatirlari(odemeler),
    });
    if (Object.keys(pos.kartlar).length) await PerakendeService.createInvoice({ ...perakendeYuku(b, pos.kartlar), faturaId: id, faturaNo: no, tarih: yuk.tarih });
    await b.pos.kaydedildi("perakende", id, no);
    if (!pos.tamam) uyarilar.push(`Fiş ${no} kaydedildi ancak POS tahsilatı alınmadı. Perakende Fişi Düzeltme'den ödemeyi düzeltin.`);
  }

  const baski = await fisiBas(b, "perakende", (bicim) => perakendeFisHtml(sonuc || yuk, bicim), `Perakende_Fisi_${no}`);
  if (baski) uyarilar.push(baski);
  return { fisId: id, fisNo: no, uyarilar };
}
