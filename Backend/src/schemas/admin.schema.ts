import { z } from "zod";

const kullaniciAdi = z
  .string()
  .trim()
  .min(3, "Kullanıcı adı en az 3 karakter olmalıdır")
  .max(50, "Kullanıcı adı en fazla 50 karakter olabilir")
  .regex(/^[a-zA-Z0-9._-]+$/, "Kullanıcı adı yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir");

const adSoyad = z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır").max(100);

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Ürün paketi kodu (docs/LISANS_URUN_PAKETLERI.md)
const paketKodu = z.string().trim().regex(/^[a-z]{2,20}$/, "Geçersiz paket kodu");
/** Lisansın ürünleri; gönderilmezse lisansın ürün alanına dokunulmaz (eski usul serbest paket adı) */
export const urunlerAlani = z.array(paketKodu).max(10).optional();

export const adminGirisSchema = z.object({
  body: z.object({
    kullaniciAdi: z.string().min(1, "Kullanıcı adı girilmelidir").max(50),
    sifre: z.string().min(1, "Şifre girilmelidir").max(200),
  }),
});

// Şifre kuralı (8+ karakter, harf + rakam) serviste sifreKuralHatasi ile denetlenir.
export const adminSifreDegistirSchema = z.object({
  body: z.object({
    mevcutSifre: z.string().min(1, "Mevcut şifre girilmelidir").max(200),
    yeniSifre: z.string().min(1, "Yeni şifre girilmelidir").max(200),
  }),
});

export const adminEkleSchema = z.object({
  body: z.object({ kullaniciAdi, adSoyad }),
});

export const adminGuncelleSchema = z.object({
  params: idParam,
  body: z
    .object({
      adSoyad: adSoyad.optional(),
      durum: z.enum(["AKTIF", "PASIF"]).optional(),
    })
    .refine((b) => b.adSoyad !== undefined || b.durum !== undefined, { message: "Değiştirilecek alan yok" }),
});

export const adminIdSchema = z.object({ params: idParam });

// ---------------------------------------------------------------- Firmalar ---

const secmeli = (azami: number) => z.string().trim().max(azami).nullish();
const gun = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalıdır").refine(
  (v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
  "Geçersiz tarih"
);

const firmaGovdesi = z.object({
  firmaKodu: z
    .string()
    .trim()
    .min(2, "Firma kodu en az 2 karakter olmalıdır")
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, "Firma kodu yalnızca harf, rakam, alt çizgi ve tire içerebilir"),
  musteriNo: z
    .string()
    .trim()
    .min(3, "Müşteri no en az 3 karakter olmalıdır")
    .max(20)
    .regex(/^[a-zA-Z0-9]+$/, "Müşteri no yalnızca harf ve rakam içerebilir"),
  prgTur: z.coerce.number().int().min(0).max(999).optional(),
  unvan: z.string().trim().min(2, "Unvan en az 2 karakter olmalıdır").max(200),
  vknTckn: z
    .string()
    .trim()
    .regex(/^(\d{10}|\d{11})?$/, "VKN 10, TCKN 11 haneli olmalıdır")
    .nullish(),
  vergiDairesi: secmeli(100),
  yetkiliKisi: secmeli(100),
  telefon: secmeli(30),
  eposta: z.union([z.literal(""), z.string().trim().email("Geçerli bir e-posta giriniz").max(150)]).nullish(),
  adres: secmeli(500),
  baglantiModu: z.enum(["cloud", "local", "setup"]),
  dbServer: z.string().trim().min(1, "Veritabanı sunucusu girilmelidir").max(200),
  dbName: z.string().trim().min(1, "Veritabanı adı girilmelidir").max(128),
  dbUser: secmeli(128),
  // undefined: kayıtlı şifreye dokunma · "": sil · dolu: değiştir
  dbSifre: z.string().max(128).optional(),
});

export const firmaEkleSchema = z.object({ body: firmaGovdesi });

// Bulut firma: sunucumuzda şablondan yeni veritabanı (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.1)
const sqlAdi = (alan: string) =>
  z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_]{2,63}$/, `${alan} harfle başlamalı; yalnız harf, rakam ve alt çizgi içermeli (3-64 karakter)`);

export const bulutFirmaSchema = z.object({
  body: firmaGovdesi.omit({ baglantiModu: true, dbServer: true, dbName: true, dbUser: true, dbSifre: true }).extend({
    dbName: sqlAdi("Veritabanı adı"),
    dbUser: sqlAdi("Veritabanı kullanıcı adı"),
    dbSifre: z.string().min(8, "Veritabanı şifresi en az 8 karakter olmalıdır").max(128),
    ilkKullaniciAdi: z.string().trim().min(2, "İlk kullanıcı adı en az 2 karakter olmalıdır").max(50),
    ilkKullaniciAdSoyad: secmeli(100),
    lisansBitis: gun,
    kullaniciLimiti: z.coerce.number().int().min(1, "Kullanıcı limiti en az 1 olmalıdır").max(10000),
    urunler: urunlerAlani,
  }),
});
export const firmaGuncelleSchema = z.object({ params: idParam, body: firmaGovdesi });

export const firmaSilSchema = z.object({
  params: idParam,
  body: z.object({ onay: z.string().trim().min(1, "Onay için firma kodunu yazın").max(20) }),
});

const lisansParam = z.object({ id: z.coerce.number().int().positive(), lisansId: z.coerce.number().int().positive() });
export const lisansKodSchema = z.object({
  params: lisansParam,
  body: z.object({ makineKimligi: z.string().trim().min(19, "Makine kimliği XXXX-XXXX-XXXX-XXXX biçiminde olmalıdır").max(19) }),
});
export const lisansIptalSchema = z.object({ params: lisansParam });

export const ayarKaydetSchema = z.object({
  body: z.object({
    LISANS_ILETISIM_TELEFON: z.string().max(100).optional(),
    LISANS_ILETISIM_EPOSTA: z.string().max(150).optional(),
    LISANS_ILETISIM_METIN: z.string().max(2000).optional(),
    YEDEK_KLASORU: z.string().max(400).optional(),
    SURUM_KLASORU: z.string().max(400).optional(),
    SABLON_YEDEK_DOSYASI: z.string().max(400).optional(),
  }),
});

export const surumGuncelleSchema = z.object({
  params: z.object({ surum: z.string().min(1).max(30) }),
  body: z.object({ aktif: z.boolean().optional(), notlar: z.string().max(2000).nullish() }),
});
export const hedefSurumSchema = z.object({
  params: idParam,
  body: z.object({ surum: z.string().max(30).nullable() }),
});

export const indirSchema = z.object({ params: z.object({ token: z.string().min(20).max(100) }) });

export const firmaDurumSchema = z.object({
  params: idParam,
  body: z.object({ durum: z.enum(["AKTIF", "DONDURULMUS", "PASIF"]), not: secmeli(500) }),
});

export const firmaDogrulamaSchema = z.object({
  params: idParam,
  body: z.object({ dogrulandi: z.boolean(), not: secmeli(500) }),
});

// ------------------------------------------------------------- Kullanıcılar ---

// Firma kullanıcı adları eski programdan gelir (Türkçe harf, boşluk olabilir); TODVZ_KULLANICI.AD ile aynı sınır.
export const kullaniciEkleSchema = z.object({
  params: idParam,
  body: z.object({
    kullaniciAdi: z.string().trim().min(2, "Kullanıcı adı en az 2 karakter olmalıdır").max(50),
    adSoyad: secmeli(100),
    firmaYoneticisi: z.boolean().optional(),
  }),
});

export const kullaniciGuncelleSchema = z.object({
  params: idParam,
  body: z
    .object({
      adSoyad: secmeli(100),
      firmaYoneticisi: z.boolean().optional(),
      durum: z.enum(["AKTIF", "PASIF"]).optional(),
    })
    .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Değiştirilecek alan yok" }),
});

// ----------------------------------------------------------------- Modüller ---

const modulKodu = z.string().trim().min(1).max(100);

export const modulKatalogSchema = z.object({
  body: z.object({
    moduller: z
      .array(
        z.object({
          modulKodu,
          ustKodu: modulKodu.nullable(),
          baslik: z.string().trim().min(1).max(200),
          tur: z.enum(["ANA", "ALT", "UST_KISAYOL"]),
          sira: z.number().int().min(0),
        })
      )
      .min(1)
      .max(2000),
  }),
});

export const firmaModulSchema = z.object({
  params: idParam,
  body: z.object({
    kisitsiz: z.boolean().optional(),
    acik: z.array(modulKodu).max(2000).optional(),
    paketeDon: z.boolean().optional(),
  }),
});

// ------------------------------------------------- Ürün paketleri (docs/LISANS_URUN_PAKETLERI.md) ---


export const paketIlkIcerikSchema = z.object({
  body: z.object({ icerik: z.record(paketKodu, z.array(modulKodu).max(2000)) }),
});

export const paketYazSchema = z.object({
  params: z.object({ kod: paketKodu }),
  body: z.object({ moduller: z.array(modulKodu).max(2000), uygula: z.boolean() }),
});

export const paketOnizlemeSchema = z.object({
  params: idParam,
  body: z.object({ urunler: z.array(paketKodu).max(10) }),
});

// ------------------------------------------------------------------ İzleme ---

const sayfalama = {
  sayfa: z.coerce.number().int().min(1).default(1),
  boyut: z.coerce.number().int().min(1).max(200).default(50),
  arama: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
};

export const girisLogSchema = z.object({
  query: z.object({
    ...sayfalama,
    firmaId: z.coerce.number().int().positive().optional(),
    tur: z.enum(["ADMIN", "KULLANICI"]).optional(),
    basarili: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  }),
});

export const islemLogSchema = z.object({ query: z.object(sayfalama) });

export const oturumKapatSchema = z.object({ params: z.object({ sid: z.string().uuid("Geçersiz oturum kimliği") }) });

// ------------------------------------------------------- E-posta doğrulaması ---

export const epostaDogrulamaElleSchema = z.object({
  params: idParam,
  body: z.object({ dogrulandi: z.boolean() }),
});

// base64url, 32 bayt = 43 karakter; biraz pay bırakıldı
export const epostaOnaySchema = z.object({
  body: z.object({ anahtar: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/, "Geçersiz bağlantı") }),
});

export const lisansEkleSchema = z.object({
  params: idParam,
  body: z.object({
    lisansAnahtari: secmeli(100),
    baslangic: gun,
    bitis: gun,
    kullaniciLimiti: z.coerce.number().int().min(1, "Kullanıcı limiti en az 1 olmalıdır").max(10000),
    paketAdi: secmeli(100),
    notlar: secmeli(1000),
    urunler: urunlerAlani,
  }),
});
