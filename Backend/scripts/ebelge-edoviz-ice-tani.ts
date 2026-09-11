/**
 * e-Döviz ICE tanı aracı.
 *
 * `preview_edoviz_basic` "Nesne başvurusu bir nesnenin örneğine ayarlanmadı"
 * hatası verdiğinde, ICE'nin hangi gövdeyi beklediğini deneme-yanılma ile
 * deploy etmeden bulmak için kullanılır. Farklı gövde varyantlarını sırayla
 * önizletir ve ilk geçeni raporlar.
 *
 * Varyantlar iki kaynağın çeliştiği noktadan doğdu:
 *  - WSDL (docs/ice/integration-2026-09-09.wsdl) `eDoviz_Belge` tipinde
 *    ProfileID, Vergi_Matrah, Tutar_Bilgileri, BuyBack ve TutarHesaplanmasin var.
 *  - dokuman.iceteknoloji.com.tr'deki send_edoviz_basic örneğinde bunların
 *    hiçbiri yok ve CreditNoteTypeCode, Notlar'dan sonra geliyor.
 * .NET sıraya duyarlı olduğu için yanlış sıradaki alan null kalır ve sunucu
 * null referans hatası verir.
 *
 * Önizleme mali sonuç doğurmaz; belge gönderilmez.
 *
 * Kullanım (Backend klasöründe):
 *   npx tsx scripts/ebelge-edoviz-ice-tani.ts DIA2026000053118
 */
import { EbelgeSqlRepository } from "../src/models/ebelgeSql.repository.js";
import { EbelgeKaynakRepository, DOVIZ_EVRAK_TURU } from "../src/models/ebelgeKaynak.repository.js";
import { dovizGirdisi } from "../src/services/ebelgeKaynak.service.js";
import { buildEDovizInnerXml, EDovizGirdi, EDovizTaraf } from "../src/services/ice/ice.edoviz.js";
import { callWithSession } from "../src/services/ice/ice.session.js";
import { escapeXml } from "../src/services/ice/ice.client.js";
import { getDbPool } from "../src/config/mssql.config.js";
import sql from "mssql";

const belgeNo = (process.argv[2] || "").trim();

/** Boş da olsa etiketi yazar: ICE'nin eksik alanda null referans verme ihtimaline karşı. */
const a = (ad: string, deger: unknown): string =>
  `<${ad}>${escapeXml(deger === undefined || deger === null ? "" : String(deger).trim())}</${ad}>`;

const tarafDokuman = (ad: string, t: EDovizTaraf, musteriMi: boolean): string =>
  `<${ad}>` +
  a("Vkn_Tckn", t.vknTckn) +
  (musteriMi ? a("Pasaport_No", t.pasaportNo) : "") +
  a("Unvan", t.unvan) +
  a("Adi", t.ad) +
  a("Soyadi", t.soyad) +
  a("Adres", t.adres) +
  a("Ulke", t.ulke) +
  a("Sehir", t.sehir) +
  a("Ilce", t.ilce) +
  a(musteriMi ? "VergiDairesi" : "Vergi_Dairesi", t.vergiDairesi) +
  a("Web_Site", "") +
  a("Telefon", t.telefon) +
  a("Fax", "") +
  a("Email", t.eposta) +
  a("Ticaret_Sicil_No", t.ticaretSicilNo) +
  (musteriMi ? a("Musteri_Turu", t.musteriTuru) : "") +
  `</${ad}>`;

/** dokuman.iceteknoloji.com.tr'deki send_edoviz_basic örneğinin birebir sırası. */
const dokumanGovdesi = (loginHeaderXml: string, g: EDovizGirdi): string =>
  `<_eDovizBelge>` +
  loginHeaderXml +
  `<Baslik_Bilgileri>` +
  a("ID", g.belgeNo) +
  a("UUID", g.uuid) +
  a("Duzenleme_Tarihi", g.duzenlemeTarihi) +
  a("Duzenleme_Saati", g.duzenlemeSaati) +
  `<Notlar>${(g.notlar || []).map((n) => a("string", n)).join("")}</Notlar>` +
  a("CreditNoteTypeCode", g.creditNoteTypeCode) +
  `</Baslik_Bilgileri>` +
  tarafDokuman("Yetkili_Muessese", g.yetkiliMuessese, false) +
  tarafDokuman("Musteri", g.musteri, true) +
  `<Alis_Satis_Bilgileri>` +
  a("Doviz_Kodu", g.alisSatis.dovizKodu) +
  a("Dolar_Karsilik_Kuru", g.alisSatis.dolarKarsilikKuru) +
  a("TL_Karsilik_Kuru", g.alisSatis.tlKarsilikKuru) +
  a("Vergi_Orani", g.alisSatis.vergiOrani) +
  a("Vergi_Tutari", g.alisSatis.vergiTutari) +
  a("Doviz_Miktar", g.alisSatis.dovizMiktar) +
  `</Alis_Satis_Bilgileri>` +
  `<Odeme_Bilgileri>` +
  a("Odeme_Yontemi", g.odeme.yontemi) +
  a("Son_Odeme_Tarihi", g.odeme.sonOdemeTarihi) +
  a("Aciklama", g.odeme.aciklama) +
  `</Odeme_Bilgileri>` +
  `<Ek_Bilgiler>` +
  a("Istatistik_No", g.ekBilgiler?.istatistikNo) +
  a("Geldigi_Ulke", g.ekBilgiler?.geldigiUlke) +
  a("Gelis_Nedeni", g.ekBilgiler?.gelisNedeni) +
  a("Ihracat_Yabanci_Sermaye", g.ekBilgiler?.ihracatYabanciSermaye ?? false) +
  a("Gumruk_Beyan_Tarihi", g.ekBilgiler?.gumrukBeyanTarihi || g.duzenlemeTarihi) +
  a("Gumruk_Beyan_No", g.ekBilgiler?.gumrukBeyanNo) +
  a("DBT_Tarihi", g.ekBilgiler?.dbtTarihi || g.duzenlemeTarihi) +
  a("DBT_Sayi", g.ekBilgiler?.dbtSayi) +
  a("GMTY_Tarihi", g.ekBilgiler?.gmtyTarihi || g.duzenlemeTarihi) +
  a("GMTY_Sayi", g.ekBilgiler?.gmtySayi) +
  a("Vezne", g.ekBilgiler?.vezne) +
  `</Ek_Bilgiler>` +
  `<Komisyon_Bilgileri>` +
  a("Komisyon_Tutar_Vergi_Haric", g.komisyon?.vergiHaric ?? 0) +
  a("Komisyon_Tutar_Vergi", g.komisyon?.vergi ?? 0) +
  a("Komisyon_Dahil_Toplam", g.komisyon?.dahilToplam ?? 0) +
  `</Komisyon_Bilgileri>` +
  `<Kiymetli_Maden_Bilgileri>` +
  a("Kiymetli_Maden_Adi", "") +
  a("Adet", 0) +
  `</Kiymetli_Maden_Bilgileri>` +
  `</_eDovizBelge>`;

/** Doküman gövdesi + WSDL'in ek blokları: iki kaynağın birleşimi. */
const birlesikGovde = (loginHeaderXml: string, g: EDovizGirdi): string =>
  dokumanGovdesi(loginHeaderXml, g).replace(
    "</_eDovizBelge>",
    `<Tutar_Bilgileri>` +
      a("Miktar", g.tutar.miktar) +
      a("Kod", g.tutar.kod) +
      a("TL_Karsilik_Kuru", g.tutar.tlKarsilikKuru) +
      a("Dolar_Karsilik_Kuru", g.tutar.dolarKarsilikKuru) +
      a("Saf_Altin_Karsiligi", g.tutar.safAltinKarsiligi) +
      a("Vergi_Orani", g.tutar.vergiOrani) +
      a("Vergi_Matrahi", g.tutar.vergiMatrahi) +
      a("Vergi_Tutari", g.tutar.vergiTutari) +
      a("LineExtensionAmount", g.tutar.lineExtensionAmount) +
      a("TaxExclusiveAmount", g.tutar.taxExclusiveAmount) +
      a("TaxInclusiveAmount", g.tutar.taxInclusiveAmount) +
      a("PayableAmount", g.tutar.payableAmount) +
      `</Tutar_Bilgileri>` +
      `<BuyBack>${a("Komisyon_Tutari", 0)}</BuyBack>` +
      a("TutarHesaplanmasin", g.tutarHesaplanmasin ? "true" : "false") +
      `</_eDovizBelge>`,
  );

/** Sessiz cikisi ve yutulan hatalari gorunur kilar. */
let sonAdim = "baslangic";
const adim = (ad: string) => {
  sonAdim = ad;
  console.log(`[adim] ${ad}`);
};
process.on("exit", (kod) => {
  if (sonAdim !== "bitti") console.log(`[cikis] Surec "${sonAdim}" adiminda kapandi (kod ${kod}).`);
});
process.on("unhandledRejection", (e: any) => console.error("[yakalanmamis reddetme]", e?.message || e));
process.on("uncaughtException", (e: any) => console.error("[yakalanmamis hata]", e?.message || e));

async function main() {
  if (!belgeNo) {
    console.error("Kullanim: npx tsx scripts/ebelge-edoviz-ice-tani.ts <BELGE_NO>");
    process.exitCode = 1;
    return;
  }

  adim("veritabani havuzu aliniyor");
  const pool = await getDbPool();
  const res = await pool
    .request()
    .input("no", sql.VarChar(40), belgeNo)
    // fis aranıyor
    .query(`SELECT TOP 1 BELGE_ID, FIS_TIPI FROM dbo.VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI
            WHERE RTRIM(BELGE_NO)=@no AND ISNULL(IPTAL,0)=0`);
  const satir = res.recordset[0];
  if (!satir) throw new Error(`${belgeNo} gönderime hazır döviz fişleri arasında bulunamadı.`);

  const kimlik = { evrakTuru: DOVIZ_EVRAK_TURU, belgeId: Number(satir.BELGE_ID), belgeTuru: Number(satir.FIS_TIPI), belgeNo };
  adim("fis ayrintisi okunuyor");
  const kaynak = await EbelgeKaynakRepository.dovizDetay(kimlik);
  adim("ICE girdisi hazirlaniyor");
  const girdi = dovizGirdisi(kaynak);
  adim("ICE baglanti ayari okunuyor");
  const config = await EbelgeSqlRepository.getConnectionConfig();

  const varyantlar: { ad: string; govde: (h: string) => string }[] = [
    { ad: "1. Mevcut gövde (üretimdeki hâli, WSDL sırası)", govde: (h) => buildEDovizInnerXml(h, girdi) },
    { ad: "2. Doküman gövdesi (boş alanlar da yazılı, basic sırası)", govde: (h) => dokumanGovdesi(h, girdi) },
    { ad: "3. Doküman gövdesi + WSDL ek blokları", govde: (h) => birlesikGovde(h, girdi) },
  ];

  adim("varyantlar deneniyor");
  console.log(`Belge : ${belgeNo} (BELGE_ID=${kimlik.belgeId}, FIS_TIPI=${kimlik.belgeTuru})`);
  console.log(`ICE   : ${config.servisUrl}`);
  console.log("");

  for (const v of varyantlar) {
    try {
      const { data } = await callWithSession<any>(config, {
        method: "preview_edoviz_basic",
        buildInnerXml: (loginHeaderXml) => v.govde(loginHeaderXml),
        authHatasindaTekrarla: true,
      });
      const metin = typeof data === "string" ? data.trim() : JSON.stringify(data);
      console.log(`GECTI  -- ${v.ad}`);
      console.log(`   ICE cevabi (ilk 400 karakter): ${metin.slice(0, 400)}`);
      console.log("");
      console.log("SONUC: ICE bu govdeyi kabul ediyor. Uretim kodu buna gore duzeltilecek.");
      adim("bitti");
      return;
    } catch (e: any) {
      console.log(`HATA   -- ${v.ad}`);
      console.log(`   ${String(e?.message || e).slice(0, 250)}`);
      console.log("");
    }
  }
  console.log("SONUC: Hicbir varyant gecmedi. Sorun govde yapisi degil; alan icerikleri incelenmeli.");
  adim("bitti");
}

main().catch((e) => {
  console.error("Tani calistirilamadi:", e?.message || e);
  process.exitCode = 1;
});
