import {
  PosCihaziSqlRepository,
  PosCihaziModel,
  SavePosCihaziDto,
} from "../models/posCihaziSql.repository.js";

type DbCtx = { dbServer?: string; dbName?: string };

export class PosCihaziService {
  public static getPosCihazlari(dbContext?: DbCtx): Promise<PosCihaziModel[]> {
    return PosCihaziSqlRepository.getAll(dbContext);
  }

  public static getPosCihaziById(id: number, dbContext?: DbCtx): Promise<PosCihaziModel | null> {
    return PosCihaziSqlRepository.getById(id, dbContext);
  }

  public static getPosCihaziBakiye(id: number, dbContext?: DbCtx): Promise<number> {
    return PosCihaziSqlRepository.getBakiye(id, dbContext);
  }

  public static getNextPosKod(dbContext?: DbCtx): Promise<string> {
    return PosCihaziSqlRepository.getNextPosKod(dbContext);
  }

  public static savePosCihazi(dto: SavePosCihaziDto, dbContext?: DbCtx): Promise<PosCihaziModel> {
    return PosCihaziSqlRepository.save(dto, dbContext);
  }

  public static deletePosCihazi(id: number, dbContext?: DbCtx): Promise<boolean> {
    return PosCihaziSqlRepository.delete(id, dbContext);
  }
}
