import fs from "fs";
import path from "path";
/**
 * Klasörü alt klasörleriyle kopyalar. fs.cpSync KULLANILMAZ: Node 25 / Windows'ta Türkçe karakterli yollarda süreç
 * hata vermeden kapanabiliyor (yerel denemede görüldü). Bağlantı (symlink / junction) klasörlerin içeriği kopyalanır.
 * filtre: kaynak yolu verilir, false dönerse dosya/klasör atlanır.
 */
export const klasorKopyala = (kaynak, hedef, filtre = () => true) => {
    let adet = 0;
    const gez = (k, h) => {
        fs.mkdirSync(h, { recursive: true });
        for (const ad of fs.readdirSync(k)) {
            const ky = path.join(k, ad);
            if (!filtre(ky))
                continue;
            const st = fs.statSync(ky); // bağlantıyı izler
            const hy = path.join(h, ad);
            if (st.isDirectory())
                gez(ky, hy);
            else if (st.isFile()) {
                fs.copyFileSync(ky, hy);
                adet++;
            }
        }
    };
    gez(kaynak, hedef);
    return adet;
};
