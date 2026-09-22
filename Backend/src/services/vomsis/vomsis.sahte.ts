/**
 * Vomsis sahte sağlayıcı (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E12).
 * Vomsis anahtarı gelene ve sunucu IP'si Vomsis paneline tanımlanana kadar ekranlar bununla geliştirilir.
 * Yanıt biçimleri https://apiportal.vomsis.com örnekleriyle birebir aynıdır; değerler uydurmadır.
 * Hareketler güne göre belirlenimlidir: aynı gün her çağrıda aynı id ve tutarla gelir (eşitleme mükerrer üretmez).
 * Yeni uçlar kendi fazlarında eklenir.
 */

type Sorgu = Record<string, string | number | undefined | null>;
type SahteYanit = (sorgu: Sorgu, govde?: unknown) => unknown;

const BANKALAR = [
  { id: 5, bank_name: "akbank", bank_title: "Akbank", bank_code: "0046", order: 1, created_at: "2026-04-02 12:56:27" },
  { id: 22, bank_name: "denizbank", bank_title: "Denizbank", bank_code: "0134", order: 2, created_at: "2026-04-02 12:56:27" },
  { id: 12, bank_name: "garanti", bank_title: "Garanti BBVA", bank_code: "0062", order: 3, created_at: "2026-04-02 12:56:27" },
];

const bankaOzeti = (bankId: number) => {
  const b = BANKALAR.find((x) => x.id === bankId)!;
  return { id: b.id, bank_name: b.bank_name, bank_title: b.bank_title, order: b.order, bank_code: b.bank_code };
};

const hesap = (id: number, bankId: number, doviz: string, no: string, iban: string, bakiye: string, sube: string, subeKodu: string, urun: string) => ({
  id,
  bank_id: bankId,
  branch_name: sube,
  fec_name: doviz,
  account_number: no,
  balance: bakiye,
  branch_id: subeKodu,
  add_to_balance: 1,
  blocked_balance: null,
  available_balance: null,
  custom_iban: null,
  iban,
  status: 1,
  b_order: 0,
  product_code: urun,
  created_at: "2026-04-02 13:10:00",
  bank: bankaOzeti(bankId),
});

// IBAN'ların hiçbiri sağlama denetiminden geçmez: gerçek bir hesaba denk gelemezler
const HESAPLAR = [
  hesap(101, 5, "TL", "3123647", "TR440004600115888000123647", "1284530.75", "Kapalıçarşı", "115", "CARIHSP"),
  hesap(102, 5, "USD", "3123648", "TR170004600115001000123648", "48250.00", "Kapalıçarşı", "115", "CARIHSP"),
  hesap(103, 22, "TL", "2913129", "TR700013400000291312900005", "356720.10", "Yeditepe", "4840", "VDSZMVD"),
  hesap(104, 12, "EUR", "6298811", "TR320006200029800006298811", "19840.50", "Eminönü", "298", "CARIHSP"),
];

const HAREKET_TIPLERI: [string, string][] = [
  ["BONOAL", "Bono Alış"], ["BONOSAT", "Bono Satış"], ["CEKODE", "Çek Ödeme"], ["CEKTAH", "Çek Tahsilat"],
  ["DBSODE", "DBS Ödeme"], ["DBSTAH", "DBS Tahsilat"], ["DIGODE", "Diğer Ödeme"], ["DIGTAH", "Diğer Tahsiat"],
  ["DOVAL", "Döviz Alış"], ["DOVSAT", "Döviz Satış"], ["FAIZGEL", "Faiz Gelirleri"], ["FAIZGID", "Faiz Giderleri"],
  ["FATODEME", "Fatura Ödeme"], ["FONAL", "Fon Alış"], ["FONSAT", "Fon Satış"], ["GMNGID", "Gayrimenkul Giderleri"],
  ["IHRISL", "İhracat İşlemleri"], ["ITHISL", "İthalat İşlemleri"], ["KARTHARC", "Debit/Kredi Kartı Harcama"],
  ["KARTODE", "Debit/Kredi Kart Ödeme"], ["KIRAGID", "Kira Gideri"], ["KKDF", "KKDF"], ["KRDKUL", "Kredi Kullanma"],
  ["KRDODE", "Kredi Ödeme"], ["MASRKOM", "Banka Masraf/Komisyon"], ["NAKCEK", "Nakit Çekilen"], ["NAKYAT", "Nakit Yatan"],
  ["OGSHGS", "HGS/OGS"], ["PERSODE", "Personel Giderleri"], ["POSBLC", "POS Bloke Çıkış"], ["POSBLG", "POS Bloke Giriş"],
  ["POSYAT", "POS Yatan"], ["POSYATIAD", "POS Yatan İade"], ["REPOCEK", "Repo Çekilen"], ["REPOYAT", "Repo Yatırma"],
  ["SGKODE", "SGK Ödeme"], ["SNTODE", "Senet Ödeme"], ["SNTTAH", "Senet Tahsilat"], ["TEMMEKT", "Teminat Mektubu"],
  ["TRFGEL", "Transfer Gelen"], ["TRFGID", "Transfer Giden"], ["VDHSACMA", "Vadeli Açma"], ["VDHSKAPA", "Vadeli Dönüş/Kapanış"],
  ["VERGIODE", "Vergi Ödeme"], ["VIRMGEL", "Virman Gelen"], ["VIRMGID", "Virman Giden"],
];

// ─── Hareket üretimi ─────────────────────────────────────────────────────────

interface Sablon {
  hesapId: number;
  tip: string;
  bankaKodu: string;
  saat: string;
  tutar: number; // + alacaklı, - borçlu
  aciklama: string;
  karsiUnvan?: string;
  karsiIban?: string;
  karsiVkn?: string;
  gonderenAd?: string;
  gonderenTckn?: string;
  /** Yalnızca gün numarası bu sayıya bölünüyorsa üretilir */
  herGun?: number;
}

const iban = (id: number) => HESAPLAR.find((h) => h.id === id)!.iban;

const SABLONLAR: Sablon[] = [
  { hesapId: 101, tip: "TRFGEL", bankaKodu: "EFT", saat: "09:42:10", tutar: 185000, aciklama: "ALTIN ALIM BEDELI FATURA NO 2026/118", karsiUnvan: "ÖRNEK KUYUMCULUK SAN. TİC. LTD. ŞTİ.", karsiIban: "TR110006200000100000000001", karsiVkn: "1234567890" },
  { hesapId: 101, tip: "TRFGID", bankaKodu: "EFT", saat: "10:15:33", tutar: -96500, aciklama: "HAS ALTIN ODEMESI", karsiUnvan: "DENEME DARPHANE A.Ş.", karsiIban: "TR940013500000007906080002", karsiVkn: "3230491123", herGun: 2 },
  { hesapId: 101, tip: "TRFGEL", bankaKodu: "FAST", saat: "11:03:48", tutar: 12750, aciklama: "BILEZIK KAPORA", gonderenAd: "AYŞE ÖRNEK", gonderenTckn: "11111111110", karsiIban: "TR560001000000000000000042", herGun: 3 },
  { hesapId: 101, tip: "MASRKOM", bankaKodu: "MSR", saat: "10:15:34", tutar: -12.8, aciklama: "EFT MASRAFI + BSMV", herGun: 2 },
  { hesapId: 101, tip: "POSYAT", bankaKodu: "POS", saat: "06:00:05", tutar: 43280.4, aciklama: "UYE ISYERI 0123456 POS NET TUTAR" },
  { hesapId: 101, tip: "NAKYAT", bankaKodu: "NKT", saat: "16:20:00", tutar: 50000, aciklama: "SUBEDEN NAKIT YATAN", herGun: 5 },
  { hesapId: 101, tip: "VIRMGID", bankaKodu: "VRM", saat: "14:05:12", tutar: -75000, aciklama: "HESAPLAR ARASI VIRMAN", karsiIban: iban(103), herGun: 4 },
  { hesapId: 103, tip: "VIRMGEL", bankaKodu: "VRM", saat: "14:05:12", tutar: 75000, aciklama: "HESAPLAR ARASI VIRMAN", karsiIban: iban(101), herGun: 4 },
  { hesapId: 103, tip: "VERGIODE", bankaKodu: "VRG", saat: "13:30:00", tutar: -28450, aciklama: "KDV ODEMESI GIB TAHSILAT", herGun: 15 },
  { hesapId: 103, tip: "SGKODE", bankaKodu: "SGK", saat: "13:31:00", tutar: -41200, aciklama: "SGK PRIM ODEMESI", herGun: 15 },
  { hesapId: 101, tip: "DOVAL", bankaKodu: "DVZ", saat: "15:10:00", tutar: -206250, aciklama: "DOVIZ ALIS 5000 USD KUR 41,2500", karsiIban: iban(102), herGun: 6 },
  { hesapId: 102, tip: "DOVAL", bankaKodu: "DVZ", saat: "15:10:00", tutar: 5000, aciklama: "DOVIZ ALIS 5000 USD KUR 41,2500", karsiIban: iban(101), herGun: 6 },
  { hesapId: 104, tip: "TRFGEL", bankaKodu: "SWIFT", saat: "12:00:00", tutar: 8400, aciklama: "INVOICE 2026-044 GOLD JEWELLERY", karsiUnvan: "MUSTER SCHMUCK GMBH", karsiIban: "DE89370400440532013000", herGun: 7 },
  { hesapId: 103, tip: "FAIZGEL", bankaKodu: "FAIZ", saat: "23:55:00", tutar: 318.42, aciklama: "VADESIZ MEVDUAT FAIZ TAHAKKUKU", herGun: 10 },
];

const GUN_MS = 86_400_000;
const iki = (n: number) => String(n).padStart(2, "0");
const gunMetni = (d: Date) => `${d.getUTCFullYear()}-${iki(d.getUTCMonth() + 1)}-${iki(d.getUTCDate())}`;

/** "GG-AA-YYYY[ SS:DD:ss]" → UTC ms (duvar saati UTC gibi işlenir; yalnızca karşılaştırma içindir) */
const vomsisTarihi = (metin: unknown, gunSonu: boolean): number | null => {
  const m = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(String(metin || "").trim());
  if (!m) return null;
  const saatVar = m[4] !== undefined;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], saatVar ? +m[4] : gunSonu ? 23 : 0, saatVar ? +m[5] : gunSonu ? 59 : 0, saatVar ? +m[6] : gunSonu ? 59 : 0);
};

const hareketUret = (s: Sablon, sira: number, gunNo: number) => {
  const gun = new Date(gunNo * GUN_MS);
  // Tutar güne göre ±%10 oynar ama aynı gün için hep aynıdır
  const oynama = 1 + (((gunNo * 7 + sira * 13) % 21) - 10) / 100;
  const tutar = Math.round(s.tutar * oynama * 100) / 100;
  const tarih = `${gunMetni(gun)} ${s.saat}`;
  const h = HESAPLAR.find((x) => x.id === s.hesapId)!;
  const alacakli = tutar >= 0;
  return {
    id: gunNo * 100 + sira,
    vms_transaction_type: s.tip,
    bank_account_id: s.hesapId,
    key: `sahte-${gunNo}-${sira}`,
    transaction_type: s.bankaKodu,
    mt940transaction_type: s.bankaKodu === "EFT" || s.bankaKodu === "FAST" ? "NTRF" : "NMSC",
    system_date: tarih,
    accounting_date: `${gunMetni(gun)} 00:00:00`,
    sender_identity_number: alacakli ? s.gonderenTckn ?? null : null,
    sender_name: alacakli ? s.gonderenAd ?? null : null,
    sender_branch: null,
    sender_title: alacakli ? s.karsiUnvan ?? "" : "",
    sender_iban: alacakli ? s.karsiIban ?? null : h.iban,
    sender_taxno: alacakli ? s.karsiVkn ?? null : null,
    reciever_iban: alacakli ? h.iban : s.karsiIban ?? null,
    opponent_title: s.karsiUnvan ?? s.gonderenAd ?? "",
    opponent_iban: s.karsiIban ?? null,
    opponent_taxno: s.karsiVkn ?? s.gonderenTckn ?? null,
    fis_no: `9300${gunMetni(gun).replace(/-/g, "")}${iki(sira)}`,
    payer_tax_no: null,
    description: s.aciklama,
    fec_name: h.fec_name,
    amount: tutar.toFixed(2),
    current_balance: (Number(h.balance) + ((gunNo * 31 + sira * 17) % 5000)).toFixed(2),
    resource_code: `EVR${gunNo}${iki(sira)}`,
    type: alacakli ? "alacakli" : "borclu",
    note: null,
    order: sira,
    created_at: tarih,
    tags: [],
    account: { ...h, bank: bankaOzeti(h.bank_id) },
  };
};

const hareketler = (sorgu: Sorgu, hesapId?: number) => {
  const bas = vomsisTarihi(sorgu.beginDate, false);
  const bit = vomsisTarihi(sorgu.endDate, true);
  if (bas === null || bit === null) return { status: "error", message: "beginDate ve endDate zorunludur (GG-AA-YYYY SS:DD:ss)." };

  // Gelecek tarihli hareket olmaz
  const sonGun = Math.min(Math.floor(bit / GUN_MS), Math.floor(Date.now() / GUN_MS));
  const tipler = sorgu.types ? String(sorgu.types).split(",").map((t) => t.trim()) : null;
  const liste: ReturnType<typeof hareketUret>[] = [];

  for (let gunNo = Math.floor(bas / GUN_MS); gunNo <= sonGun; gunNo++) {
    // Hafta sonu banka hareketi üretme (1970-01-01 perşembe)
    const haftaGunu = (gunNo + 4) % 7;
    if (haftaGunu === 0 || haftaGunu === 6) continue;
    SABLONLAR.forEach((s, i) => {
      if (s.herGun && gunNo % s.herGun !== 0) return;
      if (hesapId && s.hesapId !== hesapId) return;
      if (tipler && !tipler.includes(s.tip)) return;
      const h = hareketUret(s, i + 1, gunNo);
      const an = Date.parse(h.system_date.replace(" ", "T") + "Z");
      if (an < bas || an > bit) return;
      if (sorgu.lastId && h.id <= Number(sorgu.lastId)) return;
      if (sorgu.type && h.type !== sorgu.type) return;
      if (sorgu.bankName && h.account.bank.bank_name !== sorgu.bankName) return;
      liste.push(h);
    });
  }
  return { status: "success", transactions: liste };
};

// ─── Fiziksel POS (POS Rapor) ────────────────────────────────────────────────

const TERMINALLER = [
  { id: 1, bank_name: "garanti", bank_title: "Garanti BBVA", status: 1, workplace_no: "0123456", station_no: "VMS12345", workplace_name: "ÖRNEK KUYUMCULUK", transaction_currency: "TL", custom_name: "Mağaza Kasa 1", commission_rate: "1.79" },
  { id: 2, bank_name: "akbank", bank_title: "Akbank", status: 1, workplace_no: "7654321", station_no: "AKB55021", workplace_name: "ÖRNEK KUYUMCULUK", transaction_currency: "TL", custom_name: "Mağaza Kasa 2", commission_rate: "1.65" },
];

const KARTLAR = [
  { no: "5571********5575", tip: "MASTERCARD", aciklama: "PESIN YI KART" },
  { no: "4546********7894", tip: "VISA", aciklama: "PESIN YI KART" },
  { no: "5400********1122", tip: "MASTERCARD", aciklama: "TAKSITLI SATIS" },
  { no: "4022********3301", tip: "VISA", aciklama: "PESIN YD KART" },
];

const noktaliGun = (d: Date) => `${iki(d.getUTCDate())}.${iki(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;

/** Vomsis POS sorgusunda tarih aralığı en fazla 14 gündür. */
const posHareketleri = (terminalId: number, sorgu: Sorgu) => {
  const terminal = TERMINALLER.find((t) => t.id === terminalId);
  if (!terminal) return { status: "error", message: "Terminal bulunamadı." };
  const bas = vomsisTarihi(sorgu.beginDate, false);
  const bit = vomsisTarihi(sorgu.endDate, true);
  if (bas === null || bit === null) return { status: "error", message: "beginDate ve endDate zorunludur (GG-AA-YYYY)." };
  if (bit - bas > 14 * GUN_MS) return { status: "error", message: "Tarih aralığı en fazla 14 gün olabilir." };

  const sonGun = Math.min(Math.floor(bit / GUN_MS), Math.floor(Date.now() / GUN_MS));
  const oran = Number(terminal.commission_rate);
  const liste: Record<string, unknown>[] = [];

  for (let gunNo = Math.floor(bas / GUN_MS); gunNo <= sonGun; gunNo++) {
    if ((gunNo + 4) % 7 === 0) continue; // pazar kapalı
    const gun = new Date(gunNo * GUN_MS);
    const valor = new Date((gunNo + 1) * GUN_MS);
    const adet = 2 + ((gunNo + terminalId) % 3);
    for (let i = 1; i <= adet; i++) {
      const id = gunNo * 1000 + terminalId * 100 + i;
      if (sorgu.lastId && id <= Number(sorgu.lastId)) continue;
      const kart = KARTLAR[(gunNo + i + terminalId) % KARTLAR.length];
      const taksit = kart.aciklama.startsWith("TAKSIT") ? 3 : 0;
      const brut = 2500 + ((gunNo * 37 + i * 911 + terminalId * 53) % 48000);
      const komisyon = Math.round(brut * oran) / 100;
      const saat = `${iki(10 + ((gunNo + i * 3) % 9))}.${iki((gunNo * 7 + i * 11) % 60)}.${iki((i * 17) % 60)}`;
      liste.push({
        id,
        award_contribution: null, batchn: String(100 + (gunNo % 900)), blocked_date: null, blocked_no: null, block_time: null,
        card_number: kart.no, card_type: null, chain_no: null,
        commission: komisyon.toFixed(2), commission_rate: oran.toFixed(2), confirmation_number: String(100000 + (id % 899999)),
        date: noktaliGun(gun), description: kart.aciklama, end_of_day_date: gunMetni(gun), exchange: "TL", extra_award_contribution: null,
        gross_amount: brut.toFixed(2), iklcom_chip: null, installments_count: taksit, installments_order: 0, kesilen_chip: null,
        key: `sahte-pos-${id}`, net_amount: (brut - komisyon).toFixed(2), net_chip: null, product_class: null,
        provision_date: null, provision_no: String(500000 + (id % 499999)), reference_number: null, registration_date: noktaliGun(gun),
        service_com: null, sm_award_contribution: null, station: terminal.station_no, sub_card_type: kart.tip,
        system_date: `${gunMetni(gun)} ${saat.replace(/\./g, ":")}`, time: saat, transaction_end_date: null, transaction_no: null,
        transaction_type: "Satış", transfer_to_account_date: null, valor: noktaliGun(valor), vrcom_chip: null,
        workplace: terminal.workplace_no, workplace_social_contribution: null,
      });
    }
  }
  return { status: "success", transactions: liste };
};

// ─── Uç tablosu ──────────────────────────────────────────────────────────────

const bankaYanitlari: Record<string, SahteYanit> = {
  "GET /pos-rapor/stations": () => ({ success: "true", data: TERMINALLER }),
  "GET /banks": () => ({ status: "success", banks: BANKALAR }),
  "GET /accounts": () => ({ status: "success", accounts: HESAPLAR }),
  "GET /transaction_types": () => ({ status: "success", transaction_types: HAREKET_TIPLERI.map(([type_no, type_name]) => ({ type_no, type_name })) }),
  "GET /transactions": (sorgu) => hareketler(sorgu),
};

// ─── Sanal POS (bellekte durum tutar; sunucu yeniden başlayınca sıfırlanır) ───

interface SahteLink {
  uid: string;
  baslik: string;
  tutar: string;
  telefon: string | null;
  email: string | null;
  gecerlilik: string;
  lang: string;
  inputs: unknown;
  maxTaksit: number;
  paraBirimi: string;
  sms: boolean;
  mail: boolean;
  olusturma: number;
  aciklama: string | null;
}

const sahteLinkler = new Map<string, SahteLink>();
const sahteIadeler = new Map<string, { tur: "refund" | "cancel"; tutar: number }>();
let sahteSayac = 0;

/** Örnek veride ödeme linki, oluşturulduktan 1 dakika sonra "ödenmiş" sayılır (ödeme akışı sınanabilsin diye). */
const SAHTE_ODEME_GECIKMESI_MS = 60_000;
const linkOdendiMi = (l: SahteLink) => Date.now() - l.olusturma >= SAHTE_ODEME_GECIKMESI_MS;
// uid'nin değişen kısmı sonundadır; referans ondan türetilir ki linkler arasında çakışmasın
const linkReferansi = (l: SahteLink) => `68VL${l.uid.replace(/-/g, "").slice(-16).toUpperCase()}`;
const tamZaman = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

const linkDetayi = (l: SahteLink) => ({
  uid: l.uid,
  title: l.baslik,
  status: linkOdendiMi(l) ? "Paid" : "Pending",
  installments: l.maxTaksit,
  information_email: l.email,
  information_phone: l.telefon,
  email_notification: l.mail ? "Active" : "Inactive",
  sms_notification: l.sms ? "Active" : "Inactive",
  payment_info: {
    link: `https://demotahsilat.odemetahsilat.com/?tuid=${l.uid}`,
    amount: `${l.tutar} ${l.paraBirimi}`,
    expire_date: l.gecerlilik,
    description: l.aciklama,
    created_date: tamZaman(l.olusturma),
  },
});

/** Kartla ödeme (örnek): kart verisi tutulmaz; yalnızca tutar ve maskeli numara. */
interface SahteKartOdemesi {
  ref: string;
  tutar: string;
  paraBirimi: string;
  taksit: number;
  oran: number;
  maskeliKart: string;
  aciklama: string | null;
  zaman: number;
}
const sahteKartOdemeleri = new Map<string, SahteKartOdemesi>();

const taksitSecenekleri = (oranlar: number[]) =>
  oranlar.map((rate, i) => ({ installment: i === 0 ? 1 : i + 1, title: i === 0 ? "Tek Çekim" : `${i + 1} Taksit`, status: "true", rate, extra_installment: 0, discount_rate: 0 }));

const kartIslemi = (k: SahteKartOdemesi, sira: number) => {
  const iade = sahteIadeler.get(k.ref);
  return {
    id: 900 + sira, pos_id: 22, musteri_id: null, referans_kodu: k.ref, aciklama: k.aciklama, islem_tarihi: tamZaman(k.zaman), tutar: k.tutar, para_birimi: k.paraBirimi,
    taksit: k.taksit, taksit_oran: k.oran.toFixed(4), taksit_tutar: "0.00", kredi_kart_no: k.maskeliKart, kredi_kart_banka: "AKBANK T.A.Ş.", ip_adresi: "123.123.123.123",
    hata_kodu: "00", hata_mesaji: "", durum: 1, tur: iade ? (iade.tur === "cancel" ? "iptal" : "iade") : "islem", order_id: k.ref, trans_id: k.ref,
    pos_name: "VOMSİS NKOLAY", cc_family: "Axess", cc_org: "master_card", cc_type: "CREDIT_CARD", iade_tutar: iade ? iade.tutar.toFixed(2) : null,
    tahsilat_id: null, invoiceType: "individual", invoiceEmail: null, invoicePhone: null, created_at: tamZaman(k.zaman), tahsilat: null,
  };
};

const sahteIslemler = () => [...linkIslemleri(), ...[...sahteKartOdemeleri.values()].map(kartIslemi)];

const linkIslemleri = () =>
  [...sahteLinkler.values()].filter(linkOdendiMi).map((l, i) => {
    const ref = linkReferansi(l);
    const iade = sahteIadeler.get(ref);
    return {
      id: 700 + i,
      pos_id: 22,
      musteri_id: 1400 + i,
      referans_kodu: ref,
      aciklama: l.baslik,
      islem_tarihi: tamZaman(l.olusturma + SAHTE_ODEME_GECIKMESI_MS),
      tutar: l.tutar,
      para_birimi: l.paraBirimi,
      taksit: 1,
      taksit_oran: "0.0000",
      taksit_tutar: "0.00",
      kredi_kart_no: "557113******5575",
      kredi_kart_banka: "AKBANK T.A.Ş.",
      ip_adresi: "123.123.123.123",
      hata_kodu: "00",
      hata_mesaji: "",
      durum: 1,
      tur: iade ? (iade.tur === "cancel" ? "iptal" : "iade") : "islem",
      order_id: ref,
      trans_id: ref,
      pos_name: "VOMSİS NKOLAY",
      cc_family: "Axess",
      cc_org: "master_card",
      cc_type: "CREDIT_CARD",
      iade_tutar: iade ? iade.tutar.toFixed(2) : null,
      tahsilat_id: 290 + i,
      invoiceType: "individual",
      invoiceEmail: l.email,
      invoicePhone: l.telefon,
      created_at: tamZaman(l.olusturma + SAHTE_ODEME_GECIKMESI_MS),
      tahsilat: { uid: l.uid, baslik: l.baslik },
    };
  });

const htmlKacis = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const vposYanitlari: Record<string, SahteYanit> = {
  "POST /installments": () => ({
    pos_banks: [
      { bank_name: "akbank", family: "Axess", installment: taksitSecenekleri([0, 2.1, 3.2, 4.3, 5.4, 6.5]) },
      { bank_name: "isbank", family: "Maximum", installment: taksitSecenekleri([0, 2.2, 3.3]) },
      { bank_name: "garanti", family: "Bonus", installment: taksitSecenekleri([0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0]) },
    ],
  }),
  "POST /bin-check": (_s, govde) => {
    const bin = String((govde as any)?.cc_number ?? "");
    if (!/^\d{6}$/.test(bin)) return { success: false, message: "BIN 6 hane olmalıdır." };
    const visa = bin.startsWith("4");
    return {
      data: {
        card_info: { bin_check_company: 2, bank_name: visa ? "T.C.ZİRAAT BANKASI A.Ş." : "AKBANK T.A.Ş.", card_type: "CREDIT_CARD", card_association: visa ? "visa" : "master_card", card_family_name: visa ? "COMBO" : "Axess" },
        installments: [0, 2.1, 3.2, 4.3, 5.4, 6.5].map((ratio, i) => ({ pos_id: 22, block_rate: "0", currency: "TRY", installment: i + 1, title: i === 0 ? "Tek Çekim" : `${i + 1} Taksit`, amount: "0", ratio: String(ratio) })),
      },
    };
  },
  // Örnek 3D ekranı: gerçek banka yerine tek bağlantılı bir sayfa döner; ödeme "başarılı" sayılır
  "POST /payment": (_s, govde) => {
    const g = (govde || {}) as Record<string, any>;
    if (!g.referanceNo || !(Number(g.amount) > 0) || !g.returnUrl) return { success: false, message: "referanceNo, amount ve returnUrl zorunludur." };
    const pan = String(g.creditCardPan || "");
    sahteKartOdemeleri.set(String(g.referanceNo), {
      ref: String(g.referanceNo),
      tutar: Number(g.amount).toFixed(2),
      paraBirimi: g.currency || "TRY",
      taksit: Number(g.installment) || 1,
      oran: Number(g.installment_ratio) || 0,
      maskeliKart: `${pan.slice(0, 6)}******${pan.slice(-4)}`,
      aciklama: g.paymentNote || null,
      zaman: Date.now(),
    });
    return {
      htmlContent:
        `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Örnek 3D Secure</title></head>` +
        `<body style="font-family:sans-serif;max-width:420px;margin:60px auto;text-align:center">` +
        `<h3>Örnek 3D Secure ekranı</h3><p>Test (örnek veri) modu: gerçek banka yok, karttan para çekilmez.</p>` +
        `<p><b>${htmlKacis(Number(g.amount).toFixed(2))} ${htmlKacis(String(g.currency || "TRY"))}</b></p>` +
        `<form method="post" action="${htmlKacis(String(g.returnUrl))}"><button type="submit" style="padding:10px 24px">Doğrulamayı Tamamla</button></form></body></html>`,
    };
  },
  "POST /request-payment": (_s, govde) => {
    const g = (govde || {}) as Record<string, any>;
    if (!(Number(g.amount) > 0)) return { success: false, message: "Tutar 0'dan büyük olmalı." };
    sahteSayac++;
    const uid = `00000000-0000-4000-8000-${String(Date.now()).slice(-8)}${String(sahteSayac).padStart(4, "0")}`;
    const l: SahteLink = {
      uid,
      baslik: g.title || "Yeni Ödeme",
      tutar: Number(g.amount).toFixed(2),
      telefon: g.phone || null,
      email: g.email || null,
      gecerlilik: g.expire_date || "31.12.2099",
      lang: g.lang || "tr",
      inputs: g.inputs || null,
      maxTaksit: Number(g.max_installments) || 0,
      paraBirimi: g.currency || "TRY",
      sms: Boolean(g.sms_notification),
      mail: Boolean(g.mail_notification),
      olusturma: Date.now(),
      aciklama: g.inputs?.description?.value || null,
    };
    sahteLinkler.set(uid, l);
    return { success: true, requestDetail: linkDetayi(l) };
  },
  "GET /request-payment": (sorgu) => ({
    success: true,
    items: {
      current_page: Number(sorgu.page) || 1,
      // Örnek veride tek sayfa
      data: (Number(sorgu.page) || 1) > 1 ? [] : [...sahteLinkler.values()].reverse().map((l) => ({
        uid: l.uid, baslik: l.baslik, tutar: l.tutar, telefon: l.telefon, gecerlilik_tarihi: l.gecerlilik, lang: l.lang, inputs: l.inputs,
        max_taksit: l.maxTaksit, para_birimi: l.paraBirimi, durum: linkOdendiMi(l) ? "Ödendi" : "Bekliyor",
      })),
      last_page: 1,
    },
  }),
  "GET /transactions-list": (sorgu) => {
    const hepsi = sahteIslemler();
    const s = String(sorgu.status || "");
    const suzulmus = s === "refund" ? hepsi.filter((i) => i.tur === "iade") : s === "cancel" ? hepsi.filter((i) => i.tur === "iptal") : s === "failed" ? [] : hepsi;
    return { success: true, data: suzulmus };
  },
  "GET /transaction/find": (sorgu) => {
    const i = sahteIslemler().find((x) => x.referans_kodu === sorgu.referanceNo);
    if (!i) return { success: false, message: "İşlem bulunamadı." };
    return {
      success: true,
      data: {
        referanceNo: i.referans_kodu, transactionDate: i.islem_tarihi, posName: i.pos_name, errorCode: "00", errorMessage: "", maskedPan: i.kredi_kart_no,
        creditCardBank: i.kredi_kart_banka, clientIp: i.ip_adresi, amount: i.tutar,
        paidAmount: (Number(i.tutar) * (1 + Number(i.taksit_oran) / 100)).toFixed(2), installment: i.taksit, installmentRatio: i.taksit_oran,
        description: i.aciklama, status: "Başarılı", customInputs: {},
      },
    };
  },
  "POST /transaction": (_s, govde) => {
    const g = (govde || {}) as Record<string, any>;
    const i = sahteIslemler().find((x) => x.referans_kodu === g.referanceNo);
    if (!i) return { transId: null, response: "Error", proc_return_code: "99", error_code: "NOT_FOUND", error_message: "İşlem bulunamadı." };
    if (sahteIadeler.has(i.referans_kodu)) return { transId: null, response: "Declined", proc_return_code: "05", error_code: "ALREADY", error_message: "İşlem daha önce iptal/iade edilmiş." };
    const tutar = g.transactionType === "refund" ? Number(g.amount) : Number(i.tutar);
    if (!(tutar > 0) || tutar > Number(i.tutar)) return { transId: null, response: "Declined", proc_return_code: "05", error_code: "AMOUNT", error_message: "İade tutarı geçersiz." };
    sahteIadeler.set(i.referans_kodu, { tur: g.transactionType === "refund" ? "refund" : "cancel", tutar });
    return { transId: String(Date.now()), response: "Approved", proc_return_code: "00", error_code: null, error_message: null };
  },
  "GET /customers": () => [
    { id: 1466, email: "ornek@musteri.com", related: [], companyTitle: "ÖRNEK KUYUMCULUK SAN. TİC. LTD. ŞTİ.", invoices: [] },
    { id: 1465, email: "ayse@ornek.com", related: [], companyTitle: "AYŞE ÖRNEK", invoices: [] },
  ],
};

export const SAHTE_TOKEN = "sahte-token";

/** Tanımlı değilse undefined döner; istemci bunu "bu uç sahte modda henüz yok" hatasına çevirir. */
export const sahteYanit = (servis: "banka" | "vpos", metod: string, yol: string, sorgu: Sorgu = {}, govde?: unknown): unknown => {
  const tablo = servis === "banka" ? bankaYanitlari : vposYanitlari;
  const temizYol = yol.split("?")[0];
  const yanit = tablo[`${metod.toUpperCase()} ${temizYol}`];
  if (yanit) return yanit(sorgu, govde);

  // Yol parametreli uçlar
  const pos = /^\/pos-rapor\/stations\/(\d+)\/transactions$/.exec(temizYol);
  if (servis === "banka" && metod.toUpperCase() === "GET" && pos) return posHareketleri(Number(pos[1]), sorgu);

  const link = /^\/request-payment\/([^/]+)$/.exec(temizYol);
  if (servis === "vpos" && link) {
    const l = sahteLinkler.get(decodeURIComponent(link[1]));
    if (!l) return { success: false, message: "Ödeme talebi bulunamadı." };
    if (metod.toUpperCase() === "GET") return { success: true, requestDetail: linkDetayi(l) };
    if (metod.toUpperCase() === "DELETE") {
      sahteLinkler.delete(l.uid);
      return { success: true, message: "Ödeme talebi başarılı bir şekilde silindi." };
    }
  }
  return undefined;
};
