export const ResponseMessages = {
    // Auth
    LOGIN_SUCCESS: "Giriş işlemi başarılı.",
    LOGOUT_SUCCESS: "Çıkış işlemi başarılı.",
    REGISTER_SUCCESS: "Kullanıcı kaydı başarıyla oluşturuldu.",
    TOKEN_REFRESH_SUCCESS: "Oturum tokenı başarıyla yenilendi.",
    UNAUTHORIZED: "Geçersiz veya süresi dolmuş kimlik doğrulama tokenı.",
    FORBIDDEN: "Bu işlemi gerçekleştirmek için yetkiniz bulunmamaktadır.",
    INVALID_CREDENTIALS: "Kullanıcı adı veya şifre hatalı.",
    USER_ALREADY_EXISTS: "Bu kullanıcı adı veya e-posta ile kayıtlı kullanıcı zaten mevcut.",
    // User
    USER_CREATED: "Kullanıcı başarıyla oluşturuldu.",
    USER_UPDATED: "Kullanıcı bilgileri başarıyla güncellendi.",
    USER_DELETED: "Kullanıcı başarıyla silindi.",
    USER_NOT_FOUND: "Kullanıcı bulunamadı.",
    USERS_FETCHED: "Kullanıcı listesi başarıyla getirildi.",
    USER_FETCHED: "Kullanıcı detayı başarıyla getirildi.",
    // General
    SUCCESS: "İşlem başarılı.",
    VALIDATION_ERROR: "İstek doğrulama hatası.",
    RESOURCE_NOT_FOUND: "Talep edilen kaynak bulunamadı.",
    INTERNAL_SERVER_ERROR: "Sunucu tarafında beklenmeyen bir hata oluştu.",
    TOO_MANY_REQUESTS: "Çok fazla istek gönderildi, lütfen biraz sonra tekrar deneyin.",
    HEALTH_CHECK_OK: "Kuyumcu ERP API servisi sorunsuz çalışıyor.",
};
