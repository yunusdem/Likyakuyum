import { z } from "zod";
import { BILDIRIM_TURLERI, EK_AZAMI_ADET, METIN_AZAMI, TALEP_TURLERI } from "../types/destek.types.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Görsel: base64 metin (3 MB ≈ 4,2 MB base64). Boyut ve tür denetimi serviste (DestekEkService.dogrula).
const ek = z.object({
  dosyaAdi: z.string().max(200).optional().default(""),
  mime: z.string().max(50),
  veri: z.string().min(1).max(4_500_000),
});
const ekler = z.array(ek).max(EK_AZAMI_ADET).optional();
const metin = z.string().trim().min(1, "Mesaj boş olamaz").max(METIN_AZAMI, `Mesaj en çok ${METIN_AZAMI} karakter olabilir`);
const yerelAnahtar = z.string().max(60).nullish();

export const destekIdSchema = z.object({ params: idParam });

export const destekListeSchema = z.object({
  query: z.object({ sekme: z.enum(["tumu", "talepler", "bildirimler", "arsiv"]).optional().default("tumu") }),
});

export const talepAcSchema = z.object({
  body: z.object({
    baslik: z.string().trim().min(1, "Başlık girilmelidir").max(200),
    metin,
    talepTuru: z.enum(TALEP_TURLERI as [string, ...string[]]).optional(),
    oncelik: z.enum(["NORMAL", "ACIL"]).optional(),
    ekran: z.string().max(200).nullish(),
    ekler,
    yerelAnahtar,
  }),
});

export const mesajYazSchema = z.object({
  params: idParam,
  body: z.object({ metin, ekler, yerelAnahtar }),
});

export const okunduSchema = z.object({
  body: z.object({ konuId: z.number().int().positive().nullish() }).optional().default({}),
});

export const bayrakSchema = z.object({
  params: idParam,
  body: z.object({ deger: z.boolean().optional().default(true) }).optional().default({ deger: true }),
});

// ------------------------------------------------------------------- Admin ---

export const adminKonuListeSchema = z.object({
  query: z.object({
    tur: z.enum(["TALEP", "SISTEM", "BILDIRIM", "TALEP_SISTEM"]).optional(),
    durum: z.string().max(20).optional(),
    firmaId: z.coerce.number().int().positive().optional(),
    atananAdminId: z.coerce.number().int().positive().optional(),
    kaynakKonuId: z.coerce.number().int().positive().optional(),
    arama: z.string().max(100).optional(),
    sayfa: z.coerce.number().int().positive().optional(),
    sayfaBoyu: z.coerce.number().int().positive().max(200).optional(),
  }),
});

export const adminMesajSchema = z.object({
  params: idParam,
  body: z.object({ metin, icNot: z.boolean().optional().default(false) }),
});

export const adminKonuGuncelleSchema = z.object({
  params: idParam,
  body: z
    .object({
      durum: z.enum(["KAPALI", "ACIK"]).optional(),
      atananAdminId: z.number().int().positive().nullable().optional(),
    })
    .refine((b) => b.durum !== undefined || b.atananAdminId !== undefined, { message: "Değiştirilecek alan yok" }),
});

const bildirimGovde = z.object({
  baslik: z.string().trim().min(1, "Başlık girilmelidir").max(200),
  metin,
  bildirimTuru: z.enum(BILDIRIM_TURLERI as [string, ...string[]]),
  onemli: z.boolean().optional().default(false),
  cevapAlir: z.boolean().optional().default(true),
  hedef: z.enum(["TUMU", "FIRMA", "KULLANICI"]),
  firmaIds: z.array(z.number().int().positive()).max(5000).optional(),
  kullaniciIds: z.array(z.number().int().positive()).max(5000).optional(),
  gonder: z.boolean().optional().default(false),
});

export const bildirimOlusturSchema = z.object({ body: bildirimGovde });
export const bildirimGuncelleSchema = z.object({ params: idParam, body: bildirimGovde });
