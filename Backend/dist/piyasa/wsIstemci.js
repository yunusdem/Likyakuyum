import tls from "node:tls";
import net from "node:net";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
/**
 * Bağımlılıksız, yalnız istemci tarafı WebSocket (RFC 6455).
 * Sunucu Node 20'de çalışıyor (yerleşik WebSocket yok) ve node_modules git'te izlendiği için paket eklenmiyor.
 * Metin/ikili mesaj, parçalı çerçeve, ping/pong ve kapanış desteklenir; sıkıştırma istenmez.
 *
 * Olaylar: "open", "message" (string), "close" (kod, neden), "error" (Error)
 */
export class WsIstemci extends EventEmitter {
    adres;
    basliklar;
    zamanAsimiMs;
    soket = null;
    tampon = Buffer.alloc(0);
    elSikisildi = false;
    parcalar = [];
    parcaOpkod = 0;
    kapandi = false;
    constructor(adres, basliklar = {}, zamanAsimiMs = 15000) {
        super();
        this.adres = adres;
        this.basliklar = basliklar;
        this.zamanAsimiMs = zamanAsimiMs;
    }
    baglan() {
        const u = new URL(this.adres);
        const guvenli = u.protocol === "wss:" || u.protocol === "https:";
        const port = Number(u.port) || (guvenli ? 443 : 80);
        const anahtar = crypto.randomBytes(16).toString("base64");
        const soket = guvenli
            ? tls.connect({ host: u.hostname, port, servername: u.hostname })
            : net.connect({ host: u.hostname, port });
        this.soket = soket;
        soket.setNoDelay(true);
        soket.setTimeout(this.zamanAsimiMs, () => this.hata(new Error("Bağlantı zaman aşımı")));
        soket.once(guvenli ? "secureConnect" : "connect", () => {
            const yol = `${u.pathname || "/"}${u.search}`;
            const satirlar = [
                `GET ${yol} HTTP/1.1`,
                `Host: ${u.host}`,
                "Upgrade: websocket",
                "Connection: Upgrade",
                `Sec-WebSocket-Key: ${anahtar}`,
                "Sec-WebSocket-Version: 13",
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
                ...Object.entries(this.basliklar).map(([k, v]) => `${k}: ${v}`),
            ];
            soket.write(satirlar.join("\r\n") + "\r\n\r\n");
        });
        soket.on("data", (veri) => {
            this.tampon = this.tampon.length ? Buffer.concat([this.tampon, veri]) : veri;
            if (!this.elSikisildi) {
                const son = this.tampon.indexOf("\r\n\r\n");
                if (son < 0)
                    return;
                const baslik = this.tampon.subarray(0, son).toString("latin1");
                const durumSatiri = baslik.split("\r\n")[0];
                if (!/^HTTP\/1\.[01] 101/.test(durumSatiri)) {
                    this.hata(new Error(`El sıkışma reddedildi: ${durumSatiri}`));
                    return;
                }
                this.elSikisildi = true;
                this.tampon = this.tampon.subarray(son + 4);
                soket.setTimeout(0);
                this.emit("open");
            }
            this.cerceveleriIsle();
        });
        soket.on("error", (e) => this.hata(e));
        soket.on("close", () => this.kapat(1006, "Bağlantı kapandı"));
    }
    gonder(metin) {
        if (!this.soket || !this.elSikisildi || this.kapandi)
            return;
        this.cerceveYaz(0x1, Buffer.from(metin, "utf8"));
    }
    kapat(kod = 1000, neden = "") {
        if (this.kapandi)
            return;
        this.kapandi = true;
        try {
            if (this.soket && this.elSikisildi && !this.soket.destroyed) {
                const govde = Buffer.alloc(2);
                govde.writeUInt16BE(kod === 1006 ? 1000 : kod, 0);
                this.cerceveYaz(0x8, govde);
            }
        }
        catch {
            /* kapanırken yazma hatası önemsiz */
        }
        this.soket?.destroy();
        this.soket = null;
        this.emit("close", kod, neden);
    }
    hata(e) {
        if (this.kapandi)
            return;
        this.emit("error", e);
        this.kapat(1006, e.message);
    }
    cerceveYaz(opkod, govde) {
        const uzunluk = govde.length;
        let baslik;
        if (uzunluk < 126) {
            baslik = Buffer.alloc(2);
            baslik[1] = 0x80 | uzunluk;
        }
        else if (uzunluk < 65536) {
            baslik = Buffer.alloc(4);
            baslik[1] = 0x80 | 126;
            baslik.writeUInt16BE(uzunluk, 2);
        }
        else {
            baslik = Buffer.alloc(10);
            baslik[1] = 0x80 | 127;
            baslik.writeBigUInt64BE(BigInt(uzunluk), 2);
        }
        baslik[0] = 0x80 | opkod;
        const maske = crypto.randomBytes(4);
        const maskeli = Buffer.alloc(uzunluk);
        for (let i = 0; i < uzunluk; i++)
            maskeli[i] = govde[i] ^ maske[i & 3];
        this.soket?.write(Buffer.concat([baslik, maske, maskeli]));
    }
    cerceveleriIsle() {
        while (this.tampon.length >= 2) {
            const b0 = this.tampon[0];
            const b1 = this.tampon[1];
            const son = (b0 & 0x80) !== 0;
            const opkod = b0 & 0x0f;
            const maskeli = (b1 & 0x80) !== 0;
            let uzunluk = b1 & 0x7f;
            let ofset = 2;
            if (uzunluk === 126) {
                if (this.tampon.length < 4)
                    return;
                uzunluk = this.tampon.readUInt16BE(2);
                ofset = 4;
            }
            else if (uzunluk === 127) {
                if (this.tampon.length < 10)
                    return;
                uzunluk = Number(this.tampon.readBigUInt64BE(2));
                ofset = 10;
            }
            const maske = maskeli ? this.tampon.subarray(ofset, ofset + 4) : null;
            if (maskeli)
                ofset += 4;
            if (this.tampon.length < ofset + uzunluk)
                return;
            let govde = this.tampon.subarray(ofset, ofset + uzunluk);
            if (maske) {
                const acik = Buffer.alloc(uzunluk);
                for (let i = 0; i < uzunluk; i++)
                    acik[i] = govde[i] ^ maske[i & 3];
                govde = acik;
            }
            this.tampon = this.tampon.subarray(ofset + uzunluk);
            if (opkod === 0x8) {
                const kod = govde.length >= 2 ? govde.readUInt16BE(0) : 1005;
                this.kapat(kod, govde.subarray(2).toString("utf8"));
                return;
            }
            if (opkod === 0x9) {
                this.cerceveYaz(0xa, govde);
                continue;
            }
            if (opkod === 0xa)
                continue;
            if (opkod === 0x1 || opkod === 0x2) {
                this.parcaOpkod = opkod;
                this.parcalar = [Buffer.from(govde)];
            }
            else if (opkod === 0x0) {
                this.parcalar.push(Buffer.from(govde));
            }
            if (son && (opkod === 0x0 || opkod === 0x1 || opkod === 0x2)) {
                const tam = this.parcalar.length === 1 ? this.parcalar[0] : Buffer.concat(this.parcalar);
                this.parcalar = [];
                if (this.parcaOpkod === 0x1 || this.parcaOpkod === 0x2)
                    this.emit("message", tam.toString("utf8"));
            }
        }
    }
}
