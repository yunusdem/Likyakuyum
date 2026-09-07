import { z } from "zod";
import { UserRole } from "../constants/roles.js";
export const loginSchema = z.object({
    body: z.object({
        username: z.string().min(1, "Kullanıcı adı girilmelidir"),
        password: z.string().min(1, "Şifre girilmelidir"),
        dbServer: z.string().min(1, "Lütfen sunucu adını seçiniz veya giriniz"),
        dbName: z.string().min(1, "Lütfen veritabanı adını seçiniz veya giriniz"),
        dbUser: z.string().optional(),
        dbPassword: z.string().optional(),
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
