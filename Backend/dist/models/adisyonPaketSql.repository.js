import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";
import { AdisyonSqlRepository } from "./adisyonSql.repository.js";
import { ADISYON_DURUM, ADISYON_TUR, PAKET_DURUM, PAKET_DURUM_ADI, paketDurumGecisi, paketMusteriDenetle, telefonNormal } from "../services/adisyon/adisyonHesap.js";
import { olayTetikle, olayYaz } from "../services/adisyon/adisyonOlay.service.js";
/**
 * Paket servis / gel-al (docs/TICARI_ADISYON_YOL_HARITASI.md, TA28, D8): masasız adisyon (müşteri ad / telefon / adres), durum akışı
 * hazırlanıyor → yolda → teslim (gel-alda hazırlanıyor → teslim). Ödeme ve teslim ayrı: ödenmiş ama teslim edilmemiş ya da teslim
 * edilmiş ama ödenmemiş sipariş listede kalır; ikisi de bitince düşer. Sipariş, mutfak, ikram / iptal ve tahsilat masa adisyonuyla aynı uçlarla.
 */
const temiz = (v) => String(v ?? "").trim();
const havuz = (ctx) => AdisyonTanimSqlRepository.havuz(ctx);
const yetki = (kim, y, ad) => { if (!kim.yetkiler?.includes(y))
    throw ApiError.forbidden(`Bu işlem için "${ad}" yetkisi gerekli.`); };
async function paketKilitle(tx, adisyonId) {
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT ADISYON_ID, RTRIM(ADISYON_NO) AS NO, TUR, DURUM, PAKET_DURUM FROM dbo.TODVZ_ADISYON WITH (UPDLOCK, ROWLOCK) WHERE ADISYON_ID = @A`);
    const a = r.recordset[0];
    if (!a)
        throw ApiError.notFound("Adisyon bulunamadı.");
    if (![ADISYON_TUR.PAKET, ADISYON_TUR.GEL_AL].includes(Number(a.TUR)))
        throw ApiError.badRequest("Bu adisyon paket / gel-al değil.");
    if (Number(a.DURUM) === ADISYON_DURUM.IPTAL)
        throw ApiError.conflict(`Sipariş ${temiz(a.NO)} iptal edilmiş.`);
    return { adisyonId: Number(a.ADISYON_ID), no: temiz(a.NO), tur: Number(a.TUR), durum: Number(a.DURUM), paketDurum: a.PAKET_DURUM === null ? PAKET_DURUM.HAZIRLANIYOR : Number(a.PAKET_DURUM) };
}
export class AdisyonPaketSqlRepository {
    /**
     * Süren paket / gel-al siparişleri (ödenmemiş ya da teslim edilmemiş) + son 12 saatte biten son 30 sipariş (saat dilimi bağımsız). Tutar fişlenmemiş + fişlenmiş
     * kalemlerin toplamı (paket servis ücreti almaz).
     */
    static async liste(ctx) {
        const pool = await havuz(ctx);
        const r = await pool.request().query(`
      SELECT A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS NO, A.TUR, A.DURUM, ISNULL(A.PAKET_DURUM, 1) AS PD, A.MUSTERI_AD, A.MUSTERI_TEL, A.MUSTERI_ADRES, A.ACIKLAMA,
        DATEDIFF(SECOND, A.ACILIS_ZAMANI, ISNULL(A.KAPANIS_ZAMANI, GETDATE())) / 60 AS DAKIKA, RTRIM(G.AD) AS GARSON, T.TOPLAM, T.KALEM, T.HAZIR, T.HAZIRLANAN,
        CASE WHEN A.DURUM IN (0, 1) OR (ISNULL(A.PAKET_DURUM, 1) < 3 AND A.KAPANIS_ZAMANI >= DATEADD(hour, -24, GETDATE())) THEN 1 ELSE 0 END AS AKTIF
      FROM dbo.TODVZ_ADISYON A
      LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID
      OUTER APPLY (SELECT SUM(CASE WHEN K.IKRAM = 0 AND K.IPTAL = 0 THEN ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) ELSE 0 END) AS TOPLAM, SUM(CASE WHEN K.IPTAL = 0 THEN 1 ELSE 0 END) AS KALEM,
          SUM(CASE WHEN K.IPTAL = 0 AND K.DURUM = 2 THEN 1 ELSE 0 END) AS HAZIR, SUM(CASE WHEN K.IPTAL = 0 AND K.DURUM = 1 THEN 1 ELSE 0 END) AS HAZIRLANAN
        FROM dbo.TODVZ_ADISYON_KALEM K WHERE K.ADISYON_ID = A.ADISYON_ID) T
      -- M14 (26.11.2026 denetimi): ödenmiş ama "teslim edildi" işaretlenmemiş paket 24 saat sonra aktif listeden düşer (eskiden süresiz
      -- listede kalıyor, liste her gün büyüyordu); son 24 saatte kapananlar "biten"de görünür
      WHERE A.TUR IN (2, 3) AND A.DURUM <> 9 AND (A.DURUM IN (0, 1) OR A.KAPANIS_ZAMANI >= DATEADD(hour, -24, GETDATE()))
      ORDER BY A.ADISYON_ID`);
        const tumu = r.recordset.map((x) => ({
            adisyonId: Number(x.ADISYON_ID), adisyonNo: temiz(x.NO), tur: Number(x.TUR), durum: Number(x.DURUM), paketDurum: Number(x.PD), paketDurumAdi: PAKET_DURUM_ADI[Number(x.PD)] || "",
            musteriAd: x.MUSTERI_AD ? temiz(x.MUSTERI_AD) : null, musteriTel: x.MUSTERI_TEL ? temiz(x.MUSTERI_TEL) : null, musteriAdres: x.MUSTERI_ADRES ? temiz(x.MUSTERI_ADRES) : null,
            not: x.ACIKLAMA ? temiz(x.ACIKLAMA) : null, toplam: Math.round((Number(x.TOPLAM) || 0) * 100) / 100, kalemSayisi: Number(x.KALEM) || 0, hazirSayisi: Number(x.HAZIR) || 0,
            hazirlananSayisi: Number(x.HAZIRLANAN) || 0, dakika: Math.max(0, Number(x.DAKIKA) || 0), odendi: Number(x.DURUM) === ADISYON_DURUM.KAPANDI, garson: x.GARSON ? temiz(x.GARSON) : null,
            aktif: !!x.AKTIF,
        }));
        const ayir = ({ aktif, ...p }) => p;
        return { aktif: tumu.filter((p) => p.aktif).map(ayir), biten: tumu.filter((p) => !p.aktif).slice(-30).reverse().map(ayir) };
    }
    /** Durum geçişi (yetki "siparis"): ödenmiş siparişte de yapılır; teslim + ödenmiş sipariş listeden düşer */
    static async durum(ctx, adisyonId, yeni, kim) {
        yetki(kim, "siparis", "Sipariş girme");
        const pool = await havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const a = await paketKilitle(tx, adisyonId);
            const h = paketDurumGecisi(a.tur, a.paketDurum, yeni);
            if (h)
                throw ApiError.badRequest(h);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("D", sql.TinyInt, Number(yeni))
                .query(`UPDATE dbo.TODVZ_ADISYON SET PAKET_DURUM = @D, SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "paket", { adisyonId, veri: { paketDurum: Number(yeni), onceki: a.paketDurum, yapan: temiz(kim.ad) } });
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        olayTetikle(ctx ?? {});
        return AdisyonSqlRepository.getir(ctx, adisyonId);
    }
    /** Müşteri bilgisini düzelt (açık sipariş; yetki "siparis"); tür değişmez */
    static async musteriGuncelle(ctx, adisyonId, g, kim) {
        yetki(kim, "siparis", "Sipariş girme");
        const pool = await havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const a = await paketKilitle(tx, adisyonId);
            if (![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(a.durum))
                throw ApiError.conflict("Kapanmış siparişin müşteri bilgisi değiştirilemez.");
            const m = paketMusteriDenetle({ tur: a.tur, ...g });
            if ("hata" in m)
                throw ApiError.badRequest(m.hata);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("MA", sql.NVarChar(100), m.ad).input("MT", sql.VarChar(30), m.tel).input("MD", sql.NVarChar(400), m.adres).input("AC", sql.NVarChar(250), m.not)
                .query(`UPDATE dbo.TODVZ_ADISYON SET MUSTERI_AD = @MA, MUSTERI_TEL = @MT, MUSTERI_ADRES = @MD, ACIKLAMA = @AC, SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "guncelle", { adisyonId });
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        olayTetikle(ctx ?? {});
        return AdisyonSqlRepository.getir(ctx, adisyonId);
    }
    /** Telefonla önceki sipariş: en son kullanılan ad ve adres (paket açarken doldurmak için) */
    static async musteriBul(ctx, tel) {
        const t = telefonNormal(tel);
        if (!t)
            return null;
        const pool = await havuz(ctx);
        const r = await pool.request().input("T", sql.VarChar(30), t).query(`SELECT TOP 1 MUSTERI_AD, MUSTERI_ADRES, ACILIS_ZAMANI,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON WHERE MUSTERI_TEL = @T AND DURUM <> 9) AS SAYI
      FROM dbo.TODVZ_ADISYON WHERE MUSTERI_TEL = @T AND TUR IN (2, 3) AND DURUM <> 9 ORDER BY CASE WHEN MUSTERI_ADRES IS NULL THEN 1 ELSE 0 END, ADISYON_ID DESC`);
        const x = r.recordset[0];
        if (!x)
            return null;
        return { tel: t, ad: x.MUSTERI_AD ? temiz(x.MUSTERI_AD) : null, adres: x.MUSTERI_ADRES ? temiz(x.MUSTERI_ADRES) : null, siparisSayisi: Number(x.SAYI) || 0 };
    }
}
