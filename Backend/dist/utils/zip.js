import fs from "fs";
import zlib from "zlib";
/**
 * Bağımlılıksız ZIP yazıcı (sürüm paketi ve firmaya özel kurulum indirmesi için).
 * - Küçük dosyalar bellekte DEFLATE ile sıkıştırılır.
 * - Büyük dosyalar (kurulum exe'si) akışla, sıkıştırmadan (STORED) ve "data descriptor" ile yazılır.
 * - Dosya adları UTF-8 (genel amaçlı bit 11). Windows Expand-Archive / .NET ZipArchive ile açılır. 4 GB sınırı (ZIP64 yok).
 */
const CRC_TABLO = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
export const crc32Guncelle = (crc, veri) => {
    let c = crc ^ 0xffffffff;
    for (let i = 0; i < veri.length; i++)
        c = CRC_TABLO[(c ^ veri[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
export const crc32 = (veri) => crc32Guncelle(0, veri);
const dosZamani = (d) => ({
    saat: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    tarih: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
});
export class ZipYazici {
    akis;
    konum = 0;
    kayitlar = [];
    adlar = new Set();
    constructor(hedef) {
        this.akis = typeof hedef === "string" ? fs.createWriteStream(hedef) : hedef;
    }
    yaz(b) {
        this.konum += b.length;
        if (this.konum > 0xfffffff0)
            throw new Error("ZIP 4 GB sınırını aşıyor.");
        return new Promise((tamam, hata) => {
            if (this.akis.write(b))
                return tamam();
            // Dinleyiciler her beklemede eklenip biri tetiklenince ikisi de kaldırılır (birikmesin)
            const bitti = () => {
                this.akis.off("error", basarisiz);
                tamam();
            };
            const basarisiz = (e) => {
                this.akis.off("drain", bitti);
                hata(e);
            };
            this.akis.once("drain", bitti);
            this.akis.once("error", basarisiz);
        });
    }
    adHazirla(arsivYolu) {
        const temiz = arsivYolu.replace(/\\/g, "/").replace(/^\/+/, "");
        if (!temiz || temiz.split("/").some((p) => p === ".." || p === ""))
            throw new Error(`Geçersiz arşiv yolu: ${arsivYolu}`);
        if (this.adlar.has(temiz))
            throw new Error(`Arşivde aynı ad iki kez: ${temiz}`);
        this.adlar.add(temiz);
        return Buffer.from(temiz, "utf8");
    }
    yerelBaslik(ad, yontem, bayrak, z, crc, sikisik, acik) {
        const h = Buffer.alloc(30);
        h.writeUInt32LE(0x04034b50, 0);
        h.writeUInt16LE(20, 4);
        h.writeUInt16LE(bayrak, 6);
        h.writeUInt16LE(yontem, 8);
        h.writeUInt16LE(z.saat, 10);
        h.writeUInt16LE(z.tarih, 12);
        h.writeUInt32LE(crc, 14);
        h.writeUInt32LE(sikisik, 18);
        h.writeUInt32LE(acik, 22);
        h.writeUInt16LE(ad.length, 26);
        h.writeUInt16LE(0, 28);
        return h;
    }
    /** Bellekteki veriyi ekler (varsayılan DEFLATE). */
    async veriEkle(arsivYolu, veri, tarih = new Date(), sikistir = true) {
        const ad = this.adHazirla(arsivYolu);
        const crc = crc32(veri);
        const govde = sikistir ? zlib.deflateRawSync(veri, { level: 6 }) : veri;
        const yontem = sikistir && govde.length < veri.length ? 8 : 0;
        const yazilacak = yontem === 8 ? govde : veri;
        const z = dosZamani(tarih);
        const bayrak = 0x0800;
        const konum = this.konum;
        await this.yaz(this.yerelBaslik(ad, yontem, bayrak, z, crc, yazilacak.length, veri.length));
        await this.yaz(ad);
        await this.yaz(yazilacak);
        this.kayitlar.push({ ad, yontem, bayrak, ...z, crc, sikisik: yazilacak.length, acik: veri.length, konum });
    }
    /** Diskteki dosyayı ekler. 8 MB'tan büyükse akışla ve sıkıştırmadan yazar. */
    async dosyaEkle(arsivYolu, kaynak) {
        const st = fs.statSync(kaynak);
        if (st.size <= 8 * 1024 * 1024)
            return this.veriEkle(arsivYolu, fs.readFileSync(kaynak), st.mtime);
        const ad = this.adHazirla(arsivYolu);
        const z = dosZamani(st.mtime);
        const bayrak = 0x0800 | 0x0008; // UTF-8 + data descriptor
        const konum = this.konum;
        await this.yaz(this.yerelBaslik(ad, 0, bayrak, z, 0, 0, 0));
        await this.yaz(ad);
        let crc = 0;
        let boyut = 0;
        for await (const parca of fs.createReadStream(kaynak, { highWaterMark: 1024 * 1024 })) {
            const b = parca;
            crc = crc32Guncelle(crc, b);
            boyut += b.length;
            await this.yaz(b);
        }
        const dd = Buffer.alloc(16);
        dd.writeUInt32LE(0x08074b50, 0);
        dd.writeUInt32LE(crc, 4);
        dd.writeUInt32LE(boyut, 8);
        dd.writeUInt32LE(boyut, 12);
        await this.yaz(dd);
        this.kayitlar.push({ ad, yontem: 0, bayrak, ...z, crc, sikisik: boyut, acik: boyut, konum });
    }
    async bitir() {
        const merkezBaslangic = this.konum;
        for (const k of this.kayitlar) {
            const h = Buffer.alloc(46);
            h.writeUInt32LE(0x02014b50, 0);
            h.writeUInt16LE(20, 4);
            h.writeUInt16LE(20, 6);
            h.writeUInt16LE(k.bayrak, 8);
            h.writeUInt16LE(k.yontem, 10);
            h.writeUInt16LE(k.saat, 12);
            h.writeUInt16LE(k.tarih, 14);
            h.writeUInt32LE(k.crc, 16);
            h.writeUInt32LE(k.sikisik, 20);
            h.writeUInt32LE(k.acik, 24);
            h.writeUInt16LE(k.ad.length, 28);
            h.writeUInt32LE(k.konum, 42);
            await this.yaz(h);
            await this.yaz(k.ad);
        }
        const son = Buffer.alloc(22);
        son.writeUInt32LE(0x06054b50, 0);
        son.writeUInt16LE(this.kayitlar.length, 8);
        son.writeUInt16LE(this.kayitlar.length, 10);
        son.writeUInt32LE(this.konum - merkezBaslangic, 12);
        son.writeUInt32LE(merkezBaslangic, 16);
        if (this.kayitlar.length > 0xffff)
            throw new Error("ZIP 65535 dosya sınırını aşıyor.");
        await this.yaz(son);
        await new Promise((tamam, hata) => {
            this.akis.once("error", hata);
            this.akis.end(tamam);
        });
    }
}
/** Klasörü (alt klasörleriyle) arşive ekler; arsivKoku arşivdeki ön ek. */
export const klasorEkle = async (zip, klasor, arsivKoku, haric = () => false) => {
    let adet = 0;
    const gez = async (alt) => {
        for (const g of fs.readdirSync(`${klasor}/${alt}`, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const gorece = alt ? `${alt}/${g.name}` : g.name;
            if (haric(gorece))
                continue;
            if (g.isDirectory())
                await gez(gorece);
            else if (g.isFile()) {
                await zip.dosyaEkle(`${arsivKoku}/${gorece}`, `${klasor}/${gorece}`);
                adet++;
            }
        }
    };
    await gez("");
    return adet;
};
