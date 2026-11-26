/**
 * Kasaya bağlı terazi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA4). Ayar bu bilgisayara özeldir (tarayıcıda saklanır):
 * terazi hangi kasaya takılıysa o kasada ayarlanır.
 *
 *   tarayici: Web Serial (Chrome / Edge masaüstü, HTTPS ya da localhost). İlk kez "Port seç" ile izin verilir; sonra
 *             aynı USB cihazı getPorts() ile kendiliğinden bulunur.
 *   ajan:     Yazdırma ajanı (127.0.0.1:9100/terazi) COM porttan ham yanıtı okur (Web Serial yoksa).
 * Ham yanıtın çözümü ortak: Backend/src/services/ticari/teraziProtokol.ts
 */
import {
  TERAZI_ISTEGI, TERAZI_ISTEGI_HEX, TeraziBaglantiAyari, TeraziOkumasi, VARSAYILAN_TERAZI_AYARI, teraziCevabiCoz, teraziSurekliYeterliMi,
} from "../../Backend/src/services/ticari/teraziProtokol";

const ANAHTAR = "likya_terazi_ayar";
const AJAN = "http://127.0.0.1:9100/terazi";

export const teraziAyariOku = (): TeraziBaglantiAyari => {
  try {
    const a = JSON.parse(localStorage.getItem(ANAHTAR) || "null");
    return a && typeof a === "object" ? { ...VARSAYILAN_TERAZI_AYARI, ...a } : { ...VARSAYILAN_TERAZI_AYARI };
  } catch {
    return { ...VARSAYILAN_TERAZI_AYARI };
  }
};

export const teraziAyariYaz = (a: TeraziBaglantiAyari): void => {
  localStorage.setItem(ANAHTAR, JSON.stringify(a));
  window.dispatchEvent(new Event("likya-terazi-ayar"));
};

/** Tarayıcıda Web Serial var mı (Chrome / Edge masaüstü, güvenli bağlam) */
export const webSerialVarMi = (): boolean => typeof navigator !== "undefined" && !!(navigator as any).serial && (typeof window === "undefined" || window.isSecureContext !== false);

/** Web Serial: kullanıcı tıklamasıyla port seçtirir; seçilen cihazın kimliği ayara yazılır */
export async function teraziPortuSec(a: TeraziBaglantiAyari): Promise<TeraziBaglantiAyari> {
  if (!webSerialVarMi()) throw new Error("Bu tarayıcıda Web Serial yok. Chrome ya da Edge kullanın ya da \"Yazdırma ajanı\" yolunu seçin.");
  const port = await (navigator as any).serial.requestPort();
  const bilgi = port.getInfo?.() || {};
  return { ...a, usbVendorId: bilgi.usbVendorId ?? null, usbProductId: bilgi.usbProductId ?? null };
}

/** İzin verilmiş portlardan ayardaki cihaz (yoksa tek port varsa o) */
async function portBul(a: TeraziBaglantiAyari): Promise<any> {
  const portlar: any[] = await (navigator as any).serial.getPorts();
  const eslesen = portlar.find((p) => {
    const b = p.getInfo?.() || {};
    return a.usbVendorId != null && b.usbVendorId === a.usbVendorId && (a.usbProductId == null || b.usbProductId === a.usbProductId);
  });
  if (eslesen) return eslesen;
  if (portlar.length === 1) return portlar[0];
  throw new Error("Terazi portu seçilmemiş. Stok Ayarları › Bu bilgisayardaki terazi › \"Port seç\" ile seçin.");
}

/** Web Serial ile ham yanıt (en çok ~1,5 sn bekler) */
async function tarayicidanOku(a: TeraziBaglantiAyari, zamanAsimi = 1500): Promise<string> {
  const port = await portBul(a);
  try {
    await port.open({ baudRate: a.baud, dataBits: a.veriBit, parity: a.parite, stopBits: a.durBit });
  } catch (e: any) {
    // Başka sekme / önceki okuma açık bıraktıysa
    if (!/already open|InvalidState/i.test(String(e?.message || e?.name))) throw new Error(`Terazi portu açılamadı: ${e?.message || e}`);
  }
  const cozucu = new TextDecoder("latin1");
  let ham = "";
  try {
    if (a.protokol === "istek") {
      const yazici = port.writable.getWriter();
      await yazici.write(new TextEncoder().encode(TERAZI_ISTEGI));
      yazici.releaseLock();
    }
    const okuyucu = port.readable.getReader();
    const zamanlayici = setTimeout(() => { okuyucu.cancel().catch(() => undefined); }, zamanAsimi);
    try {
      for (;;) {
        const { value, done } = await okuyucu.read();
        if (done) break;
        if (value) ham += cozucu.decode(value, { stream: true });
        // İstek modunda tek satır yeter; sürekli modda iki tam satır (sonuncusu tam olsun)
        // İstek modunda tek tam satır yeter; sürekli modda yarım ilk satır + iki tam satır beklenir (CRLF tek satır sonu sayılır)
        if (a.protokol === "istek" ? /\d/.test(ham) && /[\r\n\x03]/.test(ham) : teraziSurekliYeterliMi(ham)) break;
      }
    } finally {
      clearTimeout(zamanlayici);
      okuyucu.releaseLock();
    }
  } finally {
    await port.close().catch(() => undefined);
  }
  return ham;
}

/** Yazdırma ajanından ham yanıt */
async function ajandanOku(a: TeraziBaglantiAyari): Promise<string> {
  const q = new URLSearchParams({
    port: a.ajanPort.trim().toUpperCase(), baud: String(a.baud), veriBit: String(a.veriBit), parite: a.parite, durBit: String(a.durBit),
    istek: a.protokol === "istek" ? TERAZI_ISTEGI_HEX : "", zamanAsimi: "1500",
  });
  let r: Response;
  try {
    r = await fetch(`${AJAN}?${q.toString()}`, { method: "GET" });
  } catch {
    throw new Error("Yazdırma ajanına ulaşılamadı (PrinterAgent çalışmıyor ya da terazi ucu olmayan eski sürüm).");
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(j?.message || (r.status === 404 ? "Yazdırma ajanı terazi okumayı desteklemiyor; ajanı güncelleyin." : "Terazi okunamadı."));
  return String(j.ham || "");
}

/** Teraziden ağırlık: { kg, kararli, hata, ham } */
export async function teraziOku(a: TeraziBaglantiAyari = teraziAyariOku()): Promise<TeraziOkumasi & { ham: string }> {
  if (a.yol === "yok") throw new Error("Bu bilgisayarda terazi tanımlı değil (Stok Ayarları › Bu bilgisayardaki terazi).");
  const ham = a.yol === "tarayici" ? await tarayicidanOku(a) : await ajandanOku(a);
  return { ...teraziCevabiCoz(ham, a.ondaliksizGram, a.protokol !== "istek"), ham };
}
