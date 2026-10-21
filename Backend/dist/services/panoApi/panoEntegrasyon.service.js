import crypto from "node:crypto";
import { PanoAnahtarSqlRepository } from "../../models/admin/panoAnahtarSql.repository.js";
import { PanoSqlRepository } from "../../models/panoSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { PanoApiService } from "./panoApi.service.js";
/**
 * Pano Entegrasyonu yönetimi (docs/PANO_API_YOL_HARITASI.md, P2/P6): anahtar üret / yenile / iptal, önbellek süresi,
 * pano listesi. Firma tarafı (Kur › Pano Entegrasyonu) ve yönetim paneli (Firma › Pano API) aynı servisi kullanır.
 */
export const ONBELLEK_ALT_SINIR_SN = 1;
export const ONBELLEK_UST_SINIR_SN = 3600;
const ALFABE = "abcdefghijklmnopqrstuvwxyz0123456789";
/** 32 karakter rastgele (a–z0–9), kriptografik üreteçle (P7) */
export const anahtarUret = () => {
    let s = "";
    for (let i = 0; i < 32; i++)
        s += ALFABE[crypto.randomInt(ALFABE.length)];
    return s;
};
export const adresler = (kok, anahtar) => {
    const k = kok.replace(/\/+$/, "");
    return {
        json: `${k}/api/v1/acik/pano/${anahtar}.json`,
        xml: `${k}/api/v1/acik/pano/${anahtar}.xml`,
        txt: `${k}/api/v1/acik/pano/${anahtar}.txt`,
        html: `${k}/acik/pano/${anahtar}`,
    };
};
const tarih = (d) => (d ? new Date(d).toISOString() : null);
export class PanoEntegrasyonService {
    /** Tablo kurulmamışsa (LIKYA_ADMIN_PANO_API.sql çalıştırılmamış) anlaşılır hata */
    static async tabloyuDogrula() {
        if (!(await PanoAnahtarSqlRepository.tabloVarMi())) {
            throw new ApiError(503, "Pano Entegrasyonu tabloları sunucuda kurulu değil (docs/sql/LIKYA_ADMIN_PANO_API.sql).");
        }
    }
    static satir(p, k, kok) {
        const bekleyen = k ? PanoApiService.bekleyenSayac(k.anahtarId) : null;
        const son = k ? (bekleyen && (!k.sonErisim || bekleyen.son > k.sonErisim) ? bekleyen.son : k.sonErisim) : null;
        return {
            panoId: p.panoId,
            panoNo: (p.panoNo || "").trim(),
            firmaAdi: (p.firmaAdi || "").trim(),
            satirSayisi: p.satirlar.filter((s) => s.gorunur !== false).length,
            anahtar: k?.anahtar ?? null,
            adresler: k ? adresler(kok, k.anahtar) : null,
            onbellekSn: k?.onbellekSn ?? 2,
            olusturan: k?.olusturan ?? null,
            olusturmaTarihi: tarih(k?.olusturmaTarihi),
            sonErisim: tarih(son),
            istekSayisi: (k?.istekSayisi ?? 0) + (bekleyen?.adet ?? 0),
        };
    }
    /** Firmanın panoları + varsa aktif anahtarları. kok: adreslerin başı (https://sunucu) */
    static async liste(firmaId, ctx, kok) {
        await PanoEntegrasyonService.tabloyuDogrula();
        const panolar = await PanoSqlRepository.findAll(ctx);
        const anahtarlar = await PanoAnahtarSqlRepository.firmaninAktifleri(firmaId);
        const esle = new Map(anahtarlar.map((k) => [k.panoId, k]));
        return panolar.map((p) => PanoEntegrasyonService.satir(p, esle.get(p.panoId), kok));
    }
    static async panoyuDogrula(panoId, ctx) {
        if (!Number.isInteger(panoId) || panoId <= 0)
            throw ApiError.badRequest("Pano kimliği geçersiz.");
        const pano = await PanoSqlRepository.findById(panoId, ctx);
        if (!pano)
            throw ApiError.notFound("Pano tanımı bulunamadı.");
        return pano;
    }
    /** Üret ya da yenile: eski AKTIF anahtar tek işlemde IPTAL olur, adresi anında kapanır */
    static async uret(firmaId, panoId, ctx, kim, kok) {
        await PanoEntegrasyonService.tabloyuDogrula();
        const pano = await PanoEntegrasyonService.panoyuDogrula(panoId, ctx);
        await PanoApiService.sayaclariYaz();
        const { yeni, eskiAnahtar } = await PanoAnahtarSqlRepository.uret(firmaId, panoId, anahtarUret(), kim);
        PanoApiService.onbellegiDusur(eskiAnahtar);
        return PanoEntegrasyonService.satir(pano, yeni, kok);
    }
    static async iptal(firmaId, panoId, ctx, kim, kok) {
        await PanoEntegrasyonService.tabloyuDogrula();
        const pano = await PanoEntegrasyonService.panoyuDogrula(panoId, ctx);
        await PanoApiService.sayaclariYaz();
        const eski = await PanoAnahtarSqlRepository.iptal(firmaId, panoId, kim);
        if (!eski)
            throw ApiError.notFound("Bu panonun aktif anahtarı yok.");
        PanoApiService.onbellegiDusur(eski);
        return PanoEntegrasyonService.satir(pano, undefined, kok);
    }
    /** Önbellek süresi: tam sayı, 1–3600 sn (P6) */
    static async onbellekYaz(firmaId, panoId, ctx, sn, kok) {
        await PanoEntegrasyonService.tabloyuDogrula();
        const n = Number(sn);
        if (!Number.isInteger(n) || n < ONBELLEK_ALT_SINIR_SN || n > ONBELLEK_UST_SINIR_SN) {
            throw ApiError.badRequest(`Önbellek süresi ${ONBELLEK_ALT_SINIR_SN}–${ONBELLEK_UST_SINIR_SN} saniye arasında tam sayı olmalı.`);
        }
        const pano = await PanoEntegrasyonService.panoyuDogrula(panoId, ctx);
        const k = await PanoAnahtarSqlRepository.onbellekYaz(firmaId, panoId, n);
        if (!k)
            throw ApiError.notFound("Bu panonun aktif anahtarı yok.");
        PanoApiService.onbellegiDusur(k.anahtar);
        return PanoEntegrasyonService.satir(pano, k, kok);
    }
}
