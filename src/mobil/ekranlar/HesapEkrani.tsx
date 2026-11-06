import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, ButtonGroup, Form, Spinner } from "react-bootstrap";
import { IconFileTypePdf } from "@tabler/icons-react";
import { MobilYetkiler, dosyaIstek, istek, tl } from "../api";

/**
 * Hesabım (docs/MOBIL_CARI_YOL_HARITASI.md K10, K15, K16): bakiye + limit + emanet; hesap dökümü (para başına devir ve
 * yürüyen bakiye); cariye kesilen fişler ve çıktısı (PDF). Fiş satırları ayrı ekranda açılmaz; çıktı fişin kendisidir.
 */

interface Bakiye {
  satirlar: { paraKod: string; paraAd: string; bakiye: number; yon: string; yonAdi: string }[];
  bakiyeSiniri: number | null;
  emanetler: { paraKod: string; paraAd: string; miktar: number }[];
}
interface DokumSatiri {
  para: string;
  tarih: string;
  saat: string;
  tur: string;
  belgeNo: string;
  aciklama: string;
  borc: number | null;
  alacak: number | null;
  emanet: number | null;
  bakiye: number;
  yonAdi: string;
  belge: { tur: string; id: number } | null;
}
interface Dokum {
  bas: string;
  bit: string;
  satirlar: DokumSatiri[];
  toplamlar: { para: string; borc: number; alacak: number; bakiye: number; yonAdi: string }[];
}
interface Belge {
  tur: string;
  id: number;
  satir: number | null;
  belgeNo: string;
  tarih: string;
  saat: string;
  ad: string;
  toplamTl: number;
}

const gunYaz = (g: string) => (g ? g.split("-").reverse().join(".") : "");
const bugun = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const gunOnce = (n: number) => new Date(Date.now() - new Date().getTimezoneOffset() * 60000 - n * 86400000).toISOString().slice(0, 10);
const yonRenk = (yon: string) => (yon === "Borç" ? "text-danger" : yon === "Alacak" ? "text-success" : "");

const pdfAc = async (tur: string, id: number, setHata: (m: string) => void, satir?: number | null) => {
  // Yeni pencere tıklamayla hemen açılır (telefon tarayıcıları sonradan açılan pencereyi engeller), PDF gelince yüklenir
  const pencere = window.open("", "_blank");
  try {
    const ek = satir !== null && satir !== undefined ? `?satir=${satir}` : "";
    const blob = await dosyaIstek(`/belge/${tur}/${id}.pdf${ek}`);
    const url = URL.createObjectURL(blob);
    if (pencere) pencere.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e: any) {
    pencere?.close();
    setHata(e?.message || "Belge açılamadı.");
  }
};

const HesapEkrani: React.FC<{ firmaId: number; yetkiler: MobilYetkiler }> = ({ firmaId, yetkiler }) => {
  const [bakiye, setBakiye] = useState<Bakiye | null>(null);
  const [dokum, setDokum] = useState<Dokum | null>(null);
  const [belgeler, setBelgeler] = useState<Belge[] | null>(null);
  const [aralik, setAralik] = useState<{ bas: string; bit: string }>({ bas: gunOnce(30), bit: bugun() });
  const [gorunum, setGorunum] = useState<"dokum" | "fisler">("dokum");
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    setHata(null);
    setYukleniyor(true);
    try {
      const q = `?bas=${aralik.bas}&bit=${aralik.bit}`;
      const [b, d, f] = await Promise.all([
        yetkiler.bakiye ? istek<Bakiye>("GET", "/bakiye") : Promise.resolve(null),
        yetkiler.dokum ? istek<Dokum>("GET", `/dokum${q}`) : Promise.resolve(null),
        yetkiler.dokum ? istek<{ belgeler: Belge[] }>("GET", `/belgeler${q}`) : Promise.resolve(null),
      ]);
      setBakiye(b);
      setDokum(d);
      setBelgeler(f?.belgeler ?? null);
    } catch (e: any) {
      setHata(e?.message || "Hesap bilgisi alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [aralik, yetkiler.bakiye, yetkiler.dokum]);

  useEffect(() => {
    void yukle();
  }, [yukle, firmaId]);

  const paraGruplari = useMemo(() => {
    const m = new Map<string, DokumSatiri[]>();
    for (const s of dokum?.satirlar || []) m.set(s.para, [...(m.get(s.para) || []), s]);
    return [...m.entries()];
  }, [dokum]);

  return (
    <>
      {hata && (
        <Alert variant="warning" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}

      {yetkiler.bakiye && (
        <div className="m-kart">
          <div className="m-baslik">Bakiyem</div>
          {!bakiye ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <>
              {bakiye.satirlar.length === 0 && <div className="text-muted">Bakiyeniz yok.</div>}
              {bakiye.satirlar.map((s) => (
                <div className="m-dokum-satir" key={s.paraKod}>
                  <div className="sol">
                    {s.paraAd}
                    <div className="soluk">{s.paraKod}</div>
                  </div>
                  <div className={`tutar ${yonRenk(s.yonAdi)}`}>
                    {tl(s.bakiye, 2)} <span className="soluk">{s.yonAdi === "Borç" ? "borcunuz" : "alacağınız"}</span>
                  </div>
                </div>
              ))}
              {bakiye.bakiyeSiniri !== null && bakiye.bakiyeSiniri > 0 && <div className="small text-muted">Bakiye sınırınız: {tl(bakiye.bakiyeSiniri, 2)} TL</div>}
              {bakiye.emanetler.length > 0 && (
                <>
                  <div className="m-baslik mt-3">Emanetim</div>
                  {bakiye.emanetler.map((e) => (
                    <div className="m-dokum-satir" key={e.paraKod}>
                      <div className="sol">{e.paraAd || e.paraKod}</div>
                      <div className="tutar">
                        {tl(Math.abs(e.miktar), 2)} <span className="soluk">{e.miktar > 0 ? "firmada emanetiniz" : "sizde emanet"}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {yetkiler.dokum && (
        <div className="m-kart">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <ButtonGroup size="sm">
              <Button variant={gorunum === "dokum" ? "primary" : "outline-primary"} onClick={() => setGorunum("dokum")}>
                Hesap dökümü
              </Button>
              <Button variant={gorunum === "fisler" ? "primary" : "outline-primary"} onClick={() => setGorunum("fisler")}>
                Fişlerim
              </Button>
            </ButtonGroup>
            {yukleniyor && <Spinner animation="border" size="sm" />}
          </div>
          <div className="d-flex gap-2 mb-2">
            <Form.Control size="sm" type="date" value={aralik.bas} max={aralik.bit} onChange={(e) => e.target.value && setAralik((a) => ({ ...a, bas: e.target.value }))} />
            <Form.Control size="sm" type="date" value={aralik.bit} min={aralik.bas} onChange={(e) => e.target.value && setAralik((a) => ({ ...a, bit: e.target.value }))} />
          </div>
          <div className="d-flex gap-1 mb-2">
            {[7, 30, 90, 365].map((n) => (
              <Button key={n} size="sm" variant="light" onClick={() => setAralik({ bas: gunOnce(n), bit: bugun() })}>
                {n === 365 ? "1 yıl" : `${n} gün`}
              </Button>
            ))}
          </div>

          {gorunum === "dokum" &&
            dokum &&
            (paraGruplari.length === 0 ? (
              <div className="text-muted py-2">Bu tarihlerde hareket yok.</div>
            ) : (
              paraGruplari.map(([para, satirlar]) => {
                const t = dokum.toplamlar.find((x) => x.para === para);
                return (
                  <div key={para} className="mb-3">
                    <div className="fw-bold border-bottom pb-1">{para}</div>
                    {satirlar.map((s, i) => (
                      <div className="m-dokum-satir" key={i}>
                        <div className="sol">
                          <div>
                            {s.tur}
                            {s.belgeNo ? <span className="soluk"> · {s.belgeNo}</span> : null}
                          </div>
                          <div className="soluk">
                            {gunYaz(s.tarih)} {s.saat} {s.aciklama && s.tur !== "Devir" ? `· ${s.aciklama}` : ""}
                          </div>
                          {s.belge && (
                            <Button size="sm" variant="link" className="p-0" onClick={() => void pdfAc(s.belge!.tur, s.belge!.id, setHata)}>
                              <IconFileTypePdf size={15} /> Fiş çıktısı
                            </Button>
                          )}
                        </div>
                        <div className="tutar">
                          {s.emanet !== null ? (
                            <span className="soluk">emanet {tl(s.emanet, 2)}</span>
                          ) : (
                            <>
                              {s.borc ? <div className="text-danger">−{tl(s.borc, 2)}</div> : null}
                              {s.alacak ? <div className="text-success">+{tl(s.alacak, 2)}</div> : null}
                              <div className="soluk">
                                {tl(s.bakiye, 2)} {s.yonAdi ? s.yonAdi.toLowerCase() : ""}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {t && (
                      <div className="d-flex justify-content-between small fw-semibold pt-1">
                        <span>Son bakiye</span>
                        <span className={yonRenk(t.yonAdi)}>
                          {tl(t.bakiye, 2)} {t.yonAdi.toLowerCase()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ))}

          {gorunum === "fisler" &&
            belgeler &&
            (belgeler.length === 0 ? (
              <div className="text-muted py-2">Bu tarihlerde fiş yok.</div>
            ) : (
              belgeler.map((b) => (
                <div className="m-dokum-satir" key={`${b.tur}-${b.id}-${b.satir ?? ""}`}>
                  <div className="sol">
                    {b.ad}
                    <div className="soluk">
                      {gunYaz(b.tarih)} {b.saat} · {b.belgeNo}
                    </div>
                  </div>
                  <div className="tutar">
                    {tl(b.toplamTl, 2)} TL
                    <div>
                      <Button size="sm" variant="outline-primary" className="mt-1" onClick={() => void pdfAc(b.tur, b.id, setHata, b.satir)}>
                        <IconFileTypePdf size={15} /> Çıktı
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ))}
        </div>
      )}
    </>
  );
};

export default HesapEkrani;
