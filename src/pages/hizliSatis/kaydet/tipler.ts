import type { StatisticItem } from "../../../services/statisticService";
import type { PosTahsilIstegi, PosTahsilSonucu } from "../../../components/pos/PosTahsilat";
import type { HizliSatisModul } from "../../../../Backend/src/services/hizliSatis/hizliSatisKural";
import type { IndirimGirdisi, SepetOdemesi, SepetSatiri, SepetToplami } from "../../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import type { ModulVerisi } from "../modulVerisi";

/** Hızlı satışta müşteri / alıcı (H13). anonim: nihai tüketici, kayitli: cari kart, kayitsiz: elle yazılan ya da sorgudan gelen */
export interface HizliMusteri {
  tur: "anonim" | "kayitli" | "kayitsiz";
  cariKartId?: number | null;
  cariKod?: string | null;
  unvan: string;
  vknTckn: string;
  adres: string;
  il: string;
  ilce: string;
  vergiDairesi: string;
  telefon: string;
  eposta: string;
  /** e-Fatura mükellefi: Perakende/Ticari'de senaryo TICARIFATURA */
  mukellef?: boolean;
  /** Sarraf/Döviz MASAK kişilik tipi: 0 anonim, 1 şahıs, 2 firma */
  kisilikTipi?: number;
}

export const ANONIM_MUSTERI: HizliMusteri = { tur: "anonim", unvan: "", vknTckn: "", adres: "", il: "", ilce: "", vergiDairesi: "", telefon: "", eposta: "" };

export interface PosKancasi {
  tahsilEt: (istek: PosTahsilIstegi) => Promise<PosTahsilSonucu>;
  kaydedildi: (belgeTuru: any, belgeId: number, belgeNo: string | null) => Promise<void> | void;
}

export interface KaydetBaglami {
  modul: HizliSatisModul;
  tip: 0 | 1;
  sepet: SepetSatiri[];
  toplam: SepetToplami;
  indirim: IndirimGirdisi | null;
  /** Para üstü düşülmüş, kayda giden ödemeler (boş = tamamı nakit) */
  odemeler: SepetOdemesi[];
  musteri: HizliMusteri;
  veri: ModulVerisi;
  istatistik: StatisticItem | null;
  /** Sarraf: e-Belge GİB kodu (805, 808, 230 …); boşsa faturada altın 805, gümüş 808 */
  istisnaKodu?: string | null;
  /** nesne: AuthContext kullanıcısı (yazıcı seçimi için) */
  kullanici: { id: number; ad: string; nesne: any };
  pos: PosKancasi;
}

export interface KaydetSonucu {
  fisId: number;
  fisNo: string;
  /** Kayıt oldu ama kullanıcıya söylenecek durum (POS tamamlanmadı, baskı başarısız …) */
  uyarilar: string[];
}
