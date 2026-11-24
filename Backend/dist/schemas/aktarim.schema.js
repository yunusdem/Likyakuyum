import { z } from "zod";
// Eski programdan veri aktarımı (docs/VERITABANI_TASIMA_YOL_HARITASI.md)
const firmaParam = z.object({ id: z.coerce.number().int().positive() });
const yuklemeParam = firmaParam.extend({ yuklemeId: z.string().regex(/^[a-f0-9]{24}$/, "Geçersiz yükleme kimliği.") });
export const aktarimFirmaSchema = z.object({ params: firmaParam });
export const yuklemeBaslatSchema = z.object({
    params: firmaParam,
    body: z.object({
        dosyaAdi: z.string().trim().min(1).max(260),
        boyut: z.coerce.number().int().positive(),
    }),
});
export const yuklemeSchema = z.object({ params: yuklemeParam });
export const parcaSchema = z.object({ params: yuklemeParam.extend({ sira: z.coerce.number().int().positive() }) });
export const aktarSchema = z.object({
    params: yuklemeParam,
    body: z.object({
        onay: z.string().trim().min(1, "Onay için firma kodunu yazın.").max(50),
        esFirmaId: z.coerce.number().int().positive().nullish(),
        rol: z.enum(["RESMI", "CALISMA"]).nullish(),
        taslakOnay: z.boolean().nullish(),
        firmaOnay: z.boolean().nullish(),
    }),
});
// Aktarım kilidi (§13): onay = firma kodu, neden zorunlu
export const kilitAcSchema = z.object({
    params: firmaParam,
    body: z.object({
        onay: z.string().trim().min(1, "Onay için firma kodunu yazın.").max(50),
        neden: z.string().trim().min(5, "Kilidi neden açtığınızı yazın (en az 5 karakter).").max(500),
    }),
});
export const isSchema = z.object({ params: firmaParam.extend({ isId: z.string().regex(/^[a-f0-9]{16}$/, "Geçersiz iş kimliği.") }) });
