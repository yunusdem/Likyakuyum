import { z } from "zod";
export const ebelgeTarihSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => { const d = new Date(v); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; }, "Geçerli bir takvim tarihi giriniz (YYYY-AA-GG).");
/**
 * e-Belge (ICE entegratör) istek doğrulama şemaları.
 */
export const ebelgeAyarSchema = z.object({
    ortam: z.enum(["CANLI", "TEST"]).default("CANLI"),
    servisUrl: z
        .string()
        .trim()
        .min(1, "Servis adresi zorunludur.")
        .url("Servis adresi geçerli bir URL olmalıdır.")
        .refine((v) => v.toLowerCase().startsWith("https://"), {
        message: "Servis adresi https:// ile başlamalıdır.",
    })
        .refine((v) => {
        try {
            return new URL(v).hostname.toLowerCase().endsWith(".iceteknoloji.com.tr");
        }
        catch {
            return false;
        }
    }, { message: "Servis adresi yalnızca *.iceteknoloji.com.tr alan adında olabilir." }),
    kullaniciAdi: z.string().trim().min(1, "Entegratör kullanıcı adı zorunludur.").max(100),
    // Boş bırakılırsa mevcut şifre korunur
    sifre: z.string().max(200).optional(),
    uygulamaAdi: z.string().trim().min(1).max(50).default("LikyaKuyumERP"),
    uygulamaSurum: z.string().trim().min(1).max(50).default("1.0"),
    firmaVkn: z
        .string()
        .trim()
        .max(11)
        .refine((v) => v === "" || /^\d{10,11}$/.test(v), {
        message: "Firma VKN/TCKN 10 veya 11 haneli rakam olmalıdır.",
    })
        .default(""),
    firmaAlias: z.string().trim().max(150).default(""),
    aktif: z.boolean().default(false),
});
/* ==========================================================================
   Giden belge doğrulama (Faz 5)
   ========================================================================== */
const tarafSchema = z.object({
    vknTckn: z.string().trim().regex(/^\d{10}$|^\d{11}$/, "VKN 10, TCKN 11 haneli rakam olmalıdır."),
    unvan: z.string().trim().max(300).optional(),
    ad: z.string().trim().max(100).optional(),
    soyad: z.string().trim().max(100).optional(),
    vergiDairesi: z.string().trim().max(150).optional(),
    adres: z.string().trim().max(300).optional(),
    ilce: z.string().trim().max(100).optional(),
    il: z.string().trim().max(100).optional(),
    ulke: z.string().trim().max(100).optional(),
    telefon: z.string().trim().max(50).optional(),
    eposta: z.string().trim().max(150).optional(),
    webAdresi: z.string().trim().max(200).optional(),
});
const satirSchema = z.object({
    ad: z.string().trim().min(1, "Mal/hizmet adı zorunludur.").max(300),
    aciklama: z.string().trim().max(500).optional(),
    miktar: z.number().positive("Miktar sıfırdan büyük olmalıdır."),
    birimKodu: z.string().trim().max(10).optional(),
    birimFiyat: z.number().min(0, "Birim fiyat negatif olamaz."),
    iskontoOrani: z.number().min(0).max(99.99).optional(),
    kdvOrani: z.number().min(0).max(100),
    /** KDV istisnası — kdvOrani 0 ile birlikte kullanılır (GİB istisna kodu) */
    istisnaKodu: z.string().trim().max(10).optional(),
    istisnaGerekcesi: z.string().trim().max(300).optional(),
    /** KDV tevkifatı — oran KDV tutarı üzerinden uygulanır */
    tevkifatKodu: z.string().trim().max(10).optional(),
    tevkifatOrani: z.number().min(0).max(100).optional(),
});
export const ebelgeDogrulaSchema = z.object({
    belgeNo: z.string().trim().min(1, "Fatura numarası zorunludur."),
    uuid: z.string().trim().uuid().optional(),
    tarih: ebelgeTarihSchema.optional(),
    saat: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/).optional(),
    senaryo: z.enum(["TEMELFATURA", "TICARIFATURA", "EARSIVFATURA"]),
    faturaTipi: z.enum(["SATIS", "IADE", "TEVKIFAT", "ISTISNA", "OZELMATRAH", "IHRACKAYITLI"]),
    paraBirimi: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
    notlar: z.array(z.string().max(1000)).max(10).optional(),
    /** Boş bırakılırsa ayar + TODVZ_TANIM'dan tamamlanır */
    gonderici: tarafSchema.partial({ vknTckn: true }).optional(),
    alici: tarafSchema,
    satirlar: z.array(satirSchema).min(1, "Faturada en az bir satır bulunmalıdır.").max(500),
    /** IADE tipinde zorunlu: iade edilen asıl faturalar */
    iadeFaturalar: z
        .array(z.object({
        belgeNo: z.string().trim().min(1).max(40),
        tarih: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "İade referans tarihi YYYY-AA-GG olmalıdır."),
    }))
        .max(50)
        .optional(),
    /** TRY dışı belgelerde TL karşılığı kur */
    dovizKuru: z
        .object({
        kur: z.number().positive("Kur sıfırdan büyük olmalıdır."),
        tarih: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
    })
        .optional(),
    /** HTML önizleme istenip istenmediği */
    onizleme: z.boolean().default(true),
});
/** Taslak gönderimi — doğrulama şemasının aynısı + alıcı etiketi */
export const ebelgeTaslakSchema = ebelgeDogrulaSchema
    .omit({ onizleme: true })
    .extend({ aliciAlias: z.string().trim().max(150).optional() });
export const ebelgeArsivSenkronizeSchema = z.object({
    baslangic: ebelgeTarihSchema,
    bitis: ebelgeTarihSchema,
    limit: z.number().int().min(1).max(500).default(250),
}).refine((v) => v.baslangic <= v.bitis &&
    new Date(v.bitis).getTime() - new Date(v.baslangic).getTime() <= 366 * 86400000, "Tarih aralığı sıralı ve en fazla 366 gün olmalıdır.");
export const ebelgeArsivListeSchema = z.object({
    sayfa: z.coerce.number().int().min(1).max(100000).default(1),
    arama: z.string().trim().max(200).default(""),
});
export const ebelgeArsivStatuSchema = z.object({
    uuid: z.string().uuid(),
    statu: z.enum(["Okunmadı", "Okundu", "Islendi", "Islenmedi"]),
});
/* ==========================================================================
   e-İrsaliye (Faz 9)

   Alan adları UBL-TR şema sınıfından doğrulandı:
   ICE_INTAGRATION_v1.0.3/.../UBL/UBLTR-Delivery-2_1.cs
   ========================================================================== */
const irsTarafSchema = z.object({
    vknTckn: z.string().trim().regex(/^\d{10}$|^\d{11}$/, "VKN 10, TCKN 11 haneli rakam olmalıdır."),
    unvan: z.string().trim().max(300).optional(),
    ad: z.string().trim().max(100).optional(),
    soyad: z.string().trim().max(100).optional(),
    vergiDairesi: z.string().trim().max(150).optional(),
    adres: z.string().trim().max(300).optional(),
    ilce: z.string().trim().max(100).optional(),
    il: z.string().trim().max(100).optional(),
    telefon: z.string().trim().max(50).optional(),
    eposta: z.string().trim().max(150).optional(),
});
const irsSatirSchema = z.object({
    ad: z.string().trim().min(1, "Mal adı zorunludur.").max(300),
    aciklama: z.string().trim().max(500).optional(),
    miktar: z.number().positive("Sevk miktarı sıfırdan büyük olmalıdır."),
    birimKodu: z.string().trim().max(10).optional(),
    stokKodu: z.string().trim().max(60).optional(),
    marka: z.string().trim().max(150).optional(),
    not: z.string().trim().max(300).optional(),
});
const TARIH = /^\d{4}-\d{2}-\d{2}$/;
export const ebelgeIrsaliyeSchema = z.object({
    belgeNo: z.string().trim().min(1, "İrsaliye numarası zorunludur."),
    uuid: z.string().trim().max(60).optional(),
    tarih: z.string().trim().regex(TARIH, "Tarih YYYY-AA-GG biçiminde olmalıdır.").optional(),
    saat: z.string().trim().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
    senaryo: z.literal("TEMELIRSALIYE").optional(),
    irsaliyeTipi: z.enum(["SEVK", "MATBUDAN"]),
    notlar: z.array(z.string().max(1000)).max(10).optional(),
    gonderici: irsTarafSchema.partial({ vknTckn: true }).optional(),
    alici: irsTarafSchema,
    satirlar: z.array(irsSatirSchema).min(1, "İrsaliyede en az bir satır bulunmalıdır.").max(500),
    sevkiyat: z.object({
        sevkTarihi: z.string().trim().regex(TARIH, "Fiili sevk tarihi YYYY-AA-GG olmalıdır."),
        sevkSaati: z.string().trim().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
        plaka: z.string().trim().max(20).optional(),
        soforler: z
            .array(z.object({
            ad: z.string().trim().min(1).max(100),
            soyad: z.string().trim().min(1).max(100),
            tckn: z.string().trim().regex(/^\d{11}$/, "Şoför TCKN 11 haneli olmalıdır.").optional(),
        }))
            .max(5)
            .optional(),
        tasiyici: z
            .object({
            vknTckn: z.string().trim().regex(/^\d{10}$|^\d{11}$/),
            unvan: z.string().trim().min(1).max(300),
        })
            .optional(),
        teslimatAdresi: z
            .object({
            adres: z.string().trim().max(300).optional(),
            ilce: z.string().trim().max(100).optional(),
            il: z.string().trim().max(100).optional(),
            ulke: z.string().trim().max(100).optional(),
        })
            .optional(),
    }),
    siparisNo: z.string().trim().max(60).optional(),
    siparisTarihi: z.string().trim().regex(TARIH).optional(),
    aliciAlias: z.string().trim().max(150).optional(),
    onizleme: z.boolean().default(true),
});
/* ==========================================================================
   e-Gider Pusulası (Faz 8d)

   Alan adları ve enum değerleri GİB'in resmî paketinden alınmıştır:
   docs/ice/gib-faz8/gider-paketi/ (eArsiv.xsd + 4 örnek XML)
   ========================================================================== */
const gpTarafSchema = z.object({
    vknTckn: z.string().trim().regex(/^\d{10}$|^\d{11}$/, "VKN 10, TCKN 11 haneli rakam olmalıdır."),
    unvan: z.string().trim().max(300).optional(),
    ad: z.string().trim().max(100).optional(),
    soyad: z.string().trim().max(100).optional(),
    vergiDairesi: z.string().trim().max(150).optional(),
    adres: z.string().trim().max(300).optional(),
    ilce: z.string().trim().max(100).optional(),
    il: z.string().trim().max(100).optional(),
    telefon: z.string().trim().max(50).optional(),
    eposta: z.string().trim().max(150).optional(),
});
const gpSatirSchema = z.object({
    ad: z.string().trim().min(1, "Mal/hizmet adı zorunludur.").max(300),
    aciklama: z.string().trim().max(500).optional(),
    miktar: z.number().positive("Miktar sıfırdan büyük olmalıdır."),
    birimKodu: z.string().trim().max(10).optional(),
    birimFiyat: z.number().min(0, "Birim fiyat negatif olamaz."),
    vergiOrani: z.number().min(0).max(100),
});
export const ebelgeGiderPusulasiSchema = z.object({
    belgeNo: z.string().trim().min(1, "Belge numarası zorunludur."),
    uuid: z.string().trim().max(60).optional(),
    tarih: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalıdır.")
        .optional(),
    saat: z.string().trim().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
    belgeTipi: z.enum(["SATIS", "IADE"]),
    paraBirimi: z.string().trim().length(3).optional(),
    notlar: z.array(z.string().max(1000)).max(10).optional(),
    gonderici: gpTarafSchema.partial({ vknTckn: true }).optional(),
    alici: gpTarafSchema,
    satirlar: z.array(gpSatirSchema).min(1, "En az bir satır bulunmalıdır.").max(500),
    vergiTuruKodu: z.string().trim().regex(/^\d{4}$/, "Vergi türü kodu 4 haneli olmalıdır.").optional(),
    iadeDayanak: z
        .object({
        belgeTipi: z.enum(["EARSIV_FATURA", "BELGESIZ", "SATIS_FISI"]),
        belgeNo: z.string().trim().max(60).optional(),
        belgeTarihi: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Dayanak belge tarihi YYYY-AA-GG olmalıdır."),
    })
        .optional(),
    iadeKanali: z
        .object({
        tip: z.enum(["IADEKODU", "SMS"]),
        saglayiciAdi: z.string().trim().max(150),
        saglayiciVkn: z.string().trim().max(11),
        kod: z.string().trim().max(60).optional(),
        telefon: z.string().trim().max(20).optional(),
    })
        .optional(),
    kargo: z
        .object({
        vkn: z.string().trim().regex(/^\d{10}$/, "Kargo firması VKN 10 haneli olmalıdır."),
        unvan: z.string().trim().min(1).max(300),
        yetkiBelgeNo: z.string().trim().max(60).optional(),
        il: z.string().trim().max(100).optional(),
        ilce: z.string().trim().max(100).optional(),
    })
        .optional(),
});
