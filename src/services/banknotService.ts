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
   * Deletes a currency completely (both TODVZ_BANKNOT and TODVZ_PARA)
   */
  public static async deleteCurrency(paraId: number): Promise<boolean> {
    const res = await apiClient.delete<{ paraId: number }>(`/banknot/currency/${paraId}`);
    return res.success;
  }
}

export default BanknotService;
