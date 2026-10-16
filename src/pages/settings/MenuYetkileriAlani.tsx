import React, { useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { DashboardMenu } from "routes/DashboardRoute";
import {
  ANA_MENULER,
  BAGLI_MADDELER,
  MENU_HARFLERI,
  MenuYetkiAlani,
  harfListesi,
  harfListesiYaz,
  maddeHarfi,
} from "../../../Backend/src/services/yetki/kullaniciYetkiKural";

/**
 * Kullanıcı kartı menü yetkileri (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.1). Eski programla aynı biçim: her kolon bir harf
 * listesidir (ör. 'ABCDEF' → menünün A…F maddeleri). Kutular menünün özgün harfleriyle (DashboardRoute) çizilir;
 * menüde olmayan harfler (eski programın bizde bulunmayan maddeleri) kayıtta korunur.
 */

interface Madde {
  harf: string;
  ad: string;
  /** Kolona sığmayan madde: bağlı olduğu maddenin harfi */
  bagli?: string;
}

interface Bolum {
  alan: MenuYetkiAlani;
  baslik: string;
  maddeler: Madde[];
}

const harfsiz = (ad?: string) => String(ad || "").replace(/^\s*[A-Z]\s*-\s*/, "");

const bolumler = (): Bolum[] => {
  const anaMaddeler: Madde[] = [];
  const liste: Bolum[] = [];
  for (const ana of DashboardMenu) {
    if (!ana.key || !ANA_MENULER[ana.key]) continue;
    const a = ANA_MENULER[ana.key];
    anaMaddeler.push({ harf: a.harf, ad: harfsiz(ana.title) });
    if (!a.alan) continue;
    const maddeler: Madde[] = [];
    for (const oge of ana.children || []) {
      const h = maddeHarfi(oge.name || oge.title);
      if (!h) continue;
      const bagli = BAGLI_MADDELER[ana.key]?.[h];
      maddeler.push({ harf: h, ad: harfsiz(oge.name || oge.title), ...(bagli || !MENU_HARFLERI.includes(h) ? { bagli: bagli || "" } : {}) });
    }
    liste.push({ alan: a.alan, baslik: harfsiz(ana.title), maddeler });
  }
  return [{ alan: "mainMenu", baslik: "Ana menü", maddeler: anaMaddeler }, ...liste];
};

/** Yeni programda menüsü olmayan kolonlar: değeri saklanır, ekranda değiştirilmez */
const KARSILIKSIZ: { alan: MenuYetkiAlani; baslik: string }[] = [
  { alan: "accounting", baslik: "Muhasebe" },
  { alan: "consolidatedReports", baslik: "Konsolide raporlar" },
];

export const MenuYetkileriAlani: React.FC<{
  deger: Partial<Record<MenuYetkiAlani, string>>;
  degistir: (alan: MenuYetkiAlani, yeni: string) => void;
  kilitli?: boolean;
}> = ({ deger, degistir, kilitli }) => {
  const liste = useMemo(bolumler, []);
  const [acik, setAcik] = useState<MenuYetkiAlani | null>(null);

  return (
    <div className="d-flex flex-column gap-1">
      {liste.map((b) => {
        const menuHarfleri = b.maddeler.filter((m) => m.bagli === undefined).map((m) => m.harf);
        const l = harfListesi(deger[b.alan]);
        const secili = (h: string) => l === null || l.has(h);
        const seciliSayi = menuHarfleri.filter(secili).length;
        const yaz = (secim: string[]) => degistir(b.alan, harfListesiYaz(deger[b.alan], menuHarfleri, secim));
        const tumu = seciliSayi === menuHarfleri.length;
        return (
          <div key={b.alan} className="border rounded bg-white">
            <div className="d-flex align-items-center gap-2 px-2 py-1">
              <Button variant="link" size="sm" className="p-0 text-dark" onClick={() => setAcik((x) => (x === b.alan ? null : b.alan))}
                aria-label={`${b.baslik} maddeleri`}>
                {acik === b.alan ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </Button>
              <span className="small fw-semibold flex-grow-1 text-truncate" title={b.baslik}>{b.baslik}</span>
              <Badge bg={tumu ? "success" : seciliSayi ? "warning" : "secondary"} text={seciliSayi && !tumu ? "dark" : undefined} className="fw-semibold">
                {tumu ? "Tümü" : seciliSayi ? `${seciliSayi}/${menuHarfleri.length}` : "Yok"}
              </Badge>
              <Form.Check type="checkbox" id={`menu-tumu-${b.alan}`} title="Tümü" checked={tumu} disabled={kilitli}
                onChange={(e) => yaz(e.target.checked ? menuHarfleri : [])} />
            </div>
            {acik === b.alan && (
              <div className="border-top px-2 py-1" style={{ maxHeight: 220, overflowY: "auto" }}>
                {b.maddeler.map((m) =>
                  m.bagli !== undefined ? (
                    <div key={m.harf} className="small text-muted ps-4 py-0.5">
                      {m.harf}- {m.ad} {m.bagli ? <em>({m.bagli} maddesine bağlı)</em> : null}
                    </div>
                  ) : (
                    <Form.Check key={m.harf} type="checkbox" id={`menu-${b.alan}-${m.harf}`} className="small" disabled={kilitli}
                      label={`${m.harf}- ${m.ad}`} checked={secili(m.harf)}
                      onChange={(e) => yaz(menuHarfleri.filter((h) => (h === m.harf ? e.target.checked : secili(h))))} />
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
      {KARSILIKSIZ.map((k) => (
        <div key={k.alan} className="d-flex align-items-center gap-2 px-2 py-1 border rounded bg-light small text-muted"
          title="Yeni programda bu menü yok; eski programdaki değer korunur">
          <span className="flex-grow-1">{k.baslik}</span>
          <span className="font-monospace">{deger[k.alan] || "—"}</span>
        </div>
      ))}
    </div>
  );
};

export default MenuYetkileriAlani;
