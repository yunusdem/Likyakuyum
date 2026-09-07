import { UserRole } from "../constants/roles.js";
import bcrypt from "bcryptjs";
// Pre-hashed password for demo users ("admin123" and "123456")
const defaultAdminPasswordHash = bcrypt.hashSync("admin123", 10);
const defaultCashierPasswordHash = bcrypt.hashSync("123456", 10);
const initialUsers = [
    {
        id: "user-admin-01",
        username: "admin",
        fullName: "Yönetici (Admin)",
        email: "admin@ofiskuyumcu.com",
        passwordHash: defaultAdminPasswordHash,
        role: UserRole.ADMIN,
        cashierCode: "00",
        isActive: true,
        isSysAdmin: true,
        displayDays: 0,
        hasWorkspacePerm: true,
        hasDateChangePerm: true,
        hasCommissionPerm: true,
        hasSlipNoChangePerm: true,
        hasCashDeskBalanceCheck: false,
        canViewAccountBalance: true,
        canViewOpenTermTrans: false,
        hasSlipBankAccountPerm: false,
        hasSlipAmountChangePerm: false,
        isSuspiciousTransAuth: false,
        noCrossRateCheck: false,
        printerId: "2",
        horizontalZoom: 0,
        verticalZoom: 0,
        hasCommissionRate: false,
        commissionRate: 0.0,
        ratePermType: "Var",
        ratePermValue: 0.0,
        menuPerms: {
            mainMenu: "Tam Yetki",
            cashier: "Tam Yetki",
            safe: "Tam Yetki",
            exchange: "Tam Yetki",
            accounts: "Tam Yetki",
            admin: "Tam Yetki",
            accounting: "Tam Yetki",
            reports: "Tam Yetki",
            consolidatedReports: "Tam Yetki",
            techOps: "Tam Yetki",
            movementType: "Tam Yetki",
        },
        buyStatCode: "IST-ALIS-01",
        sellStatCode: "IST-SATIS-01",
        arbitrageBuyStatCode: "ARB-AL-01",
        arbitrageSellStatCode: "ARB-SAT-01",
        appearance: {
            enableProgramTheme: true,
            programBgColor: "#f8fafc",
            programTextColor: "#0f172a",
            programFont: "Segoe UI, sans-serif",
            gridHeaderBgColor: "#cbe5ff",
            gridBgColor: "#ffffff",
            gridFont: "Segoe UI, sans-serif",
            windowBgColor: "#ffffff",
            windowTextColor: "#000000",
            windowFocusColor: "#e2e8f0",
            enableMenuTheme: true,
            menuBgColor: "#bfe0ff",
            menuSelectedBgColor: "#ff80ff",
            menuFont: "Segoe UI, sans-serif",
            menuHeaderBgColor: "#000080",
            menuHeaderFont: "Segoe UI, sans-serif",
            menuBackdropColor: "#ff8080",
            enableBuyHeaderTheme: false,
            buyHeaderBgColor: "#e2e8f0",
            buyHeaderTextColor: "#000000",
            enableSellHeaderTheme: false,
            sellHeaderBgColor: "#e2e8f0",
            sellHeaderTextColor: "#000000",
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
        id: "user-cashier-01",
        username: "vezne01",
        fullName: "Ahmet Veznedar",
        email: "ahmet@ofiskuyumcu.com",
        passwordHash: defaultCashierPasswordHash,
        role: UserRole.CASHIER,
        cashierCode: "01",
        isActive: true,
        isSysAdmin: false,
        displayDays: 30,
        hasWorkspacePerm: false,
        hasDateChangePerm: false,
        hasCommissionPerm: true,
        hasSlipNoChangePerm: false,
        hasCashDeskBalanceCheck: true,
        canViewAccountBalance: true,
        canViewOpenTermTrans: false,
        hasSlipBankAccountPerm: true,
        hasSlipAmountChangePerm: false,
        isSuspiciousTransAuth: false,
        noCrossRateCheck: false,
        printerId: "1",
        horizontalZoom: 0,
        verticalZoom: 0,
        hasCommissionRate: true,
        commissionRate: 1.5,
        ratePermType: "Var",
        ratePermValue: 0.5,
        menuPerms: {
            mainMenu: "Kısıtlı",
            cashier: "Tam Yetki",
            safe: "Tam Yetki",
            exchange: "Görüntüleme",
            accounts: "Kısıtlı",
            admin: "Yetki Yok",
            accounting: "Yetki Yok",
            reports: "Kısıtlı",
            consolidatedReports: "Yetki Yok",
            techOps: "Yetki Yok",
            movementType: "Kısıtlı",
        },
        buyStatCode: "IST-ALIS-02",
        sellStatCode: "IST-SATIS-02",
        arbitrageBuyStatCode: "ARB-AL-02",
        arbitrageSellStatCode: "ARB-SAT-02",
        appearance: {
            enableProgramTheme: false,
            programBgColor: "#ffffff",
            programTextColor: "#000000",
            programFont: "Segoe UI, sans-serif",
            gridHeaderBgColor: "#e2e8f0",
            gridBgColor: "#ffffff",
            gridFont: "Segoe UI, sans-serif",
            windowBgColor: "#ffffff",
            windowTextColor: "#000000",
            windowFocusColor: "#cbd5e1",
            enableMenuTheme: false,
            menuBgColor: "#f1f5f9",
            menuSelectedBgColor: "#e0e7ff",
            menuFont: "Segoe UI, sans-serif",
            menuHeaderBgColor: "#1e293b",
            menuHeaderFont: "Segoe UI, sans-serif",
            menuBackdropColor: "#f8fafc",
            enableBuyHeaderTheme: false,
            buyHeaderBgColor: "#e2e8f0",
            buyHeaderTextColor: "#000000",
            enableSellHeaderTheme: false,
            sellHeaderBgColor: "#e2e8f0",
            sellHeaderTextColor: "#000000",
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
];
/**
 * In-Memory Type-Safe User Repository
 */
export class UserRepository {
    static users = [...initialUsers];
    static async findAll() {
        return [...this.users];
    }
    static async findById(id) {
        const user = this.users.find((u) => u.id === id);
        return user ? { ...user } : null;
    }
    static async findByUsername(username) {
        const user = this.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
        return user ? { ...user } : null;
    }
    static async findByEmail(email) {
        const user = this.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        return user ? { ...user } : null;
    }
    static async create(userData) {
        const newUser = {
            ...userData,
            id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.users.push(newUser);
        return { ...newUser };
    }
    static async update(id, updateData) {
        const index = this.users.findIndex((u) => u.id === id);
        if (index === -1)
            return null;
        this.users[index] = {
            ...this.users[index],
            ...updateData,
            updatedAt: new Date(),
        };
        return { ...this.users[index] };
    }
    static async delete(id) {
        const initialLen = this.users.length;
        this.users = this.users.filter((u) => u.id !== id);
        return this.users.length < initialLen;
    }
    static toDto(user) {
        const { passwordHash, refreshToken, ...dto } = user;
        return dto;
    }
}
