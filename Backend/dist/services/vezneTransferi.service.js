import { VezneTransferiSqlRepository, } from "../models/vezneTransferiSql.repository.js";
export class VezneTransferiService {
    static async getTransfers(filters, dbContext) {
        return VezneTransferiSqlRepository.findAll(filters, dbContext);
    }
    static async getTransferById(id, dbContext) {
        return VezneTransferiSqlRepository.findById(id, dbContext);
    }
    static async saveTransfer(dto, dbContext) {
        return VezneTransferiSqlRepository.saveViaProcedure(dto, dbContext);
    }
    static async deleteTransfer(id, kullaniciId = 1, degisiklikTakipVar = false, dbContext) {
        return VezneTransferiSqlRepository.deleteViaProcedure(id, kullaniciId, degisiklikTakipVar, dbContext);
    }
    static async getNavigation(currentId, dbContext) {
        return VezneTransferiSqlRepository.getNavigation(currentId, dbContext);
    }
    static async getNextRefNo(dbContext) {
        return VezneTransferiSqlRepository.getNextRefNo(dbContext);
    }
    static async getVezneBakiyeler(vezneId, dbContext) {
        return VezneTransferiSqlRepository.getVezneBakiyeler(vezneId, dbContext);
    }
}
