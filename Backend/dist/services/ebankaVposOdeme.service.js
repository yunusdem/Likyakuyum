import crypto from "crypto";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { EBankaAktarimSqlRepository } from "../models/ebankaAktarimSql.repository.js";
import { EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { EBankaVposSqlRepository } from "../models/ebankaVposSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { EBankaVposService } from "./ebankaVpos.service.js";
import { VomsisClient } from "./vomsis/vomsis.client.js";
// F- e-Banka Faz 5 — kartla ödeme, 3D Secure (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E1, E10, E18, E20, E24)
//
// KART VERİSİ: kart numarası, son kullanma tarihi ve CVC yalnızca bu isteğin belleğinde bulunur ve Vomsis'e iletilir.
// Veritabanına, günlüğe ya da hata mesajına YAZILMAZ; saklanan tek şey maskeli numaradır (ilk 6 + son 4 hane).
//
// AKIŞ: ödeme başlat → kayıt açılır (tur 'bekliyor') → Vomsis 3D yönlendirmesini döner → ekran bunu yeni pencerede açar →
//       banka müşteriyi dönüş ucuna yollar (o uç yalnızca "pencereyi kapatın" sayfası gösterir, hiçbir şeye güvenmez) →
//       ekran sonucu sorar → sonuç Vomsis transaction/find ile DOĞRULANIR → başarılıysa tahsilat fişi kesilir.
const PARA_BIRIMLERI = ["TRY", "USD", "EUR"];
export const DONUS_YOLU = "/ebanka-donus";
const kirp = (v) => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim());
const rakamlar = (v) => kirp(v).replace(/\D/g, "");
export const luhnGecerliMi = (kartNo) => {
    if (!/^\d{13,19}$/.test(kartNo))
        return false;
    let toplam = 0;
    for (let i = 0; i < kartNo.length; i++) {
        let n = Number(kartNo[kartNo.length - 1 - i]);
        if (i % 2 === 1) {
            n *= 2;
            if (n > 9)
                n -= 9;
        }
        toplam += n;
    }
    return toplam % 10 === 0;
};
/** Vomsis bir hata mesajında kart numarasını geri yansıtırsa kayda/günlüğe düşmesin. */
export const kartsizMesaj = (mesaj) => kirp(mesaj).replace(/\d[\d -]{11,22}\d/g, (m) => (m.replace(/\D/g, "").length >= 13 ? "[kart no gizlendi]" : m));
export const kartMaskele = (kartNo) => `${kartNo.slice(0, 6)}${"*".repeat(Math.max(kartNo.length - 10, 0))}${kartNo.slice(-4)}`;
/** Vomsis transaction/find yanıtı başarılı bir çekim mi? */
export const odemeBasariliMi = (d) => {
    if (!d)
        return false;
    const durum = kirp(d.status).toLocaleLowerCase("tr");
    if (durum.includes("başarısız") || durum.includes("basarisiz") || durum.includes("fail") || durum.includes("hata"))
        return false;
    const kod = kirp(d.errorCode);
    return (durum.includes("başarılı") || durum.includes("basarili") || durum.includes("success") || durum === "approved") && (kod === "" || kod === "00");
};
/** Banka 3D dönüşünü bu adrese yapar. Ekranın bildirdiği API adresinden türetilir; yalnızca kendi dönüş yolumuz kabul edilir. */
const donusAdresi = (apiAdresi, canli) => {
    let url;
    try {
        url = new URL(kirp(apiAdresi));
    }
    catch {
        throw ApiError.badRequest("Dönüş adresi belirlenemedi (API adresi geçersiz).");
    }
    if (!["http:", "https:"].includes(url.protocol))
        throw ApiError.badRequest("Dönüş adresi geçersiz.");
    if (canli && url.protocol !== "https:")
        throw ApiError.badRequest("Canlı modda kartla ödeme yalnızca HTTPS üzerinden yapılabilir.");
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${DONUS_YOLU}`;
    url.search = "";
    url.hash = "";
    return url.toString();
};
export class EBankaVposOdemeService {
    static async taksitTablosu(dbContext) {
        const yanit = await VomsisClient.istek("vpos", "/installments", { metod: "POST", govde: {} }, dbContext);
        return Array.isArray(yanit?.pos_banks) ? yanit.pos_banks : [];
    }
    /** Kart numarasının ilk 6 hanesiyle kart bilgisi ve o karta özel taksitler. */
    static async binSorgula(bin, dbContext) {
        const b = rakamlar(bin).slice(0, 6);
        if (b.length !== 6)
            throw ApiError.badRequest("BIN için kart numarasının ilk 6 hanesi gerekir.");
        const yanit = await VomsisClient.istek("vpos", "/bin-check", { metod: "POST", govde: { cc_number: Number(b) } }, dbContext);
        if (yanit?.success === false)
            throw new ApiError(HttpStatus.BAD_GATEWAY, `Kart bilgisi alınamadı: ${yanit.message || "bilinmeyen hata"}`);
        const d = yanit?.data || yanit || {};
        return { kart: d.card_info || null, taksitler: Array.isArray(d.installments) ? d.installments : [] };
    }
    static async odemeBaslat(girdi, istemciIp, kullaniciId, dbContext) {
        const { mod } = await EBankaVposService.ayar(dbContext);
        const cariKartId = Number(girdi.cariKartId);
        if (!(cariKartId > 0))
            throw ApiError.badRequest("Cari seçilmelidir.");
        const cari = await EBankaAktarimSqlRepository.cariIletisim(cariKartId, dbContext);
        if (!cari)
            throw ApiError.badRequest("Seçilen cari bulunamadı.");
        const tutar = Math.round(Number(String(girdi.tutar ?? "").replace(",", ".")) * 100) / 100;
        if (!(tutar > 0))
            throw ApiError.badRequest("Tutar sıfırdan büyük olmalıdır.");
        const paraBirimi = kirp(girdi.paraBirimi).toUpperCase() || "TRY";
        if (!PARA_BIRIMLERI.includes(paraBirimi))
            throw ApiError.badRequest("Para birimi TRY, USD ya da EUR olabilir.");
        const taksit = Math.min(Math.max(Math.trunc(Number(girdi.taksit) || 1), 1), 12);
        const taksitOrani = Number(girdi.taksitOrani) >= 0 ? Number(girdi.taksitOrani) : 0;
        const k = girdi.kart || {};
        const kartNo = rakamlar(k.no);
        const adSoyad = kirp(k.adSoyad);
        const ay = rakamlar(k.ay).padStart(2, "0");
        const yil = rakamlar(k.yil).length === 2 ? `20${rakamlar(k.yil)}` : rakamlar(k.yil);
        const cvc = rakamlar(k.cvc);
        if (!adSoyad)
            throw ApiError.badRequest("Kart üzerindeki ad soyad zorunludur.");
        // Test modunda uydurma numarayla denenebilsin (Vomsis dokümanındaki örnek kart da Luhn'dan geçmiyor)
        if (!/^\d{13,19}$/.test(kartNo) || (mod === "canli" && !luhnGecerliMi(kartNo)))
            throw ApiError.badRequest("Kart numarası geçersiz.");
        if (!/^(0[1-9]|1[0-2])$/.test(ay) || !/^20\d{2}$/.test(yil))
            throw ApiError.badRequest("Son kullanma tarihi geçersiz.");
        const simdi = new Date();
        if (Number(yil) < simdi.getFullYear() || (Number(yil) === simdi.getFullYear() && Number(ay) < simdi.getMonth() + 1))
            throw ApiError.badRequest("Kartın son kullanma tarihi geçmiş.");
        if (!/^\d{3,4}$/.test(cvc))
            throw ApiError.badRequest("Güvenlik kodu (CVC) geçersiz.");
        const returnUrl = donusAdresi(girdi.apiAdresi, mod === "canli");
        const aciklama = kirp(girdi.aciklama).slice(0, 250) || `${cari.ad} tahsilat`.slice(0, 250);
        const referansNo = `LK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
        // Kayıt Vomsis'e gitmeden önce açılır: 3D dönüşünde işlemin carisi buradan bilinir
        await EBankaVposSqlRepository.odemeBaslat({ referansNo, cariKartId, tutar, paraBirimi, taksit, maskeliKart: kartMaskele(kartNo), aciklama, musteri: cari.ad }, dbContext);
        let yanit;
        try {
            yanit = await VomsisClient.istek("vpos", "/payment", {
                metod: "POST",
                govde: {
                    referanceNo: referansNo,
                    creditCardHolderName: adSoyad,
                    creditCardPan: kartNo,
                    creditCardExpiryMonth: ay,
                    creditCardExpiryYear: yil,
                    creditCardCvc: cvc,
                    installment: taksit,
                    ...(taksit > 1 || taksitOrani > 0 ? { installment_ratio: taksitOrani } : {}),
                    amount: tutar,
                    currency: paraBirimi,
                    invoiceType: cari.vergiNo && cari.vergiNo.length === 10 ? "commercial" : "individual",
                    returnUrl,
                    clientIp: istemciIp,
                    lang: "tr",
                    paymentNote: aciklama,
                    user: {
                        ...(cari.vergiNo && cari.vergiNo.length === 10 ? { title: cari.ad } : {}),
                        name: cari.ad,
                        ...(cari.eposta ? { email: cari.eposta } : {}),
                        ...(cari.telefon ? { phone: cari.telefon.replace(/[^\d+]/g, "") } : {}),
                        ...(cari.vergiNo ? { tax_no: cari.vergiNo } : {}),
                        ...(cari.adres ? { address: cari.adres } : {}),
                    },
                    securePayment: true,
                },
            }, dbContext);
        }
        catch (err) {
            const mesaj = kartsizMesaj(err?.message) || "Banka servisine ulaşılamadı";
            await EBankaVposSqlRepository.odemeSonucuYaz(referansNo, { basarili: false, hataKodu: null, hataMesaji: mesaj, kartBanka: null, posAdi: null }, dbContext);
            await EBankaSqlRepository.logYaz({ islem: "vpos-odeme", mod, basarili: false, mesaj: `${referansNo} ${cari.ad}: ${mesaj}`, kullaniciId }, dbContext);
            throw new ApiError(err?.statusCode || HttpStatus.BAD_GATEWAY, mesaj);
        }
        // 3D yönlendirmesi bankaya göre iki biçimde gelir: hazır HTML ya da gateway + POST edilecek alanlar
        const d = yanit?.data && typeof yanit.data === "object" ? yanit.data : yanit || {};
        const htmlContent = typeof d.htmlContent === "string" && d.htmlContent.trim() ? d.htmlContent : null;
        const gateway = kirp(d.gateway) || null;
        let alanlar = [];
        if (Array.isArray(d.inputs))
            alanlar = d.inputs.map((x) => ({ ad: kirp(x?.name ?? x?.key), deger: kirp(x?.value) })).filter((x) => x.ad);
        else if (d.inputs && typeof d.inputs === "object")
            alanlar = Object.entries(d.inputs).map(([ad, deger]) => ({ ad, deger: kirp(deger) }));
        if (!htmlContent && !gateway) {
            const mesaj = kartsizMesaj(kirp(d.message) || kirp(d.error_message) || kirp(d.errorMessage)) || "3D Secure yönlendirmesi alınamadı.";
            await EBankaVposSqlRepository.odemeSonucuYaz(referansNo, { basarili: false, hataKodu: kirp(d.error_code) || null, hataMesaji: mesaj, kartBanka: null, posAdi: null }, dbContext);
            await EBankaSqlRepository.logYaz({ islem: "vpos-odeme", mod, basarili: false, mesaj: `${referansNo} ${cari.ad}: ${mesaj}`, kullaniciId }, dbContext);
            throw new ApiError(HttpStatus.BAD_GATEWAY, `Ödeme başlatılamadı: ${mesaj}`);
        }
        if (gateway && !/^https:\/\//i.test(gateway) && mod === "canli")
            throw new ApiError(HttpStatus.BAD_GATEWAY, "Servis güvenli olmayan bir banka adresi döndürdü; ödeme durduruldu.");
        await EBankaSqlRepository.logYaz({ islem: "vpos-odeme", mod, basarili: true, mesaj: `${referansNo} ${cari.ad}: ${tutar.toFixed(2)} ${paraBirimi} 3D doğrulamaya gönderildi`, kullaniciId }, dbContext);
        return { referansNo, htmlContent, gateway, alanlar };
    }
    /**
     * 3D sonrası sonuç. Dönüş ucuna gelen hiçbir veriye güvenilmez: sonuç Vomsis'e sorulur.
     * Başarılıysa tahsilat fişi kesilir (tek sefer; kilitle korunur). Ekran bu ucu sonuç netleşene kadar yineleyerek çağırır.
     */
    static async sonuc(referansNo, kullaniciId, dbContext) {
        const islem = await EBankaVposSqlRepository.islemGetir(referansNo, dbContext);
        if (!islem)
            throw ApiError.notFound("İşlem bulunamadı.");
        // Link ödemesinin tahsilat fişi linke kesilir (Ödeme Linkleri > Durumları Güncelle); burada ikinci bir fiş kesilmesin
        if (islem.linkUid)
            throw ApiError.badRequest("Bu işlem bir ödeme linkinden geldi; tahsilat fişi Ödeme Linkleri ekranından kesilir.");
        if (!islem.cariKartId)
            throw ApiError.badRequest("Bu işlem bu programdan başlatılmamış; cariye bağlı değil.");
        if (islem.tur === "bekliyor" || islem.durumKodu === null) {
            const yanit = await VomsisClient.istek("vpos", "/transaction/find", { sorgu: { referanceNo: referansNo } }, dbContext).catch(() => null);
            const d = yanit?.success === false ? null : yanit?.data ?? null;
            // Müşteri 3D ekranını henüz tamamlamadıysa Vomsis işlemi bulamaz ya da sonuçsuz döner
            if (!d || (!kirp(d.status) && !kirp(d.errorCode)))
                return { durum: "bekliyor", mesaj: "3D Secure doğrulaması bekleniyor.", islem };
            const basarili = odemeBasariliMi(d);
            const sonucsuz = !basarili && !kirp(d.errorMessage) && (kirp(d.errorCode) === "" || kirp(d.errorCode) === "00") && !/başarısız|basarisiz|fail|hata/i.test(kirp(d.status));
            if (sonucsuz)
                return { durum: "bekliyor", mesaj: `Servis durumu: ${kirp(d.status) || "bekliyor"}`, islem };
            await EBankaVposSqlRepository.odemeSonucuYaz(referansNo, { basarili, hataKodu: kirp(d.errorCode) || null, hataMesaji: kirp(d.errorMessage) || (basarili ? null : kirp(d.status) || null), kartBanka: kirp(d.creditCardBank) || null, posAdi: kirp(d.posName) || null }, dbContext);
            if (!basarili) {
                return { durum: "basarisiz", mesaj: kirp(d.errorMessage) || kirp(d.status) || "Ödeme başarısız.", islem: await EBankaVposSqlRepository.islemGetir(referansNo, dbContext) };
            }
        }
        else if (islem.durumKodu !== 1) {
            return { durum: "basarisiz", mesaj: islem.hataMesaji || "Ödeme başarısız.", islem };
        }
        // Başarılı: tahsilat fişi (E18, E20 — asıl tutar)
        let muhasebe = "";
        const guncel = (await EBankaVposSqlRepository.islemGetir(referansNo, dbContext)) || islem;
        if (guncel.bankaHareketId && guncel.bankaHareketId > 0) {
            muhasebe = `Tahsilat fişi #${guncel.bankaHareketId}`;
        }
        else {
            const d = new Date();
            const gun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const on = await EBankaVposService.fisOnKosullari(guncel.paraBirimi, gun, true, dbContext);
            if ("neden" in on) {
                muhasebe = `Tahsilat fişi kesilmedi: ${on.neden}`;
            }
            else if (await EBankaVposSqlRepository.islemFisTalebi(referansNo, dbContext)) {
                try {
                    const fisId = await EBankaVposService.fisYaz({ islemTipi: 0, bankaId: on.bankaId, cariKartId: guncel.cariKartId, paraId: on.paraId, kur: on.kur, tutar: guncel.tutar, gun, belgeNo: referansNo, aciklama: `Sanal POS kartla ödeme: ${guncel.aciklama || referansNo}` }, kullaniciId, dbContext);
                    await EBankaVposSqlRepository.islemFisiYaz(referansNo, fisId, dbContext);
                    muhasebe = `Tahsilat fişi #${fisId} kesildi.`;
                }
                catch (err) {
                    await EBankaVposSqlRepository.islemFisiYaz(referansNo, null, dbContext).catch(() => undefined);
                    muhasebe = `Tahsilat fişi kesilemedi (${err?.message || "hata"}); elle girin.`;
                }
            }
            else {
                muhasebe = "Tahsilat fişi kesiliyor.";
            }
            await EBankaSqlRepository.logYaz({ islem: "vpos-odeme", mod: (await EBankaVposService.ayar(dbContext)).mod, basarili: true, mesaj: `${referansNo}: ödeme başarılı. ${muhasebe}`, kullaniciId }, dbContext);
        }
        return { durum: "basarili", mesaj: muhasebe, islem: await EBankaVposSqlRepository.islemGetir(referansNo, dbContext) };
    }
}
/** Bankanın müşteriyi geri yolladığı sayfa. Betik içermez (helmet CSP), gelen veriyi okumaz; sonuç ekrandan Vomsis'e sorularak öğrenilir. */
export const DONUS_SAYFASI = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ödeme</title></head>` +
    `<body style="font-family:Segoe UI,Arial,sans-serif;max-width:460px;margin:80px auto;padding:0 16px;text-align:center;color:#1f2937">` +
    `<h3 style="margin-bottom:8px">Doğrulama tamamlandı</h3>` +
    `<p>Bu pencereyi kapatıp programa dönebilirsiniz. Ödemenin sonucu program ekranında görünecektir.</p></body></html>`;
