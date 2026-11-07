import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Form, Spinner } from "react-bootstrap";
import { IconFileTypePdf } from "@tabler/icons-react";
import { MobilYetkiler, dosyaIstek, istek, tl } from "../api";

/**
 * Hesabım (docs/MOBIL_CARI_YOL_HARITASI.md K10, K15, K16, §8 T6): bakiye + limit + emanet koyu kartta; hesap dökümü
 * (para başına devir ve yürüyen bakiye); cariye kesilen fişler ve çıktısı (PDF). Fiş satırları ayrı ekranda açılmaz;
 * çıktı fişin kendisidir.
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
const yonSinifi = (yon: string) => (yon === "Borç" ? "borc" : yon === "Alacak" ? "alacak" : "");
const HIZLI = [7, 30, 90, 365];

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

  const seciliHizli = HIZLI.find((n) => aralik.bas === gunOnce(n) && aralik.bit === bugun());

  return (
    <>
      {hata && (
        <Alert variant="warning" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}

      {/* Geniş ekranda bakiye solda, döküm sağda (mobil.scss .m-hesap-duzen) */}
      <div className="m-hesap-duzen">
        {yetkiler.bakiye && (
          <div className="m-bakiye">
            <div className="m-baslik mb-1">Bakiyem</div>
            {!bakiye ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <>
                {bakiye.satirlar.length === 0 && <div className="bos">Bakiyeniz yok.</div>}
                {bakiye.satirlar.map((s, i) => (
                  <div className={`para${i === bakiye.satirlar.length - 1 ? " son" : ""}`} key={s.paraKod}>
                    <div className="ad">
                      {s.paraAd}
                      <span className="kod">{s.paraKod}</span>
                    </div>
                    <div className={`deger ${yonSinifi(s.yonAdi)}`}>
                      <span className="sayi">{tl(s.bakiye, 2)}</span>
                      <span className="yon">{s.yonAdi === "Borç" ? "Borcunuz" : "Alacağınız"}</span>
                    </div>
                  </div>
                ))}
                {bakiye.emanetler.length > 0 && (
                  <>
                    <div className="m-baslik mt-3">Emanetim</div>
                    <div className="m-cipler">
                      {bakiye.emanetler.map((e) => (
                        <span className="m-cip" key={e.paraKod}>
                          <b>{tl(Math.abs(e.miktar), 2)}</b> {e.paraAd || e.paraKod} · {e.miktar > 0 ? "firmada" : "sizde"}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {bakiye.bakiyeSiniri !== null && bakiye.bakiyeSiniri > 0 && <div className="sinir">Bakiye sınırınız {tl(bakiye.bakiyeSiniri, 2)} TL</div>}
              </>
            )}
          </div>
        )}

        {yetkiler.dokum && (
          <div className="m-kart">
            <div className="m-kart-ust">
              <div className="m-segment kucuk flex-grow-1" role="tablist">
                <button type="button" role="tab" aria-selected={gorunum === "dokum"} className={gorunum === "dokum" ? "secili" : ""} onClick={() => setGorunum("dokum")}>
                  Hesap dökümü
                </button>
                <button type="button" role="tab" aria-selected={gorunum === "fisler"} className={gorunum === "fisler" ? "secili" : ""} onClick={() => setGorunum("fisler")}>
                  Fişlerim
                </button>
              </div>
              {yukleniyor && <Spinner animation="border" size="sm" />}
            </div>
            <div className="m-cipler">
              {HIZLI.map((n) => (
                <button key={n} type="button" className={`m-cip${seciliHizli === n ? " secili" : ""}`} onClick={() => setAralik({ bas: gunOnce(n), bit: bugun() })}>
                  {n === 365 ? "1 yıl" : `${n} gün`}
                </button>
              ))}
            </div>
            <div className="m-tarih">
              <Form.Control type="date" value={aralik.bas} max={aralik.bit} aria-label="Başlangıç" onChange={(e) => e.target.value && setAralik((a) => ({ ...a, bas: e.target.value }))} />
              <Form.Control type="date" value={aralik.bit} min={aralik.bas} aria-label="Bitiş" onChange={(e) => e.target.value && setAralik((a) => ({ ...a, bit: e.target.value }))} />
            </div>

            {gorunum === "dokum" &&
              dokum &&
              (paraGruplari.length === 0 ? (
                <div className="m-bos">Bu tarihlerde hareket yok.</div>
              ) : (
                paraGruplari.map(([para, satirlar]) => {
                  const t = dokum.toplamlar.find((x) => x.para === para);
                  return (
                    <div key={para}>
                      <div className="m-para-baslik">{para}</div>
                      {satirlar.map((s, i) => (
                        <div className="m-dokum-satir" key={i}>
                          <div className="sol">
                            <div className="baslik">
                              {s.tur}
                              {s.belgeNo ? <span className="soluk"> · {s.belgeNo}</span> : null}
                            </div>
                            <div className="soluk">
                              {gunYaz(s.tarih)} {s.saat} {s.aciklama && s.tur !== "Devir" ? `· ${s.aciklama}` : ""}
                            </div>
                            {s.belge && (
                              <button type="button" className="m-pdf" onClick={() => void pdfAc(s.belge!.tur, s.belge!.id, setHata)}>
                                <IconFileTypePdf size={14} /> Fiş çıktısı
                              </button>
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
                        <div className="m-son-bakiye">
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
                <div className="m-bos">Bu tarihlerde fiş yok.</div>
              ) : (
                belgeler.map((b) => (
                  <div className="m-dokum-satir align-items-center" key={`${b.tur}-${b.id}-${b.satir ?? ""}`}>
                    <div className="sol">
                      <div className="baslik">{b.ad}</div>
                      <div className="soluk">
                        {gunYaz(b.tarih)} {b.saat} · {b.belgeNo}
                      </div>
                    </div>
                    <div className="tutar">
                      {tl(b.toplamTl, 2)} TL
                      <div>
                        <button type="button" className="m-pdf" onClick={() => void pdfAc(b.tur, b.id, setHata, b.satir)}>
                          <IconFileTypePdf size={14} /> Çıktı
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HesapEkrani;
