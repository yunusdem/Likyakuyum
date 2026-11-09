import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CariService } from "../../services/cariService";
import { EBankaService, type MutabakatFisTuru } from "../../services/ebankaService";
import type { SelectedCustomerResult } from "../vezne/MusteriSecimModal";

/** Mutabakat ekranından "Fiş kes" ile açılan fiş ekranlarına gelen bilgiler (adres satırı parametreleri). */
export interface EBankaFisKesimBilgisi {
  vomsisId: number;
  musteri: SelectedCustomerResult | null;
  tarih: string;
  tip: 0 | 1;
  tutar: number;
  paraKodu: string;
  /** Hareketin Banka Hesap Kartı: fişin ödeme satırına yazılır (M16) */
  bankaId: number | null;
  /** Fişe yazılacak TL tutar (döviz hesapta o günün kuruyla karşılığı) */
  tutarTl: number;
  donusBaslangic: string;
  donusBitis: string;
}

/** Mutabakat ekranının fiş ekranını açacağı adres. */
export function fisKesimAdresi(yol: string, p: {
  vomsisId: number; cariId: number | null; tarih: string; tip: 0 | 1; tutar: number; paraKodu: string; baslangic: string; bitis: string;
  bankaId?: number | null; tutarTl?: number | null; karsiAd?: string | null; karsiNo?: string | null;
}): string {
  const q = new URLSearchParams({
    ebh: String(p.vomsisId), tarih: p.tarih, tip: String(p.tip), tutar: String(p.tutar), pk: p.paraKodu, db: p.baslangic, de: p.bitis,
  });
  if (p.cariId) q.set("cari", String(p.cariId));
  if (p.bankaId) q.set("bk", String(p.bankaId));
  if (p.tutarTl) q.set("ttl", String(p.tutarTl));
  // Cari bulunamadıysa fiş, bankanın verdiği ad ve VKN/TC ile kayıtsız müşteri olarak dolar
  if (!p.cariId && p.karsiAd) q.set("kt", p.karsiAd.slice(0, 120));
  if (!p.cariId && p.karsiNo) q.set("kn", p.karsiNo);
  return `${yol}?${q.toString()}`;
}

/** Eşlenen fişin düzeltme ekranı (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M6); üç ekran da fişi ?id= ile açar. */
const DUZELTME_YOLU: Record<MutabakatFisTuru, string> = {
  doviz: "/vezne/doviz-fisi-duzeltme",
  sarraf: "/vezne/sarraf-fisi-duzeltme",
  perakende: "/vezne/perakende-fisi-duzeltme",
};

/** "Düzenle": fiş düzeltme ekranı `ebd` ile açılır; kaydedince e-Banka'ya aynı harekete dönülür. */
export function fisDuzenlemeAdresi(fisTuru: MutabakatFisTuru, fisId: number, p: {
  vomsisId: number; tip: 0 | 1; tutar: number; paraKodu: string; tutarTl?: number | null; baslangic: string; bitis: string;
}): string {
  const q = new URLSearchParams({
    id: String(fisId), ebd: String(p.vomsisId), tip: String(p.tip), tutar: String(p.tutar), pk: p.paraKodu, db: p.baslangic, de: p.bitis,
  });
  if (p.tutarTl) q.set("ttl", String(p.tutarTl));
  return `${DUZELTME_YOLU[fisTuru]}?${q.toString()}`;
}

/**
 * Banka hareketinden fiş kesme (`ebh`): ekran hazır olunca cari / tarih / yön doldurulur, fiş kaydedilince hareketle eşlenip
 * mutabakat ekranına dönülür. Eşli fişi düzenleme (`ebd`, M6): ekran doldurulmaz, kaydedince eşleme yapılmadan dönülür.
 * Parametre yoksa hiçbir şey yapmaz.
 */
export function useEBankaFisKesimi(fisTuru: MutabakatFisTuru, hazir: boolean, doldur: (b: EBankaFisKesimBilgisi) => void) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const kesimId = Number(searchParams.get("ebh")) || 0;
  const duzenlemeId = kesimId ? 0 : Number(searchParams.get("ebd")) || 0;
  const vomsisId = kesimId || duzenlemeId;
  const duzenleme = duzenlemeId > 0;
  const [bilgi, setBilgi] = useState<EBankaFisKesimBilgisi | null>(null);
  const uygulandi = useRef(false);
  const doldurRef = useRef(doldur);
  doldurRef.current = doldur;

  const parametreBilgisi = (musteri: SelectedCustomerResult | null): EBankaFisKesimBilgisi => ({
    vomsisId, musteri,
    tarih: searchParams.get("tarih") || new Date().toISOString().slice(0, 10),
    tip: searchParams.get("tip") === "0" ? 0 : 1,
    tutar: Number(searchParams.get("tutar")) || 0,
    paraKodu: searchParams.get("pk") || "TL",
    bankaId: Number(searchParams.get("bk")) || null,
    tutarTl: Number(searchParams.get("ttl")) || (["TL", "TRY"].includes((searchParams.get("pk") || "TL").toUpperCase()) ? Number(searchParams.get("tutar")) || 0 : 0),
    donusBaslangic: searchParams.get("db") || "",
    donusBitis: searchParams.get("de") || "",
  });

  // Düzenlemede ekran doldurulmaz; bant ve dönüş için bilgi hemen hazır
  useEffect(() => {
    if (duzenleme) setBilgi(parametreBilgisi(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duzenleme, searchParams]);

  useEffect(() => {
    if (!kesimId || !hazir || uygulandi.current) return;
    uygulandi.current = true;
    const cariId = Number(searchParams.get("cari")) || 0;
    let iptal = false;
    (async () => {
      let musteri: SelectedCustomerResult | null = null;
      if (cariId) {
        try {
          const c: any = await CariService.getCariKartById(cariId);
          if (c) {
            musteri = {
              type: "registered", id: cariId, kod: c.kod, unvan: c.ad || c.unvan || "",
              vergiKimlikNo: c.vergiKimlikNo || "", adres: c.adres || "", telefon: c.telefon || "", raw: c,
            };
          }
        } catch { /* cari bulunamazsa kullanıcı kendisi seçer */ }
      }
      if (!musteri && (searchParams.get("kt") || searchParams.get("kn"))) {
        musteri = {
          type: "anonymous", id: null,
          unvan: (searchParams.get("kt") || "").toLocaleUpperCase("tr-TR"),
          vergiKimlikNo: (searchParams.get("kn") || "").replace(/\D/g, "").slice(0, 11),
        };
      }
      const b = parametreBilgisi(musteri);
      // Ekranın kendi ilk temizliği bitsin diye bir tur bekle
      await new Promise((r) => setTimeout(r, 400));
      if (iptal) return;
      setBilgi(b);
      doldurRef.current(b);
    })();
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kesimId, hazir, searchParams]);

  const donusAdresi = () => {
    const q = new URLSearchParams({ ac: String(vomsisId) });
    const db = bilgi?.donusBaslangic || searchParams.get("db");
    const de = bilgi?.donusBitis || searchParams.get("de");
    if (db) q.set("baslangic", db);
    if (de) q.set("bitis", de);
    return `/ebanka/mutabakat?${q.toString()}`;
  };

  /** Fiş kaydedildikten sonra çağrılır; e-Banka'dan gelinmediyse false döner, ekran kendi akışına devam eder. */
  const kaydedildi = async (fisId: number | null | undefined, donme = true): Promise<boolean> => {
    if (!vomsisId || !fisId) return false;
    // Düzenlemede fiş zaten bu harekete eşli; yalnız geri dönülür
    if (!duzenleme) {
      try {
        await EBankaService.mutabakatEsle(vomsisId, fisTuru, Number(fisId));
      } catch (e: any) {
        alert(`Fiş kaydedildi ama banka hareketiyle eşlenemedi: ${e?.response?.data?.message || e?.message || e}. Mutabakat ekranından elle eşleyebilirsiniz.`);
      }
    }
    if (!donme) return false;
    navigate(donusAdresi());
    return true;
  };

  const tutarYazi = bilgi ? `${bilgi.tip === 1 ? "gelen" : "giden"} ${bilgi.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${bilgi.paraKodu}` : "";
  const bant = vomsisId ? (
    <div className="alert alert-info py-2 px-3 mb-2 small d-flex align-items-center gap-2">
      {duzenleme ? (
        <span>
          e-Banka hareketinin fişi düzenleniyor{bilgi ? <> — {tutarYazi}</> : null}. Kaydedince e-Banka Muhasebeleştirme'ye dönülür.
        </span>
      ) : (
        <span>
          Banka hareketinden fiş kesiliyor
          {bilgi ? <> — {tutarYazi}, {bilgi.tarih.split("-").reverse().join(".")}{bilgi.musteri ? ` — ${bilgi.musteri.unvan}` : ""}</> : null}
          . Kaydedince bu hareketle eşlenir.
          {bilgi && !bilgi.musteri && <strong> Bankadan karşı taraf adı / VKN gelmedi; müşteriyi fiş ekranında seçin.</strong>}
        </span>
      )}
      <button type="button" className="btn btn-sm btn-link ms-auto p-0" onClick={() => navigate(duzenleme ? donusAdresi() : "/ebanka/mutabakat")}>
        {duzenleme ? "e-Banka'ya dön" : "Vazgeç"}
      </button>
    </div>
  ) : null;

  return { vomsisId, duzenleme, bilgi, kaydedildi, bant };
}
