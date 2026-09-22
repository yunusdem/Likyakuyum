import sql from "mssql";
import { logger } from "../utils/logger.js";
import { EBankaVeriSqlRepository } from "./ebankaVeriSql.repository.js";
const sayi = (v) => {
    if (v === null || v === undefined || v === "")
        return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
};
const metin = (v, uzunluk) => {
    if (v === null || v === undefined)
        return null;
    const s = String(v).trim();
    return s ? s.slice(0, uzunluk) : null;
};
/** "GG.AA.YYYY", "YYYY-AA-GG" ya da "YYYY-AA-GG SS:DD:ss" → duvar saati UTC kabul edilerek Date */
const tarih = (v) => {
    const s = String(v ?? "").trim();
    let m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
    if (m)
        return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(s);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))) : null;
};
const gunMetni = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const zamanMetni = (d) => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null);
export class EBankaPosSqlRepository {
    static hazirHavuzlar = new WeakSet();
    static async pool(dbContext) {
        const pool = await EBankaVeriSqlRepository.pool(dbContext);
        if (!this.hazirHavuzlar.has(pool)) {
            await this.ensureTables(pool);
            this.hazirHavuzlar.add(pool);
        }
        return pool;
    }
    static async ensureTables(pool) {
        try {
            await pool.request().batch(`
        IF OBJECT_ID('TODVZ_EBANKA_POS_TERMINAL', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_POS_TERMINAL] (
            [VOMSIS_TERMINAL_ID] INT NOT NULL PRIMARY KEY,
            [BANKA_KODU] VARCHAR(50) NULL,
            [BANKA_ADI] NVARCHAR(150) NULL,
            [DURUM] BIT NOT NULL DEFAULT 1,
            [ISYERI_NO] VARCHAR(50) NULL,
            [TERMINAL_NO] VARCHAR(50) NULL,
            [ISYERI_ADI] NVARCHAR(200) NULL,
            [DOVIZ] VARCHAR(10) NULL,
            [OZEL_AD] NVARCHAR(200) NULL,
            [KOMISYON_ORANI] DECIMAL(9,4) NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_EBANKA_POS_HAREKET', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_POS_HAREKET] (
            [VOMSIS_ID] BIGINT NOT NULL PRIMARY KEY,
            [VOMSIS_TERMINAL_ID] INT NOT NULL,
            [ANAHTAR] VARCHAR(64) NULL,
            [ISLEM_TARIHI] DATE NULL,
            [SAAT] VARCHAR(10) NULL,
            [SISTEM_TARIHI] DATETIME NULL,
            [VALOR] DATE NULL,
            [GUN_SONU] DATE NULL,
            [KART_NO] VARCHAR(30) NULL,
            [KART_TIPI] VARCHAR(50) NULL,
            [ISLEM_TIPI] NVARCHAR(50) NULL,
            [ACIKLAMA] NVARCHAR(250) NULL,
            [DOVIZ] VARCHAR(10) NULL,
            [BRUT] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [KOMISYON] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [KOMISYON_ORANI] DECIMAL(9,4) NULL,
            [NET] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [TAKSIT_SAYISI] INT NULL,
            [TAKSIT_SIRA] INT NULL,
            [PROVIZYON_NO] VARCHAR(50) NULL,
            [BATCH] VARCHAR(50) NULL,
            [HAM] NVARCHAR(MAX) NULL,
            [BANKA_HAREKET_ID] INT NULL,
            [CEKILME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
          );
          CREATE INDEX [IX_TODVZ_EBANKA_POS_HAREKET_TARIH] ON [dbo].[TODVZ_EBANKA_POS_HAREKET] ([ISLEM_TARIHI] DESC, [VOMSIS_ID] DESC);
        END;

        IF COL_LENGTH('TODVZ_EBANKA_AYAR', 'SON_POS_ESITLEME') IS NULL
          ALTER TABLE [dbo].[TODVZ_EBANKA_AYAR] ADD [SON_POS_ESITLEME] DATETIME NULL;
      `);
        }
        catch (err) {
            logger.warn(`[EBankaPosSqlRepository.ensureTables] Warning: ${err.message}`);
        }
    }
    // ─── Eşitleme ──────────────────────────────────────────────────────────────
    static async terminalleriYaz(terminaller, dbContext) {
        const pool = await this.pool(dbContext);
        for (const t of terminaller) {
            if (!t?.id)
                continue;
            const req = pool.request();
            req.input("ID", sql.Int, t.id);
            req.input("KOD", sql.VarChar(50), metin(t.bank_name, 50));
            req.input("AD", sql.NVarChar(150), metin(t.bank_title, 150) || metin(t.bank_name, 150));
            req.input("DURUM", sql.Bit, t.status === 0 ? 0 : 1);
            req.input("ISYERI_NO", sql.VarChar(50), metin(t.workplace_no, 50));
            req.input("TERMINAL_NO", sql.VarChar(50), metin(t.station_no, 50));
            req.input("ISYERI_ADI", sql.NVarChar(200), metin(t.workplace_name, 200));
            req.input("DOVIZ", sql.VarChar(10), metin(t.transaction_currency, 10));
            req.input("OZEL_AD", sql.NVarChar(200), metin(t.custom_name, 200));
            req.input("ORAN", sql.Decimal(9, 4), sayi(t.commission_rate));
            await req.query(`
        UPDATE TODVZ_EBANKA_POS_TERMINAL SET BANKA_KODU = @KOD, BANKA_ADI = @AD, DURUM = @DURUM, ISYERI_NO = @ISYERI_NO, TERMINAL_NO = @TERMINAL_NO,
          ISYERI_ADI = @ISYERI_ADI, DOVIZ = @DOVIZ, OZEL_AD = @OZEL_AD, KOMISYON_ORANI = @ORAN, GUNCELLEME_ZAMANI = GETDATE()
        WHERE VOMSIS_TERMINAL_ID = @ID;
        IF @@ROWCOUNT = 0
          INSERT INTO TODVZ_EBANKA_POS_TERMINAL (VOMSIS_TERMINAL_ID, BANKA_KODU, BANKA_ADI, DURUM, ISYERI_NO, TERMINAL_NO, ISYERI_ADI, DOVIZ, OZEL_AD, KOMISYON_ORANI, GUNCELLEME_ZAMANI)
          VALUES (@ID, @KOD, @AD, @DURUM, @ISYERI_NO, @TERMINAL_NO, @ISYERI_ADI, @DOVIZ, @OZEL_AD, @ORAN, GETDATE());
      `);
        }
        return terminaller.length;
    }
    /** Vomsis id'si ile ekle/güncelle; kesilmiş fişin bağına (BANKA_HAREKET_ID) dokunmaz. */
    static async hareketleriYaz(terminalId, hareketler, dbContext) {
        const pool = await this.pool(dbContext);
        let yeni = 0;
        let guncellenen = 0;
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            for (const h of hareketler) {
                if (!h?.id)
                    continue;
                const req = new sql.Request(tx);
                req.input("ID", sql.BigInt, h.id);
                req.input("TERMINAL", sql.Int, terminalId);
                req.input("ANAHTAR", sql.VarChar(64), metin(h.key, 64));
                req.input("ISLEM_TARIHI", sql.Date, tarih(h.date) ?? tarih(h.end_of_day_date) ?? tarih(h.system_date));
                req.input("SAAT", sql.VarChar(10), metin(h.time, 10)?.replace(/\./g, ":") ?? null);
                req.input("SISTEM", sql.DateTime, tarih(h.system_date));
                req.input("VALOR", sql.Date, tarih(h.valor));
                req.input("GUN_SONU", sql.Date, tarih(h.end_of_day_date));
                req.input("KART_NO", sql.VarChar(30), metin(h.card_number, 30));
                req.input("KART_TIPI", sql.VarChar(50), metin(h.sub_card_type, 50) || metin(h.card_type, 50));
                req.input("ISLEM_TIPI", sql.NVarChar(50), metin(h.transaction_type, 50));
                req.input("ACIKLAMA", sql.NVarChar(250), metin(h.description, 250));
                req.input("DOVIZ", sql.VarChar(10), metin(h.exchange, 10));
                req.input("BRUT", sql.Decimal(18, 2), sayi(h.gross_amount) ?? 0);
                req.input("KOMISYON", sql.Decimal(18, 2), sayi(h.commission) ?? 0);
                req.input("ORAN", sql.Decimal(9, 4), sayi(h.commission_rate));
                req.input("NET", sql.Decimal(18, 2), sayi(h.net_amount) ?? 0);
                req.input("TAKSIT", sql.Int, sayi(h.installments_count));
                req.input("TAKSIT_SIRA", sql.Int, sayi(h.installments_order));
                req.input("PROVIZYON", sql.VarChar(50), metin(h.provision_no, 50));
                req.input("BATCH", sql.VarChar(50), metin(h.batchn, 50));
                req.input("HAM", sql.NVarChar(sql.MAX), JSON.stringify(h));
                const r = await req.query(`
          UPDATE TODVZ_EBANKA_POS_HAREKET SET VOMSIS_TERMINAL_ID = @TERMINAL, ANAHTAR = @ANAHTAR, ISLEM_TARIHI = @ISLEM_TARIHI, SAAT = @SAAT, SISTEM_TARIHI = @SISTEM,
            VALOR = @VALOR, GUN_SONU = @GUN_SONU, KART_NO = @KART_NO, KART_TIPI = @KART_TIPI, ISLEM_TIPI = @ISLEM_TIPI, ACIKLAMA = @ACIKLAMA, DOVIZ = @DOVIZ,
            BRUT = @BRUT, KOMISYON = @KOMISYON, KOMISYON_ORANI = @ORAN, NET = @NET, TAKSIT_SAYISI = @TAKSIT, TAKSIT_SIRA = @TAKSIT_SIRA,
            PROVIZYON_NO = @PROVIZYON, BATCH = @BATCH, HAM = @HAM
          WHERE VOMSIS_ID = @ID;
          IF @@ROWCOUNT = 0
          BEGIN
            INSERT INTO TODVZ_EBANKA_POS_HAREKET (VOMSIS_ID, VOMSIS_TERMINAL_ID, ANAHTAR, ISLEM_TARIHI, SAAT, SISTEM_TARIHI, VALOR, GUN_SONU, KART_NO, KART_TIPI,
              ISLEM_TIPI, ACIKLAMA, DOVIZ, BRUT, KOMISYON, KOMISYON_ORANI, NET, TAKSIT_SAYISI, TAKSIT_SIRA, PROVIZYON_NO, BATCH, HAM)
            VALUES (@ID, @TERMINAL, @ANAHTAR, @ISLEM_TARIHI, @SAAT, @SISTEM, @VALOR, @GUN_SONU, @KART_NO, @KART_TIPI,
              @ISLEM_TIPI, @ACIKLAMA, @DOVIZ, @BRUT, @KOMISYON, @ORAN, @NET, @TAKSIT, @TAKSIT_SIRA, @PROVIZYON, @BATCH, @HAM);
            SELECT 1 AS YENI;
          END
          ELSE SELECT 0 AS YENI;
        `);
                if (r.recordset?.[0]?.YENI === 1)
                    yeni++;
                else
                    guncellenen++;
            }
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
        return { yeni, guncellenen };
    }
    static async sonEsitlemeyiYaz(dbContext) {
        const pool = await this.pool(dbContext);
        await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1) INSERT INTO TODVZ_EBANKA_AYAR (AYAR_ID) VALUES (1);
      UPDATE TODVZ_EBANKA_AYAR SET SON_POS_ESITLEME = GETDATE() WHERE AYAR_ID = 1;
    `);
    }
    static async sonEsitleme(dbContext) {
        const pool = await this.pool(dbContext);
        const r = (await pool.request().query(`SELECT SON_POS_ESITLEME AS Z, DATEDIFF(SECOND, SON_POS_ESITLEME, GETDATE()) AS SN FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1`)).recordset[0];
        return { zaman: zamanMetni(r?.Z), gecenSaniye: r?.SN === null || r?.SN === undefined ? null : Number(r.SN) };
    }
    static async fisliSatirYok(dbContext) {
        const pool = await this.pool(dbContext);
        return (await pool.request().query(`SELECT COUNT(*) AS N FROM TODVZ_EBANKA_POS_HAREKET WHERE BANKA_HAREKET_ID IS NOT NULL`)).recordset[0].N === 0;
    }
    /** Mod değişince ayna boşaltılır; fişe bağlanmış POS satırı varsa dokunmaz ve false döner. */
    static async aynayiBosalt(dbContext) {
        if (!(await this.fisliSatirYok(dbContext)))
            return false;
        const pool = await this.pool(dbContext);
        await pool.request().batch(`
      DELETE FROM TODVZ_EBANKA_POS_HAREKET;
      DELETE FROM TODVZ_EBANKA_POS_TERMINAL;
      UPDATE TODVZ_EBANKA_AYAR SET SON_POS_ESITLEME = NULL WHERE AYAR_ID = 1;
    `);
        return true;
    }
    // ─── Okuma ─────────────────────────────────────────────────────────────────
    static async terminalleriListele(dbContext) {
        const pool = await this.pool(dbContext);
        const rows = (await pool.request().query(`SELECT * FROM TODVZ_EBANKA_POS_TERMINAL ORDER BY BANKA_ADI, TERMINAL_NO`)).recordset;
        return rows.map((r) => ({
            vomsisTerminalId: r.VOMSIS_TERMINAL_ID,
            bankaAdi: r.BANKA_ADI || r.BANKA_KODU || "",
            isyeriNo: r.ISYERI_NO ?? null,
            terminalNo: r.TERMINAL_NO ?? null,
            isyeriAdi: r.ISYERI_ADI ?? null,
            ozelAd: r.OZEL_AD ?? null,
            doviz: r.DOVIZ ?? null,
            komisyonOrani: r.KOMISYON_ORANI === null ? null : Number(r.KOMISYON_ORANI),
            aktif: Boolean(r.DURUM),
            guncellemeZamani: zamanMetni(r.GUNCELLEME_ZAMANI),
        }));
    }
    static kosullar(f) {
        const kosullar = ["1 = 1"];
        const girdiler = [];
        if (f.baslangic) {
            kosullar.push("h.ISLEM_TARIHI >= @BAS");
            girdiler.push(["BAS", sql.Date, tarih(f.baslangic)]);
        }
        if (f.bitis) {
            kosullar.push("h.ISLEM_TARIHI <= @BIT");
            girdiler.push(["BIT", sql.Date, tarih(f.bitis)]);
        }
        if (f.vomsisTerminalId) {
            kosullar.push("h.VOMSIS_TERMINAL_ID = @TERMINAL");
            girdiler.push(["TERMINAL", sql.Int, f.vomsisTerminalId]);
        }
        if (f.fisDurumu === "var")
            kosullar.push("h.BANKA_HAREKET_ID IS NOT NULL");
        if (f.fisDurumu === "yok")
            kosullar.push("h.BANKA_HAREKET_ID IS NULL");
        if (f.arama?.trim()) {
            kosullar.push("(h.KART_NO LIKE @ARA OR h.ACIKLAMA LIKE @ARA OR h.PROVIZYON_NO LIKE @ARA OR h.BATCH LIKE @ARA)");
            girdiler.push(["ARA", sql.NVarChar(120), `%${f.arama.trim().slice(0, 100)}%`]);
        }
        return { nerede: kosullar.join(" AND "), girdiler };
    }
    static satir(r) {
        return {
            vomsisId: Number(r.VOMSIS_ID),
            vomsisTerminalId: r.VOMSIS_TERMINAL_ID,
            terminalAdi: r.OZEL_AD || r.TERMINAL_NO || String(r.VOMSIS_TERMINAL_ID),
            bankaAdi: r.BANKA_ADI || "",
            islemTarihi: gunMetni(r.ISLEM_TARIHI),
            saat: r.SAAT ?? null,
            valor: gunMetni(r.VALOR),
            gunSonu: gunMetni(r.GUN_SONU),
            kartNo: r.KART_NO ?? null,
            kartTipi: r.KART_TIPI ?? null,
            islemTipi: r.ISLEM_TIPI ?? null,
            aciklama: r.ACIKLAMA ?? null,
            doviz: r.DOVIZ ?? null,
            brut: Number(r.BRUT) || 0,
            komisyon: Number(r.KOMISYON) || 0,
            komisyonOrani: r.KOMISYON_ORANI === null ? null : Number(r.KOMISYON_ORANI),
            net: Number(r.NET) || 0,
            taksitSayisi: r.TAKSIT_SAYISI ?? null,
            provizyonNo: r.PROVIZYON_NO ?? null,
            batch: r.BATCH ?? null,
            bankaHareketId: r.BANKA_HAREKET_ID ?? null,
        };
    }
    static SECIM = `
    FROM TODVZ_EBANKA_POS_HAREKET h
    LEFT JOIN TODVZ_EBANKA_POS_TERMINAL t ON t.VOMSIS_TERMINAL_ID = h.VOMSIS_TERMINAL_ID
  `;
    /** sayfaBoyutu 0 → sayfalama yok (Excel dökümü). */
    static async hareketleriListele(f, dbContext) {
        const pool = await this.pool(dbContext);
        const { nerede, girdiler } = this.kosullar(f);
        const istek = () => {
            const req = pool.request();
            for (const [ad, tip, deger] of girdiler)
                req.input(ad, tip, deger);
            return req;
        };
        const hepsi = f.sayfaBoyutu === 0;
        const boyut = hepsi ? 0 : Math.min(Math.max(f.sayfaBoyutu || 100, 10), 500);
        const sayfa = Math.max(f.sayfa || 1, 1);
        const liste = istek();
        liste.input("ATLA", sql.Int, hepsi ? 0 : (sayfa - 1) * boyut);
        liste.input("AL", sql.Int, hepsi ? 100000 : boyut);
        const rows = (await liste.query(`
        SELECT h.*, t.OZEL_AD, t.TERMINAL_NO, t.BANKA_ADI ${this.SECIM}
        WHERE ${nerede}
        ORDER BY h.ISLEM_TARIHI DESC, h.VOMSIS_ID DESC
        OFFSET @ATLA ROWS FETCH NEXT @AL ROWS ONLY
      `)).recordset;
        const toplamlar = (await istek().query(`
        SELECT ISNULL(h.DOVIZ, '') AS DOVIZ, COUNT(*) AS ADET, SUM(h.BRUT) AS BRUT, SUM(h.KOMISYON) AS KOMISYON, SUM(h.NET) AS NET
        ${this.SECIM} WHERE ${nerede} GROUP BY ISNULL(h.DOVIZ, '') ORDER BY 1
      `)).recordset;
        const gunluk = (await istek().query(`
        SELECT h.ISLEM_TARIHI, h.VOMSIS_TERMINAL_ID, MAX(ISNULL(t.OZEL_AD, t.TERMINAL_NO)) AS TERMINAL, MAX(t.BANKA_ADI) AS BANKA_ADI, ISNULL(h.DOVIZ, '') AS DOVIZ,
               COUNT(*) AS ADET, SUM(h.BRUT) AS BRUT, SUM(h.KOMISYON) AS KOMISYON, SUM(h.NET) AS NET, MIN(h.VALOR) AS VALOR
        ${this.SECIM} WHERE ${nerede}
        GROUP BY h.ISLEM_TARIHI, h.VOMSIS_TERMINAL_ID, ISNULL(h.DOVIZ, '')
        ORDER BY h.ISLEM_TARIHI DESC, 3
      `)).recordset;
        return {
            satirlar: rows.map((r) => this.satir(r)),
            toplam: toplamlar.reduce((t, r) => t + Number(r.ADET), 0),
            toplamlar: toplamlar.map((r) => ({ doviz: r.DOVIZ, adet: Number(r.ADET), brut: Number(r.BRUT) || 0, komisyon: Number(r.KOMISYON) || 0, net: Number(r.NET) || 0 })),
            gunluk: gunluk.map((r) => ({
                islemTarihi: gunMetni(r.ISLEM_TARIHI),
                vomsisTerminalId: r.VOMSIS_TERMINAL_ID,
                terminalAdi: r.TERMINAL || String(r.VOMSIS_TERMINAL_ID),
                bankaAdi: r.BANKA_ADI || "",
                doviz: r.DOVIZ,
                adet: Number(r.ADET),
                brut: Number(r.BRUT) || 0,
                komisyon: Number(r.KOMISYON) || 0,
                net: Number(r.NET) || 0,
                valor: gunMetni(r.VALOR),
            })),
        };
    }
    static async secilenleriGetir(vomsisIdler, dbContext) {
        const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
        if (!idler.length)
            return [];
        const pool = await this.pool(dbContext);
        const rows = (await pool.request().query(`SELECT h.*, t.OZEL_AD, t.TERMINAL_NO, t.BANKA_ADI ${this.SECIM} WHERE h.VOMSIS_ID IN (${idler.join(",")})`)).recordset;
        return rows.map((r) => this.satir(r));
    }
    // ─── Elle banka fişi ───────────────────────────────────────────────────────
    /** Satırları fişten ÖNCE kilitler (-1); hepsi kilitlenemezse kilitleri bırakır. Aynı satır ikinci kez fişlenemez. */
    static async talepEt(vomsisIdler, dbContext) {
        const pool = await this.pool(dbContext);
        const r = await pool.request().query(`UPDATE TODVZ_EBANKA_POS_HAREKET SET BANKA_HAREKET_ID = -1 WHERE VOMSIS_ID IN (${vomsisIdler.join(",")}) AND BANKA_HAREKET_ID IS NULL`);
        if ((r.rowsAffected[0] || 0) === vomsisIdler.length)
            return true;
        await this.talebiBirak(vomsisIdler, dbContext);
        return false;
    }
    static async talebiBirak(vomsisIdler, dbContext) {
        const pool = await this.pool(dbContext);
        await pool.request().query(`UPDATE TODVZ_EBANKA_POS_HAREKET SET BANKA_HAREKET_ID = NULL WHERE VOMSIS_ID IN (${vomsisIdler.join(",")}) AND BANKA_HAREKET_ID = -1`);
    }
    static async fisiYaz(vomsisIdler, bankaHareketId, dbContext) {
        const pool = await this.pool(dbContext);
        const req = pool.request();
        req.input("FIS", sql.Int, bankaHareketId);
        await req.query(`UPDATE TODVZ_EBANKA_POS_HAREKET SET BANKA_HAREKET_ID = @FIS WHERE VOMSIS_ID IN (${vomsisIdler.join(",")}) AND BANKA_HAREKET_ID = -1`);
    }
}
