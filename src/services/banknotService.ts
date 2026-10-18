import { apiClient } from "./apiClient";

export interface BanknotItem {
  paraId: number;
  banknotId: number;
  miktar: number;
}

export interface BanknotCurrencyItem {
  id: number;
  kod: string;
  ad: string;
  siraNo: number;
  banknotSayisi: number;
}

export interface CurrencyUsageInfo {
  hasPano: boolean;
  panoCount: number;
  panoNames: string[];
  hasVezne: boolean;
  vezneNames: string[];
  hasBakiye: boolean;
  totalBakiye: number;
  bakiyeDetails: { vezneKod: string; vezneAd: string; miktar: number }[];
  banknotCount: number;
  kurCount: number;
  hasFis: boolean;
  fisCount: number;
}

export class BanknotService {
  /**
   * Fetches all currencies with their banknot count
   */
  public static async getCurrencies(): Promise<BanknotCurrencyItem[]> {
    const res = await apiClient.get<BanknotCurrencyItem[]>("/banknot/currencies");
    return res.data || [];
  }

  /**
   * Adds or registers a new currency in TODVZ_PARA
   */
  public static async createCurrency(payload: { kod: string; ad: string }): Promise<BanknotCurrencyItem> {
    const res = await apiClient.post<BanknotCurrencyItem>("/banknot/create-currency", payload);
    return res.data as BanknotCurrencyItem;
  }

  /**
   * Fetches all banknot records for a specific currency
   */
  public static async getBanknotlar(paraId: number): Promise<BanknotItem[]> {
    const res = await apiClient.get<BanknotItem[]>(`/banknot/${paraId}`);
    return res.data || [];
  }

  /**
   * Saves or replaces banknotes for a specific currency
   */
  public static async saveBanknotlar(
    paraId: number,
    banknotlar: { banknotId: number; miktar: number }[]
  ): Promise<BanknotItem[]> {
    const res = await apiClient.post<BanknotItem[]>(`/banknot/${paraId}`, { banknotlar });
    return res.data || [];
  }

  /**
   * Deletes all banknotes for a currency
   */
  public static async deleteBanknotlar(paraId: number): Promise<boolean> {
    const res = await apiClient.delete<{ paraId: number }>(`/banknot/${paraId}`);
    return res.success;
  }

  /**
   * Fetches currency usage info across pano, vezne, bakiye, and fiş
   */
  public static async getCurrencyUsage(paraId: number): Promise<CurrencyUsageInfo> {
    const res = await apiClient.get<CurrencyUsageInfo>(`/banknot/currency-usage/${paraId}`);
    return res.data as CurrencyUsageInfo;
  }

  /**
   * Deletes a currency completely (TODVZ_BANKNOT, TODVZ_KUR, TODVZ_PANO_SATIRI, TODVZ_VEZNE_BAKIYE, TODVZ_PARA)
   */
  public static async deleteCurrency(paraId: number, options?: { force?: boolean }): Promise<boolean> {
    const url = options?.force ? `/banknot/currency/${paraId}?force=true` : `/banknot/currency/${paraId}`;
    const res = await apiClient.delete<{ paraId: number }>(url);
    return res.success;
  }
}

export default BanknotService;
