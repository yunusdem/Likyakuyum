import { apiClient, ApiResponse } from "./apiClient";

export interface UserProfileDto {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role: string;
  password?: string;
  cashierCode: string;
  isActive: boolean;

  // General Tab - Left Permissions
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

  // General Tab - Middle
  printerId: string;
  horizontalZoom: number | string;
  verticalZoom: number | string;
  hasCommissionRate: boolean;
  commissionRate: number | string;
  ratePermType: string;
  ratePermValue: number | string;

  // General Tab - Right Menu Perms
  menuPerms: {
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
  };

  // General Tab - Stat Codes
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

  // Appearance Tab
  appearance: {
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
  };
}

export const UserService = {
  /**
   * Fetches all users from MSSQL TODVZ_KULLANICI via backend
   */
  async listUsers(params?: { search?: string; role?: string; isActive?: boolean; page?: number; limit?: number }) {
    const res = await apiClient.get<UserProfileDto[]>("/users", params);
    return res;
  },

  /**
   * Fetches a single user by ID
   */
  async getUserById(id: string) {
    const res = await apiClient.get<UserProfileDto>(`/users/${id}`);
    return res.data;
  },

  /**
   * Creates a new user in MSSQL TODVZ_KULLANICI
   */
  async createUser(payload: Partial<UserProfileDto>) {
    const res = await apiClient.post<UserProfileDto>("/users", payload);
    return res.data;
  },

  /**
   * Updates an existing user in MSSQL TODVZ_KULLANICI
   */
  async updateUser(id: string, payload: Partial<UserProfileDto>) {
    const res = await apiClient.put<UserProfileDto>(`/users/${id}`, payload);
    return res.data;
  },

  /**
   * Deletes a user from MSSQL TODVZ_KULLANICI
   */
  async deleteUser(id: string) {
    const res = await apiClient.delete(`/users/${id}`);
    return res;
  },

  /**
   * Directly updates appearance colors and fonts in SQL for authenticated user
   */
  async updateMyAppearance(appearance: any) {
    const res = await apiClient.put<UserProfileDto>("/users/appearance", { appearance });
    return res.data;
  },

  /**
   * Fetches valid cashiers list from MSSQL TODVZ_VEZNE
   */
  async getCashiers() {
    const res = await apiClient.get<{ id: number; kod?: string; name: string }[]>("/users/cashiers");
    return res.data || [];
  },
};


