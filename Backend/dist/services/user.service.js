import { UserSqlRepository } from "../models/userSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword } from "../utils/password.utils.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { logger } from "../utils/logger.js";
export class UserService {
    static async listUsers(query, dbContext) {
        try {
            let allUsers = await UserSqlRepository.findAll(dbContext);
            // Filtering
            if (query.search) {
                const s = query.search.toLowerCase();
                allUsers = allUsers.filter((u) => u.username.toLowerCase().includes(s) ||
                    u.fullName.toLowerCase().includes(s) ||
                    (u.email && u.email.toLowerCase().includes(s)) ||
                    u.cashierCode.includes(s));
            }
            if (query.role) {
                allUsers = allUsers.filter((u) => u.role === query.role);
            }
            if (query.isActive !== undefined) {
                allUsers = allUsers.filter((u) => u.isActive === query.isActive);
            }
            const total = allUsers.length;
            const page = query.page || 1;
            const limit = query.limit || 50;
            const startIndex = (page - 1) * limit;
            const paginatedUsers = allUsers.slice(startIndex, startIndex + limit);
            return {
                users: paginatedUsers.map(UserSqlRepository.toDto),
                total,
            };
        }
        catch (error) {
            logger.error("UserService.listUsers error:", error);
            throw error;
        }
    }
    static async getUserById(id, dbContext) {
        const user = await UserSqlRepository.findById(id, dbContext);
        if (!user) {
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        }
        return UserSqlRepository.toDto(user);
    }
    static async createUser(input, dbContext) {
        const existing = await UserSqlRepository.findByUsername(input.username, dbContext);
        if (existing) {
            throw ApiError.conflict(`"${input.username}" kullanıcı adı daha önce kayıtlıdır. Lütfen farklı bir kullanıcı adı seçiniz.`);
        }
        const securePassword = input.password ? await hashPassword(input.password) : "";
        const newUser = await UserSqlRepository.create({
            username: input.username,
            fullName: input.fullName || input.username,
            email: input.email ? input.email : undefined,
            password: securePassword,
            passwordHash: securePassword,
            role: input.role || "cashier",
            cashierCode: input.cashierCode || "00",
            isActive: input.isActive ?? true,
            isSysAdmin: input.isSysAdmin ?? false,
            displayDays: input.displayDays ?? 0,
            hasWorkspacePerm: input.hasWorkspacePerm ?? true,
            hasDateChangePerm: input.hasDateChangePerm ?? false,
            hasCommissionPerm: input.hasCommissionPerm ?? false,
            hasSlipNoChangePerm: input.hasSlipNoChangePerm ?? false,
            hasCashDeskBalanceCheck: input.hasCashDeskBalanceCheck ?? false,
            canViewAccountBalance: input.canViewAccountBalance ?? true,
            canViewOpenTermTrans: input.canViewOpenTermTrans ?? false,
            hasSlipBankAccountPerm: input.hasSlipBankAccountPerm ?? false,
            hasSlipAmountChangePerm: input.hasSlipAmountChangePerm ?? false,
            isSuspiciousTransAuth: input.isSuspiciousTransAuth ?? false,
            noCrossRateCheck: input.noCrossRateCheck ?? false,
            printerId: input.printerId ?? "1",
            horizontalZoom: input.horizontalZoom ?? 0,
            verticalZoom: input.verticalZoom ?? 0,
            hasCommissionRate: input.hasCommissionRate ?? false,
            commissionRate: input.commissionRate ?? 0,
            ratePermType: input.ratePermType ?? "Var",
            ratePermValue: input.ratePermValue ?? 0,
            menuPerms: input.menuPerms ? {
                mainMenu: input.menuPerms.mainMenu || "Tam Yetki",
                cashier: input.menuPerms.cashier || "Tam Yetki",
                safe: input.menuPerms.safe || "Tam Yetki",
                exchange: input.menuPerms.exchange || "Tam Yetki",
                accounts: input.menuPerms.accounts || "Tam Yetki",
                admin: input.menuPerms.admin || "Tam Yetki",
                accounting: input.menuPerms.accounting || "Tam Yetki",
                reports: input.menuPerms.reports || "Tam Yetki",
                consolidatedReports: input.menuPerms.consolidatedReports || "Tam Yetki",
                techOps: input.menuPerms.techOps || "Tam Yetki",
                movementType: input.menuPerms.movementType || "Tam Yetki",
            } : {
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
            buyStatCode: input.buyStatCode || "",
            sellStatCode: input.sellStatCode || "",
            arbitrageBuyStatCode: input.arbitrageBuyStatCode || "",
            arbitrageSellStatCode: input.arbitrageSellStatCode || "",
            integratorUsername: input.integratorUsername || "",
            integratorPassword: input.integratorPassword || "",
            isEDocumentActive: input.isEDocumentActive ?? false,
            masakUsername: input.masakUsername || "",
            masakPassword: input.masakPassword || "",
            hasMasakWarning: input.hasMasakWarning ?? false,
            noDeviationWarning: input.noDeviationWarning ?? false,
            canBeOutsideCounterRate: input.canBeOutsideCounterRate ?? false,
            appearance: input.appearance ? {
                enableProgramTheme: input.appearance.enableProgramTheme ?? true,
                programBgColor: input.appearance.programBgColor ?? "#f8fafc",
                programTextColor: input.appearance.programTextColor ?? "#0f172a",
                programFont: input.appearance.programFont ?? "Segoe UI, sans-serif",
                gridHeaderBgColor: input.appearance.gridHeaderBgColor ?? "#cbe5ff",
                gridBgColor: input.appearance.gridBgColor ?? "#ffffff",
                gridFont: input.appearance.gridFont ?? "Segoe UI, sans-serif",
                windowBgColor: input.appearance.windowBgColor ?? "#ffffff",
                windowTextColor: input.appearance.windowTextColor ?? "#000000",
                windowFocusColor: input.appearance.windowFocusColor ?? "#e2e8f0",
                enableMenuTheme: input.appearance.enableMenuTheme ?? true,
                menuBgColor: input.appearance.menuBgColor ?? "#bfe0ff",
                menuSelectedBgColor: input.appearance.menuSelectedBgColor ?? "#ff80ff",
                menuFont: input.appearance.menuFont ?? "Segoe UI, sans-serif",
                menuHeaderBgColor: input.appearance.menuHeaderBgColor ?? "#000080",
                menuHeaderFont: input.appearance.menuHeaderFont ?? "Segoe UI, sans-serif",
                menuBackdropColor: input.appearance.menuBackdropColor ?? "#ff8080",
                enableBuyHeaderTheme: input.appearance.enableBuyHeaderTheme ?? false,
                buyHeaderBgColor: input.appearance.buyHeaderBgColor ?? "#e2e8f0",
                buyHeaderTextColor: input.appearance.buyHeaderTextColor ?? "#000000",
                enableSellHeaderTheme: input.appearance.enableSellHeaderTheme ?? false,
                sellHeaderBgColor: input.appearance.sellHeaderBgColor ?? "#e2e8f0",
                sellHeaderTextColor: input.appearance.sellHeaderTextColor ?? "#000000",
            } : {
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
        }, dbContext);
        return UserSqlRepository.toDto(newUser);
    }
    static async updateUser(id, input, dbContext) {
        const existing = await UserSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        }
        if (input.username && input.username !== existing.username) {
            const usernameTaken = await UserSqlRepository.findByUsername(input.username, dbContext);
            if (usernameTaken && String(usernameTaken.id) !== String(id)) {
                throw ApiError.conflict(`"${input.username}" kullanıcı adı daha önce kayıtlıdır. Lütfen farklı bir kullanıcı adı seçiniz.`);
            }
        }
        const { menuPerms, appearance, ...restInput } = input;
        const updatePayload = {
            ...restInput,
            role: restInput.role,
            email: restInput.email ? restInput.email : undefined,
            displayDays: input.displayDays,
            horizontalZoom: input.horizontalZoom,
            verticalZoom: input.verticalZoom,
            commissionRate: input.commissionRate,
            ratePermValue: input.ratePermValue,
        };
        if (input.password !== undefined && input.password !== existing.password && input.password !== "") {
            const hashed = await hashPassword(input.password);
            updatePayload.password = hashed;
            updatePayload.passwordHash = hashed;
        }
        if (menuPerms) {
            updatePayload.menuPerms = { ...existing.menuPerms, ...menuPerms };
        }
        if (appearance) {
            updatePayload.appearance = { ...existing.appearance, ...appearance };
        }
        const updated = await UserSqlRepository.update(id, updatePayload, dbContext);
        if (!updated) {
            throw ApiError.internal("Kullanıcı güncellenemedi.");
        }
        return UserSqlRepository.toDto(updated);
    }
    static async deleteUser(id, dbContext) {
        const existing = await UserSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        }
        const deleted = await UserSqlRepository.delete(id, dbContext);
        if (!deleted) {
            throw ApiError.internal("Kullanıcı silinemedi.");
        }
    }
    static async getCashiers(dbContext) {
        return UserSqlRepository.getCashiers(dbContext);
    }
    static async updateAppearance(userId, appearance, dbContext) {
        const updated = await UserSqlRepository.updateAppearance(userId, appearance, dbContext);
        if (!updated) {
            throw ApiError.notFound(ResponseMessages.USER_NOT_FOUND);
        }
        return UserSqlRepository.toDto(updated);
    }
}
