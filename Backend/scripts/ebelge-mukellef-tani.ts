/**
 * Mükellef bilgisi ICE tanı aracı.
 *
 * Bir VKN/TCKN için ICE entegrasyon servisinde unvan, ad-soyad, vergi dairesi
 * ve adres döndürebilecek bütün metotları sırayla çağırır ve ham cevapları yazar.
 * ICE portalındaki TÜRMOB sorgusu WSDL'de ayrı metot olarak yok; bilginin
 * hangi metottan hangi alanla geldiğini canlı hesapta görmek için kullanılır.
 *
 * Denenen metotlar (docs/ice/integration-2026-09-09.wsdl):
 *  1. getUserList_EFatura_Detail  search_Identifier → Title, Alias, silinme tarihi
 *  2. Get_Musteri_Cari_List       VKNTCKN          → Unvan, Adi, Soyadi, VDSehir, VergiDaire, Adres_List
 *  3. GetKullaniciMusterileri     (girdi yok)      → Unvan, Adi, Soyadi, VergiDairesi, Adres, Telefon, Email
 *  4. getUserList_EFatura_Detail  search_Title     → (ikinci argüman verilirse) unvanla arama
 *
 * Yalnız okuma yapar; belge gönderilmez, kayıt değiştirilmez.
 *
 * Kullanım (Backend klasöründe):
 *   npx tsx scripts/ebelge-mukellef-tani.ts <VKN_TCKN> ["UNVAN PARCASI"]
 */
import { EbelgeSqlRepository } from "../src/models/ebelgeSql.repository.js";
import { callWithSession } from "../src/services/ice/ice.session.js";
import { escapeXml } from "../src/services/ice/ice.client.js";

const vknTckn = (process.argv[2] || "").replace(/\D/g, "");
const unvanParcasi = (process.argv[3] || "").trim();

const adim = (m: string) => console.log(`--- ${m}`);

/** Uzun listelerde yalnız aranan numarayı içeren kayıtları bırakır */
const numarayiIcerenler = (deger: unknown): unknown => {
  const metin = JSON.stringify(deger ?? null);
  if (metin.length < 4000) return deger;
  const bul = (d: any): any[] =>
    Array.isArray(d) ? d.flatMap(bul)
      : d && typeof d === "object"
        ? (JSON.stringify(d).includes(vknTckn) && Object.values(d).every((v) => typeof v !== "object" || v === null)
          ? [d] : Object.values(d).flatMap(bul))
        : [];
  const eslesen = bul(deger);
  return { not: `Cevap ${metin.length} karakter; yalnız ${vknTckn} geçen kayıtlar gösteriliyor`, eslesen };
};

const dene = async (baslik: string, method: string, govde: (h: string) => string) => {
  adim(baslik);
  try {
    const { data } = await callWithSession<any>(config, {
      method,
      buildInnerXml: govde,
      authHatasindaTekrarla: true,
    });
    console.log(JSON.stringify(numarayiIcerenler(data), null, 2));
  } catch (e: any) {
    console.log(`HATA: ${String(e?.message || e).slice(0, 400)}`);
  }
  console.log("");
};

let config: Awaited<ReturnType<typeof EbelgeSqlRepository.getConnectionConfig>>;

async function main() {
  if (vknTckn.length < 10 || vknTckn.length > 11) {
    console.error('Kullanim: npx tsx scripts/ebelge-mukellef-tani.ts <VKN_TCKN> ["UNVAN PARCASI"]');
    process.exitCode = 1;
    return;
  }

  adim("ICE baglanti ayari okunuyor");
  config = await EbelgeSqlRepository.getConnectionConfig();
  console.log(`ICE   : ${config.servisUrl}`);
  console.log(`Sorgu : ${vknTckn}${unvanParcasi ? ` / "${unvanParcasi}"` : ""}`);
  console.log("");

  await dene("1. getUserList_EFatura_Detail (numara)", "getUserList_EFatura_Detail", (h) =>
    `<_getUserList_request>${h}<search_Identifier>${escapeXml(vknTckn)}</search_Identifier></_getUserList_request>`);

  await dene("2. Get_Musteri_Cari_List (numara)", "Get_Musteri_Cari_List", (h) =>
    `<Request>${h}<VKNTCKN>${escapeXml(vknTckn)}</VKNTCKN><Unvan></Unvan><Adi></Adi><Soyadi></Soyadi>` +
    `<OFFSET>0</OFFSET><LIMIT>10</LIMIT></Request>`);

  // Login_Request_Header burada `requestHeader` adıyla gider (WSDL)
  await dene("3. GetKullaniciMusterileri", "GetKullaniciMusterileri", (h) =>
    h.replace(/^<Login_Request_Header>/, "<requestHeader>").replace(/<\/Login_Request_Header>$/, "</requestHeader>"));

  if (unvanParcasi) {
    await dene("4. getUserList_EFatura_Detail (unvan)", "getUserList_EFatura_Detail", (h) =>
      `<_getUserList_request>${h}<search_Title>${escapeXml(unvanParcasi)}</search_Title></_getUserList_request>`);
  }

  adim("bitti");
}

main().catch((e) => {
  console.error("Tani calistirilamadi:", e?.message || e);
  process.exitCode = 1;
});
