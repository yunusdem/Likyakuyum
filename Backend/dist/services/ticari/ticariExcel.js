import ExcelJS from "exceljs";
import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { TicariStokSqlRepository, kartGirdisiDenetle } from "../../models/ticariStokSql.repository.js";
import { TicariGirisSqlRepository } from "../../models/ticariGirisSql.repository.js";
export const EXCEL_SUTUNLARI = [
    { anahtar: "kod", baslik: "Kod", zorunlu: false, ornek: "KLM001", aciklama: "Boşsa otomatik verilir (STK00001). Kod ya da barkod mevcut bir kartla eşleşirse o kart güncellenir; boş bıraktığınız hücreler kartta değişmez." },
    { anahtar: "ad", baslik: "Ürün Adı", zorunlu: true, ornek: "Tükenmez Kalem Mavi", aciklama: "Zorunlu, en çok 200 karakter." },
    { anahtar: "barkod", baslik: "Barkod", zorunlu: false, ornek: "8690000000011;8690000000028", aciklama: "Birden fazlaysa ; ile ayırın. Başka kartta olmamalı. Güncellenen karta eklenir (eski barkodlar silinmez)." },
    { anahtar: "grup", baslik: "Grup", zorunlu: false, ornek: "Kırtasiye", aciklama: "Yoksa yeni grup açılır." },
    { anahtar: "birim", baslik: "Birim", zorunlu: false, ornek: "Adet", aciklama: "Adet, Kg, Gr, Lt, Metre, Paket, Kutu. Boşsa Adet." },
    { anahtar: "kdvOrani", baslik: "KDV %", zorunlu: false, ornek: "20", aciklama: "0, 1, 8, 10, 18 ya da 20. Boşsa 20." },
    { anahtar: "satisFiyati", baslik: "Satış Fiyatı", zorunlu: false, ornek: "25,50", aciklama: "Sayı. Ondalık için virgül ya da nokta." },
    { anahtar: "fiyatKdvDahil", baslik: "Fiyat KDV Dahil", zorunlu: false, ornek: "E", aciklama: "E ya da H. Boşsa E (dahil)." },
    { anahtar: "paraBirimi", baslik: "Para Birimi", zorunlu: false, ornek: "TL", aciklama: "Ürün Tanımları'ndaki kod (TL, USD, EUR…). Boşsa TL." },
    { anahtar: "alisFiyati", baslik: "Alış Fiyatı", zorunlu: false, ornek: "15", aciklama: "KDV hariç alış fiyatı (sayı)." },
    { anahtar: "enAzStok", baslik: "En Az Stok", zorunlu: false, ornek: "10", aciklama: "Altına düşünce Stok Durum Listesi uyarır." },
    { anahtar: "acilisMiktari", baslik: "Açılış Miktarı", zorunlu: false, ornek: "100", aciklama: "Doluysa \"Excel açılış\" stok giriş fişiyle stoğa eklenir." },
    { anahtar: "aktif", baslik: "Aktif", zorunlu: false, ornek: "E", aciklama: "E ya da H. Boşsa E." },
    { anahtar: "aciklama", baslik: "Açıklama", zorunlu: false, ornek: "", aciklama: "En çok 500 karakter." },
];
const ana = (s) => s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9%]/g, "");
/** Başlık eşleri (eski / kısa yazımlar) */
const BASLIK_ESLERI = {
    ...Object.fromEntries(EXCEL_SUTUNLARI.map((s) => [ana(s.baslik), s.anahtar])),
    urunkodu: "kod", stokkodu: "kod", urun: "ad", urunadi: "ad", ad: "ad", stokadi: "ad", barkodlar: "barkod", urungrubu: "grup",
    kdv: "kdvOrani", kdvorani: "kdvOrani", satisfiyat: "satisFiyati", kdvdahil: "fiyatKdvDahil", para: "paraBirimi", doviz: "paraBirimi",
    alisfiyat: "alisFiyati", minimumstok: "enAzStok", enazstok: "enAzStok", acilis: "acilisMiktari", acilisstok: "acilisMiktari", miktar: "acilisMiktari",
};
export async function ornekExcel() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Ürünler");
    ws.columns = EXCEL_SUTUNLARI.map((s) => ({ header: s.baslik, key: s.anahtar, width: Math.max(14, s.baslik.length + 4, Math.min(30, s.ornek.length + 2)) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    ws.addRow(Object.fromEntries(EXCEL_SUTUNLARI.map((s) => [s.anahtar, s.ornek])));
    ws.addRow({ kod: "", ad: "Defter A4 Kareli", barkod: "8690000000035", grup: "Kırtasiye", birim: "Adet", kdvOrani: "20", satisFiyati: "45", fiyatKdvDahil: "E", paraBirimi: "TL", alisFiyati: "30", enAzStok: "5", acilisMiktari: "40", aktif: "E", aciklama: "" });
    // Barkod ve kodun bilimsel gösterime dönmemesi için metin biçimi
    ["A", "C"].forEach((c) => (ws.getColumn(c).numFmt = "@"));
    const ac = wb.addWorksheet("Açıklama");
    ac.columns = [{ header: "Sütun", key: "s", width: 18 }, { header: "Zorunlu", key: "z", width: 10 }, { header: "Açıklama", key: "a", width: 90 }];
    ac.getRow(1).font = { bold: true };
    EXCEL_SUTUNLARI.forEach((s) => ac.addRow({ s: s.baslik, z: s.zorunlu ? "Evet" : "", a: s.aciklama }));
    ac.addRow({});
    ac.addRow({ s: "Not", a: "Başlık satırını değiştirmeyin. Veriler 'Ürünler' sayfasında, ilk satırdaki başlıkların altında olmalı. Örnek satırları silip kendi ürünlerinizi yazın." });
    return Buffer.from(await wb.xlsx.writeBuffer());
}
const hucreMetni = (v) => {
    if (v === null || v === undefined)
        return "";
    if (typeof v === "object") {
        if (v instanceof Date)
            return v.toISOString().slice(0, 10);
        const o = v;
        if (o.richText)
            return o.richText.map((r) => r.text).join("").trim();
        if (o.text !== undefined)
            return String(o.text).trim();
        if (o.result !== undefined)
            return String(o.result).trim();
        return "";
    }
    if (typeof v === "number")
        return Number.isInteger(v) ? String(v) : String(v);
    return String(v).trim();
};
/** Dosyayı okur: başlık eşlemesi + veri satırları. */
export async function excelOku(dosya) {
    const wb = new ExcelJS.Workbook();
    try {
        await wb.xlsx.load(dosya);
    }
    catch {
        throw ApiError.badRequest("Dosya okunamadı. Örnek dosyadaki gibi .xlsx biçiminde kaydedin (Excel › Farklı Kaydet › Excel Çalışma Kitabı).");
    }
    const ws = wb.worksheets.find((w) => ana(w.name) === "urunler") || wb.worksheets[0];
    if (!ws)
        throw ApiError.badRequest("Dosyada sayfa yok.");
    const sutunHatalari = [];
    const baslik = ws.getRow(1);
    const eslem = new Map();
    const gorulen = new Set();
    baslik.eachCell({ includeEmpty: false }, (c, no) => {
        const metin = hucreMetni(c.value);
        if (!metin)
            return;
        const a = BASLIK_ESLERI[ana(metin)];
        if (!a) {
            sutunHatalari.push(`"${metin}" sütunu tanınmadı (${c.address}). Başlığı örnek dosyadaki gibi yazın ya da sütunu silin.`);
            return;
        }
        if (gorulen.has(a)) {
            sutunHatalari.push(`"${metin}" sütunu iki kez var (${c.address}). Birini silin.`);
            return;
        }
        gorulen.add(a);
        eslem.set(no, a);
    });
    for (const s of EXCEL_SUTUNLARI) {
        if (!gorulen.has(s.anahtar))
            sutunHatalari.push(`"${s.baslik}" sütunu eksik${s.zorunlu ? " (zorunlu)" : ""}. Örnek dosyadaki başlık satırını kullanın.`);
    }
    const satirlar = [];
    const bos = Object.fromEntries(EXCEL_SUTUNLARI.map((s) => [s.anahtar, ""]));
    ws.eachRow({ includeEmpty: false }, (row, no) => {
        if (no === 1)
            return;
        const deger = { ...bos };
        let dolu = false;
        eslem.forEach((a, sutunNo) => {
            const m = hucreMetni(row.getCell(sutunNo).value);
            if (m)
                dolu = true;
            deger[a] = m;
        });
        if (dolu)
            satirlar.push({ satir: no, deger });
    });
    if (satirlar.length > 5000)
        throw ApiError.badRequest("Bir seferde en çok 5.000 ürün yüklenebilir; dosyayı bölün.");
    return { sutunHatalari, satirlar };
}
const evetHayir = (v) => {
    const t = ana(v);
    if (!t)
        return null;
    if (["e", "evet", "1", "true", "x", "var"].includes(t))
        return true;
    if (["h", "hayir", "0", "false", "yok"].includes(t))
        return false;
    return "hata";
};
const sutunAdi = (a) => EXCEL_SUTUNLARI.find((s) => s.anahtar === a).baslik;
/** Okunan satırları denetler; veritabanıyla karşılaştırır (kod / barkod eşleşmesi, para birimi). */
export async function excelDenetle(okunan, ctx) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const kartlar = (await pool.request().query(`SELECT STOK_KART_ID, RTRIM(KOD) AS KOD FROM dbo.TODVZ_STOK_KART`)).recordset;
    const kodaGore = new Map(kartlar.map((k) => [String(k.KOD).toLocaleUpperCase("tr-TR"), k.STOK_KART_ID]));
    const kodlar = new Map(kartlar.map((k) => [k.STOK_KART_ID, String(k.KOD)]));
    const barkodlar = new Map((await pool.request().query(`SELECT BARKOD, STOK_KART_ID FROM dbo.TODVZ_STOK_BARKOD`)).recordset.map((b) => [String(b.BARKOD).trim(), b.STOK_KART_ID]));
    const paralar = new Map((await pool.request().query(`SELECT PARA_ID, RTRIM(UPPER(KOD)) AS KOD FROM dbo.TODVZ_PARA`)).recordset.map((p) => [String(p.KOD), p.PARA_ID]));
    const gruplar = new Set((await pool.request().query(`SELECT AD FROM dbo.TODVZ_STOK_GRUP`)).recordset.map((g) => String(g.AD).trim().toLocaleLowerCase("tr-TR")));
    const dosyaKodlari = new Map();
    const dosyaBarkodlari = new Map();
    const yeniGruplar = new Set();
    const satirlar = [];
    const girdiler = [];
    for (const { satir, deger } of okunan.satirlar) {
        const hatalar = [];
        const ekle = (a, mesaj) => hatalar.push({ sutun: sutunAdi(a), mesaj });
        const kod = deger.kod.trim().toLocaleUpperCase("tr-TR");
        const barkodListesi = deger.barkod.split(/[;,|]/).map((b) => b.trim()).filter(Boolean);
        let eslesen = kod ? kodaGore.get(kod) ?? null : null;
        // Kod yazılmışsa eşleşme yalnız koddan (yeni kodlu satır başka kartın barkoduyla o kartın kodunu sessizce değiştirmesin);
        // kod boşsa barkoddan
        if (!kod)
            for (const b of barkodListesi) {
                if (barkodlar.has(b)) {
                    eslesen = barkodlar.get(b);
                    break;
                }
            }
        if (kod) {
            if (dosyaKodlari.has(kod))
                ekle("kod", `"${kod}" kodu dosyada ${dosyaKodlari.get(kod)}. satırda da var.`);
            else
                dosyaKodlari.set(kod, satir);
        }
        for (const b of barkodListesi) {
            if (dosyaBarkodlari.has(b))
                ekle("barkod", `"${b}" barkodu dosyada ${dosyaBarkodlari.get(b)}. satırda da var.`);
            else
                dosyaBarkodlari.set(b, satir);
            const sahibi = barkodlar.get(b);
            if (sahibi && sahibi !== eslesen)
                ekle("barkod", `"${b}" barkodu "${kodlar.get(sahibi)}" kartında kullanılıyor.`);
        }
        if (kod && eslesen && kodaGore.get(kod) && kodaGore.get(kod) !== eslesen)
            ekle("kod", `Kod "${kod}" ile barkod farklı kartları gösteriyor.`);
        let paraId = null;
        const pk = deger.paraBirimi.trim().toUpperCase();
        if (pk && !["TL", "TRY"].includes(pk)) {
            paraId = paralar.get(pk) ?? null;
            if (!paraId)
                ekle("paraBirimi", `"${deger.paraBirimi}" para birimi Ürün Tanımları'nda yok.`);
        }
        else if (pk)
            paraId = paralar.get("TL") ?? paralar.get("TRY") ?? null;
        const dahil = evetHayir(deger.fiyatKdvDahil);
        if (dahil === "hata")
            ekle("fiyatKdvDahil", `"${deger.fiyatKdvDahil}" yerine E ya da H yazın.`);
        const aktif = evetHayir(deger.aktif);
        if (aktif === "hata")
            ekle("aktif", `"${deger.aktif}" yerine E ya da H yazın.`);
        let acilis = 0;
        if (deger.acilisMiktari.trim()) {
            const t = deger.acilisMiktari.trim();
            const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
            if (!Number.isFinite(n))
                ekle("acilisMiktari", `"${t}" sayı değil.`);
            else if (n < 0)
                ekle("acilisMiktari", "Açılış miktarı eksi olamaz.");
            else
                acilis = n;
        }
        const girdi = {
            stokKartId: eslesen,
            kod: kod || (eslesen ? kodlar.get(eslesen) : "") || "",
            ad: deger.ad,
            birim: deger.birim,
            kdvOrani: deger.kdvOrani,
            satisFiyati: deger.satisFiyati,
            fiyatKdvDahil: dahil === "hata" ? null : dahil,
            paraId,
            alisFiyati: deger.alisFiyati,
            enAzStok: deger.enAzStok,
            aktif: aktif === "hata" ? null : aktif,
            aciklama: deger.aciklama,
            barkodlar: barkodListesi,
        };
        const den = kartGirdisiDenetle(girdi);
        for (const h of den.alanHatalari)
            ekle(h.alan === "barkodlar" ? "barkod" : h.alan, h.mesaj);
        const grupAdi = deger.grup.trim();
        if (grupAdi.length > 100)
            ekle("grup", "Grup adı en çok 100 karakter olabilir.");
        else if (grupAdi && !gruplar.has(grupAdi.toLocaleLowerCase("tr-TR")))
            yeniGruplar.add(grupAdi);
        satirlar.push({ satir, deger, durum: eslesen ? "GUNCELLE" : "YENI", eslesenKod: eslesen ? kodlar.get(eslesen) || null : null, hatalar });
        girdiler.push({ ...girdi, grupAdi, acilis });
    }
    const hataliSatir = satirlar.filter((s) => s.hatalar.length).length;
    const bilgiler = [];
    if (yeniGruplar.size)
        bilgiler.push(`Açılacak yeni grup: ${[...yeniGruplar].join(", ")}`);
    const acilisKalemi = girdiler.filter((g) => g.acilis > 0).length;
    if (acilisKalemi)
        bilgiler.push(`${acilisKalemi} ürünün açılış miktarı "Excel açılış" stok giriş fişiyle girilecek.`);
    if (!okunan.satirlar.length)
        okunan.sutunHatalari.push("Dosyada başlık satırının altında ürün yok.");
    return {
        onizleme: {
            sutunHatalari: okunan.sutunHatalari,
            bilgiler,
            satirlar,
            hataliSatir,
            yeni: satirlar.filter((s) => s.durum === "YENI").length,
            guncellenecek: satirlar.filter((s) => s.durum === "GUNCELLE").length,
            acilisKalemi,
            yuklenebilir: !okunan.sutunHatalari.length && !hataliSatir && satirlar.length > 0,
        },
        girdiler,
    };
}
export async function excelOnizle(dosya, ctx) {
    return (await excelDenetle(await excelOku(dosya), ctx)).onizleme;
}
/** Denetimden geçen dosyayı tek işlemde yükler. Hata varsa hiçbir şey yazılmaz. */
export async function excelYukle(dosya, kullaniciId, ctx) {
    const { onizleme, girdiler } = await excelDenetle(await excelOku(dosya), ctx);
    if (!onizleme.yuklenebilir)
        throw ApiError.badRequest("Dosyada düzeltilmesi gereken hatalar var; önizlemedeki kırmızı hücreleri düzeltip yeniden yükleyin.", { onizleme });
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let girisNo = null;
    try {
        const acilis = [];
        for (let i = 0; i < girdiler.length; i++) {
            const g = girdiler[i];
            try {
                const stokGrupId = g.grupAdi ? await TicariStokSqlRepository.grupBulVeyaAc(tx, g.grupAdi, kullaniciId) : null;
                // Güncellemede Excel'de boş bırakılan hücre kartın değerini silmez; barkodlar eskilere eklenir
                let yazilacak = { ...g, stokGrupId };
                if (g.stokKartId) {
                    const e = (await new sql.Request(tx).input("ID", sql.Int, g.stokKartId).query(`
            SELECT K.*, STUFF((SELECT '|' + B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID ORDER BY B.STOK_BARKOD_ID FOR XML PATH(''), TYPE).value('.', 'varchar(max)'), 1, 1, '') AS BARKODLAR
            FROM dbo.TODVZ_STOK_KART K WHERE K.STOK_KART_ID = @ID`)).recordset[0];
                    const bos = (v) => v === null || v === undefined || String(v).trim() === "";
                    const eskiBarkod = e?.BARKODLAR ? String(e.BARKODLAR).split("|").filter(Boolean) : [];
                    yazilacak = {
                        ...g,
                        stokGrupId: stokGrupId ?? e?.STOK_GRUP_ID ?? null,
                        birim: bos(g.birim) ? e?.BIRIM : g.birim,
                        kdvOrani: bos(g.kdvOrani) ? e?.KDV_ORANI : g.kdvOrani,
                        satisFiyati: bos(g.satisFiyati) ? e?.SATIS_FIYATI : g.satisFiyati,
                        fiyatKdvDahil: g.fiyatKdvDahil ?? (e ? e.FIYAT_KDV_DAHIL === true || e.FIYAT_KDV_DAHIL === 1 : true),
                        paraId: g.paraId ?? e?.PARA_ID ?? null,
                        alisFiyati: bos(g.alisFiyati) ? e?.ALIS_FIYATI : g.alisFiyati,
                        enAzStok: bos(g.enAzStok) ? e?.EN_AZ_STOK : g.enAzStok,
                        aktif: g.aktif ?? (e ? e.AKTIF === true || e.AKTIF === 1 : true),
                        aciklama: bos(g.aciklama) ? e?.ACIKLAMA : g.aciklama,
                        barkodlar: [...new Set([...eskiBarkod, ...(g.barkodlar || [])])],
                    };
                }
                const id = await TicariStokSqlRepository.kartYaz(tx, yazilacak, kullaniciId);
                if (g.acilis > 0) {
                    const alis = g.alisFiyati === null || g.alisFiyati === undefined || String(g.alisFiyati).trim() === "" ? null : Number(String(g.alisFiyati).replace(",", "."));
                    acilis.push({ stokKartId: id, miktar: g.acilis, birimFiyat: alis });
                }
            }
            catch (e) {
                throw ApiError.badRequest(`${onizleme.satirlar[i].satir}. satır: ${e?.message || e}`);
            }
        }
        if (acilis.length) {
            const r = await TicariGirisSqlRepository.yaz(tx, {
                aciklama: "Excel açılış",
                satirlar: acilis.map((a) => ({ stokKartId: a.stokKartId, miktar: a.miktar, birimFiyat: a.birimFiyat })),
                eksiStokOnay: true,
            }, kullaniciId);
            girisNo = (await new sql.Request(tx).input("ID", sql.Int, r.id).query(`SELECT FIS_NO FROM dbo.TODVZ_STOK_GIRIS WHERE STOK_GIRIS_ID = @ID`)).recordset[0]?.FIS_NO ?? null;
        }
        await tx.commit();
    }
    catch (e) {
        await tx.rollback().catch(() => undefined);
        throw e;
    }
    return { yeni: onizleme.yeni, guncellenen: onizleme.guncellenecek, acilisFisNo: girisNo ? String(girisNo).trim() : null };
}
