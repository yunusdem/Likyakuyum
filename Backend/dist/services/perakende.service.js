import { PerakendeSqlRepository } from "../models/perakendeSql.repository.js";
export class PerakendeService {
    static async createInvoice(dto, userId, dbContext) {
        return PerakendeSqlRepository.createInvoice(dto, userId, dbContext);
    }
    static async getInvoiceById(id, dbContext) {
        return PerakendeSqlRepository.getInvoiceById(id, dbContext);
    }
    static async listInvoices(filters, dbContext) {
        return PerakendeSqlRepository.listInvoices(filters, dbContext);
    }
    static async deleteInvoice(id, dbContext) {
        return PerakendeSqlRepository.deleteInvoice(id, dbContext);
    }
    static async getProductByBarcode(barcode, dbContext) {
        return PerakendeSqlRepository.getProductByBarcode(barcode, dbContext);
    }
    static async getNextFaturaNo(prefix, dbContext) {
        return PerakendeSqlRepository.getNextFaturaNo(prefix, dbContext);
    }
}
