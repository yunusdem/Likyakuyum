/**
 * e-Belge revizyonu (docs/ebelge-revizyon.md) — çevrimdışı testler. Veritabanına ve ICE'ye bağlanmaz.
 * Çalıştırma: npx tsx scripts/ebelge-revizyon-test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ebelgeDogrulaSchema,
  ebelgeKaynakListeSchema,
  ebelgeKodEkleSchema,
  ebelgeKodListeSchema,
  ebelgeYerelTaslakKaydetSchema,
  ebelgeYerelTaslakListeSchema,
} from "../src/schemas/ebelge.schema.js";
import { kaynakSecim } from "../src/models/ebelgeKaynak.repository.js";

test("kod dürbünü: tür ve kod biçimi doğrulanır", () => {
  assert.ok(ebelgeKodListeSchema.safeParse({}).success);
  assert.ok(ebelgeKodListeSchema.safeParse({ tur: "OZELMATRAH" }).success);
  assert.ok(!ebelgeKodListeSchema.safeParse({ tur: "BASKA" }).success);
  assert.ok(ebelgeKodEkleSchema.safeParse({ tur: "ISTISNA", kod: "233", ad: "Yeni istisna" }).success);
  assert.ok(ebelgeKodEkleSchema.safeParse({ tur: "TEVKIFAT", kod: "650", ad: "Diğer", oran: "50" }).success);
  assert.ok(!ebelgeKodEkleSchema.safeParse({ tur: "ISTISNA", kod: "23A", ad: "Harfli kod" }).success);
  assert.ok(!ebelgeKodEkleSchema.safeParse({ tur: "ISTISNA", kod: "233", ad: "x" }).success);
  assert.ok(!ebelgeKodEkleSchema.safeParse({ tur: "TEVKIFAT", kod: "650", ad: "Oran fazla", oran: 150 }).success);
});

test("yerel taslak: e-Fatura yerel taslak olamaz (o ICE'de durur), içerik nesne olmalı", () => {
  const gecerli = { belgeTuru: "EArsiv", belgeNo: "", aliciVkn: "12345678901", tutar: 10.5, icerik: { satirlar: [] } };
  assert.ok(ebelgeYerelTaslakKaydetSchema.safeParse(gecerli).success);
  assert.ok(ebelgeYerelTaslakKaydetSchema.safeParse({ ...gecerli, id: "7" }).success);
  assert.ok(!ebelgeYerelTaslakKaydetSchema.safeParse({ ...gecerli, belgeTuru: "EFatura" }).success);
  assert.ok(!ebelgeYerelTaslakKaydetSchema.safeParse({ ...gecerli, icerik: "metin" }).success);
  assert.ok(!ebelgeYerelTaslakKaydetSchema.safeParse({ ...gecerli, icerik: { x: "a".repeat(600_000) } }).success);
  for (const tur of ["EArsiv", "EIrsaliye", "EGiderPusulasi", "EMustahsil"]) assert.ok(ebelgeYerelTaslakListeSchema.safeParse({ belgeTuru: tur }).success);
});

test("kesilmiş belgeler: döviz alış/satış süzgeci belgeTuru ile taşınır", () => {
  const p = ebelgeKaynakListeSchema.safeParse({ kaynak: "DOVIZ", belgeTuru: "1", durum: "HATA", sayfa: "1" });
  assert.ok(p.success);
  assert.equal(p.data!.belgeTuru, 1);
});

test("kesilmiş belgeler: kilit mantığı değişmedi — yalnız GONDERILMEDI/HATA seçilebilir", () => {
  const temel = { kaynak: "FATURA", belgeTuru: 0, eskiDurum: 0, eskiHata: null, eskiEttn: null, uuid: null };
  assert.equal(kaynakSecim({ ...temel, durum: "GONDERILMEDI" }).secilebilir, true);
  assert.equal(kaynakSecim({ ...temel, durum: "HATA" }).secilebilir, true);
  for (const durum of ["GONDERILIYOR", "BELIRSIZ", "KONTROL_GEREKLI", "GONDERILDI"]) assert.equal(kaynakSecim({ ...temel, durum }).secilebilir, false, durum);
  assert.equal(kaynakSecim({ ...temel, durum: "HATA", uuid: "x" }).secilebilir, false);
});

test("fatura isteği: yeni tip ve özel matrah alanları şemadan geçer", () => {
  const istek = {
    belgeNo: "ABC2026000000001", senaryo: "EARSIVFATURA", faturaTipi: "OZELMATRAH",
    alici: { vknTckn: "12345678901", ad: "Ali", soyad: "Veli", il: "Antalya", ilce: "Kaş" },
    satirlar: [{ ad: "Bilezik", miktar: 1, birimFiyat: 100000, kdvOrani: 20, ozelMatrahKodu: "805", ozelMatrahTutari: 5000 }],
  };
  const p = ebelgeDogrulaSchema.safeParse(istek);
  assert.ok(p.success, JSON.stringify(p.error?.issues));
  assert.equal(p.data!.satirlar[0].ozelMatrahTutari, 5000);
  assert.ok(ebelgeDogrulaSchema.safeParse({ ...istek, senaryo: "TEMELFATURA", faturaTipi: "TEVKIFATIADE" }).success);
  assert.ok(!ebelgeDogrulaSchema.safeParse({ ...istek, faturaTipi: "HALTIPI" }).success);
});

test("KNSK: numara gövdede taşınır ve biçimi doğrulanır", async () => {
  const { ebelgeKnskVknSchema, ebelgeKnskOnaySchema, ebelgeKnskListeSchema } = await import("../src/schemas/ebelge.schema.js");
  assert.ok(ebelgeKnskVknSchema.safeParse({ vkn: "12345678901" }).success);
  assert.ok(ebelgeKnskVknSchema.safeParse({ vkn: "1234567890" }).success);
  assert.ok(!ebelgeKnskVknSchema.safeParse({ vkn: "123" }).success);
  assert.ok(ebelgeKnskOnaySchema.safeParse({ vknTckn: "12345678901", ad: "Ali Veli", aciklama: null }).success);
  assert.ok(!ebelgeKnskOnaySchema.safeParse({ vknTckn: "12345678901x" }).success);
  assert.ok(ebelgeKnskListeSchema.safeParse({ yaklasan: "1" }).success);
});
