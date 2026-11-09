import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { kurDegistirilebilir, kurDenetle, kurDegeriniSinirla, milyemDegistirilebilir, milyemDegeriniSinirla, milyemDenetle } from "../../../Backend/src/services/yetki/kullaniciYetkiKural";
import { kurlariDenetle, milyemleriDenetle } from "../../utils/kurYetkiDenetimi";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { ebankaHareketHesabi, ebankaHesapAciklamasi, useEBankaFisKesimi } from "../ebanka/useEBankaFisKesimi";
import { EB_VARSAYILAN_KDV, altinTutari, ebGramCoz, etkinMilyem, iscilikOzeti } from "../ebanka/ebankaIscilik";
import { PosKarti, usePosTahsilat } from "../../components/pos/PosTahsilat";
import { Card, Row, Col, Form, Button, Table, Badge, Alert, InputGroup, Modal, Spinner, Dropdown } from "react-bootstrap";
import {
  IconCheck, IconBinoculars, IconAlertTriangle, IconPlus, IconShieldExclamation, IconShieldCheck, IconPrinter, IconClock, IconCoins, IconUsers, IconBuildingBank, IconBuildingStore,
  IconRefresh, IconFileText,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { SayfaCikisUyarisiModal, useSayfaCikisUyarisi } from "../../components/common/SayfaCikisUyarisiModal";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { useAuth } from "../../context/AuthContext";
import { AuthService } from "../../services/authService";
import { MasakService, MasakEslesme } from "../../services/masakService";
import { MasakSonucModal } from "../../components/masak/MasakSonucModal";
import MasakModal from "../../components/masak/MasakModal";
import {
  SarrafFisService, SaveSarrafFisPayload, SarrafFisListItem,
  UrunItem, VezneBakiyeItem,
} from "../../services/sarrafFisService";
import { CashDeskService } from "../../services/cashDeskService";
import { CashDeskDefinitionsPage } from "../settings/CashDeskDefinitionsPage";
import { MusteriSecimModal, SelectedCustomerResult, CustomerSearchField } from "./MusteriSecimModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { CariHareketService, CariBakiyeSummary } from "../../services/cariHareketService";
import { CariCardRegistrationPage } from "../cari/CariCardRegistrationPage";
import { DovizFisService, KayitsizMusteriItem, IstatistikSecimItem } from "../../services/dovizFisService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import { ProductDefinitionsPage } from "../settings/ProductDefinitionsPage";
import { ProductDefinitionService } from "../../services/productDefinitionService";
import { onProductChanged } from "../../services/productSyncService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { BankaService, BankaHesapItem } from "../../services/bankaService";
import { BankaHesapKartiPage } from "../banka/BankaHesapKartiPage";
import { PosCihaziService, PosCihaziItem } from "../../services/posCihaziService";
import { IskontoService, IskontoItem } from "../../services/iskontoService";
import { IskontoDefinitionsPage } from "../settings/IskontoDefinitionsPage";
import { KurService, KurRowItem } from "../../services/kurService";
import { NumeratorService, NumeratorItem } from "../../services/numeratorService";
import { IstatistikSecimModal } from "./IstatistikSecimModal";
import SarrafFisiPrintModal from "./SarrafFisiPrintModal";
import { DovizTeklifTaniModal } from "./DovizTeklifTaniModal";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";
import { sarrafFisHtml } from "../../utils/belgeSablon/fisCikti";
import { gibService } from "../../services/gibService";
import { adYazilabilir, gibAdi, uzakSorguYapilir } from "./musteriGibAd";
import { GibFisDugmesi } from "../../components/common/GibSorguButonu";
import { extractPlainTextFromFis, fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { onlyDecimal, onlyDigits, blockNonNumericKeys, formatMiktar, parseDecimal } from "../../utils/numericInput";
import { ebelgeService } from "../../services/ebelgeService";
import { triggerAdjacentBinoculars } from "../../utils/shortcutUtils";
import { FastLookupCache } from "../../services/fastLookupCache";
import { isCtrlNEvent } from "../../utils/keyboardShortcuts";
import { apiClient } from "../../services/apiClient";
import { ParaItem } from "./DovizFisiPage";
import KuyumKodDurbun from "../../components/common/KuyumKodDurbun";
import { ALTIN_KODU, kuyumKoduBul } from "../../../Backend/src/services/kuyumKodlari";

// ─── Types ────────────────────────────────────────────────────────────────────
interface VezneItem { id: number; kod: string; ad: string; }

interface GridRow {
  id: string;
  /** e-Banka'dan doldurulan satır: banka tutarına sabitlendiği andaki gram / adet / kur / tutar (EF20). kdvAyarli: İşçilik KDV %20
   *  varsayılanı uygulandı ya da kullanıcı oranı kendisi verdi (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M12) */
  ebSabit?: { miktar: number; adet: number; kur: number; tutar: number; kdvAyarli?: boolean; gramElle?: boolean } | null;
  satirId?: number | null;
  satirNo: number;
  urunId: number;
  urunKodu: string;
  urunAdi: string;
  adet: number | string;
  miktar: number | string;
  milyem: number | string;
  refMilyem?: number | string;
  hasGram: number | string;
  iscilikToplam?: number | string;
  tlTutar?: number | string;
  iscilikHesaplamaSekli: number | string;
  iscilikiMiktari: number | string;
  iscilikHasGram: number | string;
  iscilikTutari?: number | string;
  iscilikKdvOrani?: number | string;
  iscilikKdvTutari?: number | string;
  kur: number | string;
  tutar: number | string;
  urunTipi: number;
  karat: number | string;
  aciklama: string;
}

interface OdemeRow {
  id: string;
  satirNo: number;
  odemeAraciTuru: number; // 0: Vezne, 1: Cari, 2: Kart, 3: Hesap
  cariKartId?: number | null;
  cariKod?: string;
  cariUnvan?: string;
  bankaId?: number | null;
  posCihaziId?: number | null;
  iskontoId?: number | null;
  paraId: number | null;
  paraKodu: string;
  paraAdi?: string;
  aciklama?: string;
  adet?: number | string;
  miktar: number | string;
  milyem: number | string;
  refMilyem?: number | string;
  hasGram: number | string;
  kur: number | string;
  tutar: number | string;
  urunTipi?: number;
  birimFiyat?: number;
  /** e-Banka hareketinin banka satırı: kilitli, Kod'da kartın kayıtlı adı (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M28) */
  ebBanka?: boolean;
  ebKartAdi?: string;
}

const GRID_COLS = [
  "urunKodu", "urunAdi", "adet", "miktar", "milyem", "hasGram",
  "tlTutar",
  "iscilikHesaplamaSekli", "iscilikiMiktari", "iscilikHasGram", "iscilikTutari", "iscilikKdvOrani", "iscilikKdvTutari", "iscilikToplam",
  "kur", "tutar",
] as const;
type GridColKey = typeof GRID_COLS[number];

const ODEME_COLS = [
  "odemeAraciTuru", "cariKod", "paraAdi", "paraKodu", "adet", "miktar", "milyem", "hasGram", "kur", "tutar",
] as const;
type OdemeColKey = typeof ODEME_COLS[number];

const makeId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const createEmptyRow = (satirNo = 1): GridRow => ({
  id: makeId(), satirId: null, satirNo, urunId: 0, urunKodu: "", urunAdi: "",
  adet: "", miktar: "", milyem: "", refMilyem: "", hasGram: "", iscilikToplam: "", tlTutar: "", iscilikHesaplamaSekli: 0,
  iscilikiMiktari: "", iscilikHasGram: "", iscilikTutari: "", iscilikKdvOrani: "", iscilikKdvTutari: "", kur: "", tutar: "", urunTipi: 1, karat: "", aciklama: "",
});
const createEmptyOdemeRow = (satirNo: number): OdemeRow => ({
  id: makeId(), satirNo, odemeAraciTuru: 0, cariKartId: null, cariKod: "", cariUnvan: "", bankaId: null, posCihaziId: null, iskontoId: null, paraId: null, paraKodu: "", paraAdi: "", aciklama: "",
  adet: "", miktar: "", milyem: "", refMilyem: "", hasGram: "", kur: "", tutar: "", urunTipi: 0,
});

export const isZiynetProduct = (urun?: { urunTipi?: number | string | null; kod?: string; ad?: string; mamulTipi?: string } | null): boolean => {
  if (!urun) return false;

  // 1. Ürün tanımlarından gelen urunTipi doğrudan 3 (Ziynet) ise kesinlikle Ziynet'tir
  if (urun.urunTipi !== undefined && urun.urunTipi !== null && String(urun.urunTipi).trim() !== "") {
    const tipNum = Number(urun.urunTipi);
    if (tipNum === 3) return true;
    if (tipNum === 1 || tipNum === 2) return false;
  }

  const k = (urun.kod || "").trim().toUpperCase();
  const n = (urun.ad || (urun as any).mamulTipi || "").trim().toUpperCase();

  // 2. Kesinlikle Ziynet olmayan ürünler (Has Külçe, Hurda, Bilezik vb.)
  // DİKKAT: "22 AYAR ÇEYREK" gibi ürünlerde "AYAR" kelimesi geçebilir; bu yüzden tek başına "AYAR" ziynet'i engellememeli!
  if (
    k === "24" || k === "HAS" || k === "24AYAR" || k === "KULCE" || k === "KÜLÇE" ||
    k.includes("KULCE") || k.includes("KÜLÇE") || n.includes("KÜLÇE") || n.includes("KULCE") ||
    k.includes("HURDA") || n.includes("HURDA") ||
    k.includes("BILEZIK") || k.includes("BİLEZİK") || n.includes("BİLEZİK") || n.includes("BILEZIK") ||
    n.includes("HAS ALTIN")
  ) {
    return false;
  }

  // 3. Ziynet anahtar kelimeleri ve kodları (Çeyrek, Yarım, Tam, Ata, Cumhuriyet, Gremse, Reşat, Hamit, Ziynet vb.)
  const ziynetKeywords = [
    "ÇEYREK", "CEYREK",
    "YARIM",
    "TAM ALTIN", "TAMALTIN", "TAM_ALTIN",
    "ATA ALTIN", "ATA_ALTIN", "ATALIRA", "ATA LİRA", "ATA LIRA", "ATACEYREK", "ATA ÇEYREK", "ATA YARIM", "ATAYARIM",
    "CUMHURİYET", "CUMHURIYET",
    "GREMSE", "KRAMSE",
    "ZİYNET", "ZIYNET", "SARRAFİYE", "SARRAFIYE",
    "REŞAT", "RESAT", "HAMİT", "HAMIT", "AZİZ", "AZIZ",
    "BEŞLİ", "BESLI", "İKİBUÇUK", "IKIBUCUK", "2.5 ALTIN", "2,5 ALTIN",
  ];

  const exactZiynetCodes = ["CEYREK", "ÇEYREK", "YARIM", "TAM", "ATA", "GREMSE", "ZIYNET", "BESLI", "BEŞLİ", "CUMHURIYET", "RESAT", "REŞAT"];

  if (
    ziynetKeywords.some((w) => k.includes(w) || n.includes(w)) ||
    exactZiynetCodes.some((c) => k === c || k.startsWith(c + "_") || k.endsWith("_" + c)) ||
    ["ÇEY", "CEY", "YAR", "ATA", "GRE", "ZIY", "CUMH"].some((p) => k.startsWith(p))
  ) {
    return true;
  }

  return false;
};

export const isCurrencyItem = (item?: { kod?: string; ad?: string; urunTipi?: number; hasOrani?: number; alisMilyem?: number; hasAlisKatsayisi?: number } | null): boolean => {
  if (!item) return false;
  const k = (item.kod || "").trim().toUpperCase();
  const a = (item.ad || "").trim().toUpperCase();
  if (k === "TL" || k === "TRY" || k === "TRL" || a.includes("TÜRK LİRASI")) return true;
  const dovizCodes = ["USD", "EUR", "GBP", "CHF", "AUD", "CAD", "JPY", "SAR", "AED", "RUB", "KWD", "NOK", "DKK", "SEK"];
  const dovizNames = ["DOLAR", "DOVIZ", "DÖVİZ", "EURO", "AVRO", "POUND", "STERLİN", "STERLIN", "FRANK", "FRANG", "RİYAL", "RIYAL", "RUBLE", "YEN"];
  if (dovizCodes.includes(k) || dovizNames.some((d) => a.includes(d))) return true;
  const hasMilyemData = (Number(item.hasOrani) > 0) || (Number(item.alisMilyem) > 0) || (Number(item.hasAlisKatsayisi) > 0);
  if (hasMilyemData) return false;
  return false;
};

export const resolveEffectiveUrunTipi = (item?: { kod?: string; ad?: string; urunTipi?: number | string | null; hasOrani?: number; alisMilyem?: number; hasAlisKatsayisi?: number; mamulTipi?: string } | null): number => {
  if (!item) return 1;
  // 1. Döviz kontrolü (USD, EUR vb.)
  if (isCurrencyItem(item as any)) return 0;
  // 2. Ürün tanımında doğrudan urunTipi === 3 verilmişse VEYA ziynet algoritması true döndüyse: ZİYNET (3)
  if (item.urunTipi !== undefined && item.urunTipi !== null && String(item.urunTipi).trim() !== "") {
    const t = Number(item.urunTipi);
    if (t === 3) return 3;
    if (t === 2) return 2;
    if (t === 1) return 1;
  }
  if (isZiynetProduct(item)) return 3;

  // 3. Gümüş kontrolü
  const k = (item.kod || "").trim().toUpperCase();
  const a = (item.ad || (item as any).mamulTipi || "").trim().toUpperCase();
  if (k.includes("GUMUS") || k.includes("GÜMÜŞ") || a.includes("GÜMÜŞ") || a.includes("GUMUS")) return 2;

  // 4. Varsayılan Altın (1)
  return 1;
};

export const isOdemeRowParaOrZiynet = (urun?: { urunTipi?: number | string | null; kod?: string; ad?: string; paraKodu?: string; paraAdi?: string; odemeAraciTuru?: number; iskontoId?: number | null } | null): boolean => {
  if (!urun) return true;
  if (urun.iskontoId) return true;
  const k = (urun.paraKodu || urun.kod || "").trim().toUpperCase();
  if (k.startsWith("ISK") || k.includes("İSK")) return true;
  if (urun.odemeAraciTuru === 2) return true; // POS
  const effTipi = resolveEffectiveUrunTipi(urun as any);
  if (effTipi === 3 || effTipi === 0) return true;
  if (effTipi === 1 || effTipi === 2) return false;
  return isZiynetProduct(urun as any);
};

export const getUrunTipiInfo = (urun?: { urunTipi?: number; kod?: string; ad?: string; mamulTipi?: string } | null): {
  label: "Ziynet" | "Altın" | "Döviz" | "Gümüş";
  bg: string;
  textColor?: string;
  isBorder?: boolean;
} => {
  if (!urun) return { label: "Altın", bg: "warning", textColor: "dark" };

  // 1. Ürün Tanımları sayfasındaki urunTipi (0: Döviz, 1: Altın, 2: Gümüş, 3: Ziynet)
  if (urun.urunTipi !== undefined && urun.urunTipi !== null && String(urun.urunTipi).trim() !== "") {
    const tipNum = Number(urun.urunTipi);
    if (tipNum === 3) return { label: "Ziynet", bg: "danger", textColor: "white" };
    if (tipNum === 1) return { label: "Altın", bg: "warning", textColor: "dark" };
    if (tipNum === 2) return { label: "Gümüş", bg: "secondary", textColor: "white" };
    if (tipNum === 0) return { label: "Döviz", bg: "info", textColor: "white" };
  }

  // 2. Fallback (eğer ürün tanımında urunTipi hiç tanımlanmamışsa):
  if (isZiynetProduct(urun)) {
    return { label: "Ziynet", bg: "danger", textColor: "white" };
  }

  const k = (urun.kod || "").trim().toUpperCase();
  const n = (urun.ad || (urun as any).mamulTipi || "").trim().toUpperCase();

  if (k.includes("GUMUS") || k.includes("GÜMÜŞ") || n.includes("GÜMÜŞ") || n.includes("GUMUS")) {
    return { label: "Gümüş", bg: "secondary", textColor: "white" };
  }

  const dovizCodes = ["TL", "TRY", "TRL", "USD", "EUR", "GBP", "CHF", "AUD", "CAD", "JPY", "SAR", "AED", "RUB", "KWD", "NOK", "DKK", "SEK"];
  const dovizNames = ["DOLAR", "DOVIZ", "DÖVİZ", "EURO", "AVRO", "LİRA", "POUND", "STERLİN", "FRANK", "RİYAL", "RUBLE", "YEN"];
  if (dovizCodes.includes(k) || dovizNames.some((d) => n.includes(d))) {
    return { label: "Döviz", bg: "info", textColor: "white" };
  }

  return { label: "Altın", bg: "warning", textColor: "dark" };
};

export const isIskontoMatching = (
  isk: IskontoItem,
  totalTutar: number = 0,
  altinHasKuru: number = 0,
  targetFarkTL?: number
): boolean => {
  if (isk.aktif === false) return false;

  const minTut = Number(isk.minTutar) || 0;
  const maxIsk = Number(isk.maxIskontoTutari) || 0;

  // 1. Minimum Fiş Tutarı Kontrolü
  // Fiş toplamı varsa ve iskontonun belirlediği min fiş tutarından az ise uyuşmaz
  if (minTut > 0 && totalTutar > 0 && totalTutar < minTut) {
    return false;
  }

  // 2. Kalan Fark Kapatma Senaryosu (targetFarkTL)
  // Kapatılacak fark tutarı iskontonun maksimum iskonto sınırından büyükse uygulanamaz
  if (targetFarkTL !== undefined && targetFarkTL > 0) {
    if (maxIsk > 0 && targetFarkTL > maxIsk) {
      return false;
    }
  }

  // 3. Tipe Göre Min/Max/Oran/Tutar Uyuşması
  if (isk.iskontoTipi === 1) {
    // Yüzde (%) İskonto
    const oran = Number(isk.oran) || 0;
    if (oran <= 0 || oran > 100) return false;
    if (totalTutar > 0) {
      const calcTut = (totalTutar * oran) / 100;
      if (maxIsk > 0 && calcTut > maxIsk) return false;
      if (calcTut > totalTutar) return false;
    }
  } else if (isk.iskontoTipi === 2) {
    // Sabit Tutar (TL) İskonto
    const tut = Number(isk.tutar) || 0;
    if (tut <= 0) return false;
    if (totalTutar > 0 && tut > totalTutar) return false;
    if (maxIsk > 0 && tut > maxIsk) return false;
  } else if (isk.iskontoTipi === 3) {
    // Has Gram İskonto
    const hasTut = Number(isk.hasTutar) || 0;
    if (hasTut <= 0) return false;
    const hasKur = altinHasKuru > 0 ? altinHasKuru : 1;
    const tlTut = hasTut * hasKur;
    if (totalTutar > 0 && tlTut > totalTutar) return false;
    if (maxIsk > 0 && tlTut > maxIsk) return false;
  } else {
    // Serbest / Belirtilmemiş Tutar
    if (isk.oran && (Number(isk.oran) <= 0 || Number(isk.oran) > 100)) return false;
    if (isk.tutar && totalTutar > 0 && Number(isk.tutar) > totalTutar) return false;
    if (isk.tutar && maxIsk > 0 && Number(isk.tutar) > maxIsk) return false;
  }

  return true;
};

const recomputeOdemeRow = (r: OdemeRow, defaultHasKuru: number = 0, changedField?: keyof OdemeRow): OdemeRow => {
  const isTL = (r.paraKodu || "").trim().toUpperCase() === "TL" || (r.paraKodu || "").trim().toUpperCase() === "TRY" || (r.paraKodu || "").trim().toUpperCase() === "TRL";
  const isKart = r.odemeAraciTuru === 2;
  const isIskonto = Boolean(
    r.iskontoId ||
    (r.paraKodu && (r.paraKodu.trim().toUpperCase().startsWith("ISK") || r.paraKodu.trim().toUpperCase().startsWith("İSK"))) ||
    (r.paraAdi && (r.paraAdi.toUpperCase().includes("İSKONTO") || r.paraAdi.toUpperCase().includes("ISKONTO")))
  );
  const isKurFixed = isTL || isKart || isIskonto;
  const isZiynet = r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi });
  const isPara = (r.urunTipi === 0 || isTL || isIskonto);
  const isParaOrZiynet = isPara || isZiynet;

  const adet = parseDecimal(r.adet);
  const miktar = parseDecimal(r.miktar);
  const rawMilyem = parseDecimal(r.milyem);
  const effectiveMilyem = rawMilyem > 1 ? (rawMilyem <= 100 ? rawMilyem / 100 : rawMilyem / 1000) : rawMilyem;

  let hasGram: number | string = r.hasGram;
  let tutar: number | string = r.tutar;
  const kurNum = parseDecimal(r.kur);
  const kur = isKurFixed ? (isIskonto ? (r.kur || "") : "") : (kurNum > 0 ? kurNum : (r.kur !== "" && r.kur !== null && r.kur !== undefined ? r.kur : (defaultHasKuru > 0 ? defaultHasKuru : "")));
  const effectiveKur = isKurFixed ? 1 : (kurNum > 0 ? kurNum : parseDecimal(kur));

  if (isIskonto) {
    const rawAdetStr = r.adet !== undefined && r.adet !== null ? String(r.adet).trim() : "";
    const numAdet = parseDecimal(rawAdetStr);
    let unitPrice = Number(r.birimFiyat) > 0 ? Number(r.birimFiyat) : 0;
    if (changedField === "tutar" && parseDecimal(r.tutar) > 0) {
      unitPrice = numAdet > 0 ? parseDecimal(r.tutar) / numAdet : parseDecimal(r.tutar);
    } else if (unitPrice === 0 && parseDecimal(r.tutar) > 0) {
      const prevAdet = numAdet > 0 ? numAdet : 1;
      unitPrice = parseDecimal(r.tutar) / prevAdet;
    }
    const computedTutar = changedField === "tutar"
      ? (parseDecimal(r.tutar) || "")
      : (rawAdetStr === "" ? "" : (unitPrice > 0 && numAdet > 0 ? Math.round(unitPrice * numAdet * 100) / 100 : (parseDecimal(r.tutar) || "")));
    return {
      ...r,
      adet: rawAdetStr,
      miktar: "",
      milyem: "",
      hasGram: "",
      tutar: computedTutar,
      kur: "",
      birimFiyat: unitPrice > 0 ? unitPrice : undefined,
    };
  }

  // Ziynet ve Para işlemlerinde milyem / has / işçilik çalışmaz, doğrudan adet (veya miktar) * kur hesaplanır
  if (isParaOrZiynet) {
    const base = adet > 0 ? adet : (miktar > 0 ? miktar : 0);
    if (changedField !== "tutar") {
      if (base > 0 && effectiveKur > 0) {
        tutar = parseFloat((base * effectiveKur).toFixed(2));
      } else if (base > 0 && isKurFixed) {
        tutar = base;
      } else {
        tutar = "";
      }
    }
    return {
      ...r,
      adet: r.adet,
      milyem: "",
      hasGram: "",
      tutar,
      kur: isKurFixed ? "" : kur,
    };
  }

  // Maden / Hurda Altın / Gümüş (Gramaj & Milyem bazlı)
  const base = miktar > 0 ? miktar : adet;
  if (changedField !== "hasGram") {
    if (base > 0 && effectiveMilyem > 0) {
      hasGram = parseFloat((base * effectiveMilyem).toFixed(4));
    } else if (base > 0) {
      hasGram = base;
    }
  }
  if (changedField !== "tutar") {
    const effHas = parseDecimal(hasGram) > 0 ? parseDecimal(hasGram) : base;
    const mKur = kurNum > 0 ? kurNum : (defaultHasKuru > 0 ? defaultHasKuru : 1);
    if (effHas > 0 && mKur > 0) {
      tutar = parseFloat((effHas * mKur).toFixed(2));
    }
  }

  return {
    ...r,
    hasGram,
    tutar,
    kur: isKurFixed ? "" : (kur !== "" ? kur : (defaultHasKuru > 0 ? defaultHasKuru : "")),
  };
};

export const formatIscilikGirisDegeri = (val: any, _iscilikGirisSekli: number = 0): string => {
  if (val === undefined || val === null || val === "") return "";
  const strVal = String(val).trim();
  if (!strVal) return "";
  if (strVal.startsWith(",") || strVal.startsWith(".")) {
    return "0" + strVal.replace(".", ",");
  }
  return strVal;
};

export const handleNumericFormattedChange = (
  input: HTMLInputElement,
  onUpdate: (formattedVal: string) => void
) => {
  let rawVal = input.value;
  if (rawVal.length > 1 && rawVal.startsWith("0") && !rawVal.startsWith("0,") && !rawVal.startsWith("0.")) {
    rawVal = rawVal.replace(/^0+/, "") || "0";
  }
  const selStart = input.selectionStart ?? rawVal.length;
  const beforeCursor = rawVal.slice(0, selStart);
  const digitsBefore = (beforeCursor.match(/[0-9,]/g) || []).length;
  const isAtEnd = selStart >= rawVal.length - 1;

  const formatted = formatMiktar(rawVal);
  onUpdate(formatted);

  requestAnimationFrame(() => {
    if (isAtEnd) {
      input.setSelectionRange(formatted.length, formatted.length);
    } else {
      let newCursorPos = 0;
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9,]/.test(formatted[i])) count++;
        if (count === digitsBefore) {
          newCursorPos = i + 1;
          break;
        }
      }
      if (count < digitsBefore) newCursorPos = formatted.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }
  });
};

export const handleNumericDotKeyDown = (
  e: React.KeyboardEvent<any>,
  onUpdate: (formattedVal: string) => void
) => {
  if (e.key === "." || e.key === "Decimal") {
    e.preventDefault();
    const input = e.currentTarget;
    const raw = input.value;
    if (!raw.includes(",")) {
      const start = input.selectionStart ?? raw.length;
      const end = input.selectionEnd ?? raw.length;
      const nextVal = raw.slice(0, start) + "," + raw.slice(end);
      const formatted = formatMiktar(nextVal);
      onUpdate(formatted);
      requestAnimationFrame(() => {
        const commaIdx = formatted.indexOf(",");
        const pos = commaIdx !== -1 ? commaIdx + 1 : formatted.length;
        input.setSelectionRange(pos, pos);
      });
    }
  }
};

/**
 * e-Banka'dan sabitlenen satır tutarı (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF20): gram, adet ve kur değişmedikçe banka
 * tutarı korunur (hücreden çıkış, kur yenileme gibi yeniden hesaplamalar 0,156 × 6.412,04 = 1.000,28'e döndürmesin).
 */
const sabitTutariKoru = (r: GridRow, kur: number | string, hesaplanan: number | string): number | string =>
  r.ebSabit && parseDecimal(r.miktar) === r.ebSabit.miktar && parseDecimal(r.adet) === r.ebSabit.adet && parseDecimal(kur) === r.ebSabit.kur
    ? r.ebSabit.tutar
    : hesaplanan;

const recomputeRowHam = (r: GridRow, defaultKur: number = 0, changedField?: keyof GridRow, iscilikGirisSekli: number = 0, isKdvDisabled: boolean = false): GridRow => {
  const effTipi = resolveEffectiveUrunTipi({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
  const isPara = effTipi === 0 && Boolean(r.urunKodu && r.urunKodu.trim());
  const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
  const isParaOrZiynet = isPara || isZiynet;

  // Ziynet ve Para işlemlerinde milyem / has / işçilik pasif; tutar = adet (veya miktar) * kur
  if (isParaOrZiynet) {
    const adet = parseDecimal(r.adet);
    const miktar = parseDecimal(r.miktar);
    const base = adet > 0 ? adet : (miktar > 0 ? miktar : 0);
    const kur = r.kur !== "" ? r.kur : (defaultKur > 0 ? defaultKur : "");
    const effectiveKur = parseDecimal(kur);
    let tutar: number | string = r.tutar;
    if (changedField !== "tutar") {
      if (effectiveKur > 0 && base > 0) {
        tutar = parseFloat((base * effectiveKur).toFixed(2));
      } else {
        tutar = "";
      }
      tutar = sabitTutariKoru(r, kur, tutar);
    }
    return {
      ...r,
      adet: r.adet,
      miktar: "",
      milyem: "",
      hasGram: "",
      iscilikToplam: "",
      tlTutar: tutar !== "" ? tutar : "",
      iscilikHesaplamaSekli: 0,
      iscilikiMiktari: "",
      iscilikHasGram: "",
      iscilikTutari: "",
      iscilikKdvOrani: "",
      iscilikKdvTutari: "",
      kur,
      tutar,
    };
  }

  const adet = parseDecimal(r.adet);
  const miktar = parseDecimal(r.miktar);
  const rawMilyem = parseDecimal(r.milyem);
  const effectiveMilyem = rawMilyem > 1 ? (rawMilyem <= 100 ? rawMilyem / 100 : rawMilyem / 1000) : rawMilyem;

  // Has hesabı: kullanıcı doğrudan hasGram yazıyorsa ezme
  const base = miktar > 0 ? miktar : adet;
  let hasGram: number | string = r.hasGram;
  if (changedField !== "hasGram") {
    if (r.urunTipi === 1 || r.urunTipi === 2 || effectiveMilyem > 0) {
      if (miktar > 0 && effectiveMilyem > 0) {
        hasGram = parseFloat((miktar * effectiveMilyem).toFixed(4));
      } else if (miktar > 0) {
        hasGram = miktar;
      } else if (adet > 0 && effectiveMilyem > 0) {
        hasGram = parseFloat((adet * effectiveMilyem).toFixed(4));
      } else if (r.hasGram !== "" && parseDecimal(r.hasGram) > 0) {
        hasGram = parseDecimal(r.hasGram);
      }
    } else if (r.hasGram !== "" && parseDecimal(r.hasGram) > 0) {
      hasGram = parseDecimal(r.hasGram);
    }
  }

  const kur = r.kur !== "" ? r.kur : (defaultKur > 0 ? defaultKur : "");
  const effectiveKur = parseDecimal(kur);
  const hasFiyati = defaultKur > 0 ? defaultKur : effectiveKur;

  // TL Tutar hesabı: Has * Kur (veya miktar/adet * kur)
  let tlTutar: number | string = "";
  const hasNum = parseDecimal(hasGram);
  if (hasNum > 0 && effectiveKur > 0) {
    tlTutar = parseFloat((hasNum * effectiveKur).toFixed(2));
  } else if (base > 0 && effectiveKur > 0) {
    tlTutar = parseFloat((base * effectiveKur).toFixed(2));
  } else if (r.tlTutar !== "" && parseDecimal(r.tlTutar) > 0) {
    tlTutar = parseDecimal(r.tlTutar);
  }

  // İşçilik hesabı: 0: Gram, 1: Adet, 2: Toplam
  const iscilikSekli = Number(r.iscilikHesaplamaSekli) || 0;
  let iscilikiMiktari: number | string = r.iscilikiMiktari;
  let iscilikHasGram: number | string = r.iscilikHasGram;
  let iscilikTutari: number | string = r.iscilikTutari;
  let iscilikKdvOrani: number | string = isKdvDisabled ? "" : (r.iscilikKdvOrani !== undefined && r.iscilikKdvOrani !== null ? r.iscilikKdvOrani : "");
  let iscilikKdvTutari: number | string = isKdvDisabled ? "" : (r.iscilikKdvTutari !== undefined && r.iscilikKdvTutari !== null ? r.iscilikKdvTutari : "");
  let iscilikToplam: number | string = r.iscilikToplam !== undefined && r.iscilikToplam !== null ? r.iscilikToplam : "";

  const gramVal = miktar > 0 ? miktar : (adet > 0 ? adet : 0);
  const adetVal = adet > 0 ? adet : 1;

  if (changedField === "iscilikToplam") {
    const topVal = parseDecimal(r.iscilikToplam);
    iscilikToplam = r.iscilikToplam;
    if (topVal > 0) {
      const oranVal = !isKdvDisabled ? parseDecimal(iscilikKdvOrani) : 0;
      if (oranVal > 0) {
        // KDV dahil toplam işçilikten net işçilik ve KDV ayrıştırma
        const netTl = parseFloat((topVal / (1 + oranVal / 100)).toFixed(2));
        iscilikTutari = netTl;
        iscilikKdvTutari = parseFloat((topVal - netTl).toFixed(2));
      } else {
        iscilikTutari = topVal;
        iscilikKdvTutari = isKdvDisabled ? "" : (iscilikKdvTutari !== "" ? iscilikKdvTutari : "");
      }
      if (hasFiyati > 0) {
        const calcHas = parseFloat((parseDecimal(iscilikTutari) / hasFiyati).toFixed(4));
        iscilikHasGram = calcHas;
        let effIsc = 0;
        if (iscilikSekli === 0 && gramVal > 0) effIsc = calcHas / gramVal;
        else if (iscilikSekli === 1 && adetVal > 0) effIsc = calcHas / adetVal;
        else if (iscilikSekli === 2) effIsc = calcHas;
        if (effIsc > 0) {
          iscilikiMiktari = iscilikGirisSekli === 0 ? parseFloat((effIsc * 1000).toFixed(2)) : parseFloat(effIsc.toFixed(4));
        } else {
          iscilikiMiktari = "";
        }
      }
    } else if (topVal === 0 || r.iscilikToplam === "") {
      iscilikToplam = "";
      iscilikTutari = "";
      iscilikKdvTutari = "";
      iscilikHasGram = "";
      iscilikiMiktari = "";
    }
  } else if (changedField === "iscilikTutari") {
    const rawTl = parseDecimal(r.iscilikTutari);
    if (rawTl > 0 && hasFiyati > 0) {
      iscilikTutari = r.iscilikTutari;
      const calcHas = parseFloat((rawTl / hasFiyati).toFixed(4));
      iscilikHasGram = calcHas;

      let effIsc = 0;
      if (iscilikSekli === 0 && gramVal > 0) {
        effIsc = calcHas / gramVal;
      } else if (iscilikSekli === 1 && adetVal > 0) {
        effIsc = calcHas / adetVal;
      } else if (iscilikSekli === 2) {
        effIsc = calcHas;
      }

      if (effIsc > 0) {
        iscilikiMiktari = iscilikGirisSekli === 0 ? parseFloat((effIsc * 1000).toFixed(2)) : parseFloat(effIsc.toFixed(4));
      } else {
        iscilikiMiktari = "";
      }
    } else if (rawTl === 0 || r.iscilikTutari === "") {
      iscilikTutari = "";
      iscilikHasGram = "";
      iscilikiMiktari = "";
    } else {
      iscilikTutari = r.iscilikTutari;
    }

    const netIsc = parseDecimal(iscilikTutari);
    const oranVal = !isKdvDisabled ? parseDecimal(iscilikKdvOrani) : 0;
    if (oranVal > 0 && netIsc > 0) {
      iscilikKdvTutari = parseFloat(((netIsc * oranVal) / 100).toFixed(2));
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else if (parseDecimal(iscilikKdvTutari) > 0) {
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else {
      if (isKdvDisabled) iscilikKdvTutari = "";
      iscilikToplam = netIsc > 0 ? netIsc : "";
    }
  } else if (changedField === "iscilikKdvTutari") {
    iscilikKdvTutari = r.iscilikKdvTutari;
    const netIsc = parseDecimal(iscilikTutari);
    const kdvVal = parseDecimal(iscilikKdvTutari);
    if (netIsc > 0 && kdvVal > 0) {
      iscilikKdvOrani = parseFloat(((kdvVal / netIsc) * 100).toFixed(2));
    }
    if (netIsc > 0 || kdvVal > 0) {
      iscilikToplam = parseFloat((netIsc + kdvVal).toFixed(2));
    } else {
      iscilikToplam = "";
    }
  } else if (changedField === "iscilikKdvOrani") {
    const oranVal = !isKdvDisabled ? parseDecimal(iscilikKdvOrani) : 0;
    const netIsc = parseDecimal(iscilikTutari);
    if (oranVal > 0 && netIsc > 0) {
      iscilikKdvTutari = parseFloat(((netIsc * oranVal) / 100).toFixed(2));
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else if (oranVal === 0 || iscilikKdvOrani === "") {
      iscilikKdvTutari = "";
      iscilikToplam = netIsc > 0 ? netIsc : "";
    }
  } else if (changedField === "iscilikHasGram") {
    iscilikHasGram = r.iscilikHasGram;
    const hasNumIsc = parseDecimal(iscilikHasGram);
    if (hasNumIsc > 0 && hasFiyati > 0) {
      iscilikTutari = parseFloat((hasNumIsc * hasFiyati).toFixed(2));
    } else {
      iscilikTutari = "";
    }
    const netIsc = parseDecimal(iscilikTutari);
    const oranVal = !isKdvDisabled ? parseDecimal(iscilikKdvOrani) : 0;
    if (oranVal > 0 && netIsc > 0) {
      iscilikKdvTutari = parseFloat(((netIsc * oranVal) / 100).toFixed(2));
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else if (parseDecimal(iscilikKdvTutari) > 0) {
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else {
      if (isKdvDisabled) iscilikKdvTutari = "";
      iscilikToplam = netIsc > 0 ? netIsc : "";
    }
  } else {
    // Default recalculation (e.g. iscilikiMiktari, miktar, adet, kur vb.)
    const rawIscilik = parseDecimal(r.iscilikiMiktari);
    const effectiveIscilik = (iscilikGirisSekli === 0) ? (rawIscilik / 1000) : rawIscilik;

    if (effectiveIscilik > 0) {
      if (iscilikSekli === 0) {
        iscilikHasGram = parseFloat((gramVal * effectiveIscilik).toFixed(4));
      } else if (iscilikSekli === 1) {
        iscilikHasGram = parseFloat((adetVal * effectiveIscilik).toFixed(4));
      } else if (iscilikSekli === 2) {
        iscilikHasGram = parseFloat(effectiveIscilik.toFixed(4));
      }

      if (parseDecimal(iscilikHasGram) > 0 && hasFiyati > 0) {
        iscilikTutari = parseFloat((parseDecimal(iscilikHasGram) * hasFiyati).toFixed(2));
      } else {
        iscilikTutari = "";
      }
    } else if (changedField === "iscilikiMiktari") {
      iscilikHasGram = "";
      iscilikTutari = "";
    }

    const netIsc = parseDecimal(iscilikTutari);
    const oranVal = !isKdvDisabled ? parseDecimal(iscilikKdvOrani) : 0;
    if (oranVal > 0 && netIsc > 0) {
      iscilikKdvTutari = parseFloat(((netIsc * oranVal) / 100).toFixed(2));
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else if (parseDecimal(iscilikKdvTutari) > 0) {
      iscilikToplam = parseFloat((netIsc + parseDecimal(iscilikKdvTutari)).toFixed(2));
    } else {
      if (isKdvDisabled) iscilikKdvTutari = "";
      iscilikToplam = netIsc > 0 ? netIsc : "";
    }
  }

  // Toplam Tutar (TL) hesabı: TL Tutar + İşçilik Toplam
  const tlTutVal = parseDecimal(tlTutar);
  const iscTopVal = parseDecimal(iscilikToplam);
  let tutar: number | string = r.tutar;
  if (changedField !== "tutar") {
    if (tlTutVal > 0 || iscTopVal > 0) {
      tutar = parseFloat((tlTutVal + iscTopVal).toFixed(2));
    } else {
      tutar = "";
    }
    tutar = sabitTutariKoru(r, kur, tutar);
  }

  return {
    ...r,
    iscilikiMiktari,
    hasGram,
    tlTutar: tlTutar !== "" ? tlTutar : "",
    iscilikHasGram,
    iscilikTutari,
    iscilikKdvOrani: isKdvDisabled ? "" : iscilikKdvOrani,
    iscilikKdvTutari: isKdvDisabled ? "" : iscilikKdvTutari,
    iscilikToplam: iscilikToplam !== "" ? iscilikToplam : "",
    kur,
    tutar,
  };
};

/** Satır hesabı; e-Banka'dan sabitlenen satırda ardından işçilik dengesi çalışır (normal fişte ebankaSatiriDengele hiçbir şey yapmaz) */
export const recomputeRow = (r: GridRow, defaultKur: number = 0, changedField?: keyof GridRow, iscilikGirisSekli: number = 0, isKdvDisabled: boolean = false): GridRow =>
  ebankaSatiriDengele(r, recomputeRowHam(r, defaultKur, changedField, iscilikGirisSekli, isKdvDisabled), defaultKur, changedField, iscilikGirisSekli, isKdvDisabled);

/** e-Banka satırında para / ziynet mi (işçilik yok, dengelenmez) */
const ebParaZiynetMi = (r: GridRow): boolean => {
  const effTipi = resolveEffectiveUrunTipi({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
  return (effTipi === 0 && Boolean(r.urunKodu && r.urunKodu.trim())) || effTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
};

/** İşçilik KDV %20 varsayılanı bu alanlardan biri değişince uygulanır (M12) */
const EB_ISCILIK_ALANLARI: (keyof GridRow)[] = ["iscilikToplam", "iscilikTutari", "iscilikHasGram", "iscilikiMiktari", "iscilikKdvTutari", "iscilikHesaplamaSekli"];

/**
 * e-Banka satırı dengesi (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M10–M14). `ebSabit` taşıyan altın / gümüş satırında Toplam Tutar
 * sabit kalır; İşçilik Toplam (KDV dahil) altından düşülür, kur sabit, gram yeniden çözülür (ebankaIscilik.ts), TL Tutar = Toplam −
 * İşçilik Toplam. Altın tipinde altın kısmı gram × kur (EF20: milyeme bölünmez), gümüş / hurdada has × kur. Gram / has / adet elle
 * değişirse satır sabitlemeden çıkar (M13). ebSabit yoksa (normal fiş) satıra dokunmaz.
 */
const ebankaSatiriDengele = (girdi: GridRow, hesap: GridRow, defaultKur: number, changedField: keyof GridRow | undefined, iscilikGirisSekli: number, isKdvDisabled: boolean): GridRow => {
  const sabit = girdi.ebSabit;
  if (!sabit || !(sabit.tutar > 0) || ebParaZiynetMi(girdi)) return hesap;
  // Toplam hiçbir durumda banka tutarından sapmaz (M26): gram elle yazılırsa gram kullanıcının olur, toplam yine sabit; gram silinirse
  // yeniden kurdan çözülür. Hücreden değiştirmeden çıkmak bir şey değiştirmez.
  let gramElle = !!sabit.gramElle;
  if (changedField === "miktar" && parseDecimal(girdi.miktar) !== sabit.miktar) gramElle = parseDecimal(girdi.miktar) > 0;
  const hedef = sabit.tutar;
  // İşçilik KDV %20 varsayılanı satırda bir kez uygulanır; oranı kullanıcı verdiyse / sildiyse dokunulmaz
  let kdvAyarli = !!sabit.kdvAyarli || changedField === "iscilikKdvOrani";
  let temel = hesap;
  if (!isKdvDisabled && !kdvAyarli && changedField && EB_ISCILIK_ALANLARI.includes(changedField) && !(parseDecimal(hesap.iscilikKdvOrani) > 0)) {
    // Oranla yeniden hesap: net yazıldıysa KDV üstüne eklenir, toplam yazıldıysa içinden ayrışır
    temel = recomputeRowHam({ ...girdi, iscilikKdvOrani: EB_VARSAYILAN_KDV }, defaultKur, changedField, iscilikGirisSekli, isKdvDisabled);
    kdvAyarli = true;
  }
  const oran = isKdvDisabled ? 0 : parseDecimal(temel.iscilikKdvOrani);
  const kur = parseDecimal(temel.kur);
  const tipAltin = resolveEffectiveUrunTipi({ urunTipi: girdi.urunTipi, kod: girdi.urunKodu, ad: girdi.urunAdi }) === 1 || getUrunTipiInfo(girdi).label === "Altın";
  const milyem = tipAltin ? 1 : etkinMilyem(parseDecimal(temel.milyem));
  const hasFiyati = defaultKur > 0 ? defaultKur : kur;
  const birimIscilik = parseDecimal(temel.iscilikiMiktari);
  const birimGirdisi = (changedField === "iscilikiMiktari" || changedField === "iscilikHesaplamaSekli") && (Number(temel.iscilikHesaplamaSekli) || 0) === 0 && birimIscilik > 0;
  let son: GridRow;
  // Elle yazılmış gram sabit kalır; işçilik değişince altın tutarı (TL Tutar) değişir, gram değişmez
  const elleGram = gramElle ? parseDecimal(temel.miktar) : 0;
  if (birimGirdisi) {
    // Gram usulü işçilik grama bağlı: gram kapalı formülle çözülür
    const gramBasiHas = iscilikGirisSekli === 0 ? birimIscilik / 1000 : birimIscilik;
    const gram = elleGram > 0 ? elleGram : ebGramCoz({ hedef, milyem, kur, kdvOrani: oran, gramBasiNetIscilik: gramBasiHas * hasFiyati });
    if (gram === null) return { ...hesap, ebSabit: { ...sabit, kdvAyarli, gramElle } };
    son = recomputeRowHam({ ...temel, miktar: gram, ebSabit: null }, defaultKur, "iscilikiMiktari", iscilikGirisSekli, isKdvDisabled);
  } else {
    // İşçilik Toplam'ı belirleyen: yazılan toplam; net / has / KDV tutarı / birim yazıldıysa yeni toplam; oran, kur, milyem değişince eski toplam
    const netAlani = changedField === "iscilikTutari" || changedField === "iscilikHasGram" || changedField === "iscilikiMiktari";
    // Adet usulü işçilikte adet değişince işçilik de değişir
    const adetIscilik = changedField === "adet" && (Number(temel.iscilikHesaplamaSekli) || 0) === 1;
    let x = changedField === "iscilikToplam" || changedField === "iscilikKdvTutari" || changedField === "iscilikHesaplamaSekli" || netAlani || adetIscilik
      ? parseDecimal(temel.iscilikToplam)
      : parseDecimal(girdi.iscilikToplam);
    // Net işçilik silindiyse eski KDV tutarı toplamda kalmasın
    if (netAlani && !(parseDecimal(temel[changedField as "iscilikTutari" | "iscilikHasGram" | "iscilikiMiktari"]) > 0)) x = 0;
    const gram = elleGram > 0 ? (x < hedef ? elleGram : null) : ebGramCoz({ hedef, milyem, kur, kdvOrani: oran, iscilikToplam: x });
    if (gram === null) return { ...hesap, ebSabit: { ...sabit, kdvAyarli, gramElle } };
    son = recomputeRowHam(
      { ...temel, miktar: gram, iscilikToplam: x > 0 ? x : "", iscilikKdvTutari: oran > 0 ? temel.iscilikKdvTutari : "", ebSabit: null },
      defaultKur, "iscilikToplam", iscilikGirisSekli, isKdvDisabled
    );
  }
  const iscilik = parseDecimal(son.iscilikToplam);
  if (!(iscilik < hedef)) return { ...hesap, ebSabit: { ...sabit, kdvAyarli, gramElle } };
  return {
    ...son,
    tlTutar: altinTutari(hedef, iscilik),
    tutar: hedef,
    ebSabit: { miktar: parseDecimal(son.miktar), adet: parseDecimal(son.adet), kur: parseDecimal(son.kur), tutar: hedef, kdvAyarli, gramElle },
  };
};

/**
 * e-Banka'dan "Düzenle" ile açılan fişin satırı (M14, M30): Toplam Tutar kayıttaki tutara sabitlenir. Açılıştaki yeniden hesap (`hesap`)
 * TL Tutar'ı has × kur'a döndürür, satır KDV'si veritabanında tutulmaz; bu yüzden kayıttaki net işçiliğe fişin İşçilik KDV oranı uygulanır
 * ve TL Tutar = Toplam − İşçilik Toplam olur. Kayıttaki net işçilik ve işçilik hası korunur (İşçilik/M'den yeniden hesaplanıp kaymasın).
 */
const ebDuzenlemeSabitle = (kayit: GridRow, hesap: GridRow, fisKdvOrani: number, isKdvDisabled: boolean): GridRow => {
  const tutar = parseDecimal(kayit.tutar);
  if (!(tutar > 0) || ebParaZiynetMi(kayit) || !(kayit.urunKodu || "").trim()) return hesap;
  const oran = isKdvDisabled ? 0 : Math.max(0, Number(fisKdvOrani) || 0);
  const kayitNet = parseDecimal(kayit.iscilikTutari);
  const net = kayitNet > 0 ? kayitNet : parseDecimal(hesap.iscilikTutari);
  const kdv = net > 0 && oran > 0 ? parseFloat(((net * oran) / 100).toFixed(2)) : 0;
  const iscilik = parseFloat((net + kdv).toFixed(2));
  const sabit = { miktar: parseDecimal(hesap.miktar), adet: parseDecimal(hesap.adet), kur: parseDecimal(hesap.kur), tutar, kdvAyarli: oran > 0 };
  if (!(iscilik < tutar)) return { ...hesap, ebSabit: { ...sabit, tutar: parseDecimal(hesap.tutar) } };
  return {
    ...hesap,
    iscilikHasGram: kayitNet > 0 && parseDecimal(kayit.iscilikHasGram) > 0 ? kayit.iscilikHasGram : hesap.iscilikHasGram,
    iscilikTutari: net > 0 ? net : "",
    iscilikKdvOrani: oran > 0 ? oran : "",
    iscilikKdvTutari: kdv > 0 ? kdv : "",
    iscilikToplam: iscilik > 0 ? iscilik : "",
    tlTutar: altinTutari(tutar, iscilik),
    tutar,
    ebSabit: sabit,
  };
};

/** e-Banka fişinde İşçilik KDV oranı fiş düzeyindedir: bütün altın / gümüş satırlarına aynı oran (M12) */
const ebKdvSatiri = (r: GridRow, oran: string, defaultKur: number, iscilikGirisSekli: number, isKdvDisabled: boolean): GridRow => {
  if (!(r.urunKodu || "").trim() || ebParaZiynetMi(r)) return r;
  return recomputeRow({ ...r, iscilikKdvOrani: oran, ebSabit: r.ebSabit ? { ...r.ebSabit, kdvAyarli: true } : r.ebSabit }, defaultKur, "iscilikKdvOrani", iscilikGirisSekli, isKdvDisabled);
};

const DEFAULT_CUSTOMER_NAME = "İsim beyan edilmemiştir";

export const isAnonymousCustomerName = (val?: string | null): boolean => {
  if (!val) return true;
  const s = val.trim().toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
  return (
    s === "" ||
    s === "ISIM BEYAN EDILMEMISTIR" ||
    s === "ISIM BEYAN EDILMEDI" ||
    s === "NIHAI TUKETICI" ||
    s.includes("BEYAN EDILME")
  );
};

const getUserVezne = (list: VezneItem[], cashierCode?: string): VezneItem | undefined => {
  if (!list.length) return undefined;
  const t = String(cashierCode || "").trim();
  if (t) {
    const m = list.find((v) => String(v.id) === t || v.kod.trim() === t) ||
      (!isNaN(Number(t)) ? list.find((v) => v.id === Number(t)) : undefined);
    if (m) return m;
  }
  return list[0];
};

export interface SarrafFisiPageProps {
  isPerakende?: boolean;
  isDuzeltme?: boolean;
}

export const SarrafFisiPage: React.FC<SarrafFisiPageProps> = ({
  isPerakende = false,
  isDuzeltme = false,
}) => {
  const { user, refreshUser } = useAuth();
  const userIscilikGirisSekli = Number(user?.iscilikGirisSekli ?? AuthService.getUser()?.iscilikGirisSekli ?? 0);
  // Kullanıcı kartı yetkileri: tarih, fiş no, kur, milyem, banka hesabı, cari bakiye, MASAK uyarısı (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2;
  // sunucu da denetler). Geri çağrılarda güncel değer için ref.
  const kYetki = useKullaniciYetkisi();
  const kYetkiRef = useRef(kYetki);
  kYetkiRef.current = kYetki;
  const kurAcik = kurDegistirilebilir(kYetki);
  const milyemAcik = milyemDegistirilebilir(kYetki);

  // Sayfa açıldığında ve pencere odaklandığında kullanıcı yetkilerini (milyem/kur yetkisi vb.) sunucudan tazele
  useEffect(() => {
    void refreshUser();
    const onFocus = () => void refreshUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshUser]);

  // Kayıt öncesi kur denetimi için ürün kuru (getKurForProduct aşağıda tanımlanır)
  const getKurRef = useRef<(u: { paraId?: number; kod?: string; urunTipi?: number; ad?: string }, t: 0 | 1) => number>(() => 0);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("sarrafFisiId");
  // e-Banka'dan açılan fiş (kesim ebh / Düzenle ebd) ve hareketin hesabı (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M19, M20)
  const ebankaFisi = Boolean(searchParams.get("ebh") || searchParams.get("ebd"));
  const ebBankaRef = useRef<{ bankaId: number; aciklama: string }>({ bankaId: 0, aciklama: "" });
  ebBankaRef.current = { bankaId: Number(searchParams.get("bk")) || 0, aciklama: searchParams.get("ba") || "" };
  const isDuzeltmeMode = Boolean(isDuzeltme || location.pathname.includes("duzeltme"));

  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);
  const notifTimerRef = useRef<any>(null);
  const showNotif = useCallback((type: "success" | "danger" | "warning" | "info", msg: string) => {
    if (notifTimerRef.current) {
      clearTimeout(notifTimerRef.current);
    }
    setNotification({ type, message: msg });
    notifTimerRef.current = setTimeout(() => {
      setNotification(null);
      notifTimerRef.current = null;
    }, 3500);
  }, []);

  // Lookups
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [urunList, setUrunList] = useState<UrunItem[]>([]);
  const [bakiyeler, setBakiyeler] = useState<VezneBakiyeItem[]>([]);
  const [fisList, setFisList] = useState<SarrafFisListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [kayitsizMusteriList, setKayitsizMusteriList] = useState<KayitsizMusteriItem[]>([]);
  const [showCariModal, setShowCariModal] = useState<boolean>(false);
  const [kurSatirlar, setKurSatirlar] = useState<KurRowItem[]>([]);
  const [paraList, setParaList] = useState<ParaItem[]>(() => FastLookupCache.getSync<ParaItem[]>("paralar") || []);
  const [numeratorList, setNumeratorList] = useState<NumeratorItem[]>([]);
  const [bankaList, setBankaList] = useState<BankaHesapItem[]>([]);
  const [posList, setPosList] = useState<PosCihaziItem[]>([]);
  const [iskontoList, setIskontoList] = useState<IskontoItem[]>([]);
  const [showOdemeCariModal, setShowOdemeCariModal] = useState<boolean>(false);
  const [showOdemeParaIskontoModal, setShowOdemeParaIskontoModal] = useState<boolean>(false);
  const [showNewIskontoModal, setShowNewIskontoModal] = useState<boolean>(false);
  const [showOdemeHesapModal, setShowOdemeHesapModal] = useState<boolean>(false);
  const [showOdemePosModal, setShowOdemePosModal] = useState<boolean>(false);
  const [odemeLookupSearchTerm, setOdemeLookupSearchTerm] = useState<string>("");
  const [targetOdemeRowIdForLookup, setTargetOdemeRowIdForLookup] = useState<string | null>(null);

  // Synchronous cache pre-fill from FastLookupCache for 0ms instant initial rendering
  useEffect(() => {
    const cachedVezneler = FastLookupCache.getSync<VezneItem[]>("vezneler");
    if (cachedVezneler && cachedVezneler.length > 0 && !vezneList.length) setVezneList(cachedVezneler);

    const cachedUrunler = FastLookupCache.getSync<UrunItem[]>("urunler");
    if (cachedUrunler && cachedUrunler.length > 0 && !urunList.length) setUrunList(cachedUrunler);

    const cachedCariler = FastLookupCache.getSync<CariKartItem[]>("cariKartlar");
    if (cachedCariler && cachedCariler.length > 0 && !cariList.length) setCariList(cachedCariler);

    const cachedNumerators = FastLookupCache.getSync<NumeratorItem[]>("numerators");
    if (cachedNumerators && cachedNumerators.length > 0 && !numeratorList.length) setNumeratorList(cachedNumerators);

    const cachedBankalar = FastLookupCache.getSync<BankaHesapItem[]>("bankalar");
    if (cachedBankalar && cachedBankalar.length > 0 && !bankaList.length) setBankaList(cachedBankalar);

    const cachedPoslar = FastLookupCache.getSync<PosCihaziItem[]>("poslar");
    if (cachedPoslar && cachedPoslar.length > 0 && !posList.length) setPosList(cachedPoslar);

    const cachedIskontolar = FastLookupCache.getSync<IskontoItem[]>("iskontolar");
    if (cachedIskontolar && cachedIskontolar.length > 0 && !iskontoList.length) setIskontoList(cachedIskontolar);

    const cachedKur0 = FastLookupCache.getSync<any>("kurTablo_0");
    const cachedKur1 = FastLookupCache.getSync<any>("kurTablo_1");
    if (cachedKur0?.satirlar || cachedKur1?.satirlar) {
      const mergedKurMap = new Map<string, KurRowItem>();
      (cachedKur1?.satirlar || []).forEach((k: KurRowItem) => {
        const key = k.kod ? k.kod.toUpperCase().trim() : (k.paraId ? `ID_${k.paraId}` : (k.ad ? k.ad.toUpperCase().trim() : ""));
        if (key) mergedKurMap.set(key, k);
      });
      (cachedKur0?.satirlar || []).forEach((k: KurRowItem) => {
        const key = k.kod ? k.kod.toUpperCase().trim() : (k.paraId ? `ID_${k.paraId}` : (k.ad ? k.ad.toUpperCase().trim() : ""));
        if (key) {
          const existing = mergedKurMap.get(key);
          mergedKurMap.set(key, {
            ...existing,
            ...k,
            efektifAlis: (k.efektifAlis !== null && k.efektifAlis !== undefined && Number(k.efektifAlis) > 0) ? k.efektifAlis : (existing?.efektifAlis ?? null),
            efektifSatis: (k.efektifSatis !== null && k.efektifSatis !== undefined && Number(k.efektifSatis) > 0) ? k.efektifSatis : (existing?.efektifSatis ?? null),
            dovizAlis: (k.dovizAlis !== null && k.dovizAlis !== undefined && Number(k.dovizAlis) > 0) ? k.dovizAlis : (existing?.dovizAlis ?? null),
            dovizSatis: (k.dovizSatis !== null && k.dovizSatis !== undefined && Number(k.dovizSatis) > 0) ? k.dovizSatis : (existing?.dovizSatis ?? null),
          });
        }
      });
      setKurSatirlar(Array.from(mergedKurMap.values()));
    }

    const cachedParalar = FastLookupCache.getSync<ParaItem[]>("paralar");
    if (cachedParalar && cachedParalar.length > 0) setParaList(cachedParalar);

    FastLookupCache.get("paralar", () => apiClient.get<ParaItem[]>("/para").then((r) => r.data || []))
      .then((p) => {
        if (p && p.length > 0) setParaList(p);
      })
      .catch(() => { });

    IskontoService.getIskontolar({ aktif: true })
      .then((data) => {
        if (data && data.length > 0) setIskontoList(data);
      })
      .catch(() => { });
  }, []);

  // Canlı Ürün Senkronizasyonu (Sayfa yenilemesi olmadan Ürün Seçimi modalında anında güncelleme)
  useEffect(() => {
    const unsub = onProductChanged(async (event) => {
      if (event.type === "all" || event.type === "para") {
        try {
          const fresh = await SarrafFisService.getUrunler(true);
          if (fresh && fresh.length > 0) {
            setUrunList(fresh);
          }
        } catch (err) {
          console.error("SarrafFisi canlı ürün senkronizasyon hatası:", err);
        }
      }
    });
    return unsub;
  }, []);

  // POS & Banka yüklendiğinde var olan satırlardaki kodları ve adları eşleştir (sadece kod boşsa)
  useEffect(() => {
    if (posList.length > 0 || bankaList.length > 0) {
      setOdemeRows((prev) =>
        prev.map((r) => {
          if (r.odemeAraciTuru === 2 && posList.length > 0 && r.bankaId && !r.cariKod) {
            const match = posList.find((p) => p.posCihaziId === r.bankaId);
            if (match) {
              return {
                ...r,
                cariKod: match.kod,
                paraAdi: r.paraAdi && r.paraAdi !== "KREDİ KARTI / POS" ? r.paraAdi : (match.ad || "KREDİ KARTI / POS"),
              };
            }
          } else if (r.odemeAraciTuru === 3 && bankaList.length > 0 && r.bankaId && !r.cariKod) {
            const match = bankaList.find((b) => b.bankaId === r.bankaId);
            if (match) {
              return {
                ...r,
                cariKod: match.hesapNo,
                paraAdi: r.paraAdi && r.paraAdi !== "BANKA HAVALE / EFT" ? r.paraAdi : (match.hesapAdi ? `${match.bankaAdi ? match.bankaAdi + " - " : ""}${match.hesapAdi}` : (match.bankaAdi || "BANKA HAVALE / EFT")),
              };
            }
          }
          return r;
        })
      );
    }
  }, [posList, bankaList]);

  const odemeParaList = useMemo(() => {
    return urunList.filter((u) => u.urunTipi === 0 || u.kod?.toUpperCase() === "TL" || u.kod?.toUpperCase() === "TRY");
  }, [urunList]);



  // Helper to determine active Seri No / Belge No from Numerators
  const getNumeratorForTip = useCallback((t: number, numerators: NumeratorItem[]) => {
    if (t === 0) {
      // Alış Seri No: Tur 0, 1, 2, 3 (veya 8)
      const num = (numerators || []).find((n) => [0, 1, 2, 3].includes(n.tur))
        || (numerators || []).find((n) => n.tur === 8);
      if (num) {
        const onek = (num.onek || "A").trim();
        const baslangic = num.baslangic || 1;
        const uzunluk = num.uzunluk || 10;
        const padLen = Math.max(1, uzunluk - onek.length);
        const numStr = num.onuneSifirKoy !== false
          ? String(baslangic).padStart(padLen, "0")
          : String(baslangic);
        const fullSeri = `${onek}${numStr}`;
        return {
          seriNo: fullSeri,
          fisNo: num.ornekNumara || String(baslangic),
        };
      }
      return { seriNo: "", fisNo: "" };
    } else {
      // Satış Seri No: Tur 4, 5, 6, 7 (veya 9)
      const num = (numerators || []).find((n) => [4, 5, 6, 7].includes(n.tur))
        || (numerators || []).find((n) => n.tur === 9);
      if (num) {
        const onek = (num.onek || "S").trim();
        const baslangic = num.baslangic || 1;
        const uzunluk = num.uzunluk || 10;
        const padLen = Math.max(1, uzunluk - onek.length);
        const numStr = num.onuneSifirKoy !== false
          ? String(baslangic).padStart(padLen, "0")
          : String(baslangic);
        const fullSeri = `${onek}${numStr}`;
        return {
          seriNo: fullSeri,
          fisNo: num.ornekNumara || String(baslangic),
        };
      }
      return { seriNo: "", fisNo: "" };
    }
  }, []);

  // Header State
  const GRID_COL_STORAGE_KEY = `sarraf_fis_grid_cols_${user?.id || "default"}`;

  const defaultColVisibility = {
    urunAdi: true,
    adet: true,
    miktar: true,
    milyem: true,
    hasGram: true,
    iscilikToplam: true,
    tlTutar: true,
    iscilikHesaplamaSekli: true,
    iscilikiMiktari: true,
    iscilikHasGram: true,
    iscilikTutari: true,
    iscilikKdvOrani: true,
    iscilikKdvTutari: true,
    kur: true,
    tutar: true,
  };

  const [colVisibility, setColVisibility] = useState<typeof defaultColVisibility>(() => {
    try {
      const stored = localStorage.getItem(GRID_COL_STORAGE_KEY);
      if (stored) return { ...defaultColVisibility, ...JSON.parse(stored) };
    } catch { }
    return defaultColVisibility;
  });

  const toggleCol = (col: keyof typeof defaultColVisibility) => {
    setColVisibility((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      try { localStorage.setItem(GRID_COL_STORAGE_KEY, JSON.stringify(next)); } catch { }
      return next;
    });
  };

  const [fisId, setFisId] = useState<number | null>(null);
  const [fisNo, setFisNo] = useState("");
  const [seriNo, setSeriNo] = useState("");
  const [cariKod, setCariKod] = useState("");
  const [tarih, setTarih] = useState(() => new Date().toISOString().split("T")[0]);
  const [saat, setSaat] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  // Kayıt modunda anlık saati canlı güncelle
  useEffect(() => {
    if (isDuzeltmeMode) return;
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setTarih(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      setSaat(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, [isDuzeltmeMode]);
  const [tip, setTip] = useState<0 | 1>(1);

  // Alış / Satış başlığı renk teması
  const activeFisThemeBg = useMemo(() => {
    let buyBg = user?.appearance?.buyHeaderBgColor;
    let sellBg = user?.appearance?.sellHeaderBgColor;
    if (!buyBg || !sellBg) {
      try {
        const cached = localStorage.getItem("kuyumcu_active_appearance");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!buyBg && parsed.buyHeaderBgColor) buyBg = parsed.buyHeaderBgColor;
          if (!sellBg && parsed.sellHeaderBgColor) sellBg = parsed.sellHeaderBgColor;
        }
      } catch { }
    }
    if (tip === 0) {
      return buyBg || "var(--user-buy-header-bg, #e2e8f0)";
    } else {
      return sellBg || "var(--user-sell-header-bg, #e2e8f0)";
    }
  }, [tip, user?.appearance?.buyHeaderBgColor, user?.appearance?.sellHeaderBgColor]);

  const activeFisThemeText = useMemo(() => {
    let buyText = user?.appearance?.buyHeaderTextColor;
    let sellText = user?.appearance?.sellHeaderTextColor;
    if (!buyText || !sellText) {
      try {
        const cached = localStorage.getItem("kuyumcu_active_appearance");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!buyText && parsed.buyHeaderTextColor) buyText = parsed.buyHeaderTextColor;
          if (!sellText && parsed.sellHeaderTextColor) sellText = parsed.sellHeaderTextColor;
        }
      } catch { }
    }
    if (tip === 0) {
      return buyText || "var(--user-buy-header-text, #0f172a)";
    } else {
      return sellText || "var(--user-sell-header-text, #0f172a)";
    }
  }, [tip, user?.appearance?.buyHeaderTextColor, user?.appearance?.sellHeaderTextColor]);

  const [belgeTuru, setBelgeTuru] = useState(0);
  const [unvan, setUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [altinHasKuru, setAltinHasKuru] = useState<number | string>("");
  const [alisKuru, setAlisKuru] = useState<number | string>("");
  const [satisKuru, setSatisKuru] = useState<number | string>("");
  const [gumusHasKuru, setGumusHasKuru] = useState<number | string>("");
  const [kdvOrani, setKdvOrani] = useState<number | string>("");
  // e-Belge GİB kodu (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF29): ön değer 805, gümüş satırlarına faturada 808
  const [istisnaKodu, setIstisnaKodu] = useState<string>(ALTIN_KODU);
  const lastActiveIstisnaKoduRef = useRef<string>(ALTIN_KODU);
  const [vezneId, setVezneId] = useState(0);
  const [vezneKod, setVezneKod] = useState("");
  const [vezneAd, setVezneAd] = useState("");

  // Detay Modal State
  const [detayUnvan, setDetayUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [detayKisilikTipi, setDetayKisilikTipi] = useState(0);
  const [detayVergiKimlikNo, setDetayVergiKimlikNo] = useState("");
  const [detayBabaAdi, setDetayBabaAdi] = useState("");
  const [detayAnneAdi, setDetayAnneAdi] = useState("");
  const [detayAdres, setDetayAdres] = useState("");
  const [detayEposta, setDetayEposta] = useState("");
  const [detayTelefonNo, setDetayTelefonNo] = useState("");
  const [detayDogumTarihi, setDetayDogumTarihi] = useState("");
  const [detayDogumYeri, setDetayDogumYeri] = useState("");
  const [detayKimlikSeriNo, setDetayKimlikSeriNo] = useState("");
  const [detayPasaportNo, setDetayPasaportNo] = useState("");
  const [detayKimlikBelgeTuru, setDetayKimlikBelgeTuru] = useState(0);
  const [detayKimlikGecerlilikTarihi, setDetayKimlikGecerlilikTarihi] = useState("");
  const [detayVekilAdi, setDetayVekilAdi] = useState("");
  const [detayVekilKimlikNo, setDetayVekilKimlikNo] = useState("");

  // Cari Bakiye Summary State
  const [cariBakiyeSummary, setCariBakiyeSummary] = useState<CariBakiyeSummary | null>(null);
  const [isLoadingCariBakiye, setIsLoadingCariBakiye] = useState<boolean>(false);

  const loadCariBakiye = useCallback(async (cId: number | null) => {
    if (!cId || cId <= 0) {
      setCariBakiyeSummary(null);
      return;
    }
    try {
      setIsLoadingCariBakiye(true);
      const res = await CariHareketService.getCariBakiye(cId);
      setCariBakiyeSummary(res);
    } catch (e) {
      console.warn("Cari bakiye getirme hatası:", e);
      setCariBakiyeSummary(null);
    } finally {
      setIsLoadingCariBakiye(false);
    }
  }, []);

  useEffect(() => {
    if (cariKartId && cariKartId > 0) {
      void loadCariBakiye(cariKartId);
    } else {
      setCariBakiyeSummary(null);
    }
  }, [cariKartId, loadCariBakiye]);

  // Grid State (Kalemler)
  const [lines, setLines] = useState<GridRow[]>([createEmptyRow(1)]);
  const linesRef = useRef<GridRow[]>(lines);
  linesRef.current = lines;
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [invalidRowIds, setInvalidRowIds] = useState<Record<string, boolean>>({});
  const rowInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  // Ödeme / Tahsilat Tablosu Grid State
  const [odemeRows, setOdemeRows] = useState<OdemeRow[]>([createEmptyOdemeRow(1)]);
  const odemeRowsRef = useRef<OdemeRow[]>(odemeRows);
  odemeRowsRef.current = odemeRows;
  const [activeOdemeRowIndex, setActiveOdemeRowIndex] = useState(0);
  const [invalidOdemeRowIds, setInvalidOdemeRowIds] = useState<Record<string, boolean>>({});
  const odemeInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const odemeFocusedInitialValRef = useRef<Record<string, string>>({});

  // Anlık Kur Değişikliklerini Canlı / Otomatik Dinleme ve Tablolara Senkronize Etme
  useEffect(() => {
    const unsubscribe = KurService.onKurUpdated((updatedTablo) => {
      if (!updatedTablo || !updatedTablo.satirlar) return;
      setKurSatirlar((prev) => {
        const mergedKurMap = new Map<string, KurRowItem>();
        prev.forEach((k) => {
          const key = k.kod ? k.kod.toUpperCase().trim() : (k.paraId ? `ID_${k.paraId}` : (k.ad ? k.ad.toUpperCase().trim() : ""));
          if (key) mergedKurMap.set(key, k);
        });
        updatedTablo.satirlar.forEach((k) => {
          const key = k.kod ? k.kod.toUpperCase().trim() : (k.paraId ? `ID_${k.paraId}` : (k.ad ? k.ad.toUpperCase().trim() : ""));
          if (key) {
            const existing = mergedKurMap.get(key);
            mergedKurMap.set(key, {
              ...existing,
              ...k,
              efektifAlis: (k.efektifAlis !== null && k.efektifAlis !== undefined && Number(k.efektifAlis) > 0) ? k.efektifAlis : (existing?.efektifAlis ?? null),
              efektifSatis: (k.efektifSatis !== null && k.efektifSatis !== undefined && Number(k.efektifSatis) > 0) ? k.efektifSatis : (existing?.efektifSatis ?? null),
              dovizAlis: (k.dovizAlis !== null && k.dovizAlis !== undefined && Number(k.dovizAlis) > 0) ? k.dovizAlis : (existing?.dovizAlis ?? null),
              dovizSatis: (k.dovizSatis !== null && k.dovizSatis !== undefined && Number(k.dovizSatis) > 0) ? k.dovizSatis : (existing?.dovizSatis ?? null),
              parite: k.parite ?? existing?.parite ?? null,
            });
          }
        });
        const allKurList = Array.from(mergedKurMap.values());

        const hasKurItem = allKurList.find((k) =>
          ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()) ||
          (k.ad && ["HAS ALTIN", "HAS"].includes(k.ad.toUpperCase().trim()))
        );
        const newHas = hasKurItem
          ? (tip === 0
            ? (hasKurItem.efektifAlis || hasKurItem.dovizAlis)
            : (hasKurItem.efektifSatis || hasKurItem.dovizSatis))
          : "";

        const gumusKurItem = allKurList.find((k) =>
          ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()) ||
          (k.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(k.ad.toUpperCase().trim()))
        );
        const newGumus = gumusKurItem
          ? (tip === 0
            ? (gumusKurItem.efektifAlis || gumusKurItem.dovizAlis)
            : (gumusKurItem.efektifSatis || gumusKurItem.dovizSatis))
          : "";

        // Kayıt modunda üst bilgi kurlarını ve tablodaki satırların kurlarını anında canlı güncelle
        if (!isDuzeltmeMode) {
          if (newHas) setAltinHasKuru(newHas);
          if (newGumus) setGumusHasKuru(newGumus);

          // Kalemler Tablosundaki (Lines) ürün satırlarının kurlarını canlı güncelle
          setLines((prevLines) =>
            prevLines.map((line) => {
              if (!line.urunKodu) return line;
              const pId = line.urunId;
              const code = (line.urunKodu || "").toUpperCase().trim();
              const name = (line.urunAdi || "").toUpperCase().trim();
              const curKurItem = allKurList.find(
                (k) =>
                  (pId && k.paraId === pId) ||
                  (code && k.kod && k.kod.toUpperCase().trim() === code) ||
                  (name && k.ad && k.ad.toUpperCase().trim() === name)
              );
              let newKur = line.kur;
              if (curKurItem) {
                const rate = tip === 0
                  ? (curKurItem.efektifAlis ?? curKurItem.dovizAlis ?? 0)
                  : (curKurItem.efektifSatis ?? curKurItem.dovizSatis ?? 0);
                if (Number(rate) > 0) newKur = Number(rate);
              } else if (line.urunTipi === 2) {
                newKur = newGumus || line.kur;
              } else if (line.urunTipi === 1 || !line.urunTipi) {
                newKur = newHas || line.kur;
              }
              const updated = { ...line, kur: newKur };
              return recomputeRow(updated, Number(newKur) || Number(newHas) || 0, undefined, userIscilikGirisSekli, isKdvDisabledRef.current);
            })
          );

          // Ödeme Tablosundaki (OdemeRows) satırların kurlarını canlı güncelle
          setOdemeRows((prevOdeme) =>
            prevOdeme.map((oRow) => {
              const code = (oRow.paraKodu || "").toUpperCase().trim();
              if (!code || code === "TL" || code === "TRY") return oRow;
              const curKurItem = allKurList.find(
                (k) =>
                  (oRow.paraId && k.paraId === oRow.paraId) ||
                  (code && k.kod && k.kod.toUpperCase().trim() === code) ||
                  (oRow.paraAdi && k.ad && k.ad.toUpperCase().trim() === oRow.paraAdi.toUpperCase().trim())
              );
              const odemeTip: 0 | 1 = tip === 0 ? 1 : 0;
              let newKur = oRow.kur;
              if (curKurItem) {
                const rate = odemeTip === 0
                  ? (curKurItem.efektifAlis ?? curKurItem.dovizAlis ?? 0)
                  : (curKurItem.efektifSatis ?? curKurItem.dovizSatis ?? 0);
                if (Number(rate) > 0) newKur = Number(rate);
              }
              const updated = { ...oRow, kur: newKur };
              return recomputeOdemeRow(updated, Number(newHas) || 0);
            })
          );
        }

        return allKurList;
      });
    });

    return () => unsubscribe();
  }, [tip, isDuzeltmeMode]);

  // Header Element Refs for Keyboard Navigation
  const islemRef = useRef<HTMLSelectElement | null>(null);
  const tcknRef = useRef<HTMLInputElement | null>(null);
  const cariKodRef = useRef<HTMLInputElement | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
  const seriNoRef = useRef<HTMLInputElement | null>(null);
  const belgeNoRef = useRef<HTMLInputElement | null>(null);
  const istatistikRef = useRef<HTMLInputElement | null>(null);
  const hasKuruRef = useRef<HTMLInputElement | null>(null);
  const kdvKoduRef = useRef<HTMLInputElement | null>(null);
  const kdvOraniRef = useRef<HTMLInputElement | null>(null);

  // Detay Modal Element Refs for Keyboard Navigation
  const detayRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const DETAY_FIELDS = [
    "unvan", "kisilikTipi", "kimlikBelgeTuru", "vergiKimlikNo", "kimlikSeriNo",
    "pasaportNo", "babaAdi", "anneAdi", "dogumTarihi", "dogumYeri",
    "kimlikGecerlilikTarihi", "telefonNo", "adres", "eposta", "vekilAdi", "vekilKimlikNo",
  ] as const;

  const lastFocusedCariKodRef = useRef<string>("");
  const lastFocusedUnvanRef = useRef<string>("");
  const lastFocusedVknRef = useRef<string>("");
  // TC / VKN'den uzak sorgu (e-Fatura listesi + GİB, musteriGibAd.ts): numara değişince eski sorgunun yanıtı yok sayılır
  const uzakSorguSiraRef = useRef(0);
  const unvanRef = useRef(unvan);
  unvanRef.current = unvan;
  const vknRef = useRef(detayVergiKimlikNo);
  vknRef.current = detayVergiKimlikNo;
  const gibSonrasiRef = useRef<(ad: string, no: string) => void>(() => { });
  const lastFocusedIstatistikKodRef = useRef<string>("");
  const lastModalCallerRef = useRef<"cariKod" | "unvan" | "vkn" | "istatistik" | "gridKalem" | "gridOdeme" | null>(null);
  const lastKalemModalRowIdRef = useRef<string | null>(null);
  const lastOdemeModalRowIdRef = useRef<string | null>(null);
  const customerSelectedJustNowRef = useRef(false);

  // Modals
  const [showFisModal, setShowFisModal] = useState(false);
  const [showVezneModal, setShowVezneModal] = useState(false);
  const [showNewVezneModal, setShowNewVezneModal] = useState(false);
  const [showUrunModal, setShowUrunModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showNewCariModal, setShowNewCariModal] = useState(false);
  const [showNewBankaModal, setShowNewBankaModal] = useState(false);
  const [showOdemeParaModal, setShowOdemeParaModal] = useState(false);
  const [cariSearchTerm, setCariSearchTerm] = useState("");
  const [cariSearchField, setCariSearchField] = useState<CustomerSearchField>("all");
  const [urunSearchTerm, setUrunSearchTerm] = useState("");
  const [istatistikSearchTerm, setIstatistikSearchTerm] = useState("");
  const [showMasakCustomerWarningModal, setShowMasakCustomerWarningModal] = useState(false);
  const [showMasakMissingModal, setShowMasakMissingModal] = useState(false);
  const [masakMissingFields, setMasakMissingFields] = useState<string[]>([]);
  const [activeRowIdForUrun, setActiveRowIdForUrun] = useState<string | null>(null);
  const [activeOdemeRowIdForUrun, setActiveOdemeRowIdForUrun] = useState<string | null>(null);
  const activeRowIdForUrunRef = useRef<string | null>(null);
  const activeOdemeRowIdForUrunRef = useRef<string | null>(null);
  const [isUrunLoading, setIsUrunLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetayModal, setShowDetayModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showTeklifTaniModal, setShowTeklifTaniModal] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<any>(null);
  const [isPendingDirectPrint, setIsPendingDirectPrint] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasSayfaVerisi = useMemo(() => {
    if (fisId !== null && fisId > 0) return true;
    if (cariKartId !== null && cariKartId > 0) return true;
    if ((cariKod || "").trim() !== "") return true;
    if ((unvan || "").trim() !== "" && !isAnonymousCustomerName(unvan)) return true;
    if ((detayVergiKimlikNo || "").trim() !== "") return true;
    if ((detayPasaportNo || "").trim() !== "") return true;
    if ((detayTelefonNo || "").trim() !== "") return true;
    if ((detayAdres || "").trim() !== "") return true;
    const hasLineData = lines.some(
      (r) =>
        Boolean((r.urunKodu || "").trim()) ||
        Boolean((r.urunAdi || "").trim()) ||
        Number(r.urunId) > 0 ||
        parseDecimal(r.adet) > 0 ||
        parseDecimal(r.miktar) > 0 ||
        parseDecimal(r.tutar) > 0 ||
        parseDecimal(r.iscilikiMiktari) > 0 ||
        parseDecimal(r.iscilikTutari) > 0
    );
    if (hasLineData) return true;
    const hasOdemeData = odemeRows.some(
      (r) =>
        Boolean((r.paraKodu || "").trim()) ||
        Boolean((r.paraAdi || "").trim()) ||
        Boolean((r.cariKod || "").trim()) ||
        Boolean((r.aciklama || "").trim()) ||
        Boolean(r.cariKartId) ||
        Boolean(r.bankaId) ||
        Boolean(r.posCihaziId) ||
        Boolean(r.iskontoId) ||
        parseDecimal(r.adet) > 0 ||
        parseDecimal(r.miktar) > 0 ||
        parseDecimal(r.tutar) > 0
    );
    return hasOdemeData;
  }, [fisId, cariKartId, cariKod, unvan, detayVergiKimlikNo, detayPasaportNo, detayTelefonNo, detayAdres, lines, odemeRows]);

  const cikisUyarisi = useSayfaCikisUyarisi(hasSayfaVerisi);

  // Totals (Kalemler)
  const totalAdet = lines.reduce((s, r) => s + (parseDecimal(r.adet) || 0), 0);
  const totalMiktar = lines.reduce((s, r) => s + (parseDecimal(r.miktar) || 0), 0);
  const totalHasGram = lines.reduce((s, r) => s + (parseDecimal(r.hasGram) || 0), 0);
  const totalIscilikMiktari = lines.reduce((s, r) => s + (parseDecimal(formatIscilikGirisDegeri(r.iscilikiMiktari, userIscilikGirisSekli)) || 0), 0);
  const totalIscilikHasGram = lines.reduce((s, r) => s + (parseDecimal(r.iscilikHasGram) || 0), 0);
  const totalTLTutar = lines.reduce((s, r) => s + (parseDecimal(r.tlTutar) || 0), 0);
  const totalIscilikTutari = lines.reduce((s, r) => s + (parseDecimal(r.iscilikTutari) || 0), 0);
  const totalIscilikToplam = lines.reduce((s, r) => s + (parseDecimal(r.iscilikToplam) || 0), 0);
  const totalIscilikKdvTutari = lines.reduce((s, r) => {
    const rowKdv = parseDecimal(r.iscilikKdvTutari);
    if (rowKdv > 0) return s + rowKdv;
    const oran = parseDecimal(r.iscilikKdvOrani) || parseDecimal(kdvOrani) || 0;
    const it = parseDecimal(r.iscilikTutari);
    if (oran > 0 && it > 0) {
      return s + (it * oran) / 100;
    }
    return s;
  }, 0);
  const totalTutar = useMemo(() => {
    return parseFloat(lines.reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0).toFixed(2));
  }, [lines]);

  // Totals (Ödeme / Tahsilat)
  const totalOdemeAdet = odemeRows.reduce((s, r) => s + (parseDecimal(r.adet) || 0), 0);
  const totalOdemeMiktar = odemeRows.reduce((s, r) => s + (parseDecimal(r.miktar) || 0), 0);
  const totalOdemeHas = odemeRows.reduce((s, r) => s + (parseDecimal(r.hasGram) || 0), 0);
  const totalOdemeTutar = odemeRows.reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0);

  // Has toplamları ve Has Karşılıkları
  const alisHas = useMemo(() => {
    const explicitHas = totalHasGram + totalIscilikHasGram;
    if (explicitHas > 0) return explicitHas;
    const goldKur = Number(altinHasKuru) || 0;
    if (totalTutar > 0 && goldKur > 0) {
      return parseFloat((totalTutar / goldKur).toFixed(4));
    }
    return 0;
  }, [totalHasGram, totalIscilikHasGram, totalTutar, altinHasKuru]);

  const farkTL = totalTutar - totalOdemeTutar;

  const odemeHas = useMemo(() => {
    const explicitOdemeHas = odemeRows.reduce((s, r) => s + (parseDecimal(r.hasGram) || 0), 0);
    if (explicitOdemeHas > 0 && Math.abs(totalOdemeTutar) < 0.01) {
      return explicitOdemeHas;
    }
    if (totalTutar > 0 && alisHas > 0) {
      if (Math.abs(farkTL) < 0.01) {
        return alisHas;
      }
      const ratio = totalOdemeTutar / totalTutar;
      return parseFloat((alisHas * ratio).toFixed(4));
    }
    if (explicitOdemeHas > 0) return explicitOdemeHas;
    const goldKur = Number(altinHasKuru) || 0;
    if (totalOdemeTutar > 0 && goldKur > 0) {
      return parseFloat((totalOdemeTutar / goldKur).toFixed(4));
    }
    return 0;
  }, [odemeRows, totalTutar, alisHas, farkTL, totalOdemeTutar, altinHasKuru]);

  const farkHas = useMemo(() => {
    if (Math.abs(farkTL) < 0.01) {
      return 0;
    }
    const diff = alisHas - odemeHas;
    if (Math.abs(diff) < 0.0001) return 0;
    return parseFloat(diff.toFixed(4));
  }, [farkTL, alisHas, odemeHas]);

  // Ödeme / Tahsilat tablosundaki Adet sütununun girilen sayı uzunluğuna göre dinamik genişliği
  const odemeAdetColWidth = useMemo(() => {
    let maxLen = 4;
    for (const r of odemeRows) {
      const valStr = (r.adet != null ? String(r.adet) : "").trim();
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    }
    const totalStr = totalOdemeAdet > 0 ? totalOdemeAdet.toLocaleString("tr-TR") : "";
    if (totalStr.length > maxLen) {
      maxLen = totalStr.length;
    }
    return Math.max(55, Math.ceil(maxLen * 9.5 + 24));
  }, [odemeRows, totalOdemeAdet]);

  // Ödeme / Tahsilat tablosundaki Miktar sütununun girilen sayı uzunluğuna göre dinamik genişliği
  const odemeMiktarColWidth = useMemo(() => {
    let maxLen = 6;
    for (const r of odemeRows) {
      const valStr = (r.miktar != null ? String(r.miktar) : "").trim();
      const fmtStr = formatMiktar(r.miktar) || "";
      const len = Math.max(valStr.length, fmtStr.length);
      if (len > maxLen) {
        maxLen = len;
      }
    }
    return Math.max(75, Math.ceil(maxLen * 9.5 + 24));
  }, [odemeRows]);

  // Ürün / Kalemler tablosundaki Miktar sütununun dinamik genişliği
  const linesMiktarColWidth = useMemo(() => {
    let maxLen = 6;
    for (const r of lines) {
      const valStr = (r.miktar != null ? String(r.miktar) : "").trim();
      const fmtStr = formatMiktar(r.miktar) || "";
      const len = Math.max(valStr.length, fmtStr.length);
      if (len > maxLen) {
        maxLen = len;
      }
    }
    return Math.max(75, Math.ceil(maxLen * 9.5 + 24));
  }, [lines]);

  // Bakiye / Eksi Fark Onay Modalı
  const [showFarkConfirmModal, setShowFarkConfirmModal] = useState<{ show: boolean; andPrint: boolean }>({ show: false, andPrint: false });
  const [showFarkIskontoSecimModal, setShowFarkIskontoSecimModal] = useState<{ show: boolean; andPrint: boolean }>({ show: false, andPrint: false });

  // İstatistik Tanımları Listesi, Firma Tanımları ve Seçili İstatistik
  const [statisticList, setStatisticList] = useState<StatisticItem[]>([]);
  const [selectedStatistic, setSelectedStatistic] = useState<StatisticItem | IstatistikSecimItem | null>(null);
  const [istatistikFisDizaynTipi, setIstatistikFisDizaynTipi] = useState<number | null>(null);
  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(() => CompanyService.cachedDefinitions);
  const companyDefinitionsRef = useRef<TodvzTanimDto | null>(CompanyService.cachedDefinitions);
  companyDefinitionsRef.current = companyDefinitions || CompanyService.cachedDefinitions;

  useEffect(() => {
    CompanyService.getDefinitions(true)
      .then((defs) => {
        if (defs) {
          companyDefinitionsRef.current = defs;
          setCompanyDefinitions(defs);
        }
      })
      .catch(() => { });
  }, []);

  const defaultIskonto = useMemo<IskontoItem | null>(() => {
    const defId = companyDefinitions?.ISKONTO_ID || companyDefinitionsRef.current?.ISKONTO_ID;
    if (defId && iskontoList.length > 0) {
      const found = iskontoList.find((i) => i.iskontoId === defId || Number(i.iskontoId) === Number(defId));
      if (found) return found;
    }
    return iskontoList.length > 0 ? iskontoList[0] : null;
  }, [companyDefinitions?.ISKONTO_ID, iskontoList]);

  const isCokluSatirIzinli = useMemo(() => {
    return (
      companyDefinitions?.FISTE_COKLU_SATIR === true ||
      (companyDefinitions?.FISTE_COKLU_SATIR as any) === 1 ||
      (companyDefinitions?.FISTE_COKLU_SATIR as any) === "1" ||
      (companyDefinitions?.FISTE_COKLU_SATIR as any) === "true"
    );
  }, [companyDefinitions]);

  const isMasakKontroluVar = useMemo(() => {
    if (!companyDefinitions) return true;
    const val = companyDefinitions.FIS_MASAK_KONTROLU_VAR;
    if (val === false || (val as any) === 0 || (val as any) === "0" || (val as any) === "false") {
      return false;
    }
    return true;
  }, [companyDefinitions]);
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [istatistikId, setIstatistikId] = useState<number | null>(null);
  const [istatistikKodu, setIstatistikKodu] = useState<string>("");

  const activeStat = useMemo(() => {
    if (istatistikKodu && istatistikKodu.trim()) {
      const match = statisticList.find((s) => (s.kod && s.kod.trim().toLowerCase() === istatistikKodu.trim().toLowerCase()) || (istatistikId && s.id === istatistikId));
      if (match) return match;
    }
    if (selectedStatistic) return selectedStatistic;
    if (istatistikId) {
      const match = statisticList.find((s) => s.id === istatistikId);
      if (match) return match;
    }
    return null;
  }, [selectedStatistic, statisticList, istatistikId, istatistikKodu]);

  // Listeden açılan e-Banka fişi (M32): sunucu fişle birlikte eşli banka hareketini döndürür; yalnız o fiş açıkken geçerli
  const [ebBag, setEbBag] = useState<{
    fisId: number; vomsisId: number; yon: "gelen" | "giden"; tutar: number; doviz: string | null; bankaId: number | null; bankaAdi: string; hesapNo: string | null;
  } | null>(null);
  const ebBagli = Boolean(ebBag && fisId && ebBag.fisId === fisId);

  const isKdvDisabled = useMemo(() => {
    // e-Banka'dan açılan fişte işçilik KDV'si istatistikten bağımsız açık: alış ve satışta %20 gelir, değiştirilir (M19, M32)
    if (ebankaFisi || ebBagli) return false;
    const rawVal = activeStat?.fisDizaynTipi ?? (activeStat as any)?.FIS_DIZAYN_TIPI ?? (activeStat as any)?.fis_dizayn_tipi ?? istatistikFisDizaynTipi;
    if (rawVal === undefined || rawVal === null || rawVal === "") return false;
    return Number(rawVal) === 1;
  }, [istatistikFisDizaynTipi, activeStat, ebankaFisi, ebBagli]);
  const isKdvDisabledRef = useRef<boolean>(isKdvDisabled);
  isKdvDisabledRef.current = isKdvDisabled;

  const prevIsKdvDisabledRef = useRef(isKdvDisabled);
  useEffect(() => {
    if (prevIsKdvDisabledRef.current && !isKdvDisabled) {
      if (!istisnaKodu) {
        setIstisnaKodu(lastActiveIstisnaKoduRef.current || ALTIN_KODU);
      }
    } else if (!prevIsKdvDisabledRef.current && isKdvDisabled) {
      setIstisnaKodu("");
    }
    prevIsKdvDisabledRef.current = isKdvDisabled;
  }, [isKdvDisabled]);
  const [showIstatistikModal, setShowIstatistikModal] = useState<boolean>(false);
  const prevTipRef = useRef<number>(tip);

  useEffect(() => {
    PrinterService.getYazicilar().then(setPrinters).catch(() => { });
  }, []);

  // MASAK Sorgulama ve Limit Takip Durumu
  const [isSearchingMasak, setIsSearchingMasak] = useState<boolean>(false);
  const [masakModalOpen, setMasakModalOpen] = useState<boolean>(false);
  const [masakManagementOpen, setMasakManagementOpen] = useState<boolean>(false);
  const [masakResult, setMasakResult] = useState<{
    queriedName?: string;
    queriedId?: string;
    matches: MasakEslesme[];
    searched: boolean;
  }>({ matches: [], searched: false });

  // Modal Açık mı Durumu (Modallar açıkken arkadaki hücre ve input geçişlerini bloke etmek için)
  const isAnyModalOpen = Boolean(
    showFisModal ||
    showVezneModal ||
    showUrunModal ||
    showCariModal ||
    showOdemeCariModal ||
    showOdemeHesapModal ||
    showOdemePosModal ||
    showOdemeParaModal ||
    showNewProductModal ||
    showNewCariModal ||
    showNewBankaModal ||
    showDetayModal ||
    showPrintModal ||
    showTeklifTaniModal ||
    showIstatistikModal ||
    showFarkConfirmModal.show ||
    showFarkIskontoSecimModal.show ||
    masakModalOpen ||
    masakManagementOpen ||
    showMasakCustomerWarningModal ||
    showMasakMissingModal ||
    showDeleteConfirm
  );

  // MASAK Malvarlığı Dondurulanlar Bloke Durumu
  const isMasakBlocked = Boolean(isMasakKontroluVar && masakResult.searched && masakResult.matches && masakResult.matches.length > 0);

  const masakStatus = useMemo(() => {
    const compDef = companyDefinitionsRef.current || companyDefinitions || CompanyService.cachedDefinitions;
    const tlLimit = Number(compDef?.TL_VERGI_SINIRI) > 0 ? Number(compDef.TL_VERGI_SINIRI) : 100000;
    const dovizLimit = Number(compDef?.DOVIZ_VERGI_SINIRI) > 0 ? Number(compDef.DOVIZ_VERGI_SINIRI) : 5000;
    const dovizParaId = compDef?.DOVIZ_VERGI_SINIRI_PARA_ID ? Number(compDef.DOVIZ_VERGI_SINIRI_PARA_ID) : 2;
    const limitPara =
      paraList.find((p) => Number(p.id) === dovizParaId) ||
      paraList.find((p) => p.kod?.toUpperCase() === (dovizParaId === 3 ? "EUR" : "USD")) ||
      paraList.find((p) => p.kod?.toUpperCase() === "USD");
    const limitParaKodu = (limitPara?.kod || (dovizParaId === 3 ? "EUR" : "USD")).toUpperCase().trim();

    const altinLimit = Number(compDef?.ALTIN_VERGI_SINIRI) > 0 ? Number(compDef.ALTIN_VERGI_SINIRI) : 5000;
    const altinParaId = compDef?.ALTIN_VERGI_SINIRI_PARA_ID ? Number(compDef.ALTIN_VERGI_SINIRI_PARA_ID) : 2;
    const altinPara =
      paraList.find((p) => Number(p.id) === altinParaId) ||
      paraList.find((p) => p.kod?.toUpperCase() === "USD") ||
      paraList.find((p) => p.kod?.toUpperCase() === "22");
    const altinParaKodu = (altinPara?.kod || "USD").toUpperCase().trim();

    const fallback = {
      isExceeded: false,
      type: null as null | "altin" | "doviz" | "tl",
      limitLabel: `TL: ${tlLimit.toLocaleString("tr-TR")} ₺ | Döviz: ${dovizLimit.toLocaleString("tr-TR")} ${limitParaKodu} | Altın: ${altinLimit.toLocaleString("tr-TR")} ${altinParaKodu}`,
      limitTitle: "MASAK Yasal Bildirim Sınırı Uyarısı",
    };

    const usdRate = (() => {
      const kurItem = kurSatirlar.find((k) => (k.kod || "").toUpperCase().trim() === "USD" || Number(k.paraId) === 2);
      const r = Number(tip === 0 ? (kurItem?.efektifAlis || kurItem?.dovizAlis) : (kurItem?.efektifSatis || kurItem?.dovizSatis)) || 0;
      return r > 0 ? r : 35;
    })();

    const activeLimitParaRate = (() => {
      const kurItem = kurSatirlar.find((k) => (k.kod || "").toUpperCase().trim() === limitParaKodu || Number(k.paraId) === dovizParaId);
      const r = Number(tip === 0 ? (kurItem?.efektifAlis || kurItem?.dovizAlis) : (kurItem?.efektifSatis || kurItem?.dovizSatis)) || 0;
      return r > 0 ? r : (limitParaKodu === "USD" ? usdRate : 38);
    })();

    const activeAltinParaRate = (() => {
      if (altinParaKodu === "TL" || altinParaKodu === "TRY") return 1;
      const kurItem = kurSatirlar.find((k) => (k.kod || "").toUpperCase().trim() === altinParaKodu || (altinParaId && Number(k.paraId) === altinParaId));
      const directRate = Number(tip === 0 ? (kurItem?.efektifAlis || kurItem?.dovizAlis) : (kurItem?.efektifSatis || kurItem?.dovizSatis)) || 0;
      if (directRate > 0) return directRate;
      if (altinParaKodu === "USD" || altinParaKodu === "$") return usdRate;
      if (altinParaKodu === "EUR" || altinParaKodu === "€") return (activeLimitParaRate > 0 && limitParaKodu === "EUR" ? activeLimitParaRate : 38);
      const hasKurItem = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
      const hasRate = Number(tip === 0 ? (hasKurItem?.efektifAlis || hasKurItem?.dovizAlis) : (hasKurItem?.efektifSatis || hasKurItem?.dovizSatis)) || Number(altinHasKuru) || 3200;
      const hasRatio = (altinPara as any)?.hasOrani ? Number((altinPara as any).hasOrani) : (altinParaKodu === "22" ? 0.916 : (altinParaKodu === "14" ? 0.585 : (altinParaKodu === "18" ? 0.75 : 1)));
      return hasRate * hasRatio;
    })();

    const isGoldItem = (paraId?: number | null, kod?: string, ad?: string, uTipi?: number | null, lineRef?: any) => {
      const upperKod = (kod || "").toUpperCase().trim();
      const upperAd = (ad || "").toUpperCase().trim();
      // Döviz birimleri kesinlikle altın sayılmaz
      if (["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "SAR", "AED", "RUB", "KWD", "$", "€", "£"].includes(upperKod)) {
        return false;
      }
      if (isTlItem(kod)) return false;
      if (lineRef && ((parseDecimal(lineRef.hasGram) || 0) > 0 || (parseDecimal(lineRef.milyem) || 0) > 0)) return true;
      if (uTipi === 1 || uTipi === 2 || uTipi === 3) return true;
      const matchedPara = paraList.find((x) => (paraId && Number(x.id) === Number(paraId)) || (x.kod && kod && x.kod.toUpperCase().trim() === upperKod));
      if (matchedPara && (matchedPara.urunTipi === 1 || matchedPara.urunTipi === 2 || matchedPara.urunTipi === 3)) return true;
      const matchedKur = kurSatirlar.find((x) => (paraId && Number(x.paraId) === Number(paraId)) || (x.kod && x.kod.toUpperCase().trim() === upperKod));
      if (matchedKur && (matchedKur.urunTipi === 1 || matchedKur.urunTipi === 2 || matchedKur.urunTipi === 3)) return true;
      const matchedUrun = urunList.find((x) => (paraId && Number(x.id) === Number(paraId)) || (x.kod && x.kod.toUpperCase().trim() === upperKod));
      if (matchedUrun && (matchedUrun.urunTipi === 1 || matchedUrun.urunTipi === 2 || matchedUrun.urunTipi === 3)) return true;
      return (
        ["HAS", "GA", "ATA", "CEYREK", "YARIM", "TAM", "GREMSE", "ZIYNET", "22", "14", "18", "24", "22AYAR", "14AYAR", "18AYAR", "24AYAR"].includes(upperKod) ||
        upperKod.includes("ALTIN") || upperKod.includes("GUMUS") || upperKod.endsWith("AYAR") ||
        upperAd.includes("ALTIN") || upperAd.includes("AYAR") || upperAd.includes("ZIYNET") || upperAd.includes("BİLEZİK") || upperAd.includes("BILEZIK") || upperAd.includes("ÇEYREK") || upperAd.includes("CEYREK") || upperAd.includes("YARIM") || upperAd.includes("ATA") || upperAd.includes("HAS") || upperAd.includes("GÜMÜŞ") || upperAd.includes("GUMUS")
      );
    };

    const isTlItem = (kod?: string) => {
      const upper = (kod || "").toUpperCase().trim();
      return upper === "TL" || upper === "TRY" || upper === "TRL" || upper === "POS" || upper === "HAVALE" || upper === "";
    };

    const rawItems: {
      paraId?: number | null;
      kod: string;
      ad: string;
      uTipi?: number;
      miktar: number;
      kur: number;
      tutar: number;
      hasGram: number;
      isOdeme: boolean;
    }[] = [];

    lines.forEach((l) => {
      const kod = (l.urunKodu || (l as any).paraKodu || "").trim().toUpperCase();
      const ad = (l.urunAdi || (l as any).paraAdi || "").trim();
      const m = parseDecimal(l.miktar);
      const a = parseDecimal(l.adet);
      const h = parseDecimal(l.hasGram);
      const k = parseDecimal(l.kur);
      const t = parseDecimal(l.tutar);
      const qty = m > 0 ? m : (h > 0 ? h : a);
      if (kod !== "" || ad !== "" || (l.urunId && l.urunId > 0) || qty > 0 || t > 0) {
        rawItems.push({
          paraId: (l as any).paraId || l.urunId,
          kod,
          ad,
          uTipi: l.urunTipi,
          miktar: qty,
          kur: k,
          tutar: t > 0 ? t : (qty * (k > 0 ? k : 1)),
          hasGram: h,
          isOdeme: false,
        });
      }
    });

    odemeRows.forEach((o) => {
      const kod = (o.paraKodu || "").trim().toUpperCase();
      const ad = (o.paraAdi || "").trim();
      const m = parseDecimal(o.miktar);
      const a = parseDecimal(o.adet);
      const h = parseDecimal(o.hasGram);
      const k = parseDecimal(o.kur);
      const t = parseDecimal(o.tutar);
      const qty = m > 0 ? m : (h > 0 ? h : a);
      if ((kod !== "" || ad !== "" || (o.paraId && o.paraId > 0)) && (qty > 0 || t > 0)) {
        rawItems.push({
          paraId: o.paraId,
          kod,
          ad,
          uTipi: o.urunTipi,
          miktar: qty,
          kur: k,
          tutar: t > 0 ? t : (qty * (k > 0 ? k : 1)),
          hasGram: h,
          isOdeme: true,
        });
      }
    });

    if (rawItems.length === 0) {
      if (Math.abs(totalTutar) >= tlLimit) {
        return {
          isExceeded: true,
          type: "tl" as const,
          limitLabel: `TL Vergi Sınırını (${tlLimit.toLocaleString("tr-TR")} ₺)`,
          limitTitle: "MASAK TL Bildirim Sınırı Uyarısı",
        };
      }
      return fallback;
    }

    let totalDovizEquivalent = 0;
    let hasDovizLimitDirect = false;
    let hasDoviz = false;

    let totalGoldTl = 0;
    let totalGoldGram = 0;
    let hasGold = false;

    let totalTlAmount = 0;

    rawItems.forEach((item) => {
      const m = item.miktar;
      const k = item.kur;
      const t = item.tutar;
      const kod = item.kod;
      const ad = item.ad;
      const paraId = item.paraId;
      const uTipi = item.uTipi;

      if (isGoldItem(paraId, kod, ad, uTipi)) {
        hasGold = true;
        const lineTl = t > 0 ? t : m * (k > 0 ? k : (activeAltinParaRate > 0 ? activeAltinParaRate : 3000));
        totalGoldTl += lineTl;
        totalGoldGram += m;
      } else if (!isTlItem(kod)) {
        // Döviz satırı (USD, EUR, GBP, vb.)
        hasDoviz = true;
        const isTargetLimitCurrency =
          kod === limitParaKodu ||
          (dovizParaId && Number(paraId) === Number(dovizParaId)) ||
          (limitParaKodu === "USD" && (kod === "$" || kod === "USD" || kod.includes("DOLAR") || ad.toUpperCase().includes("DOLAR"))) ||
          (limitParaKodu === "EUR" && (kod === "€" || kod === "EUR" || kod.includes("EURO") || ad.toUpperCase().includes("EURO")));

        if (isTargetLimitCurrency) {
          totalDovizEquivalent += m;
          if (m >= dovizLimit) hasDovizLimitDirect = true;
        } else {
          const lineTl = t > 0 ? t : m * (k > 0 ? k : 1);
          const activeRate = activeLimitParaRate > 0 ? activeLimitParaRate : usdRate;
          const eq = activeRate > 0 ? lineTl / activeRate : m;
          totalDovizEquivalent += eq;
          if (eq >= dovizLimit) hasDovizLimitDirect = true;
        }
      } else {
        // TL satırı veya ödemesi
        const lineTl = t > 0 ? t : m;
        totalTlAmount += lineTl;
      }
    });

    // 1) Altın kontrolü:
    // Firma Tanımları Limit sekmesindeki Altın Vergi Sınırı (örn. 5.000) ve Altın Sınır Para (örn. USD, 22 Ayar vb.) baz alınır.
    // Altın Sınır Para ne seçilmişse o para biriminin kuruna göre sınır hesaplanır (Miktar * Kur).
    const altinLimitInTl = altinLimit * (activeAltinParaRate > 0 ? activeAltinParaRate : 1);
    const altinValInPara = activeAltinParaRate > 0 ? totalGoldTl / activeAltinParaRate : totalGoldTl;
    const isAltinExceeded = hasGold && (totalGoldTl >= altinLimitInTl || altinValInPara >= altinLimit);

    // 2) Döviz kontrolü:
    const isDovizExceeded = hasDoviz && (hasDovizLimitDirect || totalDovizEquivalent >= dovizLimit);

    // 3) TL kontrolü: Saf TL işlemi (altın ve döviz harici saf TL tutarı) TL Vergi Sınırını aştığında tetiklenir
    // Altın veya döviz içeren işlemlerde genel fiş tutarı TL sınırına sokulmaz!
    const isPureTl = !hasGold && !hasDoviz;
    const isTlExceeded = (isPureTl ? Math.abs(totalTutar) >= tlLimit : false) || totalTlAmount >= tlLimit;

    if (isAltinExceeded) {
      return {
        isExceeded: true,
        type: "altin" as const,
        limitLabel: `Altın Vergi Sınırını (${altinLimit.toLocaleString("tr-TR")} ${altinParaKodu})`,
        limitTitle: "MASAK Altın Bildirim Sınırı Uyarısı",
      };
    }
    if (isDovizExceeded) {
      return {
        isExceeded: true,
        type: "doviz" as const,
        limitLabel: `Döviz Vergi Sınırını (${dovizLimit.toLocaleString("tr-TR")} ${limitParaKodu})`,
        limitTitle: "MASAK Döviz Bildirim Sınırı Uyarısı",
      };
    }
    if (isTlExceeded) {
      return {
        isExceeded: true,
        type: "tl" as const,
        limitLabel: `TL Vergi Sınırını (${tlLimit.toLocaleString("tr-TR")} ₺)`,
        limitTitle: "MASAK TL Bildirim Sınırı Uyarısı",
      };
    }

    return fallback;
  }, [
    isMasakKontroluVar,
    companyDefinitions,
    selectedStatistic,
    statisticList,
    istatistikId,
    istatistikKodu,
    istatistikFisDizaynTipi,
    lines,
    odemeRows,
    altinHasKuru,
    kurSatirlar,
    urunList,
    tip,
    totalTutar,
    paraList,
  ]);

  const isMasakLimitExceeded = masakStatus.isExceeded;
  const masakLimitLabel = masakStatus.limitLabel;
  const masakLimitTitle = masakStatus.limitTitle;

  const hasCariInOdeme = useMemo(() => {
    return odemeRows.some((r) => r.odemeAraciTuru === 1 || Boolean(r.cariKartId));
  }, [odemeRows]);

  const currencyOptions = useMemo(() => {
    const result: { kod: string; ad: string; paraId: number }[] = [];
    result.push({ kod: "TL", ad: "TÜRK LİRASI", paraId: 1 });
    (urunList || []).forEach((u) => {
      const k = (u.kod || "").trim().toUpperCase();
      if (!k || k === "TL" || k === "TRY") return;
      if (
        u.urunTipi === 0 ||
        k === "USD" ||
        k === "EUR" ||
        k === "HAS" ||
        k === "CHF" ||
        k === "GBP" ||
        (u.ad || "").toUpperCase().includes("LİRA") ||
        (u.ad || "").toUpperCase().includes("DOLAR") ||
        (u.ad || "").toUpperCase().includes("EURO") ||
        (u.ad || "").toUpperCase().includes("ALTIN")
      ) {
        if (!result.some((r) => r.kod === k)) {
          result.push({ kod: k, ad: u.ad || k, paraId: u.paraId || u.id });
        }
      }
    });
    return result;
  }, [urunList]);

  // Varsayılan İstatistik Belirleme Fonksiyonu (1. Kullanıcı Tanımları [Öncelikli], 2. Firma Tanımları, 3. İlk Kayıt)
  const getDefaultStatistic = useCallback(
    (tipValue: 0 | 1, customList?: StatisticItem[], customDefs?: any): StatisticItem | undefined => {
      const list = customList || statisticList;
      const defs = customDefs !== undefined ? customDefs : companyDefinitions;
      if (!list || list.length === 0) return undefined;

      // 1. Kullanıcı Tanımları Kontrolü (Öncelikli)
      const userStatCode = tipValue === 0 ? user?.buyStatCode : user?.sellStatCode;
      if (userStatCode && userStatCode.trim()) {
        const cleanUserCode = userStatCode.trim().toLowerCase();
        const foundUser = list.find(
          (s) =>
            (s.kod && s.kod.toLowerCase() === cleanUserCode) ||
            String(s.id) === cleanUserCode
        );
        if (foundUser) return foundUser;
        return {
          id: null as any,
          kod: userStatCode.trim(),
          aciklama: userStatCode.trim(),
          fisTipi: tipValue,
          fisDizaynTipi: 0,
        } as StatisticItem;
      }

      // 2. Firma Tanımları Kontrolü (Kullanıcıda yoksa)
      if (defs) {
        const companyStatId =
          tipValue === 0 ? defs.ALIS_ISTATISTIK_ID : defs.SATIS_ISTATISTIK_ID;
        if (companyStatId) {
          const cleanCompanyId = String(companyStatId).trim().toLowerCase();
          const foundCompany = list.find(
            (s) =>
              String(s.id).trim() === cleanCompanyId ||
              (s.kod && s.kod.trim().toLowerCase() === cleanCompanyId)
          );
          if (foundCompany) return foundCompany;
        }
      }

      // 3. Fiş tipine uygun ilk kayıt
      const foundFirst =
        list.find((s) => {
          const fType = Number(s.fisTipi);
          if (tipValue === 0) {
            return fType === 0 || fType === 2;
          } else {
            return fType === 1 || fType === 2;
          }
        }) || list[0];

      return foundFirst;
    },
    [statisticList, user?.buyStatCode, user?.sellStatCode, companyDefinitions]
  );

  const handleSelectIstatistik = (item: IstatistikSecimItem) => {
    lastModalCallerRef.current = null;
    setIstatistikId(item.id);
    setIstatistikKodu(item.kod);
    setSelectedStatistic(item as any);
    const dizaynTipi = item.fisDizaynTipi !== undefined && item.fisDizaynTipi !== null
      ? Number(item.fisDizaynTipi)
      : ((item as any).FIS_DIZAYN_TIPI !== undefined && (item as any).FIS_DIZAYN_TIPI !== null ? Number((item as any).FIS_DIZAYN_TIPI) : 0);
    setIstatistikFisDizaynTipi(dizaynTipi);
    if (dizaynTipi !== 1) {
      if (!istisnaKodu || !istisnaKodu.trim()) {
        setIstisnaKodu(lastActiveIstisnaKoduRef.current || ALTIN_KODU);
      }
    }
    setStatisticList((prev) => {
      const idx = prev.findIndex((s) => s.id === item.id || s.kod === item.kod);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...item, fisDizaynTipi: dizaynTipi };
        return copy;
      }
      return [...prev, item as any];
    });
    lastFocusedIstatistikKodRef.current = item.kod;
    setShowIstatistikModal(false);
    setTimeout(() => {
      hasKuruRef.current?.focus();
      hasKuruRef.current?.select();
    }, 50);
  };

  const findMatchingCustomers = (
    field: "kod" | "unvan" | "vkn",
    query: string
  ): { cariler: CariKartItem[]; kayitsizlar: KayitsizMusteriItem[]; totalCount: number } => {
    const q = query.toLowerCase().trim();
    if (!q) return { cariler: [], kayitsizlar: [], totalCount: 0 };

    const matchedCariler = cariList.filter((c) => {
      if (field === "kod") {
        return (c.kod || "").toLowerCase().includes(q);
      } else if (field === "unvan") {
        return (c.ad || (c as any).unvan || "").toLowerCase().includes(q);
      } else if (field === "vkn") {
        return (c.vergiKimlikNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, "")) ||
          ((c as any).pasaportNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, ""));
      }
      return false;
    });

    const matchedKayitsizlar = kayitsizMusteriList.filter((k) => {
      if (field === "kod") {
        return false;
      } else if (field === "unvan") {
        return (k.ad || k.unvan || "").toLowerCase().includes(q);
      } else if (field === "vkn") {
        return (k.vergiKimlikNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, "")) ||
          ((k as any).pasaportNo || "").replace(/\s+/g, "").toLowerCase().includes(q.replace(/\s+/g, ""));
      }
      return false;
    });

    return {
      cariler: matchedCariler,
      kayitsizlar: matchedKayitsizlar,
      totalCount: matchedCariler.length + matchedKayitsizlar.length,
    };
  };

  const handleSearchMasak = async (explicitName?: string, explicitId?: string) => {
    const rawName = explicitName !== undefined ? explicitName : unvan;
    const rawId = explicitId !== undefined ? explicitId : detayVergiKimlikNo;

    const isAnon = !rawName || !rawName.trim() ||
      rawName.trim().toUpperCase() === "İSİM BEYAN EDİLMEMİŞTİR" ||
      rawName.trim().toUpperCase() === "ISIM BEYAN EDILMEMISTIR";

    const cleanName = isAnon ? "" : rawName.trim();
    const cleanId = (rawId || "").trim();

    if (!cleanName && !cleanId) {
      showNotif("warning", "MASAK sorgusu yapabilmek için lütfen Müşteri Adı / Ünvan veya T.C. Kimlik / VKN giriniz.");
      return;
    }

    try {
      setIsSearchingMasak(true);
      const res = await MasakService.sorgula({
        ad: cleanName || undefined,
        kimlikNo: cleanId || undefined,
        limit: 30,
      });

      const matches = res?.kayitlar || [];
      setMasakResult({
        queriedName: cleanName || cleanId,
        queriedId: cleanId,
        matches,
        searched: true,
      });

      if (matches.length > 0) {
        setMasakModalOpen(true);
        showNotif("danger", `🚨 DİKKAT: "${cleanName || cleanId}" için MASAK listelerinde ${matches.length} eşleşme bulundu!`);
      } else {
        setMasakModalOpen(false);
      }
    } catch (err: any) {
      showNotif("danger", `MASAK sorgusu yapılamadı: ${err?.message || "Sunucu bağlantı hatası"}`);
    } finally {
      setIsSearchingMasak(false);
    }
  };



  // Sayfa ilk açılınca otomatik inputa / işleme odaklan
  useEffect(() => {
    const timer = setTimeout(() => {
      islemRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const initialLoadDoneRef = useRef(false);

  // Load by ID
  const loadFisById = useCallback(async (id: number) => {
    try {
      const data = await SarrafFisService.getFisById(id);
      if (!data) return;
      setFisId(data.sarrafFisiId);
      // e-Banka hareketine eşli fiş (M32): listeden açılsa da e-Banka'dan Düzenle ile açılmış gibi toplam banka tutarında
      const ebBagi = (data as any).ebanka && Number((data as any).ebanka.vomsisId) > 0 ? (data as any).ebanka : null;
      setEbBag(ebBagi ? { ...ebBagi, fisId: data.sarrafFisiId } : null);
      const rawFisNo = ((data as any).fisNo || "").trim();
      const rawSeriNo = ((data as any).seriNo || "").trim();
      const rawBelgeNo = ((data as any).belgeNo || (data as any).irsaliyeNo || "").trim();
      setSeriNo(rawSeriNo || rawFisNo);
      setFisNo(rawBelgeNo !== rawFisNo ? rawBelgeNo : "");
      setTarih(data.tarih || new Date().toISOString().split("T")[0]);
      if (data.saat) setSaat(new Date(data.saat).toTimeString().slice(0, 5));
      const loadedTip = (data.tip as 0 | 1) || 0;
      setTip(loadedTip);
      prevTipRef.current = loadedTip;
      setBelgeTuru(data.belgeTuru || 0);
      setUnvan(data.unvan || DEFAULT_CUSTOMER_NAME);
      setCariKartId(data.cariKartId || null);
      const directCariKod = (data.cariKodu || (data as any).cariKod || "").trim();
      if (directCariKod) {
        setCariKod(directCariKod);
      } else if (data.cariKartId && cariList.length > 0) {
        const matchedCari = cariList.find((c) => c.id === data.cariKartId);
        setCariKod(matchedCari?.kod || "");
      } else if (data.cariKartId) {
        CariService.getCariKartById(data.cariKartId)
          .then((c) => {
            if (c?.kod) setCariKod(c.kod.trim());
          })
          .catch(() => {});
      } else {
        setCariKod("");
      }

      if (data.istatistikId !== undefined && data.istatistikId !== null) {
        setIstatistikId(data.istatistikId);
        const st = (statisticList || []).find((s) => s.id === data.istatistikId || s.kod === data.istatistikKodu);
        const statKod = data.istatistikKodu || st?.kod || "";
        setIstatistikKodu(statKod);
        if (st) {
          setSelectedStatistic(st);
          const dizayn = st.fisDizaynTipi !== undefined && st.fisDizaynTipi !== null ? Number(st.fisDizaynTipi) : 0;
          setIstatistikFisDizaynTipi(dizayn);
        }
        lastFocusedIstatistikKodRef.current = statKod;
      } else if (data.istatistikKodu) {
        setIstatistikKodu(data.istatistikKodu);
        lastFocusedIstatistikKodRef.current = data.istatistikKodu;
        const st = (statisticList || []).find((s) => s.kod === data.istatistikKodu);
        if (st) {
          setIstatistikId(st.id);
          setSelectedStatistic(st);
          const dizayn = st.fisDizaynTipi !== undefined && st.fisDizaynTipi !== null ? Number(st.fisDizaynTipi) : 0;
          setIstatistikFisDizaynTipi(dizayn);
        }
      } else {
        const defStat = getDefaultStatistic(Number(data.tip) === 1 ? 1 : 0);
        if (defStat) {
          setIstatistikId(defStat.id);
          setIstatistikKodu(defStat.kod);
          setSelectedStatistic(defStat);
          const dizayn = defStat.fisDizaynTipi !== undefined && defStat.fisDizaynTipi !== null ? Number(defStat.fisDizaynTipi) : 0;
          setIstatistikFisDizaynTipi(dizayn);
          lastFocusedIstatistikKodRef.current = defStat.kod;
        }
      }
      setAltinHasKuru(data.altinHasKuru || "");
      setAlisKuru(data.alisKuru || "");
      setSatisKuru(data.satisKuru || "");
      setGumusHasKuru(data.gumusHasKuru || "");
      setKdvOrani(data.kdvOrani !== null && data.kdvOrani !== undefined ? data.kdvOrani : "");
      setIstisnaKodu(data.istisnaKodu || ALTIN_KODU);
      if (data.vezneId) {
        setVezneId(data.vezneId);
        const vz = vezneList.find((v) => v.id === data.vezneId);
        if (vz) { setVezneKod(vz.kod); setVezneAd(vz.ad); }
        const bak = await SarrafFisService.getVezneBakiye(data.vezneId).catch(() => []);
        setBakiyeler(bak);
      }
      setDetayUnvan(data.unvan || DEFAULT_CUSTOMER_NAME);
      setDetayKisilikTipi((data as any).kisilikTipi || 0);
      setMasakResult({ matches: [], searched: false });
      setMasakModalOpen(false);
      setDetayVergiKimlikNo((data as any).vergiKimlikNo || "");
      setDetayBabaAdi((data as any).babaAdi || "");
      setDetayAnneAdi((data as any).anneAdi || "");
      setDetayAdres((data as any).adres || "");
      setDetayEposta((data as any).eposta || "");
      setDetayTelefonNo((data as any).telefonNo || "");
      setDetayDogumTarihi((data as any).dogumTarihi || "");
      setDetayDogumYeri((data as any).dogumYeri || "");
      setDetayKimlikSeriNo((data as any).kimlikSeriNo || "");
      setDetayPasaportNo((data as any).pasaportNo || "");
      setDetayKimlikBelgeTuru((data as any).kimlikBelgeTuru || 0);
      setDetayKimlikGecerlilikTarihi((data as any).kimlikGecerlilikTarihi || "");
      setDetayVekilAdi((data as any).vekilAdi || "");
      setDetayVekilKimlikNo((data as any).vekilKimlikNo || "");

      if (data.satirlar && data.satirlar.length > 0) {
        const curHasKuru = Number(data.altinHasKuru) || 0;
        const mapped = data.satirlar.map((s: any) => {
          const matchedUrun = (s.urunId || s.urunKodu) && urunList.length > 0
            ? urunList.find((u) => (s.urunId && u.paraId === s.urunId) || (u.kod && s.urunKodu && u.kod.trim().toLowerCase() === s.urunKodu.trim().toLowerCase()))
            : null;
          let itemMilyem = (s.milyem !== undefined && s.milyem !== null && s.milyem !== "") ? s.milyem : "";
          if ((itemMilyem === "" || Number(itemMilyem) === 0) && matchedUrun && matchedUrun.hasOrani !== undefined && matchedUrun.hasOrani !== null) {
            itemMilyem = matchedUrun.hasOrani;
          }
          const rowObj: GridRow = {
            id: `row-${s.sarrafFisiSatiriId || makeId()}`,
            satirId: s.sarrafFisiSatiriId,
            satirNo: s.satirNo,
            urunId: s.urunId || 0,
            urunKodu: s.urunKodu || "",
            urunAdi: s.urunAdi || "",
            adet: s.adet != null && s.adet !== "" ? formatMiktar(s.adet) : "",
            miktar: s.miktar != null && s.miktar !== "" ? formatMiktar(s.miktar) : "",
            milyem: itemMilyem,
            refMilyem: itemMilyem,
            hasGram: s.hasGram != null ? s.hasGram : "",
            iscilikHesaplamaSekli: s.iscilikHesaplamaSekli || 0,
            iscilikiMiktari: s.iscilikiMiktari != null && s.iscilikiMiktari !== "" ? s.iscilikiMiktari : "",
            iscilikHasGram: s.iscilikHasGram != null ? s.iscilikHasGram : "",
            iscilikTutari: s.iscilikTutari != null ? s.iscilikTutari : "",
            iscilikKdvOrani: s.iscilikKdvOrani != null ? s.iscilikKdvOrani : (s.kdvOrani != null ? s.kdvOrani : ""),
            iscilikKdvTutari: s.iscilikKdvTutari != null ? s.iscilikKdvTutari : (s.kdvTutari != null ? s.kdvTutari : ""),
            kur: s.kur != null ? s.kur : "",
            tutar: s.tutar != null ? s.tutar : "",
            urunTipi: matchedUrun?.urunTipi !== undefined && matchedUrun?.urunTipi !== null ? Number(matchedUrun.urunTipi) : (s.urunTipi || 0),
            karat: s.karat || "",
            aciklama: s.aciklama || "",
          };
          const hesap = recomputeRow(rowObj, curHasKuru, undefined, userIscilikGirisSekli, isKdvDisabledRef.current);
          // e-Banka'dan "Düzenle" ile ya da listeden açılan e-Banka fişi: satır kayıttaki toplamla açılır, işçilik yazılınca gram
          // dengelenir (M14, M30, M32). e-Banka fişinde işçilik KDV'si istatistikten bağımsız açık (M19).
          return (ebDuzenlemeRef.current && String(data.sarrafFisiId ?? "") === ebDuzenlemeRef.current) || ebBagi
            ? ebDuzenlemeSabitle(rowObj, hesap, Number(data.kdvOrani) || 0, false)
            : hesap;
        });
        setLines(mapped.length > 0 ? mapped : [createEmptyRow(1)]);
      } else {
        setLines([createEmptyRow(1)]);
      }

      if (data.odemeSatirlari && data.odemeSatirlari.length > 0) {
        const curHasKuru = Number(data.altinHasKuru) || 0;
        const mappedOdeme = data.odemeSatirlari.map((o: any) => {
          let oMilyem = (o.milyem !== undefined && o.milyem !== null && o.milyem !== "") ? o.milyem : "";
          if ((oMilyem === "" || Number(oMilyem) === 0) && (o.paraId || o.paraKodu) && urunList.length > 0) {
            const matchedUrun = urunList.find((u) => (o.paraId && u.paraId === o.paraId) || (u.kod && o.paraKodu && u.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
            if (matchedUrun && matchedUrun.hasOrani !== undefined && matchedUrun.hasOrani !== null) {
              oMilyem = matchedUrun.hasOrani;
            }
          }
          const matchedUrun = urunList.find((u) => (o.paraId && u.paraId === o.paraId) || (u.kod && o.paraKodu && u.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
          const matchedIskonto = iskontoList.find((isk) => (o.iskontoId && isk.iskontoId === o.iskontoId) || (isk.kod && o.paraKodu && isk.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
          let calcAdet: number | string = o.adet != null && o.adet !== "" ? o.adet : "";
          const oMikNum = parseDecimal(o.miktar);
          if (!calcAdet && matchedUrun && Number(matchedUrun.gramaj) > 0 && oMikNum > 0) {
            calcAdet = Math.round(oMikNum / Number(matchedUrun.gramaj));
          } else if (!calcAdet && matchedUrun && matchedUrun.birim === 0 && oMikNum > 0) {
            calcAdet = oMikNum;
          }

          let cKod = (o.cariKod || "").trim();
          let cUnv = (o.cariUnvan || "").trim();

          const oat = o.odemeAraciTuru !== undefined && o.odemeAraciTuru !== null
            ? Number(o.odemeAraciTuru)
            : (o.cariKartId ? 1 : 0);

          if (oat === 1) {
            if (o.cariKartId && (!cKod || !cUnv) && cariList.length > 0) {
              const cMatch = cariList.find((c) => c.id === o.cariKartId);
              if (cMatch) {
                if (!cKod) cKod = cMatch.kod || "";
                if (!cUnv) cUnv = cMatch.ad || "";
              }
            }
          } else if (oat === 2) {
            const pId = o.posCihaziId || o.bankaId || o.cariKartId;
            if (pId && (!cKod || !cUnv) && posList.length > 0) {
              const pMatch = posList.find((p) => p.posCihaziId === pId || p.kod === cKod);
              if (pMatch) {
                if (!cKod) cKod = pMatch.kod || "";
                if (!cUnv) cUnv = pMatch.ad || "";
              }
            }
          } else if (oat === 3) {
            const bId = o.bankaId || o.cariKartId || o.posCihaziId;
            if (bId && (!cKod || !cUnv) && bankaList.length > 0) {
              const bMatch = bankaList.find((b) => b.bankaId === bId || b.hesapNo === cKod);
              if (bMatch) {
                if (!cKod) cKod = bMatch.hesapNo || "";
                if (!cUnv) cUnv = bMatch.hesapAdi ? `${bMatch.bankaAdi ? bMatch.bankaAdi + " - " : ""}${bMatch.hesapAdi}` : (bMatch.bankaAdi || "");
              }
            }
          }

          let resolvedParaKodu = (o.paraKodu || "").trim();
          let resolvedParaAdi = (o.paraAdi || "").trim();
          if (!resolvedParaKodu) {
            if (matchedIskonto) {
              resolvedParaKodu = (matchedIskonto.kod || `ISK-${matchedIskonto.iskontoId}`).toUpperCase().trim();
              resolvedParaAdi = matchedIskonto.tanim;
            } else if (matchedUrun) {
              resolvedParaKodu = matchedUrun.kod;
              resolvedParaAdi = matchedUrun.ad;
            } else if (oat === 2 || oat === 3 || oat === 0) {
              resolvedParaKodu = "TL";
              resolvedParaAdi = "TÜRK LİRASI";
            }
          }

          const oRow: OdemeRow = {
            id: makeId(),
            satirNo: o.satirNo,
            odemeAraciTuru: oat,
            cariKartId: o.cariKartId || null,
            cariKod: cKod,
            cariUnvan: cUnv,
            // Hesap satırında Kod'un yanındaki Açıklama banka hesabını gösterir (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M16)
            // e-Banka'dan Düzenle ile ya da listeden açılan e-Banka fişinde hareketin hesabındaki satır: kilitli, banka ve hesap no (M20, M32)
            ...((): Partial<OdemeRow> => {
              const eb = ebankaFisi && ebBankaRef.current.bankaId
                ? ebBankaRef.current
                : ebBagi && Number(ebBagi.bankaId) > 0 ? { bankaId: Number(ebBagi.bankaId), aciklama: ebankaHareketHesabi(ebBagi) } : null;
              if (oat === 3 && eb && Number(o.bankaId || o.cariKartId) === eb.bankaId) {
                const kart = bankaList.find((x) => x.bankaId === eb.bankaId);
                // Kart listesi henüz gelmediyse kartın adı fişle gelen adtan (M30); kod yalnız ad hiç yoksa
                return { ebBanka: true, ebKartAdi: (kart?.hesapAdi || "").trim() || cUnv || kart?.hesapNo || cKod, aciklama: eb.aciklama || cUnv };
              }
              return oat === 3 && cUnv ? { aciklama: cUnv } : {};
            })(),
            bankaId: o.bankaId || (oat === 3 ? o.cariKartId : null),
            posCihaziId: o.posCihaziId || (oat === 2 ? o.cariKartId : null),
            iskontoId: o.iskontoId || matchedIskonto?.iskontoId || null,
            paraId: o.paraId ?? null,
            paraKodu: resolvedParaKodu,
            paraAdi: resolvedParaAdi || matchedUrun?.ad || (resolvedParaKodu === "TL" ? "TÜRK LİRASI" : ""),
            adet: calcAdet != null && calcAdet !== "" ? formatMiktar(calcAdet) : "",
            miktar: o.miktar != null && o.miktar !== "" ? formatMiktar(o.miktar) : "",
            milyem: oMilyem,
            refMilyem: oMilyem,
            hasGram: o.hasGram != null ? o.hasGram : "",
            kur: o.kur != null ? o.kur : 1,
            tutar: o.tutar != null ? o.tutar : "",
            urunTipi: o.urunTipi || matchedUrun?.urunTipi || 0,
          };
          return recomputeOdemeRow(oRow, curHasKuru);
        });
        setOdemeRows(mappedOdeme.length > 0 ? mappedOdeme : [createEmptyOdemeRow(1)]);
      } else {
        setOdemeRows([createEmptyOdemeRow(1)]);
      }
    } catch (e) {
      showNotif("danger", "Fiş yüklenemedi");
    }
  }, [vezneList, cariList, urunList, bankaList, posList]);

  // Cari listesi yüklendiğinde veya cariKartId varken cariKod henüz boşsa otomatik doldur
  useEffect(() => {
    if (cariKartId && !cariKod) {
      if (cariList.length > 0) {
        const matched = cariList.find((c) => c.id === cariKartId);
        if (matched?.kod) {
          setCariKod(matched.kod.trim());
          return;
        }
      }
      CariService.getCariKartById(cariKartId)
        .then((c) => {
          if (c?.kod) setCariKod(c.kod.trim());
        })
        .catch(() => {});
    }
  }, [cariList, cariKartId, cariKod]);

  // Reset form (keeps cashier's vezne intact, clears all inputs)
  const resetForm = useCallback(() => {
    setFisId(null);
    setFisNo("");
    setSeriNo("");
    setCariKod("");
    setTarih(new Date().toISOString().split("T")[0]);
    const d = new Date();
    setSaat(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setTip(1);
    setBelgeTuru(0);
    setUnvan(DEFAULT_CUSTOMER_NAME);
    setCariKartId(null);

    // Varsayılan HAS Altın ve Gümüş kurları
    let defaultHas: number | string = "";
    let defaultGumus: number | string = "";
    if (kurSatirlar.length > 0) {
      const hasKurItem = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
      if (hasKurItem) {
        defaultHas = (tip === 0
          ? (hasKurItem.efektifAlis ?? hasKurItem.dovizAlis ?? hasKurItem.efektifSatis ?? hasKurItem.dovizSatis)
          : (hasKurItem.efektifSatis ?? hasKurItem.dovizSatis ?? hasKurItem.efektifAlis ?? hasKurItem.dovizAlis)) || "";
      }
      const gumusKurItem = kurSatirlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ"].includes((k.kod || "").toUpperCase().trim()));
      if (gumusKurItem) {
        defaultGumus = (tip === 0
          ? (gumusKurItem.efektifAlis ?? gumusKurItem.dovizAlis ?? gumusKurItem.efektifSatis ?? gumusKurItem.dovizSatis)
          : (gumusKurItem.efektifSatis ?? gumusKurItem.dovizSatis ?? gumusKurItem.efektifAlis ?? gumusKurItem.dovizAlis)) || "";
      }
    }
    setAltinHasKuru(defaultHas);
    setAlisKuru("");
    setSatisKuru("");
    setGumusHasKuru(defaultGumus);
    setKdvOrani("");
    setIstisnaKodu(ALTIN_KODU);
    setDetayUnvan(DEFAULT_CUSTOMER_NAME);
    setDetayKisilikTipi(0);
    setDetayVergiKimlikNo("");
    setDetayBabaAdi("");
    setDetayAnneAdi("");
    setDetayAdres("");
    setDetayEposta("");
    setDetayTelefonNo("");
    setDetayDogumTarihi("");
    setDetayDogumYeri("");
    setDetayKimlikSeriNo("");
    setDetayPasaportNo("");
    setDetayKimlikBelgeTuru(0);
    setDetayKimlikGecerlilikTarihi("");
    setDetayVekilAdi("");
    setDetayVekilKimlikNo("");
    const defStat = getDefaultStatistic(0);
    setIstatistikId(defStat ? defStat.id : null);
    setIstatistikKodu(defStat ? defStat.kod : "");
    setSelectedStatistic(defStat || null);
    const dizayn = defStat && defStat.fisDizaynTipi !== undefined && defStat.fisDizaynTipi !== null ? Number(defStat.fisDizaynTipi) : null;
    setIstatistikFisDizaynTipi(dizayn);
    setLines([createEmptyRow(1)]);
    setActiveRowIndex(0);
    setOdemeRows([createEmptyOdemeRow(1)]);
    setActiveOdemeRowIndex(0);
  }, [getDefaultStatistic, kurSatirlar]);

  const handleNew = useCallback(() => {
    if (location.search) {
      navigate(location.pathname, { replace: true });
    }
    resetForm();
  }, [location.search, location.pathname, navigate, resetForm]);

  // Load lookups & user's default vezne & load initial record on first load (Instant Load with FastLookupCache)
  const loadLookupsAndData = useCallback(async () => {
    try {
      const userVezneIdPromise = user?.id
        ? SarrafFisService.getUserVezneId(Number(user.id)).catch(() => null)
        : Promise.resolve(null);

      const fisListPromise = isDuzeltmeMode
        ? SarrafFisService.getFisList({ limit: 500 }).catch(() => [])
        : Promise.resolve([]);

      const [
        vezneler,
        urunler,
        fisler,
        cariler,
        kayitsizlar,
        stats,
        compDefs,
        anlikKurRes,
        gunlukKurRes,
        numerators,
        bankalar,
        poslar,
        iskontolar,
        userVezneId,
      ] = await Promise.all([
        CashDeskService.getVezneler().catch((): VezneItem[] => []),
        SarrafFisService.getUrunler().catch(() => []),
        fisListPromise,
        CariService.getCariKartlar().catch(() => [] as CariKartItem[]),
        DovizFisService.getKayitsizMusteriler().catch(() => []),
        StatisticService.getStatistics().catch(() => [] as StatisticItem[]),
        CompanyService.getDefinitions(true).catch(() => null),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        KurService.getKurTablosu({ tur: 1 }).catch(() => null),
        NumeratorService.getNumerators().catch(() => [] as NumeratorItem[]),
        BankaService.getBankalar({ aktif: true }).catch(() => [] as BankaHesapItem[]),
        PosCihaziService.getPosCihazlari().catch(() => [] as PosCihaziItem[]),
        IskontoService.getIskontolar({ aktif: true }).catch(() => [] as IskontoItem[]),
        userVezneIdPromise,
      ]);

      setVezneList(vezneler as VezneItem[]);
      setUrunList(urunler);
      const sortedFisler = [...(fisler || [])].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sortedFisler);
      setCariList(cariler as CariKartItem[]);
      setKayitsizMusteriList(kayitsizlar as KayitsizMusteriItem[]);
      setStatisticList(stats as StatisticItem[]);
      if (compDefs) {
        companyDefinitionsRef.current = compDefs;
        setCompanyDefinitions(compDefs);
      }
      setNumeratorList(numerators || []);
      setBankaList((bankalar || []) as BankaHesapItem[]);
      setPosList((poslar || []) as PosCihaziItem[]);
      setIskontoList((iskontolar || []) as IskontoItem[]);

      // If in Kayıt mode, lazily populate search list in background without blocking UI
      if (!isDuzeltmeMode && fisler.length === 0) {
        SarrafFisService.getFisList({ limit: 100 })
          .then((bgFisler) => {
            if (bgFisler && bgFisler.length > 0) {
              setFisList(bgFisler);
            }
          })
          .catch(() => { });
      }

      // Anlık Fiyat Listesi (TUR = 0) kurlarını öncelikli olarak al
      const mergedKurMap = new Map<string, KurRowItem>();
      (gunlukKurRes?.satirlar || []).forEach((k) => {
        const key = k.kod ? k.kod.toUpperCase().trim() : (k.paraId ? `ID_${k.paraId}` : (k.ad ? k.ad.toUpperCase().trim() : ""));
        if (key) mergedKurMap.set(key, k);
      });
      (anlikKurRes?.satirlar || []).forEach((k) => {
        const key = k.kod ? k.kod.toUpperCase().trim() : (k.paraId ? `ID_${k.paraId}` : (k.ad ? k.ad.toUpperCase().trim() : ""));
        if (key) {
          const existing = mergedKurMap.get(key);
          mergedKurMap.set(key, {
            ...existing,
            ...k,
            efektifAlis: (k.efektifAlis !== null && k.efektifAlis !== undefined && Number(k.efektifAlis) > 0) ? k.efektifAlis : (existing?.efektifAlis ?? null),
            efektifSatis: (k.efektifSatis !== null && k.efektifSatis !== undefined && Number(k.efektifSatis) > 0) ? k.efektifSatis : (existing?.efektifSatis ?? null),
            dovizAlis: (k.dovizAlis !== null && k.dovizAlis !== undefined && Number(k.dovizAlis) > 0) ? k.dovizAlis : (existing?.dovizAlis ?? null),
            dovizSatis: (k.dovizSatis !== null && k.dovizSatis !== undefined && Number(k.dovizSatis) > 0) ? k.dovizSatis : (existing?.dovizSatis ?? null),
            parite: k.parite ?? existing?.parite ?? null,
          });
        }
      });
      const allKurList = Array.from(mergedKurMap.values());
      setKurSatirlar(allKurList);

      const hasKurItem = allKurList.find((k) =>
        ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()) ||
        (k.ad && ["HAS ALTIN", "HAS"].includes(k.ad.toUpperCase().trim()))
      );
      const defaultHas = hasKurItem
        ? (tip === 0
          ? (hasKurItem.efektifAlis || hasKurItem.dovizAlis)
          : (hasKurItem.efektifSatis || hasKurItem.dovizSatis)) ||
        (hasKurItem.efektifAlis || hasKurItem.dovizAlis) || ""
        : "";
      const gumusKurItem = allKurList.find((k) =>
        ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()) ||
        (k.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(k.ad.toUpperCase().trim()))
      );
      const defaultGumus = gumusKurItem
        ? (tip === 0
          ? (gumusKurItem.efektifAlis || gumusKurItem.dovizAlis)
          : (gumusKurItem.efektifSatis || gumusKurItem.dovizSatis)) ||
        (gumusKurItem.efektifAlis || gumusKurItem.dovizAlis) || ""
        : "";

      if (!queryId) {
        let uv: VezneItem | undefined;
        if (userVezneId) {
          uv = (vezneler as VezneItem[]).find((v) => v.id === userVezneId);
        }
        if (!uv) {
          uv = getUserVezne(vezneler as VezneItem[], user?.cashierCode);
        }
        if (uv) {
          setVezneId(uv.id); setVezneKod(uv.kod); setVezneAd(uv.ad);
          SarrafFisService.getVezneBakiye(uv.id)
            .then((bak) => setBakiyeler(bak))
            .catch(() => []);
        }

        // Sayfa ilk kez açıldığında varsayılan kurlar ve istatistik yüklensin
        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
          if (isDuzeltmeMode) {
            resetForm();
          } else {
            if (defaultHas) setAltinHasKuru(defaultHas);
            if (defaultGumus) setGumusHasKuru(defaultGumus);
            const defStat = getDefaultStatistic(tip, stats as StatisticItem[], compDefs);
            if (defStat) {
              setIstatistikId(defStat.id);
              setIstatistikKodu(defStat.kod);
              setSelectedStatistic(defStat);
              const dizayn = defStat.fisDizaynTipi !== undefined && defStat.fisDizaynTipi !== null ? Number(defStat.fisDizaynTipi) : 0;
              setIstatistikFisDizaynTipi(dizayn);
              lastFocusedIstatistikKodRef.current = defStat.kod;
            }
          }
        }
      } else {
        if (!initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
          await loadFisById(Number(queryId));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [queryId, user?.id, user?.cashierCode, isDuzeltmeMode, tip, getDefaultStatistic]);

  useEffect(() => {
    loadLookupsAndData();
  }, [loadLookupsAndData]);

  // Sekmeler arası veya pencere odağında güncel firma limit tanımlarını otomatik tazele
  useEffect(() => {
    const refreshCompanyDefs = async () => {
      try {
        const freshDef = await CompanyService.getDefinitions(true);
        if (freshDef) {
          companyDefinitionsRef.current = freshDef;
          setCompanyDefinitions(freshDef);
        }
      } catch { }
    };

    window.addEventListener("company_definitions_updated", refreshCompanyDefs);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "company_definitions_version") {
        refreshCompanyDefs();
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("focus", refreshCompanyDefs);

    return () => {
      window.removeEventListener("company_definitions_updated", refreshCompanyDefs);
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("focus", refreshCompanyDefs);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    initialLoadDoneRef.current = false;
    await loadLookupsAndData();
    if (!isDuzeltmeMode && !queryId) {
      resetForm();
    }
  }, [loadLookupsAndData, isDuzeltmeMode, queryId, resetForm]);

  // Navigation handlers (Düzeltme sayfaları için)
  const handleOpenFisModal = useCallback(async () => {
    try {
      const list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      if (list && list.length > 0) {
        const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
        setFisList(sorted);
      }
    } catch (e) {
      console.error(e);
    }
    setShowFisModal(true);
  }, []);

  const handleFirst = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      setCurrentIndex(0);
      await loadFisById(sorted[0].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, loadFisById]);

  const handlePrev = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      const curIdx = fisId ? sorted.findIndex((f) => Number(f.sarrafFisiId) === Number(fisId)) : currentIndex;
      let nextIdx = (curIdx >= 0 ? curIdx : sorted.length) - 1;
      if (nextIdx < 0) {
        showNotif("info", "İlk kayıttasınız");
        nextIdx = 0;
      }
      setCurrentIndex(nextIdx);
      await loadFisById(sorted[nextIdx].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, fisId, currentIndex, loadFisById]);

  const handleNext = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      const curIdx = fisId ? sorted.findIndex((f) => Number(f.sarrafFisiId) === Number(fisId)) : currentIndex;
      let nextIdx = (curIdx >= 0 ? curIdx : -1) + 1;
      if (nextIdx >= sorted.length) {
        showNotif("info", "Son kayıttasınız");
        nextIdx = sorted.length - 1;
      }
      setCurrentIndex(nextIdx);
      await loadFisById(sorted[nextIdx].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, fisId, currentIndex, loadFisById]);

  const handleLast = useCallback(async () => {
    try {
      let list = fisList;
      if (!list || list.length === 0) {
        list = await SarrafFisService.getFisList({ limit: 500 }).catch(() => []);
      }
      if (!list?.length) {
        showNotif("info", "Kayıtlı fiş bulunamadı");
        return;
      }
      const sorted = [...list].sort((a, b) => (Number(a.sarrafFisiId) || 0) - (Number(b.sarrafFisiId) || 0));
      setFisList(sorted);
      const lastIdx = sorted.length - 1;
      setCurrentIndex(lastIdx);
      await loadFisById(sorted[lastIdx].sarrafFisiId);
    } catch (e) {
      console.error(e);
    }
  }, [fisList, loadFisById]);

  // Ödeme / Tahsilat satırının eksik bırakılıp bırakılmadığını kontrol eder
  const isOdemeRowIncomplete = (r: OdemeRow): boolean => {
    // 1. İskonto satırı ise (fark kapatma veya manuel iskonto)
    const isIskonto = Boolean(
      r.iskontoId ||
      (r.paraKodu && (r.paraKodu.trim().toUpperCase().startsWith("ISK") || r.paraKodu.trim().toUpperCase().startsWith("İSK"))) ||
      (r.paraAdi && (r.paraAdi.toUpperCase().includes("İSKONTO") || r.paraAdi.toUpperCase().includes("ISKONTO")))
    );
    if (isIskonto) {
      return !(parseDecimal(r.tutar) > 0 || parseDecimal(r.adet) > 0);
    }

    // 2. Vezne (0 veya undefined)
    const isVezne = r.odemeAraciTuru === 0 || r.odemeAraciTuru === undefined;
    if (isVezne) {
      if (isOdemeRowEmpty(r)) {
        return false;
      }
      const isZiynet = r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi });
      const isTL = (r.paraKodu || "").trim().toUpperCase() === "TL" || (r.paraKodu || "").trim().toUpperCase() === "TRY" || !r.paraKodu?.trim();
      const isPara = r.urunTipi === 0 || isTL;
      const isPZ = isPara || isZiynet;
      if (!isTL) {
        if (isPZ && !(parseDecimal(r.adet) > 0)) return true;
        if (!isPZ && !(parseDecimal(r.miktar) > 0)) return true;
      }
      return !(parseDecimal(r.tutar) > 0 || parseDecimal(r.adet) > 0 || parseDecimal(r.miktar) > 0);
    }

    // 3. Cari (1)
    if (r.odemeAraciTuru === 1) {
      const hasCari = Boolean(r.cariKartId || (r.cariKod && r.cariKod.trim() !== ""));
      const hasAmount = parseDecimal(r.tutar) > 0 || parseDecimal(r.adet) > 0 || parseDecimal(r.miktar) > 0;
      return !hasCari || !hasAmount;
    }

    // 4. POS / Kredi Kartı (2)
    if (r.odemeAraciTuru === 2) {
      const hasPos = Boolean(r.posCihaziId || r.bankaId || (r.cariKod && r.cariKod.trim() !== ""));
      const hasAmount = parseDecimal(r.tutar) > 0 || parseDecimal(r.adet) > 0 || parseDecimal(r.miktar) > 0;
      return !hasPos || !hasAmount;
    }

    // 5. Banka / Hesap (3)
    if (r.odemeAraciTuru === 3) {
      const hasBanka = Boolean(r.bankaId || (r.cariKod && r.cariKod.trim() !== ""));
      const hasAmount = parseDecimal(r.tutar) > 0 || parseDecimal(r.adet) > 0 || parseDecimal(r.miktar) > 0;
      return !hasBanka || !hasAmount;
    }

    return false;
  };

  // Save
  const handleSave = useCallback(async (
    forceMasakApprove = false,
    andPrint = false,
    forceFarkApprove = false,
    targetPrinter?: YaziciItem | null,
    targetCopies?: number,
    overrideOdemeRows?: OdemeRow[]
  ) => {
    // MASAK Malvarlığı Dondurulanlar Listesinde ise kesinlikle kayıt yapılamaz
    if (isMasakKontroluVar && isMasakBlocked) {
      showNotif("danger", `🚨 İŞLEM ENGELLENDİ: Bu müşteri MASAK Malvarlığı Dondurulanlar / Yaptırım Listesindedir. Kesinlikle fiş ve işlem kaydı yapılamaz!`);
      setMasakModalOpen(true);
      return;
    }

    if (!vezneId) { showNotif("warning", "Vezne seçiniz"); return; }
    let activeOdemeRows = overrideOdemeRows || odemeRows;

    const validLines = lines.filter((l) => {
      const hasProd = (l.urunId > 0 || (l.urunKodu && l.urunKodu.trim() !== ""));
      if (!hasProd) return false;
      const isZiynet = l.urunTipi === 3 || isZiynetProduct({ urunTipi: l.urunTipi, kod: l.urunKodu, ad: l.urunAdi });
      const isPara = l.urunTipi === 0;
      const isPZ = isPara || isZiynet;
      return isPZ ? (parseDecimal(l.adet) > 0 || parseDecimal(l.miktar) > 0) : parseDecimal(l.miktar) > 0;
    });
    if (!validLines.length) {
      showNotif("warning", "Lütfen en az bir geçerli ürün satırı ekleyiniz.");
      return;
    }

    // Ödeme / Tahsilat Tablosunda eksik bırakılan satır denetimi (Cari, POS, Hesap veya döviz adet/miktar)
    const incompleteRows = activeOdemeRows.filter(isOdemeRowIncomplete);
    if (incompleteRows.length > 0) {
      const invMap: Record<string, boolean> = {};
      incompleteRows.forEach((r) => { invMap[r.id] = true; });
      setInvalidOdemeRowIds(invMap);
      showNotif("warning", "Ödeme / Tahsilat tablosundaki satır tam doldurulmadı!");
      const firstIncomplete = incompleteRows[0];
      const targetCell = (firstIncomplete.odemeAraciTuru === 1 && !firstIncomplete.cariKartId && !firstIncomplete.cariKod) ? "cariKod"
        : (firstIncomplete.odemeAraciTuru === 2 && !firstIncomplete.posCihaziId && !firstIncomplete.bankaId && !firstIncomplete.cariKod) ? "cariKod"
        : (firstIncomplete.odemeAraciTuru === 3 && !firstIncomplete.bankaId && !firstIncomplete.cariKod) ? "cariKod"
        : "adet";
      focusOdemeGridCell(firstIncomplete.id, targetCell, "select");
      return;
    }
    setInvalidOdemeRowIds({});

    // e-Belge kodu (EF30): KDV %0 satışta zorunlu; yazılan kod kuyumculuk kodlarından olmalı
    const kodTemiz = (istisnaKodu || "").trim();
    if (kodTemiz && !kuyumKoduBul(kodTemiz)) { showNotif("warning", `KDV kodu ${kodTemiz} kuyumculuk kodlarından değil; dürbünden seçin (805, 808, 230, 231, 232, 301).`); return; }
    if (tip === 1 && !(parseDecimal(kdvOrani) > 0) && !kodTemiz) { showNotif("warning", "KDV %0 satışta KDV istisna kodu seçilmeli (dürbünden; altın için 805)."); return; }

    // Ürün tablosu ile Ödeme tablosu arasındaki fark kontrolü (Fark var ise doğrudan kaydetmez, onay modalını açar)
    const currentOdemeTutar = activeOdemeRows.reduce((sum, r) => sum + (parseDecimal(r.tutar) || 0), 0);
    const curFarkTL = totalTutar - currentOdemeTutar;

    if (!forceFarkApprove && (Math.abs(curFarkTL) > 0.01 || Math.abs(farkHas) > 0.0001)) {
      setShowFarkConfirmModal({ show: true, andPrint });
      return;
    }

    // Kur yetkisi denetimi: Sarraf fişinde gişe kur sapma uyarısı (confirm popup) gösterilmez.
    // Yalnızca kullanıcının kuru değiştirme yetkisi kesinlikle yoksa veya yetki sınırını aşıyorsa hata verir.
    if (!forceFarkApprove && kYetkiRef.current.kurYetkisi !== "Var") {
      const gise = (l: (typeof validLines)[number]) => {
        const u = { paraId: l.urunId, kod: l.urunKodu, ad: l.urunAdi, urunTipi: l.urunTipi };
        const kur = getKurRef.current(u, tip === 0 ? 0 : 1);
        return kur > 0 ? { kur, alis: getKurRef.current(u, 0) || null, satis: getKurRef.current(u, 1) || null } : null;
      };
      const { hata } = kurlariDenetle(
        kYetkiRef.current,
        validLines.map((l, i) => ({ etiket: `${i + 1}. satırın kuru`, gise: gise(l), kur: parseDecimal(l.kur) }))
      );
      if (hata) {
        showNotif("danger", hata);
        return;
      }
    }

    // Milyem yetkisi denetimi
    if (!forceFarkApprove && kYetkiRef.current.milyemYetkisi !== "Var") {
      const satirlarMilyem: { etiket: string; refMilyem: number | null | undefined; milyem: number }[] = [];
      validLines.forEach((l, i) => {
        const effTipi = resolveEffectiveUrunTipi({ urunTipi: l.urunTipi, kod: l.urunKodu, ad: l.urunAdi });
        const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: l.urunTipi, kod: l.urunKodu, ad: l.urunAdi });
        const isPara = effTipi === 0 || isCurrencyItem({ kod: l.urunKodu, ad: l.urunAdi, urunTipi: l.urunTipi });
        if (isPara || isZiynet) return;
        const matchedUrun = urunList.find((item) => (l.urunId && (item.id === l.urunId || item.paraId === l.urunId)) || (l.urunKodu && item.kod.trim().toLowerCase() === l.urunKodu.trim().toLowerCase()));
        const u = matchedUrun || { paraId: l.urunId, id: l.urunId, kod: l.urunKodu, ad: l.urunAdi, urunTipi: l.urunTipi };
        const prodM = Number(getMilyemForProduct(u, tip)) || 0;
        const refM = Number(l.refMilyem) || prodM || (matchedUrun ? (Number(matchedUrun.hasOrani) || Number(matchedUrun.alisMilyem) || 0) : 0);
        const m = parseDecimal(l.milyem);
        if (refM > 0 && m > 0) {
          satirlarMilyem.push({ etiket: `${i + 1}. satırın milyemi`, refMilyem: refM, milyem: m });
        }
      });
      activeOdemeRows.forEach((o, i) => {
        const isPZ = isOdemeRowParaOrZiynet(o);
        if (isPZ) return;
        const matchedUrun = urunList.find((item) => (o.paraId && (item.id === o.paraId || item.paraId === o.paraId)) || (o.paraKodu && item.kod.trim().toLowerCase() === o.paraKodu.trim().toLowerCase()));
        const u = matchedUrun || { paraId: o.paraId, id: o.paraId ?? undefined, kod: o.paraKodu, ad: o.paraAdi, urunTipi: o.urunTipi };
        const odemeTip: 0 | 1 = tip === 0 ? 1 : 0;
        const prodM = Number(getMilyemForProduct(u, odemeTip)) || 0;
        const refM = Number(o.refMilyem) || prodM || (matchedUrun ? (Number(matchedUrun.hasOrani) || Number(matchedUrun.alisMilyem) || 0) : 0);
        const m = parseDecimal(o.milyem);
        if (refM > 0 && m > 0) {
          satirlarMilyem.push({ etiket: `Ödeme ${i + 1}. satırın milyemi`, refMilyem: refM, milyem: m });
        }
      });
      const { hata } = milyemleriDenetle(kYetkiRef.current, satirlarMilyem);
      if (hata) {
        showNotif("danger", hata);
        return;
      }
    }

    // MASAK Sınır ve Kimlik Bilgisi Kontrolü (Firma Tanımları Sınırları)
    if (isMasakLimitExceeded) {
      const activeUnvan = (unvan || detayUnvan || "").trim();
      const normUnvan = activeUnvan.toLocaleUpperCase('tr-TR');
      const isAnon = !activeUnvan ||
        normUnvan === "İSİM BEYAN EDİLMEMİŞTİR" ||
        normUnvan === "ISIM BEYAN EDILMEMISTIR" ||
        normUnvan.includes("BEYAN");

      const missingFields: string[] = [];
      if (isAnon) missingFields.push("İsim / Ünvan");
      if (!detayVergiKimlikNo || !detayVergiKimlikNo.trim()) missingFields.push("T.C. Kimlik / VKN");
      if (!detayAdres || !detayAdres.trim()) missingFields.push("Müşteri Adresi");
      if (detayKisilikTipi === undefined || detayKisilikTipi === null) missingFields.push("Hukuki Yapı / Kişilik Tipi");

      if (missingFields.length > 0) {
        setMasakMissingFields(missingFields);
        setShowMasakMissingModal(true);
        return;
      }

      // Sınır aşıldığında MASAK sorgulamasını otomatik çalıştır (Önceden sorgulanmışsa yeniden bekletmeden devam eder)
      try {
        const cleanName = isAnon ? "" : (unvan || detayUnvan || "").trim();
        const cleanId = (detayVergiKimlikNo || "").trim();
        const currentTargetName = cleanName || cleanId;
        if (masakResult.searched && masakResult.queriedId === cleanId && masakResult.queriedName === currentTargetName) {
          if (masakResult.matches && masakResult.matches.length > 0) {
            setMasakModalOpen(true);
            showNotif("danger", `🚨 DİKKAT: "${currentTargetName}" MASAK Malvarlığı Dondurulanlar Listesinde bulundu! İşlem kesinlikle engellendi.`);
            return;
          }
        } else if (cleanName || cleanId) {
          const res = await MasakService.sorgula({
            ad: cleanName || undefined,
            kimlikNo: cleanId || undefined,
            limit: 15,
          });
          const matches = res?.kayitlar || [];
          setMasakResult({
            queriedName: currentTargetName,
            queriedId: cleanId,
            matches,
            searched: true,
          });
          if (matches.length > 0) {
            setMasakModalOpen(true);
            showNotif("danger", `🚨 DİKKAT: "${currentTargetName}" MASAK Malvarlığı Dondurulanlar Listesinde bulundu! İşlem kesinlikle engellendi.`);
            return;
          }
        }
      } catch (err) {
        console.error("Auto MASAK check error:", err);
      }
    }

    // POS cihazı tahsilatı (docs/POS_ENTEGRASYON_YOL_HARITASI.md, K28): satışta fiş ÖNCE kaydedilir (numara oluşur),
    // POS satırları SONRA cihazdan çekilir; bilgi fişine fiş numarası böyle gider. Ret / vazgeçmede fiş kayıtlı kalır (K29).
    // Entegrasyon kapalıysa ya da veznenin cihazı yoksa hiçbir şey sormadan geçer.
    const posIstegi = (belgeId: number | null, belgeNo: string | null) => ({
      belgeTuru: "sarraf" as const,
      belgeNo,
      belgeTipi: belgeTuru === 1 ? ("efatura" as const) : ("earsiv" as const),
      belgeId,
      kayitSonrasi: !fisId,
      vezneId,
      aliciAd: (unvan || detayUnvan || "").trim() || null,
      aliciVkn: (detayVergiKimlikNo || "").replace(/\D/g, "") || null,
      // Nakit / havale / cari satırları cihaza "ödenmiş" gider; cihaz yalnız kart tutarını çeker
      pesinOdemeler: activeOdemeRows
        .filter((r) => r.odemeAraciTuru !== 2)
        .map((r) => {
          const o = recomputeOdemeRow(r, parseDecimal(altinHasKuru) || 0);
          const mik = parseDecimal(o.miktar) > 0 ? parseDecimal(o.miktar) : parseDecimal(o.adet) || 0;
          const tutar = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : mik * (parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1);
          return { tur: r.odemeAraciTuru === 1 ? ("cari" as const) : r.odemeAraciTuru === 3 ? ("havale" as const) : ("nakit" as const), tutar };
        })
        .filter((p) => p.tutar > 0),
      satirlar: activeOdemeRows
        .filter((r) => r.odemeAraciTuru === 2)
        .map((r) => {
          const o = recomputeOdemeRow(r, parseDecimal(altinHasKuru) || 0);
          return { kimlik: r.id, tutar: parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : parseDecimal(o.miktar) || 0, posCihaziId: r.posCihaziId || r.bankaId || null };
        }),
      // Cihazdaki bilgi fişinde kalemler (KDV fiş düzeyinde olduğu için satır KDV'si 0; toplam tutmazsa cihazda tek satır basılır)
      kalemler: lines
        .filter((l) => parseDecimal(l.tutar) > 0)
        .map((l) => ({ ad: l.urunAdi || l.urunKodu || "Ürün", miktar: parseDecimal(l.adet) > 0 ? parseDecimal(l.adet) : 1, tutar: parseDecimal(l.tutar), kdvOrani: 0 })),
    });

    setIsSaving(true);
    try {
      const calculatedKdv = (parseDecimal(kdvOrani) || 0) * (parseDecimal(altinHasKuru) || 0) * totalIscilikHasGram / 100;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const liveTarih = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const liveSaat = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const finalTarih = isDuzeltmeMode ? tarih : liveTarih;
      const finalSaatStr = isDuzeltmeMode ? `${tarih}T${saat}:00` : `${liveTarih}T${liveSaat}:00`;

      // kartlar: cihazdan dönen bankaya göre belirlenen muhasebe POS kartı (yalnızca seçili olandan farklıysa dolu gelir)
      const odemeSatirlariniHazirla = (kartlar: Record<string, PosKarti>) =>
        activeOdemeRows
          .map((r) => recomputeOdemeRow(r, parseDecimal(altinHasKuru) || 0))
          .filter((o) => {
            const mik = parseDecimal(o.miktar);
            const tut = parseDecimal(o.tutar);
            const ad = parseDecimal(o.adet);
            const hg = parseDecimal(o.hasGram);
            return mik > 0 || tut > 0 || ad > 0 || hg > 0;
          })
          .map((o, i) => {
            const isPZ = (o.urunTipi === 0 || o.urunTipi === 3 || isZiynetProduct({ urunTipi: o.urunTipi, kod: o.paraKodu, ad: o.paraAdi }) || (o.paraKodu?.toUpperCase() === "TL") || (o.paraKodu?.toUpperCase() === "TRY"));
            const mik = parseDecimal(o.miktar);
            const ad = parseDecimal(o.adet);
            const effectiveMik = isPZ ? (ad > 0 ? ad : mik) : mik;
            const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
            const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
            const posKarti = kartlar[o.id];
            return {
              satirNo: i + 1,
              islemeYeri: o.odemeAraciTuru === 1 ? 1 : (o.odemeAraciTuru === 2 ? 3 : (o.odemeAraciTuru === 3 ? 2 : 0)),
              odemeAraciTuru: o.odemeAraciTuru || 0,
              cariKartId: o.cariKartId || null,
              cariKod: posKarti?.kod || o.cariKod || null,
              cariUnvan: o.cariUnvan || null,
              bankaId: posKarti?.posCihaziId || o.bankaId || null,
              posCihaziId: posKarti?.posCihaziId || o.posCihaziId || (o.odemeAraciTuru === 2 ? (o.bankaId || o.cariKartId) : null),
              paraId: o.paraId || null,
              paraKodu: o.paraKodu || (o.odemeAraciTuru === 2 || o.odemeAraciTuru === 3 ? "TL" : null),
              paraAdi: posKarti?.ad || o.paraAdi || null,
              iskontoId: o.iskontoId || null,
              adet: ad > 0 ? ad : (isPZ ? (effectiveMik || 0) : 0),
              miktar: effectiveMik,
              milyem: isPZ ? 0 : parseDecimal(o.milyem),
              hasGram: isPZ ? 0 : parseDecimal(o.hasGram),
              kur: effKur,
              tutar: effTut,
            };
          });
      const payload: SaveSarrafFisPayload = {
        sarrafFisiId: fisId,
        vezneId,
        cariKartId,
        tarih: finalTarih,
        saat: finalSaatStr,
        fisNo: fisNo.trim() || null,
        seriNo: seriNo.trim() || null,
        belgeNo: fisNo.trim() || null,
        irsaliyeNo: fisNo.trim() || null,
        tip,
        altinHasKuru: parseDecimal(altinHasKuru) || 0,
        istatistikId: istatistikId || null,
        istatistikKodu: (istatistikKodu || "").trim() || null,
        alisKuru: parseDecimal(alisKuru) || 0,
        satisKuru: parseDecimal(satisKuru) || 0,
        gumusHasKuru: parseDecimal(gumusHasKuru) || 0,
        kdvOrani: kdvOrani !== "" && !isNaN(parseDecimal(kdvOrani)) ? parseDecimal(kdvOrani) : null,
        kdv: parseFloat(calculatedKdv.toFixed(2)),
        istisnaKodu: (istisnaKodu || "").trim() || null,
        belgeTuru,
        unvan: unvan || detayUnvan || null,
        kisilikTipi: detayKisilikTipi || null,
        vergiKimlikNo: detayVergiKimlikNo || null,
        babaAdi: detayBabaAdi || null,
        anneAdi: detayAnneAdi || null,
        adres: detayAdres || null,
        eposta: detayEposta || null,
        telefonNo: detayTelefonNo || null,
        dogumTarihi: detayDogumTarihi || null,
        dogumYeri: detayDogumYeri || null,
        kimlikSeriNo: detayKimlikSeriNo || null,
        pasaportNo: detayPasaportNo || null,
        kimlikBelgeTuru: detayKimlikBelgeTuru || null,
        kimlikGecerlilikTarihi: detayKimlikGecerlilikTarihi || null,
        vekilAdi: detayVekilAdi || null,
        vekilKimlikNo: detayVekilKimlikNo || null,
        masakListesindeVar: (masakResult.matches && masakResult.matches.length > 0) ? true : false,
        kullaniciId: Number(user?.id) || 1,
        yazdirilanBelgeTipi: 0,
        satirlar: validLines.map((l, i) => {
          const effectiveUrunTipi = (l.urunTipi !== undefined && l.urunTipi !== null && String(l.urunTipi).trim() !== "")
            ? Number(l.urunTipi)
            : (isZiynetProduct({ urunTipi: l.urunTipi, kod: l.urunKodu, ad: l.urunAdi }) ? 3 : 1);
          const isGoldOrSilver = effectiveUrunTipi === 1 || effectiveUrunTipi === 2;
          const isPZ = effectiveUrunTipi === 0 || effectiveUrunTipi === 3;
          const adVal = parseDecimal(l.adet);
          const mikVal = parseDecimal(l.miktar);
          // Altın veya Gümüşte vezneye kesinlikle MİKTAR (gram) gitmeli; Döviz veya Ziynette ADET
          const effectiveMik = isGoldOrSilver ? mikVal : (isPZ ? (adVal > 0 ? adVal : mikVal) : mikVal);
          const effectiveAdet = isGoldOrSilver ? (adVal > 0 ? adVal : 1) : (adVal > 0 ? adVal : (mikVal > 0 ? mikVal : 1));
          return {
            satirId: l.satirId ?? null,
            satirNo: i + 1,
            urunId: l.urunId,
            miktar: effectiveMik || 0,
            milyem: isPZ ? 0 : (parseDecimal(l.milyem) || 0),
            hasGram: isPZ ? 0 : (parseDecimal(l.hasGram) || 0),
            adet: effectiveAdet,
            iscilikiMiktari: isPZ ? 0 : (parseDecimal(formatIscilikGirisDegeri(l.iscilikiMiktari, userIscilikGirisSekli)) || 0),
            iscilikHasGram: isPZ ? 0 : (parseDecimal(l.iscilikHasGram) || 0),
            iscilikTutari: isPZ ? 0 : (parseDecimal(l.iscilikTutari) || 0),
            iscilikKdvOrani: isPZ ? null : (parseDecimal(l.iscilikKdvOrani) || null),
            iscilikKdvTutari: isPZ ? null : (parseDecimal(l.iscilikKdvTutari) || null),
            iscilikHesaplamaSekli: isPZ ? 0 : (l.iscilikHesaplamaSekli !== undefined && l.iscilikHesaplamaSekli !== null && !isNaN(Number(l.iscilikHesaplamaSekli)) ? Number(l.iscilikHesaplamaSekli) : 0),
            aciklama: l.aciklama || null,
            kur: parseDecimal(l.kur) || 0,
            tutar: parseDecimal(l.tutar) || 0,
            urunTipi: effectiveUrunTipi,
            karat: l.karat && parseDecimal(l.karat) > 0 ? parseDecimal(l.karat) : null,
          };
        }),
        odemeSatirlari: odemeSatirlariniHazirla({}),
      };
      const result = await SarrafFisService.saveFis(payload);
      const kayitliNo: string | null = result.fisNo || fisNo.trim() || null;

      // Kart, fiş kaydedildikten sonra çekilir (K28)
      const posSonuc = tip === 1 ? await pos.tahsilEt(posIstegi(result.sarrafFisiId, kayitliNo)) : { tamam: true, kartlar: {} as Record<string, PosKarti> };
      if (Object.keys(posSonuc.kartlar).length > 0) {
        // Cihazdan dönen banka başka bir muhasebe POS kartına eşliyse fiş o kartla güncellenir (K15)
        await SarrafFisService.saveFis({ ...payload, sarrafFisiId: result.sarrafFisiId, fisNo: kayitliNo, belgeNo: kayitliNo, odemeSatirlari: odemeSatirlariniHazirla(posSonuc.kartlar) });
      }
      await pos.kaydedildi("sarraf", result.sarrafFisiId, kayitliNo);
      if (!posSonuc.tamam) {
        // Fiş kayıtlı kalır; ödeme satırı düzeltilip yeniden kaydedilir (K29). e-Belge bu haliyle gönderilmez (K30).
        showNotif("warning", `Fiş ${kayitliNo || result.sarrafFisiId} kaydedildi ancak POS tahsilatı alınmadı. Ödeme satırını düzeltip yeniden kaydedin.`);
        await loadFisById(result.sarrafFisiId);
        return;
      }

      let printSuccess = true;
      let printErrorMessage = "";

      if (andPrint) {
        const snapObj = {
          fisId: result.sarrafFisiId,
          fisNo: result.fisNo || fisNo,
          seriNo: seriNo,
          belgeNo: fisNo,
          tip: tip,
          tarih: tarih,
          saat: saat,
          unvan: unvan || detayUnvan,
          vergiKimlikNo: detayVergiKimlikNo,
          detayIl: "",
          detayIlce: "",
          detayAdres: detayAdres,
          detayTelefonNo: detayTelefonNo,
          detayPasaportNo: detayPasaportNo,
          vezneKod: vezneKod,
          kullaniciAdi: user?.fullName || user?.username || "Kasiyer",
          satirlar: validLines.map((l, i) => ({
            satirNo: i + 1,
            urunKodu: l.urunKodu,
            urunAdi: l.urunAdi,
            adet: l.adet,
            miktar: l.miktar,
            milyem: l.milyem,
            hasGram: l.hasGram,
            iscilikiMiktari: formatIscilikGirisDegeri(l.iscilikiMiktari, userIscilikGirisSekli),
            iscilikHasGram: l.iscilikHasGram,
            iscilikTutari: l.iscilikTutari,
            // Çıktının altındaki işçilik / KDV % satırları için (M15)
            iscilikToplam: l.iscilikToplam,
            iscilikKdvOrani: l.iscilikKdvOrani,
            iscilikKdvTutari: l.iscilikKdvTutari,
            iscilikHesaplamaSekli: l.iscilikHesaplamaSekli,
            kur: l.kur,
            tutar: l.tutar,
            aciklama: l.aciklama,
            urunTipi: l.urunTipi,
            karat: l.karat,
          })),
          odemeSatirlari: activeOdemeRows
            .map((r) => recomputeOdemeRow(r, Number(altinHasKuru) || 0))
            .filter((o) => {
              const mik = parseDecimal(o.miktar);
              const tut = parseDecimal(o.tutar);
              const ad = parseDecimal(o.adet);
              const hasCode = Boolean((o.paraKodu && o.paraKodu.trim() !== "") || (o.paraId && o.paraId > 0));
              return mik > 0 || tut > 0 || ad > 0 || hasCode;
            })
            .map((o, i) => {
              const mik = parseDecimal(o.miktar);
              const ad = parseDecimal(o.adet);
              const effectiveMik = mik > 0 ? mik : (ad > 0 ? ad : 0);
              const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
              const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
              return {
                satirNo: i + 1,
                odemeAraciTuru: o.odemeAraciTuru,
                paraKodu: o.paraKodu,
                paraAdi: o.paraAdi,
                // Hesap ödemesi çıktıda banka hesabının adıyla (M28)
                hesapAdi: o.odemeAraciTuru === 3 ? (o.ebKartAdi || o.cariUnvan || "") : undefined,
                adet: ad || "",
                miktar: effectiveMik || "",
                milyem: parseDecimal(o.milyem) || "",
                hasGram: parseDecimal(o.hasGram) || "",
                kur: effKur,
                tutar: effTut,
              };
            }),
          toplamTutar: totalTutar,
          // Kütükçü düzenindeki çıktı için (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF36)
          kdvOrani: parseDecimal(kdvOrani) || null,
          istisnaKodu: (istisnaKodu || "").trim() || null,
          toplamHas: alisHas,
          odenenTutar: currentOdemeTutar,
          kalanTutar: curFarkTL,
        };
        setPrintSnapshot(snapObj);

        // Tanımlarda kayıtlı olan yazıcıyı çözümle
        const resolved = resolveEffectivePrinter({
          pageType: "sarraf",
          tip,
          vezne: vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null),
          user,
          printers,
        });

        const printerToUse = targetPrinter || resolved.printer;
        const isPos = targetPrinter ? targetPrinter.belgeYaziciModu !== 0 : resolved.recommendedPrintType === "POS";
        const copiesToUse = targetCopies || resolved.kopyaSayisi || 1;

        // Fiş firmanın şablonundan basılır; satır sayısı ne olursa olsun bütün ürünler tek fişte
        try {
          const fisCikti = await sarrafFisHtml(snapObj, isPos ? "80" : "A4");
          const sonuc = await fisiYazdir(fisCikti, {
            printerName: printerToUse?.cihazAdi || printerToUse?.ad || resolved.printerName || null,
            copies: copiesToUse,
            isPos,
          });
          if (!sonuc.success) {
            printSuccess = false;
            printErrorMessage = sonuc.message;
          }
        } catch (printErr: any) {
          printSuccess = false;
          printErrorMessage = printErr?.message || "bilinmeyen hata";
        }
      }

      if (andPrint) {
        if (printSuccess) {
          showNotif("success", `✅ Fiş ${result.yeniKayit ? "kaydedildi" : "güncellendi"} ve doğrudan yazıcıya gönderildi — ${result.fisNo || result.sarrafFisiId}`);
        } else {
          showNotif("warning", `⚠️ Fiş ${result.yeniKayit ? "kaydedildi" : "güncellendi"} ANCAK YAZICIDAN ÇIKTI ALINAMADI: ${printErrorMessage}`);
        }
      } else {
        showNotif("success", `Fiş ${result.yeniKayit ? "kaydedildi" : "güncellendi"} — ${result.fisNo || result.sarrafFisiId}`);
      }
      if (await ebFis.kaydedildi(result.sarrafFisiId)) return;
      if (isDuzeltmeMode) {
        // Düzeltme sayfasında (F1 Kaydet veya F10 Kaydet/Yazdır) aynı fişte kalınır, fiş ID korunur ve güncel fiş yüklenir, sayfa asla sıfırlanmaz
        const savedId = result.sarrafFisiId || fisId;
        if (savedId) {
          setFisId(savedId);
          await loadFisById(savedId);
        } else if (result.fisNo) {
          setFisNo(result.fisNo);
        }
      } else {
        // Kayıt sayfasında sayfa sıfırlansın / temizlensin
        resetForm();
      }
      const bak = await SarrafFisService.getVezneBakiye(vezneId).catch(() => bakiyeler);
      setBakiyeler(bak);
      const fl = await SarrafFisService.getFisList({ limit: 200 }).catch(() => fisList);
      setFisList(fl);
    } catch (e: any) {
      const errMsg = e?.message || "Kayıt hatası";
      showNotif("danger", errMsg);

      // Otomatik olarak hatalı / eksik satırları kızart
      const invLines: Record<string, boolean> = {};
      lines.forEach((l) => {
        if (!isSarrafRowCompletelyEmpty(l) && !isSarrafRowFilled(l)) {
          invLines[l.id] = true;
        }
      });
      if (Object.keys(invLines).length > 0) {
        setInvalidRowIds((prev) => ({ ...prev, ...invLines }));
      }

      const invOdemeler: Record<string, boolean> = {};
      activeOdemeRows.forEach((o) => {
        if (!isOdemeRowCompletelyEmpty(o) && !isOdemeRowFilled(o)) {
          invOdemeler[o.id] = true;
        }
      });
      if (Object.keys(invOdemeler).length > 0) {
        setInvalidOdemeRowIds((prev) => ({ ...prev, ...invOdemeler }));
      }
    } finally {
      setIsSaving(false);
    }
  }, [vezneId, fisId, fisNo, seriNo, tarih, saat, tip, belgeTuru, altinHasKuru, alisKuru, satisKuru,
    gumusHasKuru, kdvOrani, istisnaKodu, unvan, detayUnvan, detayKisilikTipi, detayVergiKimlikNo,
    detayBabaAdi, detayAnneAdi, detayAdres, detayEposta, detayTelefonNo, detayDogumTarihi,
    detayDogumYeri, detayKimlikSeriNo, detayPasaportNo, detayKimlikBelgeTuru,
    detayKimlikGecerlilikTarihi, detayVekilAdi, detayVekilKimlikNo,
    cariKartId, lines, odemeRows, totalTutar, farkHas, user?.id, bakiyeler, fisList, resetForm, isDuzeltmeMode, loadFisById]);


  // Cari ve Tahsilat satırları için hem Para/Döviz hem İskonto seçimi
  const allOdemeParaIskontoList = useMemo<any[]>(() => {
    const iskontoItems: any[] = [];
    const validIskontolar = (iskontoList || []).filter((isk) =>
      isIskontoMatching(isk, totalTutar, Number(altinHasKuru) || 0)
    );

    if (validIskontolar.length === 0) {
      iskontoItems.push({
        id: "isk-default",
        kod: "İSKONTO",
        tanim: "Genel İskonto",
        tur: "İSKONTO",
        detay: "Serbest İskonto",
        rawIskonto: {
          iskontoId: 0,
          kod: "İSKONTO",
          tanim: "Genel İskonto",
          iskontoTipi: null,
          oran: null,
          tutar: null,
        } as any,
      });
    } else {
      validIskontolar.forEach((isk) => {
        let iskDetay = "İskonto";
        if (isk.iskontoTipi === 1) iskDetay = `%${isk.oran || 0} İskonto`;
        else if (isk.iskontoTipi === 2) iskDetay = `${(isk.tutar || 0).toLocaleString("tr-TR")} TL İskonto`;
        else if (isk.iskontoTipi === 3) iskDetay = `${isk.hasTutar || 0} Has Gr İskonto`;
        else if (isk.oran) iskDetay = `%${isk.oran} İskonto`;
        else if (isk.tutar) iskDetay = `${(isk.tutar || 0).toLocaleString("tr-TR")} TL İskonto`;

        const limits: string[] = [];
        if (isk.minTutar && Number(isk.minTutar) > 0) limits.push(`Min: ${Number(isk.minTutar).toLocaleString("tr-TR")} TL`);
        if (isk.maxIskontoTutari && Number(isk.maxIskontoTutari) > 0) limits.push(`Max: ${Number(isk.maxIskontoTutari).toLocaleString("tr-TR")} TL`);
        if (limits.length > 0) {
          iskDetay += ` (${limits.join(", ")})`;
        }

        iskontoItems.push({
          id: `isk-${isk.iskontoId}`,
          kod: (isk.kod || `ISK-${isk.iskontoId}`).toUpperCase().trim(),
          tanim: isk.tanim,
          tur: "İSKONTO",
          detay: iskDetay,
          rawIskonto: isk,
        });
      });
    }

    const paraItems: any[] = [];
    (urunList || []).forEach((u) => {
      paraItems.push({
        id: `p-${u.id}`,
        kod: u.kod,
        tanim: u.ad,
        tur: "PARA",
        detay: u.urunTipi === 0 ? "Nakit / Para" : ((u as any).mamulTipi || "Ürün"),
        rawProduct: u,
      });
    });

    const isPopuler = (k: string) => {
      const u = (k || "").toUpperCase().trim();
      return u === "TL" || u === "TRY" || u === "USD" || u === "EUR" || u === "GBP" || u === "ALTIN" || u === "HAS";
    };

    const topParas = paraItems.filter((p) => isPopuler(p.kod));
    const otherParas = paraItems.filter((p) => !isPopuler(p.kod));

    // Hedef satırın türüne göre liste belirlenir:
    // Hesap (odemeAraciTuru === 3) seçili iken SADECE İSKONTOLAR
    // Cari, POS veya Vezne seçili iken SADECE PARALAR / DÖVİZLER (İskonto gözükmez!)
    const currentTargetRow = targetOdemeRowIdForLookup ? odemeRows.find((r) => r.id === targetOdemeRowIdForLookup) : null;
    if (currentTargetRow?.odemeAraciTuru === 3) {
      return iskontoItems;
    }
    return [...topParas, ...otherParas];
  }, [urunList, iskontoList, totalTutar, altinHasKuru, targetOdemeRowIdForLookup, odemeRows]);

  const odemeParaIskontoColumns = useMemo<LookupColumn<any>[]>(() => [
    {
      header: "Tür",
      render: (i) => (
        <span className={`badge ${i.tur === "İSKONTO" ? "bg-warning text-dark" : "bg-primary text-white"}`} style={{ fontSize: "10px" }}>
          {i.tur}
        </span>
      ),
      width: "80px",
      highlight: false,
    },
    {
      header: "Kod",
      render: (i) => <span className="font-monospace fw-bold text-primary">{i.kod}</span>,
      width: "110px",
      highlight: true,
    },
    {
      header: "Tanım / Açıklama",
      render: (i) => <span className="fw-medium">{i.tanim}</span>,
      highlight: false,
    },
    {
      header: "Detay / Oran",
      render: (i) => <span className="text-muted small">{i.detay || "-"}</span>,
      width: "130px",
      highlight: false,
    },
  ], []);

  // Kalan fark kapatma için uyuşan iskontolar listesi
  const matchingFarkIskontolar = useMemo(() => {
    return (iskontoList || []).filter((isk) =>
      isIskontoMatching(isk, totalTutar, Number(altinHasKuru) || 0, farkTL)
    );
  }, [iskontoList, totalTutar, altinHasKuru, farkTL]);

  // Fark kapatmada kullanıcının seçtiği iskonto satırını uygulayıp kaydetme
  const handleSelectIskontoForRemaining = useCallback(async (selectedIskonto: IskontoItem, andPrint: boolean = false) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    const remainingAmount = parseFloat(farkTL.toFixed(2));
    const currentRows = [...odemeRows];

    const iskKod = (selectedIskonto.kod || (selectedIskonto.iskontoId ? `ISK-${selectedIskonto.iskontoId}` : "İSKONTO")).toUpperCase().trim();
    const iskAd = selectedIskonto.tanim
      ? (selectedIskonto.tanim.toUpperCase().includes("İSKONTO") || selectedIskonto.tanim.toUpperCase().includes("ISKONTO")
        ? selectedIskonto.tanim
        : `İSKONTO - ${selectedIskonto.tanim}`)
      : "İSKONTO";
    const iskId = selectedIskonto.iskontoId || null;

    // 1. Varsa mevcut iskonto satırını bul
    const existingIskIdx = currentRows.findIndex(
      (r) =>
        Boolean(r.iskontoId) ||
        (r.paraKodu && (r.paraKodu.trim().toUpperCase().startsWith("ISK") || r.paraKodu.trim().toUpperCase().startsWith("İSK"))) ||
        (r.paraAdi && (r.paraAdi.toUpperCase().includes("İSKONTO") || r.paraAdi.toUpperCase().includes("ISKONTO")))
    );

    let updatedRows: OdemeRow[] = [];

    if (existingIskIdx !== -1) {
      const existing = currentRows[existingIskIdx];
      const currentTut = parseDecimal(existing.tutar) || 0;
      const newTotal = parseFloat((currentTut + remainingAmount).toFixed(2));
      const existingAdet = existing.adet && parseDecimal(existing.adet) > 0 ? parseDecimal(existing.adet) : 1;
      const updatedIsk: OdemeRow = {
        ...existing,
        iskontoId: iskId,
        paraKodu: iskKod,
        paraAdi: iskAd,
        aciklama: iskAd,
        adet: formatMiktar(existingAdet),
        miktar: "",
        kur: "",
        tutar: newTotal,
        birimFiyat: newTotal / existingAdet,
      };
      const rec = recomputeOdemeRow(updatedIsk, curHasKuru, "tutar");
      rec.adet = formatMiktar(existingAdet);
      rec.miktar = "";
      rec.kur = "";
      currentRows[existingIskIdx] = rec;
      updatedRows = currentRows;
    } else {
      // Boş / kullanılmayan bir satır var mı kontrol et
      const emptyIdx = currentRows.findIndex(
        (r) => (!r.paraKodu || !r.paraKodu.trim()) && !parseDecimal(r.tutar) && !parseDecimal(r.miktar)
      );

      const targetRowId = emptyIdx !== -1 ? currentRows[emptyIdx].id : makeId();
      const targetSatirNo = emptyIdx !== -1 ? currentRows[emptyIdx].satirNo : currentRows.length + 1;

      const newIskRow: OdemeRow = {
        id: targetRowId,
        satirNo: targetSatirNo,
        odemeAraciTuru: 1, // Cari / İskonto
        cariKartId: null,
        cariKod: "",
        cariUnvan: "",
        bankaId: null,
        posCihaziId: null,
        iskontoId: iskId,
        paraId: null,
        paraKodu: iskKod,
        paraAdi: iskAd,
        aciklama: iskAd,
        adet: "1",
        miktar: "",
        milyem: "",
        hasGram: "",
        kur: "",
        tutar: remainingAmount,
        birimFiyat: remainingAmount,
      };

      const finalIsk = recomputeOdemeRow(newIskRow, curHasKuru);
      finalIsk.adet = "1";
      finalIsk.miktar = "";
      finalIsk.kur = "";

      if (emptyIdx !== -1) {
        currentRows[emptyIdx] = finalIsk;
      } else {
        currentRows.push(finalIsk);
      }
      updatedRows = currentRows;
    }

    setOdemeRows(updatedRows);
    setShowFarkConfirmModal({ show: false, andPrint: false });
    setShowFarkIskontoSecimModal({ show: false, andPrint: false });
    void handleSave(true, andPrint, true, undefined, undefined, updatedRows);
  }, [farkTL, altinHasKuru, odemeRows, handleSave]);

  // Delete
  const handleDelete = useCallback(async () => {
    if (!fisId) return;
    try {
      await SarrafFisService.deleteFis(fisId, Number(user?.id) || 1);
      showNotif("success", "Fiş silindi");
      resetForm();
      setShowDeleteConfirm(false);
      const fl = await SarrafFisService.getFisList({ limit: 200 }).catch(() => []);
      setFisList(fl);
    } catch (e: any) {
      showNotif("danger", e?.message || "Silme hatası");
      setShowDeleteConfirm(false);
    }
  }, [fisId, user?.id, resetForm]);

  // Customer selection from MusteriSecimModal
  const handleSelectCustomer = useCallback((result: SelectedCustomerResult) => {
    if (lastOdemeModalRowIdRef.current) {
      const rowId = lastOdemeModalRowIdRef.current;
      lastOdemeModalRowIdRef.current = null;
      lastModalCallerRef.current = null;
      setShowCariModal(false);
      const rawCari = result.raw || cariList.find((c) => c.id === result.id) || {
        id: result.id,
        kod: result.kod,
        ad: result.unvan,
        unvan: result.unvan,
      };
      applyCariToOdemeRow(rowId, rawCari as any);
      setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 50);
      return;
    }

    lastModalCallerRef.current = null;
    const selectedName = (result.unvan || "").trim() || DEFAULT_CUSTOMER_NAME;
    setUnvan(selectedName);
    setDetayUnvan(selectedName);
    const resolvedKod = result.type === "registered" ? (result.kod || ((result.raw as any)?.kod) || "") : "";
    setCariKod(resolvedKod);

    lastFocusedCariKodRef.current = resolvedKod;
    lastFocusedUnvanRef.current = selectedName;
    if (result.vergiKimlikNo) {
      lastFocusedVknRef.current = result.vergiKimlikNo;
    }

    if (result.type === "registered") {
      setCariKartId(result.id);
    } else {
      setCariKartId(null);
    }

    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.odemeAraciTuru === 1) {
          return {
            ...r,
            cariKod: resolvedKod || "",
            cariUnvan: selectedName || "",
            cariKartId: result.type === "registered" ? result.id : null,
            paraKodu: (r.paraKodu && r.paraKodu.trim()) ? r.paraKodu : "TL",
            paraAdi: (r.paraAdi && r.paraAdi.trim() && r.paraAdi !== "CARİ HESAP") ? r.paraAdi : "TÜRK LİRASI",
          };
        }
        return r;
      })
    );

    if (result.vergiKimlikNo) {
      setDetayVergiKimlikNo(result.vergiKimlikNo);
    }
    if (result.adres) {
      setDetayAdres(result.adres);
    }
    if (result.telefon) {
      setDetayTelefonNo(result.telefon);
    }
    if (result.eposta || result.eFaturaPostaKutusu) {
      setDetayEposta(result.eFaturaPostaKutusu || result.eposta || "");
    }

    if (result.isMukellef || result.eFaturaPostaKutusu) {
      setBelgeTuru(1);
    }

    const raw = result.raw as any;
    if (raw) {
      if (raw.kisilikTipi !== undefined && raw.kisilikTipi !== null) {
        setDetayKisilikTipi(Number(raw.kisilikTipi));
      }
      if (raw.vergiKimlikNo) setDetayVergiKimlikNo(raw.vergiKimlikNo);
      if (raw.babaAdi) setDetayBabaAdi(raw.babaAdi);
      if (raw.anneAdi) setDetayAnneAdi(raw.anneAdi);
      if (raw.adres) setDetayAdres(raw.adres);
      if (raw.eposta) setDetayEposta(raw.eposta);
      if (raw.eFaturaPostaKutusu || raw.eFaturaPosta) {
        setDetayEposta(raw.eFaturaPostaKutusu || raw.eFaturaPosta || raw.eposta || "");
        setBelgeTuru(1);
      }
      if (raw.eFatura || raw.isMukellef) {
        setBelgeTuru(1);
      }
      if (raw.telefon) setDetayTelefonNo(raw.telefon);
      if (raw.dogumTarihi) setDetayDogumTarihi(String(raw.dogumTarihi).split("T")[0]);
      if (raw.dogumYeri) setDetayDogumYeri(raw.dogumYeri);
      if (raw.kimlikSeriNo) setDetayKimlikSeriNo(raw.kimlikSeriNo);
      if (raw.pasaportNo) setDetayPasaportNo(raw.pasaportNo);
      if (raw.kimlikBelgeTuru !== undefined && raw.kimlikBelgeTuru !== null) {
        setDetayKimlikBelgeTuru(Number(raw.kimlikBelgeTuru));
      }
      if (raw.kimlikGecerlilikTarihi) {
        setDetayKimlikGecerlilikTarihi(String(raw.kimlikGecerlilikTarihi).split("T")[0]);
      }
      if (raw.vekilAdi) setDetayVekilAdi(raw.vekilAdi);
      if (raw.vekilKimlikNo) setDetayVekilKimlikNo(raw.vekilKimlikNo);

      // Cari kartta tanımlı istatistiği uygula
      const statId = tip === 0 ? raw.alisIstatistikId : raw.satisIstatistikId;
      if (statId && statisticList.length > 0) {
        const m = statisticList.find((s) => s.id === Number(statId));
        if (m) {
          setIstatistikId(m.id);
          setIstatistikKodu(m.kod);
        }
      }
    }

    // Eğer VKN girildiyse ve adres/posta kutusu eksikse arka planda e-Belge ve GİB kontrolü yap
    const cleanVknForCheck = (result.vergiKimlikNo || (raw && raw.vergiKimlikNo) || "").replace(/\D/g, "");
    if (cleanVknForCheck.length === 10 || cleanVknForCheck.length === 11) {
      ebelgeService.mukellefSorgula(cleanVknForCheck).then((mRes) => {
        if (mRes && mRes.mukellefMi) {
          setBelgeTuru(1);
          const firstUser = mRes.kullanicilar?.[0];
          if (firstUser?.Alias) {
            setDetayEposta((prev) => prev || firstUser.Alias);
          }
        }
      }).catch(() => { });

      if (!result.adres && (!raw || !raw.adres)) {
        ebelgeService.aliciAdresleri(cleanVknForCheck).then((adrRes) => {
          if (Array.isArray(adrRes) && adrRes.length > 0) {
            const first = adrRes[0];
            const comb = [first.adres, first.ilce, first.il].filter(Boolean).join(" ");
            if (comb) setDetayAdres((prev) => prev || comb);
            if (first.telefon) setDetayTelefonNo((prev) => prev || first.telefon);
          }
        }).catch(() => { });
      }
    }

    setShowCariModal(false);

    // Müşteri seçildiğinde otomatik MASAK yaptırım / dondurulanlar kontrolü (Fiş Dizayn Tipi = 1 ise çalışmaz)
    const activeStat = selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === istatistikKodu));
    const isGayriResmi = (istatistikFisDizaynTipi === 1) || (activeStat && Number(activeStat.fisDizaynTipi) === 1);

    const selectedCustomerName = (result.unvan || "").trim();
    // "MASAK uyarısı versin" işaretsizse müşteri seçilirken otomatik sorgu / uyarı açılmaz; kayıttaki kontrol sürer
    if (isMasakKontroluVar && kYetkiRef.current.masakUyarisi && !isGayriResmi && selectedCustomerName && !selectedCustomerName.toLocaleUpperCase("tr-TR").includes("BEYAN")) {
      handleSearchMasak(selectedCustomerName, result.vergiKimlikNo || (raw && raw.vergiKimlikNo) || undefined);
    } else {
      setMasakResult({ matches: [], searched: false });
    }

    if (isMasakLimitExceeded) {
      setShowMasakCustomerWarningModal(true);
    }
  }, [isMasakKontroluVar, handleSearchMasak, isMasakLimitExceeded, tip, statisticList, selectedStatistic, istatistikFisDizaynTipi, istatistikId, istatistikKodu]);

  // GİB'den ad gelince müşteri seçilmiş gibi otomatik MASAK kontrolü (handleSelectCustomer ile aynı koşullar)
  gibSonrasiRef.current = (ad: string, no: string) => {
    const activeStat = selectedStatistic || statisticList.find((s) => (istatistikId && s.id === istatistikId) || (s.kod && s.kod === istatistikKodu));
    const isGayriResmi = (istatistikFisDizaynTipi === 1) || (activeStat && Number(activeStat.fisDizaynTipi) === 1);
    if (isMasakKontroluVar && kYetkiRef.current.masakUyarisi && !isGayriResmi && ad && !ad.toLocaleUpperCase("tr-TR").includes("BEYAN")) {
      handleSearchMasak(ad, no);
    } else {
      setMasakResult({ matches: [], searched: false });
    }
    if (isMasakLimitExceeded) {
      setShowMasakCustomerWarningModal(true);
    }
  };

  /**
   * e-Fatura listesinde ad yoksa GİB'den (e-Belge'deki sorgu, musteriGibAd.ts). Ad yalnız boşken ya da
   * önceki seçimden / sorgudan kalmışken yazılır; kasiyerin elle yazdığı ada dokunulmaz.
   */
  const gibdenAdDoldur = async (no: string, sira: number) => {
    const guncelMi = () => sira === uzakSorguSiraRef.current && vknRef.current.replace(/\D/g, "") === no;
    try {
      const sonuc = await gibService.vknSorgu(no);
      if (!guncelMi()) return;
      const ad = gibAdi(sonuc);
      if (sonuc.sonuc !== "BULUNDU" || !ad) {
        showNotif("warning", `${no} numarası GİB'de kayıtlı değil. Numarayı kontrol edin.`);
        return;
      }
      // Kasiyer ad yazdıysa ona dokunulmaz
      if (!adYazilabilir(unvanRef.current, lastFocusedUnvanRef.current, isAnonymousCustomerName)) {
        showNotif("success", `GİB kaydı bulundu: ${ad} (yazdığınız ad korundu)`);
        return;
      }
      setUnvan(ad);
      setDetayUnvan(ad);
      lastFocusedUnvanRef.current = ad;
      showNotif("success", `Müşteri adı GİB'den alındı: ${ad}`);
      gibSonrasiRef.current(ad, no);
    } catch (err: any) {
      if (!guncelMi()) return;
      showNotif("warning", err?.message || "GİB sorgusu yapılamadı.");
    }
  };

  // GİB düğmesi (TC kutusunda MASAK'ın yanında): sorgu yalnız buna basınca yapılır (docs/GIB_BUTON_IL_ILCE_YOL_HARITASI.md K2)
  const [gibSorgulaniyor, setGibSorgulaniyor] = useState(false);
  const gibDugmesineBasildi = async () => {
    setGibSorgulaniyor(true);
    try {
      await handleVknLookup(vknRef.current, true);
    } finally {
      setGibSorgulaniyor(false);
    }
  };

  // TC / VKN Girişi / Değişiminde Otomatik Cari, Kayıtsız Müşteri veya GİP Sorgulama
  const handleVknLookup = useCallback(async (inputVal: string, isEnterOrBlur = false) => {
    const cleanVal = (inputVal || "").replace(/\D/g, "").slice(0, 11);
    if (!cleanVal) {
      setDetayVergiKimlikNo("");
      setCariKod("");
      setCariKartId(null);
      setUnvan(DEFAULT_CUSTOMER_NAME);
      setDetayUnvan(DEFAULT_CUSTOMER_NAME);
      lastFocusedCariKodRef.current = "";
      lastFocusedVknRef.current = "";
      lastFocusedUnvanRef.current = "";
      return;
    }

    // 1. 10 veya 11 hane ise Birebir Eşleşme Kontrolü
    if (cleanVal.length === 10 || cleanVal.length === 11) {
      const exactCari = cariList.find((c) => (c.vergiKimlikNo || "").replace(/\D/g, "") === cleanVal);
      if (exactCari) {
        handleSelectCustomer({
          type: "registered",
          id: exactCari.id,
          kod: exactCari.kod,
          unvan: exactCari.ad || (exactCari as any).unvan || "",
          vergiKimlikNo: exactCari.vergiKimlikNo || cleanVal,
          adres: exactCari.adres || "",
          telefon: exactCari.telefon || "",
          isMukellef: Boolean((exactCari as any).eFatura || (exactCari as any).eFaturaPostaKutusu || (exactCari as any).isMukellef),
          raw: exactCari,
        });
        lastFocusedVknRef.current = cleanVal;
        return;
      }

      const exactKayitsiz = kayitsizMusteriList.find((k) => (k.vergiKimlikNo || "").replace(/\D/g, "") === cleanVal);
      if (exactKayitsiz) {
        handleSelectCustomer({
          type: "unregistered",
          id: null,
          kod: "",
          unvan: exactKayitsiz.ad || exactKayitsiz.unvan || "",
          vergiKimlikNo: exactKayitsiz.vergiKimlikNo || cleanVal,
          adres: exactKayitsiz.adres || "",
          telefon: exactKayitsiz.telefon || "",
          raw: exactKayitsiz,
        });
        lastFocusedVknRef.current = cleanVal;
        return;
      }

      // Uzak sorgu (GİB düğmesiyle) yalnız kontrol hanesi tutan numarayla yapılır;
      // bu arada numara değiştiyse eski sorgunun yanıtı yok sayılır
      const sira = ++uzakSorguSiraRef.current;
      const guncelMi = () => sira === uzakSorguSiraRef.current && vknRef.current.replace(/\D/g, "") === cleanVal;
      const uzak = uzakSorguYapilir(cleanVal);
      if (!uzak) showNotif("warning", `${cleanVal} numarasının kontrol hanesi tutmuyor; GİB'e sorulmadı. Numarayı kontrol edin.`);
      if (uzak) {
        // GİB / GİP Mukellef Sorgulama (10 veya 11 hane ise)
        try {
          const res = await ebelgeService.mukellefSorgula(cleanVal);
          if (!guncelMi()) return;
          if (res && res.mukellefMi && res.kullanicilar && res.kullanicilar.length > 0) {
            const title = (res.kullanicilar[0].Title || "").trim();
            if (title) {
              setUnvan(title);
              setDetayUnvan(title);
              setDetayVergiKimlikNo(cleanVal);
              setCariKod("");
              setCariKartId(null);
              lastFocusedCariKodRef.current = "";
              lastFocusedUnvanRef.current = title;
              lastFocusedVknRef.current = cleanVal;
              setBelgeTuru(1); // GİP'te kayıtlı e-Fatura mükellefi ise otomatik e-Fatura'ya geçir
              if (res.kullanicilar[0].Alias) {
                setDetayEposta(res.kullanicilar[0].Alias);
              }
              try {
                const adrRes = await ebelgeService.aliciAdresleri(cleanVal);
                if (guncelMi() && Array.isArray(adrRes) && adrRes.length > 0) {
                  const first = adrRes[0];
                  const comb = [first.adres, first.ilce, first.il].filter(Boolean).join(" ");
                  if (comb) setDetayAdres(comb);
                  if (first.telefon) setDetayTelefonNo(first.telefon);
                }
              } catch { }
              return;
            }
          }
        } catch { }
        if (!guncelMi()) return;

        // e-Fatura listesinde ad yoksa GİB'den (şahıs TCKN'leri dahil); düğme dönerken beklenir
        await gibdenAdDoldur(cleanVal, sira);
      }

      // Hem DB'de hem GİP'te yoksa (kayıtsız perakende müşteri)
      setCariKod("");
      setCariKartId(null);
      lastFocusedCariKodRef.current = "";
      lastFocusedVknRef.current = cleanVal;
      return;
    }

    // 2. 10 haneden kısa ise ve Enter / Blur yapılmışsa arama modalı aç
    if (isEnterOrBlur && cleanVal.length >= 2) {
      const { cariler, kayitsizlar, totalCount } = findMatchingCustomers("vkn", cleanVal);
      if (totalCount === 1) {
        if (cariler.length === 1) {
          const single = cariler[0];
          handleSelectCustomer({
            type: "registered",
            id: single.id,
            kod: single.kod,
            unvan: single.ad || (single as any).unvan || "",
            vergiKimlikNo: single.vergiKimlikNo || cleanVal,
            adres: single.adres || "",
            telefon: single.telefon || "",
            isMukellef: Boolean((single as any).eFatura || (single as any).eFaturaPostaKutusu || (single as any).isMukellef),
            raw: single,
          });
          lastFocusedVknRef.current = single.vergiKimlikNo || cleanVal;
          return;
        } else if (kayitsizlar.length === 1) {
          const singleK = kayitsizlar[0];
          handleSelectCustomer({
            type: "unregistered",
            id: null,
            kod: "",
            unvan: singleK.ad || singleK.unvan || "",
            vergiKimlikNo: singleK.vergiKimlikNo || cleanVal,
            adres: singleK.adres || "",
            telefon: singleK.telefon || "",
            raw: singleK,
          });
          lastFocusedVknRef.current = singleK.vergiKimlikNo || cleanVal;
          return;
        }
      } else if (totalCount > 1) {
        lastModalCallerRef.current = "vkn";
        setCariSearchTerm(cleanVal);
        setCariSearchField("vkn");
        setShowCariModal(true);
        return;
      }
    }

    setCariKod("");
    setCariKartId(null);
    lastFocusedCariKodRef.current = "";
  }, [cariList, kayitsizMusteriList, findMatchingCustomers, handleSelectCustomer, gibdenAdDoldur]);

  // Open F8 Detay Modal (syncing current Unvan if set)
  const openDetayModal = useCallback(() => {
    if (unvan && unvan !== DEFAULT_CUSTOMER_NAME && (!detayUnvan || detayUnvan === DEFAULT_CUSTOMER_NAME)) {
      setDetayUnvan(unvan);
    }
    setShowDetayModal(true);
  }, [unvan, detayUnvan]);

  // Detay save
  const handleSaveDetay = useCallback(async () => {
    if (detayUnvan && detayUnvan.trim()) {
      setUnvan(detayUnvan.trim());
    }
    if (!fisId) {
      // Just keep in state if fis is not yet saved to DB
      showNotif("success", "Müşteri detay bilgileri fişe uygulandı");
      setShowDetayModal(false);
      return;
    }
    try {
      await SarrafFisService.saveDetay(fisId, {
        unvan: detayUnvan || null,
        kisilikTipi: detayKisilikTipi || null,
        vergiKimlikNo: detayVergiKimlikNo || null,
        babaAdi: detayBabaAdi || null,
        anneAdi: detayAnneAdi || null,
        adres: detayAdres || null,
        eposta: detayEposta || null,
        telefonNo: detayTelefonNo || null,
        dogumTarihi: detayDogumTarihi || null,
        dogumYeri: detayDogumYeri || null,
        kimlikSeriNo: detayKimlikSeriNo || null,
        pasaportNo: detayPasaportNo || null,
        kimlikBelgeTuru: detayKimlikBelgeTuru || null,
        kimlikGecerlilikTarihi: detayKimlikGecerlilikTarihi || null,
        vekilAdi: detayVekilAdi || null,
        vekilKimlikNo: detayVekilKimlikNo || null,
        kullaniciId: Number(user?.id) || 1,
      });
      showNotif("success", "Müşteri detayı kaydedildi");
      setShowDetayModal(false);
    } catch (e: any) {
      showNotif("danger", e?.message || "Detay kayıt hatası");
    }
  }, [fisId, detayUnvan, detayKisilikTipi, detayVergiKimlikNo, detayBabaAdi, detayAnneAdi,
    detayAdres, detayEposta, detayTelefonNo, detayDogumTarihi, detayDogumYeri,
    detayKimlikSeriNo, detayPasaportNo, detayKimlikBelgeTuru, detayKimlikGecerlilikTarihi,
    detayVekilAdi, detayVekilKimlikNo, user?.id, showNotif]);

  // Helper: İşlem tipine (Alış: 0, Satış: 1) göre HAS Altın Kurunu Al (Öncelik: Efektif Alış/Satış)
  const findHasKurItem = useCallback(() => {
    return kurSatirlar.find((k) =>
      ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes((k.kod || "").toUpperCase().trim()) ||
      (k.ad && ["HAS ALTIN", "HAS"].includes(k.ad.toUpperCase().trim())) ||
      (k.kod || "").toUpperCase().trim().startsWith("HAS") ||
      (k.ad || "").toUpperCase().trim().startsWith("HAS")
    );
  }, [kurSatirlar]);

  const getHasKurAlisSatis = useCallback((): { alis: number; satis: number } => {
    const hasKurItem = findHasKurItem();
    if (hasKurItem) {
      const ea = Number(hasKurItem.efektifAlis) || 0;
      const es = Number(hasKurItem.efektifSatis) || 0;
      const da = Number(hasKurItem.dovizAlis) || 0;
      const ds = Number(hasKurItem.dovizSatis) || 0;
      const alis = ea > 0 ? ea : da;
      const satis = es > 0 ? es : ds;
      if (alis > 0 || satis > 0) {
        return { alis: alis > 0 ? alis : satis, satis: satis > 0 ? satis : alis };
      }
    }
    const current = Number(altinHasKuru) || 0;
    return { alis: current, satis: current };
  }, [findHasKurItem, altinHasKuru]);

  const getHasKurForTip = useCallback((islemTip: 0 | 1): number => {
    const { alis, satis } = getHasKurAlisSatis();
    return islemTip === 0 ? alis : satis;
  }, [getHasKurAlisSatis]);

  // Helper: İşlem tipine göre Gümüş HAS Kurunu Al
  const getGumusKurForTip = useCallback((islemTip: 0 | 1): number => {
    const gumusKurItem = kurSatirlar.find((k) =>
      ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()) ||
      (k.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(k.ad.toUpperCase().trim()))
    );
    if (gumusKurItem) {
      const rate = islemTip === 0
        ? (gumusKurItem.efektifAlis && Number(gumusKurItem.efektifAlis) > 0 ? gumusKurItem.efektifAlis : (gumusKurItem.dovizAlis && Number(gumusKurItem.dovizAlis) > 0 ? gumusKurItem.dovizAlis : 0))
        : (gumusKurItem.efektifSatis && Number(gumusKurItem.efektifSatis) > 0 ? gumusKurItem.efektifSatis : (gumusKurItem.dovizSatis && Number(gumusKurItem.dovizSatis) > 0 ? gumusKurItem.dovizSatis : 0));
      if (Number(rate) > 0) return Number(rate);
    }
    return Number(gumusHasKuru) || 0;
  }, [kurSatirlar, gumusHasKuru]);

  // Helper: Ürün için Anlık Fiyat Listesindeki Alışta Efektif Alış, Satışta Efektif Satış Milyemini/Katsayısını Çek
  const getMilyemForProduct = useCallback((
    urun: { paraId?: number; kod?: string; urunTipi?: number; ad?: string; alisMilyem?: any; satisMilyem?: any; hasAlisKatsayisi?: any; hasSatisKatsayisi?: any; hasOrani?: any },
    islemTip: 0 | 1
  ): number | string => {
    const pId = urun.paraId ?? (urun as any).id;
    const code = (urun.kod || "").toUpperCase().trim();
    const name = (urun.ad || "").toUpperCase().trim();

    const isZiynet = urun.urunTipi === 3 || isZiynetProduct(urun);
    if (isZiynet || isCurrencyItem(urun as any)) return "";

    // 1. Ürün tanımındaki milyem / has katsayısı (Hurda, Bilezik, vb.)
    const rawAlis = urun.alisMilyem !== undefined && urun.alisMilyem !== null && Number(urun.alisMilyem) > 0
      ? urun.alisMilyem
      : (urun.hasAlisKatsayisi && Number(urun.hasAlisKatsayisi) > 0 ? urun.hasAlisKatsayisi : urun.hasOrani);
    const rawSatis = urun.satisMilyem !== undefined && urun.satisMilyem !== null && Number(urun.satisMilyem) > 0
      ? urun.satisMilyem
      : (urun.hasSatisKatsayisi && Number(urun.hasSatisKatsayisi) > 0 ? urun.hasSatisKatsayisi : urun.hasOrani);

    const val = islemTip === 0 ? rawAlis : rawSatis;
    if (val !== undefined && val !== null && Number(val) > 0) return Number(val);

    return "";
  }, []);

  // Helper: Ürün / Döviz / Maden için Satır Kuru (Döviz veya Ziynet ise Anlık Fiyat Listesindeki Kur, Hurda/Altın/Gümüş ise üstteki HAS Altın Kuru)
  const getKurForProduct = useCallback((
    urun: { paraId?: number; kod?: string; urunTipi?: number; ad?: string },
    islemTip: 0 | 1
  ): number => {
    const pId = urun.paraId ?? (urun as any).id;
    const code = (urun.kod || "").toUpperCase().trim();
    const name = (urun.ad || "").toUpperCase().trim();

    if (code === "TL" || code === "TRY" || code === "TRL") return 1;

    const effTipi = resolveEffectiveUrunTipi(urun);
    const isZiynet = effTipi === 3 || isZiynetProduct(urun);
    const isPara = effTipi === 0 || isCurrencyItem(urun as any);

    // Altın (1) veya Gümüş (2) ise: üstteki has kuru bölümündeki has kuru gelsin
    if (!isZiynet && !isPara) {
      const topHas = Number(altinHasKuru) || 0;
      if (topHas > 0) return topHas;
      if (effTipi === 2) {
        return getGumusKurForTip(islemTip);
      }
      return getHasKurForTip(islemTip);
    }

    // Ziynet veya Döviz: Anlık Fiyat Listesinde bu ürüne/ziynete/dövize ait kur kaydı var mı kontrol et (Öncelik: Efektif Alış / Satış)
    const curKur = kurSatirlar.find((k) =>
      (pId && k.paraId === pId) ||
      (code && k.kod && k.kod.toUpperCase().trim() === code) ||
      (name && k.ad && k.ad.toUpperCase().trim() === name)
    );

    if (curKur) {
      const rate = islemTip === 0
        ? (curKur.efektifAlis !== null && curKur.efektifAlis !== undefined && Number(curKur.efektifAlis) > 0 ? curKur.efektifAlis : (curKur.dovizAlis && Number(curKur.dovizAlis) > 0 ? curKur.dovizAlis : 0))
        : (curKur.efektifSatis !== null && curKur.efektifSatis !== undefined && Number(curKur.efektifSatis) > 0 ? curKur.efektifSatis : (curKur.dovizSatis && Number(curKur.dovizSatis) > 0 ? curKur.dovizSatis : 0));
      if (Number(rate) > 0) return Number(rate);
    }

    // Ziynet ise ve listede bulunamadıysa bile milyem/has çalıştırmıyoruz
    if (isZiynet) {
      return 0;
    }

    // Gümüş (2) ise Anlık Fiyat Listesindeki Gümüş HAS Kurunu al (Alış: Efektif Alış, Satış: Efektif Satış)
    if (effTipi === 2 || code.includes("GUMUS") || code.includes("GÜMÜŞ") || name.includes("GÜMÜŞ") || name.includes("GUMUS")) {
      return getGumusKurForTip(islemTip);
    }

    // Hurda / Maden Altın (1) ise Anlık Fiyat Listesindeki HAS Altın Kurunu al
    return getHasKurForTip(islemTip);
  }, [kurSatirlar, altinHasKuru, getHasKurForTip, getGumusKurForTip]);
  getKurRef.current = getKurForProduct;

  const getKurAlisSatisForProduct = useCallback((
    urun: { paraId?: number; id?: number; kod?: string; urunTipi?: number; ad?: string }
  ): { alis: number; satis: number; ref: number } => {
    const pId = urun.paraId ?? urun.id;
    const code = (urun.kod || "").toUpperCase().trim();
    const name = (urun.ad || "").toUpperCase().trim();

    if (code === "TL" || code === "TRY" || code === "TRL") return { alis: 1, satis: 1, ref: 1 };

    const effTipi = resolveEffectiveUrunTipi(urun);
    const isZiynet = effTipi === 3 || isZiynetProduct(urun);
    const isPara = effTipi === 0 || isCurrencyItem(urun as any);

    // Altın veya Gümüş ise: üstteki Has Kuru öncelikli
    if (!isZiynet && !isPara) {
      const topHas = Number(altinHasKuru) || 0;
      if (topHas > 0) {
        return { alis: topHas, satis: topHas, ref: topHas };
      }
      if (effTipi === 2) {
        const gumusItem = kurSatirlar.find((k) =>
          ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()) ||
          (k.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(k.ad.toUpperCase().trim()))
        );
        if (gumusItem) {
          const ea = Number(gumusItem.efektifAlis) || 0;
          const es = Number(gumusItem.efektifSatis) || 0;
          const da = Number(gumusItem.dovizAlis) || 0;
          const ds = Number(gumusItem.dovizSatis) || 0;
          const alis = ea > 0 ? ea : da;
          const satis = es > 0 ? es : ds;
          if (alis > 0 || satis > 0) {
            const finalAlis = alis > 0 ? alis : satis;
            const finalSatis = satis > 0 ? satis : alis;
            return { alis: finalAlis, satis: finalSatis, ref: tip === 0 ? finalAlis : finalSatis };
          }
        }
        const gKuru = Number(gumusHasKuru) || 0;
        return { alis: gKuru, satis: gKuru, ref: gKuru };
      }
      // Altın
      const has = getHasKurAlisSatis();
      return { alis: has.alis, satis: has.satis, ref: tip === 0 ? has.alis : has.satis };
    }

    // 1. Anlık Fiyat Listesinde bu ürüne ait kur satırı
    const curKur = kurSatirlar.find((k) =>
      (pId && k.paraId === pId) ||
      (code && k.kod && k.kod.toUpperCase().trim() === code) ||
      (name && k.ad && k.ad.toUpperCase().trim() === name)
    );

    if (curKur) {
      const ea = Number(curKur.efektifAlis) || 0;
      const es = Number(curKur.efektifSatis) || 0;
      const da = Number(curKur.dovizAlis) || 0;
      const ds = Number(curKur.dovizSatis) || 0;
      const alis = ea > 0 ? ea : da;
      const satis = es > 0 ? es : ds;
      if (alis > 0 || satis > 0) {
        const finalAlis = alis > 0 ? alis : satis;
        const finalSatis = satis > 0 ? satis : alis;
        return { alis: finalAlis, satis: finalSatis, ref: tip === 0 ? finalAlis : finalSatis };
      }
    }

    // 2. Gümüş ise Gümüş HAS kuru
    if (effTipi === 2 || code.includes("GUMUS") || code.includes("GÜMÜŞ") || name.includes("GÜMÜŞ") || name.includes("GUMUS")) {
      const gumusItem = kurSatirlar.find((k) =>
        ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes((k.kod || "").toUpperCase().trim()) ||
        (k.ad && ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(k.ad.toUpperCase().trim()))
      );
      if (gumusItem) {
        const ea = Number(gumusItem.efektifAlis) || 0;
        const es = Number(gumusItem.efektifSatis) || 0;
        const da = Number(gumusItem.dovizAlis) || 0;
        const ds = Number(gumusItem.dovizSatis) || 0;
        const alis = ea > 0 ? ea : da;
        const satis = es > 0 ? es : ds;
        if (alis > 0 || satis > 0) {
          const finalAlis = alis > 0 ? alis : satis;
          const finalSatis = satis > 0 ? satis : alis;
          return { alis: finalAlis, satis: finalSatis, ref: tip === 0 ? finalAlis : finalSatis };
        }
      }
      const gKuru = Number(gumusHasKuru) || 0;
      return { alis: gKuru, satis: gKuru, ref: gKuru };
    }

    // 3. Altın ise Altın HAS kuru
    const has = getHasKurAlisSatis();
    return { alis: has.alis, satis: has.satis, ref: tip === 0 ? has.alis : has.satis };
  }, [kurSatirlar, tip, altinHasKuru, gumusHasKuru, getHasKurAlisSatis]);

  // e-Banka'dan fiş kesiliyorsa banka tutarı (TL); miktarı boş ürün satırında miktar bu tutarın kalanından hesaplanır
  const ebHedefRef = useRef(0);
  // e-Banka'dan açılan fiş (kesim ya da Düzenle) ve Düzenle'de açılan fişin no'su; ebFis kancasından her çizimde yazılır
  const ebModRef = useRef(false);
  const ebDuzenlemeRef = useRef("");

  // Ürün seçildiğinde veya kodu girildiğinde satırı otomatik doldurma & hesaplama yardımcısı
  const applyProductToRow = useCallback((
    rowId: string,
    item: UrunItem,
    overrideAdet?: number
  ) => {
    const k = (item.kod || "").trim().toUpperCase();
    if (k === "TL" || k === "TRY" || (item.ad || "").toUpperCase().includes("TÜRK LİRASI")) {
      showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
      return;
    }

    const resolvedUrunTipi = resolveEffectiveUrunTipi(item);
    const isZiynet = resolvedUrunTipi === 3;
    const isPara = resolvedUrunTipi === 0;
    const isParaOrZiynet = isPara || isZiynet;
    const isTL = ["TL", "TRY", "TRL"].includes((item.kod || "").trim().toUpperCase()) || (item.ad || "").trim().toUpperCase().includes("TÜRK LİRASI");
    const autoKur = getKurForProduct(item, tip);
    const autoMilyem = getMilyemForProduct(item, tip);
    const headerHasKuru = Number(altinHasKuru) || 0;

    // Altın veya Gümüş seçilmiş ise: kur otomatik olarak üstteki has kuru bölümündeki has kuru gelir
    let finalKur = 0;
    if (!isParaOrZiynet) {
      finalKur = headerHasKuru > 0
        ? headerHasKuru
        : (resolvedUrunTipi === 2 ? getGumusKurForTip(tip) : getHasKurForTip(tip));
      if (!(finalKur > 0) && autoKur > 0) {
        finalKur = autoKur;
      }
    } else {
      finalKur = autoKur > 0 ? autoKur : 0;
    }

    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;

      const adet = overrideAdet !== undefined ? (typeof overrideAdet === "number" ? formatMiktar(overrideAdet) : overrideAdet) : (parseDecimal(r.adet) > 0 ? r.adet : 1);
      const numAdet = parseDecimal(adet) || 1;
      const miktar = isParaOrZiynet
        ? ""
        : (Number(item.gramaj) > 0 ? formatMiktar(Number(item.gramaj) * numAdet) : (parseDecimal(r.miktar) > 0 ? r.miktar : ""));
      const iscilikiMiktari = isParaOrZiynet ? "" : (item.iscilik && Number(item.iscilik) > 0 ? Number(item.iscilik) : (r.iscilikiMiktari || ""));
      const milyem = isParaOrZiynet ? "" : (autoMilyem !== "" ? autoMilyem : (r.milyem || ""));
      const refMilyem = isParaOrZiynet ? "" : (autoMilyem !== "" ? autoMilyem : (Number(item.hasOrani) > 0 ? Number(item.hasOrani) : (Number(item.alisMilyem) > 0 ? Number(item.alisMilyem) : (r.refMilyem || ""))));

      const updated: GridRow = {
        ...r,
        urunId: item.paraId,
        urunKodu: item.kod,
        urunAdi: item.ad,
        adet,
        miktar,
        milyem,
        refMilyem,
        iscilikHesaplamaSekli: isParaOrZiynet ? 0 : (r.iscilikHesaplamaSekli !== undefined && r.iscilikHesaplamaSekli !== null ? r.iscilikHesaplamaSekli : 0),
        iscilikiMiktari,
        iscilikHasGram: isParaOrZiynet ? "" : r.iscilikHasGram,
        iscilikTutari: isParaOrZiynet ? "" : r.iscilikTutari,
        hasGram: isParaOrZiynet ? "" : r.hasGram,
        urunTipi: resolvedUrunTipi,
        kur: finalKur > 0 ? finalKur : (r.kur || ""),
      };
      // e-Banka: miktar boşsa banka tutarının kalanından (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF20).
      // Altın tipinde tutar = gram × kur (recomputeRow): gram kura bölünür, milyeme bölünmez (eskiden bölünüyordu,
      // 1500 TL'lik ödeme 1637,62 TL'lik fiş oluyordu). Gümüş / hurda: tutar = has × kur → kur × milyem.
      // Gram / adet yuvarlandığı için kalan kuruş farkı kalmasın diye satır tutarı banka tutarına sabitlenir (ziynette adet tam sayı, sabitlenmez).
      let ebSabitTutar: number | null = null;
      let ebDengeAlani: keyof GridRow | undefined = undefined;
      if (ebHedefRef.current > 0 && !(parseDecimal(updated.miktar) > 0)) {
        const kalan = ebHedefRef.current - prev.filter((x) => x.id !== rowId).reduce((t, x) => t + parseDecimal(x.tutar), 0);
        const kurN = parseDecimal(updated.kur);
        if (kalan > 0 && kurN > 0) {
          if (isParaOrZiynet) {
            const ad = isZiynet ? Math.round(kalan / kurN) : parseFloat((kalan / kurN).toFixed(2));
            updated.adet = ad;
            updated.miktar = "";
            if (!isZiynet) ebSabitTutar = parseFloat(kalan.toFixed(2));
          } else {
            // Altın / gümüş: toplam banka tutarına sabit, İşçilik KDV %20 varsayılan; gram (işçilik varsa ondan sonra kalanla)
            // ebankaSatiriDengele'de çözülür (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M10–M12)
            const kdvKapali = isKdvDisabledRef.current;
            if (!kdvKapali && !(parseDecimal(updated.iscilikKdvOrani) > 0)) updated.iscilikKdvOrani = EB_VARSAYILAN_KDV;
            updated.ebSabit = { miktar: 0, adet: parseDecimal(updated.adet), kur: kurN, tutar: parseFloat(kalan.toFixed(2)), kdvAyarli: !kdvKapali };
            ebDengeAlani = parseDecimal(updated.iscilikiMiktari) > 0 ? "iscilikiMiktari" : undefined;
          }
        }
      }
      const hesaplanan = recomputeRow(updated, finalKur, ebDengeAlani, userIscilikGirisSekli, isKdvDisabledRef.current);
      return ebSabitTutar !== null && parseDecimal(hesaplanan.tutar) > 0
        ? { ...hesaplanan, tutar: ebSabitTutar, ebSabit: { miktar: parseDecimal(hesaplanan.miktar), adet: parseDecimal(hesaplanan.adet), kur: parseDecimal(hesaplanan.kur), tutar: ebSabitTutar } }
        : hesaplanan;
    }));
    setInvalidRowIds((prev) => ({ ...prev, [rowId]: true }));
  }, [tip, altinHasKuru, getKurForProduct, getMilyemForProduct, getHasKurForTip, getGumusKurForTip, userIscilikGirisSekli]);

  const applyProductToOdemeRow = useCallback((
    rowId: string,
    item: UrunItem,
    overrideAdet?: number
  ) => {
    const resolvedUrunTipi = resolveEffectiveUrunTipi(item);
    const isZiynet = resolvedUrunTipi === 3;
    const isPara = resolvedUrunTipi === 0;
    const isParaOrZiynet = isPara || isZiynet;
    const isTL = ["TL", "TRY", "TRL"].includes((item.kod || "").trim().toUpperCase()) || (item.ad || "").trim().toUpperCase().includes("TÜRK LİRASI");
    const odemeTip: 0 | 1 = tip === 0 ? 1 : 0;
    const autoKur = getKurForProduct(item, odemeTip);
    const autoMilyem = getMilyemForProduct(item, odemeTip);
    const headerHasKuru = Number(altinHasKuru) || 0;

    // Altın veya Gümüş seçilmiş ise: kur otomatik olarak üstteki has kuru bölümündeki has kuru gelir
    let finalKur = 0;
    if (!isParaOrZiynet) {
      finalKur = headerHasKuru > 0
        ? headerHasKuru
        : (resolvedUrunTipi === 2 ? getGumusKurForTip(odemeTip) : getHasKurForTip(odemeTip));
      if (!(finalKur > 0) && autoKur > 0) {
        finalKur = autoKur;
      }
    } else {
      finalKur = autoKur > 0 ? autoKur : 0;
    }

    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;

      const isAltinOrGumus = !isParaOrZiynet && !isTL;
      const adet = isAltinOrGumus
        ? ""
        : (overrideAdet !== undefined
          ? (typeof overrideAdet === "number" ? formatMiktar(overrideAdet) : overrideAdet)
          : (parseDecimal(r.adet) > 0 ? r.adet : 1));
      const numAdet = parseDecimal(adet) || 1;
      const miktar = isParaOrZiynet
        ? ""
        : (Number(item.gramaj) > 0 ? formatMiktar(Number(item.gramaj) * numAdet) : (parseDecimal(r.miktar) > 0 ? r.miktar : ""));
      const milyem = isParaOrZiynet ? "" : (autoMilyem !== "" ? autoMilyem : (r.milyem || ""));
      const refMilyem = isParaOrZiynet ? "" : (autoMilyem !== "" ? autoMilyem : (Number(item.hasOrani) > 0 ? Number(item.hasOrani) : (Number(item.alisMilyem) > 0 ? Number(item.alisMilyem) : (r.refMilyem || ""))));

      const updated: OdemeRow = {
        ...r,
        paraId: item.paraId,
        paraKodu: item.kod,
        paraAdi: item.ad,
        adet,
        miktar,
        milyem,
        refMilyem,
        hasGram: isParaOrZiynet ? "" : r.hasGram,
        urunTipi: resolvedUrunTipi,
        kur: isTL ? "" : (finalKur > 0 ? finalKur : (r.kur || "")),
      };
      return recomputeOdemeRow(updated, finalKur);
    }));
    odemeFocusedInitialValRef.current[rowId] = (item.kod || "").trim();
    setInvalidOdemeRowIds((prev) => {
      if (!prev[rowId]) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, [tip, altinHasKuru, getKurForProduct, getMilyemForProduct, getHasKurForTip, getGumusKurForTip]);

  // Satırın tamamen boş olup olmadığını kontrol eder (Kalemler)
  const isSarrafRowCompletelyEmpty = useCallback((r?: GridRow): boolean => {
    if (!r) return true;
    const hasCode = Boolean((r.urunKodu && r.urunKodu.trim() !== "") || (r.urunAdi && r.urunAdi.trim() !== ""));
    const hasAdet = Boolean(r.adet !== "" && r.adet !== null && parseDecimal(r.adet) > 0);
    const hasMiktar = Boolean(r.miktar !== "" && r.miktar !== null && parseDecimal(r.miktar) > 0);
    const hasTutar = Boolean(r.tutar !== "" && r.tutar !== null && parseDecimal(r.tutar) > 0);
    const hasGram = Boolean(r.hasGram !== "" && r.hasGram !== null && parseDecimal(r.hasGram) > 0);
    // Ürün kodu veya adı seçilmemişse veya hiçbir miktar/adet/tutar/gram girilmemişse satır boştur
    if (!hasCode) return true;
    if (!hasAdet && !hasMiktar && !hasTutar && !hasGram) return true;
    return false;
  }, []);

  // Satırın geçerli şekilde doldurulup doldurulmadığını kontrol eder (Kalemler)
  const isSarrafRowFilled = useCallback((r?: GridRow): boolean => {
    if (!r) return false;
    const hasCode = Boolean(r.urunKodu && r.urunKodu.trim() !== "");
    const isZiynet = r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
    const isPara = r.urunTipi === 0;
    const isParaOrZiynet = isPara || isZiynet;
    const hasAdet = Boolean(r.adet && parseDecimal(r.adet) > 0);
    const hasMiktar = isParaOrZiynet ? true : Boolean(r.miktar && parseDecimal(r.miktar) > 0);
    const hasKurOrTutar = Boolean((r.kur && parseDecimal(r.kur) > 0) || (r.tutar && parseDecimal(r.tutar) > 0));
    return hasCode && hasAdet && hasMiktar && hasKurOrTutar;
  }, []);

  // Boş satırları otomatik temizler (Kalemler - İlk satır daima korunur)
  const cleanupEmptyRows = useCallback((keepActiveIndex?: number | null) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (idx === 0) return true; // İlk satır daima korunur
        if (keepActiveIndex !== undefined && keepActiveIndex !== null && idx === keepActiveIndex) return true;
        return !isSarrafRowCompletelyEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      const finalLines = filtered.length > 0 ? filtered : [createEmptyRow(1)];
      return finalLines.map((r, i) => ({ ...r, satirNo: i + 1 }));
    });
  }, [isSarrafRowCompletelyEmpty]);

  // Satırın tamamen boş olup olmadığını kontrol eder (Ödeme / Tahsilat)
  const isOdemeRowCompletelyEmpty = useCallback((r?: OdemeRow): boolean => {
    if (!r) return true;
    const hasCode = Boolean(
      r.paraKodu &&
      r.paraKodu.trim() !== "" &&
      r.paraKodu.toUpperCase() !== "TL" &&
      r.paraKodu.toUpperCase() !== "TRY"
    );
    const hasName = Boolean(
      r.paraAdi &&
      r.paraAdi.trim() !== "" &&
      r.paraAdi.toUpperCase() !== "TÜRK LİRASI" &&
      r.paraAdi.toUpperCase() !== "TURK LIRASI"
    );
    const hasMiktar = Boolean(r.miktar !== "" && r.miktar !== null && parseDecimal(r.miktar) > 0);
    const hasTutar = Boolean(r.tutar !== "" && r.tutar !== null && parseDecimal(r.tutar) > 0);
    const hasAdet = Boolean(r.adet !== "" && r.adet !== null && parseDecimal(r.adet) > 0);
    const hasHasGram = Boolean(r.hasGram !== "" && r.hasGram !== null && parseDecimal(r.hasGram) > 0);
    const hasNonDefaultTur = r.odemeAraciTuru !== 0 && r.odemeAraciTuru !== undefined;
    const hasCariOrBank = Boolean(r.cariKod || r.cariKartId || r.bankaId || r.posCihaziId || r.iskontoId);

    return !hasMiktar && !hasTutar && !hasAdet && !hasHasGram && !hasNonDefaultTur && !hasCariOrBank && !hasCode && !hasName;
  }, []);

  // Satırın geçerli şekilde doldurulup doldurulmadığını kontrol eder (Ödeme / Tahsilat)
  const isOdemeRowFilled = useCallback((r?: OdemeRow): boolean => {
    if (!r) return false;
    const hasCode = Boolean(r.paraKodu && r.paraKodu.trim() !== "");
    const isZiynet = Boolean(r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi }));
    const isTL = r.paraKodu?.toUpperCase() === "TL" || r.paraKodu?.toUpperCase() === "TRY";
    const isPara = Boolean(
      !isZiynet && (
        r.urunTipi === 0 ||
        r.urunTipi === undefined ||
        r.urunTipi === null ||
        isTL
      )
    );
    const isParaOrZiynet = isPara || isZiynet;
    const hasAdet = !isParaOrZiynet || Boolean(r.adet && parseDecimal(r.adet) > 0);
    const hasMiktar = isParaOrZiynet || Boolean(r.miktar && parseDecimal(r.miktar) > 0);
    const hasKurOrTutar = Boolean((r.kur && parseDecimal(r.kur) > 0) || (r.tutar && parseDecimal(r.tutar) > 0));
    return hasCode && hasAdet && hasMiktar && hasKurOrTutar;
  }, []);

  const isOdemeRowEmpty = (row?: OdemeRow): boolean => {
    if (!row) return true;
    const hasParaKodu = Boolean(
      row.paraKodu &&
      String(row.paraKodu).trim() !== "" &&
      String(row.paraKodu).trim().toUpperCase() !== "TL" &&
      String(row.paraKodu).trim().toUpperCase() !== "TRY"
    );
    const hasParaAdi = Boolean(
      row.paraAdi &&
      String(row.paraAdi).trim() !== "" &&
      String(row.paraAdi).trim().toUpperCase() !== "TÜRK LİRASI" &&
      String(row.paraAdi).trim().toUpperCase() !== "TURK LIRASI"
    );
    const hasAciklama = Boolean(row.aciklama && String(row.aciklama).trim());
    const hasCariKod = Boolean(row.cariKod && String(row.cariKod).trim());
    const hasAdet = Boolean(row.adet !== "" && row.adet !== null && parseDecimal(row.adet) > 0);
    const hasMiktar = Boolean(row.miktar !== "" && row.miktar !== null && parseDecimal(row.miktar) > 0);
    const hasMilyem = Boolean(row.milyem !== "" && row.milyem !== null && parseDecimal(row.milyem) > 0);
    const hasHasGram = Boolean(row.hasGram !== "" && row.hasGram !== null && parseDecimal(row.hasGram) > 0);
    const hasTutar = Boolean(row.tutar !== "" && row.tutar !== null && parseDecimal(row.tutar) > 0);
    const hasCari = Boolean(row.cariKartId);
    const hasBanka = Boolean(row.bankaId);
    const hasParaId = Boolean(row.paraId);
    const hasIskontoId = Boolean(row.iskontoId);
    const hasPosCihaziId = Boolean(row.posCihaziId);
    const hasModifiedTur = row.odemeAraciTuru !== 0 && row.odemeAraciTuru !== undefined;

    return !hasParaKodu && !hasParaAdi && !hasAciklama && !hasCariKod && !hasAdet && !hasMiktar && !hasMilyem && !hasHasGram && !hasTutar && !hasCari && !hasBanka && !hasParaId && !hasIskontoId && !hasPosCihaziId && !hasModifiedTur;
  };

  // Boş satırları otomatik temizler (Ödeme / Tahsilat)
  const cleanupEmptyOdemeRows = useCallback((keepActiveIndex?: number | null) => {
    setOdemeRows((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((r, idx) => {
        if (typeof keepActiveIndex === "number" && idx === keepActiveIndex) return true;
        return !isOdemeRowEmpty(r);
      });
      if (filtered.length === prev.length) return prev;
      const result = filtered.length > 0 ? filtered : [createEmptyOdemeRow(1)];
      return result.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  // Tablolardan farklı bir yere tıklandığında tamamen boş satırları otomatik kapat
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (isAnyModalOpen) return;

      const isInsideKalemler = Boolean(target.closest('[data-table-type="kalemler"]'));
      const isInsideOdeme = Boolean(target.closest('[data-table-type="odeme"]'));
      if (!isInsideKalemler) {
        cleanupEmptyRows(null);
      }
      if (!isInsideOdeme) {
        cleanupEmptyOdemeRows(null);
      }
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [cleanupEmptyRows, cleanupEmptyOdemeRows, isAnyModalOpen]);

  // Sağ tıkla kalanı kapat fonksiyonu
  const handleKapatRow = useCallback((rowId: string) => {
    const otherPaidTL = odemeRows
      .filter((r) => r.id !== rowId)
      .reduce((s, r) => s + (parseDecimal(r.tutar) || 0), 0);
    const kalanTL = Math.max(0, parseFloat((totalTutar - otherPaidTL).toFixed(2)));
    const hasKuruVal = Number(altinHasKuru) || 0;

    setOdemeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const pk = r.paraKodu ? r.paraKodu.trim().toUpperCase() : "";
        const isTL = pk === "TL" || pk === "TRY" || !pk;

        if (isTL) {
          const hasVal = hasKuruVal > 0 && kalanTL > 0 ? parseFloat((kalanTL / hasKuruVal).toFixed(4)) : "";
          return {
            ...r,
            paraKodu: "TL",
            paraAdi: "TÜRK LİRASI",
            adet: kalanTL > 0 ? formatMiktar(kalanTL) : "",
            miktar: "",
            kur: "",
            tutar: kalanTL > 0 ? kalanTL : "",
            hasGram: "",
          };
        }

        let rowKur = parseDecimal(r.kur);
        if (rowKur <= 0) {
          const found = urunList.find((u) => u.kod.trim().toLowerCase() === pk.toLowerCase());
          if (found) {
            const autoKur = getKurForProduct(found, tip === 0 ? 1 : 0);
            if (autoKur > 0) rowKur = autoKur;
          }
        }
        if (rowKur <= 0) rowKur = 1;

        const isZiynet = r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi });
        const isPara = r.urunTipi === 0;
        const isParaOrZiynet = isPara || isZiynet;

        if (!isParaOrZiynet) {
          // Maden / Altın / Gümüş (Miktar çalışır, adet pasiftir)
          const rawM = parseDecimal(r.milyem);
          const effM = rawM > 1 ? (rawM <= 100 ? rawM / 100 : rawM / 1000) : (rawM > 0 ? rawM : 1);
          const effKur = rowKur > 0 ? rowKur : (hasKuruVal > 0 ? hasKuruVal : 1);
          const hasVal = effKur > 0 && kalanTL > 0 ? parseFloat((kalanTL / effKur).toFixed(4)) : "";
          const miktarVal = effM > 0 && hasVal ? parseFloat((Number(hasVal) / effM).toFixed(4)) : (hasVal || "");
          return {
            ...r,
            tutar: kalanTL > 0 ? kalanTL : "",
            hasGram: hasVal,
            miktar: miktarVal !== "" ? formatMiktar(miktarVal) : "",
            adet: "",
            kur: rowKur,
          };
        } else {
          // Döviz (USD, EUR vs.) veya Ziynet (Adet çalışır, miktar pasiftir)
          const adetVal = rowKur > 0 && kalanTL > 0 ? (isZiynet ? Math.round(kalanTL / rowKur) : parseFloat((kalanTL / rowKur).toFixed(2))) : 1;
          const tutarVal = parseFloat((adetVal * rowKur).toFixed(2));
          const hasVal = hasKuruVal > 0 && tutarVal > 0 ? parseFloat((tutarVal / hasKuruVal).toFixed(4)) : "";
          return {
            ...r,
            adet: formatMiktar(adetVal),
            miktar: "",
            tutar: tutarVal,
            hasGram: hasVal,
            kur: rowKur,
          };
        }
      })
    );
  }, [odemeRows, totalTutar, altinHasKuru, urunList, getKurForProduct, tip]);

  // Has Kuru change
  const handleAltinHasKuruChange = useCallback((val: string) => {
    const cleanVal = onlyDecimal(val);
    setAltinHasKuru(cleanVal);
    const newKur = Number(cleanVal) || 0;
    if (newKur > 0) {
      setLines((prev) => prev.map((r) => {
        const effTipi = resolveEffectiveUrunTipi({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isPara = effTipi === 0 && Boolean(r.urunKodu && r.urunKodu.trim());
        if (!isPara && !isZiynet) {
          const updated = { ...r, kur: newKur };
          return recomputeRow(updated, newKur, undefined, userIscilikGirisSekli, isKdvDisabledRef.current);
        }
        return r;
      }));
      setOdemeRows((prev) => prev.map((r) => {
        const effTipi = resolveEffectiveUrunTipi({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi });
        const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi });
        const isTL = (r.paraKodu || "").trim().toUpperCase() === "TL" || (r.paraKodu || "").trim().toUpperCase() === "TRY";
        const isKart = r.odemeAraciTuru === 2;
        const isIskonto = Boolean(r.iskontoId);
        const isPara = effTipi === 0 || isTL || isKart || isIskonto;
        if (!isPara && !isZiynet) {
          const updated = { ...r, kur: newKur };
          return recomputeOdemeRow(updated, newKur);
        }
        return recomputeOdemeRow(r, newKur);
      }));
    }
  }, [userIscilikGirisSekli]);

  // Milyem yazılır yazılmaz (anlık) sınır kontrolü:
  // Üst sınırı aştığı anda veya alt sınırın altında kalacağı kesinleştiği anda (örn. 90-110 aralığında 115 veya 85 yazıldığında) true döner.
  const shouldClampMilyemImmediately = useCallback((rawInput: string, milyemVal: number, alt: number, ust: number): boolean => {
    if (!(milyemVal > 0) || !(alt > 0) || !(ust > 0)) return false;
    // 1. Üst sınırı aştıysa (örn. 110 sınırında 115 girildiyse) anında sınırla
    if (milyemVal > ust + 1e-9) return true;

    // 2. Alt sınırın altındaysa (milyemVal < alt):
    if (milyemVal < alt - 1e-9) {
      const clean = String(rawInput ?? "").trim().replace(/,/g, ".");
      if (!clean || clean.endsWith(".")) return false;

      if (clean.includes(".")) {
        const decPart = clean.split(".")[1] || "";
        const d = decPart.length;
        const altDecPart = String(Number(alt.toFixed(4))).split(".")[1] || "";
        const minDecDigits = Math.min(2, Math.max(1, altDecPart.length));
        const maxReachableWithDecimals = milyemVal + Math.pow(10, -d);
        if (maxReachableWithDecimals < alt - 1e-9 && d >= minDecDigits) {
          return true;
        }
        return false;
      } else {
        const intDigits = clean.replace(/^0+/, "").length || 1;
        const altIntDigits = Math.floor(alt) > 0 ? String(Math.floor(alt)).length : 1;
        // En az alt sınırın tam sayı basamak sayısı kadar rakam yazıldıysa (örn. 90 için 2 basamak -> "85")
        // ve yanına bir basamak daha eklendiğinde (milyemVal * 10) üst sınırın 2 katını aşıyorsa (örn. 850 >= 220),
        // kullanıcı ara basamak ("11" -> "110") değil, doğrudan düşük sayı ("85") girmiştir: anında sınırla!
        if (intDigits >= altIntDigits && milyemVal * 10 >= ust * 2) {
          return true;
        }
      }
    }
    return false;
  }, []);

  const milyemTypingTimerRef = useRef<Record<string, any>>({});

  const resolveKalemRefMilyem = useCallback((r: GridRow): number => {
    const fromRow = parseDecimal(r.refMilyem);
    if (fromRow > 0) return fromRow;
    const matchedUrun = urunList.find(
      (item) =>
        (r.urunId && (item.id === r.urunId || item.paraId === r.urunId)) ||
        (r.urunKodu && item.kod.trim().toLowerCase() === r.urunKodu.trim().toLowerCase())
    );
    const u = matchedUrun || { paraId: r.urunId, id: r.urunId, kod: r.urunKodu, ad: r.urunAdi, urunTipi: r.urunTipi };
    const prodMilyem = Number(getMilyemForProduct(u, tip)) || 0;
    if (prodMilyem > 0) return prodMilyem;
    if (matchedUrun) {
      return Number(matchedUrun.hasOrani) || Number(matchedUrun.alisMilyem) || Number(matchedUrun.satisMilyem) || 0;
    }
    return 0;
  }, [urunList, getMilyemForProduct, tip]);

  const resolveOdemeRefMilyem = useCallback((r: OdemeRow): number => {
    const fromRow = parseDecimal(r.refMilyem);
    if (fromRow > 0) return fromRow;
    const matchedUrun = urunList.find(
      (item) =>
        (r.paraId && (item.id === r.paraId || item.paraId === r.paraId)) ||
        (r.paraKodu && item.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase())
    );
    const u = matchedUrun || { paraId: r.paraId, id: r.paraId ?? undefined, kod: r.paraKodu, ad: r.paraAdi, urunTipi: r.urunTipi };
    const odemeTip: 0 | 1 = tip === 0 ? 1 : 0;
    const prodMilyem = Number(getMilyemForProduct(u, odemeTip)) || 0;
    if (prodMilyem > 0) return prodMilyem;
    if (matchedUrun) {
      return Number(matchedUrun.hasOrani) || Number(matchedUrun.alisMilyem) || Number(matchedUrun.satisMilyem) || 0;
    }
    return 0;
  }, [urunList, getMilyemForProduct, tip]);

  const normalizeRowOnBlur = useCallback((rowId: string, field: keyof GridRow) => {
    if (milyemTypingTimerRef.current[`kalem_${rowId}`]) {
      clearTimeout(milyemTypingTimerRef.current[`kalem_${rowId}`]);
      delete milyemTypingTimerRef.current[`kalem_${rowId}`];
    }
    setInvalidRowIds((prev) => ({ ...prev, [rowId]: true }));
    let pendingWarnMsg: string | null = null;
    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      let val = r[field];
      let nextRefMilyem = r.refMilyem;
      if (typeof val === "string" && (val.startsWith(",") || val.startsWith("."))) {
        val = "0" + val;
      }
      if (field === "adet" || field === "miktar") {
        if (val !== undefined && val !== null && val !== "") {
          val = formatMiktar(val as string | number);
        }
      }
      if (field === "iscilikiMiktari") {
        val = formatIscilikGirisDegeri(val, userIscilikGirisSekli);
      }
      if (field === "iscilikTutari") {
        const n = parseDecimal(val);
        val = n > 0 ? parseFloat(n.toFixed(2)) : (val === "" || n === 0 ? "" : val);
      }
      if (field === "iscilikKdvOrani") {
        const n = parseDecimal(val);
        val = n > 0 ? parseFloat(n.toFixed(2)) : (val === "" || n === 0 ? "" : val);
      }
      if (field === "iscilikKdvTutari") {
        const n = parseDecimal(val);
        val = n > 0 ? parseFloat(n.toFixed(2)) : (val === "" || n === 0 ? "" : val);
      }
      if (field === "iscilikToplam") {
        const n = parseDecimal(val);
        val = n > 0 ? parseFloat(n.toFixed(2)) : (val === "" || n === 0 ? "" : val);
      }
      if (field === "milyem") {
        const effTipi = resolveEffectiveUrunTipi({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isPara = effTipi === 0 || isCurrencyItem({ kod: r.urunKodu, ad: r.urunAdi, urunTipi: r.urunTipi });
        if (!isPara && !isZiynet) {
          const milyemVal = parseDecimal(val);
          const refMilyem = resolveKalemRefMilyem(r);
          if (refMilyem > 0 && milyemVal > 0) {
            const res = milyemDegeriniSinirla(kYetkiRef.current, refMilyem, milyemVal, 5);
            if (res.degisti) {
              val = res.milyem;
              if (res.mesaj) {
                pendingWarnMsg = res.mesaj;
              }
            }
          } else if (refMilyem <= 0 && milyemVal > 0) {
            nextRefMilyem = milyemVal;
          }
        }
      }
      if (field === "kur") {
        const kurVal = parseDecimal(val);
        if (kurVal > 0) {
          const matchedUrun = urunList.find((item) => (r.urunId && item.id === r.urunId) || (r.urunKodu && item.kod.trim().toLowerCase() === r.urunKodu.trim().toLowerCase()));
          const u = matchedUrun || { paraId: r.urunId, id: r.urunId, kod: r.urunKodu, ad: r.urunAdi, urunTipi: r.urunTipi };
          const { alis, satis, ref } = getKurAlisSatisForProduct(u);
          const gise = (ref > 0 || alis > 0 || satis > 0) ? { kur: ref || alis || satis, alis: alis || null, satis: satis || null } : null;
          if (gise) {
            const res = kurDegeriniSinirla(kYetkiRef.current, gise, kurVal, 4);
            if (res.degisti) {
              val = res.kur;
              if (res.mesaj) {
                pendingWarnMsg = res.mesaj;
              }
            }
          }
        }
      }
      const curHasKuru = Number(altinHasKuru) || 0;
      return recomputeRow({ ...r, refMilyem: nextRefMilyem, [field]: val }, curHasKuru, field, userIscilikGirisSekli, isKdvDisabledRef.current);
    }));
    if (pendingWarnMsg) {
      const msg = pendingWarnMsg;
      setTimeout(() => showNotif("warning", msg), 0);
    }
  }, [altinHasKuru, userIscilikGirisSekli, showNotif, urunList, resolveKalemRefMilyem, getKurAlisSatisForProduct]);

  // Row update
  const updateRow = useCallback((rowId: string, field: keyof GridRow, value: any) => {
    let sanitizedValue = value;
    if (field === "adet" || field === "miktar") {
      sanitizedValue = formatMiktar(value);
    } else if (
      field === "milyem" ||
      field === "hasGram" ||
      field === "iscilikiMiktari" ||
      field === "iscilikHasGram" ||
      field === "iscilikTutari" ||
      field === "iscilikKdvOrani" ||
      field === "iscilikKdvTutari" ||
      field === "iscilikToplam" ||
      field === "kur" ||
      field === "tutar" ||
      field === "karat"
    ) {
      sanitizedValue = onlyDecimal(String(value));
    }

    // e-Banka fişinde İşçilik KDV oranı fiş düzeyindedir: bir satırda değişince bütün altın / gümüş satırlarına (M12)
    if (field === "iscilikKdvOrani" && ebModRef.current) {
      const oranYazi = String(sanitizedValue);
      const kur0 = Number(altinHasKuru) || 0;
      setLines((prev) => prev.map((r) => ebKdvSatiri(r, oranYazi, kur0, userIscilikGirisSekli, isKdvDisabledRef.current)));
      // Başlık da aynı oran: düzenlemede satır KDV'si başlıktan kurulur (M30); oran silinirse başlıkta da kalmaz
      setKdvOrani(oranYazi === "" ? "" : parseDecimal(oranYazi));
      return;
    }

    if (field === "milyem" && !milyemDegistirilebilir(kYetkiRef.current)) {
      showNotif("warning", "Milyem değiştirme yetkiniz yok.");
      return;
    }

    if (milyemTypingTimerRef.current[`kalem_${rowId}`]) {
      clearTimeout(milyemTypingTimerRef.current[`kalem_${rowId}`]);
      delete milyemTypingTimerRef.current[`kalem_${rowId}`];
    }

    let pendingWarnMsg: string | null = null;
    let shouldScheduleDebounce = false;

    const curHasKuru = Number(altinHasKuru) || 0;
    setLines((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;

      let finalFieldVal: any = sanitizedValue;
      if (field === "milyem") {
        const effTipi = resolveEffectiveUrunTipi({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isPara = effTipi === 0 || isCurrencyItem({ kod: r.urunKodu, ad: r.urunAdi, urunTipi: r.urunTipi });
        if (!isPara && !isZiynet) {
          const milyemVal = parseDecimal(sanitizedValue);
          const refMilyem = resolveKalemRefMilyem(r);
          const yetki = kYetkiRef.current;
          if (refMilyem > 0 && milyemVal > 0 && (yetki.milyemYetkisi === "Yüzde" || (yetki.milyemYetkisi as any) === "Limitli")) {
            const tolerans = Math.max(0, Number(yetki.milyemTolerans) || 0);
            const alt = Number((refMilyem * (1 - tolerans / 100)).toFixed(5));
            const ust = Number((refMilyem * (1 + tolerans / 100)).toFixed(5));
            if (shouldClampMilyemImmediately(String(sanitizedValue), milyemVal, alt, ust)) {
              const res = milyemDegeriniSinirla(yetki, refMilyem, milyemVal, 5);
              if (res.degisti) {
                finalFieldVal = res.milyem;
                if (res.mesaj) pendingWarnMsg = res.mesaj;
              }
            } else if (milyemVal < alt - 1e-9 || milyemVal > ust + 1e-9) {
              shouldScheduleDebounce = true;
            }
          }
        }
      }

      let miktar = r.miktar;
      if (field === "adet") {
        const isZiynet = r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.urunKodu, ad: r.urunAdi });
        const isPara = r.urunTipi === 0;
        const isParaOrZiynet = isPara || isZiynet;
        const numAdet = parseDecimal(finalFieldVal) || 0;
        if (isParaOrZiynet) {
          miktar = "";
        } else {
          const found = urunList.find((u) => u.kod.trim().toLowerCase() === (r.urunKodu || "").trim().toLowerCase());
          if (found && Number(found.gramaj) > 0 && numAdet > 0) {
            miktar = formatMiktar(Number(found.gramaj) * numAdet);
          }
        }
      }

      const updated = {
        ...r,
        miktar,
        [field]: finalFieldVal
      };
      return recomputeRow(updated, curHasKuru, field, userIscilikGirisSekli, isKdvDisabledRef.current);
    }));

    if (pendingWarnMsg) {
      const msg = pendingWarnMsg;
      setTimeout(() => showNotif("warning", msg), 0);
    } else if (shouldScheduleDebounce && field === "milyem") {
      milyemTypingTimerRef.current[`kalem_${rowId}`] = setTimeout(() => {
        normalizeRowOnBlur(rowId, "milyem");
      }, 650);
    }
  }, [altinHasKuru, urunList, userIscilikGirisSekli, resolveKalemRefMilyem, shouldClampMilyemImmediately, showNotif, normalizeRowOnBlur]);

  const normalizeOdemeRowOnBlur = useCallback((rowId: string, field: keyof OdemeRow) => {
    if (milyemTypingTimerRef.current[`odeme_${rowId}`]) {
      clearTimeout(milyemTypingTimerRef.current[`odeme_${rowId}`]);
      delete milyemTypingTimerRef.current[`odeme_${rowId}`];
    }
    let pendingWarnMsg: string | null = null;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      let val = r[field];
      let nextRefMilyem = r.refMilyem;
      if (typeof val === "string" && (val.startsWith(",") || val.startsWith("."))) {
        val = "0" + val;
      }
      if (field === "adet" || field === "miktar") {
        if (val !== undefined && val !== null && val !== "") {
          val = formatMiktar(val as string | number);
        }
      }
      if (field === "milyem") {
        const isPZ = isOdemeRowParaOrZiynet(r);
        if (!isPZ) {
          const milyemVal = parseDecimal(val);
          const refMilyem = resolveOdemeRefMilyem(r);
          if (refMilyem > 0 && milyemVal > 0) {
            const res = milyemDegeriniSinirla(kYetkiRef.current, refMilyem, milyemVal, 5);
            if (res.degisti) {
              val = res.milyem;
              if (res.mesaj) pendingWarnMsg = res.mesaj;
            }
          } else if (refMilyem <= 0 && milyemVal > 0) {
            nextRefMilyem = milyemVal;
          }
        }
      }
      if (field === "kur") {
        const kurVal = parseDecimal(val);
        if (kurVal > 0) {
          const matchedUrun = urunList.find((item) => (r.paraId && (item.id === r.paraId || item.paraId === r.paraId)) || (r.paraKodu && item.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase()));
          const u = matchedUrun || { paraId: r.paraId, id: r.paraId ?? undefined, kod: r.paraKodu, ad: r.paraAdi, urunTipi: r.urunTipi };
          const { alis, satis, ref } = getKurAlisSatisForProduct(u);
          const gise = (ref > 0 || alis > 0 || satis > 0) ? { kur: ref || alis || satis, alis: alis || null, satis: satis || null } : null;
          if (gise) {
            const res = kurDegeriniSinirla(kYetkiRef.current, gise, kurVal, 4);
            if (res.degisti) {
              val = res.kur;
              if (res.mesaj) pendingWarnMsg = res.mesaj;
            }
          }
        }
      }
      const curHasKuru = Number(altinHasKuru) || 0;
      return recomputeOdemeRow({ ...r, refMilyem: nextRefMilyem, [field]: val }, curHasKuru, field);
    }));
    if (pendingWarnMsg) {
      const msg = pendingWarnMsg;
      setTimeout(() => showNotif("warning", msg), 0);
    }
  }, [altinHasKuru, showNotif, urunList, resolveOdemeRefMilyem, getKurAlisSatisForProduct]);

  const updateOdemeRow = useCallback((rowId: string, field: keyof OdemeRow, value: any) => {
    setInvalidOdemeRowIds((prev) => {
      if (!prev[rowId]) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });

    let sanitizedValue = value;
    if (field === "adet" || field === "miktar") {
      sanitizedValue = formatMiktar(value);
    } else if (
      field === "milyem" ||
      field === "hasGram" ||
      field === "kur" ||
      field === "tutar"
    ) {
      sanitizedValue = onlyDecimal(String(value));
    }

    if (field === "milyem" && !milyemDegistirilebilir(kYetkiRef.current)) {
      showNotif("warning", "Milyem değiştirme yetkiniz yok.");
      return;
    }

    if (milyemTypingTimerRef.current[`odeme_${rowId}`]) {
      clearTimeout(milyemTypingTimerRef.current[`odeme_${rowId}`]);
      delete milyemTypingTimerRef.current[`odeme_${rowId}`];
    }

    let pendingWarnMsg: string | null = null;
    let shouldScheduleDebounce = false;

    const curHasKuru = Number(altinHasKuru) || 0;
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const isTL = r.paraKodu?.toUpperCase() === "TL" || r.paraKodu?.toUpperCase() === "TRY";
      const isKart = r.odemeAraciTuru === 2;
      let effectiveVal: any = sanitizedValue;
      if (field === "kur" && (isTL || isKart)) {
        effectiveVal = 1;
      }
      if (field === "milyem") {
        const isPZ = isOdemeRowParaOrZiynet(r);
        if (!isPZ) {
          const milyemVal = parseDecimal(sanitizedValue);
          const refMilyem = resolveOdemeRefMilyem(r);
          const yetki = kYetkiRef.current;
          if (refMilyem > 0 && milyemVal > 0 && (yetki.milyemYetkisi === "Yüzde" || (yetki.milyemYetkisi as any) === "Limitli")) {
            const tolerans = Math.max(0, Number(yetki.milyemTolerans) || 0);
            const alt = Number((refMilyem * (1 - tolerans / 100)).toFixed(5));
            const ust = Number((refMilyem * (1 + tolerans / 100)).toFixed(5));
            if (shouldClampMilyemImmediately(String(sanitizedValue), milyemVal, alt, ust)) {
              const res = milyemDegeriniSinirla(yetki, refMilyem, milyemVal, 5);
              if (res.degisti) {
                effectiveVal = res.milyem;
                if (res.mesaj) pendingWarnMsg = res.mesaj;
              }
            } else if (milyemVal < alt - 1e-9 || milyemVal > ust + 1e-9) {
              shouldScheduleDebounce = true;
            }
          }
        }
      }
      let miktar = r.miktar;
      if (field === "adet") {
        const isZiynet = r.urunTipi === 3 || isZiynetProduct({ urunTipi: r.urunTipi, kod: r.paraKodu, ad: r.paraAdi });
        const isPara = r.urunTipi === 0 || isTL;
        const isParaOrZiynet = isPara || isZiynet;
        const numAdet = parseDecimal(effectiveVal) || 0;
        if (isParaOrZiynet) {
          miktar = "";
        } else {
          const found = urunList.find((u) => u.kod.trim().toLowerCase() === (r.paraKodu || "").trim().toLowerCase());
          if (found && Number(found.gramaj) > 0 && numAdet > 0) {
            miktar = formatMiktar(Number(found.gramaj) * numAdet);
          } else if (numAdet > 0 && (!miktar || parseDecimal(miktar) === 0)) {
            miktar = formatMiktar(numAdet);
          }
        }
      }
      const u = { ...r, miktar, [field]: effectiveVal };
      return recomputeOdemeRow(u, curHasKuru, field);
    }));

    if (pendingWarnMsg) {
      const msg = pendingWarnMsg;
      setTimeout(() => showNotif("warning", msg), 0);
    } else if (shouldScheduleDebounce && field === "milyem") {
      milyemTypingTimerRef.current[`odeme_${rowId}`] = setTimeout(() => {
        normalizeOdemeRowOnBlur(rowId, "milyem");
      }, 650);
    }
  }, [altinHasKuru, urunList, resolveOdemeRefMilyem, shouldClampMilyemImmediately, showNotif, normalizeOdemeRowOnBlur]);

  const handleDeleteLine = useCallback((rowId: string) => {
    setInvalidRowIds((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const handleDeleteOdemeRow = useCallback((rowId: string) => {
    setInvalidOdemeRowIds((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setOdemeRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyOdemeRow(1)];
      }
      const filtered = prev.filter((r) => r.id !== rowId);
      return filtered.map((r, idx) => ({ ...r, satirNo: idx + 1 }));
    });
  }, []);

  const focusGridCell = useCallback((
    rowId: string,
    field: GridColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const el = rowInputRefs.current[`${rowId}_${field}`] || document.querySelector<HTMLInputElement>(`tr[data-row-id="${rowId}"] input`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        try {
          if (mode === "select") {
            el.select();
          } else if (mode === "start") {
            el.setSelectionRange(0, 0);
          } else if (mode === "end") {
            const len = el.value ? el.value.length : 0;
            el.setSelectionRange(len, len);
          }
        } catch { }
      }
    }
  }, []);

  const focusOdemeGridCell = useCallback((
    rowId: string,
    field: OdemeColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const doFocus = () => {
      let targetField = field;
      const row = odemeRowsRef.current?.find((r) => r.id === rowId);
      const isRowIsk = Boolean(
        row?.iskontoId ||
        (row?.odemeAraciTuru === 3 && !row?.bankaId) ||
        (row?.paraKodu && (
          row.paraKodu.trim().toUpperCase().startsWith("ISK") ||
          row.paraKodu.trim().toUpperCase().startsWith("İSK") ||
          iskontoList.some((isk) => (isk.kod || "").trim().toLowerCase() === row.paraKodu?.trim().toLowerCase())
        )) ||
        (row?.paraAdi && (row.paraAdi.toUpperCase().includes("İSKONTO") || row.paraAdi.toUpperCase().includes("ISKONTO")))
      );
      const isRowParaOrZiynet = row ? isOdemeRowParaOrZiynet(row) : true;

      // İskontoda miktar/milyem yerine adet çalışacak
      if (isRowIsk) {
        if (targetField === "miktar" || targetField === "milyem") {
          targetField = "adet";
        }
      } else if (targetField === "miktar" && isRowParaOrZiynet) {
        // Para/Döviz/Ziynet/Kart satırlarında miktar daima kapalıdır, asla miktara atma, adete at!
        targetField = "adet";
      }

      let el = odemeInputRefs.current[`${rowId}_${targetField}`];
      if (!el) {
        el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`tr[data-row-id="${rowId}"][data-table-type="odeme"] select, tr[data-row-id="${rowId}"][data-table-type="odeme"] input[name="${targetField}"], tr[data-row-id="${rowId}"][data-table-type="odeme"] input`) as any;
      }

      const isClosed = (targetEl: any) => {
        if (isRowIsk && targetField === "adet") return false;
        return Boolean(!targetEl || targetEl.disabled || targetEl.readOnly || targetEl.tabIndex === -1);
      };

      // Eğer hedeflenen hücre pasif/kapalıysa açık olan alana (adet / miktar) yönlendir
      if (!el || isClosed(el)) {
        if (isRowIsk) {
          targetField = "adet";
          el = odemeInputRefs.current[`${rowId}_adet`];
        } else if (targetField === "paraKodu") {
          const adetEl = odemeInputRefs.current[`${rowId}_adet`];
          const miktarEl = odemeInputRefs.current[`${rowId}_miktar`];
          if (isRowParaOrZiynet && adetEl && !isClosed(adetEl)) {
            targetField = "adet";
            el = adetEl;
          } else if (!isRowParaOrZiynet && miktarEl && !isClosed(miktarEl)) {
            targetField = "miktar";
            el = miktarEl;
          } else if (adetEl && !isClosed(adetEl)) {
            targetField = "adet";
            el = adetEl;
          } else if (miktarEl && !isClosed(miktarEl)) {
            targetField = "miktar";
            el = miktarEl;
          }
        } else if (targetField === "miktar") {
          const adetEl = odemeInputRefs.current[`${rowId}_adet`];
          if (adetEl && !isClosed(adetEl)) {
            targetField = "adet";
            el = adetEl;
          }
        } else if (targetField === "adet") {
          if (!isRowParaOrZiynet) {
            const miktarEl = odemeInputRefs.current[`${rowId}_miktar`];
            if (miktarEl && !isClosed(miktarEl)) {
              targetField = "miktar";
              el = miktarEl;
            }
          }
        }
      }

      if (el && !isClosed(el)) {
        el.focus();
        if (el instanceof HTMLInputElement) {
          try {
            if (mode === "select") {
              el.select();
            } else if (mode === "start") {
              el.setSelectionRange(0, 0);
            } else if (mode === "end") {
              const len = el.value ? el.value.length : 0;
              el.setSelectionRange(len, len);
            }
          } catch { }
        }
        return true;
      }
      return false;
    };

    if (!doFocus()) {
      setTimeout(doFocus, 30);
      setTimeout(doFocus, 70);
    }
  }, [iskontoList]);

  const focusNextOdemeCell = useCallback((
    rowId: string,
    currentField: OdemeColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const isClosed = (targetEl: any) =>
      Boolean(!targetEl || targetEl.disabled || targetEl.readOnly || targetEl.tabIndex === -1);

    const fromIdx = ODEME_COLS.indexOf(currentField);
    for (let i = fromIdx + 1; i < ODEME_COLS.length; i++) {
      const col = ODEME_COLS[i];
      const el = odemeInputRefs.current[`${rowId}_${col}`];
      if (el && !isClosed(el)) {
        el.focus();
        if (el instanceof HTMLInputElement) {
          try {
            if (mode === "select") el.select();
            else if (mode === "start") el.setSelectionRange(0, 0);
            else if (mode === "end") {
              const len = el.value ? el.value.length : 0;
              el.setSelectionRange(len, len);
            }
          } catch { }
        }
        return true;
      }
    }
    return false;
  }, []);

  const handleAddSarrafRow = useCallback(() => {
    if (!isCokluSatirIzinli && linesRef.current.length >= 1) {
      return false;
    }
    const currentLines = linesRef.current;
    if (currentLines.length > 0) {
      const lastRow = currentLines[currentLines.length - 1];
      if (!isSarrafRowFilled(lastRow)) {
        setActiveRowIndex(currentLines.length - 1);
        setInvalidRowIds((prev) => ({ ...prev, [lastRow.id]: true }));
        const isZiynet = lastRow.urunTipi === 3 || isZiynetProduct({ urunTipi: lastRow.urunTipi, kod: lastRow.urunKodu, ad: lastRow.urunAdi });
        const isPara = lastRow.urunTipi === 0;
        const isParaOrZiynet = isPara || isZiynet;
        if (!lastRow.urunKodu || !lastRow.urunKodu.trim()) {
          requestAnimationFrame(() => focusGridCell(lastRow.id, "urunKodu", "select"));
        } else if (!lastRow.adet || parseDecimal(lastRow.adet) <= 0) {
          requestAnimationFrame(() => focusGridCell(lastRow.id, "adet", "select"));
        } else if (!isParaOrZiynet && (!lastRow.miktar || parseDecimal(lastRow.miktar) <= 0)) {
          requestAnimationFrame(() => focusGridCell(lastRow.id, "miktar", "select"));
        } else {
          requestAnimationFrame(() => focusGridCell(lastRow.id, kurAcik ? "kur" : "iscilikiMiktari", "select"));
        }
        return false;
      }
    }
    const newRow = createEmptyRow(currentLines.length + 1);
    setLines((prev) => {
      if (prev.length > 0 && !isSarrafRowFilled(prev[prev.length - 1])) {
        return prev;
      }
      return [...prev, newRow];
    });
    setActiveRowIndex(currentLines.length);
    requestAnimationFrame(() => focusGridCell(newRow.id, "urunKodu", "select"));
    return true;
  }, [isSarrafRowFilled, focusGridCell, isCokluSatirIzinli, kurAcik]);

  const handleAddOdemeRow = useCallback((afterIndex?: number) => {
    const currentOdemeRows = odemeRowsRef.current;
    if (currentOdemeRows.length > 0) {
      const lastRow = currentOdemeRows[currentOdemeRows.length - 1];
      if (isOdemeRowEmpty(lastRow) || isOdemeRowCompletelyEmpty(lastRow)) {
        const lastIdx = currentOdemeRows.length - 1;
        setActiveOdemeRowIndex(lastIdx);
        requestAnimationFrame(() => focusOdemeGridCell(lastRow.id, "odemeAraciTuru", "select"));
        return false;
      }
    }
    const newRow = createEmptyOdemeRow(currentOdemeRows.length + 1);
    const newIdx = typeof afterIndex === "number" && afterIndex >= 0 ? afterIndex + 1 : currentOdemeRows.length;
    setOdemeRows((prev) => {
      if (prev.length > 0 && (isOdemeRowEmpty(prev[prev.length - 1]) || isOdemeRowCompletelyEmpty(prev[prev.length - 1]))) {
        return prev;
      }
      if (typeof afterIndex === "number" && afterIndex >= 0) {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, newRow);
        odemeRowsRef.current = next;
        return next;
      }
      const next = [...prev, newRow];
      odemeRowsRef.current = next;
      return next;
    });
    setActiveOdemeRowIndex(newIdx);
    setTimeout(() => {
      focusOdemeGridCell(newRow.id, "odemeAraciTuru", "select");
    }, 40);
    return true;
  }, [isOdemeRowEmpty, isOdemeRowCompletelyEmpty, focusOdemeGridCell]);

  // Sağ tık menüsü eylemleri (Kalanı Kapat, Satırı Sil & Yeni Satır Ekle - Her iki tablo için duyarlı)
  useEffect(() => {
    const handleGridKapat = (e: any) => {
      const rowId = e.detail?.rowId;
      const isOdeme = rowId && odemeRows.some((o) => o.id === rowId);
      if (isOdeme) {
        handleKapatRow(rowId);
      } else {
        const targetRow = odemeRows.find((o) => isOdemeRowCompletelyEmpty(o))
          || (odemeRows.length > 0 ? odemeRows[odemeRows.length - 1] : null);
        if (targetRow) {
          handleKapatRow(targetRow.id);
        } else {
          const newRow = createEmptyOdemeRow(odemeRows.length + 1);
          setOdemeRows((prev) => [...prev, newRow]);
          setTimeout(() => handleKapatRow(newRow.id), 50);
        }
      }
    };

    const handleGridDelete = (e: any) => {
      const rowId = e.detail?.rowId;
      const tableType = e.detail?.tableType;
      if (!rowId) return;

      if (tableType === "odeme" || odemeRows.some((o) => o.id === rowId)) {
        handleDeleteOdemeRow(rowId);
      } else {
        handleDeleteLine(rowId);
      }
    };

    const handleGridAdd = (e: any) => {
      const tableType = e.detail?.tableType;
      const rowId = e.detail?.rowId;

      if (tableType === "odeme" || (rowId && odemeRows.some((o) => o.id === rowId))) {
        handleAddOdemeRow();
      } else {
        handleAddSarrafRow();
      }
    };

    window.addEventListener("erp-grid-row-kapat", handleGridKapat);
    window.addEventListener("erp-grid-row-delete", handleGridDelete);
    window.addEventListener("erp-grid-row-add", handleGridAdd);
    return () => {
      window.removeEventListener("erp-grid-row-kapat", handleGridKapat);
      window.removeEventListener("erp-grid-row-delete", handleGridDelete);
      window.removeEventListener("erp-grid-row-add", handleGridAdd);
    };
  }, [handleDeleteLine, handleDeleteOdemeRow, handleKapatRow, odemeRows, handleAddSarrafRow, handleAddOdemeRow]);

  // Bildirimlerin belli süre sonra otomatik kaybolması
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Open product modal with eager data fetch if not empty
  const openUrunModal = useCallback(async (rowId: string, initialSearch?: string) => {
    lastModalCallerRef.current = "gridKalem";
    lastKalemModalRowIdRef.current = rowId;
    activeRowIdForUrunRef.current = rowId;
    activeOdemeRowIdForUrunRef.current = null;
    setActiveRowIdForUrun(rowId);
    setActiveOdemeRowIdForUrun(null);
    const row = lines.find((r) => r.id === rowId);
    const search = initialSearch !== undefined ? initialSearch.trim() : (row?.urunKodu || "").trim();
    setUrunSearchTerm(search);
    setShowUrunModal(true);
    if (urunList.length === 0) {
      setIsUrunLoading(true);
      try {
        const u = await SarrafFisService.getUrunler(true);
        if (u && u.length > 0) {
          setUrunList(u);
        }
      } catch (err) {
        console.error("Error fetching products on modal open:", err);
      } finally {
        setIsUrunLoading(false);
      }
    } else {
      SarrafFisService.getUrunler(true).then((fresh) => {
        if (fresh && fresh.length > 0) {
          setUrunList(fresh);
        }
      }).catch(() => { });
    }
  }, [lines, urunList]);

  const openOdemeParaIskontoModal = useCallback((rowId: string, initialSearch?: string) => {
    lastModalCallerRef.current = "gridOdeme";
    lastOdemeModalRowIdRef.current = rowId;
    setTargetOdemeRowIdForLookup(rowId);
    setOdemeLookupSearchTerm(initialSearch ? initialSearch.trim() : "");
    setShowOdemeParaIskontoModal(true);
    if (iskontoList.length === 0) {
      IskontoService.getIskontolar({ aktif: true }).then((r) => setIskontoList(r || [])).catch(() => { });
    }
    if (urunList.length === 0) {
      SarrafFisService.getUrunler(true).then((u) => { if (u?.length) setUrunList(u); }).catch(() => { });
    }
  }, [iskontoList.length, urunList.length]);

  const openOdemeUrunModal = useCallback((rowId: string, initialSearch?: string) => {
    openOdemeParaIskontoModal(rowId, initialSearch);
  }, [openOdemeParaIskontoModal]);

  const openCariModalForOdeme = useCallback((rowId: string, searchVal?: string) => {
    const row = odemeRows.find((r) => r.id === rowId);
    lastModalCallerRef.current = "gridOdeme";
    lastOdemeModalRowIdRef.current = rowId;
    setCariSearchTerm(searchVal !== undefined ? searchVal : (row?.cariKod || ""));
    setCariSearchField("kod");
    setShowCariModal(true);
    if (cariList.length === 0) {
      CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
      DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
    }
  }, [odemeRows, cariList.length]);

  const applyCariToOdemeRow = useCallback((rowId: string, item: CariKartItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    const cariName = item.ad || (item as any).unvan || "";
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 1,
        cariKartId: item.id,
        cariKod: item.kod || "",
        cariUnvan: cariName,
        aciklama: cariName,
        bankaId: null,
        posCihaziId: null,
        iskontoId: null,
        paraId: null,
        paraKodu: "",
        paraAdi: cariName,
        adet: "",
        miktar: "",
        milyem: "",
        hasGram: "",
        kur: "",
        tutar: "",
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
  }, [altinHasKuru]);

  const applyIskontoToOdemeRow = useCallback((rowId: string, item: IskontoItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    let discountAmount = 0;
    if (item.iskontoTipi === 1) {
      const oranVal = Number(item.oran) || 0;
      discountAmount = Math.round(((totalTutar * oranVal) / 100) * 100) / 100;
    } else if (item.iskontoTipi === 2) {
      const tutarVal = Number(item.tutar) || 0;
      discountAmount = totalTutar > 0 ? Math.min(totalTutar, tutarVal) : tutarVal;
    } else if (item.iskontoTipi === 3) {
      const hasVal = Number(item.hasTutar) || 0;
      const hasKur = curHasKuru > 0 ? curHasKuru : 1;
      discountAmount = Math.round(hasVal * hasKur * 100) / 100;
      if (totalTutar > 0) discountAmount = Math.min(totalTutar, discountAmount);
    } else {
      discountAmount = Number(item.tutar) || 0;
    }

    const maxCap = Number(item.maxIskontoTutari) || 0;
    if (maxCap > 0 && discountAmount > maxCap) {
      discountAmount = maxCap;
    }

    let iskKurVal: number | string = 1;
    if (item.iskontoTipi === 1) {
      iskKurVal = Number(item.oran) || 0;
    } else if (item.iskontoTipi === 2) {
      iskKurVal = Number(item.tutar) || 0;
    } else if (item.iskontoTipi === 3) {
      iskKurVal = curHasKuru > 0 ? curHasKuru : 1;
    } else if (item.oran) {
      iskKurVal = Number(item.oran) || 0;
    } else if (item.tutar) {
      iskKurVal = Number(item.tutar) || 0;
    }

    const iskKod = (item.kod || `ISK-${item.iskontoId}`).toUpperCase().trim();
    const iskAd = item.tanim ? (item.tanim.toUpperCase().includes("İSKONTO") || item.tanim.toUpperCase().includes("ISKONTO") ? item.tanim : `İSKONTO - ${item.tanim}`) : "İSKONTO";
    const finalAmount = discountAmount > 0 ? discountAmount : (item.tutar || item.oran || "");

    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const iskAdet = r.adet && parseDecimal(r.adet) > 0 ? formatMiktar(r.adet) : "1";
      const unitPrice = typeof finalAmount === "number" ? finalAmount : (parseDecimal(finalAmount) || 0);
      const totalAmount = unitPrice > 0 ? Math.round(unitPrice * parseDecimal(iskAdet) * 100) / 100 : finalAmount;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 3,
        cariKod: iskKod,
        cariUnvan: iskAd,
        iskontoId: item.iskontoId || null,
        bankaId: null,
        posCihaziId: null,
        cariKartId: null,
        paraId: null,
        paraKodu: iskKod,
        paraAdi: iskAd,
        aciklama: iskAd,
        adet: iskAdet,
        miktar: "",
        milyem: "",
        hasGram: "",
        kur: "",
        tutar: totalAmount,
        urunTipi: 0,
        birimFiyat: unitPrice > 0 ? unitPrice : undefined,
      };
      return updated;
    }));
    odemeFocusedInitialValRef.current[rowId] = iskKod;
  }, [totalTutar, altinHasKuru]);

  const applyPosToOdemeRow = useCallback((rowId: string, item: PosCihaziItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    const desc = item.ad || "KREDİ KARTI / POS";
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 2,
        posCihaziId: item.posCihaziId || null,
        bankaId: item.posCihaziId || null,
        cariKartId: null,
        cariKod: item.kod || "",
        cariUnvan: desc,
        paraAdi: desc,
        aciklama: r.aciklama || desc,
        iskontoId: null,
        paraId: r.paraId ?? null,
        paraKodu: r.paraKodu || "",
        adet: "",
        milyem: "",
        hasGram: "",
        urunTipi: r.urunTipi ?? 0,
        kur: r.kur || "",
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
    setInvalidOdemeRowIds((prev) => {
      if (!prev[rowId]) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, [altinHasKuru]);

  const applyHesapToOdemeRow = useCallback((rowId: string, item: BankaHesapItem) => {
    const curHasKuru = Number(altinHasKuru) || 0;
    const desc = item.hesapAdi ? `${item.bankaAdi ? item.bankaAdi + " - " : ""}${item.hesapAdi}` : (item.bankaAdi || "BANKA HAVALE / EFT");
    setOdemeRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated: OdemeRow = {
        ...r,
        odemeAraciTuru: 3,
        bankaId: item.bankaId || null,
        cariKartId: null,
        cariKod: item.hesapNo || "",
        cariUnvan: desc,
        paraAdi: desc,
        aciklama: r.aciklama || desc,
        iskontoId: null,
        paraId: r.paraId ?? null,
        paraKodu: r.paraKodu || "",
        adet: "",
        milyem: "",
        hasGram: "",
        urunTipi: r.urunTipi ?? 0,
        kur: r.kur || "",
      };
      return recomputeOdemeRow(updated, curHasKuru);
    }));
    setInvalidOdemeRowIds((prev) => {
      if (!prev[rowId]) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, [altinHasKuru]);

  const openOdemeLookup = useCallback(async (rowId: string, initialSearch?: string) => {
    const row = odemeRows.find((r) => r.id === rowId);
    const tur = row?.odemeAraciTuru ?? 0;
    setTargetOdemeRowIdForLookup(rowId);

    let search = "";
    if (tur === 2) {
      // POS: Arama terimi sadece POS kodu (cariKod) olmalıdır. Asla paraKodu ("TL") olmamalıdır!
      const rawPosCode = initialSearch !== undefined ? initialSearch.trim() : (row?.cariKod || "").trim();
      search = (rawPosCode.toUpperCase() === "TL" || rawPosCode.toUpperCase() === "TRY" || rawPosCode.toUpperCase() === "TRL") ? "" : rawPosCode;
    } else {
      search = initialSearch !== undefined ? initialSearch.trim() : (row?.cariKod || row?.paraKodu || "").trim();
    }
    setOdemeLookupSearchTerm(search);

    if (tur === 1 || tur === 0) { // Cari veya Vezne: Para / İskonto / Döviz seçimi
      openOdemeParaIskontoModal(rowId, search);
    } else if (tur === 2) { // POS
      if (posList.length === 0) {
        try {
          const p = await PosCihaziService.getPosCihazlari();
          if (p && p.length > 0) setPosList(p);
        } catch { }
      }
      setShowOdemePosModal(true);
    } else if (tur === 3) { // Hesap (İskonto / Banka)
      if (iskontoList.length === 0) {
        try {
          const isks = await IskontoService.getIskontolar({ aktif: true });
          if (isks && isks.length > 0) setIskontoList(isks);
        } catch { }
      }
      if (bankaList.length === 0) {
        try {
          const b = await BankaService.getBankalar({ aktif: true });
          if (b && b.length > 0) setBankaList(b);
        } catch { }
      }
      setShowOdemeHesapModal(true);
    }
  }, [odemeRows, openOdemeUrunModal, openOdemeParaIskontoModal, posList.length, bankaList.length, iskontoList.length]);

  // ─── Safe selection bounds helper (prevents DOMException on date/time/number inputs) ──
  const getSelectionBounds = (el: any): { isAtStart: boolean; isAtEnd: boolean } => {
    if (!el || !(el instanceof HTMLInputElement)) {
      return { isAtStart: true, isAtEnd: true };
    }
    try {
      const len = el.value ? el.value.length : 0;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        return {
          isAtStart: start === 0,
          isAtEnd: end === len,
        };
      }
    } catch (err) { }
    return { isAtStart: true, isAtEnd: true };
  };

  // ─── Keyboard Navigation: Header Fields ──────────────────────────────────────
  const handleHeaderKeyDown = async (
    e: React.KeyboardEvent<any>,
    field: "islem" | "tckn" | "kodu" | "ad" | "zamanTarih" | "zamanSaat" | "seriNo" | "belgeNo" | "istatistik" | "hasKuru" | "kdvOrani"
  ) => {
    if (isAnyModalOpen) return;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "islem") {
        tcknRef.current?.focus();
      } else if (field === "tckn") {
        const val = (detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo).trim();
        const prevVal = (lastFocusedVknRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          const hasCariKod = Boolean(cariKod && cariKod.trim());
          const hasUnvan = Boolean(unvan && unvan.trim() && !isAnonymousCustomerName(unvan));
          if (hasCariKod && hasUnvan) {
            istatistikRef.current?.focus();
            istatistikRef.current?.select();
          } else if (!hasCariKod) {
            cariKodRef.current?.focus();
            cariKodRef.current?.select();
          } else {
            adRef.current?.focus();
            adRef.current?.select();
          }
          return;
        }
        if (!val) {
          cariKodRef.current?.focus();
          cariKodRef.current?.select();
          return;
        }

        const { cariler, kayitsizlar, totalCount } = findMatchingCustomers("vkn", val);
        if (totalCount === 1) {
          let matchedKod = "";
          let matchedUnvan = "";
          if (cariler.length === 1) {
            const single = cariler[0];
            matchedKod = single.kod || "";
            matchedUnvan = single.ad || (single as any).unvan || "";
            handleSelectCustomer({
              type: "registered",
              id: single.id,
              kod: single.kod,
              unvan: matchedUnvan,
              vergiKimlikNo: single.vergiKimlikNo || "",
              adres: single.adres || "",
              telefon: single.telefon || "",
              raw: single,
            });
          } else if (kayitsizlar.length === 1) {
            const singleK = kayitsizlar[0];
            matchedKod = "";
            matchedUnvan = singleK.ad || singleK.unvan || "";
            handleSelectCustomer({
              type: "unregistered",
              id: null,
              kod: "",
              unvan: matchedUnvan,
              vergiKimlikNo: singleK.vergiKimlikNo || "",
              adres: singleK.adres || "",
              telefon: singleK.telefon || "",
              raw: singleK,
            });
          }
          lastFocusedVknRef.current = val;
          const hasCariKod = Boolean(matchedKod && matchedKod.trim());
          const hasUnvan = Boolean(matchedUnvan && matchedUnvan.trim() && !isAnonymousCustomerName(matchedUnvan));
          if (hasCariKod && hasUnvan) {
            istatistikRef.current?.focus();
            istatistikRef.current?.select();
          } else if (!hasCariKod) {
            cariKodRef.current?.focus();
            cariKodRef.current?.select();
          } else {
            adRef.current?.focus();
            adRef.current?.select();
          }
          return;
        }

        lastModalCallerRef.current = "vkn";
        setCariSearchTerm(val);
        setCariSearchField("vkn");
        setShowCariModal(true);
      } else if (field === "kodu") {
        const val = (cariKod || "").trim();
        const prevVal = (lastFocusedCariKodRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          const hasUnvan = Boolean(unvan && unvan.trim() && !isAnonymousCustomerName(unvan));
          if (hasUnvan) {
            istatistikRef.current?.focus();
            istatistikRef.current?.select();
          } else {
            adRef.current?.focus();
            adRef.current?.select();
          }
          return;
        }
        if (!val) {
          adRef.current?.focus();
          adRef.current?.select();
          return;
        }
        const { cariler, totalCount } = findMatchingCustomers("kod", val);
        if (totalCount === 1 && cariler.length === 1) {
          const single = cariler[0];
          const singleUnvan = single.ad || (single as any).unvan || "";
          handleSelectCustomer({
            type: "registered",
            id: single.id,
            kod: single.kod,
            unvan: singleUnvan,
            vergiKimlikNo: single.vergiKimlikNo || "",
            adres: single.adres || "",
            telefon: single.telefon || "",
            raw: single,
          });
          lastFocusedCariKodRef.current = single.kod || "";
          const hasUnvan = Boolean(singleUnvan && singleUnvan.trim() && !isAnonymousCustomerName(singleUnvan));
          if (hasUnvan) {
            istatistikRef.current?.focus();
            istatistikRef.current?.select();
          } else {
            adRef.current?.focus();
            adRef.current?.select();
          }
          return;
        }
        lastModalCallerRef.current = "cariKod";
        setCariSearchTerm(val);
        setCariSearchField("kod");
        setShowCariModal(true);
      } else if (field === "ad") {
        const raw = (unvan || "").trim();
        if (isAnonymousCustomerName(raw)) {
          istatistikRef.current?.focus();
          istatistikRef.current?.select();
          return;
        }
        const val = raw;
        const prevVal = (lastFocusedUnvanRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          istatistikRef.current?.focus();
          istatistikRef.current?.select();
          return;
        }
        const { cariler, kayitsizlar, totalCount } = findMatchingCustomers("unvan", val);
        if (totalCount === 1) {
          if (cariler.length === 1) {
            const single = cariler[0];
            handleSelectCustomer({
              type: "registered",
              id: single.id,
              kod: single.kod,
              unvan: single.ad || (single as any).unvan || "",
              vergiKimlikNo: single.vergiKimlikNo || "",
              adres: single.adres || "",
              telefon: single.telefon || "",
              raw: single,
            });
          } else if (kayitsizlar.length === 1) {
            const singleK = kayitsizlar[0];
            handleSelectCustomer({
              type: "unregistered",
              id: null,
              kod: "",
              unvan: singleK.ad || singleK.unvan || "",
              vergiKimlikNo: singleK.vergiKimlikNo || "",
              adres: singleK.adres || "",
              telefon: singleK.telefon || "",
              raw: singleK,
            });
          }
          istatistikRef.current?.focus();
          istatistikRef.current?.select();
          return;
        }
        lastModalCallerRef.current = "unvan";
        setCariSearchTerm(val);
        setCariSearchField("unvan");
        setShowCariModal(true);
      } else if (field === "seriNo") {
        istatistikRef.current?.focus();
        istatistikRef.current?.select();
      } else if (field === "belgeNo") {
        istatistikRef.current?.focus();
        istatistikRef.current?.select();
      } else if (field === "istatistik") {
        const val = (istatistikKodu || "").trim();
        const prevVal = (lastFocusedIstatistikKodRef.current || "").trim();
        if (val && val.toLowerCase() === prevVal.toLowerCase()) {
          hasKuruRef.current?.focus();
          hasKuruRef.current?.select();
          return;
        }
        if (!val) {
          hasKuruRef.current?.focus();
          hasKuruRef.current?.select();
          return;
        }
        const q = val.toLowerCase();
        const matched = statisticList.filter((s) => {
          const fType = Number(s.fisTipi);
          const typeMatch = tip === 0 ? (fType === 0 || fType === 2) : (fType === 1 || fType === 2);
          return typeMatch && ((s.kod || "").toLowerCase().includes(q) || (s.aciklama || "").toLowerCase().includes(q));
        });
        if (matched.length === 1) {
          const single = matched[0];
          setIstatistikId(single.id);
          setIstatistikKodu(single.kod);
          setSelectedStatistic(single);
          const dizayn = single.fisDizaynTipi !== undefined && single.fisDizaynTipi !== null ? Number(single.fisDizaynTipi) : 0;
          setIstatistikFisDizaynTipi(dizayn);
          lastFocusedIstatistikKodRef.current = single.kod;
          hasKuruRef.current?.focus();
          hasKuruRef.current?.select();
          return;
        }
        lastModalCallerRef.current = "istatistik";
        setIstatistikSearchTerm(val);
        setShowIstatistikModal(true);
      } else if (field === "hasKuru") {
        const kurVal = parseDecimal(altinHasKuru);
        if (kurVal > 0) {
          const { alis, satis } = getHasKurAlisSatis();
          const ref = tip === 0 ? alis : satis;
          const gise = (ref > 0 || alis > 0 || satis > 0) ? { kur: ref || alis || satis, alis: alis || null, satis: satis || null } : null;
          if (gise) {
            const res = kurDegeriniSinirla(kYetkiRef.current, gise, kurVal, 2);
            if (res.degisti) {
              handleAltinHasKuruChange(String(res.kur));
              if (res.mesaj) showNotif("warning", res.mesaj);
            }
          }
        }
        if (!isKdvDisabled) {
          kdvKoduRef.current?.focus();
          kdvKoduRef.current?.select();
        } else if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (field === "islem" || field === "tckn") seriNoRef.current?.focus();
      else if (field === "kodu") belgeNoRef.current?.focus();
      else if (field === "ad") istatistikRef.current?.focus();
      else if (["seriNo", "belgeNo", "istatistik", "hasKuru"].includes(field)) {
        if (lines.length > 0) {
          setActiveRowIndex(0);
          focusGridCell(lines[0].id, "urunKodu", "select");
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (field === "seriNo" || field === "belgeNo") cariKodRef.current?.focus();
      else if (field === "istatistik" || field === "hasKuru") adRef.current?.focus();
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (field === "islem") tcknRef.current?.focus();
        else if (field === "tckn") cariKodRef.current?.focus();
        else if (field === "kodu") adRef.current?.focus();
        else if (field === "ad") istatistikRef.current?.focus();
        else if (field === "seriNo") belgeNoRef.current?.focus();
        else if (field === "belgeNo") istatistikRef.current?.focus();
        else if (field === "istatistik") hasKuruRef.current?.focus();
        else if (field === "hasKuru") {
          if (!isKdvDisabled) {
            kdvKoduRef.current?.focus();
            kdvKoduRef.current?.select();
          } else if (lines.length > 0) {
            setActiveRowIndex(0);
            focusGridCell(lines[0].id, "urunKodu", "select");
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (field === "tckn") islemRef.current?.focus();
        else if (field === "kodu") tcknRef.current?.focus();
        else if (field === "ad") cariKodRef.current?.focus();
        else if (field === "seriNo") adRef.current?.focus();
        else if (field === "belgeNo") seriNoRef.current?.focus();
        else if (field === "istatistik") belgeNoRef.current?.focus();
        else if (field === "hasKuru") istatistikRef.current?.focus();
      }
    }
  };

  // ─── Keyboard Navigation: Grid ───────────────────────────────────────────────
  const handleGridKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: GridColKey,
    rowId: string
  ) => {
    if (isAnyModalOpen) return;
    const colIdx = GRID_COLS.indexOf(colKey);
    const totalCols = GRID_COLS.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (rowIndex > 0) {
        const prevRow = lines[rowIndex - 1];
        const prevVal = prevRow[colKey as keyof GridRow];
        updateRow(rowId, colKey as keyof GridRow, prevVal !== undefined && prevVal !== null ? prevVal : "");
        requestAnimationFrame(() => focusGridCell(rowId, colKey, "select"));
      }
      return;
    }

    const isColPassive = (col: GridColKey, rIdx: number = rowIndex) => {
      if (col !== "urunKodu" && col in colVisibility && !colVisibility[col as keyof typeof colVisibility]) return true;
      if (col === "urunAdi" || col === "hasGram" || col === "tlTutar" || col === "iscilikHasGram" || col === "tutar") return true;
      const isKurAllowed = kurDegistirilebilir(kYetkiRef.current);
      if (col === "kur" && !isKurAllowed) return true;
      if (col === "milyem" && !milyemAcik) return true;
      const currentRow = lines[rIdx];
      const effTipi = currentRow ? resolveEffectiveUrunTipi({ urunTipi: currentRow.urunTipi, kod: currentRow.urunKodu, ad: currentRow.urunAdi }) : 1;
      const isPara = effTipi === 0 && Boolean(currentRow && currentRow.urunKodu && currentRow.urunKodu.trim());
      const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: currentRow?.urunTipi, kod: currentRow?.urunKodu, ad: currentRow?.urunAdi });
      const isParaOrZiynet = isPara || isZiynet;
      if (isParaOrZiynet && (col === "miktar" || col === "milyem" || col === "iscilikHesaplamaSekli" || col === "iscilikiMiktari" || col === "iscilikTutari" || col === "iscilikKdvOrani" || col === "iscilikKdvTutari" || col === "iscilikToplam")) {
        return true;
      }
      if ((col === "iscilikKdvOrani" || col === "iscilikKdvTutari") && isKdvDisabled) {
        return true;
      }
      return false;
    };

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      if (colKey === "milyem") {
        normalizeRowOnBlur(rowId, "milyem");
      }
      if (colKey === "iscilikiMiktari") {
        normalizeRowOnBlur(rowId, "iscilikiMiktari");
      }
      if (colKey === "iscilikTutari") {
        normalizeRowOnBlur(rowId, "iscilikTutari");
      }
      if (colKey === "iscilikKdvOrani") {
        normalizeRowOnBlur(rowId, "iscilikKdvOrani");
      }
      if (colKey === "iscilikKdvTutari") {
        normalizeRowOnBlur(rowId, "iscilikKdvTutari");
      }
      if (colKey === "iscilikToplam") {
        normalizeRowOnBlur(rowId, "iscilikToplam");
      }
      if (colKey === "kur") {
        normalizeRowOnBlur(rowId, "kur");
      }
      // On urunKodu, try to resolve product or open lookup with typed text
      if (colKey === "urunKodu") {
        const row = lines[rowIndex];
        const val = (row.urunKodu || "").trim();
        const kUpper = val.toUpperCase();
        if (kUpper === "TL" || kUpper === "TRY") {
          showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
          updateRow(rowId, "urunKodu", "");
          return;
        }
        if (!val) {
          // Boş ise dürbün açılmaz, bir sonraki alana geçilir
          let nextIdx = colIdx + 1;
          while (nextIdx < totalCols && isColPassive(GRID_COLS[nextIdx])) {
            nextIdx++;
          }
          if (nextIdx < totalCols) {
            focusGridCell(rowId, GRID_COLS[nextIdx], "select");
          }
          return;
        }
        const matches = urunList.filter((u) => {
          const t = val.toLowerCase();
          return (
            (u.kod || "").toLowerCase().includes(t) ||
            (u.ad || "").toLowerCase().includes(t) ||
            ((u as any).barkod || "").toLowerCase().includes(t) ||
            ((u as any).model || "").toLowerCase().includes(t) ||
            ((u as any).ayar || "").toLowerCase().includes(t) ||
            ((u as any).grupKodu || "").toLowerCase().includes(t) ||
            ((u as any).aciklama || "").toLowerCase().includes(t) ||
            ((u as any).mamulTipi || "").toLowerCase().includes(t)
          );
        });
        if (matches.length === 1) {
          lastModalCallerRef.current = null;
          lastKalemModalRowIdRef.current = null;
          applyProductToRow(rowId, matches[0]);
          requestAnimationFrame(() => focusGridCell(rowId, "adet", "select"));
          return;
        } else {
          lastModalCallerRef.current = "gridKalem";
          lastKalemModalRowIdRef.current = rowId;
          openUrunModal(rowId, val);
          return;
        }
      }

      // Adet alanında Enter / Tab: Döviz veya Ziynet ise kur yetkisine göre yönlendir
      if (colKey === "adet") {
        const row = lines[rowIndex];
        const effTipi = row ? resolveEffectiveUrunTipi({ urunTipi: row.urunTipi, kod: row.urunKodu, ad: row.urunAdi }) : 1;
        const isPara = effTipi === 0 && Boolean(row && row.urunKodu && row.urunKodu.trim());
        const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: row?.urunTipi, kod: row?.urunKodu, ad: row?.urunAdi });
        const isParaOrZiynet = isPara || isZiynet;

        if (isParaOrZiynet) {
          const kurYetkisiVar = kurDegistirilebilir(kYetkiRef.current);
          if (kurYetkisiVar && colVisibility.kur !== false) {
            focusGridCell(rowId, "kur", "select");
            return;
          } else {
            // Kur yetkisi yoksa doğrudan yeni satıra geç / satır ekle
            if (rowIndex < lines.length - 1) {
              const nr = lines[rowIndex + 1];
              setActiveRowIndex(rowIndex + 1);
              focusGridCell(nr.id, "urunKodu", "select");
            } else {
              handleAddSarrafRow();
            }
            return;
          }
        }
      }

      // Next column in same row (skipping readonly/disabled fields including tutar)
      let nextIdx = colIdx + 1;
      while (nextIdx < totalCols && isColPassive(GRID_COLS[nextIdx])) {
        nextIdx++;
      }

      if (nextIdx < totalCols) {
        const nk = GRID_COLS[nextIdx];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> eğer boş satırdaysa satırı kapat ve Ödeme Tablosuna geç
        const isCurrentEmpty = isSarrafRowCompletelyEmpty(lines[rowIndex]);
        if (isCurrentEmpty) {
          if (lines.length > 1) {
            setLines((prev) => prev.filter((r) => r.id !== rowId).map((r, i) => ({ ...r, satirNo: i + 1 })));
          }
          setActiveOdemeRowIndex(0);
          const firstOdeme = odemeRows[0];
          if (firstOdeme) {
            requestAnimationFrame(() => {
              focusOdemeGridCell(firstOdeme.id, "odemeAraciTuru", "select");
            });
            setTimeout(() => {
              focusOdemeGridCell(firstOdeme.id, "odemeAraciTuru", "select");
            }, 30);
          }
          return;
        }

        if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "select");
        } else {
          handleAddSarrafRow();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colKey === "iscilikiMiktari") {
        normalizeRowOnBlur(rowId, "iscilikiMiktari");
      }
      if (colKey === "iscilikTutari") {
        normalizeRowOnBlur(rowId, "iscilikTutari");
      }
      if (colKey === "iscilikKdvOrani") {
        normalizeRowOnBlur(rowId, "iscilikKdvOrani");
      }
      if (colKey === "iscilikKdvTutari") {
        normalizeRowOnBlur(rowId, "iscilikKdvTutari");
      }
      if (colKey === "kur") {
        normalizeRowOnBlur(rowId, "kur");
      }
      let prevIdx = colIdx - 1;
      while (prevIdx >= 0 && isColPassive(GRID_COLS[prevIdx])) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        const pk = GRID_COLS[prevIdx];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        let prevRowLastCol: GridColKey = "kur";
        for (let i = totalCols - 1; i >= 0; i--) {
          if (!isColPassive(GRID_COLS[i], rowIndex - 1)) {
            prevRowLastCol = GRID_COLS[i];
            break;
          }
        }
        focusGridCell(pr.id, prevRowLastCol, "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (colKey === "iscilikiMiktari") {
        normalizeRowOnBlur(rowId, "iscilikiMiktari");
      }
      if (colKey === "iscilikTutari") {
        normalizeRowOnBlur(rowId, "iscilikTutari");
      }
      if (colKey === "iscilikKdvOrani") {
        normalizeRowOnBlur(rowId, "iscilikKdvOrani");
      }
      if (colKey === "iscilikKdvTutari") {
        normalizeRowOnBlur(rowId, "iscilikKdvTutari");
      }
      if (colKey === "kur") {
        normalizeRowOnBlur(rowId, "kur");
      }
      if (rowIndex < lines.length - 1) {
        const nr = lines[rowIndex + 1];
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      } else {
        handleAddSarrafRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (colKey === "iscilikiMiktari") {
        normalizeRowOnBlur(rowId, "iscilikiMiktari");
      }
      if (colKey === "iscilikTutari") {
        normalizeRowOnBlur(rowId, "iscilikTutari");
      }
      if (colKey === "iscilikKdvOrani") {
        normalizeRowOnBlur(rowId, "iscilikKdvOrani");
      }
      if (colKey === "iscilikKdvTutari") {
        normalizeRowOnBlur(rowId, "iscilikKdvTutari");
      }
      if (colKey === "kur") {
        normalizeRowOnBlur(rowId, "kur");
      }
      if (rowIndex > 0) {
        const pr = lines[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, colKey, "select");
      } else {
        // Jump back to header
        if (colIdx < 4) adRef.current?.focus();
        else belgeNoRef.current?.focus();
      }
    } else if (e.key === "ArrowRight") {
      const isPassive = isColPassive(colKey);
      if (isPassive || isAtEnd) {
        e.preventDefault();
        if (colKey === "iscilikiMiktari") {
          normalizeRowOnBlur(rowId, "iscilikiMiktari");
        }
        if (colKey === "iscilikTutari") {
          normalizeRowOnBlur(rowId, "iscilikTutari");
        }
        if (colKey === "kur") {
          normalizeRowOnBlur(rowId, "kur");
        }
        let nextIdx = colIdx + 1;
        while (nextIdx < totalCols && isColPassive(GRID_COLS[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < totalCols) {
          const nk = GRID_COLS[nextIdx];
          focusGridCell(rowId, nk, "start");
        } else if (rowIndex < lines.length - 1) {
          const nr = lines[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "urunKodu", "start");
        } else {
          handleAddSarrafRow();
        }
      }
    } else if (e.key === "ArrowLeft") {
      const isPassive = isColPassive(colKey);
      if (isPassive || isAtStart) {
        e.preventDefault();
        let prevIdx = colIdx - 1;
        while (prevIdx >= 0 && isColPassive(GRID_COLS[prevIdx])) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          const pk = GRID_COLS[prevIdx];
          focusGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = lines[rowIndex - 1];
          setActiveRowIndex(rowIndex - 1);
          let prevRowLastCol: GridColKey = "kur";
          for (let i = totalCols - 1; i >= 0; i--) {
            if (!isColPassive(GRID_COLS[i], rowIndex - 1)) {
              prevRowLastCol = GRID_COLS[i];
              break;
            }
          }
          focusGridCell(pr.id, prevRowLastCol, "end");
        }
      }
    }
  }, [lines, urunList, updateRow, altinHasKuru, applyProductToRow, openUrunModal, handleAddSarrafRow, isAnyModalOpen, kurAcik, milyemAcik, normalizeRowOnBlur]);

  const handleOdemeGridKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: OdemeColKey,
    rowId: string
  ) => {
    if (isAnyModalOpen) return;
    const colIdx = ODEME_COLS.indexOf(colKey);
    const totalCols = ODEME_COLS.length;
    // ESC altındaki " tuşuna basınca üst satırdaki hücre değerini kopyala (Sadece tablolarda geçerli)
    if (e.key === '"' || e.key === '“' || e.key === '”' || e.key === '„' || e.key === '«' || e.key === '»' || e.key === 'é' || e.key === 'É' || e.key === '`' || e.key === '´' || e.key === '§' || e.code === "Backquote" || (e.code === "Digit2" && e.shiftKey) || e.keyCode === 222 || e.keyCode === 192) {
      e.preventDefault();
      e.stopPropagation();
      if (rowIndex > 0) {
        const prevRow = odemeRows[rowIndex - 1];
        const prevVal = prevRow[colKey as keyof OdemeRow];
        updateOdemeRow(rowId, colKey as keyof OdemeRow, prevVal !== undefined && prevVal !== null ? prevVal : "");
        requestAnimationFrame(() => focusOdemeGridCell(rowId, colKey, "select"));
      }
      return;
    }

    const isOdemeColPassive = (col: OdemeColKey, rIdx: number = rowIndex) => {
      if (col === "hasGram" || col === "tutar") return true;
      if (col === "milyem" && !milyemAcik) return true;
      const currentRow = odemeRows[rIdx];
      if (!currentRow) return true;
      const tur = currentRow.odemeAraciTuru ?? 0;
      if (col === "cariKod" && tur === 0) {
        return true;
      }
      if (col === "paraAdi") return true;

      const isIsk = Boolean(
        currentRow.iskontoId ||
        (tur === 3 && !currentRow.bankaId) ||
        (currentRow.paraKodu && (
          currentRow.paraKodu.trim().toUpperCase().startsWith("ISK") ||
          currentRow.paraKodu.trim().toUpperCase().startsWith("İSK") ||
          iskontoList.some((isk) => (isk.kod || "").trim().toLowerCase() === currentRow.paraKodu?.trim().toLowerCase())
        )) ||
        (currentRow.paraAdi && (currentRow.paraAdi.toUpperCase().includes("İSKONTO") || currentRow.paraAdi.toUpperCase().includes("ISKONTO")))
      );
      if (isIsk) {
        if (col === "miktar" || col === "milyem" || col === "kur") return true;
        if (col === "adet") return false;
      }

      const isParaOrZiynet = isOdemeRowParaOrZiynet(currentRow);

      if (col === "kur") {
        const isOdemeTL = !isIsk && ((currentRow.paraKodu || "").trim().toUpperCase() === "TL" || (currentRow.paraKodu || "").trim().toUpperCase() === "TRY" || (currentRow.paraKodu || "").trim().toUpperCase() === "TRL" || (!currentRow.paraKodu && (tur === 0 || tur === 2)));
        const isOdemeKurDisabled = !kurAcik || isOdemeTL || tur === 2 || tur === 3 || isIsk;
        return isOdemeKurDisabled;
      }

      // Altın / Gümüş (metal) satırlarında sadece adet pasiftir, miktar (gramaj) aktiftir
      const isRowAltinOrGumus = !isIsk && !isParaOrZiynet;
      if (col === "adet") {
        if (isRowAltinOrGumus) return true;
        return false;
      }

      // Para veya Ziynet satırlarında (TL, Döviz, Ziynet, Kart) adet çalışır, miktar ve milyem pasiftir
      if (isParaOrZiynet) {
        if (col === "miktar" || col === "milyem") return true;
        return false;
      }

      if (isRowAltinOrGumus && col === "miktar") return false;

      return false;
    };

    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      if (colKey === "milyem") {
        normalizeOdemeRowOnBlur(rowId, "milyem");
      }
      if (colKey === "odemeAraciTuru") {
        const row = odemeRows[rowIndex];
        const tur = row?.odemeAraciTuru ?? 0;
        if (tur === 1 || tur === 2 || tur === 3) {
          focusOdemeGridCell(rowId, "cariKod", "select");
        } else {
          focusOdemeGridCell(rowId, "paraKodu", "select");
        }
        return;
      }

      if (colKey === "cariKod") {
        const row = odemeRows[rowIndex];
        const val = (row.cariKod || "").trim();
        const tur = row.odemeAraciTuru ?? 0;

        if (tur === 1) { // CARI
          if (!val) {
            focusNextOdemeCell(rowId, "cariKod");
            return;
          }
          if (row.cariKartId && row.cariKod && row.cariKod.trim().toLowerCase() === val.toLowerCase()) {
            focusNextOdemeCell(rowId, "cariKod");
            return;
          }
          const exactMatch = cariList.find((c) => (c.kod || "").trim().toLowerCase() === val.toLowerCase());
          if (exactMatch) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyCariToOdemeRow(rowId, exactMatch);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          }
          const matches = cariList.filter((c) =>
            (c.kod || "").toLowerCase().includes(val.toLowerCase())
          );
          if (matches.length === 1) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyCariToOdemeRow(rowId, matches[0]);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openCariModalForOdeme(rowId, val);
            return;
          }
        } else if (tur === 2) { // POS
          const rawPos = (val || "").trim();
          const cleanPos = (rawPos.toUpperCase() === "TL" || rawPos.toUpperCase() === "TRY" || rawPos.toUpperCase() === "TRL") ? "" : rawPos;
          if (!cleanPos) {
            focusNextOdemeCell(rowId, "cariKod");
            return;
          }
          if (row.posCihaziId && row.cariKod && row.cariKod.trim().toLowerCase() === cleanPos.toLowerCase()) {
            focusNextOdemeCell(rowId, "cariKod");
            return;
          }
          const exactMatch = posList.find((p) => (p.kod || "").trim().toLowerCase() === cleanPos.toLowerCase());
          if (exactMatch) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyPosToOdemeRow(rowId, exactMatch);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          }
          const matches = posList.filter((p) =>
            (p.kod || "").toLowerCase().includes(cleanPos.toLowerCase()) ||
            (p.ad || "").toLowerCase().includes(cleanPos.toLowerCase())
          );
          if (matches.length === 1) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyPosToOdemeRow(rowId, matches[0]);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openOdemeLookup(rowId, cleanPos);
            return;
          }
        } else if (tur === 3) { // HESAP (İskonto / Banka)
          if (!val) {
            focusNextOdemeCell(rowId, "cariKod");
            return;
          }
          if ((row.iskontoId || row.bankaId) && row.cariKod && row.cariKod.trim().toLowerCase() === val.toLowerCase()) {
            focusNextOdemeCell(rowId, "cariKod");
            return;
          }

          // 1. İskonto hesaplarında ara
          const exactIsk = (iskontoList || []).find((isk) =>
            (isk.kod && isk.kod.trim().toLowerCase() === val.toLowerCase()) ||
            (isk.tanim && isk.tanim.trim().toLowerCase() === val.toLowerCase())
          );
          if (exactIsk) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyIskontoToOdemeRow(rowId, exactIsk);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          }
          const iskMatches = (iskontoList || []).filter((isk) =>
            (isk.kod && isk.kod.toLowerCase().includes(val.toLowerCase())) ||
            (isk.tanim && isk.tanim.toLowerCase().includes(val.toLowerCase()))
          );
          if (iskMatches.length === 1) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyIskontoToOdemeRow(rowId, iskMatches[0]);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          }

          // 2. Varsa banka hesaplarında ara
          const exactBanka = (bankaList || []).find((b) => (b.hesapNo || "").trim().toLowerCase() === val.toLowerCase());
          if (exactBanka) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyHesapToOdemeRow(rowId, exactBanka);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          }
          const bankaMatches = (bankaList || []).filter((b) =>
            (b.hesapNo || "").toLowerCase().includes(val.toLowerCase()) ||
            (b.iban || "").toLowerCase().includes(val.toLowerCase()) ||
            (b.hesapAdi || "").toLowerCase().includes(val.toLowerCase())
          );
          if (bankaMatches.length === 1 && iskMatches.length === 0) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyHesapToOdemeRow(rowId, bankaMatches[0]);
            setTimeout(() => focusNextOdemeCell(rowId, "cariKod"), 30);
            return;
          } else {
            lastModalCallerRef.current = "gridOdeme";
            lastOdemeModalRowIdRef.current = rowId;
            openOdemeLookup(rowId, val);
            return;
          }
        }
      }

      if (colKey === "paraAdi") {
        focusNextOdemeCell(rowId, "paraAdi");
        return;
      }

      if (colKey === "paraKodu") {
        const row = odemeRows[rowIndex];
        const rawInput = (e.currentTarget as HTMLInputElement)?.value ?? "";
        const inputVal = rawInput.trim();
        const initialVal = (odemeFocusedInitialValRef.current[rowId] ?? "").trim();
        const currentCode = (row.paraKodu || "").trim();
        const currentName = (row.paraAdi || "").trim();

        const norm = (s: string) =>
          (s || "")
            .replace(/İ/g, "i")
            .replace(/I/g, "ı")
            .replace(/ı/g, "i")
            .toLowerCase()
            .trim();

        const normInput = norm(inputVal);
        const normInitial = norm(initialVal);
        const normCode = norm(currentCode);
        const normName = norm(currentName);

        const isPos = row.odemeAraciTuru === 2;
        if (isPos) {
          requestAnimationFrame(() => focusOdemeGridCell(rowId, "adet", "select"));
          return;
        }

        // 1. "dolu ise direk geçecek":
        // Hücre zaten geçerli bir para/iskonto ile seçilmişse ve kullanıcı hücre içindeki değeri DEĞİŞTİRMEDİYSE:
        const hasAssignedItem = Boolean(row.paraId || row.iskontoId || (normCode === "tl" && normName.includes("türk")));
        const isUntouched = hasAssignedItem && (normInput === normInitial || normInput === normCode || normInput === normName);

        if (isUntouched) {
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          setTimeout(() => focusOdemeGridCell(rowId, "adet", "select"), 30);
          return;
        }

        // 2. Eğer hiçbir şey yazılmadan Enter'a basıldıysa (boş hücrede Enter):
        if (!inputVal) {
          if (row.odemeAraciTuru === 0) {
            // Vezne satırı: varsayılan TL yap ve adete geç
            setOdemeRows((prev) => prev.map((r) => {
              if (r.id !== rowId) return r;
              return {
                ...r,
                paraId: null,
                iskontoId: null,
                paraKodu: "TL",
                paraAdi: "TÜRK LİRASI",
                aciklama: r.aciklama || "TÜRK LİRASI",
                adet: "",
                kur: 1,
                milyem: "",
                hasGram: "",
                urunTipi: 0,
              };
            }));
            odemeFocusedInitialValRef.current[rowId] = "TL";
            requestAnimationFrame(() => focusOdemeGridCell(rowId, "adet", "select"));
            return;
          } else {
            focusOdemeGridCell(rowId, "adet", "select");
            return;
          }
        }

        // 3. Kullanıcı metin yazdı veya var olanı değiştirdi ("doluyu değişirsem arayacak"):
        // A) TL / TRY yazıldıysa doğrudan TL uygula
        if (normInput === "tl" || normInput === "try" || normInput === "trl") {
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          setOdemeRows((prev) => prev.map((r) => {
            if (r.id !== rowId) return r;
            return {
              ...r,
              paraId: null,
              iskontoId: null,
              paraKodu: "TL",
              paraAdi: "TÜRK LİRASI",
              aciklama: r.aciklama || "TÜRK LİRASI",
              adet: "",
              kur: 1,
              milyem: "",
              hasGram: "",
              urunTipi: 0,
            };
          }));
          odemeFocusedInitialValRef.current[rowId] = "TL";
          requestAnimationFrame(() => focusOdemeGridCell(rowId, "adet", "select"));
          return;
        }

        // B) Tek bir tam kod eşleşmesi var mı kontrol et (Örn: "USD", "EUR" gibi ürün/kur kodu)
        const exactProd = urunList.find((u) => norm(u.kod || "") === normInput);
        if (exactProd) {
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          applyProductToOdemeRow(rowId, exactProd);
          odemeFocusedInitialValRef.current[rowId] = exactProd.kod || "";
          const isPZ = isOdemeRowParaOrZiynet(exactProd);
          requestAnimationFrame(() => focusOdemeGridCell(rowId, isPZ ? "adet" : "miktar", "select"));
          return;
        }

        // C) Tek bir tam iskonto kodu eşleşmesi var mı? (Sadece Hesap seçili iken iskonto eşleşir, Cari/POS/Vezne'de asla iskonto eşleşmez)
        if (row?.odemeAraciTuru === 3) {
          const exactIsk = (iskontoList || []).find((isk) => {
            const iskKod = norm(isk.kod || "");
            const iskSynth = `isk-${isk.iskontoId}`.toLowerCase();
            return iskKod === normInput || iskSynth === normInput;
          });
          if (exactIsk) {
            lastModalCallerRef.current = null;
            lastOdemeModalRowIdRef.current = null;
            applyIskontoToOdemeRow(rowId, exactIsk);
            odemeFocusedInitialValRef.current[rowId] = exactIsk.kod || `ISK-${exactIsk.iskontoId}`;
            setTimeout(() => focusOdemeGridCell(rowId, "adet", "select"), 30);
            return;
          }
        }

        // D) Diğer TÜM durumlarda (örn. "isk", "dolar", "yüzde", parçalı kodlar vb.):
        // Modalı yazılan arama kelimesiyle aç!
        lastModalCallerRef.current = "gridOdeme";
        lastOdemeModalRowIdRef.current = rowId;
        openOdemeParaIskontoModal(rowId, inputVal);
        return;
      }

      if (colKey === "adet") {
        normalizeOdemeRowOnBlur(rowId, "adet");
        const moved = focusNextOdemeCell(rowId, "adet");
        if (!moved) {
          if (rowIndex < odemeRows.length - 1) {
            const nr = odemeRows[rowIndex + 1];
            setActiveOdemeRowIndex(rowIndex + 1);
            focusOdemeGridCell(nr.id, "odemeAraciTuru", "select");
          } else {
            handleAddOdemeRow();
          }
        }
        return;
      }

      if (colKey === "miktar") {
        normalizeOdemeRowOnBlur(rowId, "miktar");
        const moved = focusNextOdemeCell(rowId, "miktar");
        if (!moved) {
          if (rowIndex < odemeRows.length - 1) {
            const nr = odemeRows[rowIndex + 1];
            setActiveOdemeRowIndex(rowIndex + 1);
            focusOdemeGridCell(nr.id, "odemeAraciTuru", "select");
          } else {
            handleAddOdemeRow();
          }
        }
        return;
      }

      if (colKey === "milyem") {
        normalizeOdemeRowOnBlur(rowId, "milyem");
        const moved = focusNextOdemeCell(rowId, "milyem");
        if (!moved) {
          if (rowIndex < odemeRows.length - 1) {
            const nr = odemeRows[rowIndex + 1];
            setActiveOdemeRowIndex(rowIndex + 1);
            focusOdemeGridCell(nr.id, "odemeAraciTuru", "select");
          } else {
            handleAddOdemeRow();
          }
        }
        return;
      }

      if (colKey === "kur") {
        normalizeOdemeRowOnBlur(rowId, "kur");
        const moved = focusNextOdemeCell(rowId, "kur");
        if (!moved) {
          if (rowIndex < odemeRows.length - 1) {
            const nr = odemeRows[rowIndex + 1];
            setActiveOdemeRowIndex(rowIndex + 1);
            focusOdemeGridCell(nr.id, "odemeAraciTuru", "select");
          } else {
            handleAddOdemeRow();
          }
        }
        return;
      }

      // Next column in same row (skipping readonly fields)
      const moved = focusNextOdemeCell(rowId, colKey);
      if (!moved) {
        if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          focusOdemeGridCell(nr.id, "odemeAraciTuru", "select");
        } else {
          handleAddOdemeRow();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      let prevIdx = colIdx - 1;
      while (prevIdx >= 0 && isOdemeColPassive(ODEME_COLS[prevIdx])) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        const pk = ODEME_COLS[prevIdx];
        focusOdemeGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        let prevRowLastCol: OdemeColKey = "kur";
        for (let i = totalCols - 1; i >= 0; i--) {
          if (!isOdemeColPassive(ODEME_COLS[i], rowIndex - 1)) {
            prevRowLastCol = ODEME_COLS[i];
            break;
          }
        }
        focusOdemeGridCell(pr.id, prevRowLastCol, "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < odemeRows.length - 1) {
        const nr = odemeRows[rowIndex + 1];
        setActiveOdemeRowIndex(rowIndex + 1);
        const fallbackCol = !isOdemeColPassive("adet", rowIndex + 1) ? "adet" : "miktar";
        const targetCol = !isOdemeColPassive(colKey, rowIndex + 1) ? colKey : fallbackCol;
        focusOdemeGridCell(nr.id, targetCol, "select");
      } else {
        handleAddOdemeRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = odemeRows[rowIndex - 1];
        setActiveOdemeRowIndex(rowIndex - 1);
        const fallbackCol = !isOdemeColPassive("adet", rowIndex - 1) ? "adet" : "miktar";
        const targetCol = !isOdemeColPassive(colKey, rowIndex - 1) ? colKey : fallbackCol;
        focusOdemeGridCell(pr.id, targetCol, "select");
      }
    } else if (e.key === "ArrowRight") {
      const isPassive = isOdemeColPassive(colKey);
      if (isPassive || isAtEnd) {
        e.preventDefault();
        let nextIdx = colIdx + 1;
        while (nextIdx < totalCols && isOdemeColPassive(ODEME_COLS[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < totalCols) {
          const nk = ODEME_COLS[nextIdx];
          focusOdemeGridCell(rowId, nk, "start");
        } else if (rowIndex < odemeRows.length - 1) {
          const nr = odemeRows[rowIndex + 1];
          setActiveOdemeRowIndex(rowIndex + 1);
          focusOdemeGridCell(nr.id, "odemeAraciTuru", "start");
        } else {
          handleAddOdemeRow();
        }
      }
    } else if (e.key === "ArrowLeft") {
      const isPassive = isOdemeColPassive(colKey);
      if (isPassive || isAtStart) {
        e.preventDefault();
        let prevIdx = colIdx - 1;
        while (prevIdx >= 0 && isOdemeColPassive(ODEME_COLS[prevIdx])) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          const pk = ODEME_COLS[prevIdx];
          focusOdemeGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = odemeRows[rowIndex - 1];
          setActiveOdemeRowIndex(rowIndex - 1);
          let prevRowLastCol: OdemeColKey = "kur";
          for (let i = totalCols - 1; i >= 0; i--) {
            if (!isOdemeColPassive(ODEME_COLS[i], rowIndex - 1)) {
              prevRowLastCol = ODEME_COLS[i];
              break;
            }
          }
          focusOdemeGridCell(pr.id, prevRowLastCol, "end");
        }
      }
    }
  }, [odemeRows, urunList, cariList, bankaList, posList, iskontoList, tip, altinHasKuru, openOdemeUrunModal, openOdemeLookup, openCariModalForOdeme, applyProductToOdemeRow, applyCariToOdemeRow, applyPosToOdemeRow, applyHesapToOdemeRow, applyIskontoToOdemeRow, focusOdemeGridCell, focusNextOdemeCell, handleAddOdemeRow, isAnyModalOpen, milyemAcik, normalizeOdemeRowOnBlur]);

  // ─── Keyboard Navigation: Detay Modal ─────────────────────────────────────────
  const handleDetayKeyDown = (
    e: React.KeyboardEvent<any>,
    fieldName: typeof DETAY_FIELDS[number]
  ) => {
    const idx = DETAY_FIELDS.indexOf(fieldName);
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter") {
      e.preventDefault();
      if (idx + 1 < DETAY_FIELDS.length) {
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      } else {
        handleSaveDetay();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx + 1 < DETAY_FIELDS.length) {
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) {
        detayRefs.current[DETAY_FIELDS[idx - 1]]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd && idx + 1 < DETAY_FIELDS.length) {
        e.preventDefault();
        detayRefs.current[DETAY_FIELDS[idx + 1]]?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart && idx > 0) {
        e.preventDefault();
        detayRefs.current[DETAY_FIELDS[idx - 1]]?.focus();
      }
    }
  };

  // Yazdır / Önizleme Modalı Açma (Önizlemeli)
  const openPrintPreview = useCallback(() => {
    const validLines = lines.filter((l) => parseDecimal(l.miktar) > 0 || parseDecimal(l.adet) > 0 || (l.urunKodu && l.urunKodu.trim() !== ""));
    const baseBelgeNo = fisNo || (fisId ? String(fisId) : (seriNo ? `${seriNo}-TEKLİF` : "TEKLİF"));
    const baseSeriNo = seriNo || "";
    setPrintSnapshot({
      fisId: fisId || undefined,
      fisNo: baseBelgeNo,
      seriNo: baseSeriNo,
      belgeNo: baseBelgeNo,
      tip: tip,
      tarih: tarih,
      saat: saat,
      unvan: unvan || detayUnvan,
      vergiKimlikNo: detayVergiKimlikNo,
      detayIl: "",
      detayIlce: "",
      detayAdres: detayAdres,
      detayTelefonNo: detayTelefonNo,
      detayPasaportNo: detayPasaportNo,
      vezneKod: vezneKod,
      kullaniciAdi: user?.fullName || user?.username || "Kasiyer",
      satirlar: validLines.map((l, i) => ({
        satirNo: i + 1,
        urunKodu: l.urunKodu,
        urunAdi: l.urunAdi,
        adet: l.adet,
        miktar: l.miktar,
        milyem: l.milyem,
        hasGram: l.hasGram,
        iscilikiMiktari: l.iscilikiMiktari,
        iscilikHasGram: l.iscilikHasGram,
        iscilikTutari: l.iscilikTutari,
        // Çıktının altındaki işçilik / KDV % satırları için (M15)
        iscilikToplam: l.iscilikToplam,
        iscilikKdvOrani: l.iscilikKdvOrani,
        iscilikKdvTutari: l.iscilikKdvTutari,
        iscilikHesaplamaSekli: l.iscilikHesaplamaSekli,
        kur: l.kur,
        tutar: l.tutar,
        aciklama: l.aciklama,
        urunTipi: l.urunTipi,
        karat: l.karat,
      })),
      odemeSatirlari: odemeRows
        .map((r) => recomputeOdemeRow(r, Number(altinHasKuru) || 0))
        .filter((o) => {
          const mik = parseDecimal(o.miktar);
          const tut = parseDecimal(o.tutar);
          const ad = parseDecimal(o.adet);
          const hasCode = Boolean((o.paraKodu && o.paraKodu.trim() !== "") || (o.paraId && o.paraId > 0));
          return mik > 0 || tut > 0 || ad > 0 || hasCode;
        })
        .map((o, i) => {
          const mik = parseDecimal(o.miktar);
          const ad = parseDecimal(o.adet);
          const effectiveMik = mik > 0 ? mik : (ad > 0 ? ad : 0);
          const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
          const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
          return {
            satirNo: i + 1,
            odemeAraciTuru: o.odemeAraciTuru,
            paraKodu: o.paraKodu,
            paraAdi: o.paraAdi,
            // Hesap ödemesi çıktıda banka hesabının adıyla (M28)
            hesapAdi: o.odemeAraciTuru === 3 ? (o.ebKartAdi || o.cariUnvan || "") : undefined,
            adet: ad || "",
            miktar: effectiveMik || "",
            milyem: parseDecimal(o.milyem) || "",
            hasGram: parseDecimal(o.hasGram) || "",
            kur: effKur,
            tutar: effTut,
          };
        }),
      toplamTutar: totalTutar,
      // Kütükçü düzenindeki çıktı için (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF36)
      kdvOrani: parseDecimal(kdvOrani) || null,
      istisnaKodu: (istisnaKodu || "").trim() || null,
      toplamHas: alisHas,
      odenenTutar: totalOdemeTutar,
      kalanTutar: farkTL,
    });
    setIsPendingDirectPrint(false);
    setShowPrintModal(true);
  }, [fisId, fisNo, seriNo, tip, tarih, saat, unvan, detayUnvan, detayVergiKimlikNo, detayAdres, detayTelefonNo, detayPasaportNo, vezneKod, user, lines, odemeRows, totalTutar, alisHas, totalOdemeTutar, farkTL, kdvOrani, istisnaKodu]);

  const closeAllModals = useCallback(() => {
    setShowCariModal(false);
    setShowOdemeCariModal(false);
    setShowOdemeHesapModal(false);
    setShowFisModal(false);
    setShowVezneModal(false);
    setShowUrunModal(false);
    setShowNewProductModal(false);
    setShowNewCariModal(false);
    setShowNewBankaModal(false);
    setShowOdemeParaModal(false);
    setShowMasakCustomerWarningModal(false);
    setShowMasakMissingModal(false);
    setShowDeleteConfirm(false);
    setShowDetayModal(false);
    setShowPrintModal(false);
    setShowTeklifTaniModal(false);
    setShowIstatistikModal(false);
    setShowFarkConfirmModal({ show: false, andPrint: false });
  }, []);

  const handleDirectPrintF9 = useCallback(async () => {
    const validLines = lines.filter((l) => (l.urunId > 0 || (l.urunKodu && l.urunKodu.trim() !== "")) && (parseDecimal(l.miktar) > 0 || parseDecimal(l.adet) > 0));
    if (!validLines.length) {
      showNotif("warning", "Yazdırılacak geçerli ürün satırı bulunamadı.");
      return;
    }

    const snapObj = {
      fisId: fisId || undefined,
      fisNo: fisNo || "",
      seriNo: seriNo,
      belgeNo: fisNo,
      tip: tip,
      tarih: tarih,
      saat: saat,
      unvan: unvan || detayUnvan,
      vergiKimlikNo: detayVergiKimlikNo,
      detayIl: "",
      detayIlce: "",
      detayAdres: detayAdres,
      detayTelefonNo: detayTelefonNo,
      detayPasaportNo: detayPasaportNo,
      vezneKod: vezneKod,
      kullaniciAdi: user?.fullName || user?.username || "Kasiyer",
      satirlar: validLines.map((l, i) => ({
        satirNo: i + 1,
        urunKodu: l.urunKodu,
        urunAdi: l.urunAdi,
        adet: l.adet,
        miktar: l.miktar,
        milyem: l.milyem,
        hasGram: l.hasGram,
        iscilikiMiktari: l.iscilikiMiktari,
        iscilikHasGram: l.iscilikHasGram,
        iscilikTutari: l.iscilikTutari,
        // Çıktının altındaki işçilik / KDV % satırları için (M15)
        iscilikToplam: l.iscilikToplam,
        iscilikKdvOrani: l.iscilikKdvOrani,
        iscilikKdvTutari: l.iscilikKdvTutari,
        iscilikHesaplamaSekli: l.iscilikHesaplamaSekli,
        kur: l.kur,
        tutar: l.tutar,
        aciklama: l.aciklama,
        urunTipi: l.urunTipi,
        karat: l.karat,
      })),
      odemeSatirlari: odemeRows
        .map((r) => recomputeOdemeRow(r, Number(altinHasKuru) || 0))
        .filter((o) => {
          const mik = parseDecimal(o.miktar);
          const tut = parseDecimal(o.tutar);
          const ad = parseDecimal(o.adet);
          const hasCode = Boolean((o.paraKodu && o.paraKodu.trim() !== "") || (o.paraId && o.paraId > 0));
          return mik > 0 || tut > 0 || ad > 0 || hasCode;
        })
        .map((o, i) => {
          const mik = parseDecimal(o.miktar);
          const ad = parseDecimal(o.adet);
          const effectiveMik = mik > 0 ? mik : (ad > 0 ? ad : 0);
          const effKur = parseDecimal(o.kur) > 0 ? parseDecimal(o.kur) : 1;
          const effTut = parseDecimal(o.tutar) > 0 ? parseDecimal(o.tutar) : (effectiveMik * effKur);
          return {
            satirNo: i + 1,
            odemeAraciTuru: o.odemeAraciTuru,
            paraKodu: o.paraKodu,
            paraAdi: o.paraAdi,
            // Hesap ödemesi çıktıda banka hesabının adıyla (M28)
            hesapAdi: o.odemeAraciTuru === 3 ? (o.ebKartAdi || o.cariUnvan || "") : undefined,
            adet: ad || "",
            miktar: effectiveMik || "",
            milyem: parseDecimal(o.milyem) || "",
            hasGram: parseDecimal(o.hasGram) || "",
            kur: effKur,
            tutar: effTut,
          };
        }),
      toplamTutar: totalTutar,
      // Kütükçü düzenindeki çıktı için (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF36)
      kdvOrani: parseDecimal(kdvOrani) || null,
      istisnaKodu: (istisnaKodu || "").trim() || null,
      toplamHas: alisHas,
      odenenTutar: totalOdemeTutar,
      kalanTutar: farkTL,
    };

    const resolved = resolveEffectivePrinter({
      pageType: "sarraf",
      tip,
      vezne: vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null),
      user,
      printers,
    });

    const isPos = resolved.recommendedPrintType === "POS";
    try {
      const fisCikti = await sarrafFisHtml(snapObj, isPos ? "80" : "A4");
      const sonuc = await fisiYazdir(fisCikti, {
        printerName: resolved.printer?.cihazAdi || resolved.printer?.ad || resolved.printerName || null,
        copies: resolved.kopyaSayisi || 1,
        isPos,
      });
      if (sonuc.success) {
        showNotif("success", "✅ Fiş doğrudan yazıcıya gönderildi.");
      } else {
        showNotif("warning", `⚠️ Fiş yazdırılamadı: ${sonuc.message}`);
      }
    } catch (printErr: any) {
      showNotif("warning", `⚠️ Fiş yazdırılamadı: ${printErr?.message || "bilinmeyen hata"}`);
    }
  }, [lines, fisId, fisNo, seriNo, tip, tarih, saat, unvan, detayUnvan, detayVergiKimlikNo, detayAdres, detayTelefonNo, detayPasaportNo, vezneKod, user, odemeRows, altinHasKuru, totalTutar, alisHas, totalOdemeTutar, farkTL, vezneList, vezneId, printers, showNotif, kdvOrani, istisnaKodu]);

  const handleTriggerF10 = useCallback(() => {
    if (isMasakBlocked) {
      showNotif("danger", `🚨 İŞLEM ENGELLENDİ: Bu müşteri MASAK Malvarlığı Dondurulanlar / Yaptırım Listesindedir. Kesinlikle fiş ve işlem kaydı yapılamaz!`);
      setMasakModalOpen(true);
      return;
    }

    if (!vezneId) {
      showNotif("warning", "Vezne seçiniz");
      return;
    }

    const validLines = lines.filter((l) => (l.urunId > 0 || (l.urunKodu && l.urunKodu.trim() !== "")) && (parseDecimal(l.miktar) > 0 || parseDecimal(l.adet) > 0));
    if (!validLines.length) {
      showNotif("warning", "Lütfen en az bir geçerli ürün satırı ekleyiniz.");
      return;
    }

    closeAllModals();
    handleSave(false, true);
  }, [isMasakBlocked, vezneId, lines, closeAllModals, handleSave, showNotif]);

  // ─── Global F-key shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const isCtrlN = isCtrlNEvent(e);
      if (isCtrlN) {
        if (!isDuzeltmeMode) {
          e.preventDefault();
          e.stopPropagation();
          closeAllModals();
          handleNew();
        }
        return;
      }

      // Eğer ekranda açık bir modal varsa kısayolları çalıştırma (Shift+F10 hariç)
      if (document.querySelector(".modal.show")) {
        if (e.key === "F10" && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          closeAllModals();
          setShowTeklifTaniModal(true);
          return;
        }
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isF12 = e.key === "F12" || e.code === "F12" || e.keyCode === 123;
      if (isF12) {
        if (triggerAdjacentBinoculars(activeEl)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeEl?.tagName || "") &&
        !["F1", "F3", "F4", "F8", "F9", "F10", "F12"].includes(e.key)) {
        return;
      }
      if (e.key === "F1") { e.preventDefault(); e.stopPropagation(); closeAllModals(); handleSave(false, false); }
      else if (e.key === "F3") { e.preventDefault(); e.stopPropagation(); closeAllModals(); setShowIstatistikModal(true); }
      else if (e.key === "F4") { e.preventDefault(); e.stopPropagation(); closeAllModals(); handleNew(); }
      else if (e.key === "F8") { e.preventDefault(); e.stopPropagation(); closeAllModals(); openDetayModal(); }
      else if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        openPrintPreview();
      }
      else if (e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        closeAllModals();
        if (e.shiftKey) {
          setShowTeklifTaniModal(true);
        } else {
          handleTriggerF10();
        }
      }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [handleSave, handleNew, openDetayModal, openPrintPreview, closeAllModals, handleTriggerF10, setShowTeklifTaniModal]);

  // LookupModal columns
  const fisColumns: LookupColumn<SarrafFisListItem>[] = [
    { header: "Belge No", render: (i) => i.fisNo },
    { header: "Tarih", render: (i) => i.tarih, width: "100px" },
    { header: "Tip", render: (i) => <Badge bg={i.tip === 0 ? "primary" : "success"}>{i.tipLabel}</Badge>, width: "60px" },
    { header: "Müşteri", render: (i) => i.unvan },
    { header: "Has Kur", render: (i) => i.altinHasKuru?.toLocaleString("tr-TR"), width: "90px", align: "right" },
  ];

  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", render: (i) => i.kod, width: "80px" },
    { header: "Ad", render: (i) => i.ad },
  ];

  const urunColumns: LookupColumn<UrunItem>[] = [
    {
      header: "Kod",
      render: (item) => <strong className="text-primary font-monospace">{item.kod}</strong>,
      width: "90px",
    },
    {
      header: "Ürün Adı",
      render: (item) => item.ad,
    },
    {
      header: "Tip",
      render: (item) => {
        const info = getUrunTipiInfo(item);
        return (
          <Badge
            bg={info.bg}
            text={info.textColor as any}
            style={{ fontSize: "11px", fontWeight: 600, minWidth: "55px", display: "inline-block", textAlign: "center" }}
          >
            {info.label}
          </Badge>
        );
      },
      width: "85px",
      align: "center",
    },
    {
      header: "Alış Has",
      render: (item) => (
        item.hasAlisKatsayisi > 0
          ? Number(item.hasAlisKatsayisi).toFixed(4)
          : (Number(item.alisMilyem) > 0
            ? Number(item.alisMilyem).toString()
            : (Number(item.hasOrani) > 0 ? Number(item.hasOrani).toFixed(4) : "-"))
      ),
      width: "90px",
      align: "right",
    },
    {
      header: "Satış Has",
      render: (item) => (
        item.hasSatisKatsayisi > 0
          ? Number(item.hasSatisKatsayisi).toFixed(4)
          : (Number(item.satisMilyem) > 0
            ? Number(item.satisMilyem).toString()
            : (Number(item.hasOrani) > 0 ? Number(item.hasOrani).toFixed(4) : "-"))
      ),
      width: "90px",
      align: "right",
    },
    {
      header: "Gramaj",
      render: (item) => (Number(item.gramaj) > 0 ? `${item.gramaj} gr` : (item.birim === 1 ? "Gram" : (item.birim === 0 ? "Adet" : "-"))),
      width: "80px",
      align: "right",
    },
  ];

  const odemeCariColumns: LookupColumn<CariKartItem>[] = [
    { header: "Cari Kodu", render: (i) => i.kod, width: "100px", highlight: true },
    { header: "Ünvan / Ad", render: (i) => i.ad, highlight: false },
    { header: "Telefon", render: (i) => i.telefon || "", width: "110px", highlight: false },
  ];

  const odemeHesapVeIskontoColumns: LookupColumn<any>[] = [
    {
      header: "Tür",
      render: (i) => (
        <span className={`badge ${i.tur === "İskonto" ? "bg-warning text-dark" : "bg-primary text-white"}`} style={{ fontSize: "10px" }}>
          {i.tur}
        </span>
      ),
      width: "80px",
      highlight: false,
    },
    { header: "Hesap / İskonto Kodu", render: (i) => <strong className="text-primary font-monospace">{i.kod}</strong>, width: "130px", highlight: true },
    { header: "Tanım / Hesap Adı", render: (i) => <span className="fw-semibold">{i.ad}</span>, highlight: false },
    { header: "Detay / Oran", render: (i) => <span className="text-muted small">{i.detay || "-"}</span>, width: "160px", highlight: false },
  ];

  const odemeHesapVeIskontoItems = useMemo<any[]>(() => {
    const list: any[] = [];
    // 1. İskonto Hesapları
    (iskontoList || []).forEach((isk) => {
      let detay = "Serbest İskonto";
      if (isk.iskontoTipi === 1) detay = `%${isk.oran || 0} İskonto`;
      else if (isk.iskontoTipi === 2) detay = `${(isk.tutar || 0).toLocaleString("tr-TR")} TL İskonto`;
      else if (isk.iskontoTipi === 3) detay = `${isk.hasTutar || 0} Has Gr İskonto`;
      else if (isk.oran) detay = `%${isk.oran} İskonto`;
      else if (isk.tutar) detay = `${(isk.tutar || 0).toLocaleString("tr-TR")} TL İskonto`;

      list.push({
        id: `isk-${isk.iskontoId}`,
        tur: "İskonto",
        kod: (isk.kod || `ISK-${isk.iskontoId}`).toUpperCase().trim(),
        ad: isk.tanim,
        detay,
        rawIskonto: isk,
      });
    });

    if (list.length === 0) {
      list.push({
        id: "isk-default",
        tur: "İskonto",
        kod: "İSKONTO",
        ad: "Genel İskonto",
        detay: "Serbest İskonto",
        rawIskonto: {
          iskontoId: 0,
          kod: "İSKONTO",
          tanim: "Genel İskonto",
          iskontoTipi: null,
          oran: null,
          tutar: null,
        },
      });
    }

    // Firma Tanımları -> Muhasebe -> İskonto bölümünde seçili olan hesap en başta listelenir
    const defId = companyDefinitions?.ISKONTO_ID || companyDefinitionsRef.current?.ISKONTO_ID;
    if (defId) {
      list.sort((a, b) => {
        const aIsDef = a.rawIskonto && (a.rawIskonto.iskontoId === defId || Number(a.rawIskonto.iskontoId) === Number(defId));
        const bIsDef = b.rawIskonto && (b.rawIskonto.iskontoId === defId || Number(b.rawIskonto.iskontoId) === Number(defId));
        if (aIsDef && !bIsDef) return -1;
        if (!aIsDef && bIsDef) return 1;
        return 0;
      });
    }

    return list;
  }, [iskontoList, companyDefinitions?.ISKONTO_ID]);

  const odemeHesapColumns: LookupColumn<BankaHesapItem>[] = [
    { header: "Hesap / Kart No", render: (i) => i.hesapNo || "", width: "120px", highlight: true },
    { header: "Hesap / Kart Adı", render: (i) => i.hesapAdi || "", highlight: false },
    { header: "Banka", render: (i) => i.bankaAdi || "", width: "120px", highlight: false },
    { header: "IBAN", render: (i) => i.iban || "", width: "180px", highlight: false },
  ];

  const odemePosColumns: LookupColumn<PosCihaziItem>[] = [
    { header: "POS Kodu", render: (i) => i.kod, width: "120px", highlight: true },
    { header: "POS Adı", render: (i) => i.ad, highlight: false },
    { header: "Bakiye", render: (i) => (i.bakiye ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }), width: "100px", align: "right" },
  ];

  const odemeParaColumns: LookupColumn<UrunItem>[] = [
    { header: "Para Kodu", render: (i) => <strong className="text-primary font-monospace">{i.kod}</strong>, width: "110px", highlight: true },
    { header: "Para / Ürün Adı", render: (i) => <span className="fw-semibold">{i.ad}</span>, highlight: false },
    {
      header: "Tip",
      render: (i) => {
        const info = getUrunTipiInfo(i);
        return (
          <Badge
            bg={info.bg}
            text={info.textColor as any}
            style={{ fontSize: "11px", fontWeight: 600, minWidth: "55px", display: "inline-block", textAlign: "center" }}
          >
            {info.label}
          </Badge>
        );
      },
      width: "85px",
      align: "center",
    },
  ];

  const fmtBakiye = (kod: string) => {
    const b = bakiyeler.find((item) => item.paraKodu === kod || item.paraKodu === (kod === "TL" ? "TRY" : kod));
    return (b?.miktar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const displayTitle = isPerakende
    ? (isDuzeltmeMode ? "D- Perakende Fişi Düzeltme" : "C- Perakende Fişi Kayıt")
    : isDuzeltmeMode
      ? "B- Sarraf Fişi Düzeltme"
      : "A- Sarraf Fişi Kayıt";

  // e-Banka mutabakatından "Fiş kes" ile gelindiyse cari / tarih / yön dolu açılır
  const ebFis = useEBankaFisKesimi("sarraf", cariList.length > 0 && !isDuzeltmeMode && !queryId, (b) => {
    setTip(b.tip);
    const hasKurItem = kurSatirlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN"].includes((k.kod || "").toUpperCase().trim()));
    const rate = hasKurItem ? ((hasKurItem.dovizAlis ?? hasKurItem.efektifAlis ?? hasKurItem.dovizSatis ?? hasKurItem.efektifSatis) || 0) : 0;
    if (rate > 0) setAltinHasKuru(rate);
    const gumusKurItem = kurSatirlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ"].includes((k.kod || "").toUpperCase().trim()));
    const gRate = gumusKurItem ? ((gumusKurItem.dovizAlis ?? gumusKurItem.efektifAlis ?? gumusKurItem.dovizSatis ?? gumusKurItem.efektifSatis) || 0) : 0;
    if (gRate > 0) setGumusHasKuru(gRate);
    if (b.musteri) handleSelectCustomer(b.musteri);
    setTarih(b.tarih);
    // Ödeme kısmı: banka hesabı + banka tutarı (döviz hesapta döviz miktarı × o günün kuru)
    ebHedefRef.current = b.tutarTl;
    const hesap = b.bankaId ? bankaList.find((x) => x.bankaId === b.bankaId) : undefined;
    if (hesap && b.tutarTl > 0) {
      // Hesap (3) satırı: banka bankaId'de, hesap no cariKod'da, para birimi paraKodu'nda taşınır (applyHesapToOdemeRow ile aynı)
      const kod = b.paraKodu.trim().toUpperCase();
      const doviz = ["TL", "TRY"].includes(kod) || !(b.tutar > 0)
        ? undefined
        : (urunList.find((u) => (u.urunTipi ?? 0) === 0 && (u.kod || "").trim().toUpperCase() === kod) || kurSatirlar.find((k) => (k.kod || "").trim().toUpperCase() === kod));
      const hesapAdi = hesap.hesapAdi ? `${hesap.bankaAdi ? hesap.bankaAdi + " - " : ""}${hesap.hesapAdi}` : (hesap.bankaAdi || "BANKA HAVALE / EFT");
      const satir: OdemeRow = {
        ...createEmptyOdemeRow(1),
        odemeAraciTuru: 3,
        bankaId: hesap.bankaId,
        cariKod: hesap.hesapNo || "",
        cariUnvan: hesapAdi,
        // Kod hücresinde kartın kayıtlı adı, Açıklama'da hareketin bankası ve hesap no'su; satır kilitli (M16, M20, M28)
        ebBanka: true,
        ebKartAdi: (hesap.hesapAdi || "").trim() || hesap.hesapNo || "",
        aciklama: b.bankaAciklama || hesapAdi,
        // Döviz kodu para listesinde yoksa satır TL karşılığıyla yazılır
        paraId: doviz?.paraId ?? null,
        paraKodu: doviz ? (doviz.kod || kod) : "TL",
        paraAdi: doviz ? (doviz.ad || kod) : "TÜRK LİRASI",
        urunTipi: 0,
        // TL / döviz (para) satırında tutar Adet'tedir, Miktar boş kalır (ekranın para satırı kuralı; Miktar'a yazılınca Adet "eksik"
        // görünüyor, Adet'e dokununca tutar siliniyordu — docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M21)
        adet: formatMiktar(doviz ? b.tutar : b.tutarTl),
        miktar: "",
        kur: doviz ? parseFloat((b.tutarTl / b.tutar).toFixed(4)) : "",
      };
      setOdemeRows([recomputeOdemeRow(satir, Number(altinHasKuru) || 0)]);
    } else if (b.tutarTl > 0) {
      showNotif("warning", "Bu e-Banka hesabı bir Banka Hesap Kartı ile eşlenmemiş; ödeme tablosunda Hesap satırına bankayı elle seçin (e-Banka > Hesaplar'dan eşleyebilirsiniz).");
    }
  });

  // Listeden açılan e-Banka fişi de e-Banka kipinde: KDV oranı fiş düzeyinde, alt kutuda işçilik özeti (M32)
  const ebKipi = ebFis.vomsisId > 0 || ebBagli;
  ebModRef.current = ebKipi;
  ebDuzenlemeRef.current = ebFis.duzenleme ? String(queryId || "") : "";
  // e-Banka fişinde İşçilik KDV oranı fiş başlığına da yazılır; fatura oranı başlıktan okur (M12)
  useEffect(() => {
    if (!ebKipi || isKdvDisabled) return;
    const r = lines.find((l) => l.ebSabit && parseDecimal(l.iscilikKdvOrani) > 0);
    if (r && parseDecimal(r.iscilikKdvOrani) !== parseDecimal(kdvOrani)) setKdvOrani(parseDecimal(r.iscilikKdvOrani));
  }, [lines, ebKipi, isKdvDisabled, kdvOrani]);
  // Alt kutudaki işçilik özeti ve KDV % kutusu (M15)
  const ebIscilik = iscilikOzeti(lines, parseDecimal);
  const [ebKdvYazi, setEbKdvYazi] = useState<string | null>(null);
  // Başka fişe geçince (ileri / geri, yeni kayıt) KDV % kutusu o fişin oranını gösterir
  useEffect(() => setEbKdvYazi(null), [fisId]);
  const ebKdvDegistir = (deger: string) => {
    const oranYazi = onlyDecimal(deger);
    setEbKdvYazi(oranYazi);
    const kur0 = Number(altinHasKuru) || 0;
    setLines((prev) => prev.map((r) => ebKdvSatiri(r, oranYazi, kur0, userIscilikGirisSekli, isKdvDisabledRef.current)));
    setKdvOrani(oranYazi === "" ? "" : parseDecimal(oranYazi));
  };
  const tlYaz = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // POS cihazı tahsilatı: handleSave içinde kullanılır (docs/POS_ENTEGRASYON_YOL_HARITASI.md)
  const pos = usePosTahsilat();

  return (
    <div className="sarraf-fisi-page w-100 pb-3" style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px", "--active-fis-theme-bg": activeFisThemeBg } as React.CSSProperties}>
      {ebFis.bant}
      {ebBagli && !ebFis.vomsisId && ebBag && (
        <div className="alert alert-info py-2 px-3 mb-2 small">
          Bu fiş e-Banka hareketine bağlı — {ebBag.yon} {ebBag.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {ebBag.doviz || "TL"}
          {ebBag.bankaAdi ? ` (${ebankaHareketHesabi(ebBag)})` : ""}. Toplam Tutar kayıttaki tutarda kalır; işçilik değişince gram dengelenir.
        </div>
      )}
      {pos.pencere}
      <ERPToolbar
        disableShortcuts
        pageTitle={displayTitle}
        onNew={isDuzeltmeMode ? undefined : handleNew}
        hideNew={isDuzeltmeMode}
        onSave={() => handleSave(false, false)}
        onSearch={isDuzeltmeMode ? handleOpenFisModal : undefined}
        onDetailSearch={openDetayModal}
        onDelete={isDuzeltmeMode && fisId ? () => setShowDeleteConfirm(true) : undefined}
        hideSearch={!isDuzeltmeMode}
        hideDelete={!isDuzeltmeMode || !fisId}
        hideNavigation={!isDuzeltmeMode}
        onFirst={isDuzeltmeMode ? handleFirst : undefined}
        onPrev={isDuzeltmeMode ? handlePrev : undefined}
        onNext={isDuzeltmeMode ? handleNext : undefined}
        onLast={isDuzeltmeMode ? handleLast : undefined}
        onRefresh={handleRefresh}
        onDirectPrint={handleDirectPrintF9}
        onSaveAndPrint={handleTriggerF10}
        onPreview={openPrintPreview}
        centerContent={
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                border: tip === 0 ? "2px solid #16a34a" : "2px solid #dc2626",
                backgroundColor: activeFisThemeBg,
                color: activeFisThemeText,
                fontWeight: 800,
                fontSize: "13.5px",
                letterSpacing: "3px",
                minWidth: "220px",
                padding: "4px 30px",
                borderRadius: "6px",
                height: "30px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: tip === 0 ? "0 1px 3px rgba(22, 163, 74, 0.15)" : "0 1px 3px rgba(220, 38, 38, 0.15)",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {tip === 0 ? "ALIŞ" : "SATIŞ"}
            </div>

          </div>
        }
        rightContent={
          <div className="d-flex align-items-center gap-2 text-nowrap">
            {/* Vezne Bakiyeleri: sağ tarafta, veznenin solunda, dış kenarlıksız, daha kısa */}
            <div
              className="d-flex align-items-center gap-1.5 font-monospace text-secondary"
              style={{ fontSize: "10.5px" }}
            >
              <span>TL: <strong className="text-dark">{fmtBakiye("TL")}</strong></span>
              <span className="opacity-40">|</span>
              <span>USD: <strong className="text-dark">{fmtBakiye("USD")}</strong></span>
              <span className="opacity-40">|</span>
              <span>EUR: <strong className="text-dark">{fmtBakiye("EUR")}</strong></span>
            </div>

            {/* Vezne */}
            <div
              className="d-flex align-items-center gap-1 px-2 py-0.5 rounded border bg-white shadow-2xs font-monospace"
              style={{ fontSize: "11px" }}
            >
              <span className="text-primary fw-bold" style={{ fontSize: "10.5px" }}>VEZNE:</span>
              <strong className="text-dark" style={{ fontSize: "11px" }}>{vezneKod || "01"}</strong>
            </div>

            {/* Zaman: Fiş Düzeltme modunda düzenlenebilir, Kayıt modunda sadece gösterilir ve değiştirilemez */}
            {isDuzeltmeMode ? (
              <div className="d-flex align-items-center gap-1 bg-white px-2 py-0.5 border rounded shadow-2xs font-monospace" style={{ height: "28px" }}>
                <span className="text-secondary fw-bold" style={{ fontSize: "11px" }}>TARİH</span>
                <input
                  type="date"
                  className="form-control form-control-sm border-0 p-0 text-center fw-semibold text-dark bg-transparent"
                  style={{ width: "110px", fontSize: "11.5px", height: "22px" }}
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                  disabled={!kYetki.tarihDegistirme}
                  title={kYetki.tarihDegistirme ? "Kayıtlı Fiş Tarihi (Düzenlenebilir)" : "Tarih değiştirme yetkiniz yok"}
                />
                <input
                  type="time"
                  className="form-control form-control-sm border-0 p-0 text-center text-secondary bg-transparent"
                  style={{ width: "55px", fontSize: "11px", height: "22px" }}
                  value={saat}
                  onChange={(e) => setSaat(e.target.value)}
                  disabled={!kYetki.tarihDegistirme}
                  title="Kayıtlı Fiş Saati (Düzenlenebilir)"
                />
              </div>
            ) : (
              <div
                className="d-flex align-items-center gap-1 px-2 py-0.5 rounded border bg-white shadow-2xs font-monospace text-dark"
                style={{ height: "28px", fontSize: "11px", cursor: "default", color: "#000000" }}
                title="Fiş Kayıt Tarihi ve Saati (Otomatik / Değiştirilemez)"
              >
                <IconClock size={13} className="text-dark" style={{ color: "#000000" }} />
                <span className="fw-semibold text-dark" style={{ color: "#000000" }}>
                  {tarih ? tarih.split("-").reverse().join(".") : ""}
                </span>
                <strong className="text-dark" style={{ color: "#000000" }}>
                  {saat}
                </strong>
              </div>
            )}
          </div>
        }
      />

      {/* Sağ altta beliren ve 3.5 sn sonra yok olan bildirim */}
      {notification && (
        <div className="erp-toast-container">
          <Alert variant={notification.type} className="erp-toast-item py-2 px-3 mb-0 border-0 shadow small" dismissible onClose={() => setNotification(null)}>
            {notification.message}
          </Alert>
        </div>
      )}

      {/* MASAK Malvarlığı Dondurulanlar Kırmızı Bloke Uyarısı */}
      {isMasakBlocked && (
        <Alert variant="danger" className="d-flex align-items-center justify-content-between my-2 py-2.5 px-3 shadow border-2 border-danger bg-danger text-white">
          <div className="d-flex align-items-center gap-2">
            <IconShieldExclamation size={28} className="text-white flex-shrink-0" />
            <div>
              <div className="fw-bold fs-6">🚨 DİKKAT: BU KİŞİ / KURULUŞ MASAK MALVARLIĞI DONDURULANLAR LİSTESİNDEDİR!</div>
              <div style={{ fontSize: "12px", opacity: 0.95 }}>
                “{masakResult.queriedName}” için {masakResult.matches.length} adet yaptırım kaydı tespit edildi. Yasal mevzuat gereği <strong>KESİNLİKLE İŞLEM VE KAYIT YAPILAMAZ</strong>.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="light"
            className="text-danger fw-bold py-1 px-3 flex-shrink-0 ms-2 shadow-sm"
            onClick={() => setMasakModalOpen(true)}
          >
            Detayları Göster
          </Button>
        </Alert>
      )}

      <Card
        className={`shadow-sm mb-2 fis-theme-card ${isMasakBlocked ? "border-2 border-danger" : ""}`}
        data-fis-theme="active"
        style={
          isMasakBlocked
            ? { boxShadow: "0 0 0 4px rgba(220, 53, 69, 0.4)", backgroundColor: "#fff5f5" }
            : { backgroundColor: activeFisThemeBg }
        }
      >
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          <div className="d-flex justify-content-between align-items-stretch flex-wrap gap-2">
            {/* Sol Alan: Fiş Başlık Form Alanları */}
            <div style={{ flex: "1 1 650px", minWidth: 0 }}>
              {/* 1. Satır: İşlem | TC/VKN (+Dürbün +MASAK) | Cari Kodu | Adı (+Dürbün +MASAK) | Zaman (En Sağda) */}
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                {/* İşlem */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: 40, minWidth: 40, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">İşlem</label>
                  <Form.Select
                    ref={islemRef}
                    size="sm"
                    value={tip}
                    onChange={(e) => {
                      const newTip = Number(e.target.value) as 0 | 1;
                      setTip(newTip);
                      const defStat = getDefaultStatistic(newTip);
                      if (defStat) {
                        setIstatistikId(defStat.id);
                        setIstatistikKodu(defStat.kod);
                        setSelectedStatistic(defStat);
                        const dizayn = defStat.fisDizaynTipi !== undefined && defStat.fisDizaynTipi !== null ? Number(defStat.fisDizaynTipi) : 0;
                        setIstatistikFisDizaynTipi(dizayn);
                        lastFocusedIstatistikKodRef.current = defStat.kod;
                      }
                      const newHasKuru = getHasKurForTip(newTip);
                      const newGumusKuru = getGumusKurForTip(newTip);
                      if (newHasKuru > 0) setAltinHasKuru(newHasKuru);
                      if (newGumusKuru > 0) setGumusHasKuru(newGumusKuru);

                      setLines((prev) => prev.map((r) => {
                        if (!r.urunKodu) return r;
                        const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.urunKodu.trim().toLowerCase()) || { paraId: r.urunId, kod: r.urunKodu, urunTipi: r.urunTipi };
                        const autoKur = getKurForProduct(found, newTip);
                        const autoMilyem = getMilyemForProduct(found, newTip);
                        const curKur = autoKur > 0 ? autoKur : (found.urunTipi === 0 ? autoKur : (found.urunTipi === 2 ? newGumusKuru : newHasKuru));

                        const updated = {
                          ...r,
                          kur: curKur > 0 ? curKur : r.kur,
                          milyem: (found as any).urunTipi === 0 ? "" : (autoMilyem !== "" ? autoMilyem : r.milyem),
                        };
                        return recomputeRow(updated, curKur, undefined, userIscilikGirisSekli, isKdvDisabledRef.current);
                      }));

                      const odemeTip: 0 | 1 = newTip === 0 ? 1 : 0;
                      const odemeHasKuru = getHasKurForTip(odemeTip);
                      const odemeGumusKuru = getGumusKurForTip(odemeTip);

                      setOdemeRows((prev) => prev.map((r) => {
                        if (!r.paraKodu || r.paraKodu === "TL") return r;
                        const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase()) || { paraId: r.paraId, kod: r.paraKodu, urunTipi: r.urunTipi };
                        const autoKur = getKurForProduct(found, odemeTip);
                        const autoMilyem = getMilyemForProduct(found, odemeTip);
                        const curKur = autoKur > 0 ? autoKur : (found.urunTipi === 0 ? autoKur : (found.urunTipi === 2 ? odemeGumusKuru : odemeHasKuru));

                        const updated = {
                          ...r,
                          kur: curKur > 0 ? curKur : r.kur,
                          milyem: (found as any).urunTipi === 0 ? "" : (autoMilyem !== "" ? autoMilyem : r.milyem),
                        };
                        return recomputeOdemeRow(updated, curKur);
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                        e.preventDefault();
                        e.stopPropagation();
                        const newTip = (tip === 0 ? 1 : 0) as 0 | 1;
                        setTip(newTip);
                        const defStat = getDefaultStatistic(newTip);
                        if (defStat) {
                          setIstatistikId(defStat.id);
                          setIstatistikKodu(defStat.kod);
                          setSelectedStatistic(defStat);
                          const dizayn = defStat.fisDizaynTipi !== undefined && defStat.fisDizaynTipi !== null ? Number(defStat.fisDizaynTipi) : 0;
                          setIstatistikFisDizaynTipi(dizayn);
                          lastFocusedIstatistikKodRef.current = defStat.kod;
                        }
                        const newHasKuru = getHasKurForTip(newTip);
                        const newGumusKuru = getGumusKurForTip(newTip);
                        if (newHasKuru > 0) setAltinHasKuru(newHasKuru);
                        if (newGumusKuru > 0) setGumusHasKuru(newGumusKuru);

                        setLines((prev) => prev.map((r) => {
                          if (!r.urunKodu) return r;
                          const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.urunKodu.trim().toLowerCase()) || { paraId: r.urunId, kod: r.urunKodu, urunTipi: r.urunTipi };
                          const autoKur = getKurForProduct(found, newTip);
                          const autoMilyem = getMilyemForProduct(found, newTip);
                          const curKur = autoKur > 0 ? autoKur : (found.urunTipi === 0 ? autoKur : (found.urunTipi === 2 ? newGumusKuru : newHasKuru));

                          const updated = {
                            ...r,
                            kur: curKur > 0 ? curKur : r.kur,
                            milyem: (found as any).urunTipi === 0 ? "" : (autoMilyem !== "" ? autoMilyem : r.milyem),
                          };
                          return recomputeRow(updated, curKur, undefined, userIscilikGirisSekli, isKdvDisabledRef.current);
                        }));

                        const odemeTip: 0 | 1 = newTip === 0 ? 1 : 0;
                        const odemeHasKuru = getHasKurForTip(odemeTip);
                        const odemeGumusKuru = getGumusKurForTip(odemeTip);

                        setOdemeRows((prev) => prev.map((r) => {
                          if (!r.paraKodu || r.paraKodu === "TL") return r;
                          const found = urunList.find((u) => u.kod.trim().toLowerCase() === r.paraKodu.trim().toLowerCase()) || { paraId: r.paraId, kod: r.paraKodu, urunTipi: r.urunTipi };
                          const autoKur = getKurForProduct(found, odemeTip);
                          const autoMilyem = getMilyemForProduct(found, odemeTip);
                          const curKur = autoKur > 0 ? autoKur : (found.urunTipi === 0 ? autoKur : (found.urunTipi === 2 ? odemeGumusKuru : odemeHasKuru));

                          const updated = {
                            ...r,
                            kur: curKur > 0 ? curKur : r.kur,
                            milyem: (found as any).urunTipi === 0 ? "" : (autoMilyem !== "" ? autoMilyem : r.milyem),
                          };
                          return recomputeOdemeRow(updated, curKur);
                        }));
                        return;
                      }
                      handleHeaderKeyDown(e, "islem");
                    }}
                    className="fw-bold"
                    style={{ width: "95px", color: tip === 0 ? "#0d6efd" : "#198754" }}
                  >
                    <option value={0}>ALIŞ</option>
                    <option value={1}>SATIŞ</option>
                  </Form.Select>
                </div>

                {/* TC / VKN / Pasaport (+ Dürbün + MASAK) */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: detayKimlikBelgeTuru === 1 ? 75 : 55, minWidth: detayKimlikBelgeTuru === 1 ? 75 : 55, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">
                    {detayKimlikBelgeTuru === 1 ? "Pasaport No" : "TC / VKN"}
                  </label>
                  <InputGroup size="sm" style={{ width: "190px" }}>
                    <Form.Control
                      ref={tcknRef}
                      size="sm"
                      maxLength={detayKimlikBelgeTuru === 1 ? 20 : 11}
                      value={detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo}
                      onChange={(e) => {
                        if (detayKimlikBelgeTuru === 1) {
                          const val = e.target.value;
                          setDetayPasaportNo(val);
                          if (!val.trim()) {
                            setUnvan(DEFAULT_CUSTOMER_NAME);
                            setDetayUnvan(DEFAULT_CUSTOMER_NAME);
                            setCariKod("");
                            setCariKartId(null);
                            lastFocusedCariKodRef.current = "";
                            lastFocusedVknRef.current = "";
                            lastFocusedUnvanRef.current = "";
                          }
                        } else {
                          const val = onlyDigits(e.target.value).slice(0, 11);
                          setDetayVergiKimlikNo(val);
                          // Yazınca sorgu yapılmaz; GİB düğmesine basınca yapılır (docs/GIB_BUTON_IL_ILCE_YOL_HARITASI.md K2).
                          // Seçilmiş carinin numarası değişince cari bağı kalkar (bugünkü davranış).
                          if (!val) {
                            setUnvan(DEFAULT_CUSTOMER_NAME);
                            setDetayUnvan(DEFAULT_CUSTOMER_NAME);
                            setCariKod("");
                            setCariKartId(null);
                            lastFocusedCariKodRef.current = "";
                            lastFocusedVknRef.current = "";
                            lastFocusedUnvanRef.current = "";
                            void handleVknLookup("", false);
                          } else if (val !== lastFocusedVknRef.current) {
                            ++uzakSorguSiraRef.current;
                            setCariKod("");
                            setCariKartId(null);
                            lastFocusedCariKodRef.current = "";
                            setUnvan(DEFAULT_CUSTOMER_NAME);
                            setDetayUnvan(DEFAULT_CUSTOMER_NAME);
                            lastFocusedUnvanRef.current = "";
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (detayKimlikBelgeTuru !== 1) blockNonNumericKeys(e);
                        handleHeaderKeyDown(e, "tckn");
                      }}
                      className="font-monospace"
                      title={detayKimlikBelgeTuru === 1 ? "Pasaport Numarası" : "T.C. Kimlik / Vergi Kimlik No (11 hane)"}
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      variant="outline-secondary"
                      className="px-2 py-0 d-flex align-items-center"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const term = (detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo).trim();
                        lastModalCallerRef.current = "vkn";
                        setCariSearchField("vkn");
                        setCariSearchTerm(term);
                        setShowCariModal(true);
                        if (cariList.length === 0) {
                          CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                          DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const term = (detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo).trim();
                        lastModalCallerRef.current = "vkn";
                        setCariSearchField("vkn");
                        setCariSearchTerm(term);
                        setShowCariModal(true);
                        if (cariList.length === 0) {
                          CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                          DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                        }
                      }}
                      title={detayKimlikBelgeTuru === 1 ? "Pasaport No ile Cari / Müşteri Ara ve Seç" : "TC / VKN ile Cari / Müşteri Ara ve Seç"}
                    >
                      <IconBinoculars size={14} />
                    </Button>
                    <Button
                      variant="outline-danger"
                      className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                      onClick={() => handleSearchMasak(unvan, detayKimlikBelgeTuru === 1 ? detayPasaportNo : detayVergiKimlikNo)}
                      disabled={isSearchingMasak}
                      title="MASAK Listelerinde Sorgula"
                    >
                      {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                    </Button>
                    {detayKimlikBelgeTuru !== 1 && (
                      <GibFisDugmesi no={detayVergiKimlikNo} bekliyor={gibSorgulaniyor} onClick={() => void gibDugmesineBasildi()} />
                    )}
                  </InputGroup>
                </div>

                {/* Cari Kodu */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: 60, minWidth: 60, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">Cari Kodu</label>
                  <InputGroup size="sm" style={{ width: "135px" }}>
                    <Form.Control
                      ref={cariKodRef}
                      size="sm"
                      value={cariKod}
                      onChange={(e) => setCariKod(e.target.value)}
                      onKeyDown={(e) => handleHeaderKeyDown(e, "kodu")}
                      className="font-monospace"
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      variant="outline-secondary"
                      className="px-2 py-0 d-flex align-items-center"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const term = (cariKod || "").trim();
                        lastModalCallerRef.current = "cariKod";
                        setCariSearchField("kod");
                        setCariSearchTerm(term);
                        setShowCariModal(true);
                        if (cariList.length === 0) {
                          CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                          DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const term = (cariKod || "").trim();
                        lastModalCallerRef.current = "cariKod";
                        setCariSearchField("kod");
                        setCariSearchTerm(term);
                        setShowCariModal(true);
                        if (cariList.length === 0) {
                          CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                          DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                        }
                      }}
                      title="Cari / Müşteri Seç"
                    >
                      <IconBinoculars size={14} />
                    </Button>
                  </InputGroup>
                </div>

                {/* Adı (+ Dürbün + MASAK) */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: 30, minWidth: 30, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">Adı</label>
                  <InputGroup size="sm" style={{ width: "240px", maxWidth: "260px" }}>
                    <Form.Control
                      ref={adRef}
                      value={unvan}
                      onChange={(e) => {
                        setUnvan(e.target.value);
                        if (cariKartId) setCariKartId(null);
                      }}
                      onBlur={() => {
                        if (!unvan || !unvan.trim()) {
                          setUnvan(DEFAULT_CUSTOMER_NAME);
                        }
                      }}
                      onKeyDown={(e) => handleHeaderKeyDown(e, "ad")}
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      variant="outline-secondary"
                      className="px-2 py-0 d-flex align-items-center"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const raw = (unvan || "").trim();
                        const term = isAnonymousCustomerName(raw) ? "" : raw;
                        lastModalCallerRef.current = "unvan";
                        setCariSearchField("unvan");
                        setCariSearchTerm(term);
                        setShowCariModal(true);
                        if (cariList.length === 0) {
                          CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                          DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const raw = (unvan || "").trim();
                        const term = isAnonymousCustomerName(raw) ? "" : raw;
                        lastModalCallerRef.current = "unvan";
                        setCariSearchField("unvan");
                        setCariSearchTerm(term);
                        setShowCariModal(true);
                        if (cariList.length === 0) {
                          CariService.getCariKartlar().then((r) => setCariList(r || [])).catch(() => { });
                          DovizFisService.getKayitsizMusteriler().then((r) => setKayitsizMusteriList(r || [])).catch(() => { });
                        }
                      }}
                      title="Cari / Müşteri Seç"
                    >
                      <IconBinoculars size={14} />
                    </Button>
                    <Button
                      variant="outline-danger"
                      className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                      onClick={() => handleSearchMasak(unvan, detayVergiKimlikNo)}
                      disabled={isSearchingMasak}
                      title="İsim ve TC/VKN ile MASAK Listelerinde Sorgula"
                    >
                      {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={14} color="#dc2626" />}
                    </Button>
                  </InputGroup>
                </div>
              </div>

              {/* 2. Satır: Seri No | Belge No | İstatistik Kodu | Has Kuru */}
              <div className="d-flex align-items-center gap-3 mb-1 flex-wrap">
                {/* Seri No */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">Seri No</label>
                  <Form.Control
                    ref={seriNoRef}
                    size="sm"
                    maxLength={20}
                    placeholder="Otomatik"
                    title="Fiş Seri No (Boş bırakılırsa numaratörden otomatik atanır)"
                    value={seriNo}
                    onChange={(e) => setSeriNo(e.target.value.toUpperCase())}
                    onBlur={() => {
                      if (isDuzeltmeMode && seriNo.trim()) {
                        const sUpper = seriNo.trim().toUpperCase();
                        const found = fisList.find((f: any) => (f.seriNo || "").trim().toUpperCase() === sUpper || (f.fisNo || "").trim().toUpperCase() === sUpper);
                        if (found) loadFisById(found.sarrafFisiId);
                      }
                    }}
                    readOnly={!kYetki.fisNoDegistirme}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isDuzeltmeMode && seriNo.trim()) {
                        const sUpper = seriNo.trim().toUpperCase();
                        const found = fisList.find((f: any) => (f.seriNo || "").trim().toUpperCase() === sUpper || (f.fisNo || "").trim().toUpperCase() === sUpper);
                        if (found) {
                          loadFisById(found.sarrafFisiId);
                          return;
                        }
                      }
                      handleHeaderKeyDown(e, "seriNo");
                    }}
                    className="font-monospace"
                    style={{ width: "120px" }}
                  />
                </div>

                {/* Belge No */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">Belge No</label>
                  <Form.Control
                    ref={belgeNoRef}
                    size="sm"
                    maxLength={20}
                    placeholder="Otomatik"
                    title="Belge No"
                    value={fisNo}
                    onChange={(e) => setFisNo(e.target.value)}
                    onBlur={() => {
                      if (isDuzeltmeMode && fisNo.trim()) {
                        const bUpper = fisNo.trim().toUpperCase();
                        const found = fisList.find((f: any) => (f.belgeNo || "").trim().toUpperCase() === bUpper || (f.fisNo || "").trim().toUpperCase() === bUpper || (f.seriNo || "").trim().toUpperCase() === bUpper);
                        if (found) loadFisById(found.sarrafFisiId);
                      }
                    }}
                    readOnly={!kYetki.fisNoDegistirme}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isDuzeltmeMode && fisNo.trim()) {
                        const bUpper = fisNo.trim().toUpperCase();
                        const found = fisList.find((f: any) => (f.belgeNo || "").trim().toUpperCase() === bUpper || (f.fisNo || "").trim().toUpperCase() === bUpper || (f.seriNo || "").trim().toUpperCase() === bUpper);
                        if (found) {
                          loadFisById(found.sarrafFisiId);
                          return;
                        }
                      }
                      handleHeaderKeyDown(e, "belgeNo");
                    }}
                    className="font-monospace"
                    style={{ width: "120px" }}
                  />
                </div>

                {/* İstatistik */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ width: 55, minWidth: 55, fontSize: "12px", fontWeight: 600 }} className="mb-0 text-secondary">İstatistik</label>
                  <InputGroup size="sm" style={{ width: "135px" }}>
                    <Form.Control
                      ref={istatistikRef}
                      type="text"
                      size="sm"
                      autoComplete="off"
                      value={istatistikKodu}
                      maxLength={20}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 20);
                        setIstatistikKodu(val);
                        const clean = val.trim().toLowerCase();
                        if (!clean) {
                          setIstatistikId(null);
                          setSelectedStatistic(null);
                          setIstatistikFisDizaynTipi(null);
                        } else {
                          const match = statisticList.find((s) => s.kod && s.kod.trim().toLowerCase() === clean);
                          if (match) {
                            setIstatistikId(match.id);
                            setSelectedStatistic(match);
                            const dizayn = match.fisDizaynTipi !== undefined && match.fisDizaynTipi !== null ? Number(match.fisDizaynTipi) : 0;
                            setIstatistikFisDizaynTipi(dizayn);
                          }
                        }
                      }}
                      onBlur={() => {
                        const clean = (istatistikKodu || "").trim().toLowerCase();
                        if (clean) {
                          const match = statisticList.find((s) => s.kod && s.kod.trim().toLowerCase() === clean);
                          if (match) {
                            setIstatistikId(match.id);
                            setSelectedStatistic(match);
                            const dizayn = match.fisDizaynTipi !== undefined && match.fisDizaynTipi !== null ? Number(match.fisDizaynTipi) : 0;
                            setIstatistikFisDizaynTipi(dizayn);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "F3") {
                          e.preventDefault();
                          e.stopPropagation();
                          const term = (istatistikKodu || "").trim();
                          const q = term.toLowerCase();
                          if (term) {
                            const matched = statisticList.filter((s) => {
                              const fType = Number(s.fisTipi);
                              const typeMatch = tip === 0 ? (fType === 0 || fType === 2) : (fType === 1 || fType === 2);
                              return typeMatch && ((s.kod || "").toLowerCase().includes(q) || (s.aciklama || "").toLowerCase().includes(q));
                            });
                            if (matched.length === 1) {
                              const single = matched[0];
                              setIstatistikId(single.id);
                              setIstatistikKodu(single.kod);
                              setSelectedStatistic(single);
                              const dizayn = single.fisDizaynTipi !== undefined && single.fisDizaynTipi !== null ? Number(single.fisDizaynTipi) : 0;
          setIstatistikFisDizaynTipi(dizayn);
                              lastFocusedIstatistikKodRef.current = single.kod;
                              hasKuruRef.current?.focus();
                              hasKuruRef.current?.select();
                              return;
                            }
                          }
                          setIstatistikSearchTerm(term);
                          setShowIstatistikModal(true);
                        } else {
                          handleHeaderKeyDown(e, "istatistik");
                        }
                      }}
                      className="font-monospace text-center px-1"
                      title="İstatistik Kodu (F3 ile seçebilirsiniz)"
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      variant="outline-secondary"
                      className="px-2 py-0 d-flex align-items-center justify-content-center"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        lastModalCallerRef.current = "istatistik";
                        setIstatistikSearchTerm("");
                        setShowIstatistikModal(true);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        lastModalCallerRef.current = "istatistik";
                        setIstatistikSearchTerm("");
                        setShowIstatistikModal(true);
                      }}
                      title="F3) İstatistik Kodu Seçimi"
                    >
                      <IconBinoculars size={14} />
                    </Button>
                  </InputGroup>
                </div>

                {/* Has Kuru */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }} className="mb-0 text-secondary">Has Kuru</label>
                  <Form.Control
                    ref={hasKuruRef}
                    type="number"
                    size="sm"
                    value={altinHasKuru}
                    onChange={(e) => handleAltinHasKuruChange(e.target.value)}
                    onBlur={() => {
                      const kurVal = parseDecimal(altinHasKuru);
                      if (kurVal > 0) {
                        const { alis, satis } = getHasKurAlisSatis();
                        const ref = tip === 0 ? alis : satis;
                        const gise = (ref > 0 || alis > 0 || satis > 0) ? { kur: ref || alis || satis, alis: alis || null, satis: satis || null } : null;
                        if (gise) {
                          const res = kurDegeriniSinirla(kYetkiRef.current, gise, kurVal, 2);
                          if (res.degisti) {
                            handleAltinHasKuruChange(String(res.kur));
                            if (res.mesaj) showNotif("warning", res.mesaj);
                          }
                        }
                      }
                    }}
                    disabled={!kurAcik}
                    readOnly={!kurAcik}
                    title={kurAcik ? undefined : "Kur değiştirme yetkiniz yok"}
                    onKeyDown={(e) => handleHeaderKeyDown(e, "hasKuru")}
                    className="font-monospace text-end"
                    style={{ width: "95px" }}
                  />
                </div>

                {/* e-Belge KDV kodu (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF29): kuyumculuk GİB kodları dürbünü */}
                <div className="d-flex align-items-center gap-1">
                  <label style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", opacity: isKdvDisabled ? 0.6 : 1 }} className="mb-0 text-secondary"
                    title={tip === 0 ? "Alış fişi gider pusulasına gider; GİB gider pusulasında bu kod yazılmaz, fişte saklanır." : "Faturada altın satırı KDV %0 ile bu kodla gider (805 seçiliyken gümüş 808)."}>
                    KDV Kodu
                  </label>
                  <KuyumKodDurbun
                    inputRef={kdvKoduRef}
                    value={isKdvDisabled ? "" : istisnaKodu}
                    onChange={(val) => {
                      if (!isKdvDisabled) {
                        setIstisnaKodu(val);
                        if (val && val.trim()) lastActiveIstisnaKoduRef.current = val.trim();
                      }
                    }}
                    onAdvance={() => {
                      const firstLine = linesRef.current[0] || lines[0];
                      if (firstLine) {
                        setActiveRowIndex(0);
                        focusGridCell(firstLine.id, "urunKodu", "select");
                        setTimeout(() => {
                          focusGridCell(firstLine.id, "urunKodu", "select");
                        }, 50);
                        setTimeout(() => {
                          focusGridCell(firstLine.id, "urunKodu", "select");
                        }, 180);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        const { isAtStart } = getSelectionBounds(e.currentTarget);
                        if (isAtStart) {
                          e.preventDefault();
                          hasKuruRef.current?.focus();
                          hasKuruRef.current?.select();
                        }
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        if (lines.length > 0) {
                          setActiveRowIndex(0);
                          focusGridCell(lines[0].id, "urunKodu", "select");
                        }
                      }
                    }}
                    disabled={isKdvDisabled}
                    isInvalid={!isKdvDisabled && tip === 1 && !(parseDecimal(kdvOrani) > 0) && !istisnaKodu.trim()}
                  />
                  {tip === 0 && <span className="text-muted" style={{ fontSize: "10px", whiteSpace: "nowrap" }}>(gider pusulasına yazılmaz)</span>}
                </div>
              </div>
            </div>

            {/* Sağ Alan: Cari Bakiye Durumu (Cari Seçildiğinde) */}
            {cariKartId ? (
              <div
                style={{
                  flex: "0 0 240px",
                  minWidth: "200px",
                  maxWidth: "260px",
                  borderLeft: "1px solid #cbd5e1",
                  paddingLeft: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {isLoadingCariBakiye ? (
                  <div className="text-center text-muted small py-2 bg-white rounded border p-2">
                    <Spinner animation="border" size="sm" className="me-2 text-primary" />
                    Bakiye yükleniyor...
                  </div>
                ) : cariBakiyeSummary ? (
                  <div className="bg-white rounded p-2 border shadow-sm" style={{ fontSize: "11.5px" }}>
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="text-muted fw-bold" style={{ fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Cari Bakiyesi
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none text-secondary d-flex align-items-center gap-1"
                        style={{ fontSize: "10px" }}
                        onClick={() => loadCariBakiye(cariKartId)}
                        title="Bakiyeyi Yenile"
                      >
                        <IconRefresh size={12} />
                        Yenile
                      </Button>
                    </div>

                    {/* Sadece Net HAS Bakiye Değeri */}
                    <div className="d-flex align-items-baseline gap-1 mt-1">
                      <span className="fw-bold font-monospace text-dark" style={{ fontSize: "14px" }}>
                        {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(cariBakiyeSummary.netHasBakiye || 0)} HAS
                      </span>
                      {cariBakiyeSummary.netHasYon === "A" && cariBakiyeSummary.netHasBakiye > 0.0001 && (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626" }}>
                          (Alacak)
                        </span>
                      )}
                      {cariBakiyeSummary.netHasYon === "B" && cariBakiyeSummary.netHasBakiye > 0.0001 && (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a" }}>
                          (Borç)
                        </span>
                      )}
                    </div>
                    {cariBakiyeSummary.satirlar && cariBakiyeSummary.satirlar.length > 0 && (
                      <div
                        className="text-muted mt-1 pt-1 border-top"
                        style={{ fontSize: "10.5px", lineHeight: "1.3" }}
                      >
                        {cariBakiyeSummary.satirlar.map((s, idx) => (
                          <span key={s.kod || idx} className="d-inline-block me-1 fw-semibold" style={{ color: s.yon === "B" ? "#16a34a" : "#dc2626" }}>
                            {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(s.netBakiye)} {s.kod}
                            <span className="opacity-75 ms-0.5">({s.yon === "B" ? "Borç" : "Alacak"})</span>
                            {idx < cariBakiyeSummary.satirlar.length - 1 ? " • " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card.Body>
      </Card>

      {/* ─── 2. Satır Tablosu (Kalemler) (Ayrı Dış Dikdörtgen Kutu) ─── */}
      <Card className="shadow-sm mb-2 border rounded-2 fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          {/* Kolon Görünürlük Kontrol Şeridi */}
          <div className="d-flex align-items-center justify-content-end gap-1" style={{ marginBottom: "2px", lineHeight: 1 }}>
            <Dropdown autoClose="outside" align="end">
              <Dropdown.Toggle
                variant="outline-secondary"
                size="sm"
                className="d-flex align-items-center gap-1 py-0 px-1.5"
                style={{ fontSize: "11px", height: "20px", lineHeight: 1 }}
                id="sarraf-grid-col-toggle"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                Kolonlar
              </Dropdown.Toggle>
              <Dropdown.Menu
                popperConfig={{ strategy: "fixed" }}
                style={{ minWidth: "185px", fontSize: "13px", padding: "6px 4px", zIndex: 2050, maxHeight: "360px", overflowY: "auto" }}
              >
                <div className="px-2 pb-1 text-muted" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px" }}>GÖRÜNÜR KOLONLAR</div>
                {([
                  { key: "urunAdi", label: "Ürün Adı" },
                  { key: "adet", label: "Adet" },
                  { key: "miktar", label: "Miktar" },
                  { key: "milyem", label: "Milyem" },
                  { key: "hasGram", label: "Has" },
                  { key: "tlTutar", label: "TL Tutar" },
                  { key: "iscilikHesaplamaSekli", label: "İşçilik Şekli" },
                  { key: "iscilikiMiktari", label: userIscilikGirisSekli === 0 ? "İşçilik/T" : "İşçilik/M" },
                  { key: "iscilikHasGram", label: "İşçilik (Has)" },
                  { key: "iscilikTutari", label: "İşçilik (TL)" },
                  { key: "iscilikKdvOrani", label: "İşçilik KDV (%)" },
                  { key: "iscilikKdvTutari", label: "İşçilik KDV Tutar" },
                  { key: "iscilikToplam", label: "İşçilik Toplam" },
                  { key: "kur", label: "Kur" },
                  { key: "tutar", label: "Toplam Tutar" },
                ] as { key: keyof typeof defaultColVisibility; label: string }[]).map(({ key, label }) => (
                  <Dropdown.Item
                    key={key}
                    as="button"
                    className="d-flex align-items-center gap-2 py-1"
                    onClick={() => toggleCol(key)}
                  >
                    <span
                      style={{
                        width: "14px", height: "14px", border: "1.5px solid #6c757d",
                        borderRadius: "3px", display: "inline-flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                        backgroundColor: colVisibility[key] ? "#0d6efd" : "transparent",
                      }}
                    >
                      {colVisibility[key] && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="1,6 4,9 11,2" /></svg>
                      )}
                    </span>
                    <span style={{ color: colVisibility[key] ? "#212529" : "#adb5bd" }}>{label}</span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
          <div style={{ overflowX: "auto" }}>
            <Table bordered size="sm" hover className="mb-0" style={{ fontSize: "11.5px", width: "100%" }}>
              <thead style={{ background: "#d9e8fb", color: "#000" }}>
                <tr className="text-center align-middle">
                  <th style={{ width: 25 }} className="text-center">#</th>
                  <th style={{ width: 110 }} className="text-center">Ürün kodu</th>
                  {colVisibility.urunAdi && <th style={{ width: 140 }} className="text-center">Ürün adı</th>}
                  {colVisibility.adet && <th style={{ width: 55 }} className="text-center">Adet</th>}
                  {colVisibility.miktar && <th style={{ width: linesMiktarColWidth, minWidth: linesMiktarColWidth }} className="text-center">Miktar</th>}
                  {colVisibility.milyem && <th style={{ width: 70 }} className="text-center">Milyem</th>}
                  {colVisibility.hasGram && <th style={{ width: 85 }} className="text-center">Has</th>}
                  {colVisibility.tlTutar && <th style={{ width: 95 }} className="text-center">TL Tutar</th>}
                  {colVisibility.iscilikHesaplamaSekli && <th style={{ width: 85 }} className="text-center">İşçilik şekli</th>}
                  {colVisibility.iscilikiMiktari && <th style={{ width: 85 }} className="text-center">{userIscilikGirisSekli === 0 ? "İşçilik/T" : "İşçilik/M"}</th>}
                  {colVisibility.iscilikHasGram && <th style={{ width: 85 }} className="text-center">İşçilik (Has)</th>}
                  {colVisibility.iscilikTutari && <th style={{ width: 90 }} className="text-center">İşçilik (TL)</th>}
                  {colVisibility.iscilikKdvOrani && <th style={{ width: 80 }} className="text-center">İşçilik KDV (%)</th>}
                  {colVisibility.iscilikKdvTutari && <th style={{ width: 95 }} className="text-center">İşçilik KDV Tutar</th>}
                  {colVisibility.iscilikToplam && <th style={{ width: 95 }} className="text-center">İşçilik Toplam</th>}
                  {colVisibility.kur && <th style={{ width: 105 }} className="text-center">Kur</th>}
                  {colVisibility.tutar && <th style={{ width: 110 }} className="text-center">Toplam Tutar</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((row, rowIndex) => {
                  const hasProduct = Boolean((row.urunKodu && row.urunKodu.trim() !== "") || (row.urunAdi && row.urunAdi.trim() !== "") || row.urunId > 0 || (row.kur && Number(row.kur) > 0));
                  const effTipi = resolveEffectiveUrunTipi({ urunTipi: row.urunTipi, kod: row.urunKodu, ad: row.urunAdi });
                  const isPara = effTipi === 0 && Boolean(row.urunKodu && row.urunKodu.trim());
                  const isZiynet = effTipi === 3 || isZiynetProduct({ urunTipi: row.urunTipi, kod: row.urunKodu, ad: row.urunAdi });
                  const isParaOrZiynet = isPara || isZiynet;
                  const isAdetMissing = hasProduct && isParaOrZiynet && (!row.adet || String(row.adet).trim() === "" || parseDecimal(row.adet) <= 0);
                  const isMiktarMissing = hasProduct && !isParaOrZiynet && (!row.miktar || String(row.miktar).trim() === "" || parseDecimal(row.miktar) <= 0);
                  const isKurMissing = !row.kur || parseDecimal(row.kur) <= 0;

                  const handleKalemRowFocus = () => {
                    cleanupEmptyRows(rowIndex);
                    cleanupEmptyOdemeRows();
                    setActiveRowIndex(rowIndex);
                  };

                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      data-table-type="kalemler"
                      style={rowIndex === activeRowIndex ? { background: "#edf5ff" } : {}}
                    >
                      <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                        {rowIndex + 1}
                      </td>

                      {/* Ürün kodu */}
                      <td>
                        <InputGroup size="sm">
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_urunKodu`] = el; }}
                            value={row.urunKodu}
                            onChange={(e) => {
                              const val = e.target.value;
                              const kUpper = val.trim().toUpperCase();
                              if (kUpper === "TL" || kUpper === "TRY") {
                                showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                updateRow(row.id, "urunKodu", "");
                                return;
                              }
                              updateRow(row.id, "urunKodu", val);
                              const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                              if (match) {
                                const matchK = (match.kod || "").trim().toUpperCase();
                                if (matchK === "TL" || matchK === "TRY" || (match.ad || "").toUpperCase().includes("TÜRK LİRASI")) {
                                  showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                  updateRow(row.id, "urunKodu", "");
                                  return;
                                }
                                applyProductToRow(row.id, match);
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              const kUpper = val.toUpperCase();
                              if (kUpper === "TL" || kUpper === "TRY") {
                                showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                updateRow(row.id, "urunKodu", "");
                                setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                                return;
                              }
                              if (val) {
                                const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                                if (match) {
                                  const matchK = (match.kod || "").trim().toUpperCase();
                                  if (matchK === "TL" || matchK === "TRY" || (match.ad || "").toUpperCase().includes("TÜRK LİRASI")) {
                                    showNotif("warning", "Sarraf fişinde kalemler tablosunda TL seçilemez.");
                                    updateRow(row.id, "urunKodu", "");
                                    setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                                    return;
                                  }
                                  applyProductToRow(row.id, match);
                                }
                              }
                              setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "F4") {
                                e.preventDefault();
                                e.stopPropagation();
                                openUrunModal(row.id);
                                return;
                              }
                              handleGridKeyDown(e, rowIndex, "urunKodu", row.id);
                            }}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              textTransform: "uppercase",
                            }}
                          />
                          <Button
                            type="button"
                            tabIndex={-1}
                            variant="outline-secondary"
                            className="px-1 py-0 d-flex align-items-center"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openUrunModal(row.id);
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openUrunModal(row.id);
                            }}
                            title="Ürün Seç (F3/F4)"
                          >
                            <IconBinoculars size={12} />
                          </Button>
                        </InputGroup>
                      </td>

                      {/* Ürün adı - read only */}
                      {colVisibility.urunAdi && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_urunAdi`] = el; }}
                            size="sm"
                            value={row.urunAdi}
                            readOnly
                            onFocus={handleKalemRowFocus}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "urunAdi", row.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", background: "#e9ecef" }}
                          />
                        </td>
                      )}

                      {/* Adet */}
                      {colVisibility.adet && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_adet`] = el; }}
                            inputMode={isPara ? "decimal" : "numeric"}
                            data-decimal={isPara ? "true" : undefined}
                            size="sm"
                            readOnly={false}
                            className={`text-end font-monospace ${isAdetMissing ? "is-invalid border-danger border-2 text-danger fw-bold" : ""}`}
                            value={row.adet ?? ""}
                            onChange={(e) => {
                              const input = e.currentTarget as HTMLInputElement;
                              handleNumericFormattedChange(input, (val) => updateRow(row.id, "adet", val));
                            }}
                            onKeyDown={(e) => {
                              if (isPara) {
                                handleNumericDotKeyDown(e, (val) => updateRow(row.id, "adet", val));
                              }
                              if (!e.defaultPrevented) {
                                handleGridKeyDown(e, rowIndex, "adet", row.id);
                              }
                            }}
                            onBlur={() => {
                              normalizeRowOnBlur(row.id, "adet");
                              setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }));
                            }}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isAdetMissing ? "#fee2e2" : undefined,
                              border: isAdetMissing ? "2px solid #dc2626" : undefined,
                              boxShadow: isAdetMissing ? "0 0 0 2px rgba(220, 38, 38, 0.4)" : undefined,
                            }}
                            title={isAdetMissing ? "Lütfen adet giriniz" : undefined}
                          />
                        </td>
                      )}

                      {/* Miktar */}
                      {colVisibility.miktar && (
                        <td style={{ width: linesMiktarColWidth, minWidth: linesMiktarColWidth, backgroundColor: isMiktarMissing ? "#fee2e2" : (isParaOrZiynet ? "#e9ecef" : undefined) }}>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_miktar`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            readOnly={isParaOrZiynet}
                            tabIndex={isParaOrZiynet ? -1 : undefined}
                            className={`text-end font-monospace ${isMiktarMissing ? "is-invalid border-danger border-2 text-danger fw-bold" : ""} ${isParaOrZiynet ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : (row.miktar ?? "")}
                            onChange={(e) => {
                              if (!isParaOrZiynet) {
                                const input = e.currentTarget as HTMLInputElement;
                                handleNumericFormattedChange(input, (val) => updateRow(row.id, "miktar", val));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (!isParaOrZiynet) {
                                handleNumericDotKeyDown(e, (val) => updateRow(row.id, "miktar", val));
                              }
                              if (!e.defaultPrevented) {
                                handleGridKeyDown(e, rowIndex, "miktar", row.id);
                              }
                            }}
                            onBlur={() => normalizeRowOnBlur(row.id, "miktar")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isParaOrZiynet ? "#e9ecef" : (isMiktarMissing ? "#fee2e2" : undefined),
                              border: isMiktarMissing ? "2px solid #dc2626" : undefined,
                              boxShadow: isMiktarMissing ? "0 0 0 2px rgba(220, 38, 38, 0.4)" : undefined,
                              cursor: isParaOrZiynet ? "not-allowed" : undefined,
                            }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde adet çalışır, miktar pasiftir" : isMiktarMissing ? "Lütfen miktar giriniz" : undefined}
                          />
                        </td>
                      )}

                      {/* Milyem */}
                      {colVisibility.milyem && (
                        <td
                          style={{
                            backgroundColor: (isParaOrZiynet || !milyemAcik) ? "#e9ecef" : undefined,
                            cursor: (isParaOrZiynet || !milyemAcik) ? "not-allowed" : undefined,
                          }}
                          title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde milyem girilmez" : (!milyemAcik ? "Milyem değiştirme yetkiniz yok" : undefined)}
                        >
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_milyem`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            disabled={isParaOrZiynet || !milyemAcik}
                            readOnly={isParaOrZiynet || !milyemAcik}
                            tabIndex={isParaOrZiynet || !milyemAcik ? -1 : undefined}
                            className={`text-end font-monospace ${(isParaOrZiynet || !milyemAcik) ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : row.milyem}
                            onChange={(e) => !isParaOrZiynet && milyemAcik && updateRow(row.id, "milyem", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "milyem", row.id)}
                            onBlur={() => !isParaOrZiynet && milyemAcik && normalizeRowOnBlur(row.id, "milyem")}
                            onFocus={(e) => {
                              if (isParaOrZiynet || !milyemAcik) {
                                e.currentTarget.blur();
                                return;
                              }
                              handleKalemRowFocus();
                              if (!row.refMilyem && row.milyem && parseDecimal(row.milyem) > 0) {
                                row.refMilyem = row.milyem;
                              }
                            }}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: (isParaOrZiynet || !milyemAcik) ? "#e9ecef" : undefined,
                              cursor: (isParaOrZiynet || !milyemAcik) ? "not-allowed" : undefined,
                              pointerEvents: (isParaOrZiynet || !milyemAcik) ? "none" : undefined,
                              userSelect: (isParaOrZiynet || !milyemAcik) ? "none" : undefined,
                            }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde milyem girilmez" : (!milyemAcik ? "Milyem değiştirme yetkiniz yok" : undefined)}
                          />
                        </td>
                      )}

                      {/* Has (Gr) - Pasif / Otomatik Hesaplanır */}
                      {colVisibility.hasGram && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_hasGram`] = el; }}
                            readOnly
                            tabIndex={-1}
                            size="sm"
                            className="text-end font-monospace text-muted"
                            value={isParaOrZiynet ? "" : (row.hasGram !== "" && !isNaN(Number(row.hasGram)) ? Number(row.hasGram).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : row.hasGram)}
                            onFocus={handleKalemRowFocus}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "hasGram", row.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde has gram hesaplanmaz" : "Altın has gramı otomatik hesaplanır, değiştirilemez"}
                          />
                        </td>
                      )}

                      {/* TL Tutar (Has'tan sonra) */}
                      {colVisibility.tlTutar && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_tlTutar`] = el; }}
                            readOnly
                            tabIndex={-1}
                            size="sm"
                            className="text-end font-monospace text-muted"
                            value={row.tlTutar !== "" && !isNaN(Number(row.tlTutar)) ? Number(row.tlTutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (row.tlTutar || "")}
                            onFocus={handleKalemRowFocus}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "tlTutar", row.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                            title="TL Tutar"
                          />
                        </td>
                      )}

                      {/* İşçilik şekli */}
                      {colVisibility.iscilikHesaplamaSekli && (
                        <td>
                          <Form.Select
                            size="sm"
                            disabled={isParaOrZiynet}
                            tabIndex={isParaOrZiynet ? -1 : undefined}
                            value={isParaOrZiynet ? 0 : row.iscilikHesaplamaSekli}
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHesaplamaSekli`] = el; }}
                            onChange={(e) => !isParaOrZiynet && updateRow(row.id, "iscilikHesaplamaSekli", Number(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                                e.preventDefault();
                                e.stopPropagation();
                                const nextVal = ((Number(row.iscilikHesaplamaSekli) || 0) + 1) % 4;
                                updateRow(row.id, "iscilikHesaplamaSekli", nextVal);
                                return;
                              }
                              handleGridKeyDown(e, rowIndex, "iscilikHesaplamaSekli", row.id);
                            }}
                            onBlur={() => setInvalidRowIds((prev) => ({ ...prev, [row.id]: true }))}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "10.5px",
                              padding: "1px 2px",
                              backgroundColor: isParaOrZiynet ? "#e9ecef" : undefined,
                              cursor: isParaOrZiynet ? "not-allowed" : undefined,
                            }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde işçilik uygulanmaz" : undefined}
                          >
                            <option value={0}>Gram</option>
                            <option value={1}>Adet</option>
                            <option value={2}>Toplam</option>
                          </Form.Select>
                        </td>
                      )}

                      {/* İşçilik miktarı */}
                      {colVisibility.iscilikiMiktari && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikiMiktari`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            readOnly={isParaOrZiynet}
                            tabIndex={isParaOrZiynet ? -1 : undefined}
                            className={`text-end font-monospace ${isParaOrZiynet ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : row.iscilikiMiktari}
                            onChange={(e) => !isParaOrZiynet && updateRow(row.id, "iscilikiMiktari", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikiMiktari", row.id)}
                            onBlur={() => !isParaOrZiynet && normalizeRowOnBlur(row.id, "iscilikiMiktari")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isParaOrZiynet ? "#e9ecef" : undefined,
                              cursor: isParaOrZiynet ? "not-allowed" : undefined,
                            }}
                            title={
                              isParaOrZiynet
                                ? "Döviz ve Ziynet işlemlerinde işçilik uygulanmaz"
                                : userIscilikGirisSekli === 0
                                  ? "İşçilik (Tam Sayı: örn. 25 girildiğinde 0,025 olarak hesaplanır)"
                                  : "İşçilik (Milyem: girilen değer doğrudan hesaplanır)"
                            }
                          />
                        </td>
                      )}

                      {/* İşçilik Has Gram - Pasif / Otomatik Hesaplanır */}
                      {colVisibility.iscilikHasGram && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikHasGram`] = el; }}
                            readOnly
                            tabIndex={-1}
                            size="sm"
                            className="text-end font-monospace text-muted"
                            value={isParaOrZiynet ? "" : (row.iscilikHasGram !== "" && !isNaN(Number(row.iscilikHasGram)) ? Number(row.iscilikHasGram).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : row.iscilikHasGram)}
                            onFocus={handleKalemRowFocus}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikHasGram", row.id)}
                            style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde işçilik uygulanmaz" : "İşçilik has gramı otomatik hesaplanır, değiştirilemez"}
                          />
                        </td>
                      )}

                      {/* İşçilik (TL) - Girilebilir & Otomatik Hesaplanır */}
                      {colVisibility.iscilikTutari && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikTutari`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            readOnly={isParaOrZiynet}
                            tabIndex={isParaOrZiynet ? -1 : undefined}
                            className={`text-end font-monospace ${isParaOrZiynet ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : (row.iscilikTutari !== "" && row.iscilikTutari !== null && row.iscilikTutari !== undefined ? row.iscilikTutari : "")}
                            onChange={(e) => !isParaOrZiynet && updateRow(row.id, "iscilikTutari", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikTutari", row.id)}
                            onBlur={() => !isParaOrZiynet && normalizeRowOnBlur(row.id, "iscilikTutari")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isParaOrZiynet ? "#e9ecef" : undefined,
                              cursor: isParaOrZiynet ? "not-allowed" : undefined,
                            }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde işçilik uygulanmaz" : "İşçilik tutarı (TL) - Girildiğinde işçilik ve has hesaplanır"}
                          />
                        </td>
                      )}

                      {/* İşçilik KDV Oranı (%) */}
                      {colVisibility.iscilikKdvOrani && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikKdvOrani`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            readOnly={isParaOrZiynet || isKdvDisabled}
                            tabIndex={(isParaOrZiynet || isKdvDisabled) ? -1 : undefined}
                            className={`text-end font-monospace ${(isParaOrZiynet || isKdvDisabled) ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : (row.iscilikKdvOrani ?? "")}
                            onChange={(e) => !(isParaOrZiynet || isKdvDisabled) && updateRow(row.id, "iscilikKdvOrani", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikKdvOrani", row.id)}
                            onBlur={() => !(isParaOrZiynet || isKdvDisabled) && normalizeRowOnBlur(row.id, "iscilikKdvOrani")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: (isParaOrZiynet || isKdvDisabled) ? "#e9ecef" : undefined,
                              cursor: (isParaOrZiynet || isKdvDisabled) ? "not-allowed" : undefined,
                            }}
                            placeholder={(isParaOrZiynet || isKdvDisabled) ? "" : "%"}
                            title={
                              isParaOrZiynet
                                ? "Döviz ve Ziynet işlemlerinde KDV uygulanmaz"
                                : isKdvDisabled
                                  ? "Fiş Dizayn Tipi 1 olduğunda KDV pasiftir"
                                  : "İşçilik KDV Oranı (%)"
                            }
                          />
                        </td>
                      )}

                      {/* İşçilik KDV Tutar */}
                      {colVisibility.iscilikKdvTutari && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikKdvTutari`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            readOnly={isParaOrZiynet || isKdvDisabled}
                            tabIndex={(isParaOrZiynet || isKdvDisabled) ? -1 : undefined}
                            className={`text-end font-monospace ${(isParaOrZiynet || isKdvDisabled) ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : (row.iscilikKdvTutari !== "" && row.iscilikKdvTutari !== null && row.iscilikKdvTutari !== undefined ? row.iscilikKdvTutari : "")}
                            onChange={(e) => !(isParaOrZiynet || isKdvDisabled) && updateRow(row.id, "iscilikKdvTutari", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikKdvTutari", row.id)}
                            onBlur={() => !(isParaOrZiynet || isKdvDisabled) && normalizeRowOnBlur(row.id, "iscilikKdvTutari")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: (isParaOrZiynet || isKdvDisabled) ? "#e9ecef" : undefined,
                              cursor: (isParaOrZiynet || isKdvDisabled) ? "not-allowed" : undefined,
                            }}
                            title={
                              isParaOrZiynet
                                ? "Döviz ve Ziynet işlemlerinde KDV uygulanmaz"
                                : isKdvDisabled
                                  ? "Fiş Dizayn Tipi 1 olduğunda KDV pasiftir"
                                  : "İşçilik KDV Tutarı (TL)"
                            }
                          />
                        </td>
                      )}

                      {/* İşçilik Toplam (İşçilik KDV Tutar'dan sonra) */}
                      {colVisibility.iscilikToplam && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_iscilikToplam`] = el; }}
                            inputMode="decimal"
                            data-decimal="true"
                            size="sm"
                            readOnly={isParaOrZiynet}
                            tabIndex={isParaOrZiynet ? -1 : undefined}
                            className={`text-end font-monospace ${isParaOrZiynet ? "text-muted" : ""}`}
                            value={isParaOrZiynet ? "" : (row.iscilikToplam !== "" && row.iscilikToplam !== null && row.iscilikToplam !== undefined ? row.iscilikToplam : "")}
                            onChange={(e) => !isParaOrZiynet && updateRow(row.id, "iscilikToplam", e.target.value)}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "iscilikToplam", row.id)}
                            onBlur={() => !isParaOrZiynet && normalizeRowOnBlur(row.id, "iscilikToplam")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: isParaOrZiynet ? "#e9ecef" : undefined,
                              cursor: isParaOrZiynet ? "not-allowed" : undefined,
                            }}
                            title={isParaOrZiynet ? "Döviz ve Ziynet işlemlerinde işçilik uygulanmaz" : "İşçilik Toplam (Net İşçilik + KDV)"}
                          />
                        </td>
                      )}

                      {/* Kur */}
                      {colVisibility.kur && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_kur`] = el; }}
                            inputMode="decimal"
                            size="sm"
                            className={`text-end font-monospace ${isKurMissing ? "text-danger fw-bold" : ""}`}
                            value={row.kur}
                            onChange={(e) => kurAcik && updateRow(row.id, "kur", e.target.value)}
                            disabled={!kurAcik}
                            readOnly={!kurAcik}
                            tabIndex={!kurAcik ? -1 : undefined}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "kur", row.id)}
                            onBlur={() => normalizeRowOnBlur(row.id, "kur")}
                            onFocus={handleKalemRowFocus}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: !kurAcik ? "#e9ecef" : (isKurMissing ? "#fee2e2" : undefined),
                              border: isKurMissing ? "1.5px solid #dc2626" : undefined,
                              cursor: !kurAcik ? "not-allowed" : undefined,
                            }}
                            title={!kurAcik ? "Kur değiştirme yetkiniz yok" : isKurMissing ? "Lütfen kur giriniz" : undefined}
                          />
                        </td>
                      )}

                      {/* Toplam Tutar - Pasif / Otomatik Hesaplanır */}
                      {colVisibility.tutar && (
                        <td>
                          <Form.Control
                            ref={(el) => { rowInputRefs.current[`${row.id}_tutar`] = el; }}
                            readOnly
                            tabIndex={-1}
                            size="sm"
                            className="text-end font-monospace text-muted"
                            value={row.tutar !== "" && !isNaN(Number(row.tutar)) ? Number(row.tutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.tutar}
                            onFocus={handleKalemRowFocus}
                            onKeyDown={(e) => handleGridKeyDown(e, rowIndex, "tutar", row.id)}
                            style={{
                              fontSize: "11px",
                              padding: "1px 4px",
                              backgroundColor: "#e9ecef",
                              cursor: "not-allowed",
                            }}
                            title="Toplam Tutar (TL Tutar + İşçilik Toplam)"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                <tr>
                  <td colSpan={colVisibility.urunAdi ? 3 : 2} className="text-end small">Toplam</td>
                  {colVisibility.adet && <td style={{ textAlign: "right" }}>{totalAdet ? totalAdet.toLocaleString("tr-TR") : ""}</td>}
                  {colVisibility.miktar && <td style={{ textAlign: "right" }}>{totalMiktar ? totalMiktar.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ""}</td>}
                  {colVisibility.milyem && <td></td>}
                  {colVisibility.hasGram && <td style={{ textAlign: "right" }}>{totalHasGram ? totalHasGram.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : ""}</td>}
                  {colVisibility.tlTutar && <td style={{ textAlign: "right" }}>{totalTLTutar ? totalTLTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>}
                  {colVisibility.iscilikHesaplamaSekli && <td></td>}
                  {colVisibility.iscilikiMiktari && <td></td>}
                  {colVisibility.iscilikHasGram && <td style={{ textAlign: "right" }}>{totalIscilikHasGram ? totalIscilikHasGram.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : ""}</td>}
                  {colVisibility.iscilikTutari && <td style={{ textAlign: "right" }}>{totalIscilikTutari ? totalIscilikTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>}
                  {colVisibility.iscilikKdvOrani && <td></td>}
                  {colVisibility.iscilikKdvTutari && <td style={{ textAlign: "right" }}>{totalIscilikKdvTutari ? totalIscilikKdvTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>}
                  {colVisibility.iscilikToplam && <td style={{ textAlign: "right" }}>{totalIscilikToplam ? totalIscilikToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>}
                  {colVisibility.kur && <td></td>}
                  {colVisibility.tutar && (
                    <td style={{ textAlign: "right" }}>
                      {totalTutar ? totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL" : ""}
                    </td>
                  )}
                </tr>
              </tfoot>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* ─── 3. Alt Bölüm (Ödeme / Tahsilat Tablosu ve Özet) ─── */}
      <Card className="shadow-sm mb-2 border rounded-2 fis-theme-card" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
        <Card.Body className="p-2 fis-theme-card-body" data-fis-theme="active" style={{ backgroundColor: activeFisThemeBg }}>
          <Row className="g-2 align-items-start">
            {/* SOLDA: Ödeme / Tahsilat Tablosu (Üstteki tablo ile birebir aynı tasarım) */}
            <Col xs={12} lg={8} md={7}>
              <div className="border rounded bg-white shadow-2xs overflow-hidden mb-1">
                <div className="bg-light px-2 py-1 border-bottom">
                  <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                    ÖDEME / TAHSİLAT TABLOSU
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table bordered size="sm" hover className="mb-0" style={{ fontSize: "11.5px", minWidth: 780 }}>
                    <thead style={{ background: "#d9e8fb", color: "#000" }}>
                      <tr className="text-center align-middle">
                        <th style={{ width: 25 }} className="text-center">#</th>
                        <th style={{ width: 85 }} className="text-center">Tür</th>
                        <th style={{ width: 110 }} className="text-center">Kod</th>
                        <th style={{ width: 140 }} className="text-center">Açıklama</th>
                        <th style={{ width: 110 }} className="text-center">Para / İskonto</th>
                        <th style={{ width: odemeAdetColWidth, minWidth: odemeAdetColWidth }} className="text-center">Adet</th>
                        <th style={{ width: odemeMiktarColWidth, minWidth: odemeMiktarColWidth }} className="text-center">Miktar</th>
                        <th style={{ width: 70 }} className="text-center">Milyem</th>
                        <th style={{ width: 85 }} className="text-center">Has</th>
                        <th style={{ width: 105 }} className="text-center">Kur</th>
                        <th style={{ width: 110 }} className="text-center">Tutar (TL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {odemeRows.map((oRow, rowIndex) => {
                        const isOdemeRowValid = isOdemeRowFilled(oRow);
                        const shouldValidateOdeme = !isOdemeRowValid;

                        const isOdemeCari = oRow.odemeAraciTuru === 1;
                        const isOdemeKart = oRow.odemeAraciTuru === 2;
                        const isOdemeHesap = oRow.odemeAraciTuru === 3;
                        // e-Banka banka satırı kilitli: tür, kod, para, adet değişmez (M28)
                        const ebBankaSatiri = Boolean(oRow.ebBanka) && isOdemeHesap;
                        const isOdemeIskonto = Boolean(
                          oRow.iskontoId ||
                          (oRow.odemeAraciTuru === 3 && !oRow.bankaId) ||
                          (oRow.paraKodu && (
                            oRow.paraKodu.trim().toUpperCase().startsWith("ISK") ||
                            oRow.paraKodu.trim().toUpperCase().startsWith("İSK") ||
                            iskontoList.some((isk) => (isk.kod || "").trim().toLowerCase() === oRow.paraKodu?.trim().toLowerCase())
                          )) ||
                          (oRow.paraAdi && (oRow.paraAdi.toUpperCase().includes("İSKONTO") || oRow.paraAdi.toUpperCase().includes("ISKONTO")))
                        );
                        const hasPayment = Boolean((oRow.paraKodu && oRow.paraKodu.trim() !== "") || (oRow.paraAdi && oRow.paraAdi.trim() !== "") || (oRow.odemeAraciTuru !== 0 && oRow.odemeAraciTuru !== undefined) || (oRow.cariKod && oRow.cariKod.trim() !== "") || (oRow.kur && Number(oRow.kur) > 0));
                        const isOdemeZiynet = oRow.urunTipi === 3 || isZiynetProduct({ urunTipi: oRow.urunTipi, kod: oRow.paraKodu, ad: oRow.paraAdi });
                        const isOdemePara = Boolean(
                          !isOdemeZiynet && !isOdemeIskonto && (
                            oRow.urunTipi === 0 ||
                            oRow.urunTipi === undefined ||
                            oRow.urunTipi === null ||
                            oRow.paraKodu?.toUpperCase() === "TL" ||
                            oRow.paraKodu?.toUpperCase() === "TRY"
                          )
                        );
                        const isOdemeParaOrZiynet = isOdemePara || isOdemeZiynet;
                        const isOdemeAltinOrGumus = !isOdemeIskonto && !isOdemeZiynet && (oRow.urunTipi === 1 || oRow.urunTipi === 2 || (!isOdemeParaOrZiynet && oRow.paraKodu !== "TL" && oRow.paraKodu !== "TRY" && oRow.paraKodu !== "TRL"));

                        const isOdemeTL = !isOdemeIskonto && ((oRow.paraKodu || "").trim().toUpperCase() === "TL" || (oRow.paraKodu || "").trim().toUpperCase() === "TRY" || (oRow.paraKodu || "").trim().toUpperCase() === "TRL" || (!oRow.paraKodu && (oRow.odemeAraciTuru === 0 || oRow.odemeAraciTuru === 2)));
                        const isOdemeKurDisabled = !kurAcik || isOdemeTL || isOdemeKart || isOdemeHesap || isOdemeIskonto;

                        const isOdemeAdetMissing = hasPayment && !isOdemeIskonto && !isOdemeAltinOrGumus && isOdemeParaOrZiynet && (!oRow.adet || String(oRow.adet).trim() === "" || parseDecimal(oRow.adet) <= 0);
                        const isOdemeMiktarMissing = hasPayment && !isOdemeIskonto && (isOdemeAltinOrGumus || !isOdemeParaOrZiynet) && (!oRow.miktar || String(oRow.miktar).trim() === "" || parseDecimal(oRow.miktar) <= 0);
                        const isOdemeKurMissing = false;

                        const isInvalidRow = Boolean(invalidOdemeRowIds[oRow.id]);

                        const handleOdemeRowFocus = () => {
                          cleanupEmptyOdemeRows(rowIndex);
                          cleanupEmptyRows();
                          setActiveOdemeRowIndex(rowIndex);
                          setInvalidOdemeRowIds((prev) => {
                            if (!prev[oRow.id]) return prev;
                            const next = { ...prev };
                            delete next[oRow.id];
                            return next;
                          });
                        };

                        return (
                          <tr
                            key={oRow.id}
                            data-row-id={oRow.id}
                            data-table-type="odeme"
                            style={{
                              backgroundColor: isInvalidRow ? "#fee2e2" : (rowIndex === activeOdemeRowIndex ? "#edf5ff" : undefined),
                              border: isInvalidRow ? "2px solid #ef4444" : undefined,
                              transition: "background-color 0.2s ease, border-color 0.2s ease",
                            }}
                            className={isInvalidRow ? "table-danger" : ""}
                          >
                            <td className="text-muted text-center" style={{ padding: "2px", fontSize: "10px", verticalAlign: "middle" }}>
                              {rowIndex + 1}
                            </td>

                            {/* Tür Seçimi (Vezne, Cari, POS, Hesap) */}
                            <td>
                              <Form.Select
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_odemeAraciTuru`] = el; }}
                                size="sm"
                                value={oRow.odemeAraciTuru ?? 0}
                                disabled={ebBankaSatiri}
                                title={ebBankaSatiri ? "e-Banka hareketinin banka satırı; türü değiştirilemez" : undefined}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setInvalidOdemeRowIds((prev) => {
                                    if (!prev[oRow.id]) return prev;
                                    const next = { ...prev };
                                    delete next[oRow.id];
                                    return next;
                                  });
                                  if (val === 3 && defaultIskonto) {
                                    applyIskontoToOdemeRow(oRow.id, defaultIskonto);
                                    return;
                                  }
                                  setOdemeRows((prev) => prev.map((r) => {
                                    if (r.id !== oRow.id) return r;
                                    const isRegisteredCari = Boolean(cariKartId && unvan && !isAnonymousCustomerName(unvan) && unvan !== "NİHAİ TÜKETİCİ");
                                    return {
                                      ...r,
                                      odemeAraciTuru: val,
                                      paraKodu: val === 2 ? "TL" : (val === 3 ? "İSKONTO" : ""),
                                      paraAdi: val === 2 ? "TÜRK LİRASI" : (val === 1 ? (isRegisteredCari ? unvan : "") : (val === 3 ? "İSKONTO" : "")),
                                      aciklama: val === 2 ? "TÜRK LİRASI" : (val === 1 ? (isRegisteredCari ? unvan : "") : (val === 3 ? "İSKONTO" : "")),
                                      paraId: null,
                                      cariKartId: val === 1 ? (isRegisteredCari ? cariKartId : null) : null,
                                      cariKod: val === 1 ? (isRegisteredCari ? ((cariKod && cariKod.trim() && cariKod !== "00000") ? cariKod.trim() : "") : "") : (val === 3 ? "İSKONTO" : ""),
                                      cariUnvan: val === 1 ? (isRegisteredCari ? unvan : "") : (val === 3 ? "İSKONTO" : ""),
                                      bankaId: null,
                                      posCihaziId: null,
                                      iskontoId: null,
                                      adet: val === 3 ? 1 : "",
                                      miktar: "",
                                      milyem: "",
                                      hasGram: "",
                                      kur: val === 2 ? 1 : (val === 3 ? 1 : ""),
                                      tutar: "",
                                    };
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInvalidOdemeRowIds((prev) => {
                                      if (!prev[oRow.id]) return prev;
                                      const next = { ...prev };
                                      delete next[oRow.id];
                                      return next;
                                    });
                                    let nextVal = ((oRow.odemeAraciTuru ?? 0) + 1) % 4;
                                    if (nextVal === 3 && defaultIskonto) {
                                      applyIskontoToOdemeRow(oRow.id, defaultIskonto);
                                      return;
                                    }
                                    const isRegisteredCari = Boolean(cariKartId && unvan && !isAnonymousCustomerName(unvan) && unvan !== "NİHAİ TÜKETİCİ");
                                    setOdemeRows((prev) => prev.map((r) => {
                                      if (r.id !== oRow.id) return r;
                                      return {
                                        ...r,
                                        odemeAraciTuru: nextVal,
                                        paraKodu: nextVal === 2 ? "TL" : (nextVal === 3 ? "İSKONTO" : ""),
                                        paraAdi: nextVal === 2 ? "TÜRK LİRASI" : (nextVal === 1 ? (isRegisteredCari ? unvan : "") : (nextVal === 3 ? "İSKONTO" : "")),
                                        aciklama: nextVal === 2 ? "TÜRK LİRASI" : (nextVal === 1 ? (isRegisteredCari ? unvan : "") : (nextVal === 3 ? "İSKONTO" : "")),
                                        paraId: null,
                                        cariKartId: nextVal === 1 ? (isRegisteredCari ? cariKartId : null) : null,
                                        cariKod: nextVal === 1 ? (isRegisteredCari ? ((cariKod && cariKod.trim() && cariKod !== "00000") ? cariKod.trim() : "") : "") : (nextVal === 3 ? "İSKONTO" : ""),
                                        cariUnvan: nextVal === 1 ? (isRegisteredCari ? unvan : "") : (nextVal === 3 ? "İSKONTO" : ""),
                                        bankaId: null,
                                        posCihaziId: null,
                                        iskontoId: null,
                                        adet: nextVal === 3 ? 1 : "",
                                        miktar: "",
                                        milyem: "",
                                        hasGram: "",
                                        kur: nextVal === 2 ? 1 : (nextVal === 3 ? 1 : ""),
                                        tutar: "",
                                      };
                                    }));
                                    return;
                                  }
                                  handleOdemeGridKeyDown(e, rowIndex, "odemeAraciTuru", oRow.id);
                                }}
                                onFocus={handleOdemeRowFocus}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 2px",
                                  fontWeight: 600,
                                  borderColor: isInvalidRow ? "#dc2626" : undefined,
                                  backgroundColor: isInvalidRow ? "#fef2f2" : undefined,
                                }}
                              >
                                <option value={0}>Vezne</option>
                                <option value={1}>Cari</option>
                                <option value={2}>POS</option>
                                <option value={3}>Hesap</option>
                              </Form.Select>
                            </td>

                            {/* Kod (+ Dürbün) */}
                            <td>
                              {isOdemeCari ? (
                                <InputGroup size="sm">
                                  <Form.Control
                                    ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                    value={oRow.cariKod ?? ""}
                                    placeholder="Cari Kod / Dürbün"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) {
                                        setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: "", cariKartId: null, cariUnvan: "", paraAdi: "", aciklama: "" } : r));
                                        return;
                                      }
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: val } : r));
                                      const match = cariList.find((c) => (c.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                      if (match) {
                                        const cName = match.ad || (match as any).unvan || "";
                                        setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKartId: match.id, cariKod: match.kod, cariUnvan: cName, paraAdi: cName, aciklama: cName } : r));
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val) {
                                        const cMatch = cariList.find((c) => (c.kod || "").toLowerCase() === val.toLowerCase());
                                        if (cMatch) {
                                          const cName = cMatch.ad || (cMatch as any).unvan || "";
                                          setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKartId: cMatch.id, cariKod: cMatch.kod, cariUnvan: cName, paraAdi: cName, aciklama: cName } : r));
                                        }
                                      }
                                    }}
                                    onDoubleClick={() => openCariModalForOdeme(oRow.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "F4" || e.key === "F3") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openCariModalForOdeme(oRow.id);
                                        return;
                                      }
                                      handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                    }}
                                    onFocus={handleOdemeRowFocus}
                                    style={{
                                      fontSize: "11px",
                                      padding: "1px 4px",
                                      borderColor: isInvalidRow ? "#dc2626" : undefined,
                                      backgroundColor: isInvalidRow ? "#fef2f2" : undefined,
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    tabIndex={-1}
                                    variant="outline-secondary"
                                    className="px-1 py-0 d-flex align-items-center"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openCariModalForOdeme(oRow.id);
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openCariModalForOdeme(oRow.id);
                                    }}
                                    title="Cari Seç (F3/F4)"
                                  >
                                    <IconBinoculars size={12} />
                                  </Button>
                                </InputGroup>
                              ) : isOdemeKart ? (
                                <InputGroup size="sm">
                                  <Form.Control
                                    ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                    value={oRow.cariKod ?? ""}
                                    placeholder="POS Kodu / Dürbün"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) {
                                        setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: "", bankaId: null, paraAdi: "" } : r));
                                        return;
                                      }
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: val } : r));
                                      const match = posList.find((p) => (p.kod || "").trim().toLowerCase() === val.trim().toLowerCase());
                                      if (match) {
                                        applyPosToOdemeRow(oRow.id, match);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val) {
                                        const match = posList.find((p) => (p.kod || "").toLowerCase() === val.toLowerCase());
                                        if (match) {
                                          applyPosToOdemeRow(oRow.id, match);
                                        }
                                      }
                                    }}
                                    onDoubleClick={(e) => {
                                      e.currentTarget.select();
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "F4" || e.key === "F3") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openOdemeLookup(oRow.id, (oRow.cariKod || "").trim());
                                        return;
                                      }
                                      handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                    }}
                                    onFocus={handleOdemeRowFocus}
                                    style={{
                                      fontSize: "11px",
                                      padding: "1px 4px",
                                      borderColor: isInvalidRow ? "#dc2626" : undefined,
                                      backgroundColor: isInvalidRow ? "#fef2f2" : "#fff",
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    tabIndex={-1}
                                    variant="outline-secondary"
                                    className="px-1 py-0 d-flex align-items-center"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openOdemeLookup(oRow.id, (oRow.cariKod || "").trim());
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openOdemeLookup(oRow.id, (oRow.cariKod || "").trim());
                                    }}
                                    title="POS Cihazı Seç (F3/F4)"
                                  >
                                    <IconBinoculars size={12} />
                                  </Button>
                                </InputGroup>
                              ) : ebBankaSatiri ? (
                                <Form.Control
                                  ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                  size="sm"
                                  value={oRow.ebKartAdi || oRow.cariKod || ""}
                                  disabled
                                  title={`Banka Hesap Kartı: ${oRow.cariKod || ""}${oRow.ebKartAdi ? ` - ${oRow.ebKartAdi}` : ""} (e-Banka hareketinin hesabı; değiştirilemez)`}
                                  style={{ fontSize: "11px", padding: "1px 4px", fontWeight: 600 }}
                                />
                              ) : isOdemeHesap ? (
                                <InputGroup size="sm">
                                  <Form.Control
                                    ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                    value={oRow.cariKod ?? ""}
                                    placeholder="İskonto / Hesap / Dürbün"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) {
                                        setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: "", bankaId: null, iskontoId: null, paraAdi: "", aciklama: "" } : r));
                                        return;
                                      }
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, cariKod: val } : r));
                                      const lower = val.trim().toLowerCase();
                                      const iskMatch = (iskontoList || []).find((i) =>
                                        (i.kod || "").toLowerCase() === lower ||
                                        (i.tanim || "").toLowerCase() === lower
                                      );
                                      if (iskMatch) {
                                        applyIskontoToOdemeRow(oRow.id, iskMatch);
                                        return;
                                      }
                                      const match = bankaList.find((b) => (b.hesapNo || "").trim().toLowerCase() === lower);
                                      if (match) {
                                        applyHesapToOdemeRow(oRow.id, match);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val) {
                                        const lower = val.toLowerCase();
                                        const iskMatch = (iskontoList || []).find((i) =>
                                          (i.kod || "").toLowerCase() === lower ||
                                          (i.tanim || "").toLowerCase() === lower
                                        );
                                        if (iskMatch) {
                                          applyIskontoToOdemeRow(oRow.id, iskMatch);
                                          return;
                                        }
                                        const match = bankaList.find((b) => (b.hesapNo || "").toLowerCase() === lower);
                                        if (match) {
                                          applyHesapToOdemeRow(oRow.id, match);
                                        }
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "F4" || e.key === "F3") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openOdemeLookup(oRow.id, (oRow.cariKod || "").trim());
                                        return;
                                      }
                                      handleOdemeGridKeyDown(e, rowIndex, "cariKod", oRow.id);
                                    }}
                                    onFocus={handleOdemeRowFocus}
                                    style={{
                                      fontSize: "11px",
                                      padding: "1px 4px",
                                      borderColor: isInvalidRow ? "#dc2626" : undefined,
                                      backgroundColor: isInvalidRow ? "#fef2f2" : "#fff",
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    tabIndex={-1}
                                    variant="outline-secondary"
                                    className="px-1 py-0 d-flex align-items-center"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openOdemeLookup(oRow.id, (oRow.cariKod || "").trim());
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openOdemeLookup(oRow.id, (oRow.cariKod || "").trim());
                                    }}
                                    title="İskonto / Hesap Seç (F3/F4)"
                                  >
                                    <IconBinoculars size={12} />
                                  </Button>
                                </InputGroup>
                              ) : (
                                <Form.Control
                                  ref={(el) => { odemeInputRefs.current[`${oRow.id}_cariKod`] = el; }}
                                  size="sm"
                                  value="-"
                                  readOnly
                                  disabled
                                  tabIndex={-1}
                                  style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed", textAlign: "center" }}
                                />
                              )}
                            </td>

                            {/* Açıklama / Adı */}
                            <td>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraAdi`] = el; }}
                                size="sm"
                                readOnly
                                tabIndex={-1}
                                value={
                                  oRow.aciklama !== undefined
                                    ? oRow.aciklama
                                    : (isOdemeCari
                                      ? (oRow.cariUnvan || "")
                                      : (isOdemeKart || isOdemeHesap)
                                        ? (oRow.paraAdi || (isOdemeKart ? "KREDİ KARTI / POS" : "BANKA HAVALE / EFT"))
                                        : (oRow.paraAdi || (oRow.paraKodu === "TL" ? "TÜRK LİRASI" : "")))
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setOdemeRows((prev) => prev.map((r) => {
                                    if (r.id !== oRow.id) return r;
                                    return {
                                      ...r,
                                      aciklama: val,
                                      paraAdi: val,
                                      cariUnvan: isOdemeCari ? val : r.cariUnvan,
                                    };
                                  }));
                                }}
                                onFocus={handleOdemeRowFocus}
                                onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "paraAdi", oRow.id)}
                                style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#fff" }}
                                placeholder="Açıklama"
                              />
                            </td>

                            {/* Para / İskonto (+ Dürbün) */}
                            <td>
                              <InputGroup size="sm">
                                <Form.Control
                                  ref={(el) => { odemeInputRefs.current[`${oRow.id}_paraKodu`] = el; }}
                                  disabled={ebBankaSatiri}
                                  value={oRow.paraKodu || (oRow.odemeAraciTuru === 2 ? "TL" : "")}
                                  placeholder={isOdemeCari ? "Para / İskonto Seç" : "Para Kod / Dürbün"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateOdemeRow(oRow.id, "paraKodu", val);
                                    if (val.trim().toUpperCase() === "TL" || val.trim().toUpperCase() === "TRY" || val.trim().toUpperCase() === "TRL") {
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", adet: "", kur: "", milyem: "", urunTipi: 0, hasGram: "" } : r));
                                    } else {
                                      const iskMatch = iskontoList.find((isk) => {
                                        const iskKod = (isk.kod || "").replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i").toLowerCase().trim();
                                        const iskTanim = (isk.tanim || "").replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i").toLowerCase().trim();
                                        const vNorm = val.replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i").toLowerCase().trim();
                                        return iskKod === vNorm || iskTanim === vNorm || `isk-${isk.iskontoId}` === vNorm;
                                      });
                                      if (iskMatch) {
                                        applyIskontoToOdemeRow(oRow.id, iskMatch);
                                      } else {
                                        const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.trim().toLowerCase());
                                        if (match) {
                                          applyProductToOdemeRow(oRow.id, match);
                                        }
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val.toUpperCase() === "TL" || val.toUpperCase() === "TRY" || val.toUpperCase() === "TRL") {
                                      setOdemeRows((prev) => prev.map((r) => r.id === oRow.id ? { ...r, paraKodu: "TL", paraAdi: "TÜRK LİRASI", adet: "", kur: "", milyem: "", urunTipi: 0, hasGram: "" } : r));
                                    } else if (val) {
                                      const iskMatch = iskontoList.find((isk) => (isk.kod || "").toLowerCase() === val.toLowerCase());
                                      if (iskMatch) {
                                        applyIskontoToOdemeRow(oRow.id, iskMatch);
                                      } else {
                                        const match = urunList.find((u) => u.kod.trim().toLowerCase() === val.toLowerCase());
                                        if (match) {
                                          applyProductToOdemeRow(oRow.id, match);
                                        } else {
                                          const kMatch = kurSatirlar.find((k) => (k.kod || "").trim().toLowerCase() === val.toLowerCase());
                                          if (kMatch) {
                                            applyProductToOdemeRow(oRow.id, {
                                              id: kMatch.paraId || 0,
                                              paraId: kMatch.paraId,
                                              kod: kMatch.kod || val.toUpperCase(),
                                              ad: kMatch.ad || val.toUpperCase(),
                                              urunTipi: 0,
                                              alisFiyati: kMatch.dovizAlis ?? kMatch.efektifAlis ?? 0,
                                              satisFiyati: kMatch.dovizSatis ?? kMatch.efektifSatis ?? 0,
                                            } as UrunItem);
                                          }
                                        }
                                      }
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "F4" || e.key === "F3") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const curVal = ((e.currentTarget as HTMLInputElement)?.value || oRow.paraKodu || "").trim();
                                      const searchVal = (curVal.toUpperCase() === "TL" || curVal.toUpperCase() === "TRY") ? "" : curVal;
                                      openOdemeParaIskontoModal(oRow.id, searchVal);
                                      return;
                                    }
                                    handleOdemeGridKeyDown(e, rowIndex, "paraKodu", oRow.id);
                                  }}
                                  onFocus={() => {
                                    handleOdemeRowFocus();
                                    odemeFocusedInitialValRef.current[oRow.id] = (oRow.paraKodu || (oRow.odemeAraciTuru === 2 ? "TL" : "")).trim();
                                  }}
                                  onDoubleClick={(e) => {
                                    e.currentTarget.select();
                                  }}
                                  style={{
                                    fontSize: "11px",
                                    padding: "1px 4px",
                                    textTransform: "uppercase",
                                  }}
                                />
                                <Button
                                  type="button"
                                  tabIndex={-1}
                                  variant="outline-secondary"
                                  className="px-1 py-0 d-flex align-items-center"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const curVal = (oRow.paraKodu || "").trim();
                                    const searchVal = (curVal.toUpperCase() === "TL" || curVal.toUpperCase() === "TRY") ? "" : curVal;
                                    openOdemeParaIskontoModal(oRow.id, searchVal);
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const curVal = (oRow.paraKodu || "").trim();
                                    const searchVal = (curVal.toUpperCase() === "TL" || curVal.toUpperCase() === "TRY") ? "" : curVal;
                                    openOdemeParaIskontoModal(oRow.id, searchVal);
                                  }}
                                  disabled={ebBankaSatiri}
                                  title="Para / Döviz / İskonto Seç (F3/F4)"
                                >
                                  <IconBinoculars size={12} />
                                </Button>
                              </InputGroup>
                            </td>

                            {/* Adet - Altın ve gümüşlerde pasif, diğerlerinde serbest */}
                            <td style={{ width: odemeAdetColWidth, minWidth: odemeAdetColWidth, backgroundColor: isOdemeAltinOrGumus ? "#e9ecef" : undefined }}>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_adet`] = el; }}
                                inputMode="decimal"
                                data-decimal="true"
                                size="sm"
                                readOnly={isOdemeAltinOrGumus}
                                // e-Banka banka satırı kilitli (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M28)
                                disabled={isOdemeAltinOrGumus || ebBankaSatiri}
                                tabIndex={isOdemeAltinOrGumus ? -1 : undefined}
                                className={`text-end font-monospace ${isOdemeAdetMissing ? "is-invalid border-danger border-2 text-danger fw-bold" : ""}`}
                                value={isOdemeAltinOrGumus ? "" : (oRow.adet ?? "")}
                                placeholder={isOdemeAltinOrGumus ? "-" : undefined}
                                onChange={(e) => {
                                  if (isOdemeAltinOrGumus) return;
                                  const input = e.currentTarget as HTMLInputElement;
                                  handleNumericFormattedChange(input, (val) => updateOdemeRow(oRow.id, "adet", val));
                                }}
                                onKeyDown={(e) => {
                                  if (isOdemeAltinOrGumus) return;
                                  handleNumericDotKeyDown(e, (val) => updateOdemeRow(oRow.id, "adet", val));
                                  if (!e.defaultPrevented) {
                                    handleOdemeGridKeyDown(e, rowIndex, "adet", oRow.id);
                                  }
                                }}
                                onBlur={() => !isOdemeAltinOrGumus && normalizeOdemeRowOnBlur(oRow.id, "adet")}
                                onFocus={handleOdemeRowFocus}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: isOdemeAltinOrGumus ? "#e9ecef" : (isInvalidRow ? "#fef2f2" : (isOdemeAdetMissing ? "#fee2e2" : undefined)),
                                  border: isInvalidRow ? "1.5px solid #dc2626" : (isOdemeAdetMissing ? "2px solid #dc2626" : undefined),
                                  boxShadow: isInvalidRow ? "0 0 0 1px rgba(220, 38, 38, 0.3)" : (isOdemeAdetMissing ? "0 0 0 2px rgba(220, 38, 38, 0.4)" : undefined),
                                  cursor: isOdemeAltinOrGumus ? "not-allowed" : undefined,
                                }}
                                title={isOdemeAltinOrGumus ? "Altın ve gümüşlerde adet pasiftir, miktar (gram) giriniz" : (isOdemeAdetMissing ? "Lütfen adet giriniz" : undefined)}
                              />
                            </td>

                            {/* Miktar */}
                            <td style={{ width: odemeMiktarColWidth, minWidth: odemeMiktarColWidth, backgroundColor: (!isOdemeAltinOrGumus && (isOdemeParaOrZiynet || isOdemeIskonto)) ? "#e9ecef" : (isInvalidRow ? "#fee2e2" : (isOdemeMiktarMissing ? "#fee2e2" : undefined)) }}>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_miktar`] = el; }}
                                inputMode="decimal"
                                size="sm"
                                readOnly={(!isOdemeAltinOrGumus && isOdemeParaOrZiynet) || isOdemeIskonto}
                                disabled={isOdemeIskonto}
                                tabIndex={((!isOdemeAltinOrGumus && isOdemeParaOrZiynet) || isOdemeIskonto) ? -1 : undefined}
                                className={`text-end font-monospace ${isOdemeMiktarMissing ? "is-invalid border-danger border-2 text-danger fw-bold" : ""} ${(!isOdemeAltinOrGumus && (isOdemeParaOrZiynet || isOdemeIskonto)) ? "text-muted" : ""}`}
                                value={isOdemeIskonto ? "" : ((!isOdemeAltinOrGumus && isOdemeParaOrZiynet) ? "" : (oRow.miktar ?? ""))}
                                placeholder={isOdemeIskonto ? "-" : undefined}
                                onChange={(e) => {
                                  if ((isOdemeAltinOrGumus || !isOdemeParaOrZiynet) && !isOdemeIskonto) {
                                    const input = e.currentTarget as HTMLInputElement;
                                    handleNumericFormattedChange(input, (val) => updateOdemeRow(oRow.id, "miktar", val));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (!isOdemeParaOrZiynet && !isOdemeIskonto) {
                                    handleNumericDotKeyDown(e, (val) => updateOdemeRow(oRow.id, "miktar", val));
                                  }
                                  if (!e.defaultPrevented) {
                                    handleOdemeGridKeyDown(e, rowIndex, "miktar", oRow.id);
                                  }
                                }}
                                onBlur={() => normalizeOdemeRowOnBlur(oRow.id, "miktar")}
                                onFocus={handleOdemeRowFocus}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: (isOdemeParaOrZiynet || isOdemeIskonto) ? "#e9ecef" : (isInvalidRow ? "#fef2f2" : (isOdemeMiktarMissing ? "#fee2e2" : undefined)),
                                  border: isInvalidRow ? "1.5px solid #dc2626" : (isOdemeMiktarMissing ? "2px solid #dc2626" : undefined),
                                  boxShadow: isInvalidRow ? "0 0 0 1px rgba(220, 38, 38, 0.3)" : (isOdemeMiktarMissing ? "0 0 0 2px rgba(220, 38, 38, 0.4)" : undefined),
                                  cursor: (isOdemeParaOrZiynet || isOdemeIskonto) ? "not-allowed" : undefined,
                                }}
                                title={isOdemeIskonto ? "İskontoda miktar pasiftir, adet ve tutar kullanılır" : isOdemeParaOrZiynet ? "Döviz ve Ziynet işlemlerinde adet çalışır, miktar pasiftir" : isOdemeMiktarMissing ? "Lütfen miktar giriniz" : undefined}
                              />
                            </td>

                            {/* Milyem */}
                            <td>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_milyem`] = el; }}
                                inputMode="decimal"
                                data-decimal="true"
                                size="sm"
                                disabled={isOdemeParaOrZiynet || !milyemAcik}
                                readOnly={isOdemeParaOrZiynet || !milyemAcik}
                                tabIndex={isOdemeParaOrZiynet || !milyemAcik ? -1 : undefined}
                                className={`text-end font-monospace ${(isOdemeParaOrZiynet || !milyemAcik) ? "text-muted" : ""}`}
                                value={isOdemeParaOrZiynet ? "" : oRow.milyem}
                                onChange={(e) => !isOdemeParaOrZiynet && milyemAcik && updateOdemeRow(oRow.id, "milyem", e.target.value)}
                                onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "milyem", oRow.id)}
                                onBlur={() => {
                                  if (!isOdemeParaOrZiynet) normalizeOdemeRowOnBlur(oRow.id, "milyem");
                                }}
                                onFocus={() => {
                                  handleOdemeRowFocus();
                                  if (!oRow.refMilyem && oRow.milyem && parseDecimal(oRow.milyem) > 0) {
                                    oRow.refMilyem = oRow.milyem;
                                  }
                                }}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: (isOdemeParaOrZiynet || !milyemAcik) ? "#e9ecef" : undefined,
                                  cursor: (isOdemeParaOrZiynet || !milyemAcik) ? "not-allowed" : undefined,
                                }}
                                title={isOdemeParaOrZiynet ? "Döviz ve Ziynet işlemlerinde milyem girilmez" : (!milyemAcik ? "Milyem değiştirme yetkiniz yok" : undefined)}
                              />
                            </td>

                            {/* Has Gr - Pasif / Otomatik Hesaplanır */}
                            <td>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_hasGram`] = el; }}
                                readOnly
                                tabIndex={-1}
                                size="sm"
                                className="text-end font-monospace text-muted"
                                value={isOdemeParaOrZiynet ? "" : (oRow.hasGram !== "" && !isNaN(Number(oRow.hasGram)) ? Number(oRow.hasGram).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : oRow.hasGram)}
                                onFocus={handleOdemeRowFocus}
                                onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "hasGram", oRow.id)}
                                style={{ fontSize: "11px", padding: "1px 4px", backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                                title={isOdemeParaOrZiynet ? "Döviz ve Ziynet işlemlerinde has gram hesaplanmaz" : "Has gram otomatik hesaplanır, değiştirilemez"}
                              />
                            </td>

                            {/* Kur */}
                            <td>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_kur`] = el; }}
                                inputMode="decimal"
                                size="sm"
                                readOnly={isOdemeKurDisabled}
                                disabled={isOdemeKurDisabled}
                                tabIndex={isOdemeKurDisabled ? -1 : undefined}
                                className={`text-end font-monospace ${isOdemeTL || isOdemeIskonto ? "text-muted" : "fw-bold text-dark"} ${isOdemeKurMissing ? "text-danger fw-bold" : ""}`}
                                value={isOdemeIskonto || isOdemeTL ? "" : (oRow.kur && Number(oRow.kur) > 0 ? oRow.kur : (getKurForProduct({ paraId: oRow.paraId ?? undefined, kod: oRow.paraKodu, urunTipi: oRow.urunTipi, ad: oRow.paraAdi }, tip === 0 ? 1 : 0) || (Number(altinHasKuru) > 0 ? altinHasKuru : "")))}
                                placeholder={isOdemeIskonto || isOdemeTL ? "-" : "Kur"}
                                onChange={(e) => !isOdemeKurDisabled && updateOdemeRow(oRow.id, "kur", e.target.value)}
                                onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "kur", oRow.id)}
                                onBlur={() => !isOdemeKurDisabled && normalizeOdemeRowOnBlur(oRow.id, "kur")}
                                onFocus={handleOdemeRowFocus}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: (isOdemeIskonto || isOdemeTL) ? "#e9ecef" : (isOdemeKurMissing ? "#fee2e2" : "#f8fafc"),
                                  border: isOdemeKurMissing ? "1.5px solid #dc2626" : undefined,
                                  cursor: "not-allowed",
                                }}
                                title={isOdemeIskonto ? "İskonto işlemlerinde kur pasiftir" : isOdemeTL ? "TL için kur sabittir" : isOdemeKart ? "Kart işlemlerinde kur sabittir" : isOdemeHesap ? "Hesap işlemlerinde kur sabittir" : "Sistem kuru (Değiştirilemez)"}
                              />
                            </td>

                            {/* Tutar - Pasif / Otomatik Hesaplanır */}
                            <td>
                              <Form.Control
                                ref={(el) => { odemeInputRefs.current[`${oRow.id}_tutar`] = el; }}
                                readOnly
                                tabIndex={-1}
                                size="sm"
                                className="text-end font-monospace text-muted"
                                value={oRow.tutar !== "" && !isNaN(Number(oRow.tutar)) ? Number(oRow.tutar).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : oRow.tutar}
                                onFocus={handleOdemeRowFocus}
                                onKeyDown={(e) => handleOdemeGridKeyDown(e, rowIndex, "tutar", oRow.id)}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 4px",
                                  backgroundColor: isInvalidRow ? "#fef2f2" : "#e9ecef",
                                  borderColor: isInvalidRow ? "#dc2626" : undefined,
                                  cursor: "not-allowed",
                                }}
                                title="Tutar otomatik hesaplanır, değiştirilemez"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ background: "#f2f4f7", fontWeight: 600, fontSize: "11px" }}>
                      <tr>
                        <td colSpan={5} className="text-end small">Toplam</td>
                        <td style={{ width: odemeAdetColWidth, minWidth: odemeAdetColWidth, textAlign: "right" }}>{totalOdemeAdet > 0 ? totalOdemeAdet.toLocaleString("tr-TR") : ""}</td>
                        <td style={{ width: odemeMiktarColWidth, minWidth: odemeMiktarColWidth, textAlign: "right" }}>{totalOdemeMiktar > 0.0001 ? Number(totalOdemeMiktar).toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ""}</td>
                        <td></td>
                        <td style={{ textAlign: "right" }}>{totalOdemeHas > 0.00001 ? Number(totalOdemeHas).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : ""}</td>
                        <td></td>
                        <td style={{ textAlign: "right" }}>
                          {totalOdemeTutar > 0.001 ? totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL" : ""}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              </div>
            </Col>

            {/* SAĞDA: TL/HAS Özet */}
            <Col xs={12} lg={4} md={5}>
              <div className="d-flex flex-column gap-2">
                {/* TL / HAS Summary Table */}
                <div className="border rounded bg-white overflow-hidden shadow-2xs">
                  <Table bordered size="sm" className="mb-0" style={{ fontSize: "11.5px" }}>
                    <thead style={{ background: "#eef2f6" }}>
                      <tr>
                        <th></th>
                        <th className="text-center" style={{ width: "42%" }}>TL</th>
                        <th className="text-center" style={{ width: "42%" }}>HAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="fw-semibold text-secondary">{tip === 0 ? "Alış" : "Satış"}</td>
                        <td className="text-end font-monospace" style={{ color: totalTutar < 0 ? "#dc2626" : "inherit" }}>
                          {totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-end font-monospace" style={{ color: alisHas < 0 ? "#dc2626" : "inherit" }}>
                          {alisHas.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">{tip === 0 ? "Ödeme" : "Tahsilat"}</td>
                        <td className="text-end font-monospace" style={{ color: totalOdemeTutar < 0 ? "#dc2626" : "inherit" }}>
                          {totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-end font-monospace" style={{ color: odemeHas < 0 ? "#dc2626" : "inherit" }}>
                          {odemeHas.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </td>
                      </tr>
                      {/* e-Banka fişi: işçilik (KDV dahil) ve fiş düzeyindeki KDV oranı (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M12, M15) */}
                      {ebKipi && (
                        <>
                          <tr>
                            <td className="fw-semibold text-secondary">İşçilik <span className="fw-normal">(KDV dahil)</span></td>
                            <td className="text-end font-monospace">{tlYaz(ebIscilik.toplam)}</td>
                            <td className="text-end font-monospace text-muted" title="Net işçilik (KDV hariç)">{ebIscilik.var ? `net ${tlYaz(ebIscilik.net)}` : ""}</td>
                          </tr>
                          <tr>
                            <td className="fw-semibold text-secondary">
                              <div className="d-flex align-items-center gap-1 text-nowrap">
                                İşçilik KDV %
                                <input
                                  className="form-control form-control-sm text-end py-0 px-1"
                                  style={{ width: 52, height: 22, fontSize: "11.5px" }}
                                  value={ebKdvYazi ?? String(ebIscilik.oran ?? (parseDecimal(kdvOrani) > 0 ? parseDecimal(kdvOrani) : isKdvDisabled ? "" : EB_VARSAYILAN_KDV))}
                                  disabled={isKdvDisabled}
                                  title={isKdvDisabled ? "Seçili istatistik KDV'siz; işçiliğe KDV uygulanmaz" : "İşçilik KDV oranı: bütün altın / gümüş satırlarına uygulanır, toplam değişmez"}
                                  onChange={(e) => ebKdvDegistir(e.target.value)}
                                  onBlur={() => setEbKdvYazi(null)}
                                />
                              </div>
                            </td>
                            <td className="text-end font-monospace">{tlYaz(ebIscilik.kdv)}</td>
                            <td className="text-end text-muted" style={{ fontSize: "10.5px" }}>{isKdvDisabled ? "İstatistik KDV'siz" : ""}</td>
                          </tr>
                        </>
                      )}
                      {/* Fark Satırı */}
                      <tr
                        style={{
                          background: (farkTL < -0.01 || farkHas < -0.0001)
                            ? "#fee2e2"
                            : ((Math.abs(farkTL) > 0.01 || Math.abs(farkHas) > 0.0001) ? "#fffbeb" : "#f8f9fa"),
                          border: (farkTL < -0.01 || farkHas < -0.0001) ? "1.5px solid #dc2626" : undefined,
                        }}
                      >
                        <td
                          className="fw-bold"
                          style={{
                            color: (farkTL < -0.01 || farkHas < -0.0001) ? "#dc2626" : "inherit",
                            verticalAlign: "middle",
                          }}
                        >
                          Fark {(farkTL < -0.01 || farkHas < -0.0001) ? (
                            <span
                              className="badge bg-danger ms-1"
                              style={{
                                fontSize: "10px",
                                padding: "3px 6px",
                                boxShadow: "0 0 6px rgba(220,38,38,0.5)",
                              }}
                            >
                              Eksi Bakiye
                            </span>
                          ) : null}
                        </td>
                        <td
                          className="text-end fw-bold font-monospace"
                          style={{
                            color: farkTL < -0.01 ? "#dc2626" : (Math.abs(farkTL) > 0.01 ? "#d97706" : "#16a34a"),
                            fontSize: "12.5px",
                            fontWeight: 800,
                            verticalAlign: "middle",
                            backgroundColor: farkTL < -0.01 ? "#fecaca" : undefined,
                          }}
                        >
                          {farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td
                          className="text-end fw-bold font-monospace"
                          style={{
                            color: farkHas < -0.0001 ? "#dc2626" : (Math.abs(farkHas) > 0.0001 ? "#d97706" : "#16a34a"),
                            fontSize: "12.5px",
                            fontWeight: 800,
                            verticalAlign: "middle",
                            backgroundColor: farkHas < -0.0001 ? "#fecaca" : undefined,
                          }}
                        >
                          {farkHas.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </Col>
          </Row>

          {/* ─── Alt Kısayol Çubuğu (Kaydet, F8 Detay ve Sağda Belge Türü) ───────── */}
          <div className="d-flex gap-3 flex-wrap mt-2 pt-2 border-top align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={() => handleSave(false, false)}
                title="Fişi Kaydet (F1)"
              >
                <Badge bg="primary" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F1</Badge>
                <span className="fw-bold text-dark">Kaydet</span>
              </span>
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={openDetayModal}
                title="Müşteri Detayı Aç (F8)"
              >
                <Badge bg="dark" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F8</Badge>
                <span className="fw-bold text-dark">Detay</span>
              </span>
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={handleTriggerF10}
                title="Fişi Kaydet / Yazdır (F10)"
              >
                <Badge bg="success" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>F10</Badge>
                <span className="fw-bold text-dark">Kaydet / Yazdır</span>
              </span>
              <Button
                size="sm"
                variant="primary"
                className="px-2.5 py-0.5 border text-white fw-bold shadow-xs d-inline-flex align-items-center gap-1"
                style={{ fontSize: "11.5px", backgroundColor: "#2563eb", borderColor: "#1d4ed8" }}
                onClick={openPrintPreview}
                title="Fişi kaydetmeden standart sarraf fişi olarak yazdır / önizle (Teklif)"
              >
                <IconPrinter size={14} /> Teklif Yazdır
              </Button>
              <Button
                size="sm"
                variant="info"
                className="px-2.5 py-0.5 border text-white fw-bold shadow-xs d-inline-flex align-items-center gap-1"
                style={{ fontSize: "11.5px", backgroundColor: "#0284c7", borderColor: "#0369a1" }}
                onClick={() => setShowTeklifTaniModal(true)}
                title="Gerçek Kişiler İçin Müşteri Tanı Formu ve Sarraf Fişi (A4 - Shift+F10)"
              >
                <IconFileText size={14} /> Shift+F10) Müşteri Tanı Formu
              </Button>
              <span
                className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border bg-light shadow-2xs"
                style={{ fontSize: "11.5px", cursor: "pointer" }}
                onClick={handleNew}
                title="Yeni Fiş / Kayıt (Ctrl+N)"
              >
                <Badge bg="success" className="px-1.5 py-0.5" style={{ fontSize: "10.5px" }}>Ctrl+N</Badge>
                <span className="fw-bold text-dark">Yeni Kayıt</span>
              </span>

              {isMasakLimitExceeded && (
                <span
                  className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded border border-danger bg-danger-subtle text-danger shadow-2xs fw-bold"
                  style={{ fontSize: "11.5px", cursor: "pointer" }}
                  onClick={() => setShowMasakCustomerWarningModal(true)}
                  title={`MASAK Bildirim Sınırı Aşıldı: ${masakLimitLabel}`}
                >
                  <IconAlertTriangle size={14} className="text-danger" />
                  <span>MASAK Sınırı Aşıldı ({masakStatus.type === "altin" ? "Altın" : masakStatus.type === "doviz" ? "Döviz" : "TL"})</span>
                </span>
              )}
            </div>

            {/* Sağ En Altta Kağıt Fatura / e-Fatura / e-İrsaliye Seçimi */}
            <div className="d-flex align-items-center gap-1.5">
              <label className="small fw-bold text-secondary mb-0" style={{ fontSize: "12px" }}>
                Belge Türü:
              </label>
              <Form.Select
                size="sm"
                value={belgeTuru}
                onChange={(e) => setBelgeTuru(Number(e.target.value))}
                style={{ width: "135px", fontSize: "12px", fontWeight: 600 }}
              >
                <option value={0}>Kağıt fatura</option>
                <option value={1}>e-Fatura</option>
                <option value={2}>e-İrsaliye</option>
              </Form.Select>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ─── MODALS ───────────────────────────────────────────────────────────── */}

      {/* Cari / Müşteri Seçim Modalı (Kayıtlı Cariler & Kayıtsız Müşteriler) */}
      <MusteriSecimModal
        show={showCariModal}
        initialSearchTerm={cariSearchTerm}
        initialSearchField={cariSearchField}
        onClose={() => {
          if (customerSelectedJustNowRef.current) {
            customerSelectedJustNowRef.current = false;
            return;
          }
          setShowCariModal(false);
          setCariSearchTerm("");
          setCariSearchField("all");
          const caller = lastModalCallerRef.current;
          const oRowId = lastOdemeModalRowIdRef.current;
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          if (caller === "gridOdeme" && oRowId) {
            setTimeout(() => {
              focusOdemeGridCell(oRowId, "cariKod", "select");
            }, 60);
          } else if (caller === "cariKod") {
            setTimeout(() => {
              cariKodRef.current?.focus();
              cariKodRef.current?.select();
            }, 50);
          } else if (caller === "unvan") {
            setTimeout(() => {
              adRef.current?.focus();
              adRef.current?.select();
            }, 50);
          } else if (caller === "vkn") {
            setTimeout(() => {
              tcknRef.current?.focus();
              tcknRef.current?.select();
            }, 50);
          }
        }}
        cariler={cariList}
        kayitsizMusteriler={kayitsizMusteriList}
        onSelectCustomer={(res) => {
          customerSelectedJustNowRef.current = true;
          const caller = lastModalCallerRef.current;
          const oRowId = lastOdemeModalRowIdRef.current;
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          setShowCariModal(false);
          setCariSearchTerm("");
          setCariSearchField("all");

          if (caller === "gridOdeme" && oRowId) {
            const rawCari = res.raw || cariList.find((c) => c.id === res.id) || {
              id: res.id,
              kod: res.kod,
              ad: res.unvan,
              unvan: res.unvan,
            };
            applyCariToOdemeRow(oRowId, rawCari as any);
            setTimeout(() => {
              focusNextOdemeCell(oRowId, "cariKod");
            }, 50);
            return;
          }

          handleSelectCustomer(res);
          const hasCariKod = Boolean(res.kod && res.kod.trim());
          const hasUnvan = Boolean(res.unvan && res.unvan.trim() && !isAnonymousCustomerName(res.unvan));

          const executeFocus = () => {
            if (caller === "vkn" || !caller) {
              if (hasCariKod && hasUnvan) {
                istatistikRef.current?.focus();
                istatistikRef.current?.select();
              } else if (!hasCariKod) {
                cariKodRef.current?.focus();
                cariKodRef.current?.select();
              } else {
                adRef.current?.focus();
                adRef.current?.select();
              }
            } else if (caller === "cariKod") {
              if (hasUnvan) {
                istatistikRef.current?.focus();
                istatistikRef.current?.select();
              } else {
                adRef.current?.focus();
                adRef.current?.select();
              }
            } else if (caller === "unvan") {
              istatistikRef.current?.focus();
              istatistikRef.current?.select();
            } else {
              if (hasCariKod && hasUnvan) {
                istatistikRef.current?.focus();
                istatistikRef.current?.select();
              } else if (!hasCariKod) {
                cariKodRef.current?.focus();
                cariKodRef.current?.select();
              } else {
                adRef.current?.focus();
                adRef.current?.select();
              }
            }
          };

          requestAnimationFrame(executeFocus);
          setTimeout(executeFocus, 60);
          setTimeout(executeFocus, 150);
          setTimeout(() => {
            customerSelectedJustNowRef.current = false;
          }, 300);
        }}
        currentUnvan={unvan}
      />

      {/* Fiş Ara Modalı (Dürbün / Fiş Listesi) */}
      <LookupModal<SarrafFisListItem>
        show={showFisModal}
        onHide={() => setShowFisModal(false)}
        title="Kayıtlı Sarraf Fişleri"
        items={fisList}
        selectedId={fisId}
        columns={fisColumns}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.fisNo || "").toLowerCase().includes(t) ||
            String(item.sarrafFisiId || "").toLowerCase().includes(t) ||
            (item.unvan || "").toLowerCase().includes(t) ||
            (item.tarih || "").includes(t);
        }}
        onSelect={(item) => {
          setShowFisModal(false);
          const foundIdx = fisList.findIndex((f) => Number(f.sarrafFisiId) === Number(item.sarrafFisiId));
          if (foundIdx >= 0) setCurrentIndex(foundIdx);
          loadFisById(item.sarrafFisiId);
        }}
      />

      {/* Vezne Seç Modalı */}
      <LookupModal<VezneItem>
        show={showVezneModal}
        onHide={() => setShowVezneModal(false)}
        title="Vezne Seç"
        items={vezneList}
        columns={vezneColumns}
        onAddNew={() => setShowNewVezneModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return item.kod.toLowerCase().includes(t) || item.ad.toLowerCase().includes(t);
        }}
        onSelect={async (item) => {
          setVezneId(item.id); setVezneKod(item.kod); setVezneAd(item.ad);
          setShowVezneModal(false);
          const bak = await SarrafFisService.getVezneBakiye(item.id).catch(() => []);
          setBakiyeler(bak);
        }}
      />

      {/* Ürün Seç Modalı */}
      <LookupModal<UrunItem>
        show={showUrunModal}
        initialSearchTerm={urunSearchTerm}
        onHide={() => {
          setShowUrunModal(false);
          const caller = lastModalCallerRef.current;
          const kRowId = lastKalemModalRowIdRef.current;
          const oRowId = lastOdemeModalRowIdRef.current;
          lastModalCallerRef.current = null;
          lastKalemModalRowIdRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          activeRowIdForUrunRef.current = null;
          activeOdemeRowIdForUrunRef.current = null;
          setActiveRowIdForUrun(null);
          setActiveOdemeRowIdForUrun(null);

          if (caller === "gridKalem" && kRowId) {
            setTimeout(() => {
              focusGridCell(kRowId, "urunKodu", "select");
            }, 50);
          } else if (caller === "gridOdeme" && oRowId) {
            setTimeout(() => {
              focusOdemeGridCell(oRowId, "paraKodu", "select");
            }, 50);
          }
        }}
        title={Boolean(activeRowIdForUrunRef.current || activeRowIdForUrun) ? "Ürün Seçimi" : "Para / Döviz Seç"}
        items={urunList}
        isLoading={isUrunLoading}
        columns={urunColumns}
        onAddNew={() => setShowNewProductModal(true)}
        addNewLabel="Yeni Kayıt"
        isItemDisabled={(item) => {
          const isKalemModal = Boolean(activeRowIdForUrunRef.current || activeRowIdForUrun);
          if (!isKalemModal) return false;
          const k = (item.kod || "").trim().toUpperCase();
          return k === "TL" || k === "TRY" || (item.ad || "").toUpperCase().includes("TÜRK LİRASI");
        }}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          const isZiynet = item.urunTipi === 3 || isZiynetProduct(item);
          const typeLabel = isZiynet ? "ziynet sarrafiye ceyrek yarim tam ata cumhuriyet" : item.urunTipi === 0 ? "para doviz döviz" : item.urunTipi === 1 ? "altin altın hurda maden" : item.urunTipi === 2 ? "gumus gümüş" : "";
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t) ||
            typeLabel.toLowerCase().includes(t) ||
            ((item as any).barkod || "").toLowerCase().includes(t) ||
            ((item as any).model || "").toLowerCase().includes(t) ||
            ((item as any).ayar || "").toLowerCase().includes(t) ||
            ((item as any).grupKodu || "").toLowerCase().includes(t) ||
            ((item as any).aciklama || "").toLowerCase().includes(t) ||
            ((item as any).mamulTipi || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          lastModalCallerRef.current = null;
          lastKalemModalRowIdRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          const targetKalemRowId = activeRowIdForUrunRef.current || activeRowIdForUrun;
          const targetOdemeRowId = activeOdemeRowIdForUrunRef.current || activeOdemeRowIdForUrun;

          if (targetKalemRowId) {
            applyProductToRow(targetKalemRowId, item);
            setTimeout(() => {
              focusGridCell(targetKalemRowId, "adet", "select");
            }, 30);
          } else if (targetOdemeRowId) {
            applyProductToOdemeRow(targetOdemeRowId, item);
            const isParaOrZiynet = isOdemeRowParaOrZiynet(item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowId, isParaOrZiynet ? "adet" : "miktar", "select");
            }, 30);
          }
          setShowUrunModal(false);
          activeRowIdForUrunRef.current = null;
          activeOdemeRowIdForUrunRef.current = null;
          setActiveRowIdForUrun(null);
          setActiveOdemeRowIdForUrun(null);
        }}
      />

      {/* Yeni Ürün / Para Tanımı Modalı */}
      {showNewProductModal && (
        <Modal
          show={showNewProductModal}
          onHide={() => setShowNewProductModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconCoins size={20} className="text-primary" />
              <span>Yeni Ürün / Para Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <ProductDefinitionsPage
              isModal={true}
              onSuccess={async (createdProduct) => {
                setShowNewProductModal(false);
                setShowUrunModal(false);
                try {
                  const uList = await SarrafFisService.getUrunler(true);
                  if (uList && uList.length > 0) {
                    setUrunList(uList);
                    const targetKalemRowId = activeRowIdForUrunRef.current || activeRowIdForUrun;
                    const targetOdemeRowId = activeOdemeRowIdForUrunRef.current || activeOdemeRowIdForUrun;
                    const matched = (createdProduct
                      ? uList.find((x) => x.id === createdProduct.id || x.kod.toLowerCase() === createdProduct.kod.toLowerCase())
                      : null) || uList[uList.length - 1];
                    if (matched) {
                      if (targetKalemRowId) {
                        applyProductToRow(targetKalemRowId, matched);
                      } else if (targetOdemeRowId) {
                        applyProductToOdemeRow(targetOdemeRowId, matched);
                      }
                    }
                  }
                } catch (err) {
                  console.error("Ürün listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewProductModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Ödeme Tablosu: Cari Seçim Modalı */}
      <LookupModal<CariKartItem>
        show={showOdemeCariModal}
        searchByCodeOnly={true}
        onHide={() => {
          setShowOdemeCariModal(false);
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "cariKod", "select");
          }
        }}
        title="Cari Kart Seç (Tahsilat / Ödeme)"
        items={cariList}
        columns={odemeCariColumns}
        onAddNew={() => setShowNewCariModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyCariToOdemeRow(targetOdemeRowIdForLookup, item);
            setTimeout(() => {
              focusNextOdemeCell(targetOdemeRowIdForLookup, "cariKod");
            }, 30);
          }
          setShowOdemeCariModal(false);
        }}
      />

      {/* Ödeme Tablosu: Para / İskonto / Döviz Seçim Modalı */}
      <LookupModal<any>
        show={showOdemeParaIskontoModal}
        searchByCodeOnly={false}
        initialSearchTerm={odemeLookupSearchTerm}
        onHide={() => {
          setShowOdemeParaIskontoModal(false);
          setOdemeLookupSearchTerm("");
          const caller = lastModalCallerRef.current;
          const oRowId = targetOdemeRowIdForLookup || lastOdemeModalRowIdRef.current;
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          if (caller === "gridOdeme" && oRowId) {
            focusOdemeGridCell(oRowId, "paraKodu", "select");
          }
        }}
        title={targetOdemeRowIdForLookup && odemeRows.find((r) => r.id === targetOdemeRowIdForLookup)?.odemeAraciTuru === 3 ? "İskonto Seç (Hesap)" : "Para / Döviz Seç"}
        items={allOdemeParaIskontoList}
        columns={odemeParaIskontoColumns}
        onAddNew={targetOdemeRowIdForLookup && odemeRows.find((r) => r.id === targetOdemeRowIdForLookup)?.odemeAraciTuru === 3 ? () => setShowNewIskontoModal(true) : () => setShowNewProductModal(true)}
        addNewLabel={targetOdemeRowIdForLookup && odemeRows.find((r) => r.id === targetOdemeRowIdForLookup)?.odemeAraciTuru === 3 ? "Yeni İskonto Tanımla" : "Yeni Para / Ürün Tanımla"}
        filterFn={(item, term) => {
          const norm = (s: string) =>
            (s || "")
              .replace(/İ/g, "i")
              .replace(/I/g, "ı")
              .replace(/ı/g, "i")
              .toLowerCase()
              .trim();
          const t = norm(term);
          if (!t) return true;
          return (
            norm(item.kod).includes(t) ||
            norm(item.tanim).includes(t) ||
            norm(item.tur).includes(t) ||
            norm(item.detay).includes(t)
          );
        }}
        onSelect={(item) => {
          const rowId = targetOdemeRowIdForLookup;
          lastModalCallerRef.current = null;
          lastOdemeModalRowIdRef.current = null;
          if (rowId) {
            if (item.tur === "İSKONTO" && item.rawIskonto) {
              applyIskontoToOdemeRow(rowId, item.rawIskonto);
              odemeFocusedInitialValRef.current[rowId] = (item.kod || "").trim();
              setTimeout(() => {
                focusOdemeGridCell(rowId, "adet", "select");
              }, 40);
            } else if (item.rawProduct) {
              applyProductToOdemeRow(rowId, item.rawProduct);
              odemeFocusedInitialValRef.current[rowId] = (item.kod || "").trim();
              const isPZ = isOdemeRowParaOrZiynet(item.rawProduct);
              setTimeout(() => {
                focusOdemeGridCell(rowId, isPZ ? "adet" : "miktar", "select");
              }, 30);
            }
          }
          setShowOdemeParaIskontoModal(false);
        }}
      />

      {/* Yeni İskonto Tanımı Modalı */}
      {showNewIskontoModal && (
        <Modal
          show={showNewIskontoModal}
          onHide={() => setShowNewIskontoModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconCoins size={20} className="text-primary" />
              <span>Yeni İskonto Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <IskontoDefinitionsPage
              isModal={true}
              onSuccess={async (createdIskonto) => {
                setShowNewIskontoModal(false);
                setShowOdemeParaIskontoModal(false);
                try {
                  const iskList = await IskontoService.getIskontolar({ aktif: true });
                  if (iskList && iskList.length > 0) {
                    setIskontoList(iskList);
                    if (targetOdemeRowIdForLookup && createdIskonto) {
                      applyIskontoToOdemeRow(targetOdemeRowIdForLookup, createdIskonto);
                    }
                  }
                } catch (err) {
                  console.error("İskonto listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewIskontoModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Ödeme Tablosu: Cari Para (Para / Döviz) Seçim Modalı */}
      <LookupModal<UrunItem>
        show={showOdemeParaModal}
        searchByCodeOnly={true}
        onHide={() => {
          setShowOdemeParaModal(false);
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "paraKodu", "select");
          }
        }}
        title="Para / Döviz Seç (Cari Para)"
        items={odemeParaList}
        columns={odemeParaColumns}
        onAddNew={() => setShowNewProductModal(true)}
        addNewLabel="Yeni Kayıt"
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyProductToOdemeRow(targetOdemeRowIdForLookup, item);
            const isPZ = isOdemeRowParaOrZiynet(item);
            setTimeout(() => {
              focusOdemeGridCell(targetOdemeRowIdForLookup, isPZ ? "adet" : "miktar", "select");
            }, 30);
          }
          setShowOdemeParaModal(false);
        }}
      />

      {/* Ödeme Tablosu: Banka / İskonto / Hesap Seçim Modalı */}
      <LookupModal<any>
        show={showOdemeHesapModal}
        selectedId={(() => {
          const row = targetOdemeRowIdForLookup ? odemeRows.find((r) => r.id === targetOdemeRowIdForLookup) : null;
          if (row?.iskontoId) return `isk-${row.iskontoId}`;
          if (row?.bankaId) return `banka-${row.bankaId}`;
          if (defaultIskonto?.iskontoId) return `isk-${defaultIskonto.iskontoId}`;
          return undefined;
        })()}
        searchByCodeOnly={false}
        initialSearchTerm={odemeLookupSearchTerm}
        onHide={() => {
          setShowOdemeHesapModal(false);
          setOdemeLookupSearchTerm("");
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "cariKod", "select");
          }
        }}
        title="Hesap / İskonto Seç (Tahsilat / Ödeme)"
        items={odemeHesapVeIskontoItems}
        columns={odemeHesapVeIskontoColumns}
        onAddNew={kYetki.bankaHesabiSecme ? () => setShowNewBankaModal(true) : undefined}
        addNewLabel={kYetki.bankaHesabiSecme ? "Yeni Banka Hesabı" : undefined}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (
            (item.kod || "").toLowerCase().includes(t) ||
            (item.ad || "").toLowerCase().includes(t) ||
            (item.detay || "").toLowerCase().includes(t)
          );
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            if (item.rawIskonto) {
              applyIskontoToOdemeRow(targetOdemeRowIdForLookup, item.rawIskonto);
            } else if (item.rawBanka) {
              applyHesapToOdemeRow(targetOdemeRowIdForLookup, item.rawBanka);
            }
            setTimeout(() => {
              focusNextOdemeCell(targetOdemeRowIdForLookup, "cariKod");
            }, 30);
          }
          setShowOdemeHesapModal(false);
          setOdemeLookupSearchTerm("");
        }}
      />

      {/* Ödeme Tablosu: POS Seçim Modalı */}
      <LookupModal<PosCihaziItem>
        show={showOdemePosModal}
        searchByCodeOnly={true}
        initialSearchTerm={odemeLookupSearchTerm}
        selectedId={
          odemeLookupSearchTerm
            ? odemeLookupSearchTerm
            : (odemeRows.find((r) => r.id === targetOdemeRowIdForLookup)?.posCihaziId ||
              odemeRows.find((r) => r.id === targetOdemeRowIdForLookup)?.cariKod ||
              undefined)
        }
        onHide={() => {
          setShowOdemePosModal(false);
          setOdemeLookupSearchTerm("");
          if (targetOdemeRowIdForLookup) {
            focusOdemeGridCell(targetOdemeRowIdForLookup, "cariKod", "select");
          }
        }}
        title="POS Cihazı Seç (Tahsilat / Ödeme)"
        items={posList}
        columns={odemePosColumns}
        filterFn={(item, term) => {
          const t = (term || "").toLowerCase().trim();
          if (!t) return true;
          return (item.kod || "").toLowerCase().includes(t) || (item.ad || "").toLowerCase().includes(t);
        }}
        onSelect={(item) => {
          if (targetOdemeRowIdForLookup) {
            applyPosToOdemeRow(targetOdemeRowIdForLookup, item);
            setTimeout(() => {
              focusNextOdemeCell(targetOdemeRowIdForLookup, "cariKod");
            }, 30);
          }
          setShowOdemePosModal(false);
          setOdemeLookupSearchTerm("");
        }}
      />

      {/* Yeni Cari Kart Tanımı Modalı */}
      {showNewCariModal && (
        <Modal
          show={showNewCariModal}
          onHide={() => setShowNewCariModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconUsers size={20} className="text-primary" />
              <span>Yeni Cari Kart Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <CariCardRegistrationPage
              isModal={true}
              onSuccess={async (createdCari) => {
                setShowNewCariModal(false);
                setShowOdemeCariModal(false);
                try {
                  const updatedList = await CariService.getCariKartlar();
                  if (updatedList && updatedList.length > 0) {
                    setCariList(updatedList);
                    const matched = (createdCari
                      ? updatedList.find((x) => x.id === createdCari.id || (x.kod && x.kod.toLowerCase() === (createdCari.kod || "").toLowerCase()))
                      : null) || updatedList[updatedList.length - 1];
                    if (matched && targetOdemeRowIdForLookup) {
                      applyCariToOdemeRow(targetOdemeRowIdForLookup, matched);
                      setTimeout(() => {
                        focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
                      }, 50);
                    }
                  }
                } catch (err) {
                  console.error("Cari listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewCariModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Yeni Banka / Hesap Tanımı Modalı */}
      {showNewBankaModal && (
        <Modal
          show={showNewBankaModal}
          onHide={() => setShowNewBankaModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconBuildingBank size={20} className="text-primary" />
              <span>Yeni Banka / Hesap Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <BankaHesapKartiPage
              isModal={true}
              onSuccess={async (createdHesap) => {
                setShowNewBankaModal(false);
                setShowOdemeHesapModal(false);
                try {
                  const updatedList = await BankaService.getBankalar();
                  if (updatedList && updatedList.length > 0) {
                    setBankaList(updatedList);
                    const matched = (createdHesap
                      ? updatedList.find((x) => x.bankaId === createdHesap.bankaId || (x.hesapNo && x.hesapNo.toLowerCase() === (createdHesap.hesapNo || "").toLowerCase()))
                      : null) || updatedList[updatedList.length - 1];
                    if (matched && targetOdemeRowIdForLookup) {
                      applyHesapToOdemeRow(targetOdemeRowIdForLookup, matched);
                      setTimeout(() => {
                        focusOdemeGridCell(targetOdemeRowIdForLookup, "miktar", "select");
                      }, 50);
                    }
                  }
                } catch (err) {
                  console.error("Banka listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewBankaModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Yeni Vezne / Kasa Tanımı Modalı */}
      {showNewVezneModal && (
        <Modal
          show={showNewVezneModal}
          onHide={() => setShowNewVezneModal(false)}
          size="xl"
          centered
          backdrop="static"
          dialogClassName="modal-95w"
        >
          <Modal.Header closeButton className="py-2 px-3 bg-light">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconBuildingStore size={20} className="text-primary" />
              <span>Yeni Vezne / Kasa Tanımı</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3" style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <CashDeskDefinitionsPage
              isModal={true}
              onSuccess={async (createdVezne) => {
                setShowNewVezneModal(false);
                setShowVezneModal(false);
                try {
                  const data = await CashDeskService.getVezneler();
                  if (data && data.length > 0) {
                    setVezneList(data);
                    if (createdVezne) {
                      const matched = data.find((v) => v.id === createdVezne.id || v.kod === createdVezne.kod);
                      if (matched) {
                        setVezneId(matched.id); setVezneKod(matched.kod); setVezneAd(matched.ad);
                        const bak = await SarrafFisService.getVezneBakiye(matched.id).catch(() => []);
                        setBakiyeler(bak);
                      }
                    }
                  }
                } catch (err) {
                  console.error("Vezne listesi yenilenirken hata:", err);
                }
              }}
              onCancel={() => setShowNewVezneModal(false)}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* 1) Kişi Seçildiğinde MASAK Sınırı Uyarısı Modalı (Sayfa Ortasında) */}
      <Modal show={showMasakCustomerWarningModal} onHide={() => setShowMasakCustomerWarningModal(false)} centered>
        <Modal.Header closeButton className="py-2 bg-warning-subtle text-warning-emphasis">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <IconAlertTriangle size={20} className="text-warning" />
            {masakLimitTitle}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <div className="d-flex align-items-start gap-3">
            <div className="p-2 bg-warning bg-opacity-10 rounded-circle text-warning flex-shrink-0">
              <IconAlertTriangle size={32} />
            </div>
            <div>
              <p className="mb-2 fw-semibold">
                İşlem tutarı MASAK <strong>{masakLimitLabel}</strong> aşmaktadır.
              </p>
              <p className="small text-muted mb-0">
                5549 sayılı yasa gereğince işlem yapılan müşterinin <strong>İsim / Ünvan, T.C. Kimlik / VKN, Adres ve Kişilik Tipi</strong> bilgilerinin eksiksiz girilmesi zorunludur. Detay bilgileri girilmeden işlem kaydedilemez.
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="secondary" onClick={() => setShowMasakCustomerWarningModal(false)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" onClick={() => {
            setShowMasakCustomerWarningModal(false);
            openDetayModal();
          }}>
            Detay Bilgilerini Doldur (F8)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 2) Kaydederken Zorunlu MASAK Bilgileri Eksik Modalı (Sayfa Ortasında) */}
      <Modal show={showMasakMissingModal} onHide={() => setShowMasakMissingModal(false)} centered>
        <Modal.Header closeButton className="py-2 bg-danger-subtle text-danger">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <IconAlertTriangle size={20} className="text-danger" />
            {masakLimitTitle} - Zorunlu Bilgi Eksikliği
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-2">
            İşlem toplam tutarı MASAK <strong>{masakLimitLabel}</strong> aşmaktadır.
          </p>
          <div className="alert alert-danger py-2 px-3 small mb-2">
            <strong>Eksik Alanlar:</strong>
            <ul className="mb-0 ps-3 mt-1">
              {masakMissingFields.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="small text-muted">
            Mevzuat gereği bu bilgiler eksiksiz doldurulmadan fiş kaydedilemez. Lütfen detay penceresinden eksik bilgileri doldurup kaydediniz.
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="secondary" onClick={() => setShowMasakMissingModal(false)}>
            Vazgeç
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setShowMasakMissingModal(false);
              openDetayModal();
            }}
          >
            Detay Bilgilerini Doldur (F8)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Silme Onay Modalı (F8) */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0">
            <IconAlertTriangle size={16} className="text-danger me-1" />
            Belgeyi Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="small py-2">
          Belge <strong>#{fisNo || fisId}</strong> silinecektir. Emin misiniz?
        </Modal.Body>
        <Modal.Footer className="py-1">
          <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>İptal</Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>Sil</Button>
        </Modal.Footer>
      </Modal>

      {/* ─── F8 Detay Modalı: Label solda, Input sağda, Enter/Yön Tuşları ile Geçiş ─ */}
      <Modal show={showDetayModal} onHide={() => setShowDetayModal(false)} centered size="lg">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0 d-flex align-items-center">
            <IconBinoculars size={16} className="text-primary me-2" />
            Müşteri Detayı — F8
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Row className="g-2">
            {/* Sol Kolon */}
            <Col xs={12} md={6}>
              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Unvan / Ad Soyad</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["unvan"] = el; }}
                  size="sm"
                  value={detayUnvan}
                  onChange={(e) => setDetayUnvan(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "unvan")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kişilik Tipi</label>
                <Form.Select
                  ref={(el) => { detayRefs.current["kisilikTipi"] = el; }}
                  size="sm"
                  value={detayKisilikTipi}
                  onChange={(e) => setDetayKisilikTipi(Number(e.target.value))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kisilikTipi")}
                  style={{ flex: 1 }}
                >
                  <option value={0}>Gerçek Kişi</option>
                  <option value={1}>Tüzel Kişi</option>
                </Form.Select>
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Belge Türü</label>
                <Form.Select
                  ref={(el) => { detayRefs.current["kimlikBelgeTuru"] = el; }}
                  size="sm"
                  value={detayKimlikBelgeTuru}
                  onChange={(e) => setDetayKimlikBelgeTuru(Number(e.target.value))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikBelgeTuru")}
                  style={{ flex: 1 }}
                >
                  <option value={0}>T.C. Kimlik</option>
                  <option value={1}>Pasaport</option>
                  <option value={2}>Ehliyet</option>
                </Form.Select>
              </div>

              {detayKimlikBelgeTuru === 1 ? (
                <div className="d-flex align-items-center mb-2">
                  <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Pasaport No</label>
                  <InputGroup size="sm" style={{ flex: 1 }}>
                    <Form.Control
                      ref={(el) => { detayRefs.current["pasaportNo"] = el; }}
                      size="sm"
                      value={detayPasaportNo}
                      onChange={(e) => setDetayPasaportNo(e.target.value)}
                      onKeyDown={(e) => handleDetayKeyDown(e, "pasaportNo")}
                      maxLength={20}
                    />
                    <Button
                      variant="outline-danger"
                      className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                      onClick={() => handleSearchMasak(detayUnvan || unvan, detayPasaportNo)}
                      disabled={isSearchingMasak}
                      title="Pasaport No ile MASAK Listelerinde Sorgula"
                    >
                      {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={13} color="#dc2626" />}
                      <span>MASAK</span>
                    </Button>
                  </InputGroup>
                </div>
              ) : (
                <div className="d-flex align-items-center mb-2">
                  <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vergi / TC Kimlik (11)</label>
                  <InputGroup size="sm" style={{ flex: 1 }}>
                    <Form.Control
                      ref={(el) => { detayRefs.current["vergiKimlikNo"] = el; }}
                      value={detayVergiKimlikNo}
                      onChange={(e) => setDetayVergiKimlikNo(onlyDigits(e.target.value).slice(0, 11))}
                      onKeyDown={(e) => handleDetayKeyDown(e, "vergiKimlikNo")}
                      maxLength={11}
                    />
                    <Button
                      variant="outline-danger"
                      className="px-2 py-0 d-flex align-items-center justify-content-center gap-1"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                      onClick={() => handleSearchMasak(detayUnvan || unvan, detayVergiKimlikNo)}
                      disabled={isSearchingMasak}
                      title="Bu TC/VKN ile MASAK Listelerinde Sorgula"
                    >
                      {isSearchingMasak ? <Spinner animation="border" size="sm" /> : <IconShieldExclamation size={13} color="#dc2626" />}
                      <span>MASAK</span>
                    </Button>
                  </InputGroup>
                </div>
              )}

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Seri No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["kimlikSeriNo"] = el; }}
                  size="sm"
                  value={detayKimlikSeriNo}
                  onChange={(e) => setDetayKimlikSeriNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikSeriNo")}
                  maxLength={20}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Baba Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["babaAdi"] = el; }}
                  size="sm"
                  value={detayBabaAdi}
                  onChange={(e) => setDetayBabaAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "babaAdi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Anne Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["anneAdi"] = el; }}
                  size="sm"
                  value={detayAnneAdi}
                  onChange={(e) => setDetayAnneAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "anneAdi")}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>

            {/* Sağ Kolon */}
            <Col xs={12} md={6}>
              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Doğum Tarihi</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["dogumTarihi"] = el; }}
                  type="date"
                  size="sm"
                  value={detayDogumTarihi}
                  onChange={(e) => setDetayDogumTarihi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "dogumTarihi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Doğum Yeri</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["dogumYeri"] = el; }}
                  size="sm"
                  value={detayDogumYeri}
                  onChange={(e) => setDetayDogumYeri(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "dogumYeri")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Kimlik Geçerlilik</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["kimlikGecerlilikTarihi"] = el; }}
                  type="date"
                  size="sm"
                  value={detayKimlikGecerlilikTarihi}
                  onChange={(e) => setDetayKimlikGecerlilikTarihi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "kimlikGecerlilikTarihi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Telefon</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["telefonNo"] = el; }}
                  size="sm"
                  value={detayTelefonNo}
                  onChange={(e) => setDetayTelefonNo(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => handleDetayKeyDown(e, "telefonNo")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Adres</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["adres"] = el; }}
                  size="sm"
                  value={detayAdres}
                  onChange={(e) => setDetayAdres(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "adres")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>E-posta</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["eposta"] = el; }}
                  size="sm"
                  type="email"
                  value={detayEposta}
                  onChange={(e) => setDetayEposta(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "eposta")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vekil Adı</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["vekilAdi"] = el; }}
                  size="sm"
                  value={detayVekilAdi}
                  onChange={(e) => setDetayVekilAdi(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "vekilAdi")}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <label style={{ width: 135, minWidth: 135, fontSize: "12px", fontWeight: 600 }}>Vekil Kimlik No</label>
                <Form.Control
                  ref={(el) => { detayRefs.current["vekilKimlikNo"] = el; }}
                  size="sm"
                  value={detayVekilKimlikNo}
                  onChange={(e) => setDetayVekilKimlikNo(e.target.value)}
                  onKeyDown={(e) => handleDetayKeyDown(e, "vekilKimlikNo")}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="py-1 d-flex justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="info"
              size="sm"
              className="d-flex align-items-center gap-1 fw-bold text-white shadow-xs"
              style={{ backgroundColor: "#0284c7", borderColor: "#0369a1" }}
              onClick={() => {
                setShowDetayModal(false);
                setShowTeklifTaniModal(true);
              }}
              title="Gerçek Kişiler İçin Müşteri Tanı Formu (A4 - Shift+F10)"
            >
              <IconFileText size={16} /> Shift+F10) Müşteri Tanı Formu
            </Button>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowDetayModal(false)}>İptal</Button>
            <Button size="sm" variant="success" onClick={handleSaveDetay}>
              <IconCheck size={14} className="me-1" />
              Uygula / Kaydet
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* MASAK Sorgulama Sonuç Modalı */}
      <MasakSonucModal
        show={masakModalOpen}
        onHide={() => setMasakModalOpen(false)}
        queriedName={masakResult.queriedName}
        queriedId={masakResult.queriedId}
        matches={masakResult.matches}
        searched={masakResult.searched}
        onOpenMasakManagement={() => setMasakManagementOpen(true)}
      />

      {/* MASAK Resmi Listeleri Yönetme / Güncelleme Modalı */}
      <MasakModal
        show={masakManagementOpen}
        onHide={() => setMasakManagementOpen(false)}
      />

      {/* F3) İstatistik Kodu Seçim Modalı */}
      <IstatistikSecimModal
        show={showIstatistikModal}
        initialSearchTerm={istatistikSearchTerm}
        onClose={() => {
          setShowIstatistikModal(false);
          const caller = lastModalCallerRef.current;
          lastModalCallerRef.current = null;
          if (caller === "istatistik") {
            setTimeout(() => {
              istatistikRef.current?.focus();
              istatistikRef.current?.select();
            }, 50);
          }
        }}
        tip={tip}
        onSelect={(item) => {
          lastModalCallerRef.current = null;
          handleSelectIstatistik(item);
        }}
        currentKod={istatistikKodu}
      />

      {/* 80mm POS & A4 Sarraf Fişi Yazdırma Modalı */}
      <SarrafFisiPrintModal
        show={showPrintModal}
        autoPrint={isPendingDirectPrint}
        onHide={() => {
          setShowPrintModal(false);
          setIsPendingDirectPrint(false);
          setPrintSnapshot(null);
        }}
        fisId={printSnapshot?.fisId ?? fisId}
        tip={printSnapshot?.tip ?? tip}
        tarih={printSnapshot?.tarih ?? tarih}
        saat={printSnapshot?.saat ?? saat}
        seriNo={printSnapshot?.seriNo ?? seriNo}
        belgeNo={printSnapshot?.belgeNo ?? fisNo}
        unvan={printSnapshot?.unvan ?? (unvan || detayUnvan)}
        vergiKimlikNo={printSnapshot?.vergiKimlikNo ?? detayVergiKimlikNo}
        detayIl={printSnapshot?.detayIl ?? ""}
        detayIlce={printSnapshot?.detayIlce ?? ""}
        detayUyruk={printSnapshot?.detayUyruk ?? ""}
        detayPasaportNo={printSnapshot?.detayPasaportNo ?? detayPasaportNo}
        detayMeslek={printSnapshot?.detayMeslek ?? ""}
        detayCariTipi={printSnapshot?.detayCariTipi ?? ""}
        detayAdres={printSnapshot?.detayAdres ?? detayAdres}
        detayTelefonNo={printSnapshot?.detayTelefonNo ?? detayTelefonNo}
        vezneKod={printSnapshot?.vezneKod ?? vezneKod}
        vezne={vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null)}
        kullaniciAdi={printSnapshot?.kullaniciAdi ?? (user?.fullName || user?.username || "Kasiyer")}
        satirlar={printSnapshot?.satirlar ?? lines.filter((l) => parseDecimal(l.miktar) > 0 || parseDecimal(l.tutar) > 0 || parseDecimal(l.adet) > 0 || (l.urunAdi && l.urunAdi.trim() !== ""))}
        odemeSatirlari={printSnapshot?.odemeSatirlari ?? odemeRows.filter((o) => parseDecimal(o.miktar) > 0 || parseDecimal(o.tutar) > 0 || parseDecimal(o.adet) > 0 || (o.paraKodu && o.paraKodu.trim() !== ""))}
        toplamTutar={printSnapshot?.toplamTutar ?? totalTutar}
        toplamHas={printSnapshot?.toplamHas ?? alisHas}
        odenenTutar={printSnapshot?.odenenTutar ?? totalOdemeTutar}
        kalanTutar={printSnapshot?.kalanTutar ?? farkTL}
      />

      {/* A4 Teklif & Müşteri Tanı Formu Modalı (Kayıt etmeden çıkartır) */}
      <DovizTeklifTaniModal
        pageType="sarraf"
        show={showTeklifTaniModal}
        onHide={() => setShowTeklifTaniModal(false)}
        fisId={fisId}
        tip={tip}
        tarih={tarih}
        saat={saat}
        seriNo={seriNo}
        belgeNo={fisNo || "TEKLİF"}
        unvan={unvan || detayUnvan}
        vergiKimlikNo={detayVergiKimlikNo || (cariKartId ? (cariList.find((c) => c.id === cariKartId)?.vergiKimlikNo || "") : "")}
        cariKartId={cariKartId}
        detayUyruk={""}
        detayDogumTarihi={detayDogumTarihi}
        detayDogumYeri={detayDogumYeri}
        detayBabaAdi={detayBabaAdi}
        detayAnneAdi={detayAnneAdi}
        detayMeslek={""}
        detayTelefon={detayTelefonNo}
        detayIlce={""}
        detayIl={""}
        detayAdres={detayAdres}
        detayPasaportNo={detayPasaportNo}
        detayCariTipi={detayKisilikTipi === 1 ? "Firma" : "Şahıs"}
        detayVergiDairesi={""}
        satirlar={lines.filter((l) => parseDecimal(l.miktar) > 0 || parseDecimal(l.tutar) > 0 || parseDecimal(l.adet) > 0 || (l.urunAdi && l.urunAdi.trim() !== ""))}
        odemeSatirlari={odemeRows.filter((o) => parseDecimal(o.miktar) > 0 || parseDecimal(o.tutar) > 0 || parseDecimal(o.adet) > 0 || (o.paraKodu && o.paraKodu.trim() !== ""))}
        toplamHas={alisHas}
        odenenTutar={totalOdemeTutar}
        kalanTutar={farkTL}
        vezne={vezneList.find((v) => v.id === vezneId) || (vezneList.length > 0 ? vezneList[0] : null)}
        kullaniciAdi={user?.fullName || user?.username || "Kasiyer"}
        lines={lines
          .filter((l) => (l.urunId > 0 || (l.urunKodu && l.urunKodu.trim() !== "")) && (parseDecimal(l.miktar) > 0 || parseDecimal(l.adet) > 0 || parseDecimal(l.tutar) > 0))
          .map((l: any) => ({
            paraKodu: l.urunKodu || l.urunAdi || "SARRAF",
            paraAdi: l.urunAdi || l.urunKodu,
            miktar: parseDecimal(l.miktar) > 0 ? parseDecimal(l.miktar) : parseDecimal(l.adet),
            kur: parseDecimal(l.kur),
            tutar: parseDecimal(l.tutar),
          }))}
        toplamTutar={totalTutar}
        totalMasraf={0}
        sonToplam={totalTutar}
        bsmvTutari={0}
        totalKmv={0}
        komisyonTutari={0}
        giseUsdKuru={1}
        istatistikKodu={""}
        gelisNedeni={""}
        geldigiUlke={""}
        vezneKod={vezneKod}
        vezneAd={vezneList.find((v) => v.id === vezneId)?.ad || ""}
        companyDefinitions={companyDefinitions}
      />

      {/* Ürün ve Ödeme Tablosu Fark Onay Modalı */}
      <Modal
        show={showFarkConfirmModal.show}
        onHide={() => setShowFarkConfirmModal({ show: false, andPrint: false })}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-warning text-dark py-2">
          <Modal.Title style={{ fontSize: "15px", fontWeight: 700 }} className="d-flex align-items-center gap-2">
            <span>⚠️</span> Satış / Tahsilat Fark Uyarısı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="alert alert-warning mb-3 p-2.5" style={{ fontSize: "13px" }}>
            <div className="fw-bold mb-1">
              🚨 Ürün ve Ödeme Tablosu Arasında Fark Bulunmaktadır!
            </div>
            <div className="mt-2 d-flex flex-column gap-1 font-monospace">
              <div><strong>Satış Toplamı:</strong> <span>{totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span></div>
              <div><strong>Ödeme Toplamı:</strong> <span>{totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span></div>
              <div className="border-top pt-1 mt-1">
                <strong>Kalan Fark:</strong> <span className="text-danger fw-bold">{farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span>
                {Math.abs(farkHas) > 0.0001 && (
                  <span className="text-muted ms-2">({farkHas.toFixed(4)} Has)</span>
                )}
              </div>
            </div>
          </div>
          <p className="mb-0 text-secondary" style={{ fontSize: "13.5px" }}>
            Satış ve tahsilat tutarları eşit değil. Fişi kaydetmek için lütfen aşağıdaki seçeneklerden birini belirleyiniz:
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFarkConfirmModal({ show: false, andPrint: false })}
          >
            Vazgeç
          </Button>
          <div className="d-flex gap-2">
            <Button
              variant="warning"
              size="sm"
              className="fw-bold text-dark"
              onClick={() => {
                const andPrint = showFarkConfirmModal.andPrint;
                setShowFarkConfirmModal({ show: false, andPrint: false });
                setShowFarkIskontoSecimModal({ show: true, andPrint });
              }}
              title="Kalan fark tutarını iskonto olarak ödeme tablosuna ekler ve fişi kaydeder"
            >
              {farkTL > 0.01
                ? `Kalanını İskontoya At (${farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL)`
                : "Kalanını İskontoya At"}
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              className="fw-bold"
              onClick={() => {
                const andPrint = showFarkConfirmModal.andPrint;
                setShowFarkConfirmModal({ show: false, andPrint: false });
                void handleSave(true, andPrint, true);
              }}
            >
              Yine de Kaydet
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Kalan Fark İçin İskonto Seçim Modalı */}
      <Modal
        show={showFarkIskontoSecimModal.show}
        onHide={() => setShowFarkIskontoSecimModal({ show: false, andPrint: false })}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-warning text-dark py-2 px-3">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconCoins size={20} className="text-dark" />
            <span>Kalan Farkı Kapatmak İçin İskonto Seçin</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="alert alert-warning py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style={{ fontSize: "13px" }}>
            <div>
              <strong>Fiş Tutarı:</strong> {totalTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
              <span className="mx-2 text-muted">|</span>
              <strong>Ödeme Toplamı:</strong> {totalOdemeTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
            </div>
            <div>
              <strong>Kapatılacak Fark:</strong> <span className="text-danger fw-bold fs-6 font-monospace">{farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</span>
            </div>
          </div>

          <p className="text-muted mb-2" style={{ fontSize: "12px" }}>
            Yalnızca bu fiş tutarına ve kapatılacak farka ({farkTL.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL) uygun min/max limitleri sağlayan iskontolar listelenmiştir:
          </p>

          <div className="table-responsive border rounded" style={{ maxHeight: "320px", overflowY: "auto" }}>
            <Table hover size="sm" className="mb-0 align-middle" style={{ fontSize: "12px" }}>
              <thead className="table-light sticky-top" style={{ fontSize: "11px" }}>
                <tr>
                  <th style={{ width: "100px" }}>Kod</th>
                  <th>İskonto Tanımı</th>
                  <th style={{ width: "100px" }}>Türü</th>
                  <th style={{ width: "95px" }} className="text-end">Oran / Tutar</th>
                  <th style={{ width: "115px" }} className="text-end">Min Fiş Tutarı</th>
                  <th style={{ width: "115px" }} className="text-end">Max İskonto</th>
                  <th style={{ width: "110px" }} className="text-center">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {matchingFarkIskontolar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      <div>⚠️ Tanımlı iskontolar arasında bu fiş tutarı veya fark limitine uyan bir iskonto bulunamadı.</div>
                      <div className="mt-2 d-flex justify-content-center gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setShowNewIskontoModal(true);
                          }}
                        >
                          Yeni İskonto Tanımla
                        </Button>
                        <Button
                          variant="warning"
                          size="sm"
                          className="fw-bold"
                          onClick={() => {
                            void handleSelectIskontoForRemaining(
                              {
                                iskontoId: 0,
                                tanim: "Genel İskonto",
                                kod: "İSKONTO",
                                aktif: true,
                              } as any,
                              showFarkIskontoSecimModal.andPrint
                            );
                          }}
                        >
                          Genel İskonto İle Kapat & Kaydet
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  matchingFarkIskontolar.map((isk) => {
                    const iskTurLabel =
                      isk.iskontoTipi === 1
                        ? "Yüzde (%)"
                        : isk.iskontoTipi === 2
                          ? "Sabit TL"
                          : isk.iskontoTipi === 3
                            ? "Has Gram"
                            : "Serbest";
                    const iskDegerLabel =
                      isk.iskontoTipi === 1
                        ? `%${isk.oran || 0}`
                        : isk.iskontoTipi === 2
                          ? `${(isk.tutar || 0).toLocaleString("tr-TR")} TL`
                          : isk.iskontoTipi === 3
                            ? `${isk.hasTutar || 0} Has`
                            : (isk.tutar ? `${isk.tutar} TL` : (isk.oran ? `%${isk.oran}` : "-"));

                    return (
                      <tr
                        key={isk.iskontoId}
                        style={{ cursor: "pointer" }}
                        onDoubleClick={() => {
                          void handleSelectIskontoForRemaining(isk, showFarkIskontoSecimModal.andPrint);
                        }}
                      >
                        <td className="font-monospace fw-bold">{isk.kod || `ISK-${isk.iskontoId}`}</td>
                        <td className="fw-semibold">{isk.tanim}</td>
                        <td>
                          <span className={`badge ${isk.iskontoTipi === 1 ? "bg-info text-dark" : isk.iskontoTipi === 2 ? "bg-success" : isk.iskontoTipi === 3 ? "bg-warning text-dark" : "bg-secondary"}`}>
                            {iskTurLabel}
                          </span>
                        </td>
                        <td className="text-end font-monospace">{iskDegerLabel}</td>
                        <td className="text-end font-monospace text-muted">
                          {isk.minTutar ? `${Number(isk.minTutar).toLocaleString("tr-TR")} TL` : "-"}
                        </td>
                        <td className="text-end font-monospace text-muted">
                          {isk.maxIskontoTutari ? `${Number(isk.maxIskontoTutari).toLocaleString("tr-TR")} TL` : "-"}
                        </td>
                        <td className="text-center">
                          <Button
                            variant="primary"
                            size="sm"
                            className="py-0 px-2 fw-semibold"
                            style={{ fontSize: "11px" }}
                            onClick={() => {
                              void handleSelectIskontoForRemaining(isk, showFarkIskontoSecimModal.andPrint);
                            }}
                          >
                            Seç & Kaydet
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="py-2 px-3 d-flex justify-content-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFarkIskontoSecimModal({ show: false, andPrint: false })}
          >
            Vazgeç
          </Button>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowNewIskontoModal(true)}
            >
              Yeni İskonto Ekle
            </Button>
            {matchingFarkIskontolar.length > 0 && (
              <Button
                variant="outline-warning"
                size="sm"
                className="text-dark"
                onClick={() => {
                  void handleSelectIskontoForRemaining(
                    {
                      iskontoId: 0,
                      tanim: "Genel İskonto",
                      kod: "İSKONTO",
                      aktif: true,
                    } as any,
                    showFarkIskontoSecimModal.andPrint
                  );
                }}
              >
                Serbest İskonto ile Kapat
              </Button>
            )}
          </div>
        </Modal.Footer>
      </Modal>
      <SayfaCikisUyarisiModal
        acik={cikisUyarisi.acik}
        vazgec={cikisUyarisi.vazgec}
        yineDeKapat={cikisUyarisi.yineDeKapat}
      />
    </div>
  );
};

export default SarrafFisiPage;