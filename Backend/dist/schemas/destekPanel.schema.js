import { z } from "zod";
import { EK_AZAMI_ADET, METIN_AZAMI, TALEP_TURLERI } from "../types/destek.types.js";
const idParam = z.object({ id: z.coerce.number().int().positive() });
const metin = z.string().trim().min(1, "Mesaj boş olamaz").max(METIN_AZAMI, `Mesaj en çok ${METIN_AZAMI} karakter olabilir`);
const ek = z.object({
    dosyaAdi: z.string().max(200).optional().default(""),
    mime: z.string().max(50),
    veri: z.string().min(1).max(4_500_000),
});
export const panelIdSchema = z.object({ params: idParam });
export const panelGirisSchema = z.object({
    body: z.object({
        kullaniciAdi: z.string().trim().min(1, "Kullanıcı adı girilmelidir").max(50),
        sifre: z.string().min(1, "Şifre girilmelidir").max(200),
    }),
});
export const panelSifreSchema = z.object({
    body: z.object({ mevcutSifre: z.string().min(1).max(200), yeniSifre: z.string().min(1).max(200) }),
});
export const panelKonuListeSchema = z.object({
    query: z.object({
        sekme: z.enum(["havuz", "benim", "tumu", "sistem"]).optional().default("havuz"),
        durum: z.string().max(20).optional(),
        firmaId: z.coerce.number().int().positive().optional(),
        personelId: z.coerce.number().int().positive().optional(),
        kaynakKonuId: z.coerce.number().int().positive().optional(),
        arama: z.string().max(100).optional(),
        sayfa: z.coerce.number().int().positive().optional(),
        sayfaBoyu: z.coerce.number().int().positive().max(200).optional(),
    }),
});
export const panelMesajSchema = z.object({
    params: idParam,
    body: z.object({ metin, icNot: z.boolean().optional().default(false), ekler: z.array(ek).max(EK_AZAMI_ADET).optional() }),
});
export const panelAktarSchema = z.object({
    params: idParam,
    body: z.object({ personelId: z.number().int().positive().nullable() }),
});
export const panelDurumSchema = z.object({
    params: idParam,
    body: z.object({ durum: z.enum(["KAPALI", "ACIK"]) }),
});
export const telefonTalebiSchema = z.object({
    body: z.object({
        firmaId: z.number().int().positive(),
        kullaniciId: z.number().int().positive().nullish(),
        baslik: z.string().trim().min(1, "Başlık girilmelidir").max(200),
        metin,
        talepTuru: z.enum(TALEP_TURLERI).optional(),
        oncelik: z.enum(["NORMAL", "ACIL"]).optional(),
    }),
});
export const musteriListeSchema = z.object({ query: z.object({ arama: z.string().max(100).optional() }) });
export const hizliCevapListeSchema = z.object({ query: z.object({ hepsi: z.enum(["0", "1"]).optional() }) });
export const hizliCevapYazSchema = z.object({
    body: z.object({
        cevapId: z.number().int().positive().nullish(),
        baslik: z.string().trim().min(1, "Başlık girilmelidir").max(100),
        metin: z.string().trim().min(1, "Metin girilmelidir").max(METIN_AZAMI),
        sira: z.number().int().min(0).max(9999).optional(),
        aktif: z.boolean().optional(),
    }),
});
const rol = z.enum(["ADMIN", "PERSONEL"]);
const gorme = z.enum(["TUMU", "ATANAN"]);
export const personelEkleSchema = z.object({
    body: z.object({
        kullaniciAdi: z.string().trim().min(3, "Kullanıcı adı en az 3 karakter olmalıdır").max(50),
        adSoyad: z.string().trim().min(1, "Ad soyad girilmelidir").max(100),
        rol: rol.optional().default("PERSONEL"),
        gorme: gorme.optional().default("TUMU"),
    }),
});
export const personelGuncelleSchema = z.object({
    params: idParam,
    body: z
        .object({
        adSoyad: z.string().trim().max(100).optional(),
        rol: rol.optional(),
        gorme: gorme.optional(),
        durum: z.enum(["AKTIF", "PASIF"]).optional(),
    })
        .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Değiştirilecek alan yok" }),
});
const tarih = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalıdır");
export const raporSchema = z.object({ query: z.object({ bas: tarih, bit: tarih }) });
