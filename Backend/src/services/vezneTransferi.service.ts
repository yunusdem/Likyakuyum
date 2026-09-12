import {
  VezneTransferiSqlRepository,
  VezneTransferiModel,
  VezneTransferiListItem,
  SaveVezneTransferiDto,
} from "../models/vezneTransferiSql.repository.js";

export class VezneTransferiService {
  public static async getTransfers(
    filters: {
      search?: string;
      alanVezneId?: number;
      verenVezneId?: number;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneTransferiListItem[]> {
    return VezneTransferiSqlRepository.findAll(filters, dbContext);
  }

  public static async getTransferById(
    id: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneTransferiModel | null> {
    return VezneTransferiSqlRepository.findById(id, dbContext);
  }

  public static async saveTransfer(
    dto: SaveVezneTransferiDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<VezneTransferiModel> {
    return VezneTransferiSqlRepository.saveViaProcedure(dto, dbContext);
  }

  public static async deleteTransfer(
    id: number,
    kullaniciId: number = 1,
    degisiklikTakipVar: boolean = false,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return VezneTransferiSqlRepository.deleteViaProcedure(id, kullaniciId, degisiklikTakipVar, dbContext);
  }

  public static async getNavigation(
    currentId?: number | null,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ firstId: number | null; prevId: number | null; nextId: number | null; lastId: number | null }> {
    return VezneTransferiSqlRepository.getNavigation(currentId, dbContext);
  }

  public static async getNextRefNo(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string> {
    return VezneTransferiSqlRepository.getNextRefNo(dbContext);
  }

  public static async getVezneBakiyeler(
    vezneId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ paraId: number; paraKodu: string; paraAdi: string; miktar: number }[]> {
    return VezneTransferiSqlRepository.getVezneBakiyeler(vezneId, dbContext);
  }
}
