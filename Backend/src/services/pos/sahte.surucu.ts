import { PosIslem, PosSurucu, PosTerminal, SurucuIstek, SurucuSonuc, kurus } from "./pos.types.js";

/**
 * Sahte cihaz (Test modu). Hiçbir yere istek göndermez; sonuç, tutarın KURUŞ hanesinden belirlenir ki
 * ekran akışı ve doğrulama senaryoları cihaz gelmeden denenebilsin:
 *   ,01 → kart reddedildi          ,02 → müşteri cihazda vazgeçti
 *   ,03 → cihaz hiç cevap vermez   ,06 / ,09 / ,12 → o kadar taksitle onay
 *   diğerleri → tek çekim onay
 * Onay ve ret 5 saniye sonra "gelir". Banka, tutarın lira kısmına göre sırayla değişir.
 * Durum hesapla bulunur, bellekte tutulmaz: sunucu yeniden başlasa da sonuç aynıdır.
 */

export const SAHTE_BEKLEME_SN = 5;
const BANKALAR = ["Garanti BBVA", "Akbank", "Yapı Kredi", "İş Bankası", "Ziraat Bankası"];

/** gecenSaniye: cihaza gönderileli geçen süre. Sonuç henüz yoksa null. */
export const sahteSonuc = (posIslemId: number, tutar: number, gecenSaniye: number): SurucuSonuc | null => {
  const k = kurus(tutar) % 100;
  if (k === 3) return null;
  if (gecenSaniye < SAHTE_BEKLEME_SN) return null;
  if (k === 1) return { durum: "RET", hata: "Kart reddedildi (örnek)." };
  if (k === 2) return { durum: "IPTAL", hata: "Müşteri cihazda vazgeçti (örnek)." };

  const banka = BANKALAR[Math.floor(tutar) % BANKALAR.length];
  return {
    durum: "ONAY",
    bankaKodu: banka,
    bankaAdi: banka,
    taksit: k === 6 || k === 9 || k === 12 ? k : 1,
    onayKodu: String(100000 + (posIslemId % 900000)),
    kartNo: `4543 60** **** ${String(1000 + (posIslemId % 9000))}`,
    cihazFisNo: String(posIslemId),
    zNo: "1",
    ham: { ornek: true },
  };
};

export const SahteSurucu: PosSurucu = {
  async gonder(istek: SurucuIstek) {
    return { ref: `SAHTE-${istek.islem.posIslemId}` };
  },
  async sorgula(islem: PosIslem) {
    return sahteSonuc(islem.posIslemId, islem.tutar, islem.gecenSaniye ?? 0);
  },
  async iptal() {
    // Sahte cihazda geri alınacak bir şey yok
  },
  async baglantiTesti(terminal: PosTerminal) {
    return `Test modu: "${terminal.ad}" örnek cihaz olarak yanıt verdi. Gerçek cihaza istek gönderilmedi.`;
  },
  async gunSonu(terminal: PosTerminal) {
    return `Test modu: "${terminal.ad}" için gün sonu alınmış sayıldı. Gerçek cihaza istek gönderilmedi.`;
  },
};
