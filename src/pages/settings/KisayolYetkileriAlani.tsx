import React, { useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { KONTROL_GRUBU, gorunumKatalogu } from "../../config/kullaniciGorunum";
import { UST_KISAYOL_GRUBU } from "../../config/modulKatalogu";

/**
 * Kullanıcı kartı › Menü yetkileri altında üst kısayol çubuğu (hızlı menü) ve üst çubuk kontrol düğmeleri
 * (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, G3/G10). Menü harfleriyle aynı görünüm; değer kapalı kod listesidir
 * (TODVZ_KULLANICI_GORUNUM). Yalnız firmanın lisansındaki kısayollar listelenir.
 */

interface Bolum {
  kod: string;
  baslik: string;
  maddeler: { kod: string; ad: string }[];
}

export const KISAYOL_ONEKLERI = [`${UST_KISAYOL_GRUBU}:`, `${KONTROL_GRUBU}:`];
/** Kapalı listeden bu alanın yönettiği kodlar */
export const kisayolKodlari = (kapali: string[]): string[] => kapali.filter((k) => KISAYOL_ONEKLERI.some((o) => k.startsWith(o)));
/** Bu alanın yönetmediği kodlar (varsa başka kaynaktan yazılmış menü kodları korunur) */
export const digerKodlar = (kapali: string[]): string[] => kapali.filter((k) => !KISAYOL_ONEKLERI.some((o) => k.startsWith(o)));

export const KisayolYetkileriAlani: React.FC<{
  /** Kapalı kodlar (ust:* ve kontrol:*) */
  kapali: string[];
  degistir: (kapali: string[]) => void;
  kilitli?: boolean;
}> = ({ kapali, degistir, kilitli }) => {
  const { user } = useAuth();
  const bolumler = useMemo<Bolum[]>(() => {
    const katalog = gorunumKatalogu(user?.merkez?.moduller);
    const madde = (ust: string) => katalog.filter((m) => m.ustKodu === ust).map((m) => ({ kod: m.modulKodu, ad: m.baslik }));
    return [
      { kod: UST_KISAYOL_GRUBU, baslik: "Hızlı menü (üst kısayol çubuğu)", maddeler: madde(UST_KISAYOL_GRUBU) },
      { kod: KONTROL_GRUBU, baslik: "Üst çubuk düğmeleri", maddeler: madde(KONTROL_GRUBU) },
    ].filter((b) => b.maddeler.length > 0);
  }, [user?.merkez?.moduller]);
  const [acik, setAcik] = useState<string | null>(null);
  const kapaliKume = useMemo(() => new Set(kapali), [kapali]);

  const yaz = (b: Bolum, secili: (kod: string) => boolean) => {
    const digerleri = kapali.filter((k) => !b.maddeler.some((m) => m.kod === k) && k !== b.kod);
    const kapananlar = b.maddeler.filter((m) => !secili(m.kod)).map((m) => m.kod);
    // Hepsi kapalıysa grup kodu da kapalı (ağaç kuralı); yoksa grup açık
    degistir([...digerleri, ...kapananlar, ...(kapananlar.length === b.maddeler.length ? [b.kod] : [])]);
  };

  return (
    <div className="d-flex flex-column gap-1 mt-1">
      {bolumler.map((b) => {
        const secili = (kod: string) => !kapaliKume.has(kod) && !kapaliKume.has(b.kod);
        const seciliSayi = b.maddeler.filter((m) => secili(m.kod)).length;
        const tumu = seciliSayi === b.maddeler.length;
        return (
          <div key={b.kod} className="border rounded bg-white">
            <div className="d-flex align-items-center gap-2 px-2 py-1">
              <Button variant="link" size="sm" className="p-0 text-dark" onClick={() => setAcik((x) => (x === b.kod ? null : b.kod))}
                aria-label={`${b.baslik} maddeleri`}>
                {acik === b.kod ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </Button>
              <span className="small fw-semibold flex-grow-1 text-truncate" title={b.baslik}>{b.baslik}</span>
              <Badge bg={tumu ? "success" : seciliSayi ? "warning" : "secondary"} text={seciliSayi && !tumu ? "dark" : undefined} className="fw-semibold">
                {tumu ? "Tümü" : seciliSayi ? `${seciliSayi}/${b.maddeler.length}` : "Yok"}
              </Badge>
              <Form.Check type="checkbox" id={`kisayol-tumu-${b.kod}`} title="Tümü" checked={tumu} disabled={kilitli}
                onChange={(e) => yaz(b, () => e.target.checked)} />
            </div>
            {acik === b.kod && (
              <div className="border-top px-2 py-1" style={{ maxHeight: 220, overflowY: "auto" }}>
                {b.maddeler.map((m) => (
                  <Form.Check key={m.kod} type="checkbox" id={`kisayol-${m.kod}`} className="small" disabled={kilitli}
                    label={m.ad} checked={secili(m.kod)}
                    onChange={(e) => yaz(b, (kod) => (kod === m.kod ? e.target.checked : secili(kod)))} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KisayolYetkileriAlani;
