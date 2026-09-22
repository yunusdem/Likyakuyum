import React from "react";
import { v4 as uuid } from "uuid";
import {
  IconCoins,
  IconBuildingBank,
  IconChartLine,
  IconUsers,
  IconShieldLock,
  IconCreditCard,
  IconReportAnalytics,
  IconBarcode,
  IconFileTypePdf,
  IconBuildingStore,
  IconSettings,
} from "@tabler/icons-react";

//import custom type
import { MenuItemType } from "types/menuTypes";
import { raporLinki, raporlarMenusu } from "../services/raporService";

// Rapor maddeleri eski programın rapor klasörlerindeki yerlerinde durur (vezne / kasa / cari / yonetici / raporlar + MASAK);
// bu maddeler tek rapor sayfasını açar: /raporlar/<yol> (src/services/raporService.ts RAPOR_MENU).
const raporMenu = raporlarMenusu();

export const DashboardMenu: MenuItemType[] = [
  // A- Vezne İşlemleri
  {
    id: uuid(),
    key: "vezne", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "A- Vezne İşlemleri",
    icon: <IconCoins size={18} />,
    children: [
      { id: uuid(), name: "A- Sarraf Fişi Kayıt", link: "vezne/sarraf-fisi-kayit" },
      { id: uuid(), name: "B- Sarraf Fişi Düzeltme", link: "vezne/sarraf-fisi-duzeltme" },
      { id: uuid(), name: "C- Perakende Fişi Kayıt", link: "vezne/perakende-fisi-kayit" },
      { id: uuid(), name: "D- Perakende Fişi Düzeltme", link: "vezne/perakende-fisi-duzeltme" },
      { id: uuid(), name: "E- Döviz Fişi Kayıt", link: "vezne/doviz-fisi-kayit" },
      { id: uuid(), name: "F- Döviz Fişi Düzeltme", link: "vezne/doviz-fisi-duzeltme" },
      { id: uuid(), name: "G- Vezne Transferi Kayıt", link: "vezne/transfer-kayit" },
      { id: uuid(), name: "H- Vezne Transferi Düzeltme", link: "vezne/transfer-duzeltme" },
      { id: uuid(), name: "I- Vezne Hareket Listesi", link: raporLinki("VEZHAR1") },
      { id: uuid(), name: "J- Vezne Bakiye Raporu", link: raporLinki("VEZANL1") },
      { id: uuid(), name: "K- Fiyat Kontrolü", link: "vezne/fiyat-kontrolu" },
      { id: uuid(), name: "L- Vezne Bakiye Raporu Tarih Bazlı", link: raporLinki("VEZBAK1") },
      { id: uuid(), name: "M- Vezne Para Say", link: "vezne/para-say" },
      { id: uuid(), name: "N- Vezne İzleme", link: "vezne/izleme" },
      { id: uuid(), name: "O- Kur Kontrolü", link: raporLinki("KURKON2") },
      { id: uuid(), name: "P- Kur Sapma Raporu", link: raporLinki("KURKON1") },
    ],
  },

  // B- Kasa İşlemleri
  {
    id: uuid(),
    key: "kasa", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "B- Kasa İşlemleri",
    icon: <IconBuildingBank size={18} />,
    children: [
      { id: uuid(), name: "A- Hesap Kayıt", link: "kasa/hesap-kayit" },
      { id: uuid(), name: "B- Hesap Düzeltme", link: "kasa/hesap-duzeltme" },
      { id: uuid(), name: "C- Kasa Hareket Kayıt", link: "kasa/hareket-kayit" },
      { id: uuid(), name: "D- Kasa Hareket Düzeltme", link: "kasa/hareket-duzeltme" },
      { id: uuid(), name: "E- Kasa Defteri", link: raporLinki("KASDEF1") },
      { id: uuid(), name: "F- Kasa Hareket Listesi", link: raporLinki("KASHAR1") },
      { id: uuid(), name: "G- Hesap Ekstre", link: raporLinki("HESEKS1") },
      { id: uuid(), name: "H- Hesap Bakiye Raporu", link: raporLinki("HESBAK1") },
      { id: uuid(), name: "I- Hesap Ad Listesi", link: "kasa/hesap-ad-listesi" },
    ],
  },

  // C- Kur İşlemleri
  {
    id: uuid(),
    key: "kur", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "C- Kur İşlemleri",
    icon: <IconChartLine size={18} />,
    children: [
      { id: uuid(), name: "A- Anlık Fiyat Listesi", link: "kur/anlik-fiyat-listesi" },
      { id: uuid(), name: "B- Saklanan Fiyat Listesi", link: "kur/saklanan-fiyat-listesi" },
      { id: uuid(), name: "C- Pano", link: "kur/pano" },
      { id: uuid(), name: "D- Pano Tanımı", link: "kur/pano-tanimi" },
    ],
  },

  // D- Cari İşlemler
  {
    id: uuid(),
    key: "cari", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "D- Cari İşlemler",
    icon: <IconUsers size={18} />,
    children: [
      { id: uuid(), name: "A- Cari Kart Kayıt", link: "cari/kart-kayit" },
      { id: uuid(), name: "B- Cari Kart Düzeltme", link: "cari/kart-duzeltme" },
      { id: uuid(), name: "C- Cari Hareket Kayıt", link: "cari/hareket-kayit" },
      { id: uuid(), name: "D- Cari Hareket Düzeltme", link: "cari/hareket-duzeltme" },
      { id: uuid(), name: "E- Cari Emanet Dekont Kayıt", link: "cari/emanet-dekont" },
      { id: uuid(), name: "F- Cari Emanet Dekont Düzeltme", link: "cari/emanet-duzeltme" },
      { id: uuid(), name: "G- Cari Hareket Listesi", link: "cari/hareket-listesi" },
      { id: uuid(), name: "H- Cari Kart Listesi", link: "cari/kart-listesi" },
      { id: uuid(), name: "I- Detaylı Cari Kart Listesi", link: "cari/detayli-kart-listesi" },
      { id: uuid(), name: "J- Cari Ekstre", link: raporLinki("CAREKS1") },
      { id: uuid(), name: "K- Cari Bakiye Raporu", link: raporLinki("CARBAK1") },
      { id: uuid(), name: "L- POS Ekstre", link: raporLinki("POSEKS1") },
      { id: uuid(), name: "M- Vadeli İşlem Listesi", link: raporLinki("VADISL1") },
    ],
  },

  // E- Yönetici İşlemleri
  {
    id: uuid(),
    key: "yonetici", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "E- Yönetici İşlemleri",
    icon: <IconShieldLock size={18} />,
    children: [
      { id: uuid(), name: "A- Anlık Fiyat Listesi", link: "kur/anlik-fiyat-listesi" },
      { id: uuid(), name: "B- Vezne İzleme", link: "vezne/izleme" },
      { id: uuid(), name: "C- Barkod Fiyat", link: "etiket/barkod-basimi" },
      { id: uuid(), name: "D- Sarraf Fişi Kayıt", link: "vezne/genel-sarraf-fisi" },
      { id: uuid(), name: "E- Döviz Fişi Kayıt", link: "vezne/doviz-fisi" },
      { id: uuid(), name: "F- Perakende Fişi Kayıt", link: "vezne/perakende-fisi-kayit" },
      { id: uuid(), name: "G- Banka Hesap Hareketleri", link: "banka/hareketler" },
      { id: uuid(), name: "H- Cari Hareket Kayıt", link: "cari/hareket-kayit" },
      { id: uuid(), name: "I- e-Belge", link: "e-belge" },
      { id: uuid(), name: "J- Firma Son Durum Raporu", link: raporLinki("FIRSON1") },
      { id: uuid(), name: "K- Firma Varlıkları Raporu", link: raporLinki("FIRVAR1") },
      { id: uuid(), name: "L- Kâr / Zarar Faaliyet Analizi", link: raporLinki("KARZAR1") },
      { id: uuid(), name: "M- Long / Short Denge Analizi", link: raporLinki("LONSHO1") },
    ],
  },

  // F- Banka / POS İşlemleri
  {
    id: uuid(),
    key: "banka", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "F- Banka / POS İşlemleri",
    icon: <IconCreditCard size={18} />,
    children: [
      { id: uuid(), name: "A- Banka Hesap Kartları", link: "banka/hesap-kartlari" },
      { id: uuid(), name: "B- POS Cihazı Tanımları", link: "banka/pos-tanimlari" },
      { id: uuid(), name: "C- Banka Hesap Hareketleri", link: "banka/hareketler" },
      { id: uuid(), name: "D- Kredi Kartı Tahsilatları", link: "banka/kredi-karti-tahsilat" },
      { id: uuid(), name: "E- POS Gün Sonu İşlemleri", link: "banka/pos-gun-sonu" },
      // Vomsis açık bankacılık (docs/EBANKA_VOMSIS_YOL_HARITASI.md). Grup kodu "banka:#f-e-banka" kalıcıdır — başlığı değiştirmeyin.
      {
        id: uuid(),
        title: "F- e-Banka",
        children: [
          { id: uuid(), name: "A- Özet", link: "ebanka/ozet" },
          { id: uuid(), name: "B- Hesaplar", link: "ebanka/hesaplar" },
          { id: uuid(), name: "C- Hesap Hareketleri", link: "ebanka/hareketler" },
          { id: uuid(), name: "D- Bekleyenler", link: "ebanka/bekleyenler" },
          { id: uuid(), name: "E- POS Terminalleri ve Hareketleri", link: "ebanka/pos" },
          { id: uuid(), name: "F- Sanal POS Tahsilat", link: "ebanka/sanal-pos-tahsilat" },
          { id: uuid(), name: "G- Ödeme Linkleri", link: "ebanka/odeme-linkleri" },
          { id: uuid(), name: "H- Sanal POS İşlemleri", link: "ebanka/sanal-pos-islemleri" },
          { id: uuid(), name: "I- Ayarlar", link: "ebanka/ayarlar" },
          { id: uuid(), name: "J- Tahsilat / Ödeme Mutabakatı", link: "ebanka/mutabakat" },
        ],
      },
    ],
  },

  // G- Raporlar
  {
    id: uuid(),
    key: "raporlar", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "G- Raporlar",
    icon: <IconReportAnalytics size={18} />,
    // "raporlar" klasöründeki raporlar + açılır MASAK grubu; diğer klasörlerin raporları kendi işlem menülerinde (docs/raporlar-faz2.md)
    children: [
      ...raporMenu.raporlar.map(r => ({ id: uuid(), name: r.ad, link: r.link })),
      { id: uuid(), title: raporMenu.masakBaslik, children: raporMenu.masak.map(r => ({ id: uuid(), name: r.ad, link: r.link })) },
    ],
  },

  // H- e-Belge → e-Belge ana sayfası (eski "Belge / Fiş PDF" sayfası kaldırıldı)
  {
    id: uuid(),
    key: "ebelge", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "H- e-Belge",
    icon: <IconFileTypePdf size={18} />,
    link: "e-belge",
  },

  // I- Etiket İşlemleri
  {
    id: uuid(),
    key: "etiket", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "I- Etiket İşlemleri",
    icon: <IconBarcode size={18} />,
    children: [
      { id: uuid(), name: "A- Barkod Fiyat", link: "etiket/barkod-fiyat" },
      { id: uuid(), name: "B- Altın Ürün Barkodlama", link: "etiket/altin-urun-barkodlama" },
      { id: uuid(), name: "C- Altın Ürün Düzeltme", link: "etiket/altin-urun-duzeltme" },
      { id: uuid(), name: "D- Özel Ürün Barkodlama", link: "etiket/ozel-urun-barkodlama" },
      { id: uuid(), name: "E- Özel Ürün Düzeltme", link: "etiket/ozel-urun-duzeltme" },
      { id: uuid(), name: "F- Altın Etiket Tasarımı", link: "etiket/altin-etiket-tasarimi" },
      { id: uuid(), name: "G- Özel Ürün Etiket Tasarımı", link: "etiket/ozel-urun-etiket-tasarimi" },
      { id: uuid(), name: "H- Barkodlu Ürün Sayım Fişi", link: "etiket/sayim-fisi" },
    ],
  },

  // J- Perakende İşlemleri
  {
    id: uuid(),
    key: "perakende", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "J- Perakende İşlemleri",
    icon: <IconBuildingStore size={18} />,
    children: [
      { id: uuid(), name: "A- Perakende Satış", link: "perakende/satis" },
      { id: uuid(), name: "B- Perakende Alış / İade", link: "perakende/iade" },
      { id: uuid(), name: "C- Vitrin & Stok Takibi", link: "perakende/vitrin-stok" },
      { id: uuid(), name: "D- Barkodlu Hızlı Satış", link: "perakende/hizli-satis" },
      { id: uuid(), name: "E- Günlük Satış Listesi", link: "perakende/liste" },
    ],
  },

  // K- Ayarlar
  {
    id: uuid(),
    key: "ayarlar", // kalıcı modül kodu — değiştirmeyin (src/config/modulKatalogu.ts)
    title: "K- Ayarlar",
    icon: <IconSettings size={18} />,
    children: [
      { id: uuid(), name: "A- Ürün Tanımları", link: "ayarlar/urun-tanimlari" },
      { id: uuid(), name: "B- Banknot Tanımları", link: "ayarlar/banknot-tanimlari" },
      { id: uuid(), name: "C- İstatistik Tanımları", link: "ayarlar/istatistik-tanimlari" },
      { id: uuid(), name: "D- Vezne Tanımları", link: "ayarlar/vezne-tanimlari" },
      { id: uuid(), name: "E- Kullanıcı Tanımları", link: "ayarlar/kullanici-tanimlari" },
      { id: uuid(), name: "F- Yazıcı Tanımları", link: "ayarlar/yazici-tanimlari" },
      { id: uuid(), name: "G- Numaratörler", link: "ayarlar/numeratorler" },
      { id: uuid(), name: "H- Devir İşlemi", link: "ayarlar/devir-islemi" },
      { id: uuid(), name: "I- Servis İşlemleri", link: "ayarlar/servis-islemleri" },
      { id: uuid(), name: "J- MASAK Malvarlıkları Dondurulanlar", link: "ayarlar/masak-dondurulanlar" },
      { id: uuid(), name: "K- Firma Tanımları", link: "ayarlar/firma-tanimlari" },
    ],
  },
];
