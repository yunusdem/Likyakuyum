import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { ApiError } from "../../utils/ApiError.js";
import { PosSurucu } from "./pos.types.js";

/**
 * Inpos M530 sürücüsü — HENÜZ YAZILMADI (docs/POS_ENTEGRASYON_YOL_HARITASI.md, Faz 5).
 * Cihaz GMP3 ile yerel ağdan, Inpos'un verdiği DLL üzerinden konuşur; sunucu cihaza doğrudan ulaşamaz.
 * Mağazaya kurulacak köprü servisi ve bu sürücü, Inpos'tan SDK ile uygulama numarası gelince yazılacak.
 * O zamana kadar Inpos cihazları yalnızca Test modunda (sahte cihazla) denenebilir.
 */

const hazirDegil = (): ApiError =>
  new ApiError(HttpStatus.NOT_IMPLEMENTED, "Inpos entegrasyonu henüz hazır değil: Inpos'tan SDK bekleniyor. Bu cihaz şimdilik yalnızca Test modunda denenebilir.");

export const InposSurucu: PosSurucu = {
  async gonder() {
    throw hazirDegil();
  },
  async sorgula() {
    return null;
  },
  async iptal() {
    // Cihaza hiçbir şey gönderilmediği için geri alınacak bir şey yok
  },
  async baglantiTesti() {
    throw hazirDegil();
  },
  async gunSonu() {
    throw hazirDegil();
  },
};
