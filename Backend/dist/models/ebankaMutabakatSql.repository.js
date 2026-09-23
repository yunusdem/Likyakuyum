import sql from "mssql";
import { logger } from "../utils/logger.js";
import { EBankaVeriSqlRepository } from "./ebankaVeriSql.repository.js";
const zaman = (d) => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null);
const gunTarihi = (g) => new Date(`${g}T00:00:00Z`);
export class EBankaMutabakatSqlRepository {
    static hazirHavuzlar = new WeakSet();
    /** Havuz başına hangi fiş tablolarının bulunduğu (sarraf tabloları uygulamaca oluşturulmaz, her veritabanında olmayabilir) */
    static tablolar = new WeakMap();
    static async pool(dbContext) {
        const pool = await EBankaVeriSqlRepository.pool(dbContext);
        if (!this.hazirHavuzlar.has(pool)) {
            try {
                await pool.request().batch(`
          IF OBJECT_ID('TODVZ_EBANKA_MUTABAKAT', 'U') IS NULL
          BEGIN
            CREATE TABLE [dbo].[TODVZ_EBANKA_MUTABAKAT] (
              [VOMSIS_ID] BIGINT NOT NULL,
              [FIS_TURU] VARCHAR(10) NOT NULL,
              [FIS_ID] INT NOT NULL,
              [OTOMATIK] BIT NOT NULL DEFAULT 0,
              -- 1: kullanıcı bu eşleşmeyi kaldırdı; otomatik eşleştirme bu fişi bu harekete bir daha önermez
              [RED] BIT NOT NULL DEFAULT 0,
              [EKLEYEN_ID] INT NULL,
              [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT [PK_TODVZ_EBANKA_MUTABAKAT] PRIMARY KEY ([VOMSIS_ID], [FIS_TURU], [FIS_ID])
            );
            CREATE INDEX [IX_TODVZ_EBANKA_MUTABAKAT_FIS] ON [dbo].[TODVZ_EBANKA_MUTABAKAT] ([FIS_TURU], [FIS_ID]);
          END;

          IF OBJECT_ID('TODVZ_EBANKA_MUTABAKAT_ISARET', 'U') IS NULL
          BEGIN
            CREATE TABLE [dbo].[TODVZ_EBANKA_MUTABAKAT_ISARET] (
              [VOMSIS_ID] BIGINT NOT NULL PRIMARY KEY,
              [FATURA_GEREKMEZ] BIT NOT NULL DEFAULT 0,
              [NOTU] NVARCHAR(250) NULL,
              [GUNCELLEYEN_ID] INT NULL,
              [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
            );
          END;
        `);
            }
            catch (err) {
                logger.warn(`[EBankaMutabakatSqlRepository.ensureTables] Warning: ${err.message}`);
            }
            const adlar = (await pool.request().query(`
          SELECT name FROM sys.tables WHERE name IN ('TODVZ_FIS','TODVZ_FIS_SATIRI','TODVZ_SARRAF_FISI','TODVZ_SARRAF_FISI_SATIRI','TODVZ_ODEME_SATIRI','TODVZ_FATURA','TODVZ_EBELGE_GIDEN','TODVZ_EBELGE_GELEN','TODVZ_CARI_KART')
        `)).recordset.map((r) => String(r.name).toUpperCase());
            const kolonlar = (await pool.request().query(`SELECT COL_LENGTH('TODVZ_FIS','E_FATURA_ETTN') AS ETTN, COL_LENGTH('TODVZ_FIS','ODEME_TUTARI') AS ODEME`)).recordset[0];
            const kume = new Set(adlar);
            if (kolonlar.ETTN !== null)
                kume.add("FIS.E_FATURA_ETTN");
            if (kolonlar.ODEME !== null)
                kume.add("FIS.ODEME_TUTARI");
            this.tablolar.set(pool, kume);
            this.hazirHavuzlar.add(pool);
        }
        return pool;
    }
    static async var(pool, ad) {
        return this.tablolar.get(pool)?.has(ad) ?? false;
    }
    // ─── Banka hareketleri ─────────────────────────────────────────────────────
    static async hareketler(baslangic, bitis, dbContext) {
        const pool = await this.pool(dbContext);
        const req = pool.request();
        req.input("BAS", sql.DateTime, gunTarihi(baslangic));
        req.input("BIT", sql.DateTime, new Date(gunTarihi(bitis).getTime() + 86_400_000 - 1000));
        const rows = (await req.query(`
        SELECT t.*, k.BANKA_ID AS KART_BANKA_ID, h.HESAP_NO, b.BANKA_ADI, p.TIP_ADI, ISNULL(p.KURAL, 0) AS KURAL, p.CARI_KART_ID AS TIP_CARI_ID,
               i.FATURA_GEREKMEZ, i.NOTU
        FROM TODVZ_EBANKA_HAREKET t
        LEFT JOIN TODVZ_EBANKA_HESAP h ON h.VOMSIS_HESAP_ID = t.VOMSIS_HESAP_ID
        LEFT JOIN TODVZ_BANKA k ON k.BANKA_ID = h.BANKA_ID
        LEFT JOIN TODVZ_EBANKA_BANKA b ON b.VOMSIS_BANKA_ID = h.VOMSIS_BANKA_ID
        LEFT JOIN TODVZ_EBANKA_HAREKET_TIPI p ON p.TIP_KODU = t.TIP_KODU
        LEFT JOIN TODVZ_EBANKA_MUTABAKAT_ISARET i ON i.VOMSIS_ID = t.VOMSIS_ID
        WHERE t.SISTEM_TARIHI BETWEEN @BAS AND @BIT AND t.TUTAR <> 0
        ORDER BY t.SISTEM_TARIHI DESC, t.VOMSIS_ID DESC
      `)).recordset;
        return rows.map((r) => ({
            vomsisId: Number(r.VOMSIS_ID),
            vomsisHesapId: r.VOMSIS_HESAP_ID,
            bankaId: r.KART_BANKA_ID ?? null,
            bankaAdi: r.BANKA_ADI || "",
            hesapNo: r.HESAP_NO ?? null,
            tipKodu: r.TIP_KODU ?? null,
            tipAdi: r.TIP_ADI ?? null,
            tipKurali: (Number(r.KURAL) || 0),
            tipCariId: r.TIP_CARI_ID ?? null,
            sistemTarihi: zaman(r.SISTEM_TARIHI),
            doviz: r.DOVIZ ?? null,
            tutar: Number(r.TUTAR) || 0,
            aciklama: r.ACIKLAMA ?? null,
            fisNo: r.FIS_NO ?? null,
            evrakNo: r.EVRAK_NO ?? null,
            karsiUnvan: r.KARSI_UNVAN ?? null,
            karsiIban: r.KARSI_IBAN ?? null,
            karsiVkn: r.KARSI_VKN ?? null,
            gonderenAd: r.GONDEREN_AD ?? null,
            gonderenUnvan: r.GONDEREN_UNVAN ?? null,
            gonderenTckn: r.GONDEREN_TCKN ?? null,
            gonderenVkn: r.GONDEREN_VKN ?? null,
            gonderenIban: r.GONDEREN_IBAN ?? null,
            aliciIban: r.ALICI_IBAN ?? null,
            odeyenVkn: r.ODEYEN_VKN ?? null,
            aktarilanCariId: r.CARI_KART_ID ?? null,
            faturaGerekmez: Boolean(r.FATURA_GEREKMEZ),
            not: r.NOTU ?? null,
        }));
    }
    // ─── Fişler ────────────────────────────────────────────────────────────────
    /**
     * Fişleri tek biçimde okur. Ya cari + tarih aralığıyla (aday arama) ya da tür/kimlik listesiyle (eşlenmiş fişler).
     * Faturalanma: döviz → satırda e-belge gönderilmiş ya da başlıkta ETTN ya da giden e-belge kaydı; sarraf → giden e-belge kaydı;
     * perakende → kendi e-belge durumu; alış (giden para) → carinin VKN'sinden ±30 gün içinde reddedilmemiş gelen e-fatura.
     */
    static async fisler(secim, dbContext) {
        const pool = await this.pool(dbContext);
        const giden = await this.var(pool, "TODVZ_EBELGE_GIDEN");
        const gelen = (await this.var(pool, "TODVZ_EBELGE_GELEN")) && (await this.var(pool, "TODVZ_CARI_KART"));
        const cariVar = await this.var(pool, "TODVZ_CARI_KART");
        const temizId = (liste) => [...new Set(liste.filter((n) => Number.isSafeInteger(n) && n > 0))];
        const gidenGonderildi = (evrakTuru, idKolonu) => giden ? `EXISTS (SELECT 1 FROM TODVZ_EBELGE_GIDEN g WHERE g.KAYNAK_FIS_ID LIKE CONCAT('${evrakTuru}:', ${idKolonu}, ':%') AND g.GONDERIM_DURUMU = 'GONDERILDI')` : "0 = 1";
        const gelenFatura = (tarihKolonu) => gelen
            ? `EXISTS (SELECT 1 FROM TODVZ_EBELGE_GELEN e WHERE LEN(LTRIM(RTRIM(ISNULL(c.VERGI_KIMLIK_NO, '')))) >= 10
             AND e.SENDER LIKE '%' + LTRIM(RTRIM(c.VERGI_KIMLIK_NO)) + '%' AND ISNULL(e.RED_KABUL, '') <> 'RED'
             AND e.DUZENLEME_TARIHI BETWEEN DATEADD(DAY, -30, ${tarihKolonu}) AND DATEADD(DAY, 30, ${tarihKolonu}))`
            : "0 = 1";
        const cariJoin = (kolon) => (cariVar ? `LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = ${kolon}` : "");
        const cariAd = cariVar ? "LTRIM(RTRIM(c.AD))" : "NULL";
        const req = pool.request();
        let kosul;
        if ("cariIdler" in secim) {
            const idler = temizId(secim.cariIdler);
            if (!idler.length)
                return [];
            req.input("BAS", sql.DateTime, gunTarihi(secim.baslangic));
            req.input("BIT", sql.DateTime, new Date(gunTarihi(secim.bitis).getTime() + 86_400_000 - 1000));
            kosul = (_t, _i, cariKolonu, tarihKolonu) => `${cariKolonu} IN (${idler.join(",")}) AND ${tarihKolonu} BETWEEN @BAS AND @BIT`;
        }
        else {
            const grup = (t) => temizId(secim.kimlikler.filter((k) => k.fisTuru === t).map((k) => k.fisId));
            kosul = (t, idKolonu) => {
                const idler = grup(t);
                return idler.length ? `${idKolonu} IN (${idler.join(",")})` : "0 = 1";
            };
        }
        const parcalar = [];
        if ((await this.var(pool, "TODVZ_FIS")) && (await this.var(pool, "TODVZ_FIS_SATIRI"))) {
            const odenen = (await this.var(pool, "FIS.ODEME_TUTARI")) ? "ISNULL(NULLIF(f.ODEME_TUTARI, 0), f.TOPLAM_TUTAR)" : "f.TOPLAM_TUTAR";
            const ettn = (await this.var(pool, "FIS.E_FATURA_ETTN")) ? "LEN(ISNULL(f.E_FATURA_ETTN, '')) > 0 OR " : "";
            parcalar.push(`
        SELECT 'doviz' AS FIS_TURU, f.FIS_ID AS FIS_ID, LTRIM(RTRIM(CONCAT(f.SERI_NO, f.BELGE_NO))) AS FIS_NO, f.TARIH, f.CARI_KART_ID, ${cariAd} AS CARI_ADI,
               CASE WHEN f.TIP = 0 THEN 'giden' ELSE 'gelen' END AS YON,
               CAST(${odenen} AS DECIMAL(18,2)) AS TUTAR, CAST(f.TOPLAM_TUTAR AS DECIMAL(18,2)) AS FIS_TOPLAMI,
               CASE WHEN f.TIP = 0 THEN CASE WHEN ${gelenFatura("f.TARIH")} THEN 1 ELSE 0 END
                    ELSE CASE WHEN ${ettn}EXISTS (SELECT 1 FROM TODVZ_FIS_SATIRI s WHERE s.FIS_ID = f.FIS_ID AND s.E_BELGE_DURUMU = 1) OR ${gidenGonderildi(99, "f.FIS_ID")} THEN 1 ELSE 0 END END AS FATURALI
        FROM TODVZ_FIS f ${cariJoin("f.CARI_KART_ID")}
        WHERE ISNULL(f.IPTAL, 0) = 0 AND ${kosul("doviz", "f.FIS_ID", "f.CARI_KART_ID", "f.TARIH")}`);
        }
        if ((await this.var(pool, "TODVZ_SARRAF_FISI")) && (await this.var(pool, "TODVZ_ODEME_SATIRI")) && (await this.var(pool, "TODVZ_SARRAF_FISI_SATIRI"))) {
            parcalar.push(`
        SELECT 'sarraf' AS FIS_TURU, f.SARRAF_FISI_ID AS FIS_ID, LTRIM(RTRIM(CAST(f.FIS_NO AS VARCHAR(50)))) AS FIS_NO, f.TARIH, f.CARI_KART_ID, ${cariAd} AS CARI_ADI,
               CASE WHEN f.TIP = 0 THEN 'giden' ELSE 'gelen' END AS YON,
               CAST(ISNULL(NULLIF((SELECT SUM(o.TUTAR) FROM TODVZ_ODEME_SATIRI o WHERE o.SARRAF_FISI_ID = f.SARRAF_FISI_ID), 0),
                           (SELECT SUM(s.TUTAR) FROM TODVZ_SARRAF_FISI_SATIRI s WHERE s.SARRAF_FISI_ID = f.SARRAF_FISI_ID)) AS DECIMAL(18,2)) AS TUTAR,
               CAST(ISNULL((SELECT SUM(s.TUTAR) FROM TODVZ_SARRAF_FISI_SATIRI s WHERE s.SARRAF_FISI_ID = f.SARRAF_FISI_ID), 0) AS DECIMAL(18,2)) AS FIS_TOPLAMI,
               CASE WHEN f.TIP = 0 THEN CASE WHEN ${gelenFatura("f.TARIH")} THEN 1 ELSE 0 END
                    ELSE CASE WHEN ${gidenGonderildi(0, "f.SARRAF_FISI_ID")} THEN 1 ELSE 0 END END AS FATURALI
        FROM TODVZ_SARRAF_FISI f ${cariJoin("f.CARI_KART_ID")}
        WHERE ${kosul("sarraf", "f.SARRAF_FISI_ID", "f.CARI_KART_ID", "f.TARIH")}`);
        }
        if (await this.var(pool, "TODVZ_FATURA")) {
            parcalar.push(`
        SELECT 'perakende' AS FIS_TURU, f.FATURA_ID AS FIS_ID, LTRIM(RTRIM(CAST(f.FATURA_NO AS VARCHAR(50)))) AS FIS_NO, f.TARIH, f.CARI_KART_ID, ${cariAd} AS CARI_ADI,
               CASE WHEN f.FATURA_TIPI = 2 THEN 'giden' ELSE 'gelen' END AS YON,
               CAST(ISNULL(f.GENEL_TOPLAM, 0) * CASE WHEN ISNULL(f.PARA_ID, 1) = 1 OR ISNULL(f.KUR, 0) = 0 THEN 1 ELSE f.KUR END AS DECIMAL(18,2)) AS TUTAR,
               CAST(ISNULL(f.GENEL_TOPLAM, 0) * CASE WHEN ISNULL(f.PARA_ID, 1) = 1 OR ISNULL(f.KUR, 0) = 0 THEN 1 ELSE f.KUR END AS DECIMAL(18,2)) AS FIS_TOPLAMI,
               CASE WHEN f.E_BELGE_DURUMU IN (1, 2) THEN 1 ELSE 0 END AS FATURALI
        FROM TODVZ_FATURA f ${cariJoin("f.CARI_KART_ID")}
        WHERE ISNULL(f.E_BELGE_DURUMU, 0) <> 4 AND ${kosul("perakende", "f.FATURA_ID", "f.CARI_KART_ID", "f.TARIH")}`);
        }
        if (!parcalar.length)
            return [];
        const rows = (await req.query(parcalar.join("\nUNION ALL\n"))).recordset;
        return rows.map((r) => {
            const yon = r.YON;
            const faturali = Boolean(r.FATURALI);
            return {
                fisTuru: r.FIS_TURU,
                fisId: Number(r.FIS_ID),
                fisNo: r.FIS_NO || null,
                tarih: zaman(r.TARIH)?.slice(0, 10) ?? null,
                cariKartId: r.CARI_KART_ID ?? null,
                cariAdi: r.CARI_ADI ?? null,
                yon,
                tutar: Number(r.TUTAR) || 0,
                fisToplami: Number(r.FIS_TOPLAMI) || 0,
                faturali,
                faturaBilgisi: faturali ? (yon === "giden" && r.FIS_TURU !== "perakende" ? "Gelen e-fatura var" : "Faturası kesildi") : null,
            };
        });
    }
    // ─── Eşleşmeler ve işaretler ───────────────────────────────────────────────
    static async eslesmeler(vomsisIdler, dbContext) {
        const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
        if (!idler.length)
            return [];
        const pool = await this.pool(dbContext);
        const rows = (await pool.request().query(`SELECT VOMSIS_ID, FIS_TURU, FIS_ID, OTOMATIK FROM TODVZ_EBANKA_MUTABAKAT WHERE RED = 0 AND VOMSIS_ID IN (${idler.join(",")})`)).recordset;
        return rows.map((r) => ({ vomsisId: Number(r.VOMSIS_ID), fisTuru: r.FIS_TURU, fisId: Number(r.FIS_ID), otomatik: Boolean(r.OTOMATIK) }));
    }
    /** Kullanıcının kaldırdığı (reddettiği) eşleşmeler: "vomsisId|fisTuru:fisId" */
    static async reddedilenler(vomsisIdler, dbContext) {
        const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
        if (!idler.length)
            return new Set();
        const pool = await this.pool(dbContext);
        const rows = (await pool.request().query(`SELECT VOMSIS_ID, FIS_TURU, FIS_ID FROM TODVZ_EBANKA_MUTABAKAT WHERE RED = 1 AND VOMSIS_ID IN (${idler.join(",")})`)).recordset;
        return new Set(rows.map((r) => `${Number(r.VOMSIS_ID)}|${r.FIS_TURU}:${Number(r.FIS_ID)}`));
    }
    /** Verilen fişlerden herhangi bir banka hareketine (bu listenin dışındakiler dahil) eşlenmiş olanlar */
    static async eslenmisFisler(fisler, dbContext) {
        if (!fisler.length)
            return new Set();
        const pool = await this.pool(dbContext);
        const kosullar = ["doviz", "sarraf", "perakende"]
            .map((t) => {
            const idler = [...new Set(fisler.filter((f) => f.fisTuru === t).map((f) => f.fisId).filter((n) => Number.isSafeInteger(n) && n > 0))];
            return idler.length ? `(FIS_TURU = '${t}' AND FIS_ID IN (${idler.join(",")}))` : "";
        })
            .filter(Boolean);
        if (!kosullar.length)
            return new Set();
        const rows = (await pool.request().query(`SELECT DISTINCT FIS_TURU, FIS_ID FROM TODVZ_EBANKA_MUTABAKAT WHERE RED = 0 AND (${kosullar.join(" OR ")})`)).recordset;
        return new Set(rows.map((r) => `${r.FIS_TURU}:${r.FIS_ID}`));
    }
    static async esle(e, kullaniciId, dbContext) {
        const pool = await this.pool(dbContext);
        const req = pool.request();
        req.input("ID", sql.BigInt, e.vomsisId);
        req.input("TUR", sql.VarChar(10), e.fisTuru);
        req.input("FIS", sql.Int, e.fisId);
        req.input("OTO", sql.Bit, e.otomatik ? 1 : 0);
        req.input("KUL", sql.Int, kullaniciId ?? null);
        // Elle eşleme, daha önce reddedilmiş eşleşmeyi de geri açar; otomatik eşleme reddedileni asla açmaz
        await req.query(`
      UPDATE TODVZ_EBANKA_MUTABAKAT SET RED = 0, OTOMATIK = @OTO, EKLEYEN_ID = @KUL, EKLEME_ZAMANI = GETDATE()
      WHERE VOMSIS_ID = @ID AND FIS_TURU = @TUR AND FIS_ID = @FIS AND (RED = 1 AND @OTO = 0);
      IF NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_MUTABAKAT WHERE VOMSIS_ID = @ID AND FIS_TURU = @TUR AND FIS_ID = @FIS)
        INSERT INTO TODVZ_EBANKA_MUTABAKAT (VOMSIS_ID, FIS_TURU, FIS_ID, OTOMATIK, EKLEYEN_ID) VALUES (@ID, @TUR, @FIS, @OTO, @KUL);
    `);
    }
    static async eslemeyiKaldir(vomsisId, fisTuru, fisId, dbContext) {
        const pool = await this.pool(dbContext);
        const req = pool.request();
        req.input("ID", sql.BigInt, vomsisId);
        req.input("TUR", sql.VarChar(10), fisTuru);
        req.input("FIS", sql.Int, fisId);
        // Silinmez, reddedildi olarak işaretlenir: otomatik eşleştirme bir sonraki listelemede aynı fişi yeniden eşlemesin
        const r = await req.query(`UPDATE TODVZ_EBANKA_MUTABAKAT SET RED = 1 WHERE VOMSIS_ID = @ID AND FIS_TURU = @TUR AND FIS_ID = @FIS AND RED = 0`);
        return r.rowsAffected[0] || 0;
    }
    static async isaretle(vomsisId, faturaGerekmez, not, kullaniciId, dbContext) {
        const pool = await this.pool(dbContext);
        const var_ = pool.request();
        var_.input("ID", sql.BigInt, vomsisId);
        if (!(await var_.query(`SELECT 1 AS X FROM TODVZ_EBANKA_HAREKET WHERE VOMSIS_ID = @ID`)).recordset.length)
            return false;
        const req = pool.request();
        req.input("ID", sql.BigInt, vomsisId);
        req.input("GEREKMEZ", sql.Bit, faturaGerekmez ? 1 : 0);
        req.input("NOT", sql.NVarChar(250), not);
        req.input("KUL", sql.Int, kullaniciId ?? null);
        await req.query(`
      UPDATE TODVZ_EBANKA_MUTABAKAT_ISARET SET FATURA_GEREKMEZ = @GEREKMEZ, NOTU = @NOT, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE VOMSIS_ID = @ID;
      IF @@ROWCOUNT = 0 INSERT INTO TODVZ_EBANKA_MUTABAKAT_ISARET (VOMSIS_ID, FATURA_GEREKMEZ, NOTU, GUNCELLEYEN_ID) VALUES (@ID, @GEREKMEZ, @NOT, @KUL);
    `);
        return true;
    }
}
