import { z } from "zod";
// Tanıtım sitesi iletişim / ön bilgi formu (docs/ILETISIM_FORMU_YOL_HARITASI.md İ3, İ8). Giriş gerektirmez.
const bosOlabilir = (enFazla) => z
    .string()
    .trim()
    .max(enFazla)
    .optional()
    .transform((v) => v || "");
export const iletisimFormSchema = z.object({
    body: z.object({
        adSoyad: z.string().trim().min(2, "Adınızı ve soyadınızı yazın").max(100),
        firma: bosOlabilir(150),
        telefon: z
            .string()
            .trim()
            .min(1, "Telefon numaranızı yazın")
            .max(30)
            .refine((v) => (v.replace(/\D/g, "").length >= 10), "Telefon numarası eksik görünüyor"),
        eposta: z
            .string()
            .trim()
            .max(150)
            .optional()
            .transform((v) => v || "")
            .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-posta adresi geçersiz"),
        sehir: bosOlabilir(60),
        mesaj: bosOlabilir(2000),
        // Hangi sayfadan geldi (yalnız mail konusunda görünür)
        kaynak: z.enum(["ana-sayfa", "iletisim"]).default("ana-sayfa"),
        // Honeypot: gerçek kullanıcı görmez, botlar doldurur
        web: bosOlabilir(500),
    }),
});
