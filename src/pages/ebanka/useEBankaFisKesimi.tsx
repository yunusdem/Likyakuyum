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
  donusBaslangic: string;
  donusBitis: string;
}

/** Mutabakat ekranının fiş ekranını açacağı adres. */
export function fisKesimAdresi(yol: string, p: {
  vomsisId: number; cariId: number | null; tarih: string; tip: 0 | 1; tutar: number; paraKodu: string; baslangic: string; bitis: string;
}): string {
  const q = new URLSearchParams({
    ebh: String(p.vomsisId), tarih: p.tarih, tip: String(p.tip), tutar: String(p.tutar), pk: p.paraKodu, db: p.baslangic, de: p.bitis,
  });
  if (p.cariId) q.set("cari", String(p.cariId));
  return `${yol}?${q.toString()}`;
}

/**
 * Banka hareketinden fiş kesme: ekran hazır olunca cari / tarih / yön doldurulur,
 * fiş kaydedilince hareketle eşlenip mutabakat ekranına dönülür. Parametre yoksa hiçbir şey yapmaz.
 */
export function useEBankaFisKesimi(fisTuru: MutabakatFisTuru, hazir: boolean, doldur: (b: EBankaFisKesimBilgisi) => void) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vomsisId = Number(searchParams.get("ebh")) || 0;
  const [bilgi, setBilgi] = useState<EBankaFisKesimBilgisi | null>(null);
  const uygulandi = useRef(false);
  const doldurRef = useRef(doldur);
  doldurRef.current = doldur;

  useEffect(() => {
    if (!vomsisId || !hazir || uygulandi.current) return;
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
      const b: EBankaFisKesimBilgisi = {
        vomsisId, musteri,
        tarih: searchParams.get("tarih") || new Date().toISOString().slice(0, 10),
        tip: searchParams.get("tip") === "0" ? 0 : 1,
        tutar: Number(searchParams.get("tutar")) || 0,
        paraKodu: searchParams.get("pk") || "TL",
        donusBaslangic: searchParams.get("db") || "",
        donusBitis: searchParams.get("de") || "",
      };
      // Ekranın kendi ilk temizliği bitsin diye bir tur bekle
      await new Promise((r) => setTimeout(r, 400));
      if (iptal) return;
      setBilgi(b);
      doldurRef.current(b);
    })();
    return () => { iptal = true; };
  }, [vomsisId, hazir, searchParams]);

  /** Fiş kaydedildikten sonra çağrılır; e-Banka'dan gelinmediyse false döner, ekran kendi akışına devam eder. */
  const kaydedildi = async (fisId: number | null | undefined, donme = true): Promise<boolean> => {
    if (!vomsisId || !fisId) return false;
    try {
      await EBankaService.mutabakatEsle(vomsisId, fisTuru, Number(fisId));
    } catch (e: any) {
      alert(`Fiş kaydedildi ama banka hareketiyle eşlenemedi: ${e?.response?.data?.message || e?.message || e}. Mutabakat ekranından elle eşleyebilirsiniz.`);
    }
    if (!donme) return false;
    const q = new URLSearchParams({ ac: String(vomsisId) });
    if (bilgi?.donusBaslangic) q.set("baslangic", bilgi.donusBaslangic);
    if (bilgi?.donusBitis) q.set("bitis", bilgi.donusBitis);
    navigate(`/ebanka/mutabakat?${q.toString()}`);
    return true;
  };

  const bant = vomsisId ? (
    <div className="alert alert-info py-2 px-3 mb-2 small d-flex align-items-center gap-2">
      <span>
        Banka hareketinden fiş kesiliyor
        {bilgi ? <> — {bilgi.tip === 1 ? "gelen" : "giden"} {bilgi.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {bilgi.paraKodu}, {bilgi.tarih.split("-").reverse().join(".")}{bilgi.musteri ? ` — ${bilgi.musteri.unvan}` : ""}</> : null}
        . Kaydedince bu hareketle eşlenir.
      </span>
      <button type="button" className="btn btn-sm btn-link ms-auto p-0" onClick={() => navigate("/ebanka/mutabakat")}>Vazgeç</button>
    </div>
  ) : null;

  return { vomsisId, kaydedildi, bant };
}
