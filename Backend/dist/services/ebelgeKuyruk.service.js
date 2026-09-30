import { getPoolKey, setDbCredentials } from "../config/mssql.config.js";
import { env } from "../config/env.config.js";
import { logger } from "../utils/logger.js";
import { EbelgeSqlRepository } from "../models/ebelgeSql.repository.js";
import { EbelgeKuyrukRepository } from "../models/ebelgeKuyruk.repository.js";
import { EbelgeKaynakRepository, kaynakKimlikCoz } from "../models/ebelgeKaynak.repository.js";
import { FirmaSqlRepository } from "../models/admin/firmaSql.repository.js";
import { MerkezGirisService } from "./merkezGiris.service.js";
import { getInvoiceStatusDetail, gonderimSatirlari, sendDraftDocumentApproval, sendInvoice, } from "./ice/ice.efatura.js";
import { getEarsivRaporStatu, sendDocumentEmail, sendEarsiv, sendEarsivIptal, } from "./ice/ice.earsiv.js";
import { getDespatchAdviceStatus, irsaliyeGonderimSatirlari, sendDespatchAdvice } from "./ice/ice.irsaliye.js";
import { getGiderPusulasiCikti, sendGiderPusulasi } from "./ice/ice.giderpusulasi.js";
import { cancelMustahsil, sendMustahsil } from "./ice/ice.mustahsil.js";
import { getEDovizStatus, sendEDoviz, sendEDovizIptal } from "./ice/ice.edoviz.js";
import { toBase64 } from "./ice/ubl/invoiceBuilder.js";
/** Kullanıcıya "Gönderildi" gösterilen, arka planda sonucu beklenen durumlar */
export const ASKIDAKI_DURUMLAR = ["KUYRUKTA", "GONDERILIYOR", "BELIRSIZ", "ONAYLANIYOR"];
const MAKS_DENEME = 5;
const SURE_DK = 35;
const TAZE_DK = 5;
const YETIM_GUN = 2;
const TIK_MS = 30_000;
const SAHIPSIZ_TARAMA_MS = 5 * 60_000;
export const BEKLEME_MS = 15_000;
const dogru = (v) => String(v).toLowerCase() === "true";
const yanlis = (v) => String(v).toLowerCase() === "false";
const dolu = (v) => String(v ?? "").trim() !== "";
const ayni = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
const bulunamadiMi = (m) => /bulunamad|bulunmad|kay[ıi]t yok|mevcut de[ğg]il|not found/i.test(String(m ?? ""));
/** Tekrar gönderimde ICE'nin "bu belge zaten var" cevabı */
const tekrarMi = (m) => /zaten|daha [öo]nce|mevcut|kay[ıi]tl[ıi]|kullan[ıi]lm[ıi][şs]|already|duplicate/i.test(String(m ?? ""));
const hataMesaji = (e) => String(e?.message || e || "bilinmeyen hata").slice(0, 300);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms).unref?.());
/** ICE mail enum'u */
export const mailBelgeTuru = (belgeTuru) => belgeTuru === "EArsiv"
    ? "EArsiv"
    : belgeTuru === "EFatura"
        ? "EFatura_Giden"
        : belgeTuru === "EIrsaliye"
            ? "EIrsaliye_Giden"
            : belgeTuru === "EGiderPusulasi"
                ? "EGiderPusulasi"
                : "Diger";
/**
 * Tek belgelik gönderim cevabını değerlendirir (eski eşzamanlı akışlarla aynı kural):
 * başarı yalnız tek satır, ETTN ve numara eşleşirse; açık ret success=false ise; gerisi belirsiz.
 */
const degerlendir = (sonuc, satirlar, uuid, belgeNo, semaKontrol) => {
    const ilk = satirlar.length === 1 ? satirlar[0] : undefined;
    const basarili = dogru(sonuc?.success) &&
        !!ilk &&
        dogru(ilk.success) &&
        (!semaKontrol || (dogru(ilk.shema_is_validate) && dogru(ilk.schematron_is_validate))) &&
        ayni(ilk.ettn, uuid) &&
        ilk.ID === belgeNo;
    const acikRed = yanlis(sonuc?.success) || (!!ilk && yanlis(ilk.success));
    const kod = String(sonuc?.response_code ?? "");
    if (basarili)
        return { durum: "GONDERILDI", kod, mesaj: String(sonuc?.response_message || "").trim() };
    if (acikRed) {
        return { durum: "HATA", kod, mesaj: String(ilk?.response_message || sonuc?.response_message || "ICE belgeyi reddetti.").trim() };
    }
    return { durum: "BELIRSIZ", kod, mesaj: "ICE cevabı belgeyi kesin olarak doğrulamadı." };
};
const xmlVar = (kayit) => dolu(kayit?.XML_ICERIK);
/** Sorgu hatası "belge yok" diyorsa YOK, diğer hatalarda bilinmiyor */
const hataVarligi = (e) => (bulunamadiMi(e?.message) ? "YOK" : "BILINMIYOR");
/** Gönderici / alıcı bilgisi: kuyruğa yazılan veriden; yoksa (sahipsiz kayıt) ayar ve giden kaydından */
const taraflar = async (kayit, veri, ctx) => {
    const ayar = veri?.fromVkn ? null : await EbelgeSqlRepository.getAyar(ctx);
    return {
        fromVknTckn: String(veri?.fromVkn || ayar?.firmaVkn || ""),
        fromAlias: String(veri?.fromAlias ?? ayar?.firmaAlias ?? ""),
        toVknTckn: String(veri?.toVkn || kayit.ALICI_VKN || ""),
        toAlias: String(veri?.toAlias || kayit.ALICI_ALIAS || ""),
    };
};
/** Tür başına ICE işlemleri (dışa açık: saf mantık testi sahte ICE ile çalıştırır) */
export const ADAPTORLER = {
    EFatura: {
        metod: "send_invoice",
        gonderilebilir: (k) => xmlVar(k) && dolu(k.ALICI_ALIAS),
        async gonder(config, kayit, veri, ctx) {
            const t = await taraflar(kayit, veri, ctx);
            const sonuc = await sendInvoice(config, { ...t, invoicesBase64: [toBase64(kayit.XML_ICERIK)] });
            return degerlendir(sonuc, gonderimSatirlari(sonuc), kayit.uuid, kayit.belgeNo, true);
        },
        async varMi(config, kayit) {
            try {
                const d = await getInvoiceStatusDetail(config, kayit.uuid);
                if (bulunamadiMi(d?.STATUS_DESCRIPTION) || bulunamadiMi(d?.STATUS))
                    return "YOK";
                return dolu(d?.STATUS) || dolu(d?.STATUS_CODE) || dolu(d?.STATUS_DESCRIPTION) ? "VAR" : "YOK";
            }
            catch (e) {
                return hataVarligi(e);
            }
        },
    },
    EArsiv: {
        metod: "send_earsiv",
        gonderilebilir: xmlVar,
        async gonder(config, kayit) {
            const sonuc = await sendEarsiv(config, [toBase64(kayit.XML_ICERIK)]);
            return degerlendir(sonuc, gonderimSatirlari(sonuc), kayit.uuid, kayit.belgeNo, true);
        },
        async varMi(config, kayit) {
            try {
                const r = await getEarsivRaporStatu(config, [kayit.uuid]);
                return r.some((x) => ayni(x.ETTN, kayit.uuid)) ? "VAR" : "YOK";
            }
            catch (e) {
                return hataVarligi(e);
            }
        },
    },
    EIrsaliye: {
        metod: "send_DespatchAdvice",
        gonderilebilir: (k) => xmlVar(k) && dolu(k.ALICI_ALIAS),
        async gonder(config, kayit, veri, ctx) {
            const t = await taraflar(kayit, veri, ctx);
            const sonuc = await sendDespatchAdvice(config, { ...t, despatchAdvicesBase64: [toBase64(kayit.XML_ICERIK)] });
            return degerlendir(sonuc, irsaliyeGonderimSatirlari(sonuc), kayit.uuid, kayit.belgeNo, false);
        },
        async varMi(config, kayit) {
            try {
                const r = await getDespatchAdviceStatus(config, [kayit.uuid], "OUT");
                const bu = r.filter((x) => ayni(x.ETTN, kayit.uuid) || ayni(x.InstanceIdentifier, kayit.uuid) || ayni(x.ID, kayit.belgeNo));
                return bu.some((x) => dolu(x.Status) || dolu(x.Status_Code)) ? "VAR" : "YOK";
            }
            catch (e) {
                return hataVarligi(e);
            }
        },
    },
    EGiderPusulasi: {
        metod: "send_egider_pusulasi",
        gonderilebilir: xmlVar,
        async gonder(config, kayit) {
            const sonuc = await sendGiderPusulasi(config, [toBase64(kayit.XML_ICERIK)]);
            return degerlendir(sonuc, gonderimSatirlari(sonuc), kayit.uuid, kayit.belgeNo, false);
        },
        async varMi(config, kayit) {
            try {
                const c = await getGiderPusulasiCikti(config, kayit.uuid, { html: true });
                if (c.html)
                    return "VAR";
                return bulunamadiMi(c.mesaj) || !dolu(c.mesaj) ? "YOK" : "BILINMIYOR";
            }
            catch (e) {
                return hataVarligi(e);
            }
        },
    },
    EMustahsil: {
        metod: "send_emustahsil",
        gonderilebilir: xmlVar,
        async gonder(config, kayit) {
            const sonuc = await sendMustahsil(config, toBase64(kayit.XML_ICERIK));
            return degerlendir(sonuc, gonderimSatirlari(sonuc), kayit.uuid, kayit.belgeNo, true);
        },
        // Giden müstahsil için ETTN sorgusu yok; yeniden gönderimin "zaten var" cevabı sonucu belirler
        async varMi() {
            return "BILINMIYOR";
        },
    },
    EDoviz: {
        metod: "send_edoviz_basic",
        // XML saklanmaz; gönderim girdisi kuyruğa yazılır. Sahipsiz eski kayıt yalnızca sorgulanır.
        gonderilebilir: (_k, veri) => !!veri?.dovizGirdi,
        async gonder(config, kayit, veri) {
            const sonuc = await sendEDoviz(config, veri.dovizGirdi);
            const ham = sonuc?.CreditNoteType_responseTypes?.CreditNoteType_responseType;
            const satirlar = Array.isArray(ham) ? ham : ham ? [ham] : [];
            const s = degerlendir(sonuc, satirlar, kayit.uuid, kayit.belgeNo, true);
            // ICE reddettiği belgenin numarasını da kaydeder (docs: ICE e-Döviz kuralları)
            return s.durum === "HATA"
                ? { ...s, mesaj: `${s.mesaj} ICE bu numarayı kaydetti; fişi düzeltip yeni numarayla kesiniz.` }
                : s;
        },
        async varMi(config, kayit) {
            try {
                return (await getEDovizStatus(config, [kayit.uuid])).length ? "VAR" : "YOK";
            }
            catch (e) {
                return hataVarligi(e);
            }
        },
    },
};
/** İptal çağrıları: {IPTAL | RED | BELIRSIZ} */
const iptalGonder = async (config, kayit, tarih) => {
    try {
        if (kayit.belgeTuru === "EArsiv") {
            const s = await sendEarsivIptal(config, kayit.belgeNo, tarih);
            const mesaj = String(s?.response_message || "").trim();
            return { durum: dogru(s?.success) ? "IPTAL" : yanlis(s?.success) ? "RED" : "BELIRSIZ", mesaj };
        }
        const s = kayit.belgeTuru === "EDoviz"
            ? await sendEDovizIptal(config, kayit.belgeNo, tarih.toISOString())
            : await cancelMustahsil(config, kayit.belgeNo, tarih.toISOString());
        return { durum: s.basarili ? "IPTAL" : "RED", mesaj: s.mesaj };
    }
    catch (e) {
        return { durum: "BELIRSIZ", mesaj: hataMesaji(e) };
    }
};
/** Onay / iptal / e-posta ICE çağrıları (dışa açık: test sahte ICE koyar) */
export const KUYRUK_ICE = {
    iptal: iptalGonder,
    onay: sendDraftDocumentApproval,
    mail: sendDocumentEmail,
};
export class EbelgeKuyrukService {
    /** İşlenecek firma veritabanları. Anahtar: havuz anahtarı (sunucu:port:db) */
    static baglamlar = new Map();
    static calisiyor = false;
    static sonTarama = 0;
    static baslatildi = false;
    /** e-Belge isteği gelen firma listeye girer (tablo yoksa kurulabilir: firma e-Belge kullanıyor) */
    static baglamKaydet(ctx, kurulabilir = true) {
        if (!ctx?.dbName && !ctx?.dbServer)
            return;
        const anahtar = getPoolKey(ctx.dbServer, ctx.dbName);
        const eski = this.baglamlar.get(anahtar);
        this.baglamlar.set(anahtar, { ctx: { dbServer: ctx.dbServer, dbName: ctx.dbName }, kurulabilir: kurulabilir || !!eski?.kurulabilir });
    }
    /** Sunucu açılışında bir kez: zamanlayıcı + yeniden başlatmada kalan işler için firmaları bul */
    static baslat() {
        if (this.baslatildi)
            return;
        this.baslatildi = true;
        setInterval(() => void this.tik(), TIK_MS).unref();
        setTimeout(() => void this.firmalariBul(), 10_000).unref();
    }
    static async firmalariBul() {
        try {
            if (MerkezGirisService.aktifMi()) {
                const firmalar = await FirmaSqlRepository.listele();
                for (const f of firmalar.filter((x) => x.durum === "AKTIF")) {
                    try {
                        const b = await MerkezGirisService.firmaBaglantisi(f.firmaId);
                        setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
                        this.baglamKaydet({ dbServer: b.dbServer, dbName: b.dbName }, false);
                    }
                    catch {
                        /* bağlantısı eksik firma atlanır */
                    }
                }
            }
            else if (env.DB_NAME) {
                this.baglamKaydet({ dbServer: env.DB_SERVER, dbName: env.DB_NAME }, false);
            }
            logger.info(`e-Belge kuyruğu: ${this.baglamlar.size} firma veritabanı izleniyor.`);
        }
        catch (e) {
            logger.warn("e-Belge kuyruğu firma listesini alamadı; yalnızca istek gelen firmalar işlenecek:", e);
        }
    }
    static async tik() {
        if (this.calisiyor)
            return;
        this.calisiyor = true;
        try {
            const tara = Date.now() - this.sonTarama > SAHIPSIZ_TARAMA_MS;
            if (tara)
                this.sonTarama = Date.now();
            for (const { ctx, kurulabilir } of [...this.baglamlar.values()]) {
                try {
                    if (!kurulabilir && !(await EbelgeKuyrukRepository.tabloVarMi(ctx)))
                        continue;
                    if (tara) {
                        await this.sahipsizleriAl(ctx);
                        await EbelgeKuyrukRepository.temizle(ctx);
                    }
                    const isler = await EbelgeKuyrukRepository.al(5, ctx);
                    for (const is of isler)
                        await this.isle(ctx, is);
                }
                catch (e) {
                    logger.warn(`e-Belge kuyruğu (${ctx.dbName}) işlenemedi:`, e);
                }
            }
        }
        finally {
            this.calisiyor = false;
        }
    }
    /** Kuyruk öncesinden kalan / kuyruk satırı yazılamamış askıdaki kayıtlar için iş aç */
    static async sahipsizleriAl(ctx) {
        for (const s of await EbelgeKuyrukRepository.sahipsizler(ctx)) {
            if (!(s.belgeTuru in ADAPTORLER))
                continue;
            await EbelgeKuyrukRepository.ekle({ uuid: s.uuid, belgeTuru: s.belgeTuru, islem: s.durum === "ONAYLANIYOR" ? "ONAY" : "GONDER", veri: { yetim: true }, kullanici: "kuyruk" }, ctx);
            logger.info(`e-Belge kuyruğu: askıda kalan ${s.belgeTuru} ${s.uuid} (${s.durum}) sonuçlandırılmak üzere alındı.`);
        }
    }
    /**
     * İşi kuyruğa yazar, hemen işlemeye başlar ve en çok `beklemeMs` bekler. Sonuç o sürede çıkmadıysa
     * işlem arka planda sürer; çağıran giden kaydının durumuna bakarak cevap verir.
     */
    static async kuyrugaAl(is, ctx, beklemeMs = BEKLEME_MS) {
        this.baglamKaydet(ctx);
        const id = await EbelgeKuyrukRepository.ekle(is, ctx);
        const isleniyor = (async () => {
            const [alinan] = await EbelgeKuyrukRepository.al(1, ctx, id);
            if (alinan)
                await this.isle(ctx, alinan);
        })().catch((e) => logger.warn(`e-Belge kuyruğu ${is.islem} ${is.uuid} ilk deneme hatası:`, e));
        if (beklemeMs > 0)
            await Promise.race([isleniyor, bekle(beklemeMs)]);
    }
    static async isle(ctx, is) {
        try {
            if (is.islem === "GONDER")
                await this.gonderIsle(ctx, is);
            else if (is.islem === "ONAY")
                await this.onayIsle(ctx, is);
            else if (is.islem === "IPTAL")
                await this.iptalIsle(ctx, is);
            else if (is.islem === "MAIL")
                await this.mailIsle(ctx, is);
            else
                await EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", "Bilinmeyen işlem", ctx);
        }
        catch (e) {
            // Beklenmeyen hata (DB, ayar okunamadı…): iş kaybolmasın, sonra tekrar denensin
            logger.warn(`e-Belge kuyruğu ${is.islem} ${is.uuid} işlenemedi:`, e);
            await EbelgeKuyrukRepository.ertele(is.id, 120, hataMesaji(e), ctx).catch(() => undefined);
        }
    }
    /** Giden durumunu değiştirir; başka bir işlem önce davrandıysa false */
    static async gecir(ctx, kayit, beklenen, durum, sonuc = {}) {
        try {
            await EbelgeSqlRepository.earsivDurumGecir(kayit.uuid, beklenen, durum, sonuc, ctx, kayit.belgeTuru);
            return true;
        }
        catch (e) {
            if (e?.statusCode === 409)
                return false;
            throw e;
        }
    }
    static async kaynakYaz(ctx, kayit, durum, mesaj) {
        const k = kaynakKimlikCoz(String(kayit.KAYNAK_FIS_ID || "").trim());
        if (k)
            await EbelgeKaynakRepository.sonuc(k, durum, mesaj, ctx).catch(() => undefined);
    }
    /** Gönderim kesin sonucu: giden + kaynak + iş kaydı */
    static async sonuclandir(ctx, is, kayit, beklenen, sonuc) {
        const mesaj = sonuc.mesaj || (sonuc.durum === "GONDERILDI" ? "Gönderildi." : "Gönderilemedi.");
        const oldu = await this.gecir(ctx, kayit, beklenen, sonuc.durum, { mesaj, kod: sonuc.kod });
        await EbelgeKuyrukRepository.bitir(is.id, sonuc.durum === "GONDERILDI" ? "TAMAM" : "BASARISIZ", oldu ? mesaj : "Durum başka işlemle değişti.", ctx);
        if (!oldu)
            return;
        await this.kaynakYaz(ctx, kayit, sonuc.durum, mesaj);
        if (sonuc.durum === "GONDERILDI")
            await EbelgeKuyrukRepository.bekleyenleriOne(kayit.uuid, "MAIL", ctx);
    }
    static async gonderIsle(ctx, is) {
        const kayit = await EbelgeSqlRepository.getGiden(is.uuid, ctx);
        if (!kayit)
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", "Giden kaydı bulunamadı.", ctx);
        const durum = String(kayit.gonderimDurumu);
        if (!["KUYRUKTA", "GONDERILIYOR", "BELIRSIZ"].includes(durum)) {
            return EbelgeKuyrukRepository.bitir(is.id, "TAMAM", `Belge zaten ${durum}.`, ctx);
        }
        const a = ADAPTORLER[kayit.belgeTuru];
        if (!a)
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", `Desteklenmeyen tür: ${kayit.belgeTuru}`, ctx);
        const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
        // İlk gönderim
        if (durum === "KUYRUKTA") {
            if (!(await this.gecir(ctx, kayit, "KUYRUKTA", "GONDERILIYOR", { mesaj: "Gönderiliyor." }))) {
                return EbelgeKuyrukRepository.bitir(is.id, "TAMAM", "Durum başka işlemle değişti.", ctx);
            }
            return this.gonderVeSonuclandir(ctx, is, kayit, a, config);
        }
        // Önceki deneme belirsiz kaldı ya da süreç yarıda kesildi: önce ICE'de ara
        const varlik = await a.varMi(config, kayit);
        if (varlik === "VAR") {
            return this.sonuclandir(ctx, is, kayit, durum, { durum: "GONDERILDI", mesaj: "Gönderildi (ICE kaydı doğrulandı)." });
        }
        const sonGonderim = is.sonGonderim ?? new Date(kayit.GONDERIM_TARIHI || kayit.OLUSTURMA_TARIHI || 0);
        const tazeMi = Date.now() - sonGonderim.getTime() < TAZE_DK * 60_000;
        const kayitYasi = Date.now() - new Date(kayit.OLUSTURMA_TARIHI || 0).getTime();
        const suresiDoldu = is.deneme >= MAKS_DENEME || Date.now() - is.olusturma.getTime() > SURE_DK * 60_000;
        // Müstahsilde ETTN sorgusu yok: bilinmiyor = yeniden gönderip cevaba bak
        const yok = varlik === "YOK" || (varlik === "BILINMIYOR" && kayit.belgeTuru === "EMustahsil");
        const gonderilebilir = yok && !tazeMi && !suresiDoldu && a.gonderilebilir(kayit, is.veri) && !(is.veri?.yetim && kayitYasi > YETIM_GUN * 86_400_000);
        if (gonderilebilir) {
            if (!(await this.gecir(ctx, kayit, durum, "GONDERILIYOR", { mesaj: "Yeniden gönderiliyor." }))) {
                return EbelgeKuyrukRepository.bitir(is.id, "TAMAM", "Durum başka işlemle değişti.", ctx);
            }
            return this.gonderVeSonuclandir(ctx, is, kayit, a, config);
        }
        if (suresiDoldu || (varlik === "YOK" && !a.gonderilebilir(kayit, is.veri) && !tazeMi)) {
            const mesaj = varlik === "BILINMIYOR"
                ? "Gönderilemedi: ICE'den sonuç alınamadı. Belgeyi ICE portalinde ETTN ile kontrol ediniz."
                : "Gönderilemedi: belge ICE'ye ulaşmadı. Aynı numara ICE'de kayıtlı kalmış olabilir; yeni numarayla kesiniz.";
            return this.sonuclandir(ctx, is, kayit, durum, { durum: "HATA", mesaj });
        }
        await EbelgeKuyrukRepository.ertele(is.id, tazeMi ? 120 : 180, `ICE kaydı: ${varlik}`, ctx);
    }
    static async gonderVeSonuclandir(ctx, is, kayit, a, config) {
        const deneme = await EbelgeKuyrukRepository.denemeYaz(is.id, ctx);
        let sonuc;
        try {
            sonuc = await a.gonder(config, kayit, is.veri, ctx);
        }
        catch (e) {
            sonuc = { durum: "BELIRSIZ", mesaj: `ICE cevabı alınamadı: ${hataMesaji(e)}` };
        }
        // Tekrar gönderimde ret, ilk denemenin ulaştığını gösterebilir ("zaten var"): ICE'de ara
        if (sonuc.durum === "HATA" && deneme > 1) {
            const varlik = await a.varMi(config, kayit);
            if (varlik === "VAR" || (varlik === "BILINMIYOR" && kayit.belgeTuru === "EMustahsil" && tekrarMi(sonuc.mesaj))) {
                sonuc = { durum: "GONDERILDI", mesaj: "Gönderildi (ICE kaydı doğrulandı)." };
            }
            else if (varlik === "BILINMIYOR" && tekrarMi(sonuc.mesaj)) {
                sonuc = { durum: "BELIRSIZ", mesaj: sonuc.mesaj };
            }
        }
        await EbelgeSqlRepository.writeLog({
            metod: a.metod,
            yon: "GIDEN",
            basarili: sonuc.durum === "GONDERILDI",
            kullanici: is.kullanici,
            ilgiliUuid: kayit.uuid,
            istekOzet: `kuyruk deneme=${deneme} belgeNo=${kayit.belgeNo}`,
            cevapOzet: `durum=${sonuc.durum} ${sonuc.mesaj}`.slice(0, 1000),
        }, ctx).catch(() => undefined);
        if (sonuc.durum === "BELIRSIZ") {
            await this.gecir(ctx, kayit, "GONDERILIYOR", "BELIRSIZ", { mesaj: "Gönderim sonucu kontrol ediliyor.", kod: sonuc.kod });
            await EbelgeKuyrukRepository.ertele(is.id, 120, sonuc.mesaj, ctx);
            return;
        }
        await this.sonuclandir(ctx, is, kayit, "GONDERILIYOR", { durum: sonuc.durum, mesaj: sonuc.mesaj, kod: sonuc.kod });
    }
    /** e-Fatura taslak onayı (DraftApproval) */
    static async onayIsle(ctx, is) {
        const kayit = await EbelgeSqlRepository.getGiden(is.uuid, ctx);
        if (!kayit || kayit.gonderimDurumu !== "ONAYLANIYOR") {
            return EbelgeKuyrukRepository.bitir(is.id, "TAMAM", `Belge durumu: ${kayit?.gonderimDurumu ?? "yok"}`, ctx);
        }
        const suresiDoldu = is.deneme >= MAKS_DENEME || Date.now() - is.olusturma.getTime() > SURE_DK * 60_000;
        if (suresiDoldu) {
            const mesaj = "Taslak onaylanamadı: ICE'den sonuç alınamadı. ICE portalinden kontrol edip tekrar deneyiniz.";
            await this.gecir(ctx, kayit, "ONAYLANIYOR", "TASLAK", { mesaj });
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", mesaj, ctx);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
        const deneme = await EbelgeKuyrukRepository.denemeYaz(is.id, ctx);
        let s;
        try {
            s = await KUYRUK_ICE.onay(config, kayit.belgeNo, "EFatura", "DraftApproval");
        }
        catch (e) {
            await EbelgeKuyrukRepository.ertele(is.id, 120, `ICE cevabı alınamadı: ${hataMesaji(e)}`, ctx);
            return;
        }
        const mesaj = `${s?.response_message ?? ""} ${s?.response_message_detail ?? ""}`.trim();
        await EbelgeSqlRepository.writeLog({
            metod: "send_draft_document_approval",
            yon: "GIDEN",
            basarili: dogru(s?.success),
            kullanici: is.kullanici,
            ilgiliUuid: kayit.uuid,
            istekOzet: `kuyruk deneme=${deneme} processType=DraftApproval belgeNo=${kayit.belgeNo}`,
            cevapOzet: mesaj,
        }, ctx).catch(() => undefined);
        // Tekrar denemede ret "zaten onaylanmış" olabilir
        const onaylandi = dogru(s?.success) || (deneme > 1 && yanlis(s?.success) && tekrarMi(mesaj));
        if (onaylandi)
            return this.sonuclandir(ctx, is, kayit, "ONAYLANIYOR", { durum: "GONDERILDI", mesaj: mesaj || "Taslak onaylandı ve GİB'e gönderildi." });
        if (yanlis(s?.success)) {
            await this.gecir(ctx, kayit, "ONAYLANIYOR", "TASLAK", { mesaj: mesaj || "Taslak onaylanamadı; belge taslak olarak kaldı." });
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", mesaj, ctx);
        }
        await EbelgeKuyrukRepository.ertele(is.id, 120, "Onay cevabı belirsiz.", ctx);
    }
    /** e-Arşiv / e-Döviz / e-Müstahsil iptali */
    static async iptalIsle(ctx, is) {
        const kayit = await EbelgeSqlRepository.getGiden(is.uuid, ctx);
        if (!kayit || kayit.gonderimDurumu !== "IPTAL_EDILIYOR") {
            return EbelgeKuyrukRepository.bitir(is.id, "TAMAM", `Belge durumu: ${kayit?.gonderimDurumu ?? "yok"}`, ctx);
        }
        const tarih = new Date(is.veri?.iptalTarihi || Date.now());
        const suresiDoldu = is.deneme >= MAKS_DENEME || Date.now() - is.olusturma.getTime() > SURE_DK * 60_000;
        if (suresiDoldu) {
            const mesaj = "İptal sonucu alınamadı; ICE portalinden kontrol etmeden tekrar iptal göndermeyiniz.";
            await this.gecir(ctx, kayit, "IPTAL_EDILIYOR", "IPTAL_BELIRSIZ", { mesaj });
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", mesaj, ctx);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
        const deneme = await EbelgeKuyrukRepository.denemeYaz(is.id, ctx);
        const s = await KUYRUK_ICE.iptal(config, kayit, tarih);
        await EbelgeSqlRepository.writeLog({
            metod: kayit.belgeTuru === "EArsiv" ? "send_earsiv_iptal" : kayit.belgeTuru === "EDoviz" ? "send_edoviz_iptal" : "send_emustahsil_iptal",
            yon: "GIDEN",
            basarili: s.durum === "IPTAL",
            kullanici: is.kullanici,
            ilgiliUuid: kayit.uuid,
            istekOzet: `kuyruk deneme=${deneme} belgeNo=${kayit.belgeNo} iptalTarihi=${tarih.toISOString().slice(0, 10)}`,
            cevapOzet: `${s.durum} ${s.mesaj}`.slice(0, 1000),
        }, ctx).catch(() => undefined);
        const iptalOldu = s.durum === "IPTAL" || (deneme > 1 && s.durum === "RED" && /iptal/i.test(s.mesaj) && tekrarMi(s.mesaj));
        if (iptalOldu) {
            await this.gecir(ctx, kayit, "IPTAL_EDILIYOR", "IPTAL", { mesaj: s.mesaj || "İptal edildi.", kullanici: is.kullanici, iptalTarihi: tarih });
            return EbelgeKuyrukRepository.bitir(is.id, "TAMAM", s.mesaj, ctx);
        }
        if (s.durum === "RED") {
            await this.gecir(ctx, kayit, "IPTAL_EDILIYOR", "GONDERILDI", { mesaj: `İptal reddedildi: ${s.mesaj || "ICE iptali kabul etmedi."}` });
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", s.mesaj, ctx);
        }
        await EbelgeKuyrukRepository.ertele(is.id, 120, s.mesaj, ctx);
    }
    /**
     * Belgeyi e-postayla gönderir; belge henüz kesinleşmediyse bekler. Mail çağrısı tekrarlanmaz
     * (her çağrı alıcıya yeni mail demek): belirsiz sonuçta iş kapatılır.
     */
    static async mailIsle(ctx, is) {
        const kayit = await EbelgeSqlRepository.getGiden(is.uuid, ctx);
        const durum = String(kayit?.gonderimDurumu ?? "");
        if (ASKIDAKI_DURUMLAR.includes(durum)) {
            if (Date.now() - is.olusturma.getTime() > (SURE_DK + 10) * 60_000) {
                return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", "Belge kesinleşmedi; e-posta gönderilmedi.", ctx);
            }
            return EbelgeKuyrukRepository.ertele(is.id, 60, "Belgenin kesinleşmesi bekleniyor.", ctx);
        }
        if (durum !== "GONDERILDI") {
            return EbelgeKuyrukRepository.bitir(is.id, "BASARISIZ", `Belge ${durum || "yok"}; e-posta gönderilmedi.`, ctx);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
        const alicilar = Array.isArray(is.veri?.alicilar) ? is.veri.alicilar : [];
        let mesaj;
        let basarili = false;
        try {
            const sonuclar = await KUYRUK_ICE.mail(config, [
                { belgeNo: kayit.belgeNo, uuid: kayit.uuid, belgeTuru: mailBelgeTuru(kayit.belgeTuru), alicilar },
            ]);
            basarili = sonuclar.some((r) => dogru(r.Result));
            mesaj = basarili ? `${sonuclar.filter((r) => dogru(r.Result)).length} alıcıya gönderildi.` : sonuclar[0]?.ResultMessage || "ICE sonuç döndürmedi.";
        }
        catch (e) {
            mesaj = `Sonuç alınamadı: ${hataMesaji(e)}`;
        }
        await EbelgeSqlRepository.writeLog({
            metod: "Send_Document_Email",
            yon: "GIDEN",
            basarili,
            kullanici: is.kullanici,
            ilgiliUuid: kayit.uuid,
            istekOzet: `kuyruk belgeNo=${kayit.belgeNo} alici=${alicilar.length}`,
            cevapOzet: mesaj,
        }, ctx).catch(() => undefined);
        await EbelgeKuyrukRepository.bitir(is.id, basarili ? "TAMAM" : "BASARISIZ", mesaj, ctx);
    }
}
