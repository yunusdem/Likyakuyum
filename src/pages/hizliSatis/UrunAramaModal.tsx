import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "react-bootstrap";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";
import { EtiketService } from "../../services/etiketService";
import { StatisticItem } from "../../services/statisticService";
import { StokKartSecici } from "../ticari/StokKartSecici";
import { TicariService } from "../../services/ticariService";
import { HizliSatisModul, paraUygunMu } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import { urunKuru } from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { ModulVerisi, SatirTaslagi, barkoddanSatir, karttanSatir, paradanSatir } from "./modulVerisi";

/**
 * Hızlı Satış "Ara" penceresi (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 6, G18).
 * Ticari: stok kartı (sunucu araması). Perakende: ürün tanımları + barkodlu altın / özel ürünler (yazdıkça sunucuda).
 * Sarraf / Döviz: ürün tanımları. Seçim, barkod okutmayla aynı yoldan sepete gider (gram / fiyat sorusu dahil).
 */
interface Props {
  acik: boolean;
  modul: HizliSatisModul;
  veri: ModulVerisi | null;
  tip: 0 | 1;
  istatistik: StatisticItem | null;
  aramaMetni?: string;
  kapat: () => void;
  sec: (taslak: SatirTaslagi | string) => void;
}

interface Aday {
  anahtar: string;
  tur: "para" | "altin" | "ozel";
  kod: string;
  ad: string;
  fiyat: number | null;
  birim: string;
  /** barkodlu ürünlerde barkod (sepete bu okutularak girer) */
  barkod?: string;
}

const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TUR_ADI: Record<Aday["tur"], string> = { para: "Ürün tanımı", altin: "Altın ürün", ozel: "Özel ürün" };

const kolonlar: LookupColumn<Aday>[] = [
  { header: "Tür", width: "100px", render: (a) => <Badge bg={a.tur === "para" ? "secondary" : a.tur === "altin" ? "warning" : "info"} text={a.tur === "altin" ? "dark" : undefined}>{TUR_ADI[a.tur]}</Badge> },
  { header: "Kod / Barkod", width: "150px", render: (a) => <span className="font-monospace fw-bold">{a.barkod || a.kod}</span>, highlight: true },
  { header: "Ürün", render: (a) => <span className="fw-semibold">{a.ad}</span>, highlight: true },
  { header: "Fiyat / Kur", width: "130px", align: "right", render: (a) => (a.fiyat && a.fiyat > 0 ? `${para(a.fiyat)} TL${a.birim === "Gram" ? "/gr" : ""}` : "") },
];

export const UrunAramaModal: React.FC<Props> = ({ acik, modul, veri, tip, istatistik, aramaMetni, kapat, sec }) => {
  const [sunucuAdaylari, setSunucuAdaylari] = useState<Aday[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const istek = useRef(0);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ürün tanımları (modüle uygun olanlar) güncel kurla
  const paraAdaylari = useMemo<Aday[]>(() => {
    if (!veri) return [];
    return veri.paralar.filter((p) => paraUygunMu(modul, p)).map((p) => {
      const t = paradanSatir(p, p.ad, veri, tip, istatistik).satir;
      return { anahtar: `para-${p.paraId}`, tur: "para", kod: String(p.kod || "").trim(), ad: p.ad, fiyat: t.birimFiyat || null, birim: t.birim };
    });
  }, [veri, modul, tip, istatistik]);

  // Perakende: barkodlu altın / özel ürünler sunucuda aranır (2+ karakter, 300 ms)
  const sunucudaAra = useCallback((metin: string) => {
    if (modul !== "perakende") return;
    if (zaman.current) clearTimeout(zaman.current);
    const t = metin.trim();
    const no = ++istek.current;
    if (t.length < 2) { setSunucuAdaylari([]); setYukleniyor(false); return; }
    setYukleniyor(true);
    zaman.current = setTimeout(async () => {
      try {
        const [altin, ozel] = await Promise.all([
          EtiketService.getAltinUrunler({ search: t, limit: 50 }).catch(() => []),
          EtiketService.getOzelUrunler({ search: t, limit: 50 }).catch(() => []),
        ]);
        if (no !== istek.current) return;
        const a: Aday[] = altin.filter((u) => !u.satildi).map((u) => ({
          anahtar: `altin-${u.altinUrunId}`, tur: "altin", kod: `${u.grupKodu || ""}${u.urunNo || ""}`, barkod: u.barkod || `${u.grupKodu || ""}${u.urunNo || ""}`,
          ad: [u.model, u.ureticiFirma, u.ayar ? `${u.ayar} ayar` : "", u.hasGram ? `${u.hasGram} has` : ""].filter(Boolean).join(" · ") || "Altın ürün",
          fiyat: Number(u.satisFiyati) || null, birim: "Adet",
        }));
        const o: Aday[] = (ozel as any[]).filter((u) => !u.satildi).map((u) => ({
          anahtar: `ozel-${u.ozelUrunId}`, tur: "ozel", kod: `${u.grupKodu || ""}${u.urunNo || ""}`, barkod: u.barkod || `${u.grupKodu || ""}${u.urunNo || ""}`,
          ad: [u.mamulTipi, u.modelOzellik1, u.ureticiFirma].filter(Boolean).join(" · ") || "Özel ürün",
          fiyat: Number(u.satisFiyati) || null, birim: "Adet",
        }));
        setSunucuAdaylari([...a, ...o]);
      } finally {
        if (no === istek.current) setYukleniyor(false);
      }
    }, 300);
  }, [modul]);
  useEffect(() => { if (!acik) { istek.current++; setSunucuAdaylari([]); setYukleniyor(false); } }, [acik]);

  const adaylar = useMemo(() => [...paraAdaylari, ...sunucuAdaylari], [paraAdaylari, sunucuAdaylari]);
  // Ürün tanımları yerelde süzülür; sunucudan gelenler zaten süzülmüştür
  const suz = useCallback((a: Aday, t: string) => {
    if (a.tur !== "para") return true;
    const q = t.toLocaleLowerCase("tr-TR");
    return a.kod.toLocaleLowerCase("tr-TR").includes(q) || a.ad.toLocaleLowerCase("tr-TR").includes(q);
  }, []);

  const secildi = async (a: Aday) => {
    if (!veri) return;
    if (a.tur === "para") {
      const p = veri.paralar.find((x) => `para-${x.paraId}` === a.anahtar);
      if (p) sec(paradanSatir(p, p.ad, veri, tip, istatistik));
    } else {
      sec(await barkoddanSatir(a.barkod || a.kod, veri, tip, istatistik));
    }
    kapat();
  };

  if (modul === "ticari") {
    return (
      <StokKartSecici show={acik} aramaMetni={aramaMetni} yalnizAktif pasifSecilemez onHide={kapat}
        onSelect={async (k) => { if (veri) { const kk = veri.fiyatListesiId ? await TicariService.kart(k.stokKartId, veri.fiyatListesiId).catch(() => k) : k; sec(karttanSatir(kk, veri, tip, istatistik)); } kapat(); }} />
    );
  }
  return (
    <LookupModal<Aday>
      show={acik}
      onHide={kapat}
      title={modul === "perakende" ? "Ürün Ara (ürün tanımı · barkodlu altın / özel ürün)" : "Ürün Ara"}
      items={adaylar}
      isLoading={yukleniyor}
      initialSearchTerm={aramaMetni || ""}
      searchPlaceholder={modul === "perakende" ? "Kod, ad, barkod ya da model..." : "Kod ya da ad..."}
      columns={kolonlar}
      filterFn={suz}
      onSearchTermChange={modul === "perakende" ? sunucudaAra : undefined}
      onSelect={(a) => void secildi(a)}
      selectOnDoubleClick
    />
  );
};

export default UrunAramaModal;
