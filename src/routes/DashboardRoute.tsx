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
  IconBuildingStore,
  IconSettings,
} from "@tabler/icons-react";

//import custom type
import { MenuItemType } from "types/menuTypes";

export const DashboardMenu: MenuItemType[] = [
  // A- Vezne İşlemleri
  {
    id: uuid(),
    title: "A- Vezne İşlemleri",
    icon: <IconCoins size={18} />,
    children: [
      { id: uuid(), name: "A- Genel Sarraf Fişi", link: "vezne/genel-sarraf-fisi" },
      { id: uuid(), name: "B- Perakende Fişi", link: "vezne/perakende-fisi" },
      { id: uuid(), name: "C- Vezne Transferi Kayıt", link: "vezne/transfer-kayit" },
      { id: uuid(), name: "D- Vezne Transferi Düzeltme", link: "vezne/transfer-duzeltme" },
      { id: uuid(), name: "E- Vezne Hareket Listesi", link: "vezne/hareket-listesi" },
      { id: uuid(), name: "F- Vezne Bakiye Raporu", link: "vezne/bakiye-raporu" },
      { id: uuid(), name: "G- Fiyat Kontrolü", link: "vezne/fiyat-kontrolu" },
      { id: uuid(), name: "H- Vezne Bakiye Raporu Tarih Bazlı", link: "vezne/bakiye-raporu-tarih-bazli" },
      { id: uuid(), name: "I- Vezne Para Say", link: "vezne/para-say" },
      { id: uuid(), name: "J- Vezne İzleme", link: "vezne/izleme" },
    ],
  },

  // B- Kasa İşlemleri
  {
    id: uuid(),
    title: "B- Kasa İşlemleri",
    icon: <IconBuildingBank size={18} />,
    children: [
      { id: uuid(), name: "A- Hesap Kayıt", link: "kasa/hesap-kayit" },
      { id: uuid(), name: "B- Hesap Düzeltme", link: "kasa/hesap-duzeltme" },
      { id: uuid(), name: "C- Kasa Hareket Kayıt", link: "kasa/hareket-kayit" },
      { id: uuid(), name: "D- Kasa Hareket Düzeltme", link: "kasa/hareket-duzeltme" },
      { id: uuid(), name: "E- Kasa Defteri", link: "kasa/defteri" },
      { id: uuid(), name: "F- Kasa Hareket Listesi", link: "kasa/hareket-listesi" },
      { id: uuid(), name: "G- Hesap Ekstre", link: "kasa/hesap-ekstre" },
      { id: uuid(), name: "H- Hesap Bakiye Raporu", link: "kasa/hesap-bakiye-raporu" },
      { id: uuid(), name: "I- Hesap Ad Listesi", link: "kasa/hesap-ad-listesi" },
    ],
  },

  // C- Kur İşlemleri
  {
    id: uuid(),
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
    title: "D- Cari İşlemler",
    icon: <IconUsers size={18} />,
    children: [
      { id: uuid(), name: "A- Cari Kart Kayıt", link: "cari/kart-kayit" },
      { id: uuid(), name: "B- Cari Kart Düzeltme", link: "cari/kart-duzeltme" },
      { id: uuid(), name: "C- Cari Hareket Kayıt", link: "cari/hareket-kayit" },
      { id: uuid(), name: "D- Cari Hareket Düzeltme", link: "cari/hareket-duzeltme" },
      { id: uuid(), name: "E- Cari Hareket Listesi", link: "cari/hareket-listesi" },
      { id: uuid(), name: "F- Cari Kart Listesi", link: "cari/kart-listesi" },
      { id: uuid(), name: "G- Detaylı Cari Kart Listesi", link: "cari/detayli-kart-listesi" },
      { id: uuid(), name: "H- Cari Ekstre", link: "cari/ekstre" },
      { id: uuid(), name: "I- Cari Bakiye Raporu", link: "cari/bakiye-raporu" },
      { id: uuid(), name: "J- POS Ekstre", link: "cari/pos-ekstre" },
      { id: uuid(), name: "K- Cari Emanet Dekont", link: "cari/emanet-dekont" },
    ],
  },

  // E- Yönetici İşlemleri
  {
    id: uuid(),
    title: "E- Yönetici İşlemleri",
    icon: <IconShieldLock size={18} />,
    children: [
      { id: uuid(), name: "A- Yönetici Özeti", link: "yonetici/ozet" },
      { id: uuid(), name: "B- Kullanıcı Yetkilendirme", link: "yonetici/yetkilendirme" },
      { id: uuid(), name: "C- Fiyat / Marj Belirleme", link: "yonetici/fiyat-belirleme" },
      { id: uuid(), name: "D- Sistem Günlükleri (Loglar)", link: "yonetici/loglar" },
      { id: uuid(), name: "E- Onay Bekleyen İşlemler", link: "yonetici/onaylar" },
    ],
  },

  // F- Banka / POS İşlemleri
  {
    id: uuid(),
    title: "F- Banka / POS İşlemleri",
    icon: <IconCreditCard size={18} />,
    children: [
      { id: uuid(), name: "A- Banka Hesap Kartları", link: "banka/hesap-kartlari" },
      { id: uuid(), name: "B- POS Cihazı Tanımları", link: "banka/pos-tanimlari" },
      { id: uuid(), name: "C- Havale / EFT İşlemleri", link: "banka/havale-eft" },
      { id: uuid(), name: "D- Banka Hesap Hareketleri", link: "banka/hareketler" },
      { id: uuid(), name: "E- Kredi Kartı Tahsilatları", link: "banka/kredi-karti-tahsilat" },
      { id: uuid(), name: "F- POS Gün Sonu İşlemleri", link: "banka/pos-gun-sonu" },
    ],
  },

  // G- Raporlar
  {
    id: uuid(),
    title: "G- Raporlar",
    icon: <IconReportAnalytics size={18} />,
    children: [
      { id: uuid(), name: "A- Günlük Kasa Raporu", link: "raporlar/gunluk-kasa" },
      { id: uuid(), name: "B- Karlılık Analizi", link: "raporlar/karlilik-analizi" },
      { id: uuid(), name: "C- Stok & Envanter Raporu", link: "raporlar/stok-envanter" },
      { id: uuid(), name: "D- Cari Bakiye Raporu", link: "raporlar/cari-bakiye" },
      { id: uuid(), name: "E- Satış & Ciro Raporu", link: "raporlar/satis-ciro" },
    ],
  },

  // H- Etiket İşlemleri
  {
    id: uuid(),
    title: "H- Etiket İşlemleri",
    icon: <IconBarcode size={18} />,
    children: [
      { id: uuid(), name: "A- Barkod & Etiket Basımı", link: "etiket/barkod-basimi" },
      { id: uuid(), name: "B- Ürün Etiket Tasarımı", link: "etiket/tasarim" },
      { id: uuid(), name: "C- Toplu Etiket Yazdırma", link: "etiket/toplu-yazdirma" },
      { id: uuid(), name: "D- Kuyumcu Yüzük / Bilezik Etiketi", link: "etiket/kuyumcu-etiketi" },
      { id: uuid(), name: "E- Fiyat & Ayar Etiketleri", link: "etiket/fiyat-etiketi" },
    ],
  },

  // I- Perakende İşlemleri
  {
    id: uuid(),
    title: "I- Perakende İşlemleri",
    icon: <IconBuildingStore size={18} />,
    children: [
      { id: uuid(), name: "A- Perakende Satış", link: "perakende/satis" },
      { id: uuid(), name: "B- Perakende Alış / İade", link: "perakende/iade" },
      { id: uuid(), name: "C- Vitrin & Stok Takibi", link: "perakende/vitrin-stok" },
      { id: uuid(), name: "D- Barkodlu Hızlı Satış", link: "perakende/hizli-satis" },
      { id: uuid(), name: "E- Günlük Satış Listesi", link: "perakende/liste" },
    ],
  },

  // J- Ayarlar
  {
    id: uuid(),
    title: "J- Ayarlar",
    icon: <IconSettings size={18} />,
    children: [
      { id: uuid(), name: "A- Ürün Tanımları", link: "ayarlar/urun-tanimlari" },
      { id: uuid(), name: "B- Banknot Tanımları", link: "ayarlar/banknot-tanimlari" },
      { id: uuid(), name: "C- İstatistik Tanımları", link: "ayarlar/istatistik-tanimlari" },
      { id: uuid(), name: "D- Vezne Tanımları", link: "ayarlar/vezne-tanimlari" },
      { id: uuid(), name: "E- Kullanıcı Tanımları", link: "ayarlar/kullanici-tanimlari" },
      { id: uuid(), name: "F- Yazıcı Tanımları", link: "ayarlar/yazici-tanimlari" },
      { id: uuid(), name: "G- Vezne Kullanıcı Eşleştirme", link: "ayarlar/vezne-kullanici-eslestirme" },
      { id: uuid(), name: "H- Numaratörler", link: "ayarlar/numeratorler" },
      { id: uuid(), name: "I- Devir İşlemi", link: "ayarlar/devir-islemi" },
      { id: uuid(), name: "J- Servis İşlemleri", link: "ayarlar/servis-islemleri" },
      { id: uuid(), name: "K- MASAK Malvarlıkları Dondurulanlar", link: "ayarlar/masak-dondurulanlar" },
      { id: uuid(), name: "L- Firma Tanımları", link: "ayarlar/firma-tanimlari" },
    ],
  },
];
