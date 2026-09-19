import { PerakendeSqlRepository, CreateInvoiceDto, InvoiceFilterDto } from "../models/perakendeSql.repository.js";

export class PerakendeService {
  static async createInvoice(dto: CreateInvoiceDto, userId?: number, dbContext?: { dbServer?: string; dbName?: string }) {
    return PerakendeSqlRepository.createInvoice(dto, userId, dbContext);
  }

  static async getInvoiceById(id: number, dbContext?: { dbServer?: string; dbName?: string }) {
    return PerakendeSqlRepository.getInvoiceById(id, dbContext);
  }

  static async listInvoices(filters: InvoiceFilterDto, dbContext?: { dbServer?: string; dbName?: string }) {
    return PerakendeSqlRepository.listInvoices(filters, dbContext);
  }

  static async deleteInvoice(id: number, dbContext?: { dbServer?: string; dbName?: string }) {
    return PerakendeSqlRepository.deleteInvoice(id, dbContext);
  }

  static async getProductByBarcode(barcode: string, dbContext?: { dbServer?: string; dbName?: string }) {
    return PerakendeSqlRepository.getProductByBarcode(barcode, dbContext);
  }

  static async getNextFaturaNo(prefix?: string, dbContext?: { dbServer?: string; dbName?: string }) {
    return PerakendeSqlRepository.getNextFaturaNo(prefix, dbContext);
  }
}
