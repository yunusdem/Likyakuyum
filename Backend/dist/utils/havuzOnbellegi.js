/**
 * Bağlantı havuzu (firma) başına kısa ömürlü bellek önbelleği.
 * Süre içinde gelen istekler aynı sonucu alır; sonuç gelmeden gelen aynı istek de yürüyen sorguyu bekler (ikinci sorgu gitmez).
 * Hata önbelleğe alınmaz. temizle(): yazmadan sonra çağrılır; o an yürüyen sorgunun sonucu da saklanmaz.
 */
export class HavuzOnbellegi {
    sureMs;
    kayitlar = new WeakMap();
    constructor(sureMs) {
        this.sureMs = sureMs;
    }
    getir(pool, uret) {
        const k = this.kayitlar.get(pool);
        // zaman null: sorgu sürüyor, sonucu beklenir
        if (k && (k.zaman === null || Date.now() - k.zaman < this.sureMs))
            return k.deger;
        const kayit = { zaman: null, deger: uret() };
        this.kayitlar.set(pool, kayit);
        kayit.deger.then(
        // Süre sorgu bitince başlar
        () => {
            if (this.kayitlar.get(pool) === kayit)
                kayit.zaman = Date.now();
        }, () => {
            if (this.kayitlar.get(pool) === kayit)
                this.kayitlar.delete(pool);
        });
        return kayit.deger;
    }
    temizle(pool) {
        this.kayitlar.delete(pool);
    }
}
