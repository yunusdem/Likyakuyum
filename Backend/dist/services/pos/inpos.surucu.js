import crypto from "crypto";
import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifreCoz, sifrele } from "../../utils/kripto.utils.js";
/**
 * Inpos M530 sürücüsü — TSM Entegrasyon API'si (bulut, "inPOS.TMS.IntegrationAPI").
 * Kaynak: Inpos portalındaki swagger (docs/POS_ENTEGRASYON_YOL_HARITASI.md §0b). Mağazaya köprü kurulmaz (K34).
 *
 * Akış: sunucu fişi "sipariş" olarak TSM'ye yazar (fiş başına TEK sipariş; nakit / havale / cari kısmı "önceden
 * tahsil edilmiş" gider, kart tutarı cihazda alınır) → sipariş cihazın ekranında listelenir → kasiyer seçer (LOCKED)
 * → kart okutulur, bilgi fişi basılır (CLOSED) → sonuç "Sipariş Durum Güncelleme" webhook'uyla bize gelir; gelmezse
 * sorgula() siparişi TSM'den okur. Dönen ödemeler aynı fişin POS satırlarına tutara göre dağıtılır (pos.service).
 *
 * GERÇEK CİHAZLA DENENMEDİ (08.10.2026): test cihazı kargoda. Swagger'da açık olmayan noktalar "A15" ile işaretli.
 */
const ZAMAN_ASIMI_MS = 20_000;
/** JWT süresi dolmadan bu kadar önce yenilenir */
const ERISIM_PAYI_SN = 120;
const ESLESME_ONBELLEK_MS = 10 * 60 * 1000;
/** Bilgi fişindeki tek kalem (A15: mali müşavir cevabına kadar kısım 1, KDV %0; kuyumda özel matrah). */
const KALEM_KISIM = 1;
const KALEM_KDV = 0;
/** TSM'nin ödeme tipleri (PaymentTypeEnum) */
const ODEME_TIPI = { kart: "CreditCardPayment", nakit: "CashPayment", havale: "MoneyTransfer", cari: "OpenAccount" };
/** Bilgi fişi belge tipleri (OrderDocumentTypeEnum) */
const BELGE_TIPI = { efatura: "EFatura", earsiv: "EArsiv" };
/** Aracı banka kodları (swagger AcquirerInfoResponse + Inpos SDK Acquirer listesi) */
export const INPOS_BANKALARI = {
    1: "Merkez Bankası",
    10: "Ziraat Bankası",
    12: "Halkbank",
    15: "Vakıfbank",
    32: "TEB",
    46: "Akbank",
    59: "Şekerbank",
    62: "Garanti BBVA",
    64: "İş Bankası",
    67: "Yapı Kredi",
    111: "QNB Finansbank",
    134: "Denizbank",
    135: "Anadolubank",
    203: "Albaraka Türk",
    205: "Kuveyt Türk",
};
const kok = (url) => url.trim().replace(/\/+$/, "");
const para = (n) => Math.round(n * 100) / 100;
const ayarOku = async () => {
    const a = await PosAdminSqlRepository.ayarGetir();
    const sifre = sifreCoz(a?.inposSifreSifreli);
    if (!a?.inposApiUrl || !a.inposKullanici || !sifre) {
        throw ApiError.badRequest("Inpos TSM bilgileri tanımlı değil. Yönetim panelinde POS Entegrasyonu > Ayarlar bölümünden servis adresi, kullanıcı adı ve şifre girilmelidir.");
    }
    return { apiUrl: kok(a.inposApiUrl), kullanici: a.inposKullanici, sifre };
};
const http = async (ozet, url, metod, basliklar, govde) => {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
    try {
        const yanit = await fetch(url, {
            method: metod,
            headers: { Accept: "application/json", ...(govde !== undefined ? { "Content-Type": "application/json" } : {}), ...basliklar },
            body: govde !== undefined ? JSON.stringify(govde) : undefined,
            signal: kontrol.signal,
        });
        const metin = await yanit.text();
        let veri = null;
        try {
            veri = metin ? JSON.parse(metin) : null;
        }
        catch {
            veri = { detail: metin.slice(0, 300) };
        }
        // Günlüğe kimlik bilgisi yazılmaz (giriş isteğinin gövdesi de yazılmaz)
        const gunlukIstek = govde !== undefined && !/login/i.test(url) ? govde : null;
        const gunlukYanit = /login/i.test(url) ? { durum: yanit.status } : veri;
        await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ozet: `${ozet} → ${yanit.status}`, istek: gunlukIstek, yanit: gunlukYanit, basarili: yanit.status < 400 });
        return { durum: yanit.status, veri };
    }
    catch (err) {
        const mesaj = err?.name === "AbortError" ? "Inpos servisi yanıt vermedi (zaman aşımı)." : `Inpos servisine ulaşılamadı: ${err?.message || err}`;
        await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ozet: `${ozet} → ulaşılamadı`, yanit: mesaj, basarili: false });
        throw new ApiError(HttpStatus.BAD_GATEWAY, mesaj);
    }
    finally {
        clearTimeout(zamanlayici);
    }
};
/** TSM hata gövdesi (ProblemDetails): title / detail */
const inposHatasi = (durum, veri, varsayilan) => {
    const ayrinti = [veri?.title, veri?.detail].filter((x) => typeof x === "string" && x.trim()).join(": ");
    return new ApiError(durum === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY, ayrinti ? `${varsayilan} ${ayrinti}` : `${varsayilan} (${durum})`);
};
/** Portal kullanıcı adı + şifre ile JWT alır ve merkezde şifreli saklar. */
const girisYap = async (a) => {
    const { durum, veri } = await http("Inpos giriş", `${a.apiUrl}/api/login`, "POST", {}, { email: a.kullanici, password: a.sifre });
    const erisim = veri?.accessToken || veri?.token;
    if (durum >= 400 || !erisim) {
        throw new ApiError(HttpStatus.BAD_GATEWAY, `Inpos servisi kimliği kabul etmedi (${durum}). Yönetim panelindeki kullanıcı adı / şifre kontrol edilmelidir.`);
    }
    const omur = Math.max(Number(veri.expiresIn) || 3600, 300) - ERISIM_PAYI_SN;
    await PosAdminSqlRepository.inposErisimYaz(sifrele(String(erisim)), Math.max(omur, 120));
    return String(erisim);
};
const erisimAnahtari = async (a) => sifreCoz(await PosAdminSqlRepository.inposErisimGetir()) || (await girisYap(a));
const sorguYaz = (sorgu) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sorgu || {}))
        if (v !== undefined && v !== null && v !== "")
            p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
};
/** Erişim anahtarı TSM tarafında düşmüşse bir kez yenileyip yeniden dener. */
const istek = async (ozet, metod, yol, govde, sorgu) => {
    const a = await ayarOku();
    const url = `${a.apiUrl}${yol}${sorguYaz(sorgu)}`;
    let { durum, veri } = await http(ozet, url, metod, { Authorization: `Bearer ${await erisimAnahtari(a)}` }, govde);
    if (durum === 401) {
        await PosAdminSqlRepository.inposErisimYaz(null, 0);
        ({ durum, veri } = await http(ozet, url, metod, { Authorization: `Bearer ${await girisYap(a)}` }, govde));
    }
    return { durum, veri };
};
// ─── Eşleşmeler (şube ↔ cihazlar) ───────────────────────────────────────────
let eslesmeOnbellegi = null;
const eslesmeleriGetir = async (yenile) => {
    if (!yenile && eslesmeOnbellegi && Date.now() - eslesmeOnbellegi.zaman < ESLESME_ONBELLEK_MS)
        return eslesmeOnbellegi.liste;
    const { durum, veri } = await istek("Inpos eşleşmeler", "GET", "/api/getMatches");
    if (durum >= 400 || !Array.isArray(veri))
        throw inposHatasi(durum, veri, "Inpos eşleşme listesi alınamadı.");
    const liste = veri.map((m) => ({
        id: String(m?.id || ""),
        taxPayerNo: m?.taxPayerNo ? String(m.taxPayerNo) : null,
        taxPayerTitle: m?.taxPayerTitle ? String(m.taxPayerTitle) : null,
        name: m?.name ? String(m.name) : null,
        csn: (Array.isArray(m?.csn) ? m.csn : []).map((c) => String(c).trim().toUpperCase()),
    }));
    eslesmeOnbellegi = { zaman: Date.now(), liste };
    return liste;
};
/** Cihaz sicil numarası (CSN): cihaz tanımındaki terminal kimliği, yoksa sicil no. */
export const inposCsn = (t) => {
    const csn = (t.terminalKimlik || t.sicilNo || "").trim().toUpperCase();
    if (!csn)
        throw ApiError.badRequest(`"${t.ad}" cihazının sicil numarası (CSN) tanımlı değil. Banka › POS Cihazları'nda Terminal Kimliği alanına cihazın sicil numarasını yazın.`);
    return csn;
};
/** Cihazın lisanslı olduğu eşleşme (şube). Önbellekte yoksa liste bir kez yenilenir. */
const eslesmeBul = async (csn) => {
    let liste = await eslesmeleriGetir(false);
    let e = liste.find((m) => m.csn.includes(csn));
    if (!e) {
        liste = await eslesmeleriGetir(true);
        e = liste.find((m) => m.csn.includes(csn));
    }
    if (!e)
        throw ApiError.badRequest(`Cihaz ${csn} Inpos'ta bu hesaba lisanslı görünmüyor. Inpos portalı › Lisanslar bölümünü ve cihaz tanımındaki sicil numarasını kontrol edin.`);
    return e;
};
// ─── Sipariş ────────────────────────────────────────────────────────────────
const pesinTipi = (tur) => ODEME_TIPI[tur];
/** Bilgi fişi kalemleri: fiş satırları toplamı sipariş toplamını tutuyorsa satırlar, değilse tek satır. Tutar KDV dahil. */
export const inposKalemleri = (kalemler, toplam) => {
    const tek = [{ name: "Fatura toplamı", unitPrice: toplam, vat: KALEM_KDV, quantity: 1, unit: "adet", section: KALEM_KISIM }];
    if (!kalemler?.length)
        return tek;
    const kalemToplam = para(kalemler.reduce((t, k) => t + k.tutar, 0));
    if (Math.abs(kalemToplam - toplam) > 0.011)
        return tek;
    // Kısım gönderilmez: M530'da her kısmın sabit KDV oranı var; kısım verilince oran tutmazsa cihaz "geçersiz KDV oranı" der.
    // Cihaz, orana uyan kısmı kendisi seçer (cihazda o oranda bir kısım tanımlı olmalı). Oran fişteki gibi gider (test cihazında %18 var).
    return kalemler.map((k) => ({
        name: k.ad.slice(0, 100),
        unitPrice: para(k.tutar / k.miktar),
        vat: Math.min(100, Math.max(0, Math.round(k.kdvOrani))),
        quantity: k.miktar,
        unit: "adet",
    }));
};
/** Fiş başına tek sipariş. Tutarlar TL (iki ondalık). */
export const inposSiparisi = (i, matchId, csn) => {
    const islemler = i.grup?.islemler.length ? i.grup.islemler : [i.islem];
    const pesinler = (i.grup?.pesinOdemeler || []).filter((p) => p.tutar > 0);
    const kart = para(islemler.reduce((t, x) => t + x.tutar, 0));
    const toplam = para(kart + pesinler.reduce((t, p) => t + p.tutar, 0));
    const belge = i.islem.belgeTipi === "efatura" ? "e-Fatura" : "e-Arşiv Fatura";
    const ad = `${belge}${i.islem.belgeNo ? ` ${i.islem.belgeNo}` : ""}`;
    return {
        matchId,
        csn: [csn],
        name: ad.slice(0, 100),
        no: i.islem.posIslemId,
        // Fatura bizim sistemden çıkar; cihaz yalnızca bilgi fişi basar (K3). Fişin kalemleri verilmiş ve toplamı tutuyorsa
        // kalemler basılır; yoksa tek satır "Fatura toplamı" (A15).
        items: inposKalemleri(i.grup?.kalemler, toplam),
        totalAmount: toplam,
        subtotalAmount: toplam,
        document: {
            type: BELGE_TIPI[i.islem.belgeTipi],
            ...(i.aliciVkn ? { taxNo: i.aliciVkn } : {}),
            ...(i.islem.belgeNo ? { no: i.islem.belgeNo } : {}),
            date: new Date().toISOString(),
            deliveryNote: false,
        },
        // Fişte nakit / havale / cari kısmı varsa cihazda "ödenmiş" sayılır; cihaz yalnız kart tutarını çeker
        ...(pesinler.length ? { payments: pesinler.map((p) => ({ type: pesinTipi(p.tur), amount: para(p.tutar) })) } : {}),
        ...(i.aliciAd ? { note: i.aliciAd.slice(0, 200) } : {}),
    };
};
const bankaCoz = (acq) => {
    if (acq === null || acq === undefined || acq === "")
        return { kod: null, ad: null };
    if (typeof acq === "object") {
        const id = Number(acq.id);
        const kod = Number.isFinite(id) && id > 0 ? String(id) : acq.name ? String(acq.name) : null;
        return { kod, ad: acq.name ? String(acq.name) : kod && INPOS_BANKALARI[id] ? INPOS_BANKALARI[id] : kod };
    }
    const id = Number(acq);
    if (Number.isFinite(id) && id > 0)
        return { kod: String(id), ad: INPOS_BANKALARI[id] || `Banka ${id}` };
    return { kod: String(acq), ad: String(acq) };
};
/**
 * TSM siparişini (getOrderById cevabı ya da webhook gövdesi) işlem sonucuna çevirir.
 * OPEN / LOCKED → null (hâlâ bekleniyor). CLOSED → onay + cihazda alınan kart ödemeleri. ERROR → ret.
 */
export const inposSonucuCoz = (siparis) => {
    const durum = String(siparis?.status || "").toUpperCase();
    if (durum === "OPEN" || durum === "LOCKED" || !durum)
        return null;
    if (durum === "ERROR")
        return { durum: "RET", hata: "Cihaz siparişi hata durumuna aldı.", ham: siparis, grupOdemeleri: [] };
    if (durum !== "CLOSED")
        return { durum: "RET", hata: `Cihazdan beklenmeyen sipariş durumu: ${durum}.`, ham: siparis, grupOdemeleri: [] };
    const odemeler = Array.isArray(siparis.payments) ? siparis.payments : [];
    const kartlar = odemeler
        .filter((o) => String(o?.type || "") === ODEME_TIPI.kart && Number(o?.amount) > 0)
        .map((o) => {
        const b = bankaCoz(o?.details?.acquirer);
        return { tutar: para(Number(o.amount)), bankaKodu: b.kod, bankaAdi: b.ad };
    });
    const yaz = (v) => (v === undefined || v === null || v === "" ? null : String(v));
    return {
        durum: "ONAY",
        bankaKodu: kartlar[0]?.bankaKodu ?? null,
        bankaAdi: kartlar[0]?.bankaAdi ?? null,
        // Onay kodu, maskeli kart no ve taksit TSM şemasında yok (A13 kapandı)
        cihazFisNo: yaz(siparis?.receipt?.no),
        zNo: yaz(siparis?.receipt?.zNo),
        ham: siparis,
        grupOdemeleri: kartlar,
    };
};
/** Kapanan sipariş cihaz listesinden düşsün (TSM, sipariş kimliğiyle birlikte cihaz CSN'sini de ister). Başarısızlık sonucu etkilemez. */
export const inposSiparisIslendi = async (ref, csn) => {
    if (!csn)
        return;
    try {
        await istek(`Inpos sipariş işlendi ${ref}`, "POST", "/api/markOrderProcessed", { id: ref, csn });
    }
    catch {
        // Günlüğe yazıldı; sipariş listede kalır, kasiyer görmezden gelir
    }
};
export const InposSurucu = {
    async gonder(i) {
        const csn = inposCsn(i.terminal);
        const eslesme = await eslesmeBul(csn);
        const { durum, veri } = await istek(`Inpos sipariş ${i.islem.posIslemId}`, "POST", "/api/addOrder", inposSiparisi(i, eslesme.id, csn));
        const ref = veri?.id ? String(veri.id) : null;
        if (durum >= 400 || !ref)
            throw inposHatasi(durum, veri, "Sipariş cihaza gönderilemedi.");
        return { ref };
    },
    async sorgula(islem, terminal) {
        if (!islem.surucuRef)
            return null;
        const { durum, veri } = await istek(`Inpos sipariş sorgu ${islem.posIslemId}`, "GET", "/api/getOrderById", undefined, { id: islem.surucuRef, csn: inposCsn(terminal) });
        if (durum === 404)
            return { durum: "IPTAL", hata: "Sipariş cihaz servisinde bulunamadı (silinmiş).", grupOdemeleri: [] };
        if (durum >= 400)
            throw inposHatasi(durum, veri, "Sipariş sorgulanamadı.");
        const sonuc = inposSonucuCoz(veri);
        if (sonuc?.durum === "ONAY")
            void inposSiparisIslendi(islem.surucuRef, inposCsn(terminal));
        return sonuc;
    },
    async iptal(islem) {
        if (!islem.surucuRef)
            return;
        const { durum, veri } = await istek(`Inpos sipariş sil ${islem.posIslemId}`, "POST", "/api/deleteOrder", { id: islem.surucuRef });
        // 404: sipariş zaten yok. 400: cihazda seçilmiş / ödeniyor (LOCKED) → silinemez
        if (durum === 404)
            return;
        if (durum >= 400)
            throw inposHatasi(durum, veri, "Sipariş cihazda işlemde olduğu için silinemedi.");
    },
    async baglantiTesti(terminal) {
        const csn = inposCsn(terminal);
        const e = await eslesmeBul(csn);
        const sube = [e.taxPayerTitle, e.name].filter(Boolean).join(" / ");
        return `Cihaz ${csn} Inpos'ta lisanslı${sube ? ` (${sube})` : ""}. Sipariş gönderilmeye hazır; cihaz internete bağlı olmalı.`;
    },
    async gunSonu() {
        // TSM entegrasyon API'sinde Z raporu çağrısı yok; Z cihazdan alınır (K22)
        throw new ApiError(HttpStatus.NOT_IMPLEMENTED, "Bu cihazda gün sonu programdan alınamıyor. Z raporunu cihazdan alın.");
    },
};
/** Yönetim panelindeki test konsolu için: kimliği ve lisanslı cihazları sınar. */
export const inposKimlikTesti = async () => {
    await PosAdminSqlRepository.inposErisimYaz(null, 0);
    await girisYap(await ayarOku());
    const liste = await eslesmeleriGetir(true);
    const cihazlar = liste.flatMap((e) => e.csn);
    return `Inpos kimliği kabul edildi. Lisanslı cihaz: ${cihazlar.length ? cihazlar.join(", ") : "yok"}${liste.length ? ` · şube: ${liste.map((e) => [e.taxPayerTitle, e.name].filter(Boolean).join(" / ")).join("; ")}` : ""}.`;
};
/**
 * Inpos'un sonuç bildirimi (webhook) Basic Auth ile gelir; kullanıcı adı / şifre yönetim panelinde tanımlıdır.
 * Tanımlı değilse hiçbir bildirim kabul edilmez.
 */
export const inposWebhookYetkili = async (authorization) => {
    const a = await PosAdminSqlRepository.ayarGetir().catch(() => null);
    const sifre = sifreCoz(a?.inposWebhookSifreSifreli);
    if (!a?.inposWebhookKullanici || !sifre)
        return false;
    const m = /^Basic\s+(.+)$/i.exec(String(authorization || "").trim());
    if (!m)
        return false;
    const beklenen = Buffer.from(`${a.inposWebhookKullanici}:${sifre}`, "utf8");
    const gelen = Buffer.from(m[1], "base64");
    return beklenen.length === gelen.length && crypto.timingSafeEqual(beklenen, gelen);
};
/** Portala yazılacak bildirim adresi (yönetim paneli gösterir). */
export const inposWebhookAdresi = (donusKok) => {
    const k = kok(donusKok || "");
    return k ? `${k}${env.API_PREFIX}/pos-donus/inpos` : null;
};
