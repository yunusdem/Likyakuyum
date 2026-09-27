import { z } from "zod";
import { UserRole } from "../constants/roles.js";
// Giriş = Müşteri No + seçilen veritabanı (firmaId) + kullanıcı adı + şifre. Sunucu / veritabanı / SQL kullanıcısı ve
// şifresi artık istemciden alınmaz; firma kaydından (LIKYA_ADMIN) çözülür (docs/GIRIS_VE_EBELGE_DUZENLEME.md G3-G4).
export const loginSchema = z.object({
    body: z.object({
        musteriNo: z.string().trim().min(1, "Müşteri no girilmelidir").max(20),
        firmaId: z.coerce.number().int().positive("Lütfen veritabanını seçiniz"),
        username: z.string().min(1, "Kullanıcı adı girilmelidir"),
        password: z.string().min(1, "Şifre girilmelidir"),
    }),
});
export const musteriVeritabanlariSchema = z.object({
    query: z.object({
        musteriNo: z.string().trim().min(1, "Müşteri no girilmelidir").max(20),
    }),
});
export const registerSchema = z.object({
    body: z.object({
        username: z
            .string()
            .min(3, "Kullanıcı adı en az 3 karakter olmalıdır")
            .max(30, "Kullanıcı adı en fazla 30 karakter olabilir")
            .regex(/^[a-zA-Z0-9_-]+$/, "Kullanıcı adı yalnızca harf, rakam, alt çizgi ve tire içerebilir"),
        fullName: z.string().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
        email: z.string().email("Geçerli bir e-posta adresi giriniz").optional(),
        password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
        role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.USER]).default(UserRole.USER),
        cashierCode: z.string().default("00"),
    }),
});
export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, "Refresh token zorunludur"),
    }),
});
// Şifre kuralı (8+ karakter, harf + rakam) serviste sifreKuralHatasi ile denetlenir.
export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1, "Mevcut şifre girilmelidir").max(200),
        newPassword: z.string().min(1, "Yeni şifre girilmelidir").max(200),
    }),
});
