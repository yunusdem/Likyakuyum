import { UserRoleType } from "../constants/roles.js";

export interface UserMenuPermissions {
  mainMenu: string;
  cashier: string;
  safe: string;
  exchange: string;
  accounts: string;
  admin: string;
  accounting: string;
  reports: string;
  consolidatedReports: string;
  techOps: string;
  movementType: string;
}

export interface UserAppearanceTheme {
  enableProgramTheme: boolean;
  programBgColor: string;
  programTextColor: string;
  programFont: string;
  gridHeaderBgColor: string;
  gridBgColor: string;
  gridFont: string;
  windowBgColor: string;
  windowTextColor: string;
  windowFocusColor: string;

  enableMenuTheme: boolean;
  menuBgColor: string;
  menuSelectedBgColor: string;
  menuFont: string;
  menuHeaderBgColor: string;
  menuHeaderFont: string;
  menuBackdropColor: string;

  enableBuyHeaderTheme: boolean;
  buyHeaderBgColor: string;
  buyHeaderTextColor: string;

  enableSellHeaderTheme: boolean;
  sellHeaderBgColor: string;
  sellHeaderTextColor: string;
}

export interface UserModel {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  role: UserRoleType;
  cashierCode: string;
  isActive: boolean;

  // Permissions & Hardware
  isSysAdmin: boolean;
  displayDays: number | string;
  hasWorkspacePerm: boolean;
  hasDateChangePerm: boolean;
  hasCommissionPerm: boolean;
  hasSlipNoChangePerm: boolean;
  hasCashDeskBalanceCheck: boolean;
  canViewAccountBalance: boolean;
  canViewOpenTermTrans: boolean;
  hasSlipBankAccountPerm: boolean;
  hasSlipAmountChangePerm: boolean;
  isSuspiciousTransAuth: boolean;
  noCrossRateCheck: boolean;

  printerId: string;
  horizontalZoom: number | string;
  verticalZoom: number | string;
  hasCommissionRate: boolean;
  commissionRate: number | string;
  ratePermType: string;
  ratePermValue: number | string;

  menuPerms: UserMenuPermissions;

  // Stat Codes
  buyStatCode: string;
  sellStatCode: string;
  arbitrageBuyStatCode: string;
  arbitrageSellStatCode: string;

  // E-Document & Masak Settings
  integratorUsername?: string;
  integratorPassword?: string;
  isEDocumentActive?: boolean;
  masakUsername?: string;
  masakPassword?: string;
  hasMasakWarning?: boolean;
  noDeviationWarning?: boolean;
  canBeOutsideCounterRate?: boolean;

  // Theme Settings
  appearance: UserAppearanceTheme;

  refreshToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserResponseDto = Omit<UserModel, "passwordHash" | "refreshToken">;

/**
 * Exact representation of MSSQL [R2016_dvz].[dbo].[TODVZ_KULLANICI] table columns
 */
export interface TodvzKullaniciEntity {
  KULLANICI_ID: number | string;
  AD: string;
  SIFRE?: string | null;
  SISTEM_YONETICISI?: number | boolean | null;
  YAZICI_ID?: number | string | null;
  VEZNE_ID?: number | string | null;
  KUR_YETKISI?: number | string | null;
  KUR_TOLERANS_ORANI?: number | null;
  KOMISYON_ALMA_YETKISI?: number | boolean | null;
  PROGRAM_ZEMIN_RENGI?: number | string | null;
  PROGRAM_YAZI_RENGI?: number | string | null;
  MENU_FONTU?: string | null;
  MENU_BASLIK_FONTU?: string | null;
  PROGRAM_GRID_BASLIK_RENGI?: number | string | null;
  MENU_ARKA_PLAN_RENGI?: number | string | null;
  ANA_MENU_YETKISI?: number | string | null;
  VEZNE_ISLEMLERI_YETKISI?: number | string | null;
  KASA_ISLEMLERI_YETKISI?: number | string | null;
  KUR_ISLEMLERI_YETKISI?: number | string | null;
  CARI_ISLEMLER_YETKISI?: number | string | null;
  YONETICI_ISLEMLERI_YETKISI?: number | string | null;
  MUHASEBE_YETKISI?: number | string | null;
  RAPORLAR_YETKISI?: number | string | null;
  TEKNIK_ISLEMLER_YETKISI?: number | string | null;
  ALAN_ISLEMLERI_YETKISI?: number | string | null;
  TARIH_DEGISTIRME_YETKISI?: number | boolean | null;
  PROGRAM_GRID_ZEMIN_RENGI?: number | string | null;
  PROGRAM_PENCERE_ZEMIN_RENGI?: number | string | null;
  PROGRAM_PENCERE_YAZI_RENGI?: number | string | null;
  PROGRAM_PENCERE_FOKUS_RENGI?: number | string | null;
  DIALOG_FONTU?: string | null;
  GRID_FONTU?: string | null;
  DIKEY_ZOOM?: number | null;
  YATAY_ZOOM?: number | null;
  ALIS_FISI_BASLIK_ZEMIN_RENGI?: number | string | null;
  ALIS_FISI_BASLIK_YAZI_RENGI?: number | string | null;
  SATIS_FISI_BASLIK_ZEMIN_RENGI?: number | string | null;
  SATIS_FISI_BASLIK_YAZI_RENGI?: number | string | null;
  FIS_NO_DEGISTIRME_YETKISI?: number | boolean | null;
  VEZNE_BAKIYE_KONTROLU?: number | boolean | null;
  KOMISYON_ORANI?: number | null;
  HAREKET_TIPI_VAR?: number | boolean | null;
  HAREKET_TIPI?: number | string | null;
  CARI_BAKIYE_GOREBILIR?: number | boolean | null;
  ACIK_VADELI_ISLEM_GOREBILIR?: number | boolean | null;
  FIS_BANKA_HESABI_SECME_YETKISI?: number | boolean | null;
  FIS_TUTAR_DEGISTIRME_YETKISI?: number | boolean | null;
  FIS_GOSTERME_GUN_SAYISI?: number | null;
  KONSOLIDE_RAPORLAR_YETKISI?: number | string | null;
  ALIS_ISTATISTIK_ID?: number | string | null;
  SATIS_ISTATISTIK_ID?: number | string | null;
  ARBITRAJ_ALIS_ISTATISTIK_ID?: number | string | null;
  ARBITRAJ_SATIS_ISTATISTIK_ID?: number | string | null;
  ENTEGRATOR_KULLANICI_ADI?: string | null;
  ENTEGRATOR_KULLANICI_SIFRESI?: string | null;
  E_BELGE_KULLANILIYOR?: number | boolean | null;
  MASAK_KULLANICI_ADI?: string | null;
  MASAK_KULLANICI_SIFRESI?: string | null;
  MASAK_UYARISI_VERSIN?: number | boolean | null;
  SUPHELI_ISLEMLER_YETKILISI?: number | boolean | null;
  SAPMA_UYARISI_VERILMESIN?: number | boolean | null;
  GISE_KURU_DISINDA_OLABILIR?: number | boolean | null;
  CAPRAZ_KUR_KONTROLU_YOK?: number | boolean | null;
}

