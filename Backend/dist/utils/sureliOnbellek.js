/**
 * Boyutu sınırlı, süreli bellek önbelleği. Aynı anahtar için uçuştaki sorgu paylaşılır.
 * `sakla` false dönen sonuç (boş / hatalı cevap) önbelleğe yazılmaz; hata fırlatan sorgu da yazılmaz.
 * Sınır aşılınca en eski eklenen kayıt atılır.
 */
export class SureliOnbellek {
    sureMs;
    enFazla;
    simdi;
    kayitlar = new Map();
    ucustakiler = new Map();
    constructor(sureMs, enFazla, simdi = Date.now) {
        this.sureMs = sureMs;
        this.enFazla = enFazla;
        this.simdi = simdi;
    }
    async al(anahtar, getir, sakla) {
        const kayit = this.kayitlar.get(anahtar);
        if (kayit) {
            if (kayit.bitis > this.simdi())
                return kayit.deger;
            this.kayitlar.delete(anahtar);
        }
        const ucusta = this.ucustakiler.get(anahtar);
        if (ucusta)
            return ucusta;
        const is = (async () => {
            try {
                const deger = await getir();
                if (sakla(deger)) {
                    this.kayitlar.delete(anahtar);
                    this.kayitlar.set(anahtar, { deger, bitis: this.simdi() + this.sureMs });
                    while (this.kayitlar.size > this.enFazla) {
                        const enEski = this.kayitlar.keys().next().value;
                        if (enEski === undefined)
                            break;
                        this.kayitlar.delete(enEski);
                    }
                }
                return deger;
            }
            finally {
                this.ucustakiler.delete(anahtar);
            }
        })();
        this.ucustakiler.set(anahtar, is);
        return is;
    }
    get boyut() {
        return this.kayitlar.size;
    }
}
