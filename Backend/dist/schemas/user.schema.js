import { z } from "zod";
import { UserRole } from "../constants/roles.js";
const flexNumber = (defaultVal = 0) => z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
    if (val === undefined || val === null || val === "")
        return defaultVal;
    const num = parseFloat(String(val));
    return isNaN(num) ? defaultVal : num;
});
const menuPermissionsSchema = z.object({
    mainMenu: z.string().default("Tam Yetki"),
    cashier: z.string().default("Tam Yetki"),
    safe: z.string().default("Tam Yetki"),
    exchange: z.string().default("Tam Yetki"),
    accounts: z.string().default("Tam Yetki"),
    admin: z.string().default("Tam Yetki"),
    accounting: z.string().default("Tam Yetki"),
    reports: z.string().default("Tam Yetki"),
    consolidatedReports: z.string().default("Tam Yetki"),
    techOps: z.string().default("Tam Yetki"),
    movementType: z.string().default("Tam Yetki"),
});
const appearanceThemeSchema = z.object({
    enableProgramTheme: z.boolean().default(true),
    programBgColor: z.string().default("#f8fafc"),
    programTextColor: z.string().default("#0f172a"),
    programFont: z.string().default("Segoe UI, sans-serif"),
    gridHeaderBgColor: z.string().default("#cbe5ff"),
    gridBgColor: z.string().default("#ffffff"),
    gridFont: z.string().default("Segoe UI, sans-serif"),
    windowBgColor: z.string().default("#ffffff"),
    windowTextColor: z.string().default("#000000"),
    windowFocusColor: z.string().default("#e2e8f0"),
    enableMenuTheme: z.boolean().default(true),
    menuBgColor: z.string().default("#bfe0ff"),
    menuSelectedBgColor: z.string().default("#ff80ff"),
    menuFont: z.string().default("Segoe UI, sans-serif"),
    menuHeaderBgColor: z.string().default("#000080"),
    menuHeaderFont: z.string().default("Segoe UI, sans-serif"),
    menuBackdropColor: z.string().default("#ff8080"),
    enableBuyHeaderTheme: z.boolean().default(false),
    buyHeaderBgColor: z.string().default("#e2e8f0"),
    buyHeaderTextColor: z.string().default("#000000"),
    enableSellHeaderTheme: z.boolean().default(false),
    sellHeaderBgColor: z.string().default("#e2e8f0"),
    sellHeaderTextColor: z.string().default("#000000"),
});
export const createUserSchema = z.object({
    body: z.object({
        username: z
            .string()
            .min(1, "Kullanıcı adı boş bırakılamaz")
            .max(50, "Kullanıcı adı en fazla 50 karakter olabilir"),
        fullName: z.string().optional().default(""),
        email: z.string().optional().nullable().or(z.literal("")).default(""),
        password: z.string().optional().default(""),
        role: z.string().optional().default(UserRole.CASHIER),
        cashierCode: z.union([z.string(), z.number()]).optional().default("00").transform((v) => String(v)),
        isActive: z.boolean().optional().default(true),
        // Permissions
        isSysAdmin: z.boolean().optional().default(false),
        displayDays: flexNumber(0),
        hasWorkspacePerm: z.boolean().optional().default(true),
        hasDateChangePerm: z.boolean().optional().default(false),
        hasCommissionPerm: z.boolean().optional().default(false),
        hasSlipNoChangePerm: z.boolean().optional().default(false),
        hasCashDeskBalanceCheck: z.boolean().optional().default(false),
        canViewAccountBalance: z.boolean().optional().default(true),
        canViewOpenTermTrans: z.boolean().optional().default(false),
        hasSlipBankAccountPerm: z.boolean().optional().default(false),
        hasSlipAmountChangePerm: z.boolean().optional().default(false),
        isSuspiciousTransAuth: z.boolean().optional().default(false),
        noCrossRateCheck: z.boolean().optional().default(false),
        // Hardware & Zoom
        printerId: z.union([z.string(), z.number()]).optional().default("1").transform((v) => String(v)),
        horizontalZoom: flexNumber(0),
        verticalZoom: flexNumber(0),
        hasCommissionRate: z.boolean().optional().default(false),
        commissionRate: flexNumber(0),
        ratePermType: z.string().optional().default("Var"),
        ratePermValue: flexNumber(0),
        menuPerms: menuPermissionsSchema.passthrough().optional(),
        buyStatCode: z.union([z.string(), z.number()]).optional().default("").transform((v) => String(v || "")),
        sellStatCode: z.union([z.string(), z.number()]).optional().default("").transform((v) => String(v || "")),
        arbitrageBuyStatCode: z.union([z.string(), z.number()]).optional().default("").transform((v) => String(v || "")),
        arbitrageSellStatCode: z.union([z.string(), z.number()]).optional().default("").transform((v) => String(v || "")),
        // E-Document & Masak
        integratorUsername: z.string().optional().default(""),
        integratorPassword: z.string().optional().default(""),
        isEDocumentActive: z.boolean().optional().default(false),
        masakUsername: z.string().optional().default(""),
        masakPassword: z.string().optional().default(""),
        hasMasakWarning: z.boolean().optional().default(false),
        noDeviationWarning: z.boolean().optional().default(false),
        canBeOutsideCounterRate: z.boolean().optional().default(false),
        appearance: appearanceThemeSchema.passthrough().optional(),
    }).passthrough(),
});
export const updateUserSchema = z.object({
    params: z.object({
        id: z.string().min(1, "Kullanıcı ID zorunludur"),
    }),
    body: z.object({
        username: z.string().min(1).optional(),
        fullName: z.string().optional(),
        email: z.string().optional().nullable().or(z.literal("")),
        password: z.string().optional(),
        role: z.string().optional(),
        cashierCode: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v) : undefined)),
        isActive: z.boolean().optional(),
        isSysAdmin: z.boolean().optional(),
        displayDays: flexNumber(0),
        hasWorkspacePerm: z.boolean().optional(),
        hasDateChangePerm: z.boolean().optional(),
        hasCommissionPerm: z.boolean().optional(),
        hasSlipNoChangePerm: z.boolean().optional(),
        hasCashDeskBalanceCheck: z.boolean().optional(),
        canViewAccountBalance: z.boolean().optional(),
        canViewOpenTermTrans: z.boolean().optional(),
        hasSlipBankAccountPerm: z.boolean().optional(),
        hasSlipAmountChangePerm: z.boolean().optional(),
        isSuspiciousTransAuth: z.boolean().optional(),
        noCrossRateCheck: z.boolean().optional(),
        printerId: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v) : undefined)),
        horizontalZoom: flexNumber(0),
        verticalZoom: flexNumber(0),
        hasCommissionRate: z.boolean().optional(),
        commissionRate: flexNumber(0),
        ratePermType: z.string().optional(),
        ratePermValue: flexNumber(0),
        menuPerms: menuPermissionsSchema.partial().passthrough().optional(),
        buyStatCode: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v || "") : undefined)),
        sellStatCode: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v || "") : undefined)),
        arbitrageBuyStatCode: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v || "") : undefined)),
        arbitrageSellStatCode: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v || "") : undefined)),
        integratorUsername: z.string().optional(),
        integratorPassword: z.string().optional(),
        isEDocumentActive: z.boolean().optional(),
        masakUsername: z.string().optional(),
        masakPassword: z.string().optional(),
        hasMasakWarning: z.boolean().optional(),
        noDeviationWarning: z.boolean().optional(),
        canBeOutsideCounterRate: z.boolean().optional(),
        appearance: appearanceThemeSchema.partial().passthrough().optional(),
    }).passthrough(),
});
export const getUserByIdSchema = z.object({
    params: z.object({
        id: z.string().min(1, "Kullanıcı ID zorunludur"),
    }),
});
export const listUsersQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
        limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
        search: z.string().optional(),
        role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.USER]).optional(),
        isActive: z.string().optional().transform((v) => (v === undefined ? undefined : v === "true")),
    }),
});
