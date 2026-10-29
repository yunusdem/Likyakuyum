import { TicariSatisGirdi, TicariService, eksiStokUyarisiMi } from "../../../services/ticariService";
import { ticariFisHtml } from "../../../utils/belgeSablon/fisCikti";
import type { PosKarti } from "../../../components/pos/PosTahsilat";
import { etkinIndirim, yuvarla2 } from "../../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { TL_PARA_KODLARI, fisiBas, odemeVeyaNakit, pesinOdemeler, posSatirlari, simdi } from "./ortak";
import type { KaydetBaglami, KaydetSonucu } from "./tipler";

/**
 * Ticari hızlı satışı → mevcut POST /ticari/satis (U5). Stok kartı satırı karttan, serbest ürün satırı ad + KDV + KDV dahil
 * fiyatla (stoktan düşmez). Ödeme, POS ve eksi stok onayı TicariSatisFisiPage ile aynı.
 */
export function ticariYuku(b: KaydetBaglami, eksiStokOnay = false, kartlar: Record<string, PosKarti> = {}): TicariSatisGirdi {
  const { tarih, saat } = simdi();
  const m = b.musteri;
  const anonim = m.tur === "anonim";
  const tl = b.veri.paralar.find((p) => TL_PARA_KODLARI.includes(String(p.kod).trim().toUpperCase()));
  // Tanımın en çok / en az sınırı devreye girdiyse yüzde yerine tutar gider
  const isk = etkinIndirim(yuvarla2(b.toplam.genelToplam + b.toplam.indirim), b.indirim);
  return {
    faturaId: null,
    vezneId: b.veri.vezne?.id ?? null,
    faturaNo: null,
    tarih: new Date(`${tarih}T${saat}:00`).toISOString(),
    senaryo: m.mukellef ? "TICARIFATURA" : "EARSIVFATURA",
    cariKartId: m.tur === "kayitli" ? m.cariKartId ?? null : null,
    aliciVknTckn: anonim ? "11111111111" : m.vknTckn || "11111111111",
    aliciUnvan: anonim ? "NİHAİ TÜKETİCİ" : m.unvan.trim(),
    adres: m.adres, ilce: m.ilce, il: m.il, vergiDairesi: m.vergiDairesi, eposta: m.eposta, telefon: m.telefon,
    iskontoId: isk ? b.indirim?.iskontoId ?? null : null,
    iskontoKodu: isk ? b.indirim?.kod ?? null : null,
    iskontoTuru: isk ? isk.turu : 0,
    iskontoDegeri: isk ? isk.deger : null,
    fiyatListesiId: b.veri.fiyatListesiId ?? null,
    satirlar: b.sepet.map((s) =>
      s.tur === "stok"
        ? { stokKartId: Number(s.urunId), miktar: s.miktar, kdvDahilFiyat: s.birimFiyat, iskontoTuru: s.ek?.kampanya?.turu ?? 0, iskontoDegeri: s.ek?.kampanya?.deger ?? null, kampanyaId: s.ek?.kampanya?.kampanyaId ?? null }
        : { stokKartId: null, urunAdi: s.ad, birim: s.birim || "Adet", kdvOrani: s.kdvOrani, miktar: s.miktar, kdvDahilFiyat: s.birimFiyat }
    ),
    odemeler: odemeVeyaNakit(b).map((o, i) => {
      const kart = o.tur === 2 ? kartlar[o.anahtar] : undefined;
      const ortak = { satirNo: i + 1, odemeAraciTuru: o.tur, miktar: o.tutar, kur: 1, tutar: o.tutar, paraKodu: "TL" };
      if (o.tur === 1) return { ...ortak, cariKartId: m.cariKartId ?? null, cariKod: m.cariKod ?? null, cariUnvan: m.unvan || null, paraId: null, paraAdi: "VERESİYE" };
      if (o.tur === 2) return { ...ortak, cariKartId: null, posCihaziId: kart?.posCihaziId ?? o.posCihaziId ?? null, cariKod: kart?.kod ?? o.posKod ?? null, paraId: null, paraAdi: "KREDİ KARTI / POS" };
      if (o.tur === 3) return { ...ortak, cariKartId: o.bankaId ?? null, cariKod: o.bankaHesapNo ?? null, paraId: null, paraAdi: "BANKA HAVALE / EFT" };
      return { ...ortak, paraId: tl?.paraId ?? null, paraAdi: "TÜRK LİRASI" };
    }) as any,
    eksiStokOnay,
  };
}

export async function ticariKaydet(b: KaydetBaglami): Promise<KaydetSonucu> {
  let onay = false;
  let r;
  for (;;) {
    try {
      r = await TicariService.satisKaydet(ticariYuku(b, onay));
      break;
    } catch (e: any) {
      if (!onay && eksiStokUyarisiMi(e) && window.confirm(e.message)) { onay = true; continue; }
      throw e;
    }
  }
  const f = r.fis;
  const uyarilar: string[] = r.uyari ? [r.uyari] : [];
  const odemeler = odemeVeyaNakit(b);
  if (odemeler.some((o) => o.tur === 2)) {
    const pos = await b.pos.tahsilEt({
      belgeTuru: "perakende",
      belgeNo: f.faturaNo,
      belgeTipi: f.senaryo === "EARSIVFATURA" ? "earsiv" : "efatura",
      belgeId: f.faturaId,
      kayitSonrasi: true,
      vezneId: b.veri.vezne?.id ?? null,
      aliciAd: f.aliciUnvan,
      aliciVkn: f.aliciVknTckn || null,
      pesinOdemeler: pesinOdemeler(odemeler),
      satirlar: posSatirlari(odemeler),
      kalemler: f.satirlar.map((s) => ({ ad: s.urunAdi, miktar: s.miktar, tutar: s.toplamTutar, kdvOrani: s.kdvOrani })),
    });
    if (Object.keys(pos.kartlar).length) await TicariService.satisKaydet({ ...ticariYuku(b, true, pos.kartlar), faturaId: f.faturaId, faturaNo: f.faturaNo });
    await b.pos.kaydedildi("perakende", f.faturaId, f.faturaNo);
    if (!pos.tamam) uyarilar.push(`Fiş ${f.faturaNo} kaydedildi ancak POS tahsilatı alınmadı. Ticari › Satış Fişi Düzeltme'den ödemeyi düzeltin.`);
  }
  const baski = await fisiBas(b, "perakende", (bicim) => ticariFisHtml({ ...f, vezneKod: b.veri.vezne?.kod }, bicim), `Satis_Fisi_${f.faturaNo}`);
  if (baski) uyarilar.push(baski);
  return { fisId: f.faturaId, fisNo: f.faturaNo, uyarilar };
}
