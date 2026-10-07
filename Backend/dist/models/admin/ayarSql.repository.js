import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
/** ADM_AYAR: panelden düzenlenen genel ayarlar (docs/sql/LIKYA_ADMIN_BULUT_KURULUM.sql). */
export const AYAR_ANAHTARLARI = [
    "LISANS_ILETISIM_TELEFON",
    "LISANS_ILETISIM_EPOSTA",
    "LISANS_ILETISIM_METIN",
    "YEDEK_KLASORU",
    "SURUM_KLASORU",
    "SABLON_YEDEK_DOSYASI",
];
export const AYAR_VARSAYILAN = {
    LISANS_ILETISIM_TELEFON: "",
    LISANS_ILETISIM_EPOSTA: "",
    LISANS_ILETISIM_METIN: "Lisans süreniz doldu. Programı kullanmaya devam etmek için lütfen bizimle iletişime geçin.",
    YEDEK_KLASORU: "C:\\LikyaYedek",
    SURUM_KLASORU: "C:\\LikyaYedek\\Surumler",
    SABLON_YEDEK_DOSYASI: "C:\\LikyaYedek\\Sablon\\sablon.bak",
};
export class AyarSqlRepository {
    /** Tüm ayarlar; tablo yoksa ya da satır boşsa varsayılan döner. */
    static async tumu() {
        const sonuc = { ...AYAR_VARSAYILAN };
        try {
            const pool = await getAdminPool();
            const res = await pool
                .request()
                .query(`IF OBJECT_ID('dbo.ADM_AYAR') IS NOT NULL SELECT ANAHTAR, DEGER FROM dbo.ADM_AYAR`);
            for (const r of (res.recordset ?? [])) {
                const k = String(r.ANAHTAR);
                if (k in sonuc) {
                    const v = String(r.DEGER ?? "").trim();
                    // Klasör / dosya ayarları boşsa varsayılan; metin ayarları boş bırakılabilir
                    if (v !== "" || k.startsWith("LISANS_ILETISIM"))
                        sonuc[k] = v;
                }
            }
        }
        catch {
            // admin veritabanına ulaşılamıyorsa varsayılanlar
        }
        return sonuc;
    }
    static async oku(anahtar) {
        return (await this.tumu())[anahtar];
    }
    static async yaz(anahtar, deger, adminId) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("anahtar", sql.VarChar(60), anahtar)
            .input("deger", sql.NVarChar(2000), deger)
            .input("adminId", sql.Int, adminId)
            .query(`
        MERGE dbo.ADM_AYAR WITH (HOLDLOCK) AS h
        USING (SELECT @anahtar AS ANAHTAR) AS k ON h.ANAHTAR = k.ANAHTAR
        WHEN MATCHED THEN UPDATE SET DEGER = @deger, DEGISTIREN_ADMIN_ID = @adminId, TARIH = GETDATE()
        WHEN NOT MATCHED THEN INSERT (ANAHTAR, DEGER, DEGISTIREN_ADMIN_ID) VALUES (@anahtar, @deger, @adminId);
      `);
    }
}
