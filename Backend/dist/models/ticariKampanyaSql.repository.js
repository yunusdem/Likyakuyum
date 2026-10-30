import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { TicariStokSqlRepository } from "./ticariStokSql.repository.js";
import { kampanyaSec } from "../services/ticari/ticariHesap.js";
/**
 * Kampanyalar (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11, G12): tarihli yüzde / tutar indirimi; hedef gruplar / kartlar / tümü.
 * Satışta satıra otomatik satır iskontosu + KAMPANYA_ID olarak uygulanır (Ticari Satış Fişi, Hızlı Satış ticari); e-Belge'ye
 * satır iskontosu gider. Kart birden çok kampanyaya uyuyorsa en yüksek indirim (ticariHesap.kampanyaSec).
 */
/**
 * Tarihler duvar saatiyle (sunucunun yerel saati, "YYYY-AA-GGTSS:DD:ss") yazılıp okunur: tabloda GETDATE() ile karşılaştırıldığından
 * UTC olarak yazılan bir an 3 saat kayardı. Sürücü ya da köprü ne döndürürse döndürsün SQL'de metne çevrilerek okunur (CONVERT 126).
 */
const iki = (n) => String(n).padStart(2, "0");
export const duvarSaati = (d) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}T${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`;
export const duvardanAn = (m) => (m instanceof Date ? m : new Date(String(m).trim().replace(" ", "T")));
const TARIH_METNI = "CONVERT(VARCHAR(19), K.BASLANGIC, 126) AS BASLANGIC_M, CONVERT(VARCHAR(19), K.BITIS, 126) AS BITIS_M";
const temiz = (v) => String(v ?? "").trim();
const sayi = (v) => { const s = typeof v === "string" ? v.replace(",", ".") : v; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
export class TicariKampanyaSqlRepository {
    static havuz(ctx) {
        return TicariStokSqlRepository.havuz(ctx);
    }
    static model(r, gruplar, kartlar) {
        const simdi = Date.now();
        const basAn = duvardanAn(r.BASLANGIC_M);
        const bitAn = duvardanAn(r.BITIS_M);
        const bas = basAn.getTime();
        const bit = bitAn.getTime();
        return {
            kampanyaId: r.KAMPANYA_ID, ad: temiz(r.AD), baslangic: basAn.toISOString(), bitis: bitAn.toISOString(),
            tur: Number(r.TUR) === 2 ? 2 : 1, deger: Number(r.DEGER) || 0, hedefTuru: (Number(r.HEDEF_TURU) || 3),
            aktif: r.AKTIF === true || r.AKTIF === 1, aciklama: r.ACIKLAMA ? temiz(r.ACIKLAMA) : null,
            gruplar: gruplar.filter((g) => g.KAMPANYA_ID === r.KAMPANYA_ID).map((g) => ({ stokGrupId: g.STOK_GRUP_ID, ad: temiz(g.AD) })),
            kartlar: kartlar.filter((k) => k.KAMPANYA_ID === r.KAMPANYA_ID).map((k) => ({ stokKartId: k.STOK_KART_ID, kod: temiz(k.KOD), ad: temiz(k.AD) })),
            yururlukte: (r.AKTIF === true || r.AKTIF === 1) && bas <= simdi && simdi <= bit,
        };
    }
    static async liste(ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().query(`
      SELECT K.*, ${TARIH_METNI} FROM dbo.TODVZ_STOK_KAMPANYA K ORDER BY K.BITIS DESC, K.KAMPANYA_ID DESC;
      SELECT H.KAMPANYA_ID, H.STOK_GRUP_ID, G.AD FROM dbo.TODVZ_STOK_KAMPANYA_HEDEF H JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = H.STOK_GRUP_ID;
      SELECT H.KAMPANYA_ID, H.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD FROM dbo.TODVZ_STOK_KAMPANYA_HEDEF H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID;`);
        const sets = r.recordsets || [];
        return (sets[0] || []).map((x) => this.model(x, sets[1] || [], sets[2] || []));
    }
    static async getir(id, ctx) {
        return (await this.liste(ctx)).find((k) => k.kampanyaId === id) || null;
    }
    /** Yürürlükteki kampanyalar: satış ekranları ve Fiyat Gör için hafif liste (hedef kimlikleriyle) */
    static async aktifler(ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().query(`
      SELECT K.KAMPANYA_ID, K.AD, K.TUR, K.DEGER, K.HEDEF_TURU, H.STOK_GRUP_ID, H.STOK_KART_ID
      FROM dbo.TODVZ_STOK_KAMPANYA K LEFT JOIN dbo.TODVZ_STOK_KAMPANYA_HEDEF H ON H.KAMPANYA_ID = K.KAMPANYA_ID
      WHERE K.AKTIF = 1 AND K.BASLANGIC <= GETDATE() AND K.BITIS >= GETDATE() ORDER BY K.KAMPANYA_ID`);
        const m = new Map();
        for (const x of r.recordset) {
            let k = m.get(x.KAMPANYA_ID);
            if (!k) {
                k = { kampanyaId: x.KAMPANYA_ID, ad: temiz(x.AD), tur: Number(x.TUR) === 2 ? 2 : 1, deger: Number(x.DEGER) || 0, hedefTuru: (Number(x.HEDEF_TURU) || 3), grupIdler: [], kartIdler: [] };
                m.set(x.KAMPANYA_ID, k);
            }
            if (x.STOK_GRUP_ID)
                k.grupIdler.push(Number(x.STOK_GRUP_ID));
            if (x.STOK_KART_ID)
                k.kartIdler.push(Number(x.STOK_KART_ID));
        }
        return [...m.values()];
    }
    static denetle(g) {
        const ad = temiz(g.ad);
        if (!ad)
            throw ApiError.badRequest("Kampanya adı zorunlu.");
        if (ad.length > 100)
            throw ApiError.badRequest("Kampanya adı en çok 100 karakter olabilir.");
        const bas = g.baslangic ? new Date(g.baslangic) : null;
        const bit = g.bitis ? new Date(g.bitis) : null;
        if (!bas || Number.isNaN(bas.getTime()))
            throw ApiError.badRequest("Başlangıç tarihi okunamadı.");
        if (!bit || Number.isNaN(bit.getTime()))
            throw ApiError.badRequest("Bitiş tarihi okunamadı.");
        if (bit.getTime() < bas.getTime())
            throw ApiError.badRequest("Bitiş başlangıçtan önce olamaz.");
        const tur = Number(g.tur);
        if (tur !== 1 && tur !== 2)
            throw ApiError.badRequest("Kampanya türü yüzde (1) ya da tutar (2) olmalı.");
        const deger = sayi(g.deger);
        if (!Number.isFinite(deger) || deger <= 0)
            throw ApiError.badRequest("İndirim değeri sıfırdan büyük olmalı.");
        if (tur === 1 && deger > 100)
            throw ApiError.badRequest("Yüzde indirim 100'den büyük olamaz.");
        const hedefTuru = Number(g.hedefTuru);
        if (![1, 2, 3].includes(hedefTuru))
            throw ApiError.badRequest("Hedef türü gruplar (1), kartlar (2) ya da tümü (3) olmalı.");
        const grupIdler = hedefTuru === 1 ? [...new Set((g.grupIdler || []).map(Number).filter((x) => x > 0))] : [];
        const kartIdler = hedefTuru === 2 ? [...new Set((g.kartIdler || []).map(Number).filter((x) => x > 0))].slice(0, 5000) : [];
        if (hedefTuru === 1 && !grupIdler.length)
            throw ApiError.badRequest("En az bir grup seçin.");
        if (hedefTuru === 2 && !kartIdler.length)
            throw ApiError.badRequest("En az bir kart seçin.");
        return { ad, bas, bit, tur: tur, deger, hedefTuru: hedefTuru, grupIdler, kartIdler, aktif: g.aktif === false ? 0 : 1, aciklama: temiz(g.aciklama).slice(0, 300) || null };
    }
    static async kaydet(g, kullaniciId, ctx) {
        const d = this.denetle(g);
        const pool = await this.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        let id = Number(g.kampanyaId) || 0;
        try {
            if (d.grupIdler.length) {
                const n = Number((await new sql.Request(tx).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID IN (${d.grupIdler.join(",")})`)).recordset[0].N);
                if (n !== d.grupIdler.length)
                    throw ApiError.badRequest("Seçilen gruplardan biri bulunamadı.");
            }
            if (d.kartIdler.length) {
                const n = Number((await new sql.Request(tx).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${d.kartIdler.join(",")})`)).recordset[0].N);
                if (n !== d.kartIdler.length)
                    throw ApiError.badRequest("Seçilen kartlardan biri bulunamadı.");
            }
            const req = new sql.Request(tx).input("ID", sql.Int, id).input("AD", sql.NVarChar(100), d.ad).input("BAS", sql.VarChar(19), duvarSaati(d.bas)).input("BIT", sql.VarChar(19), duvarSaati(d.bit))
                .input("TUR", sql.TinyInt, d.tur).input("DEGER", sql.Float, d.deger).input("HEDEF", sql.TinyInt, d.hedefTuru).input("AKTIF", sql.Bit, d.aktif)
                .input("ACIKLAMA", sql.NVarChar(300), d.aciklama).input("KUL", sql.Int, kullaniciId || null);
            if (id) {
                const r = await req.query(`UPDATE dbo.TODVZ_STOK_KAMPANYA SET AD = @AD, BASLANGIC = CONVERT(DATETIME, @BAS, 126), BITIS = CONVERT(DATETIME, @BIT, 126), TUR = @TUR, DEGER = @DEGER, HEDEF_TURU = @HEDEF, AKTIF = @AKTIF, ACIKLAMA = @ACIKLAMA,
          GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE KAMPANYA_ID = @ID; SELECT @@ROWCOUNT AS N;
          DELETE FROM dbo.TODVZ_STOK_KAMPANYA_HEDEF WHERE KAMPANYA_ID = @ID;`);
                if (!Number(r.recordset[0]?.N))
                    throw ApiError.notFound("Kampanya bulunamadı.");
            }
            else {
                const r = await req.query(`INSERT INTO dbo.TODVZ_STOK_KAMPANYA (AD, BASLANGIC, BITIS, TUR, DEGER, HEDEF_TURU, AKTIF, ACIKLAMA, EKLEYEN_ID)
          OUTPUT INSERTED.KAMPANYA_ID VALUES (@AD, CONVERT(DATETIME, @BAS, 126), CONVERT(DATETIME, @BIT, 126), @TUR, @DEGER, @HEDEF, @AKTIF, @ACIKLAMA, @KUL)`);
                id = r.recordset[0].KAMPANYA_ID;
            }
            const hedefler = [...d.grupIdler.map((x) => `(${id}, ${x}, NULL)`), ...d.kartIdler.map((x) => `(${id}, NULL, ${x})`)];
            for (let i = 0; i < hedefler.length; i += 1000) {
                await new sql.Request(tx).query(`INSERT INTO dbo.TODVZ_STOK_KAMPANYA_HEDEF (KAMPANYA_ID, STOK_GRUP_ID, STOK_KART_ID) VALUES ${hedefler.slice(i, i + 1000).join(",")}`);
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return (await this.getir(id, ctx));
    }
    static async sil(id, ctx) {
        const pool = await this.havuz(ctx);
        const kullanildi = Number((await pool.request().input("ID", sql.Int, id).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_FATURA_SATIRI WHERE KAMPANYA_ID = @ID`)).recordset[0].N);
        if (kullanildi > 0)
            throw ApiError.badRequest(`Bu kampanya ${kullanildi} fiş satırında kullanılmış; silinemez, pasif yapın.`);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_KAMPANYA_HEDEF WHERE KAMPANYA_ID = @ID`);
            const r = await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_KAMPANYA WHERE KAMPANYA_ID = @ID; SELECT @@ROWCOUNT AS N`);
            if (!Number(r.recordset[0]?.N))
                throw ApiError.notFound("Kampanya bulunamadı.");
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
    }
    /**
     * Satış kaydında doğrulama (açık işlem içinde): satırda kampanyaId verilmişse kampanya yürürlükte ve kartı kapsıyor olmalı;
     * satır iskontosu kampanyanın tür / değerine eşit olmalı. Döner: satır için beklenen iskonto.
     */
    static async satirKampanyasiniDogrula(tx, kampanyaId, stokKartId, stokGrupId) {
        const r = await new sql.Request(tx).input("ID", sql.Int, kampanyaId).input("K", sql.Int, stokKartId).input("G", sql.Int, stokGrupId).query(`
      SELECT K.TUR, K.DEGER, K.HEDEF_TURU,
        CASE WHEN K.HEDEF_TURU = 3 THEN 1
             WHEN K.HEDEF_TURU = 1 AND EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_KAMPANYA_HEDEF H WHERE H.KAMPANYA_ID = K.KAMPANYA_ID AND H.STOK_GRUP_ID = @G) THEN 1
             WHEN K.HEDEF_TURU = 2 AND EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_KAMPANYA_HEDEF H WHERE H.KAMPANYA_ID = K.KAMPANYA_ID AND H.STOK_KART_ID = @K) THEN 1 ELSE 0 END AS KAPSAR
      FROM dbo.TODVZ_STOK_KAMPANYA K WHERE K.KAMPANYA_ID = @ID AND K.AKTIF = 1 AND K.BASLANGIC <= GETDATE() AND K.BITIS >= GETDATE()`);
        const x = r.recordset[0];
        if (!x)
            throw ApiError.badRequest("Satırdaki kampanya yürürlükte değil; fişi yeniden fiyatlayın.");
        if (Number(x.KAPSAR) !== 1)
            throw ApiError.badRequest("Satırdaki kampanya bu ürünü kapsamıyor; fişi yeniden fiyatlayın.");
        return { turu: Number(x.TUR) === 2 ? 2 : 1, degeri: Number(x.DEGER) || 0 };
    }
}
export { kampanyaSec };
