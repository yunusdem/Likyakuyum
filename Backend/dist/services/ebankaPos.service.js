import ExcelJS from "exceljs";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { EBankaAktarimSqlRepository } from "../models/ebankaAktarimSql.repository.js";
import { EBankaPosSqlRepository } from "../models/ebankaPosSql.repository.js";
import { EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { BankaService } from "./banka.service.js";
import { VomsisClient } from "./vomsis/vomsis.client.js";
// F- e-Banka Faz 3 — fiziksel POS (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E21): yalnızca izleme + Excel dökümü + elle banka fişi
const BES_DAKIKA_SN = 5 * 60;
const GUN_MS = 86_400_000;
const VOMSIS_EN_UZUN_ARALIK_GUN = 14; // Vomsis POS sorgusu tek seferde en fazla 14 gün verir
const EN_UZUN_ESITLEME_GUN = 92;
const calisanlar = new Set();
const firmaAnahtari = (c) => `pos|${(c?.dbServer || "").toLowerCase()}|${(c?.dbName || "").toLowerCase()}`;
const gunMu = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const dizi = (v) => (Array.isArray(v) ? v : []);
const iki = (n) => String(n).padStart(2, "0");
/** UTC ms → Vomsis'in beklediği "GG-AA-YYYY" */
const vomsisGunu = (ms) => {
    const d = new Date(ms);
    return `${iki(d.getUTCDate())}-${iki(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
};
/** [başlangıç, bitiş] aralığını Vomsis sınırına uyan dilimlere böler (uçlar dahil). */
export const dilimle = (baslangic, bitis, gun = VOMSIS_EN_UZUN_ARALIK_GUN) => {
    const son = Date.parse(`${bitis}T00:00:00Z`);
    const dilimler = [];
    for (let bas = Date.parse(`${baslangic}T00:00:00Z`); bas <= son; bas += gun * GUN_MS) {
        dilimler.push({ bas, bit: Math.min(bas + (gun - 1) * GUN_MS, son) });
    }
    return dilimler;
};
export class EBankaPosService {
    static async esitle(girdi, kullaniciId, dbContext) {
        const { baslangic, bitis } = girdi;
        if (!gunMu(baslangic) || !gunMu(bitis))
            throw ApiError.badRequest("Başlangıç ve bitiş tarihi zorunludur.");
        if (baslangic > bitis)
            throw ApiError.badRequest("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
        if ((Date.parse(bitis) - Date.parse(baslangic)) / GUN_MS > EN_UZUN_ESITLEME_GUN) {
            throw ApiError.badRequest(`POS hareketleri tek seferde en fazla ${EN_UZUN_ESITLEME_GUN} günlük aralıkla çekilebilir.`);
        }
        const mod = (await EBankaSqlRepository.ayarGetir(dbContext))?.mod ?? "sahte";
        if (mod === "canli") {
            const { gecenSaniye } = await EBankaPosSqlRepository.sonEsitleme(dbContext);
            if (gecenSaniye !== null && gecenSaniye >= 0 && gecenSaniye < BES_DAKIKA_SN) {
                throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, `Banka servisi 5 dakikada bir sorgulanabilir. ${BES_DAKIKA_SN - gecenSaniye} saniye sonra yeniden deneyin.`);
            }
        }
        const anahtar = firmaAnahtari(dbContext);
        if (calisanlar.has(anahtar))
            throw ApiError.conflict("Şu anda başka bir POS eşitlemesi sürüyor. Bitmesini bekleyin.");
        calisanlar.add(anahtar);
        let yeni = 0;
        let guncellenen = 0;
        try {
            const terminaller = dizi((await VomsisClient.istek("banka", "/pos-rapor/stations", {}, dbContext))?.data);
            await EBankaPosSqlRepository.terminalleriYaz(terminaller, dbContext);
            // Çekilen dilim hemen yazılır: Vomsis arada çağrı sınırına takılırsa o ana kadar gelenler kaybolmaz
            for (const t of terminaller) {
                if (!t?.id || t.status === 0)
                    continue;
                for (const d of dilimle(baslangic, bitis)) {
                    const yanit = await VomsisClient.istek("banka", `/pos-rapor/stations/${t.id}/transactions`, { sorgu: { beginDate: vomsisGunu(d.bas), endDate: vomsisGunu(d.bit) } }, dbContext);
                    if (yanit?.status && yanit.status !== "success")
                        throw new ApiError(HttpStatus.BAD_GATEWAY, `Banka servisi POS hareketlerini vermedi: ${yanit.message || yanit.status}`);
                    const sonuc = await EBankaPosSqlRepository.hareketleriYaz(t.id, dizi(yanit?.transactions), dbContext);
                    yeni += sonuc.yeni;
                    guncellenen += sonuc.guncellenen;
                }
            }
            await EBankaPosSqlRepository.sonEsitlemeyiYaz(dbContext);
            await EBankaSqlRepository.logYaz({ islem: "pos-esitleme", mod, basarili: true, adet: yeni, mesaj: `${baslangic} – ${bitis}: ${terminaller.length} terminal, ${yeni} yeni / ${guncellenen} güncellenen hareket`, kullaniciId }, dbContext);
            return { mod, baslangic, bitis, terminalAdedi: terminaller.length, yeniHareket: yeni, guncellenenHareket: guncellenen };
        }
        catch (err) {
            await EBankaSqlRepository.logYaz({ islem: "pos-esitleme", mod, basarili: false, adet: yeni, mesaj: `${baslangic} – ${bitis}: ${err?.message} (hatadan önce ${yeni} yeni hareket yazıldı)`, kullaniciId }, dbContext);
            throw err;
        }
        finally {
            calisanlar.delete(anahtar);
        }
    }
    static async ozet(dbContext) {
        const [ayar, terminaller, son] = await Promise.all([
            EBankaSqlRepository.ayarGetir(dbContext),
            EBankaPosSqlRepository.terminalleriListele(dbContext),
            EBankaPosSqlRepository.sonEsitleme(dbContext),
        ]);
        return { mod: ayar?.mod ?? "sahte", sonEsitleme: son.zaman, terminaller };
    }
    static async hareketleriListele(filtre, dbContext) {
        return EBankaPosSqlRepository.hareketleriListele(filtre, dbContext);
    }
    /** Muhasebeciye verilecek döküm: gün/terminal bazında brüt–komisyon–net + hareket listesi. Dosyada açıklama yazısı olmaz. */
    static async excel(filtre, dbContext) {
        const veri = await EBankaPosSqlRepository.hareketleriListele({ ...filtre, sayfa: 1, sayfaBoyutu: 0 }, dbContext);
        const kitap = new ExcelJS.Workbook();
        const para = "#,##0.00";
        const baslikYap = (sayfa) => {
            sayfa.getRow(1).font = { bold: true };
            sayfa.views = [{ state: "frozen", ySplit: 1 }];
        };
        const ozet = kitap.addWorksheet("Muhasebe Fişi Dökümü");
        ozet.columns = [
            { header: "Tarih", key: "tarih", width: 12 },
            { header: "Banka", key: "banka", width: 18 },
            { header: "Terminal", key: "terminal", width: 22 },
            { header: "Döviz", key: "doviz", width: 8 },
            { header: "İşlem Adedi", key: "adet", width: 12 },
            { header: "Brüt", key: "brut", width: 16, style: { numFmt: para } },
            { header: "Komisyon", key: "komisyon", width: 14, style: { numFmt: para } },
            { header: "Net", key: "net", width: 16, style: { numFmt: para } },
            { header: "Valör", key: "valor", width: 12 },
        ];
        for (const g of veri.gunluk)
            ozet.addRow({ tarih: g.islemTarihi, banka: g.bankaAdi, terminal: g.terminalAdi, doviz: g.doviz, adet: g.adet, brut: g.brut, komisyon: g.komisyon, net: g.net, valor: g.valor });
        for (const t of veri.toplamlar) {
            ozet.addRow({ tarih: "TOPLAM", doviz: t.doviz, adet: t.adet, brut: t.brut, komisyon: t.komisyon, net: t.net }).font = { bold: true };
        }
        baslikYap(ozet);
        const liste = kitap.addWorksheet("POS Hareketleri");
        liste.columns = [
            { header: "Tarih", key: "tarih", width: 12 },
            { header: "Saat", key: "saat", width: 10 },
            { header: "Banka", key: "banka", width: 18 },
            { header: "Terminal", key: "terminal", width: 22 },
            { header: "Kart No", key: "kart", width: 20 },
            { header: "Kart Tipi", key: "kartTipi", width: 14 },
            { header: "İşlem", key: "islem", width: 12 },
            { header: "Açıklama", key: "aciklama", width: 24 },
            { header: "Taksit", key: "taksit", width: 8 },
            { header: "Döviz", key: "doviz", width: 8 },
            { header: "Brüt", key: "brut", width: 16, style: { numFmt: para } },
            { header: "Komisyon Oranı", key: "oran", width: 14, style: { numFmt: "0.00" } },
            { header: "Komisyon", key: "komisyon", width: 14, style: { numFmt: para } },
            { header: "Net", key: "net", width: 16, style: { numFmt: para } },
            { header: "Valör", key: "valor", width: 12 },
            { header: "Provizyon No", key: "provizyon", width: 14 },
            { header: "Batch", key: "batch", width: 10 },
            { header: "Banka Fişi", key: "fis", width: 12 },
        ];
        for (const h of veri.satirlar) {
            liste.addRow({
                tarih: h.islemTarihi, saat: h.saat, banka: h.bankaAdi, terminal: h.terminalAdi, kart: h.kartNo, kartTipi: h.kartTipi, islem: h.islemTipi, aciklama: h.aciklama,
                taksit: h.taksitSayisi || null, doviz: h.doviz, brut: h.brut, oran: h.komisyonOrani, komisyon: h.komisyon, net: h.net, valor: h.valor,
                provizyon: h.provizyonNo, batch: h.batch, fis: h.bankaHareketId && h.bankaHareketId > 0 ? h.bankaHareketId : null,
            });
        }
        baslikYap(liste);
        return Buffer.from(await kitap.xlsx.writeBuffer());
    }
    /** Seçilen POS satırlarının net toplamı için elle "0- Havale Alma" fişi. Yalnızca Canlı modda. */
    static async fisKes(girdi, kullaniciId, dbContext) {
        if (((await EBankaSqlRepository.ayarGetir(dbContext))?.mod ?? "sahte") !== "canli") {
            throw ApiError.badRequest("Test (örnek veri) modunda fiş kesilmez. Banka fişi yalnızca Canlı modda oluşturulur.");
        }
        const idler = [...new Set((Array.isArray(girdi.vomsisIdler) ? girdi.vomsisIdler : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
        if (!idler.length)
            throw ApiError.badRequest("POS hareketi seçilmedi.");
        const bankaId = Number(girdi.bankaId);
        if (!(bankaId > 0))
            throw ApiError.badRequest("Banka hesabı seçilmelidir.");
        await BankaService.getBankaById(bankaId, dbContext); // yoksa 404; mevcut fiş kaydı olmayan kart için sessizce yeni kart açıyor
        if (girdi.tarih !== undefined && !gunMu(girdi.tarih))
            throw ApiError.badRequest("Fiş tarihi geçersiz.");
        const satirlar = await EBankaPosSqlRepository.secilenleriGetir(idler, dbContext);
        if (satirlar.length !== idler.length)
            throw ApiError.badRequest("Seçilen hareketlerin bir kısmı bulunamadı.");
        if (satirlar.some((s) => s.bankaHareketId !== null))
            throw ApiError.conflict("Seçilen hareketlerin bir kısmı için zaten banka fişi kesilmiş.");
        const dovizler = [...new Set(satirlar.map((s) => (s.doviz || "TL").toUpperCase()))];
        if (dovizler.length > 1)
            throw ApiError.badRequest("Farklı döviz cinsindeki hareketler tek fişte toplanamaz.");
        const net = Math.round(satirlar.reduce((t, s) => t + s.net, 0) * 100) / 100;
        if (!(net > 0))
            throw ApiError.badRequest("Seçilen hareketlerin net toplamı sıfır ya da eksi.");
        const para = await EBankaAktarimSqlRepository.paraSozlugu(dbContext);
        const paraId = para.kodlar.get(dovizler[0]);
        if (!paraId)
            throw ApiError.badRequest(`"${dovizler[0]}" döviz cinsi para tanımlarında yok.`);
        const cariKartId = girdi.cariKartId ? Number(girdi.cariKartId) : null;
        if (cariKartId && !(await EBankaAktarimSqlRepository.cariGetir(cariKartId, dbContext)))
            throw ApiError.badRequest("Seçilen cari bulunamadı.");
        const gunler = satirlar.map((s) => s.valor || s.islemTarihi || "").filter(Boolean).sort();
        const fisGunu = girdi.tarih || gunler[gunler.length - 1] || new Date().toISOString().slice(0, 10);
        let kur = 1;
        if (paraId !== para.tlId) {
            kur = Number(girdi.kur) > 0 ? Number(girdi.kur) : await EBankaAktarimSqlRepository.kurGetir(paraId, fisGunu, true, dbContext);
            if (!(kur > 0))
                throw ApiError.badRequest("Bu tarih için kur bulunamadı; kuru elle girin.");
        }
        if (!(await EBankaPosSqlRepository.talepEt(idler, dbContext)))
            throw ApiError.conflict("Seçilen hareketlerin bir kısmı için zaten banka fişi kesilmiş.");
        try {
            const islemGunleri = [...new Set(satirlar.map((s) => s.islemTarihi).filter(Boolean))].sort();
            const terminaller = [...new Set(satirlar.map((s) => s.terminalAdi))].join(", ");
            const donem = islemGunleri.length > 1 ? `${islemGunleri[0]} – ${islemGunleri[islemGunleri.length - 1]}` : islemGunleri[0] || "";
            const aciklama = `POS net: ${terminaller} ${donem} (${satirlar.length} işlem)`.slice(0, 250);
            const fis = await BankaService.saveHareket({
                islemTipi: 0,
                bankaId,
                cariKartId,
                tarih: `${fisGunu}T00:00:00Z`,
                belgeNo: null,
                aciklama,
                satirlar: [{ satirNo: 1, paraId, meblag: net, kur, giseKuru: kur, tutarTl: Math.round(net * kur * 100) / 100, aciklama }],
            }, kullaniciId, dbContext);
            await EBankaPosSqlRepository.fisiYaz(idler, fis.bankaHareketId, dbContext);
            await EBankaSqlRepository.logYaz({ islem: "pos-fis", mod: "canli", basarili: true, adet: satirlar.length, mesaj: `Banka fişi #${fis.bankaHareketId}: ${aciklama}`, kullaniciId }, dbContext);
            return { bankaHareketId: fis.bankaHareketId, net, adet: satirlar.length };
        }
        catch (err) {
            await EBankaPosSqlRepository.talebiBirak(idler, dbContext).catch(() => undefined);
            throw err;
        }
    }
}
