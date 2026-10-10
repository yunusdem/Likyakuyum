import "dotenv/config";
import { getDbPool } from "./config/mssql.config.js";
import { DovizFisSqlRepository } from "./models/dovizFisSql.repository.js";

async function main() {
  try {
    const pool = await getDbPool();
    console.log("Connected to DB successfully");

    const payload: any = {
      vezneId: 1,
      tip: 0,
      tarih: "2026-10-10",
      zaman: "13:43",
      seriNo: "",
      belgeNo: "",
      gelisNedeni: "",
      kurTuru: 0,
      istatistikId: 9249,
      cariKartId: null,
      unvan: "İsim beyan edilmemiştir",
      kisilikTipi: 0,
      toplamTutar: 24000,
      odemeTutari: 24000,
      satirlar: [
        {
          satirNo: 0,
          paraId: 2, // USD
          paraKodu: "USD",
          paraAdi: "Amerikan Doları",
          miktar: 500,
          kur: 48,
          iscilik: 0,
          giseKuru: 48,
          tutar: 24000,
          komisyonOrani: 5,
          komisyon: 1200,
          bmvOrani: 5,
          bmv: 0,
          kmvOrani: 0,
          kmv: 0,
          kdvOrani: 0,
          kdv: 0
        }
      ]
    };

    console.log("Calling saveViaProcedure with test payload...");
    const res = await DovizFisSqlRepository.saveViaProcedure(payload);
    console.log("Save SUCCESS:", res);
  } catch (err: any) {
    console.error("Save FAILED with error:", err);
    if (err.originalError) {
      console.error("Original error:", err.originalError);
    }
  } finally {
    process.exit(0);
  }
}

main();
