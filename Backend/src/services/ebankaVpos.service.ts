import { HttpStatus } from "../constants/httpStatusCodes.js";
import { EBankaAktarimSqlRepository } from "../models/ebankaAktarimSql.repository.js";
import { DbContext, EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { EBankaVposSqlRepository, VposIslem, VposLink } from "../models/ebankaVposSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { BankaService } from "./banka.service.js";
import { VomsisClient } from "./vomsis/vomsis.client.js";

// F- e-Banka Faz 4 — Sanal POS: ödeme linkleri, işlemler, iptal/iade (docs/EBANKA_VOMSIS_YOL_HARITASI.md)
//  E10  ödeme/link cariye bağlı başlar          E18  başarılı tahsilat = ayarlardaki banka hesabına "0- Havale Alma"
//  E20  fişe asıl tutar (amount) yazılır         E25  iptal → asıl fiş iptal; iade → iade tutarı kadar "1- Gönderme" fişi
//  Test (örnek veri) modunda hiçbir zaman fiş kesilmez.

const HAVALE_ALMA = 0;
const HAVALE_GONDERME = 1;
const PARA_BIRIMLERI = ["TRY", "USD", "EUR"];
const EN_COK_SAYFA = 50;

const kirp = (v: unknown): string => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim());
const gunMu = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const bugun = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Vomsis link durumu "Paid" (detay) ya da Türkçe "Ödendi" (liste) gelebilir; "Ödenmedi" ödenmiş sayılmaz. */
export const odendiMi = (durum: unknown): boolean => {
  const s = kirp(durum).toLocaleLowerCase("tr");
  if (!s || s.includes("ödenme") || s.includes("odenme") || s.includes("unpaid") || s.includes("not paid")) return false;
  return s === "paid" || s.includes("ödendi") || s.includes("odendi") || s.includes("tamamland") || s === "success" || s === "successful";
};

/** Sanal POS para birimi (TRY) → para tanımlarındaki kod */
const paraKodu = (paraBirimi: string | null | undefined): string => (kirp(paraBirimi).toUpperCase() === "TRY" || !kirp(paraBirimi) ? "TL" : kirp(paraBirimi).toUpperCase());

export class EBankaVposService {
  public static async ayar(dbContext?: DbContext) {
    const a = await EBankaSqlRepository.ayarGetir(dbContext);
    return { mod: a?.mod ?? "sahte", vposBankaId: a?.vposBankaId ?? null };
  }

  /** Tahsilat fişinin kesilebilmesi için: Canlı mod + ayarlarda Sanal POS banka hesabı + para tanımı (+ dövizde kur). */
  public static async fisOnKosullari(paraBirimi: string | null, gun: string, giris: boolean, dbContext?: DbContext): Promise<{ bankaId: number; paraId: number; kur: number } | { neden: string }> {
    const { mod, vposBankaId } = await this.ayar(dbContext);
    if (mod !== "canli") return { neden: "Test (örnek veri) modunda fiş kesilmez." };
    if (!vposBankaId) return { neden: "Ayarlar'da Sanal POS banka hesabı seçilmemiş." };
    try {
      await BankaService.getBankaById(vposBankaId, dbContext);
    } catch {
      return { neden: "Ayarlar'da seçili Sanal POS banka hesabı bulunamadı." };
    }
    const para = await EBankaAktarimSqlRepository.paraSozlugu(dbContext);
    const paraId = para.kodlar.get(paraKodu(paraBirimi));
    if (!paraId) return { neden: `"${paraBirimi}" para birimi para tanımlarında yok.` };
    let kur = 1;
    if (paraId !== para.tlId) {
      kur = await EBankaAktarimSqlRepository.kurGetir(paraId, gun, giris, dbContext);
      if (!(kur > 0)) return { neden: `${gun} için ${paraBirimi} kuru bulunamadı.` };
    }
    return { bankaId: vposBankaId, paraId, kur };
  }

  public static async fisYaz(
    p: { islemTipi: 0 | 1; bankaId: number; cariKartId: number | null; paraId: number; kur: number; tutar: number; gun: string; belgeNo: string | null; aciklama: string },
    kullaniciId?: number,
    dbContext?: DbContext
  ): Promise<number> {
    const aciklama = p.aciklama.slice(0, 250);
    const fis = await BankaService.saveHareket(
      {
        islemTipi: p.islemTipi,
        bankaId: p.bankaId,
        cariKartId: p.cariKartId,
        tarih: `${p.gun}T00:00:00Z`,
        belgeNo: p.belgeNo ? p.belgeNo.slice(0, 50) : null,
        aciklama,
        satirlar: [{ satirNo: 1, paraId: p.paraId, meblag: p.tutar, kur: p.kur, giseKuru: p.kur, tutarTl: Math.round(p.tutar * p.kur * 100) / 100, aciklama }],
      },
      kullaniciId,
      dbContext
    );
    return fis.bankaHareketId;
  }

  // ─── Ödeme linkleri ────────────────────────────────────────────────────────

  public static async linkOlustur(girdi: Record<string, any>, kullaniciId?: number, dbContext?: DbContext): Promise<VposLink> {
    const cariKartId = Number(girdi.cariKartId);
    if (!(cariKartId > 0)) throw ApiError.badRequest("Cari seçilmelidir.");
    const cari = await EBankaAktarimSqlRepository.cariGetir(cariKartId, dbContext);
    if (!cari) throw ApiError.badRequest("Seçilen cari bulunamadı.");

    const tutar = Math.round(Number(String(girdi.tutar ?? "").replace(",", ".")) * 100) / 100;
    if (!(tutar > 0)) throw ApiError.badRequest("Tutar sıfırdan büyük olmalıdır.");
    const paraBirimi = kirp(girdi.paraBirimi).toUpperCase() || "TRY";
    if (!PARA_BIRIMLERI.includes(paraBirimi)) throw ApiError.badRequest("Para birimi TRY, USD ya da EUR olabilir.");
    const sonGecerlilik = kirp(girdi.sonGecerlilik);
    if (sonGecerlilik && (!gunMu(sonGecerlilik) || sonGecerlilik < bugun())) throw ApiError.badRequest("Son geçerlilik tarihi geçersiz.");
    const eposta = kirp(girdi.eposta);
    const telefon = kirp(girdi.telefon).replace(/[^\d+]/g, "");
    const sms = Boolean(girdi.sms);
    const mail = Boolean(girdi.mail);
    if (sms && !telefon) throw ApiError.badRequest("SMS bildirimi için telefon numarası gerekir.");
    if (mail && !eposta) throw ApiError.badRequest("E-posta bildirimi için e-posta adresi gerekir.");
    const maxTaksit = Math.min(Math.max(Math.trunc(Number(girdi.maxTaksit) || 0), 0), 12);
    const baslik = (kirp(girdi.baslik) || `${cari.ad} tahsilat`).slice(0, 200);
    const aciklama = kirp(girdi.aciklama).slice(0, 500) || null;

    const yanit = await VomsisClient.istek(
      "vpos",
      "/request-payment",
      {
        metod: "POST",
        govde: {
          title: baslik,
          amount: tutar.toFixed(2),
          ...(sonGecerlilik ? { expire_date: `${sonGecerlilik.slice(8, 10)}.${sonGecerlilik.slice(5, 7)}.${sonGecerlilik.slice(0, 4)}` } : {}),
          ...(eposta ? { email: eposta } : {}),
          ...(telefon ? { phone: telefon } : {}),
          sms_notification: sms,
          mail_notification: mail,
          lang: "tr",
          max_installments: maxTaksit,
          currency: paraBirimi,
          ...(aciklama ? { inputs: { description: { value: aciklama, show: "true", changable: "false", required: "false" } } } : {}),
        },
      },
      dbContext
    );
    if (yanit?.success === false) throw new ApiError(HttpStatus.BAD_GATEWAY, `Vomsis ödeme linkini oluşturmadı: ${yanit.message || "bilinmeyen hata"}`);

    // Oluşturma yanıtının biçimi dokümanda yok; uid olası yerlerde aranır
    const d = yanit?.requestDetail || yanit?.data || yanit?.item || yanit || {};
    const uid = kirp(d.uid) || kirp(d.payment_uid) || kirp(yanit?.uid) || kirp(yanit?.payment_uid);
    if (!uid) throw new ApiError(HttpStatus.BAD_GATEWAY, "Vomsis ödeme linkini oluşturdu ama kimliğini (uid) döndürmedi. Vomsis panelinden kontrol edin.");

    let link = kirp(d.payment_info?.link) || kirp(d.link) || null;
    let durum = kirp(d.status) || kirp(d.durum) || null;
    if (!link) {
      const detay = (await VomsisClient.istek("vpos", `/request-payment/${encodeURIComponent(uid)}`, {}, dbContext).catch(() => null))?.requestDetail;
      link = kirp(detay?.payment_info?.link) || null;
      durum = durum || kirp(detay?.status) || null;
    }

    await EBankaVposSqlRepository.linkEkle(
      { uid, cariKartId, baslik, tutar, paraBirimi, sonGecerlilik: sonGecerlilik || null, eposta: eposta || null, telefon: telefon || null, sms, mail, maxTaksit, aciklama, link, durum, odendi: false },
      kullaniciId,
      dbContext
    );
    await EBankaSqlRepository.logYaz(
      { islem: "vpos-link", mod: (await this.ayar(dbContext)).mod, basarili: true, mesaj: `${cari.ad}: ${tutar.toFixed(2)} ${paraBirimi} ödeme linki`, kullaniciId },
      dbContext
    );
    return (await EBankaVposSqlRepository.linkGetir(uid, dbContext)) as VposLink;
  }

  /** Ödenmiş ve fişi olmayan link için tahsilat fişi. Kesilemezse nedenini döner (hata fırlatmaz: güncelleme yarıda kalmasın). */
  private static async linkFisiKes(l: VposLink, kullaniciId?: number, dbContext?: DbContext): Promise<{ bankaHareketId: number } | { neden: string }> {
    const gun = bugun(); // Vomsis ödeme tarihini link detayında vermiyor; ödendiğinin öğrenildiği gün
    const on = await this.fisOnKosullari(l.paraBirimi, gun, true, dbContext);
    if ("neden" in on) return on;
    if (!(await EBankaVposSqlRepository.linkFisTalebi(l.uid, dbContext))) return { neden: "Link için zaten fiş kesilmiş." };
    try {
      const bankaHareketId = await this.fisYaz(
        { islemTipi: HAVALE_ALMA, bankaId: on.bankaId, cariKartId: l.cariKartId, paraId: on.paraId, kur: on.kur, tutar: l.tutar, gun, belgeNo: l.uid.slice(0, 50), aciklama: `Sanal POS ödeme linki: ${l.baslik || ""}`.trim() },
        kullaniciId,
        dbContext
      );
      await EBankaVposSqlRepository.linkFisiYaz(l.uid, bankaHareketId, dbContext);
      return { bankaHareketId };
    } catch (err: any) {
      await EBankaVposSqlRepository.linkFisiYaz(l.uid, null, dbContext).catch(() => undefined);
      return { neden: err?.message || "Fiş kesilemedi." };
    }
  }

  /**
   * Vomsis bildirim göndermediği için linkin ödendiği bu güncellemeyle öğrenilir; yeni ödenenlere o anda tahsilat fişi kesilir.
   * Açık (ödenmemiş, silinmemiş) her link için Vomsis'e detay sorulur.
   */
  public static async linkleriGuncelle(kullaniciId?: number, dbContext?: DbContext) {
    const { mod } = await this.ayar(dbContext);
    const acik = (await EBankaVposSqlRepository.linkleriListele(false, dbContext)).filter((l) => !l.odendi || l.bankaHareketId === null);
    let yeniOdenen = 0;
    let kesilenFis = 0;
    const uyarilar: string[] = [];

    for (const l of acik) {
      let odendi = l.odendi;
      if (!odendi) {
        try {
          const detay = (await VomsisClient.istek("vpos", `/request-payment/${encodeURIComponent(l.uid)}`, {}, dbContext))?.requestDetail;
          if (!detay) continue;
          odendi = odendiMi(detay.status);
          await EBankaVposSqlRepository.linkDurumuYaz(l.uid, kirp(detay.status) || null, odendi, kirp(detay.payment_info?.link) || null, dbContext);
          if (odendi) yeniOdenen++;
        } catch (err: any) {
          uyarilar.push(`${l.baslik || l.uid}: ${err?.message || "durum okunamadı"}`);
          continue;
        }
      }
      if (odendi) {
        const sonuc = await this.linkFisiKes({ ...l, odendi: true }, kullaniciId, dbContext);
        if ("bankaHareketId" in sonuc) kesilenFis++;
        else if (mod === "canli") uyarilar.push(`${l.baslik || l.uid}: fiş kesilemedi — ${sonuc.neden}`);
      }
    }

    await EBankaSqlRepository.logYaz(
      { islem: "vpos-link-guncelle", mod, basarili: uyarilar.length === 0, adet: yeniOdenen, mesaj: `${acik.length} link soruldu, ${yeniOdenen} yeni ödeme, ${kesilenFis} tahsilat fişi${uyarilar.length ? ` — ${uyarilar[0]}` : ""}`, kullaniciId },
      dbContext
    );
    return { mod, sorulan: acik.length, yeniOdenen, kesilenFis, uyarilar, linkler: await EBankaVposSqlRepository.linkleriListele(false, dbContext) };
  }

  public static async linkleriListele(dbContext?: DbContext) {
    const { mod, vposBankaId } = await this.ayar(dbContext);
    return { mod, vposBankaTanimli: Boolean(vposBankaId), linkler: await EBankaVposSqlRepository.linkleriListele(false, dbContext) };
  }

  public static async linkSil(uid: string, kullaniciId?: number, dbContext?: DbContext): Promise<void> {
    const l = await EBankaVposSqlRepository.linkGetir(uid, dbContext);
    if (!l) throw ApiError.notFound("Ödeme linki bulunamadı.");
    if (l.odendi) throw ApiError.conflict("Ödenmiş link silinemez.");
    const yanit = await VomsisClient.istek("vpos", `/request-payment/${encodeURIComponent(uid)}`, { metod: "DELETE" }, dbContext);
    if (yanit?.success === false) throw new ApiError(HttpStatus.BAD_GATEWAY, `Vomsis linki silmedi: ${yanit.message || "bilinmeyen hata"}`);
    await EBankaVposSqlRepository.linkSilindiYaz(uid, dbContext);
    await EBankaSqlRepository.logYaz({ islem: "vpos-link-sil", mod: (await this.ayar(dbContext)).mod, basarili: true, mesaj: l.baslik || uid, kullaniciId }, dbContext);
  }

  public static async cariIletisim(cariKartId: number, dbContext?: DbContext) {
    const c = await EBankaAktarimSqlRepository.cariIletisim(cariKartId, dbContext);
    if (!c) throw ApiError.notFound("Cari bulunamadı.");
    return c;
  }

  // ─── İşlemler ──────────────────────────────────────────────────────────────

  /** Vomsis işlem listesini aynaya çeker. Dokümanda tarih süzgeci ve sayfalama yok; liste olduğu gibi alınır. */
  public static async islemleriGuncelle(kullaniciId?: number, dbContext?: DbContext) {
    const { mod } = await this.ayar(dbContext);
    try {
      const yanit = await VomsisClient.istek("vpos", "/transactions-list", { sorgu: { status: "" } }, dbContext);
      if (yanit?.success === false) throw new ApiError(HttpStatus.BAD_GATEWAY, `Vomsis işlem listesini vermedi: ${yanit.message || "bilinmeyen hata"}`);
      const satirlar = Array.isArray(yanit?.data) ? yanit.data : Array.isArray(yanit?.data?.data) ? yanit.data.data : [];
      const adet = await EBankaVposSqlRepository.islemleriYaz(satirlar, dbContext);
      await EBankaSqlRepository.logYaz({ islem: "vpos-islem-guncelle", mod, basarili: true, adet, mesaj: `${adet} Sanal POS işlemi`, kullaniciId }, dbContext);
      return { mod, adet };
    } catch (err: any) {
      await EBankaSqlRepository.logYaz({ islem: "vpos-islem-guncelle", mod, basarili: false, mesaj: err?.message, kullaniciId }, dbContext);
      throw err;
    }
  }

  public static async islemleriListele(f: { baslangic?: string; bitis?: string; arama?: string }, dbContext?: DbContext) {
    const { mod } = await this.ayar(dbContext);
    return { mod, islemler: await EBankaVposSqlRepository.islemleriListele(f, dbContext) };
  }

  public static async islemDetayi(referansNo: string, dbContext?: DbContext) {
    const yerel = await EBankaVposSqlRepository.islemGetir(referansNo, dbContext);
    // Vomsis dokümanı bu GET ucunda referanceNo'yu gövdede gösteriyor; GET gövdesi gönderilemediği için sorgu parametresi olarak verilir
    const yanit = await VomsisClient.istek("vpos", "/transaction/find", { sorgu: { referanceNo: referansNo } }, dbContext).catch((err: any) => ({ success: false, message: err?.message }));
    return { yerel, vomsis: yanit?.success === false ? null : yanit?.data ?? null, vomsisHatasi: yanit?.success === false ? yanit.message || "Vomsis detay vermedi." : null };
  }

  /** İptal (cancel) ya da kısmi/tam iade (refund). Muhasebe: E25. */
  public static async iptalIade(referansNo: string, girdi: { tur?: string; tutar?: number | string }, kullaniciId?: number, dbContext?: DbContext) {
    const tur = girdi.tur === "cancel" ? "cancel" : girdi.tur === "refund" ? "refund" : null;
    if (!tur) throw ApiError.badRequest("İşlem türü iptal ya da iade olmalıdır.");
    const islem = await EBankaVposSqlRepository.islemGetir(referansNo, dbContext);
    if (!islem) throw ApiError.notFound("İşlem bulunamadı. Önce işlem listesini güncelleyin.");
    if (islem.tur && islem.tur !== "islem") throw ApiError.conflict("Bu işlem daha önce iptal ya da iade edilmiş.");

    const tutar = tur === "refund" ? Math.round(Number(String(girdi.tutar ?? "").replace(",", ".")) * 100) / 100 : islem.tutar;
    if (tur === "refund" && (!(tutar > 0) || tutar > islem.tutar)) throw ApiError.badRequest("İade tutarı sıfırdan büyük olmalı ve işlem tutarını aşmamalıdır.");

    const { mod } = await this.ayar(dbContext);
    const yanit = await VomsisClient.istek(
      "vpos",
      "/transaction",
      { metod: "POST", govde: { transactionType: tur, referanceNo: referansNo, ...(tur === "refund" ? { amount: tutar } : {}) } },
      dbContext
    );
    if (kirp(yanit?.response) !== "Approved") {
      const mesaj = kirp(yanit?.error_message) || kirp(yanit?.message) || kirp(yanit?.response) || "bilinmeyen hata";
      await EBankaSqlRepository.logYaz({ islem: `vpos-${tur}`, mod, basarili: false, mesaj: `${referansNo}: ${mesaj}`, kullaniciId }, dbContext);
      throw new ApiError(HttpStatus.BAD_GATEWAY, `Banka ${tur === "cancel" ? "iptali" : "iadeyi"} onaylamadı: ${mesaj}`);
    }

    // Para hareketi bankada gerçekleşti; buradan sonrası muhasebe. Hata olursa işlem geri alınamaz, kullanıcıya açıkça bildirilir.
    let muhasebe = "Bu işlem bir tahsilat fişine bağlı değil; muhasebe kaydını elle düzeltin.";
    try {
      if (mod !== "canli") {
        muhasebe = "Test (örnek veri) modunda fiş kesilmez.";
      } else if (islem.bankaHareketId && islem.bankaHareketId > 0) {
        if (tur === "cancel") {
          await BankaService.toggleIptalHareket(islem.bankaHareketId, true, kullaniciId, dbContext);
          muhasebe = `Tahsilat fişi #${islem.bankaHareketId} iptal edildi.`;
        } else {
          const gun = bugun();
          const on = await this.fisOnKosullari(islem.paraBirimi, gun, false, dbContext);
          if ("neden" in on) {
            muhasebe = `İade fişi kesilemedi (${on.neden}); elle girin.`;
          } else {
            const fisId = await this.fisYaz(
              { islemTipi: HAVALE_GONDERME, bankaId: on.bankaId, cariKartId: islem.cariKartId, paraId: on.paraId, kur: on.kur, tutar, gun, belgeNo: referansNo, aciklama: `Sanal POS iade: ${islem.aciklama || referansNo}` },
              kullaniciId,
              dbContext
            );
            await EBankaVposSqlRepository.iadeFisiYaz(referansNo, fisId, dbContext);
            muhasebe = `İade için banka fişi #${fisId} kesildi.`;
          }
        }
      }
    } catch (err: any) {
      muhasebe = `Muhasebe kaydı yapılamadı (${err?.message || "hata"}); elle düzeltin.`;
    }

    await EBankaSqlRepository.logYaz(
      { islem: `vpos-${tur}`, mod, basarili: true, mesaj: `${referansNo}: ${tutar.toFixed(2)} ${islem.paraBirimi || ""} ${tur === "cancel" ? "iptal" : "iade"} — ${muhasebe}`, kullaniciId },
      dbContext
    );
    await this.islemleriGuncelle(kullaniciId, dbContext).catch(() => undefined);
    return { onaylandi: true, tutar, muhasebe, islem: (await EBankaVposSqlRepository.islemGetir(referansNo, dbContext)) as VposIslem };
  }

  /** Vomsis müşteri kayıtları — yalnızca okunur (E22). */
  public static async vomsisMusterileri(dbContext?: DbContext) {
    const yanit = await VomsisClient.istek("vpos", "/customers", {}, dbContext);
    const liste: any[] = Array.isArray(yanit) ? yanit : Array.isArray(yanit?.data) ? yanit.data : Array.isArray(yanit?.customers) ? yanit.customers : [];
    return liste.slice(0, EN_COK_SAYFA * 100).map((m) => ({ id: m?.id ?? null, eposta: kirp(m?.email) || null, unvan: kirp(m?.companyTitle) || null, faturaAdedi: Array.isArray(m?.invoices) ? m.invoices.length : 0 }));
  }
}
