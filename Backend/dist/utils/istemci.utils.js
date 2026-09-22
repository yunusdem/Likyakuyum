const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const portuAt = (deger) => {
    const v = deger.trim();
    // "1.2.3.4:5678" (IIS ARR böyle yazabilir) → "1.2.3.4"; IPv6'ya dokunma
    const m = v.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    return m ? m[1] : v;
};
/**
 * İsteği yapanın IP adresi. Backend IIS'in arkasında 127.0.0.1'den proxy edildiği için
 * X-Forwarded-For yalnızca bağlantı yerel proxy'den geliyorsa dikkate alınır; doğrudan gelen
 * isteklerde başlığa güvenilmez (sahte IP yazılamasın).
 */
export const istemciIp = (req) => {
    const soket = req.socket?.remoteAddress || "";
    if (LOOPBACK.has(soket)) {
        const xff = req.headers["x-forwarded-for"];
        // Son değer bizim proxy'mizin eklediğidir; öndekileri istemci kendisi yazmış olabilir.
        const son = (Array.isArray(xff) ? xff.join(",") : xff || "").split(",").pop();
        if (son && son.trim())
            return portuAt(son).slice(0, 64);
    }
    return soket.replace(/^::ffff:/, "").slice(0, 64);
};
export const istemciTarayici = (req) => String(req.headers["user-agent"] || "").slice(0, 400);
