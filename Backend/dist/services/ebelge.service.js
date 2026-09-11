import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { isEncryptionConfigured } from "../utils/crypto.utils.js";
import { EbelgeSqlRepository, } from "../models/ebelgeSql.repository.js";
import { getInvoiceCount, getInvoiceHtml, getInvoicePdf, getInvoiceStatusDetail, getInvoices, getSonBelgeId, getUserListEFatura, gonderimSatirlari, invoiceCheckValidate, invoiceRedKabul, parseAmount, parseCurrency, parseIceDate, sendDraftDocumentApproval, sendInvoice, sendInvoiceTaslak, setInvoiceStatus, } from "./ice/ice.efatura.js";
import { getGiderPusulasiCikti, sendGiderPusulasi, } from "./ice/ice.giderpusulasi.js";
import { despatchAdviceCheckValidate, getDespatchAdviceCikti, getDespatchAdviceStatus, getDespatchAdvices, getUserListDespatchAdvice, irsaliyeGonderimSatirlari, sendDespatchAdvice, } from "./ice/ice.irsaliye.js";
import { buildDespatchAdviceXml, } from "./ice/ubl/despatchAdviceBuilder.js";
import { buildGiderPusulasiXml, } from "./ice/ubl/giderPusulasiBuilder.js";
import { buildMustahsilXml } from "./ice/ubl/mustahsilBuilder.js";
import { cancelMustahsil, getProducerReceipts, sendMustahsil, setProducerReceiptStatus, validateMustahsil } from "./ice/ice.mustahsil.js";
import { getEarsivMailStatu, getEArchive, setEArchiveStatus, getEarsivRaporStatu, previewInvoice, sendDocumentEmail, sendEarsiv, sendEarsivIptal, } from "./ice/ice.earsiv.js";
import { buildInvoiceXml, toBase64, } from "./ice/ubl/invoiceBuilder.js";
import { assertAllowedServiceUrl } from "./ice/ice.client.js";
import { callWithSession, clearSession, health, logout, registerSessionShutdown, } from "./ice/ice.session.js";
registerSessionShutdown();
/**
 * Süreç içi kilit: aynı belgeye eşzamanlı kabul/red isteklerini engeller.
 * Çift gönderim korumasının ilk katmanı (bkz. EbelgeService.cevapVer).
 */
const cevapKilitleri = new Set();
/**
 * e-Belge servis katmanı: bağlantı ayarları, bağlantı testi, kontör,
 * gelen kutusu okuma ve kabul/red cevabı.
 */
export class EbelgeService {
    /**
     * Ayarları getirir. Kayıt yoksa TODVZ_TANIM'daki VKN ile ön doldurulmuş
     * boş bir taslak döner (ekranın boş açılmaması için).
     */
    static async getAyar(dbContext) {
        const kayit = await EbelgeSqlRepository.getAyar(dbContext);
        const sifrelemeHazir = isEncryptionConfigured();
        if (kayit) {
            return { ...EbelgeSqlRepository.toAyarView(kayit), sifrelemeHazir };
        }
        const firmaVkn = await EbelgeSqlRepository.getFirmaVknFromTanim(dbContext);
        return {
            id: 0,
            ortam: "CANLI",
            servisUrl: "https://integration.iceteknoloji.com.tr/integration.asmx",
            kullaniciAdi: "",
            sifreTanimli: false,
            uygulamaAdi: "LikyaKuyumERP",
            uygulamaSurum: "1.0",
            firmaVkn,
            firmaAlias: "",
            firmaIl: "",
            firmaIlce: "",
            aktif: false,
            guncelleyen: null,
            guncellemeTarihi: null,
            sifrelemeHazir,
        };
    }
    /**
     * Ayarları kaydeder. Adres allowlist'ten geçmezse kayıt yapılmaz;
     * kayıt sonrası bellekteki oturum düşürülür (yeni bilgilerle yeniden giriş yapılsın diye).
     */
    static async saveAyar(dto, kullanici, dbContext) {
        assertAllowedServiceUrl(dto.servisUrl);
        const mevcut = await EbelgeSqlRepository.getAyar(dbContext);
        const sifreVar = Boolean(mevcut?.sifreSifreli) || Boolean(dto.sifre && dto.sifre.trim());
        if (dto.aktif && !sifreVar) {
            throw ApiError.badRequest("Bağlantı etkinleştirilmeden önce entegratör şifresi girilmelidir.");
        }
        // Ayar değiştiyse eski oturum geçersiz
        if (mevcut) {
            clearSession({
                servisUrl: mevcut.servisUrl,
                kullaniciAdi: mevcut.kullaniciAdi,
                sifre: "",
                uygulamaAdi: mevcut.uygulamaAdi,
                uygulamaSurum: mevcut.uygulamaSurum,
                dbServer: dbContext?.dbServer,
                dbName: dbContext?.dbName,
            });
        }
        const sonuc = await EbelgeSqlRepository.saveAyar(dto, kullanici, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "AYAR_KAYIT",
            yon: "GIDEN",
            basarili: true,
            kullanici,
            istekOzet: `ortam=${dto.ortam} url=${dto.servisUrl} kullanici=${dto.kullaniciAdi} aktif=${dto.aktif}`,
        }, dbContext);
        return sonuc;
    }
    /**
     * Bağlantı testi.
     *
     * Sıra önemli: önce `Health` (oturum gerektirmiyor) — servis ayakta değilse
     * boşuna Login denenmez, ICE'nin hatalı deneme sayacı şişmez.
     */
    static async testBaglanti(kullanici, dbContext) {
        const started = Date.now();
        const kayit = await EbelgeSqlRepository.getAyar(dbContext);
        if (!kayit || !kayit.servisUrl) {
            throw ApiError.badRequest("Önce servis adresini kaydediniz.");
        }
        const sonuc = {
            servisAyakta: false,
            healthCevabi: null,
            girisBasarili: false,
            hataMesaji: null,
            hataliDenemeSayisi: null,
            kontor: null,
            sureMs: 0,
        };
        // 1) Health — oturumsuz
        try {
            sonuc.healthCevabi = await health(kayit.servisUrl);
            sonuc.servisAyakta = true;
        }
        catch (err) {
            sonuc.hataMesaji = err?.message || "Servise ulaşılamadı.";
            sonuc.sureMs = Date.now() - started;
            await EbelgeSqlRepository.writeLog({
                metod: "Health",
                yon: "GIDEN",
                basarili: false,
                hataMesaji: sonuc.hataMesaji,
                sureMs: sonuc.sureMs,
                kullanici,
            }, dbContext);
            return sonuc;
        }
        // 2) Kimlik bilgisi yoksa test burada biter — Login denenmez
        if (!kayit.kullaniciAdi || !kayit.sifreSifreli) {
            sonuc.hataMesaji = "Servis ayakta. Giriş denenmedi: kullanıcı adı veya şifre tanımlı değil.";
            sonuc.sureMs = Date.now() - started;
            return sonuc;
        }
        // 3) Login + Get_Credit + Logout
        let config;
        try {
            config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        }
        catch (err) {
            sonuc.hataMesaji = err?.message || "Bağlantı yapılandırması okunamadı.";
            sonuc.sureMs = Date.now() - started;
            return sonuc;
        }
        try {
            const kontor = await this.fetchKontor(config, dbContext, kullanici);
            sonuc.girisBasarili = true;
            sonuc.kontor = kontor;
        }
        catch (err) {
            sonuc.hataMesaji = err?.message || "Entegratör girişi başarısız.";
            const eslesme = /hatalı deneme sayısı: (\d+)/i.exec(sonuc.hataMesaji || "");
            if (eslesme) {
                sonuc.hataliDenemeSayisi = Number(eslesme[1]);
            }
        }
        finally {
            // Test amaçlı açılan oturumu açık bırakma
            await logout(config).catch(() => undefined);
        }
        sonuc.sureMs = Date.now() - started;
        await EbelgeSqlRepository.writeLog({
            metod: "BAGLANTI_TEST",
            yon: "GIDEN",
            basarili: sonuc.girisBasarili,
            hataMesaji: sonuc.hataMesaji,
            sureMs: sonuc.sureMs,
            kullanici,
        }, dbContext);
        return sonuc;
    }
    /**
     * Kalan kontör bilgisi. ICE bunu DataSet (diffgram) olarak döndürüyor,
     * alan adları sabit olmadığı için satırlar olduğu gibi taşınır.
     */
    static async getKontor(kullanici, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        return this.fetchKontor(config, dbContext, kullanici);
    }
    static async fetchKontor(config, dbContext, kullanici) {
        const { data, trace } = await callWithSession(config, {
            method: "Get_Credit",
            // Get_Credit yalnızca oturum başlığı alıyor
            buildInnerXml: (loginHeaderXml) => loginHeaderXml,
            authHatasindaTekrarla: true, // okuma çağrısı — tekrar güvenli
        });
        await EbelgeSqlRepository.writeLog({
            metod: "Get_Credit",
            yon: "GIDEN",
            basarili: true,
            sureMs: trace.sureMs,
            kullanici,
        }, dbContext);
        return extractDataSetRows(data);
    }
    static async getLogs(limit, dbContext) {
        return EbelgeSqlRepository.getLogs(limit, dbContext);
    }
    /* ======================================================================
       Gelen kutusu (Faz 3)
       ====================================================================== */
    /**
     * ICE'den gelen belgeleri çekip yerel aynaya yazar.
     *
     * `HEADER_ONLY=true` ile çalışır: base64 UBL gövdesi indirilmez, yalnızca
     * başlıklar gelir. INVOICEHEADER zaten unvan, tarih, tutar ve GİB statüsünü
     * verdiği için liste ekranı için UBL ayrıştırmaya gerek yoktur.
     */
    static async senkronizeGelen(kullanici, filtre, dbContext) {
        const started = Date.now();
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const gunSayisi = Math.min(Math.max(filtre.gunSayisi ?? 30, 1), 365);
        const bitis = new Date();
        const baslangic = new Date(bitis.getTime() - gunSayisi * 24 * 60 * 60 * 1000);
        const iceFiltre = {
            limit: Math.min(Math.max(filtre.limit ?? 200, 1), 1000),
            baslangicTarihi: baslangic,
            bitisTarihi: bitis,
            okunmuslarDahil: filtre.okunmuslarDahil ?? true,
            islenmislerDahil: true,
            yon: "IN",
        };
        // Önce adet — sayfalama ve kullanıcıya bilgi için
        let toplamIce = 0;
        try {
            toplamIce = await getInvoiceCount(config, iceFiltre);
        }
        catch (err) {
            logger.warn("GetInvoice_Count başarısız, listeye devam ediliyor:", err);
        }
        const { faturalar, sureMs } = await getInvoices(config, iceFiltre, true);
        let yazilan = 0;
        for (const fatura of faturalar) {
            const uuid = String(fatura.UUID || "").trim();
            if (!uuid)
                continue;
            const h = fatura.HEADER || {};
            await EbelgeSqlRepository.upsertGelen({
                uuid,
                belgeNo: fatura.ID ? String(fatura.ID) : null,
                belgeTuru: "EFATURA",
                profil: h.PROFILEID ? String(h.PROFILEID) : null,
                sender: h.SENDER ? String(h.SENDER) : null,
                receiver: h.RECEIVER ? String(h.RECEIVER) : null,
                supplier: h.SUPPLIER ? String(h.SUPPLIER) : null,
                customer: h.CUSTOMER ? String(h.CUSTOMER) : null,
                duzenlemeTarihi: parseIceDate(h.ISSUE_DATE),
                tutar: parseAmount(h.PAYABLE_AMOUNT),
                paraBirimi: parseCurrency(h.PAYABLE_AMOUNT),
                faturaTipi: h.INVOICE_TYPE_CODE ? String(h.INVOICE_TYPE_CODE) : null,
                gibStatuKodu: h.GIB_STATUS_CODE != null ? Number(h.GIB_STATUS_CODE) : null,
                gibStatuAciklama: h.GIB_STATUS_DESCRIPTION ? String(h.GIB_STATUS_DESCRIPTION) : null,
                statu: h.STATUS ? String(h.STATUS) : null,
                statuAciklama: h.STATUS_DESCRIPTION ? String(h.STATUS_DESCRIPTION) : null,
                zarfId: h.ENVELOPE_IDENTIFIER ? String(h.ENVELOPE_IDENTIFIER) : null,
                hash: h.HASH ? String(h.HASH) : null,
            }, dbContext);
            yazilan += 1;
        }
        const toplamSure = Date.now() - started;
        await EbelgeSqlRepository.writeLog({
            metod: "GetInvoice",
            yon: "GELEN",
            basarili: true,
            sureMs,
            kullanici,
            istekOzet: `gun=${gunSayisi} limit=${iceFiltre.limit} yon=IN headerOnly=true`,
            cevapOzet: `ICE toplam=${toplamIce} çekilen=${faturalar.length} yazılan=${yazilan}`,
        }, dbContext);
        return { toplamIce, cekilen: faturalar.length, yazilan, sureMs: toplamSure };
    }
    /** Yerel aynadan sayfalı liste */
    static async listGelen(filtre, dbContext) {
        return EbelgeSqlRepository.listGelen(filtre, dbContext);
    }
    /**
     * Tek belge detayı. `statuYenile=true` ise ICE'den güncel GİB statüsü de çekilir.
     */
    static async getGelenDetay(uuid, statuYenile, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGelen(uuid, dbContext);
        if (!kayit) {
            throw ApiError.notFound("Belge yerel kayıtlarda bulunamadı. Önce senkronize ediniz.");
        }
        if (!statuYenile)
            return kayit;
        try {
            const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
            const detay = await getInvoiceStatusDetail(config, uuid);
            await EbelgeSqlRepository.updateGelenStatu(uuid, {
                statu: detay.STATUS ? String(detay.STATUS) : null,
                statuAciklama: detay.STATUS_DESCRIPTION ? String(detay.STATUS_DESCRIPTION) : null,
                gibStatuKodu: detay.STATUS_CODE != null && !isNaN(Number(detay.STATUS_CODE))
                    ? Number(detay.STATUS_CODE)
                    : null,
            }, dbContext);
            await EbelgeSqlRepository.writeLog({ metod: "Get_Invoice_Status_Detail", yon: "GELEN", basarili: true, kullanici, ilgiliUuid: uuid }, dbContext);
            return (await EbelgeSqlRepository.getGelen(uuid, dbContext)) || kayit;
        }
        catch (err) {
            // Statü çekilemezse yerel kayıt yine de gösterilir
            logger.warn(`Get_Invoice_Status_Detail başarısız (${uuid}):`, err);
            return kayit;
        }
    }
    /* ======================================================================
       Giden belge — UBL üretimi ve doğrulama (Faz 5)
       ====================================================================== */
    /**
     * Gönderici (firma) bilgilerini ayar + TODVZ_TANIM'dan tamamlar.
     * İstek gövdesinde verilen alanlar önceliklidir.
     */
    static async goncericiTamamla(verilen, dbContext) {
        const ayar = await EbelgeSqlRepository.getAyar(dbContext);
        const firma = await EbelgeSqlRepository.getFirmaBilgisi(dbContext);
        const vknTckn = (verilen?.vknTckn || ayar?.firmaVkn || firma.vkn || "").trim();
        if (!vknTckn) {
            throw ApiError.badRequest("Firma VKN/TCKN bulunamadı. E-Belge ayarlarından firma vergi kimlik numarasını giriniz.");
        }
        return {
            vknTckn,
            unvan: verilen?.unvan || firma.unvan || undefined,
            ad: verilen?.ad,
            soyad: verilen?.soyad,
            vergiDairesi: verilen?.vergiDairesi,
            adres: verilen?.adres || firma.adres || undefined,
            // UBL-TR adreste il/ilçe zorunlu; firma tablosunda bu kolonlar yok, bu yüzden
            // e-Belge ayarlarından alınır (§16.17).
            ilce: verilen?.ilce || ayar?.firmaIlce || undefined,
            il: verilen?.il || ayar?.firmaIl || undefined,
            ulke: verilen?.ulke,
            telefon: verilen?.telefon || firma.telefon || undefined,
            eposta: verilen?.eposta,
            webAdresi: verilen?.webAdresi,
        };
    }
    /**
     * UBL-TR faturayı üretir ve **göndermeden** ICE'ye doğrulatır.
     *
     * `invoice_check_validate` şema + schematron sonucunu ve istenirse HTML önizlemeyi döndürür.
     * Bu çağrı belge oluşturmaz, mali sonuç doğurmaz.
     */
    static async dogrulaGidenBelge(girdi, kullanici, onizleme, dbContext) {
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, ozet } = buildInvoiceXml({ ...girdi, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuc = await invoiceCheckValidate(config, toBase64(xml), { html: onizleme, pdf: false });
        const semaGecerli = String(sonuc?.shema_validate).toLowerCase() === "true";
        const schematronGecerli = String(sonuc?.shematron_validate).toLowerCase() === "true";
        await EbelgeSqlRepository.writeLog({
            metod: "invoice_check_validate",
            yon: "GIDEN",
            basarili: semaGecerli && schematronGecerli,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${girdi.belgeNo} satır=${girdi.satirlar.length} tutar=${ozet.odenecekTutar}`,
            cevapOzet: `sema=${semaGecerli} schematron=${schematronGecerli} ${sonuc?.response_message || ""}`.trim(),
        }, dbContext);
        return {
            uuid,
            xml,
            ozet,
            semaGecerli,
            schematronGecerli,
            mesaj: sonuc?.response_message?.trim() || "",
            html: onizleme && sonuc?.invoice_html ? String(sonuc.invoice_html) : null,
        };
    }
    /**
     * Alıcının e-Fatura mükellefi olup olmadığını sorar.
     * Sonuç boşsa alıcı mükellef değildir → e-Arşiv kesilmelidir.
     */
    static async mukellefSorgula(vknTckn, kullanici, dbContext) {
        if (!/^\d{10}$|^\d{11}$/.test(vknTckn.trim())) {
            throw ApiError.badRequest("VKN 10, TCKN 11 haneli rakam olmalıdır.");
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuc = await getUserListEFatura(config, vknTckn.trim());
        if (!sonuc.basarili) {
            throw ApiError.unprocessable(sonuc.mesaj || "Mükellef sorgusu başarısız; belge türü belirlenemedi.");
        }
        await EbelgeSqlRepository.writeLog({
            metod: "getUserList_EFatura",
            yon: "GIDEN",
            basarili: sonuc.basarili,
            kullanici,
            istekOzet: `vkn=${vknTckn}`,
            cevapOzet: `${sonuc.kullanicilar.length} etiket`,
        }, dbContext);
        return {
            mukellefMi: sonuc.kullanicilar.length > 0,
            kullanicilar: sonuc.kullanicilar,
            mesaj: sonuc.mesaj,
        };
    }
    /**
     * Belgeyi ICE'de **taslak** olarak oluşturur.
     *
     * ⚠️ Taslak **GİB'e gitmez**. GİB'e ancak `DraftApproval` ile gönderilir; bu servis
     * o çağrıyı yapmaz ve Faz 6'da onay ucu hiç açılmamıştır (karar: kullanıcı,
     * "GİB'e gitmesin"). Taslak `taslakIptal` ile geri alınabilir.
     *
     * Akış: UBL üret → `invoice_check_validate` ile doğrula → geçtiyse taslak gönder.
     * Doğrulamadan geçmeyen belge ICE'ye hiç gönderilmez.
     */
    /* ======================================================================
       e-İrsaliye (Faz 9)
       ====================================================================== */
    /**
     * e-İrsaliyeyi **göndermeden** doğrular (`despatchadvice_check_validate`).
     */
    static async dogrulaIrsaliyeBelgesi(girdi, kullanici, onizleme, dbContext) {
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, satirSayisi } = buildDespatchAdviceXml({ ...girdi, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuc = await despatchAdviceCheckValidate(config, toBase64(xml), {
            html: onizleme,
            pdf: false,
        });
        const semaGecerli = String(sonuc?.shema_validate).toLowerCase() === "true";
        const schematronGecerli = String(sonuc?.shematron_validate).toLowerCase() === "true";
        await EbelgeSqlRepository.writeLog({
            metod: "despatchadvice_check_validate",
            yon: "GIDEN",
            basarili: semaGecerli && schematronGecerli,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${girdi.belgeNo} satır=${satirSayisi}`,
            cevapOzet: `sema=${semaGecerli} schematron=${schematronGecerli} ${sonuc?.response_message || ""}`.trim(),
        }, dbContext);
        return {
            uuid,
            xml,
            satirSayisi,
            semaGecerli,
            schematronGecerli,
            mesaj: sonuc?.response_message?.trim() || "",
            html: onizleme && sonuc?.despatchadvice_html ? String(sonuc.despatchadvice_html) : null,
        };
    }
    /**
     * e-İrsaliyeyi GİB'e gönderir.
     *
     * ⚠️ **GERİ ALINAMAZ.** e-Fatura ile aynı disiplin:
     * numara ön kontrolü → UBL üret → `despatchadvice_check_validate` →
     * alıcının **e-İrsaliye** posta kutusu (e-Fatura mükellefiyetinden ayrıdır) →
     * ICE son sıra → kontör → **SQL rezervasyonu** → gönderim → belge bazında doğrulama.
     */
    static async irsaliyeGonder(girdi, kullanici, dbContext) {
        const belgeNo = girdi.belgeNo.trim().toUpperCase();
        const tarih = girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
        girdi = { ...girdi, belgeNo, tarih };
        if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
            throw ApiError.conflict(`${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`);
        }
        const ayar = await EbelgeSqlRepository.getAyar(dbContext);
        const fromAlias = ayar?.firmaAlias?.trim() || "";
        if (!fromAlias) {
            throw ApiError.badRequest("Gönderici etiketi (alias) tanımlı değil. E-Belge ayarlarından firma alias bilgisini giriniz.");
        }
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, satirSayisi } = buildDespatchAdviceXml({ ...girdi, belgeNo, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        // 1) Doğrulama — geçmezse GİB'e hiç gitmesin
        const dogrulama = await despatchAdviceCheckValidate(config, toBase64(xml), {
            html: false,
            pdf: false,
        });
        const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
        const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";
        if (!semaGecerli || !schematronGecerli) {
            throw ApiError.unprocessable(dogrulama?.response_message?.trim() ||
                "İrsaliye şema/schematron doğrulamasından geçemedi; gönderilmedi.");
        }
        // 2) Alıcının e-İrsaliye posta kutusu — e-Fatura mükellefiyetinden AYRI sorgulanır
        let aliciAlias = girdi.aliciAlias?.trim() || "";
        if (!aliciAlias) {
            const mukellef = await getUserListDespatchAdvice(config, girdi.alici.vknTckn);
            if (!mukellef.basarili) {
                throw ApiError.unprocessable(mukellef.mesaj || "Alıcının e-İrsaliye mükellefiyeti doğrulanamadı; gönderim durduruldu.");
            }
            aliciAlias = mukellef.kullanicilar[0]?.Alias?.trim() || "";
            if (!aliciAlias) {
                throw ApiError.badRequest("Alıcı e-İrsaliye mükellefi görünmüyor (posta kutusu etiketi bulunamadı). " +
                    "Bu alıcıya kâğıt irsaliye düzenlenmelidir.");
            }
        }
        // 3) ICE'deki son sıra
        const son = await getSonBelgeId(config, belgeNo.slice(0, 3), "EIrsaliye", Number(belgeNo.slice(3, 7)));
        const sonSira = Number(son?.Son_Belge_ID);
        if (son?.Son_Belge_ID == null ||
            String(son.Son_Belge_ID).trim() === "" ||
            !Number.isInteger(sonSira) ||
            sonSira < 0) {
            throw ApiError.unprocessable("ICE son belge numarası doğrulanamadı; gönderim durduruldu.");
        }
        if (Number(belgeNo.slice(7)) <= sonSira) {
            throw ApiError.conflict("İrsaliye numarası ICE'de kullanılan son sıradan büyük olmalıdır.");
        }
        // 4) Kontör
        const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);
        // 5) ICE yazma çağrısından ÖNCE kalıcı yer tut
        await EbelgeSqlRepository.insertGiden({
            uuid,
            belgeNo,
            belgeTuru: "EIrsaliye",
            profil: girdi.senaryo || "TEMELIRSALIYE",
            faturaTipi: girdi.irsaliyeTipi,
            taslakMi: false,
            aliciVkn: girdi.alici.vknTckn,
            aliciAlias,
            aliciUnvan: girdi.alici.unvan || [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") || null,
            duzenlemeTarihi: new Date(tarih),
            // İrsaliyede tutar yoktur
            tutar: null,
            paraBirimi: null,
            gonderimDurumu: "GONDERILIYOR",
            semaGecerli,
            schematronGecerli,
            iceResponseMesaj: "Gönderim başlatıldı. Sonuç kesinleşmeden yeniden göndermeyiniz.",
            xmlIcerik: xml,
            olusturan: kullanici,
            gonderen: kullanici,
            gonderimTarihi: new Date(),
        }, dbContext);
        // 6) Gönder
        let sonuc;
        try {
            sonuc = await sendDespatchAdvice(config, {
                fromVknTckn: gonderici.vknTckn,
                fromAlias,
                toVknTckn: girdi.alici.vknTckn,
                toAlias: aliciAlias,
                despatchAdvicesBase64: [toBase64(xml)],
            });
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", "BELIRSIZ", {
                mesaj: "ICE gönderim sonucu alınamadı. Aynı irsaliyeyi yeni numarayla da göndermeyiniz; ICE portalinden ETTN ile kontrol ediniz.",
            }, dbContext).catch(() => undefined);
            throw ApiError.conflict(`Gönderim sonucu belirsiz (ETTN: ${uuid}). Giden kutusu ve ICE portalini kontrol ediniz; yeniden göndermeyiniz.`);
        }
        // 7) Belge bazında doğrula
        const satirlar = irsaliyeGonderimSatirlari(sonuc);
        const ilk = satirlar[0];
        const dogru = (v) => String(v).toLowerCase() === "true";
        const basarili = dogru(sonuc.success) &&
            satirlar.length === 1 &&
            dogru(ilk?.success) &&
            String(ilk?.ettn || "").toLowerCase() === uuid.toLowerCase() &&
            ilk?.ID === belgeNo;
        const acikRed = String(sonuc.success).toLowerCase() === "false" ||
            (satirlar.length === 1 && String(ilk?.success).toLowerCase() === "false");
        const durum = basarili ? "GONDERILDI" : acikRed ? "HATA" : "BELIRSIZ";
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", durum, {
            kod: String(sonuc.response_code ?? ""),
            mesaj: durum === "BELIRSIZ"
                ? "ICE cevabı belgeyi kesin olarak doğrulamıyor; portalden ETTN ile kontrol ediniz."
                : ilk?.response_message || sonuc.response_message || durum,
        }, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "send_DespatchAdvice",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${belgeNo} alici=${girdi.alici.vknTckn} satır=${satirSayisi}`,
            cevapOzet: `durum=${durum} ${sonuc.response_message || ""}`,
        }, dbContext);
        if (!basarili) {
            throw ApiError.conflict(durum === "BELIRSIZ"
                ? "Gönderim sonucu belirsiz; ICE portalinden kontrol ediniz. Yeniden göndermeyiniz."
                : ilk?.response_message || sonuc.response_message || "e-İrsaliye gönderimi reddedildi.");
        }
        return {
            uuid,
            belgeNo,
            durum: "GONDERILDI",
            mesaj: sonuc.response_message?.trim() || "",
            satirSayisi,
            kontorKalan: kontor.kalan,
            kontorUyari: kontor.uyari,
        };
    }
    /** Alıcının e-İrsaliye mükellefiyeti */
    static async irsaliyeMukellefSorgula(vknTckn, kullanici, dbContext) {
        if (!/^\d{10}$|^\d{11}$/.test(vknTckn.trim())) {
            throw ApiError.badRequest("VKN 10, TCKN 11 haneli rakam olmalıdır.");
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuc = await getUserListDespatchAdvice(config, vknTckn.trim());
        await EbelgeSqlRepository.writeLog({
            metod: "getUserList_DespatchAdvice",
            yon: "GIDEN",
            basarili: sonuc.basarili,
            kullanici,
            istekOzet: `vkn=${vknTckn}`,
            cevapOzet: `${sonuc.kullanicilar.length} etiket`,
        }, dbContext);
        return {
            mukellefMi: sonuc.kullanicilar.length > 0,
            kullanicilar: sonuc.kullanicilar,
            mesaj: sonuc.mesaj,
        };
    }
    /** Gelen/giden irsaliye listesi (ICE'den doğrudan) */
    static async irsaliyeListe(filtre, kullanici, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const gunSayisi = Math.min(Math.max(filtre.gunSayisi ?? 30, 1), 365);
        const limit = Math.min(Math.max(filtre.limit ?? 100, 1), 500);
        const bitis = new Date();
        const baslangic = new Date(bitis.getTime() - gunSayisi * 24 * 60 * 60 * 1000);
        const kayitlar = await getDespatchAdvices(config, {
            limit,
            baslangicTarihi: baslangic,
            bitisTarihi: bitis,
            okunmuslarDahil: true,
            islenmislerDahil: true,
            yon: filtre.yon || "IN",
        }, true);
        await EbelgeSqlRepository.writeLog({
            metod: "GetDespatchadvice",
            yon: filtre.yon === "OUT" ? "GIDEN" : "GELEN",
            basarili: true,
            kullanici,
            istekOzet: `gun=${gunSayisi} limit=${limit} yon=${filtre.yon || "IN"}`,
            cevapOzet: `${kayitlar.length} kayıt`,
        }, dbContext);
        return { kayitlar, limitDoldu: kayitlar.length >= limit };
    }
    /** İrsaliyenin GİB statüsü */
    static async irsaliyeStatu(uuidler, yon, kullanici, dbContext) {
        if (!uuidler.length)
            throw ApiError.badRequest("En az bir UUID gereklidir.");
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuc = await getDespatchAdviceStatus(config, uuidler, yon);
        await EbelgeSqlRepository.writeLog({
            metod: "Get_DespatchAdvice_Status",
            yon: "GIDEN",
            basarili: true,
            kullanici,
            istekOzet: `${uuidler.length} belge yon=${yon}`,
        }, dbContext);
        return sonuc;
    }
    /** İrsaliyenin PDF çıktısı */
    static async irsaliyePdf(ettn, kullanici, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const { pdf } = await getDespatchAdviceCikti(config, ettn, { pdf: true });
        await EbelgeSqlRepository.writeLog({
            metod: "GetDespatchadvice_HTML_PDF",
            yon: "GIDEN",
            basarili: Boolean(pdf?.length),
            kullanici,
            ilgiliUuid: ettn,
            cevapOzet: `${pdf?.length ?? 0} bayt`,
        }, dbContext);
        if (!pdf?.length)
            throw ApiError.notFound("İrsaliyenin PDF çıktısı alınamadı.");
        return pdf;
    }
    /* ======================================================================
       e-Fatura gerçek gönderimi (Faz 7)
       ====================================================================== */
    /**
     * Alıcının GİB posta kutusu etiketini (alias) çözer.
     * e-Fatura gönderimi için alıcının **mükellef olması zorunludur**.
     */
    static async aliciAliasCoz(config, aliciVkn, verilenAlias) {
        const verilen = verilenAlias?.trim();
        if (verilen)
            return verilen;
        const mukellef = await getUserListEFatura(config, aliciVkn);
        // Başarısız sorgu "mükellef değil" anlamına gelmez — gönderim durur
        if (!mukellef.basarili) {
            throw ApiError.unprocessable(mukellef.mesaj || "Alıcının mükellef durumu doğrulanamadı; gönderim durduruldu.");
        }
        const alias = mukellef.kullanicilar[0]?.Alias?.trim() || "";
        if (!alias) {
            throw ApiError.badRequest("Alıcı e-Fatura mükellefi görünmüyor (GİB posta kutusu etiketi bulunamadı). " +
                "Bu alıcıya e-Arşiv fatura kesilmelidir.");
        }
        return alias;
    }
    /**
     * e-Faturayı **doğrudan GİB'e** gönderir.
     *
     * ⚠️⚠️ **GERİ ALINAMAZ.** Taslak değildir. Fatura numarası ve kontör kalıcı olarak yanar.
     * Düzeltmenin tek yolu alıcının red cevabı (ticari fatura, 8 gün) veya iade faturasıdır.
     *
     * Akış e-Arşiv ile aynı disiplinde — **ICE çağrısından önce SQL rezervasyonu**:
     * numara ön kontrolü → UBL üret → `invoice_check_validate` → alias çöz →
     * ICE son sıra kontrolü → kontör → **rezervasyon** → `send_invoice` →
     * sonucu belge bazında doğrula → durum geçişi.
     */
    static async faturaGonder(girdi, kullanici, dbContext) {
        const belgeNo = girdi.belgeNo.trim().toUpperCase();
        const tarih = girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
        girdi = { ...girdi, belgeNo, tarih };
        if (girdi.senaryo === "EARSIVFATURA") {
            throw ApiError.badRequest("e-Arşiv senaryosu bu uçtan gönderilemez; e-Arşiv gönderimi için /earsiv/gonder kullanılır.");
        }
        if (girdi.faturaTipi === "OZELMATRAH" || girdi.faturaTipi === "IHRACKAYITLI") {
            throw ApiError.unprocessable(`${girdi.faturaTipi} tipi bu üreteçte henüz desteklenmiyor; yapısı doğrulanmış örnekle eklenecektir.`);
        }
        if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
            throw ApiError.conflict(`${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`);
        }
        const ayar = await EbelgeSqlRepository.getAyar(dbContext);
        const fromAlias = ayar?.firmaAlias?.trim() || "";
        if (!fromAlias) {
            throw ApiError.badRequest("Gönderici etiketi (alias) tanımlı değil. E-Belge ayarlarından firma alias bilgisini giriniz.");
        }
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, ozet } = buildInvoiceXml({ ...girdi, belgeNo, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        // 1) Doğrulama — geçmezse GİB'e hiç gitmesin
        const dogrulama = await invoiceCheckValidate(config, toBase64(xml), { html: false, pdf: false });
        const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
        const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";
        if (!semaGecerli || !schematronGecerli) {
            throw ApiError.unprocessable(dogrulama?.response_message?.trim() ||
                "Belge şema/schematron doğrulamasından geçemedi; fatura gönderilmedi.");
        }
        // 2) Alıcı etiketi
        const aliciAlias = await this.aliciAliasCoz(config, girdi.alici.vknTckn, girdi.aliciAlias);
        // 3) ICE'deki son sıra
        const son = await getSonBelgeId(config, belgeNo.slice(0, 3), "EFatura", Number(belgeNo.slice(3, 7)));
        const sonSira = Number(son?.Son_Belge_ID);
        if (son?.Son_Belge_ID == null ||
            String(son.Son_Belge_ID).trim() === "" ||
            !Number.isInteger(sonSira) ||
            sonSira < 0) {
            throw ApiError.unprocessable("ICE son belge numarası doğrulanamadı; gönderim durduruldu.");
        }
        if (Number(belgeNo.slice(7)) <= sonSira) {
            throw ApiError.conflict("Fatura numarası ICE'de kullanılan son sıradan büyük olmalıdır.");
        }
        // 4) Kontör
        const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);
        // 5) ICE yazma çağrısından ÖNCE kalıcı yer tut
        await EbelgeSqlRepository.insertGiden({
            uuid,
            belgeNo,
            belgeTuru: "EFatura",
            profil: girdi.senaryo,
            faturaTipi: girdi.faturaTipi,
            taslakMi: false,
            aliciVkn: girdi.alici.vknTckn,
            aliciAlias,
            aliciUnvan: girdi.alici.unvan || [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") || null,
            duzenlemeTarihi: new Date(tarih),
            tutar: ozet.odenecekTutar,
            paraBirimi: girdi.paraBirimi || "TRY",
            gonderimDurumu: "GONDERILIYOR",
            semaGecerli,
            schematronGecerli,
            iceResponseMesaj: "Gönderim başlatıldı. Sonuç kesinleşmeden yeniden göndermeyiniz.",
            xmlIcerik: xml,
            olusturan: kullanici,
            gonderen: kullanici,
            gonderimTarihi: new Date(),
        }, dbContext);
        // 6) Gönder
        let sonuc;
        try {
            sonuc = await sendInvoice(config, {
                fromVknTckn: gonderici.vknTckn,
                fromAlias,
                toVknTckn: girdi.alici.vknTckn,
                toAlias: aliciAlias,
                invoicesBase64: [toBase64(xml)],
            });
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", "BELIRSIZ", {
                mesaj: "ICE gönderim sonucu alınamadı. Aynı belgeyi yeni numarayla da göndermeyiniz; ICE portalinden ETTN ile kontrol ediniz.",
            }, dbContext).catch(() => undefined);
            throw ApiError.conflict(`Gönderim sonucu belirsiz (ETTN: ${uuid}). Giden kutusu ve ICE portalini kontrol ediniz; yeniden göndermeyiniz.`);
        }
        // 7) Sonucu belge bazında doğrula
        const satirlar = gonderimSatirlari(sonuc);
        const ilk = satirlar[0];
        const dogru = (v) => String(v).toLowerCase() === "true";
        const basarili = dogru(sonuc.success) &&
            satirlar.length === 1 &&
            dogru(ilk?.success) &&
            dogru(ilk?.shema_is_validate) &&
            dogru(ilk?.schematron_is_validate) &&
            String(ilk?.ettn || "").toLowerCase() === uuid.toLowerCase() &&
            ilk?.ID === belgeNo;
        const acikRed = String(sonuc.success).toLowerCase() === "false" ||
            (satirlar.length === 1 && String(ilk?.success).toLowerCase() === "false");
        const durum = basarili ? "GONDERILDI" : acikRed ? "HATA" : "BELIRSIZ";
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", durum, {
            kod: String(sonuc.response_code ?? ""),
            mesaj: durum === "BELIRSIZ"
                ? "ICE cevabı belgeyi kesin olarak doğrulamıyor; portalden ETTN ile kontrol ediniz."
                : ilk?.response_message || sonuc.response_message || durum,
        }, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "send_invoice",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${belgeNo} alici=${girdi.alici.vknTckn} tutar=${ozet.odenecekTutar}`,
            cevapOzet: `durum=${durum} ${sonuc.response_message || ""}`,
        }, dbContext);
        if (!basarili) {
            throw ApiError.conflict(durum === "BELIRSIZ"
                ? "Gönderim sonucu belirsiz; ICE portalinden kontrol ediniz. Yeniden göndermeyiniz."
                : ilk?.response_message || sonuc.response_message || "e-Fatura gönderimi reddedildi.");
        }
        return {
            uuid,
            belgeNo,
            ettn: uuid,
            durum: "GONDERILDI",
            mesaj: sonuc.response_message?.trim() || "",
            tutar: ozet.odenecekTutar,
            kontorKalan: kontor.kalan,
            kontorUyari: kontor.uyari,
        };
    }
    /**
     * Taslağı onaylayıp **GİB'e gönderir** (`DraftApproval`).
     *
     * ⚠️⚠️ **GERİ ALINAMAZ.** Taslak artık iptal edilemez; belge GİB'e iletilir.
     *
     * `TASLAK → ONAYLANIYOR` geçişi **ICE çağrısından önce** ve atomik yapılır;
     * bağlantı koparsa `BELIRSIZ` kalır, ikinci onay engellenir.
     */
    static async taslakOnayla(uuid, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        if (kayit.belgeTuru !== "EFatura") {
            throw ApiError.badRequest("Taslak onayı yalnızca e-Fatura belgeleri içindir.");
        }
        if (kayit.gonderimDurumu !== "TASLAK") {
            throw ApiError.badRequest(`Yalnızca taslak durumundaki belgeler onaylanabilir. Bu belgenin durumu: ${kayit.gonderimDurumu}`);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);
        // ICE çağrısından ÖNCE atomik geçiş — ikinci istek buradan geçemez
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "TASLAK", "ONAYLANIYOR", { mesaj: "GİB'e gönderim onayı başlatıldı. Sonuç kesinleşmeden tekrar denemeyiniz." }, dbContext);
        let sonuc;
        try {
            sonuc = await sendDraftDocumentApproval(config, kayit.belgeNo, "EFatura", "DraftApproval");
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uuid, "ONAYLANIYOR", "BELIRSIZ", {
                mesaj: "Onay sonucu alınamadı. Belge GİB'e gitmiş olabilir; ICE portalinden kontrol etmeden tekrar denemeyiniz.",
            }, dbContext).catch(() => undefined);
            throw ApiError.conflict(`Onay sonucu belirsiz (${kayit.belgeNo}). ICE portalinden kontrol ediniz; yeniden onaylamayınız.`);
        }
        const basarili = String(sonuc?.success).toLowerCase() === "true";
        const acikRed = String(sonuc?.success).toLowerCase() === "false";
        const durum = basarili ? "GONDERILDI" : acikRed ? "TASLAK" : "BELIRSIZ";
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "ONAYLANIYOR", durum, {
            mesaj: `${sonuc?.response_message ?? ""} ${sonuc?.response_message_detail ?? ""}`.trim() || durum,
        }, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "send_draft_document_approval",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `processType=DraftApproval belgeNo=${kayit.belgeNo}`,
            cevapOzet: `${sonuc?.response_message ?? ""} ${sonuc?.response_message_detail ?? ""}`.trim(),
        }, dbContext);
        if (!basarili) {
            if (!acikRed)
                throw ApiError.conflict("Onay sonucu belirsiz; ICE portalinden kontrol ediniz. Yeniden göndermeyiniz.");
            throw ApiError.badRequest(sonuc?.response_message?.trim() || "Taslak onaylanamadı; belge taslak olarak kaldı.");
        }
        return {
            uuid,
            belgeNo: kayit.belgeNo,
            durum: "GONDERILDI",
            mesaj: (sonuc?.response_message?.trim() || "Taslak onaylandı ve GİB'e gönderildi.") +
                (kontor.uyari ? ` (${kontor.uyari})` : ""),
        };
    }
    /**
     * Giden belgenin güncel GİB statüsünü ICE'den çeker ve yerel kaydı günceller.
     */
    static async gidenStatuYenile(uuid, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const detay = await getInvoiceStatusDetail(config, uuid);
        await EbelgeSqlRepository.writeLog({
            metod: "Get_Invoice_Status_Detail",
            yon: "GIDEN",
            basarili: true,
            kullanici,
            ilgiliUuid: uuid,
            cevapOzet: `${detay.STATUS ?? ""} ${detay.STATUS_DESCRIPTION ?? ""}`.trim(),
        }, dbContext);
        return {
            uuid,
            statu: detay.STATUS ? String(detay.STATUS) : null,
            aciklama: detay.STATUS_DESCRIPTION ? String(detay.STATUS_DESCRIPTION) : null,
            portalStatu: detay.PORTAL_STATUS ? String(detay.PORTAL_STATUS) : null,
        };
    }
    static async taslakGonder(girdi, kullanici, dbContext) {
        // Aynı fatura numarası daha önce kullanılmış mı?
        if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo.trim().toUpperCase(), dbContext)) {
            throw ApiError.conflict(`${girdi.belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`);
        }
        const ayar = await EbelgeSqlRepository.getAyar(dbContext);
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, ozet } = buildInvoiceXml({ ...girdi, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        // 1) Önce doğrula — geçmezse ICE'ye taslak bile göndermeyelim
        const dogrulama = await invoiceCheckValidate(config, toBase64(xml), { html: false, pdf: false });
        const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
        const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";
        if (!semaGecerli || !schematronGecerli) {
            await EbelgeSqlRepository.writeLog({
                metod: "invoice_check_validate",
                yon: "GIDEN",
                basarili: false,
                kullanici,
                ilgiliUuid: uuid,
                istekOzet: `belgeNo=${girdi.belgeNo} (taslak öncesi doğrulama)`,
                hataMesaji: dogrulama?.response_message || "Doğrulamadan geçemedi",
            }, dbContext);
            throw ApiError.unprocessable(dogrulama?.response_message?.trim() ||
                "Belge şema/schematron doğrulamasından geçemedi; taslak oluşturulmadı.");
        }
        // 2) Alıcı etiketi (alias) — verilmemişse mükellef sorgusundan ilkini al
        let aliciAlias = girdi.aliciAlias?.trim() || "";
        if (!aliciAlias) {
            const mukellef = await getUserListEFatura(config, girdi.alici.vknTckn);
            aliciAlias = mukellef.kullanicilar[0]?.Alias?.trim() || "";
            if (!aliciAlias) {
                throw ApiError.badRequest("Alıcı e-Fatura mükellefi görünmüyor (GİB posta kutusu etiketi bulunamadı). " +
                    "Bu alıcıya e-Arşiv fatura kesilmelidir.");
            }
        }
        const fromAlias = ayar?.firmaAlias?.trim() || "";
        if (!fromAlias) {
            throw ApiError.badRequest("Gönderici etiketi (alias) tanımlı değil. E-Belge ayarlarından firma alias bilgisini giriniz.");
        }
        // 3) Taslak gönder — GİB'e gitmez
        const sonuc = await sendInvoiceTaslak(config, {
            fromVknTckn: gonderici.vknTckn,
            fromAlias,
            toVknTckn: girdi.alici.vknTckn,
            toAlias: aliciAlias,
            invoicesBase64: [toBase64(xml)],
        });
        const satirlar = gonderimSatirlari(sonuc);
        const ilk = satirlar[0] || {};
        const basarili = String(sonuc?.success).toLowerCase() === "true";
        const ettn = ilk.ettn ? String(ilk.ettn) : null;
        await EbelgeSqlRepository.writeLog({
            metod: "send_invoice_taslak",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: ettn || uuid,
            istekOzet: `belgeNo=${girdi.belgeNo} alici=${girdi.alici.vknTckn} tutar=${ozet.odenecekTutar}`,
            cevapOzet: `${sonuc?.response_code ?? ""} ${sonuc?.response_message ?? ""}`.trim(),
        }, dbContext);
        // 4) Sonucu ne olursa olsun kaydet — başarısız denemenin de izi kalsın
        await EbelgeSqlRepository.insertGiden({
            uuid: ettn || uuid,
            belgeNo: girdi.belgeNo.trim().toUpperCase(),
            belgeTuru: "EFatura",
            profil: girdi.senaryo,
            faturaTipi: girdi.faturaTipi,
            taslakMi: true,
            aliciVkn: girdi.alici.vknTckn,
            aliciAlias,
            aliciUnvan: girdi.alici.unvan ||
                [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") ||
                null,
            duzenlemeTarihi: girdi.tarih ? new Date(girdi.tarih) : new Date(),
            tutar: ozet.odenecekTutar,
            paraBirimi: girdi.paraBirimi || "TRY",
            gonderimDurumu: basarili ? "TASLAK" : "HATA",
            semaGecerli,
            schematronGecerli,
            iceResponseCode: sonuc?.response_code != null ? String(sonuc.response_code) : null,
            iceResponseMesaj: ilk.response_message || sonuc?.response_message || null,
            xmlIcerik: xml,
            olusturan: kullanici,
            gonderen: kullanici,
            gonderimTarihi: new Date(),
        }, dbContext);
        if (!basarili) {
            throw ApiError.badRequest(ilk.response_message?.trim() || sonuc?.response_message?.trim() || "Taslak oluşturulamadı.");
        }
        return {
            uuid: ettn || uuid,
            belgeNo: girdi.belgeNo.trim().toUpperCase(),
            ettn,
            durum: "TASLAK",
            semaGecerli,
            schematronGecerli,
            mesaj: sonuc?.response_message?.trim() || "",
            tutar: ozet.odenecekTutar,
        };
    }
    /* ======================================================================
       e-Arşiv (Faz 8a)
       ====================================================================== */
    /**
     * e-Arşiv faturası gönderir.
     *
     * ⚠️ **Mali sonuç doğurur.** e-Arşiv, e-Fatura mükellefi olmayan alıcıya kesilir;
     * GİB'e rapor olarak bildirilir ve iptali ancak "iptal bildirimi" ile yapılır.
     *
     * Akış e-Fatura taslağıyla aynı disiplinde:
     * numara tekilliği → UBL üret → `invoice_check_validate` → geçtiyse gönder.
     */
    /* ======================================================================
       Gönderim öncesi kontör kontrolü
       ====================================================================== */
    /**
     * `Get_Credit` cevabından kalan kontörü **ihtiyatlı** biçimde okur.
     *
     * ICE bu ucu dinamik bir DataSet olarak döndürüyor; kolon adları sözleşmede
     * sabit değil. Bu yüzden rastgele bir kolona güvenmek yerine:
     *
     *  - Kolon adı `kalan` / `kontor` / `bakiye` / `adet` / `miktar` kalıplarından
     *    birine uyan **ve** sayısal olan alanlar aranır.
     *  - Birden çok aday varsa **en küçüğü** esas alınır (en kısıtlayıcı olan).
     *  - Hiçbir aday bulunamazsa `okunabildi: false` döner — **uydurma yapılmaz**.
     *
     * Bu bir tahmin katmanıdır; gerçek kolon adları canlı örnekle teyit edilene
     * kadar sonucu **engelleyici** değil **uyarıcı** olarak kullanıyoruz (aşağıya bkz.).
     */
    static kontorOku(satirlar) {
        const kalip = /(kalan|kontor|kontör|bakiye|adet|miktar|credit|remain)/i;
        const adaylar = [];
        for (const satir of satirlar || []) {
            if (!satir || typeof satir !== "object")
                continue;
            for (const [alan, ham] of Object.entries(satir)) {
                if (!kalip.test(alan))
                    continue;
                const sayi = Number(String(ham ?? "").replace(",", "."));
                if (Number.isFinite(sayi))
                    adaylar.push({ alan, deger: sayi });
            }
        }
        if (!adaylar.length)
            return { okunabildi: false, kalan: null, kaynakAlan: null };
        const enKisitlayici = adaylar.reduce((a, b) => (b.deger < a.deger ? b : a));
        return { okunabildi: true, kalan: enKisitlayici.deger, kaynakAlan: enKisitlayici.alan };
    }
    /**
     * Gönderim öncesi kontör kontrolü.
     *
     * **Tasarım kararı — neden engellemiyor:** kontör gerçekten bittiyse ICE zaten
     * gönderimi reddeder; asıl risk, kolon adını yanlış okuyup **geçerli bir gönderimi
     * boş yere durdurmaktır**. Bu yüzden yalnızca kontör *güvenle* okunabildiyse ve
     * sıfır/negatifse durdurulur. Okunamazsa gönderim sürer, sonuç `uyari` ile bildirilir.
     */
    static async kontorOnKontrol(config, dbContext, kullanici) {
        let satirlar = [];
        try {
            satirlar = await this.fetchKontor(config, dbContext, kullanici);
        }
        catch (err) {
            logger.warn("Gönderim öncesi kontör sorgusu başarısız:", err);
            return { kalan: null, uyari: "Kontör bilgisi okunamadı; gönderim kontör kontrolü olmadan sürdürüldü." };
        }
        const { okunabildi, kalan, kaynakAlan } = this.kontorOku(satirlar);
        if (!okunabildi) {
            return {
                kalan: null,
                uyari: "Kontör cevabında tanınan bir 'kalan' alanı bulunamadı; gönderim kontör kontrolü olmadan sürdürüldü.",
            };
        }
        if (kalan !== null && kalan <= 0) {
            throw ApiError.unprocessable(`Entegratör kontörünüz tükenmiş görünüyor (${kaynakAlan}: ${kalan}). ` +
                `Belge gönderilmedi; ICE ile kontör yükleyip tekrar deneyiniz.`);
        }
        return { kalan, uyari: null };
    }
    /* ======================================================================
       e-Gider Pusulası (Faz 8d)
       ====================================================================== */
    /**
     * e-Gider Pusulası gönderir.
     *
     * ⚠️ **Mali sonuç doğurur ve ön doğrulaması yoktur.**
     * Canlı WSDL'de gider pusulası için `*_check_validate` ucu bulunmuyor
     * (yalnızca invoice / despatchadvice / producerreceipt var). Bu yüzden
     * e-Arşiv akışındaki "önce ICE'ye doğrulat" adımı burada uygulanamıyor;
     * yerel UBL doğrulaması tek savunma hattıdır.
     *
     * Akış: yerel numara ön kontrolü → UBL üret (yerel doğrulama) →
     * karşı taraf mükellef mi? → ICE son sıra kontrolü → **SQL rezervasyonu** →
     * gönderim → sonucu belge bazında doğrula.
     */
    static async giderPusulasiOnizle(girdi, dbContext) {
        if ((girdi.paraBirimi || "TRY") !== "TRY")
            throw ApiError.badRequest("Yalnızca TRY destekleniyor.");
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { ozet } = buildGiderPusulasiXml({ ...girdi, gonderici });
        return { ozet, iceDogrulamasiYapildi: false };
    }
    static async giderPusulasiGonder(girdi, kullanici, dbContext) {
        const belgeNo = girdi.belgeNo.trim().toUpperCase();
        const tarih = girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
        girdi = { ...girdi, belgeNo, tarih };
        if ((girdi.paraBirimi || "TRY").toUpperCase() !== "TRY") {
            throw ApiError.unprocessable("Gider pusulası gönderimi şu anda yalnızca TRY cinsinden destekleniyor; döviz kuru alanları henüz uygulanmadı.");
        }
        if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
            throw ApiError.conflict(`${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`);
        }
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, ozet } = buildGiderPusulasiXml({ ...girdi, belgeNo, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        // Karşı taraf e-Fatura mükellefi ise gider pusulası düzenlenmemelidir.
        const mukellef = await getUserListEFatura(config, girdi.alici.vknTckn);
        if (!mukellef.basarili) {
            throw ApiError.unprocessable(mukellef.mesaj || "Karşı tarafın mükellef durumu doğrulanamadı; gönderim durduruldu.");
        }
        if (mukellef.kullanicilar.length) {
            throw ApiError.unprocessable("Karşı taraf e-Fatura mükellefi görünüyor. Mükelleften alımda gider pusulası değil fatura düzenlenmelidir.");
        }
        const son = await getSonBelgeId(config, belgeNo.slice(0, 3), "EGiderPusulasi", Number(belgeNo.slice(3, 7)));
        const sonSira = Number(son?.Son_Belge_ID);
        if (son?.Son_Belge_ID == null ||
            String(son.Son_Belge_ID).trim() === "" ||
            !Number.isInteger(sonSira) ||
            sonSira < 0) {
            throw ApiError.unprocessable("ICE son belge numarası doğrulanamadı; gönderim durduruldu.");
        }
        if (Number(belgeNo.slice(7)) <= sonSira) {
            throw ApiError.conflict("Belge numarası ICE'de kullanılan son sıradan büyük olmalıdır.");
        }
        // Kontör tükenmişse belge numarasını yakmadan dur
        const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);
        // ICE yazma çağrısından ÖNCE kalıcı yer tut.
        await EbelgeSqlRepository.insertGiden({
            uuid,
            belgeNo,
            belgeTuru: "EGiderPusulasi",
            profil: "GIDERPUSULASI",
            faturaTipi: girdi.belgeTipi,
            taslakMi: false,
            aliciVkn: girdi.alici.vknTckn,
            aliciAlias: null,
            aliciUnvan: girdi.alici.unvan ||
                [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") ||
                null,
            duzenlemeTarihi: new Date(tarih),
            tutar: ozet.odenecekTutar,
            paraBirimi: girdi.paraBirimi || "TRY",
            gonderimDurumu: "GONDERILIYOR",
            // Ön doğrulama ucu olmadığı için bu bayraklar bilinmiyor — false değil, NULL
            semaGecerli: null,
            schematronGecerli: null,
            iceResponseMesaj: "Gönderim başlatıldı (ön doğrulama ucu yok). Sonuç kesinleşmeden yeniden göndermeyiniz.",
            xmlIcerik: xml,
            olusturan: kullanici,
            gonderen: kullanici,
            gonderimTarihi: new Date(),
        }, dbContext);
        let sonuc;
        try {
            sonuc = await sendGiderPusulasi(config, [toBase64(xml)]);
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", "BELIRSIZ", {
                mesaj: "ICE gönderim sonucu alınamadı. Aynı belgeyi yeni numarayla da göndermeyiniz; ICE portalinden kontrol ediniz.",
            }, dbContext).catch(() => undefined);
            throw ApiError.conflict(`Gönderim sonucu belirsiz (UUID: ${uuid}). Giden kutusu ve ICE portalini kontrol ediniz; yeniden göndermeyiniz.`);
        }
        const satirlar = gonderimSatirlari(sonuc);
        const ilk = satirlar[0];
        const dogru = (v) => String(v).toLowerCase() === "true";
        const basarili = dogru(sonuc.success) &&
            satirlar.length === 1 &&
            dogru(ilk?.success) &&
            String(ilk?.ettn || "").toLowerCase() === uuid.toLowerCase() &&
            ilk?.ID === belgeNo;
        const acikRed = String(sonuc.success).toLowerCase() === "false" ||
            (satirlar.length === 1 && String(ilk?.success).toLowerCase() === "false");
        const durum = basarili ? "GONDERILDI" : acikRed ? "HATA" : "BELIRSIZ";
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", durum, {
            kod: String(sonuc.response_code ?? ""),
            mesaj: durum === "BELIRSIZ"
                ? "ICE cevabı belgeyi kesin olarak doğrulamıyor; portalden kontrol ediniz."
                : ilk?.response_message || sonuc.response_message || durum,
        }, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "send_egider_pusulasi",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${belgeNo} tip=${girdi.belgeTipi} tutar=${ozet.odenecekTutar}`,
            cevapOzet: `durum=${durum} ${sonuc.response_message || ""}`,
        }, dbContext);
        if (!basarili) {
            throw ApiError.conflict(durum === "BELIRSIZ"
                ? "Gönderim sonucu belirsiz; ICE portalinden kontrol ediniz. Yeniden göndermeyiniz."
                : ilk?.response_message || sonuc.response_message || "Gider pusulası gönderimi reddedildi.");
        }
        return {
            uuid,
            belgeNo,
            durum: "GONDERILDI",
            mesaj: sonuc.response_message?.trim() || "",
            tutar: ozet.odenecekTutar,
            onDogrulamaYapildi: false,
            kontorKalan: kontor.kalan,
            kontorUyari: kontor.uyari,
        };
    }
    /** Gönderilmiş gider pusulasının PDF çıktısı */
    static async giderPusulasiPdf(uuid, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        if (kayit.belgeTuru !== "EGiderPusulasi") {
            throw ApiError.badRequest("Bu işlem yalnızca e-Gider Pusulası belgeleri içindir.");
        }
        if (kayit.gonderimDurumu !== "GONDERILDI") {
            throw ApiError.badRequest(`Yalnızca gönderimi kesinleşmiş belgelerin çıktısı alınabilir. Durum: ${kayit.gonderimDurumu}`);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const { pdf } = await getGiderPusulasiCikti(config, uuid, { pdf: true });
        await EbelgeSqlRepository.writeLog({
            metod: "Get_EGiderPusulasi_HTML_PDF",
            yon: "GIDEN",
            basarili: Boolean(pdf?.length),
            kullanici,
            ilgiliUuid: uuid,
            cevapOzet: `${pdf?.length ?? 0} bayt`,
        }, dbContext);
        if (!pdf?.length)
            throw ApiError.notFound("Belgenin PDF çıktısı alınamadı.");
        return pdf;
    }
    static async mustahsilDogrula(girdi, dbContext) {
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, ozet } = buildMustahsilXml({ ...girdi, gonderici });
        const sonuc = await validateMustahsil(await EbelgeSqlRepository.getConnectionConfig(dbContext), toBase64(xml), true);
        const sema = String(sonuc.shema_validate).toLowerCase() === "true", schematron = String(sonuc.shematron_validate).toLowerCase() === "true";
        if (!sema || !schematron)
            throw ApiError.unprocessable(sonuc.response_message || "e-Müstahsil şema/schematron doğrulamasından geçemedi.");
        return { uuid, belgeNo: girdi.belgeNo.toUpperCase(), semaGecerli: sema, schematronGecerli: schematron, html: sonuc.producerreceipt_html || null, ozet };
    }
    static async mustahsilGonder(girdi, kullanici, dbContext) {
        const belgeNo = girdi.belgeNo.trim().toUpperCase();
        if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext))
            throw ApiError.conflict("Bu müstahsil makbuzu numarası daha önce kullanılmış.");
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext), uretilen = buildMustahsilXml({ ...girdi, belgeNo, gonderici });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext), kontrol = await validateMustahsil(config, toBase64(uretilen.xml), false);
        if (String(kontrol.shema_validate).toLowerCase() !== "true" || String(kontrol.shematron_validate).toLowerCase() !== "true")
            throw ApiError.unprocessable(kontrol.response_message || "e-Müstahsil doğrulanamadı; gönderilmedi.");
        await EbelgeSqlRepository.insertGiden({ uuid: uretilen.uuid, belgeNo, belgeTuru: "EMustahsil", profil: "EARSIVBELGE", faturaTipi: "MUSTAHSILMAKBUZ", taslakMi: false,
            aliciVkn: girdi.uretici.vknTckn, aliciUnvan: girdi.uretici.unvan || [girdi.uretici.ad, girdi.uretici.soyad].filter(Boolean).join(" "), duzenlemeTarihi: new Date(girdi.tarih || new Date()),
            tutar: uretilen.ozet.netOdenecek, paraBirimi: "TRY", gonderimDurumu: "GONDERILIYOR", iceResponseMesaj: "Gönderim başlatıldı; sonuç kesinleşmeden tekrarlamayın.", olusturan: kullanici, gonderen: kullanici, gonderimTarihi: new Date() }, dbContext);
        let sonuc;
        try {
            sonuc = await sendMustahsil(config, toBase64(uretilen.xml));
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uretilen.uuid, "GONDERILIYOR", "BELIRSIZ", { mesaj: "ICE sonucu alınamadı; portalden kontrol edin." }, dbContext, "EMustahsil").catch(() => undefined);
            throw ApiError.conflict(`Gönderim sonucu belirsiz (ETTN: ${uretilen.uuid}); yeniden göndermeyiniz.`);
        }
        const ss = gonderimSatirlari(sonuc), ilk = ss[0], dogru = (v) => String(v).toLowerCase() === "true";
        const basarili = dogru(sonuc.success) && ss.length === 1 && dogru(ilk?.success) && dogru(ilk?.shema_is_validate) && dogru(ilk?.schematron_is_validate) && String(ilk?.ettn || "").toLowerCase() === uretilen.uuid.toLowerCase() && ilk?.ID === belgeNo;
        const acikRed = String(sonuc.success).toLowerCase() === "false" || (ss.length === 1 && String(ilk?.success).toLowerCase() === "false"), durum = basarili ? "GONDERILDI" : acikRed ? "HATA" : "BELIRSIZ";
        await EbelgeSqlRepository.earsivDurumGecir(uretilen.uuid, "GONDERILIYOR", durum, { kod: String(sonuc.response_code ?? ""), mesaj: ilk?.response_message || sonuc.response_message || durum }, dbContext, "EMustahsil");
        await EbelgeSqlRepository.writeLog({ metod: "send_emustahsil", yon: "GIDEN", basarili, kullanici, ilgiliUuid: uretilen.uuid, istekOzet: `belgeNo=${belgeNo} net=${uretilen.ozet.netOdenecek}`, cevapOzet: `durum=${durum}` }, dbContext);
        if (!basarili)
            throw ApiError.conflict(durum === "BELIRSIZ" ? "Gönderim sonucu belirsiz; yeniden göndermeyiniz." : ilk?.response_message || sonuc.response_message || "e-Müstahsil reddedildi.");
        return { uuid: uretilen.uuid, belgeNo, durum, mesaj: sonuc.response_message || "", ozet: uretilen.ozet };
    }
    static async mustahsilIptal(uuid, tarih, kullanici, dbContext) {
        const k = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!k || k.belgeTuru !== "EMustahsil")
            throw ApiError.notFound("e-Müstahsil bulunamadı.");
        if (k.gonderimDurumu !== "GONDERILDI")
            throw ApiError.conflict("Yalnız gönderilmiş e-Müstahsil iptal edilebilir.");
        let s;
        try {
            s = await cancelMustahsil(await EbelgeSqlRepository.getConnectionConfig(dbContext), k.belgeNo, tarih.toISOString());
        }
        catch {
            throw ApiError.conflict("İptal sonucu belirsiz; tekrar iptal göndermeyiniz.");
        }
        if (!s.basarili)
            throw ApiError.conflict(s.mesaj || "İptal reddedildi.");
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILDI", "IPTAL", { mesaj: s.mesaj, kullanici, iptalTarihi: tarih }, dbContext, "EMustahsil");
        return { uuid, durum: "IPTAL", mesaj: s.mesaj };
    }
    static async mustahsilGelen(f, kullanici, dbContext) { const x = await getProducerReceipts(await EbelgeSqlRepository.getConnectionConfig(dbContext), f); await EbelgeSqlRepository.writeLog({ metod: "GetProducerReceipt", yon: "GELEN", basarili: true, kullanici, cevapOzet: `adet=${x.length}` }, dbContext); return x; }
    static async mustahsilGelenStatu(uuid, statu, kullanici, dbContext) { const ok = await setProducerReceiptStatus(await EbelgeSqlRepository.getConnectionConfig(dbContext), uuid, statu); if (!ok)
        throw ApiError.unprocessable("ICE durum değişikliğini kabul etmedi."); await EbelgeSqlRepository.writeLog({ metod: "Set_ProducerReceipt_Status", yon: "GELEN", basarili: true, kullanici, ilgiliUuid: uuid, istekOzet: `statu=${statu}` }, dbContext); return { uuid, statu }; }
    static async earsivGonder(girdi, kullanici, dbContext) {
        const belgeNo = girdi.belgeNo.trim().toUpperCase();
        girdi = { ...girdi, belgeNo, tarih: girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) };
        // Üreteç artık istisna, tevkifat, iade referansı ve döviz kurunu destekliyor.
        // Özel matrah hâlâ desteklenmiyor; yapısı doğrulanmış örnekle eklenecek.
        if (girdi.faturaTipi === "OZELMATRAH") {
            throw ApiError.unprocessable("Özel matrah faturası bu üreteçte henüz desteklenmiyor. Yapısı doğrulanmış bir GİB/ICE örneğiyle eklenecektir.");
        }
        if (girdi.faturaTipi === "IHRACKAYITLI") {
            throw ApiError.unprocessable("İhraç kayıtlı fatura bu üreteçte henüz desteklenmiyor; e-Arşiv akışında da beklenen bir tip değildir.");
        }
        if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
            throw ApiError.conflict(`${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`);
        }
        // e-Arşiv senaryosu zorunlu — yanlış profille gönderim engellenir
        const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
        const { xml, uuid, ozet } = buildInvoiceXml({
            ...girdi,
            belgeNo,
            gonderici,
            senaryo: "EARSIVFATURA",
        });
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        // 1) Doğrulama — geçmezse gönderim yok
        const dogrulama = await invoiceCheckValidate(config, toBase64(xml), { html: false, pdf: false });
        const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
        const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";
        if (!semaGecerli || !schematronGecerli) {
            throw ApiError.unprocessable(dogrulama?.response_message?.trim() ||
                "Belge şema/schematron doğrulamasından geçemedi; e-Arşiv gönderilmedi.");
        }
        // Başarısız mükellef sorgusu, "mükellef değil" anlamına gelmez.
        const mukellef = await getUserListEFatura(config, girdi.alici.vknTckn);
        if (!mukellef.basarili) {
            throw ApiError.unprocessable(mukellef.mesaj || "Alıcının mükellef durumu doğrulanamadı; gönderim durduruldu.");
        }
        if (mukellef.kullanicilar.length) {
            throw ApiError.unprocessable("Alıcı e-Fatura mükellefi; bu akıştan e-Arşiv gönderilemez.");
        }
        const son = await getSonBelgeId(config, belgeNo.slice(0, 3), "EArsiv", Number(belgeNo.slice(3, 7)));
        const sonSira = Number(son?.Son_Belge_ID);
        if (son?.Son_Belge_ID == null || String(son.Son_Belge_ID).trim() === "" || !Number.isInteger(sonSira) || sonSira < 0) {
            throw ApiError.unprocessable("ICE son belge numarası doğrulanamadı; gönderim durduruldu.");
        }
        if (Number(belgeNo.slice(7)) <= sonSira) {
            throw ApiError.conflict("Fatura numarası ICE'de kullanılan son sıradan büyük olmalıdır.");
        }
        // Kontör tükenmişse belge numarasını yakmadan dur
        const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);
        // ICE yazma çağrısından ÖNCE kalıcı yer tut. UNIQUE indeks yarışan isteği durdurur.
        await EbelgeSqlRepository.insertGiden({
            uuid,
            belgeNo,
            belgeTuru: "EArsiv",
            profil: "EARSIVFATURA",
            faturaTipi: girdi.faturaTipi,
            taslakMi: false,
            aliciVkn: girdi.alici.vknTckn,
            aliciAlias: null,
            aliciUnvan: girdi.alici.unvan || [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") || null,
            duzenlemeTarihi: girdi.tarih ? new Date(girdi.tarih) : new Date(),
            tutar: ozet.odenecekTutar,
            paraBirimi: girdi.paraBirimi || "TRY",
            gonderimDurumu: "GONDERILIYOR",
            semaGecerli,
            schematronGecerli,
            iceResponseMesaj: "Gönderim başlatıldı. Sonuç kesinleşmeden yeniden göndermeyiniz.",
            xmlIcerik: xml,
            olusturan: kullanici,
            gonderen: kullanici,
            gonderimTarihi: new Date(),
        }, dbContext);
        let sonuc;
        try {
            sonuc = await sendEarsiv(config, [toBase64(xml)]);
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", "BELIRSIZ", {
                mesaj: "ICE gönderim sonucu alınamadı. Aynı belgeyi yeni numarayla da göndermeyiniz; ICE portalinden ETTN ile kontrol ediniz.",
            }, dbContext).catch(() => undefined);
            throw ApiError.conflict(`Gönderim sonucu belirsiz (ETTN: ${uuid}). Giden kutusu ve ICE portalini kontrol ediniz; yeniden göndermeyiniz.`);
        }
        const satirlar = gonderimSatirlari(sonuc);
        const ilk = satirlar[0];
        const dogru = (v) => String(v).toLowerCase() === "true";
        const basarili = dogru(sonuc.success) && satirlar.length === 1 && dogru(ilk?.success) &&
            dogru(ilk?.shema_is_validate) && dogru(ilk?.schematron_is_validate) &&
            String(ilk?.ettn || "").toLowerCase() === uuid.toLowerCase() && ilk?.ID === belgeNo;
        const acikRed = String(sonuc.success).toLowerCase() === "false" ||
            (satirlar.length === 1 && String(ilk?.success).toLowerCase() === "false");
        const durum = basarili ? "GONDERILDI" : acikRed ? "HATA" : "BELIRSIZ";
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILIYOR", durum, {
            kod: String(sonuc.response_code ?? ""),
            mesaj: durum === "BELIRSIZ" ? "ICE cevabı belgeyi kesin olarak doğrulamıyor; portalden ETTN ile kontrol ediniz." :
                ilk?.response_message || sonuc.response_message || durum,
        }, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "send_earsiv", yon: "GIDEN", basarili, kullanici, ilgiliUuid: uuid,
            istekOzet: `belgeNo=${belgeNo} tutar=${ozet.odenecekTutar}`,
            cevapOzet: `durum=${durum} ${sonuc.response_message || ""}`,
        }, dbContext);
        if (!basarili) {
            throw ApiError.conflict(durum === "BELIRSIZ" ? "Gönderim sonucu belirsiz; ICE portalinden kontrol ediniz. Yeniden göndermeyiniz." :
                ilk?.response_message || sonuc.response_message || "e-Arşiv gönderimi reddedildi.");
        }
        return {
            uuid,
            belgeNo,
            ettn: uuid,
            durum: "GONDERILDI",
            mesaj: sonuc?.response_message?.trim() || "",
            tutar: ozet.odenecekTutar,
            kontorKalan: kontor.kalan,
            kontorUyari: kontor.uyari,
        };
    }
    /**
     * e-Arşiv faturası için GİB'e iptal bildirimi gönderir.
     * ⚠️ Belgeyi silmez; iptal edildiğini raporlar. Geri alınamaz.
     */
    static async earsivIptal(uuid, iptalTarihi, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        if (kayit.belgeTuru !== "EArsiv") {
            throw ApiError.badRequest("Bu işlem yalnızca e-Arşiv faturaları içindir.");
        }
        if (kayit.gonderimDurumu === "IPTAL") {
            throw ApiError.conflict("Bu belge için iptal bildirimi zaten gönderilmiş.");
        }
        if (kayit.gonderimDurumu !== "GONDERILDI") {
            throw ApiError.badRequest(`Yalnızca gönderilmiş e-Arşiv faturaları iptal edilebilir. Durum: ${kayit.gonderimDurumu}`);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const duzenleme = new Date(kayit.DUZENLEME_TARIHI);
        if (!Number.isFinite(iptalTarihi.getTime()) || !Number.isFinite(duzenleme.getTime()) ||
            iptalTarihi.toISOString().slice(0, 10) < duzenleme.toISOString().slice(0, 10) ||
            iptalTarihi.toISOString().slice(0, 10) > new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
            throw ApiError.badRequest("İptal tarihi düzenleme tarihinden önce veya bugünden sonra olamaz.");
        }
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILDI", "IPTAL_EDILIYOR", {}, dbContext);
        let sonuc;
        try {
            sonuc = await sendEarsivIptal(config, kayit.belgeNo, iptalTarihi);
        }
        catch {
            await EbelgeSqlRepository.earsivDurumGecir(uuid, "IPTAL_EDILIYOR", "IPTAL_BELIRSIZ", {
                mesaj: "İptal sonucu alınamadı. ICE portalinden kontrol edilmeden tekrar iptal göndermeyiniz.",
            }, dbContext).catch(() => undefined);
            throw ApiError.conflict("İptal sonucu belirsiz; ICE portalinden kontrol ediniz. Tekrar iptal göndermeyiniz.");
        }
        const basarili = String(sonuc?.success).toLowerCase() === "true";
        const acikRed = String(sonuc?.success).toLowerCase() === "false";
        await EbelgeSqlRepository.earsivDurumGecir(uuid, "IPTAL_EDILIYOR", basarili ? "IPTAL" : acikRed ? "GONDERILDI" : "IPTAL_BELIRSIZ", { mesaj: sonuc.response_message, kullanici, iptalTarihi }, dbContext);
        await EbelgeSqlRepository.writeLog({
            metod: "send_earsiv_iptal",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${kayit.belgeNo} iptalTarihi=${iptalTarihi.toISOString().slice(0, 10)}`,
            cevapOzet: sonuc?.response_message || undefined,
        }, dbContext);
        if (!basarili) {
            throw ApiError.badRequest(sonuc?.response_message?.trim() || "İptal bildirimi gönderilemedi.");
        }
        return {
            uuid,
            durum: "IPTAL",
            mesaj: sonuc?.response_message?.trim() || "İptal bildirimi gönderildi.",
        };
    }
    /**
     * e-Arşiv raporlanma ve e-posta durumunu sorgular.
     * e-Arşiv'de belgenin GİB'e ulaşması **rapora** bağlıdır.
     */
    static async earsivDurum(ettnler, kullanici, dbContext) {
        if (!ettnler.length)
            throw ApiError.badRequest("En az bir ETTN gereklidir.");
        if (ettnler.length > 100)
            throw ApiError.badRequest("Bir seferde en fazla 100 belge sorgulanabilir.");
        for (const ettn of ettnler) {
            const kayit = await EbelgeSqlRepository.getGiden(ettn, dbContext);
            if (!kayit || kayit.belgeTuru !== "EArsiv")
                throw ApiError.notFound("e-Arşiv kaydı bulunamadı.");
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const hatalar = [];
        const [rapor, mail] = await Promise.all([
            getEarsivRaporStatu(config, ettnler).catch((err) => {
                logger.warn("GetInvoice_Rapor_Statu başarısız:", err);
                hatalar.push("Rapor durumu alınamadı. Tekrar sorgulayınız.");
                return [];
            }),
            getEarsivMailStatu(config, ettnler).catch((err) => {
                logger.warn("GetInvoice_EMail_Statu başarısız:", err);
                hatalar.push("E-posta durumu alınamadı. Tekrar sorgulayınız.");
                return [];
            }),
        ]);
        await EbelgeSqlRepository.writeLog({
            metod: "EARSIV_DURUM",
            yon: "GIDEN",
            basarili: hatalar.length === 0,
            kullanici,
            istekOzet: `${ettnler.length} belge`,
        }, dbContext);
        if (hatalar.length === 2)
            throw ApiError.unprocessable(hatalar.join(" "));
        return { rapor, mail, hatalar };
    }
    static async senkronizeEarsivArsiv(filtre, kullanici, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const belgeler = await getEArchive(config, filtre);
        let yazilan = 0;
        let atlanan = 0;
        for (const belge of belgeler) {
            const h = belge.HEADER;
            const uuid = String(belge.UUID || "").trim();
            const no = String(belge.ID || "").trim();
            const tarih = parseIceDate(h?.ISSUE_DATE);
            const tutar = parseAmount(h?.PAYABLE_AMOUNT);
            if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uuid) || !no || no.length > 40 ||
                !h || !tarih || (tutar !== null && !Number.isFinite(tutar))) {
                atlanan++;
                continue;
            }
            await EbelgeSqlRepository.upsertEarsivArsiv({
                uuid, belgeNo: no, tarih, tutar,
                aliciVkn: h.CUSTOMER || null, aliciUnvan: h.CUSTOMER_TITLE || null,
                gondericiVkn: h.SUPPLIER || null, gondericiUnvan: h.SUPPLIER_TITLE || null,
                paraBirimi: parseCurrency(h.PAYABLE_AMOUNT), profil: h.PROFILEID || null,
                iceStatuKodu: belge.STATUS_CODE == null ? null : String(belge.STATUS_CODE),
                iceStatuAciklama: belge.STATUS_DESCRIPTION || null,
            }, dbContext);
            yazilan++;
        }
        const siniraUlasildi = belgeler.length >= filtre.limit;
        await EbelgeSqlRepository.writeLog({ metod: "GetEArchive", yon: "GELEN", kullanici,
            basarili: atlanan === 0, cevapOzet: `cekilen=${belgeler.length} yazilan=${yazilan} atlanan=${atlanan} limit=${siniraUlasildi}`,
        }, dbContext);
        return { cekilen: belgeler.length, yazilan, atlanan, siniraUlasildi,
            uyari: siniraUlasildi ? "ICE sorgu sınırına ulaşıldı. Tüm belgeler alınmış olmayabilir; tarih aralığını daraltınız." : null };
    }
    static async earsivArsivIsaretle(uuid, statu, kullanici, dbContext) {
        if (!await EbelgeSqlRepository.earsivArsivVarMi(uuid, dbContext))
            throw ApiError.notFound("Arşiv kaydı bulunamadı; önce senkronize ediniz.");
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const basarili = await setEArchiveStatus(config, uuid, statu);
        await EbelgeSqlRepository.writeLog({ metod: "Set_EArchive_Status", yon: "GIDEN", basarili,
            kullanici, ilgiliUuid: uuid, istekOzet: `statu=${statu}` }, dbContext);
        if (!basarili)
            throw ApiError.unprocessable("ICE arşiv işaretini kabul etmedi.");
        await EbelgeSqlRepository.setEarsivArsivIsaret(uuid, statu, kullanici, dbContext);
        return { uuid, statu };
    }
    /**
     * Gönderilmiş belgeyi alıcıya **e-posta ile gönderir**.
     *
     * `GetInvoice_EMail_Statu` mail *durumunu okur*; bu metot gerçekten **mail gönderir**.
     * Tekrar tekrar çağrılırsa alıcıya birden çok mail gider — bu yüzden ICE çağrısında
     * otomatik yeniden deneme kapalıdır ve ekran iki adımlı onay ister.
     */
    static async belgeMailGonder(uuid, alicilar, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        if (kayit.gonderimDurumu !== "GONDERILDI") {
            throw ApiError.badRequest(`Yalnızca gönderimi kesinleşmiş belgeler için mail gönderilebilir. Durum: ${kayit.gonderimDurumu}`);
        }
        const temizAlicilar = (alicilar || [])
            .map((a) => ({ unvan: a.unvan?.trim(), eposta: a.eposta?.trim() || "" }))
            .filter((a) => a.eposta);
        if (!temizAlicilar.length) {
            throw ApiError.badRequest("En az bir e-posta adresi gereklidir.");
        }
        const gecersiz = temizAlicilar.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.eposta));
        if (gecersiz) {
            throw ApiError.badRequest(`Geçersiz e-posta adresi: ${gecersiz.eposta}`);
        }
        // Belge türünü ICE'nin mail enum'una eşle
        const belgeTuru = kayit.belgeTuru === "EArsiv"
            ? "EArsiv"
            : kayit.belgeTuru === "EFatura"
                ? "EFatura_Giden"
                : kayit.belgeTuru === "EIrsaliye"
                    ? "EIrsaliye_Giden"
                    : kayit.belgeTuru === "EGiderPusulasi"
                        ? "EGiderPusulasi"
                        : "Diger";
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuclar = await sendDocumentEmail(config, [
            { belgeNo: kayit.belgeNo, uuid, belgeTuru, alicilar: temizAlicilar },
        ]);
        const basarili = sonuclar.filter((r) => String(r.Result).toLowerCase() === "true");
        const basarisiz = sonuclar.filter((r) => String(r.Result).toLowerCase() !== "true");
        await EbelgeSqlRepository.writeLog({
            metod: "Send_Document_Email",
            yon: "GIDEN",
            basarili: basarisiz.length === 0 && basarili.length > 0,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `belgeNo=${kayit.belgeNo} tur=${belgeTuru} alici=${temizAlicilar.length}`,
            cevapOzet: `basarili=${basarili.length} basarisiz=${basarisiz.length}`,
        }, dbContext);
        // ICE hiç sonuç döndürmediyse "gitti" sayılmaz
        if (!sonuclar.length) {
            throw ApiError.unprocessable("ICE mail gönderimi için sonuç döndürmedi; gönderildiği doğrulanamadı.");
        }
        if (!basarili.length) {
            throw ApiError.badRequest(basarisiz[0]?.ResultMessage?.trim() || "Mail gönderilemedi.");
        }
        return {
            uuid,
            gonderilen: basarili.length,
            basarisiz: basarisiz.length,
            sonuclar,
        };
    }
    /** Kesilmiş e-Arşiv faturasının PDF görüntüsü */
    static async earsivPdf(uuid, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        if (kayit.belgeTuru !== "EArsiv" || !["GONDERILDI", "IPTAL"].includes(kayit.gonderimDurumu)) {
            throw ApiError.badRequest("PDF yalnızca gönderimi kesinleşmiş e-Arşiv belgelerinde alınabilir.");
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const pdf = await previewInvoice(config, {
            vknTckn: kayit.ALICI_VKN || kayit.aliciVkn || "",
            faturaNo: kayit.belgeNo,
            duzenlenmeTarihi: kayit.DUZENLEME_TARIHI ? new Date(kayit.DUZENLEME_TARIHI) : new Date(),
            odenecekTutar: Number(kayit.TUTAR ?? kayit.tutar ?? 0),
        });
        await EbelgeSqlRepository.writeLog({
            metod: "preview_invoice",
            yon: "GIDEN",
            basarili: pdf.length > 0,
            kullanici,
            ilgiliUuid: uuid,
            cevapOzet: `${pdf.length} bayt`,
        }, dbContext);
        if (!pdf.length)
            throw ApiError.notFound("Belgenin PDF çıktısı alınamadı.");
        return pdf;
    }
    /**
     * Taslağı iptal eder (`DraftCancel`).
     * Bu çağrı GİB'e bir şey göndermez; ICE'deki taslağı siler.
     */
    static async taslakIptal(uuid, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
        if (!kayit)
            throw ApiError.notFound("Giden belge kaydı bulunamadı.");
        if (kayit.gonderimDurumu !== "TASLAK") {
            throw ApiError.badRequest(`Yalnızca taslak durumundaki belgeler iptal edilebilir. Bu belgenin durumu: ${kayit.gonderimDurumu}`);
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const sonuc = await sendDraftDocumentApproval(config, kayit.belgeNo, "EFatura", "DraftCancel");
        const basarili = String(sonuc?.success).toLowerCase() === "true";
        await EbelgeSqlRepository.writeLog({
            metod: "send_draft_document_approval",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `processType=DraftCancel belgeNo=${kayit.belgeNo}`,
            cevapOzet: `${sonuc?.response_message ?? ""} ${sonuc?.response_message_detail ?? ""}`.trim(),
        }, dbContext);
        if (!basarili) {
            throw ApiError.badRequest(sonuc?.response_message?.trim() || "Taslak iptal edilemedi.");
        }
        await EbelgeSqlRepository.setGidenIptal(uuid, kullanici, dbContext);
        return { uuid, durum: "IPTAL", mesaj: sonuc?.response_message?.trim() || "Taslak iptal edildi." };
    }
    /** Giden belge listesi */
    static async listGiden(filtre, dbContext) {
        return EbelgeSqlRepository.listGiden(filtre, dbContext);
    }
    /**
     * ICE tarafındaki son belge numarasını sorar.
     * Kendi numaratörümüzle karşılaştırıp çakışmayı gönderimden önce yakalamak için.
     */
    static async getSonBelgeNo(seri, belgeTuru, yil, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        return getSonBelgeId(config, seri, belgeTuru, yil);
    }
    /* ======================================================================
       Gelen kutusu — cevap ve statü (Faz 4)
       ====================================================================== */
    /**
     * Gelen ticari faturaya **kabul veya red** cevabı gönderir.
     *
     * GERİ ALINAMAZ bir işlemdir. Çift gönderime karşı üç katman:
     *  1. Süreç içi kilit — aynı anda gelen ikinci istek beklemez, reddedilir.
     *  2. Veritabanı "yer tutma" — `RED_KABUL IS NULL` koşuluyla güncelleme;
     *     satır zaten cevaplanmışsa 0 satır etkilenir ve işlem 409 ile durur.
     *  3. ICE çağrısında otomatik yeniden deneme **kapalı**.
     *
     * ICE çağrısı başarısız olursa yerel yer tutma kaydı geri alınır ki
     * kullanıcı işlemi tekrar deneyebilsin.
     */
    static async cevapVer(uuid, redKabul, aciklama, kullanici, dbContext) {
        const kilitAnahtari = `${dbContext?.dbServer || "-"}:${dbContext?.dbName || "-"}:${uuid}`;
        if (cevapKilitleri.has(kilitAnahtari)) {
            throw ApiError.conflict("Bu belge için bir cevap işlemi zaten sürüyor. Lütfen bekleyiniz.");
        }
        cevapKilitleri.add(kilitAnahtari);
        try {
            const kayit = await EbelgeSqlRepository.getGelen(uuid, dbContext);
            if (!kayit) {
                throw ApiError.notFound("Belge yerel kayıtlarda bulunamadı. Önce senkronize ediniz.");
            }
            if (kayit.redKabul) {
                throw ApiError.conflict(`Bu belgeye zaten "${kayit.redKabul}" cevabı verilmiş` +
                    (kayit.redKabulKullanici ? ` (${kayit.redKabulKullanici})` : "") +
                    ". Cevap geri alınamaz.");
            }
            // Temel faturaya kabul/red cevabı verilmez; yalnızca ticari faturaya verilir.
            const profil = String(kayit.profil || "").toUpperCase();
            if (profil.includes("TEMEL")) {
                throw ApiError.badRequest("Temel senaryo faturasına kabul/red cevabı verilemez. Bu işlem yalnızca ticari faturalar içindir.");
            }
            if (redKabul === "Red" && !aciklama.trim()) {
                throw ApiError.badRequest("Red cevabı için açıklama zorunludur.");
            }
            // Bağlantı yapılandırmasını ICE çağrısından ÖNCE al; ayar eksikse
            // yerel kayda hiç dokunmadan hata verelim.
            const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
            // 1) Yerelde yer tut — aynı anda ikinci istek buradan geçemez
            const yerTutuldu = await EbelgeSqlRepository.setGelenRedKabul(uuid, redKabul, aciklama, kullanici, dbContext);
            if (!yerTutuldu) {
                throw ApiError.conflict("Bu belgeye bu sırada başka bir kullanıcı cevap verdi.");
            }
            // 2) ICE'ye gönder — başarısız olursa yer tutmayı geri al
            try {
                const sonuc = await invoiceRedKabul(config, uuid, redKabul, aciklama);
                const basarili = String(sonuc?.success).toLowerCase() === "true";
                if (!basarili) {
                    throw ApiError.badRequest(sonuc?.response_message?.trim() || "Entegratör cevabı reddetti.");
                }
                await EbelgeSqlRepository.writeLog({
                    metod: "invoice_Red_Kabul",
                    yon: "GIDEN",
                    basarili: true,
                    kullanici,
                    ilgiliUuid: uuid,
                    istekOzet: `redKabul=${redKabul}`,
                    cevapOzet: sonuc?.response_message || undefined,
                }, dbContext);
            }
            catch (err) {
                await EbelgeSqlRepository.clearGelenRedKabul(uuid, dbContext).catch(() => undefined);
                await EbelgeSqlRepository.writeLog({
                    metod: "invoice_Red_Kabul",
                    yon: "GIDEN",
                    basarili: false,
                    kullanici,
                    ilgiliUuid: uuid,
                    istekOzet: `redKabul=${redKabul}`,
                    hataMesaji: err?.message || "Bilinmeyen hata",
                }, dbContext);
                throw err;
            }
            return (await EbelgeSqlRepository.getGelen(uuid, dbContext));
        }
        finally {
            cevapKilitleri.delete(kilitAnahtari);
        }
    }
    /**
     * Belgenin okundu / işlendi statüsünü ICE tarafında işaretler.
     */
    static async statuIsle(uuid, statu, kullanici, dbContext) {
        const kayit = await EbelgeSqlRepository.getGelen(uuid, dbContext);
        if (!kayit) {
            throw ApiError.notFound("Belge yerel kayıtlarda bulunamadı.");
        }
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const basarili = await setInvoiceStatus(config, uuid, statu);
        await EbelgeSqlRepository.writeLog({
            metod: "Set_Invoice_Status",
            yon: "GIDEN",
            basarili,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `statu=${statu}`,
        }, dbContext);
        if (!basarili) {
            throw ApiError.badRequest("Entegratör statü güncellemesini kabul etmedi.");
        }
        await EbelgeSqlRepository.setGelenOkunmaDurumu(uuid, {
            okunduMu: statu === "Okundu" ? true : statu === "Okunmadı" ? false : undefined,
            islendiMi: statu === "Islendi" ? true : statu === "Islenmedi" ? false : undefined,
        }, dbContext);
        return (await EbelgeSqlRepository.getGelen(uuid, dbContext));
    }
    /**
     * Belgenin HTML çıktısı.
     *
     * DİKKAT: Bu HTML'i ICE üretiyor, yani bizim denetimimizde değil.
     * Frontend onu ASLA dangerouslySetInnerHTML ile basmaz; sandbox'lı iframe'e
     * srcdoc olarak verir (docs/ice-baglanti.md §11.1 S5).
     */
    static async getGelenHtml(uuid, kullanici, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const html = await getInvoiceHtml(config, uuid);
        await EbelgeSqlRepository.writeLog({ metod: "GetInvoice_HTML", yon: "GELEN", basarili: true, kullanici, ilgiliUuid: uuid }, dbContext);
        if (!html.trim()) {
            throw ApiError.notFound("Belgenin HTML çıktısı entegratörden alınamadı.");
        }
        return html;
    }
    /**
     * Belgenin PDF çıktısı. Base64 gövde JSON içinde taşınmaz;
     * denetleyici bunu doğrudan application/pdf olarak akıtır (§11.1 S10).
     */
    static async getGelenPdf(uuid, kullanici, dbContext) {
        const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
        const pdf = await getInvoicePdf(config, uuid);
        await EbelgeSqlRepository.writeLog({
            metod: "GetInvoice_PDF",
            yon: "GELEN",
            basarili: pdf.length > 0,
            kullanici,
            ilgiliUuid: uuid,
            cevapOzet: `${pdf.length} bayt`,
        }, dbContext);
        if (!pdf.length) {
            throw ApiError.notFound("Belgenin PDF çıktısı entegratörden alınamadı.");
        }
        return pdf;
    }
}
/**
 * .NET DataSet (diffgram) cevabından satırları çıkarır.
 * Yapı sürüme göre değişebildiği için, içindeki ilk nesne dizisi aranır.
 */
export const extractDataSetRows = (node) => {
    if (!node)
        return [];
    const aday = node?.diffgram?.NewDataSet?.Table ?? node?.NewDataSet?.Table ?? node?.Table;
    if (aday) {
        return Array.isArray(aday) ? aday : [aday];
    }
    // Yapı beklenenden farklıysa özyinelemeli ara
    const gez = (deger, derinlik) => {
        if (derinlik > 6 || !deger || typeof deger !== "object")
            return null;
        if (Array.isArray(deger)) {
            return deger.every((x) => x && typeof x === "object") ? deger : null;
        }
        for (const value of Object.values(deger)) {
            const bulunan = gez(value, derinlik + 1);
            if (bulunan && bulunan.length)
                return bulunan;
        }
        return null;
    };
    const bulunan = gez(node, 0);
    if (bulunan)
        return bulunan;
    logger.warn("Get_Credit cevabı beklenen DataSet yapısında değil.");
    return [];
};
