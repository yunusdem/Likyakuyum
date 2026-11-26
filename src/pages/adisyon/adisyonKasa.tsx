import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { usePosTahsilat } from "../../components/pos/PosTahsilat";
import { PosIslemService } from "../../services/posIslemService";
import { LookupModal } from "../../components/common/LookupModal";
import { useAuth } from "../../context/AuthContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { PosCihaziService } from "../../services/posCihaziService";
import { BankaService } from "../../services/bankaService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { ticariFisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { kullaniciVeznesi } from "../../utils/kullaniciVeznesi";
import { TicariService } from "../../services/ticariService";
import type { AdisyonAyrinti, HesapDurumu, OdemeGirdi, TahsilatSonucu } from "../../services/adisyonService";
import type { OdemeSecenekleri, TahsilatTuru } from "./AdisyonOdeme";
import { MusteriEkraniDurumu, musteriEkraniAc, musteriYayincisi } from "../../services/musteriEkrani";
import { BelgeService } from "../../services/belgeService";
import { CompanyService } from "../../services/companyService";
import { hesapFisi } from "./hesapFisi";

/**
 * Kasa PC'nin tahsilat yardımcıları (D7): kullanıcının veznesi, POS / banka / cari seçenekleri, fiş yazan tahsilattan sonra kartın
 * POS cihazından çekilmesi (Hızlı Satış Ticari ile aynı: fiş yazılmış, kart şimdi çekilir, sonuç fişe bağlanır), satış fişi ve
 * hesap fişi baskısı. Garson telefonunda kullanılmaz (orada POS / yazıcı yok).
 */
export interface AdisyonKasa {
  secenekler: OdemeSecenekleri;
  /** Fiş(ler) yazıldıysa: kart → POS cihazı (yalnız Tamamı / Ürün seç), sonra fiş baskısı. Uyarılar döner (hata fırlatmaz). */
  tahsilatSonrasi: (r: TahsilatSonucu, yeni: OdemeGirdi[], tur: TahsilatTuru, yeniFisler: { faturaId: number; faturaNo: string }[]) => Promise<string[]>;
  hesapFisiBas: (a: AdisyonAyrinti, h: HesapDurumu, masaAd: string) => Promise<string | null>;
  /**
   * Ara ödemede kart (TA37, karar 26.11.2026 "ara ödemede de sorulsun"): POS entegrasyonu açıksa sorulur; "POS cihazına gönder" denirse
   * kart şimdi cihazdan çekilir, onaylanan POS işlemi ara ödeme kaydına bağlanır (fiş sonra kesilince fişe bağlanır). tamam=false: vazgeçildi.
   */
  araKartCek: (tutar: number, posCihaziId: number | null) => Promise<{ tamam: boolean; posIslemId: number | null; posCihaziId: number | null }>;
  fisYazdir: boolean;
  setFisYazdir: (v: boolean) => void;
  /** Müşteri ekranı (TA9): durum yayını ve pencereyi açma */
  musteriEkrani: (d: MusteriEkraniDurumu) => void;
  musteriEkraniniAc: () => string | null;
  ogeler: React.ReactNode;
}

const FIS_YAZDIR_ANAHTARI = "likya_adisyon_fis_yazdir";
export { hesapFisi } from "./hesapFisi";

export function useAdisyonKasa(): AdisyonKasa {
  const { user } = useAuth();
  const pos = usePosTahsilat();
  const [vezne, setVezne] = useState<VezneItem | null>(null);
  const [secenekler, setSecenekler] = useState<OdemeSecenekleri>({ pos: [], banka: [] });
  const [cariler, setCariler] = useState<CariKartItem[] | null>(null);
  const [cariAcik, setCariAcik] = useState(false);
  const cariCoz = useRef<((c: { id: number; ad: string } | null) => void) | null>(null);
  const yazicilar = useRef<YaziciItem[] | null>(null);
  const [fisYazdir, setFisYazdirIc] = useState(() => localStorage.getItem(FIS_YAZDIR_ANAHTARI) !== "0");
  const setFisYazdir = (v: boolean) => { setFisYazdirIc(v); localStorage.setItem(FIS_YAZDIR_ANAHTARI, v ? "1" : "0"); };
  // TA37: POS entegrasyonu açıksa kart ödemesinde her seferinde sorulur: "POS cihazına gönder / Yalnız kaydet"
  const [posSoru, setPosSoru] = useState<{ tutar: number; fisNo: string | null } | null>(null);
  const posSoruCoz = useRef<((gonder: boolean) => void) | null>(null);
  const posSorusu = async (tutar: number, fisNo: string | null): Promise<boolean> => {
    try {
      const d = await PosIslemService.getDurum(vezne?.id ?? null);
      if (d.mod === "kapali" || !d.terminaller?.length) return false; // cihaz yok: kart yalnız kayıttır, sorulacak bir şey yok
    } catch {
      return false; // POS modülü kapalı / yanıt yok: fiş kaydı engellenmez (bileşen de aynı kuralla sormadan döner)
    }
    return new Promise<boolean>((coz) => { posSoruCoz.current = coz; setPosSoru({ tutar, fisNo }); });
  };
  const posSoruCevap = (gonder: boolean) => { setPosSoru(null); posSoruCoz.current?.(gonder); posSoruCoz.current = null; };
  const yayinci = useRef<ReturnType<typeof musteriYayincisi> | null>(null);
  useEffect(() => { yayinci.current = musteriYayincisi(); return () => { yayinci.current?.kapat(); yayinci.current = null; }; }, []);
  const musteriEkrani = useCallback((d: MusteriEkraniDurumu) => yayinci.current?.durum(d), []);
  const musteriEkraniniAc = () => {
    if (!musteriEkraniAc()) return "Müşteri ekranı açılamadı (tarayıcı açılır pencereyi engelledi; bu site için izin verin).";
    void Promise.all([CompanyService.getDefinitions().catch(() => null), BelgeService.gorseller().catch(() => [])]).then(([t, g]: [any, any[]]) => {
      yayinci.current?.kimlik({ firmaAdi: String(t?.FIRMA_ADI || "").trim(), logo: g.find((x) => x.tur === "LOGO")?.dataUrl || null, karsilama: "Hoş geldiniz" });
    });
    return null;
  };

  const cariSec = useCallback(() => new Promise<{ id: number; ad: string } | null>((coz) => {
    cariCoz.current = coz;
    setCariAcik(true);
    if (!cariler) CariService.getCariKartlar().then(setCariler).catch(() => setCariler([]));
  }), [cariler]);
  useEffect(() => {
    CashDeskService.getVezneler().then((l) => setVezne(kullaniciVeznesi(l || [], user as any))).catch(() => setVezne(null));
    Promise.all([
      PosCihaziService.getPosCihazlari().catch(() => []),
      BankaService.getBankalar({ aktif: true }).catch(() => []),
    ]).then(([p, b]: [any[], any[]]) => setSecenekler((s) => ({
      ...s,
      pos: p.filter((x) => x.aktif !== false).map((x) => ({ id: x.posCihaziId, ad: [x.kod, x.ad].filter(Boolean).join(" · ") })),
      banka: b.map((x) => ({ id: x.bankaId, ad: [x.hesapAdi, x.bankaAdi].filter(Boolean).join(" · ") })),
    })));
  }, [user]);

  const yazici = async () => {
    if (!yazicilar.current) yazicilar.current = await PrinterService.getYazicilar().catch(() => []);
    return resolveEffectivePrinter({ pageType: "perakende", tip: 1, vezne, user, printers: yazicilar.current || [] } as any);
  };

  const tahsilatSonrasi = async (r: TahsilatSonucu, yeni: OdemeGirdi[], tur: TahsilatTuru, yeniFisler: { faturaId: number; faturaNo: string }[]) => {
    const uyarilar: string[] = [];
    // Kart: yalnız fiş yazan tahsilatta (Tamamı / Ürün seç) ve fişin kendi ödemesiyse cihaza sorulur; ara ödemede kart kayıttır
    const kartlar = yeni.map((o, i) => ({ o, i })).filter((x) => x.o.arac === 2);
    const kartToplami = Math.round(kartlar.reduce((t, x) => t + (Number(x.o.tutar) || 0), 0) * 100) / 100;
    if ((tur === "kapat" || tur === "urun") && r.faturaId && kartlar.length && (await posSorusu(kartToplami, r.faturaNo ?? null))) {
      try {
        const f: any = await TicariService.satis(r.faturaId);
        // P8 (26.11.2026 denetimi): cihaz sepeti fişin bütün ödemelerini içermeli. Kapanış fişinde daha önce alınmış ara ödemeler de
        // vardır; yalnız yeni girilenler gönderilince cihazdaki toplam fiş kalemlerini tutmuyordu (Hugin reddeder, Inpos kalemleri basmaz).
        // Cihaza şimdi gönderilen kart satırları dışındaki her ödeme "ödenmiş" gider; ara ödemede yalnız kaydedilmiş kart (başka
        // cihazdan çekilmiş) nakit dışı ödeme olarak (havale / EFT türüyle) gider.
        const fisOdemeleri: any[] = Array.isArray(f?.odemeler) ? f.odemeler : [];
        const pesinOdemeler: { tur: "nakit" | "cari" | "havale"; tutar: number }[] = [];
        const ekle = (tur: "nakit" | "cari" | "havale", tutar: number) => {
          const t = Math.round(tutar * 100) / 100;
          if (t <= 0.004) return;
          const v = pesinOdemeler.find((x) => x.tur === tur);
          if (v) v.tutar = Math.round((v.tutar + t) * 100) / 100; else pesinOdemeler.push({ tur, tutar: t });
        };
        if (fisOdemeleri.length) {
          for (const o of fisOdemeleri) if (Number(o.odemeAraciTuru) !== 2) ekle(Number(o.odemeAraciTuru) === 1 ? "cari" : Number(o.odemeAraciTuru) === 3 ? "havale" : "nakit", Number(o.tutar) || 0);
          ekle("havale", fisOdemeleri.filter((o) => Number(o.odemeAraciTuru) === 2).reduce((t, o) => t + (Number(o.tutar) || 0), 0) - kartToplami);
        } else {
          for (const o of yeni) if (o.arac !== 2) ekle(o.arac === 1 ? "cari" : o.arac === 3 ? "havale" : "nakit", Number(o.tutar) || 0);
        }
        const sonuc = await pos.tahsilEt({
          belgeTuru: "perakende", belgeNo: r.faturaNo ?? null, belgeTipi: f?.senaryo === "EARSIVFATURA" ? "earsiv" : "efatura", belgeId: r.faturaId, kayitSonrasi: true,
          vezneId: vezne?.id ?? null, aliciAd: f?.aliciUnvan ?? null, aliciVkn: f?.aliciVknTckn && f.aliciVknTckn !== "11111111111" ? f.aliciVknTckn : null,
          pesinOdemeler,
          satirlar: kartlar.map((x) => ({ kimlik: `adisyon-${r.faturaId}-${x.i}`, tutar: x.o.tutar, posCihaziId: x.o.posCihaziId ?? null })),
          kalemler: (f?.satirlar || []).map((s: any) => ({ ad: s.urunAdi, miktar: s.miktar, tutar: s.toplamTutar, kdvOrani: s.kdvOrani })),
        });
        await pos.kaydedildi("perakende", r.faturaId, r.faturaNo ?? null);
        if (!sonuc.tamam) uyarilar.push(`Fiş ${r.faturaNo} kaydedildi ancak POS tahsilatı alınmadı. Ticari › Satış Fişi Düzeltme'den ödemeyi düzeltin.`);
        if (Object.keys(sonuc.kartlar).length) uyarilar.push(`Cihazdan dönen kart fişteki POS kartından farklı; Ticari › Satış Fişi Düzeltme'den fiş ${r.faturaNo} için POS kartını düzeltin.`);
      } catch (e: any) {
        uyarilar.push(`Fiş ${r.faturaNo} kaydedildi ancak POS tahsilatı başlatılamadı: ${e?.message || "bilinmeyen hata"}`);
      }
    }
    if (fisYazdir) {
      for (const y of yeniFisler) {
        try {
          const f: any = await TicariService.satis(y.faturaId);
          const rp = await yazici();
          const ps = rp.recommendedPrintType === "POS";
          const c = await ticariFisHtml({ ...f, vezneKod: vezne?.kod }, ps ? "80" : "A4");
          const s = await fisiYazdir({ ...c, baslik: `Satis_Fisi_${y.faturaNo}` }, { printerName: rp.printer?.cihazAdi || rp.printer?.ad || null, copies: 1, isPos: ps });
          if (!s.success) uyarilar.push(`Fiş ${y.faturaNo} kaydedildi ancak yazdırılamadı: ${s.message}`);
        } catch (e: any) {
          uyarilar.push(`Fiş ${y.faturaNo} kaydedildi ancak yazdırılamadı: ${e?.message || "bilinmeyen hata"}`);
        }
      }
    }
    return uyarilar;
  };

  const araKartCek = async (tutar: number, posCihaziId: number | null) => {
    if (!(await posSorusu(tutar, null))) return { tamam: true, posIslemId: null, posCihaziId };
    const kimlik = `adisyon-ara-${Date.now()}`;
    const s = await pos.tahsilEt({ belgeTuru: "perakende", belgeNo: null, belgeTipi: "earsiv", belgeId: null, vezneId: vezne?.id ?? null, aliciAd: null, aliciVkn: null,
      pesinOdemeler: [], satirlar: [{ kimlik, tutar, posCihaziId }] });
    const posIslemId = s.islemler?.[kimlik] ?? null;
    // Çekilen işlem bir belgeye bağlanmadı (fiş adisyon kapanınca yazılır): POS bileşeninin "fişsiz kalan çekim" listesinden çıkarılır,
    // yoksa sonraki fişte "iade edilmeli" sayılırdı. Bağlama sunucuda ödeme kaydı ve kapanış fişiyle yapılır.
    await pos.kaydedildi("perakende", null, null);
    if (!s.tamam) return { tamam: false, posIslemId: null, posCihaziId };
    return { tamam: true, posIslemId, posCihaziId: s.kartlar[kimlik]?.posCihaziId ?? posCihaziId };
  };

  const hesapFisiBas = async (a: AdisyonAyrinti, h: HesapDurumu, masaAd: string) => {
    try {
      const { metin, html } = hesapFisi(a, h, masaAd);
      const rp = await yazici();
      const s = await triggerSilentPrint({ html, text: metin, printerName: rp.printer?.cihazAdi || rp.printer?.ad || null, copies: 1, isPos: true, title: `Hesap_${masaAd}` });
      return s.success ? null : `Hesap fişi yazdırılamadı: ${s.message}`;
    } catch (e: any) {
      return `Hesap fişi yazdırılamadı: ${e?.message || "bilinmeyen hata"}`;
    }
  };

  const ogeler = (
    <>
      {pos.pencere}
      <Modal show={!!posSoru} onHide={() => posSoruCevap(false)} centered backdrop="static">
        <Modal.Header><Modal.Title style={{ fontSize: 18 }}>Kart ödemesi</Modal.Title></Modal.Header>
        <Modal.Body>
          {posSoru && <p className="mb-1">{posSoru.fisNo ? `Fiş ${posSoru.fisNo} kaydedildi. ` : ""}Kartla <strong>{posSoru.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</strong> POS cihazından çekilsin mi?</p>}
          <div className="small text-muted">"Yalnız kaydet": tutar başka bir cihazdan çekildiyse; fişte kart ödemesi olarak kalır.</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => posSoruCevap(false)}>Yalnız kaydet</Button>
          <Button variant="primary" autoFocus onClick={() => posSoruCevap(true)}>POS cihazına gönder</Button>
        </Modal.Footer>
      </Modal>
      <LookupModal<CariKartItem> show={cariAcik} onHide={() => { setCariAcik(false); cariCoz.current?.(null); cariCoz.current = null; }} title="Cari seç (veresiye)" items={cariler || []} isLoading={!cariler}
        columns={[{ header: "Kod", width: "120px", render: (x) => x.kod, highlight: true }, { header: "Ad", render: (x) => x.ad }]}
        filterFn={(x, t) => `${x.kod} ${x.ad}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setCariAcik(false); cariCoz.current?.({ id: x.id, ad: `${x.kod} · ${x.ad}` }); cariCoz.current = null; }} />
    </>
  );

  return { secenekler: { ...secenekler, cariSec }, tahsilatSonrasi, hesapFisiBas, araKartCek, fisYazdir, setFisYazdir, musteriEkrani, musteriEkraniniAc, ogeler };
}
