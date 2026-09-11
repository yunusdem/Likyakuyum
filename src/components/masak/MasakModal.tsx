import React, { useCallback, useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Alert, Badge } from "react-bootstrap";
import {
  IconShieldCheck,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconHistory,
  IconListDetails,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { MASAK_LISTS } from "data/masakData";
import {
  MasakService,
  masakAdresGecerliMi,
  masakBayatMi,
  masakSayi,
  masakTarihSaat,
  type MasakGecmisKaydi,
  type MasakGuncellemeRaporu,
  type MasakListeKod,
} from "../../services/masakService";

interface MasakModalProps {
  show: boolean;
  onHide: () => void;
}

interface KaynakSatiri {
  listeKod: MasakListeKod;
  code: string;
  baslik: string;
  url: string;
  secili: boolean;
  kayitSayisi: number;
  sonGuncelleme: string | null;
}

type Sekme = "adresler" | "gecmis";

export const MasakModal: React.FC<MasakModalProps> = ({ show, onHide }) => {
  const navigate = useNavigate();

  const [sekme, setSekme] = useState<Sekme>("adresler");
  const [satirlar, setSatirlar] = useState<KaynakSatiri[]>([]);
  const [toplamKayit, setToplamKayit] = useState<number>(0);
  const [sonGuncelleme, setSonGuncelleme] = useState<string | null>(null);
  const [durumYukleniyor, setDurumYukleniyor] = useState<boolean>(false);
  const [guncelleniyor, setGuncelleniyor] = useState<boolean>(false);
  const [rapor, setRapor] = useState<MasakGuncellemeRaporu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [gecmis, setGecmis] = useState<MasakGecmisKaydi[]>([]);
  const [gecmisYukleniyor, setGecmisYukleniyor] = useState<boolean>(false);

  /** Her açılışta adresler boş; kayıt sayıları backend'den okunur. */
  const varsayilanSatirlar = useCallback((): KaynakSatiri[] => {
    return MASAK_LISTS.map((item) => ({
      listeKod: item.listeKod,
      code: item.code,
      baslik: item.shortTitle,
      url: '',
      secili: true,
      kayitSayisi: 0,
      sonGuncelleme: null,
    }));
  }, []);

  const durumYukle = useCallback(async () => {
    setDurumYukleniyor(true);
    setHata(null);
    try {
      const durum = await MasakService.getDurum();
      setToplamKayit(durum.toplamKayit);
      setSonGuncelleme(durum.sonGuncelleme);
      setSatirlar(
        varsayilanSatirlar().map((satir) => {
          const d = durum.listeler.find((l) => l.listeKod === satir.listeKod);
          return d
            ? {
                ...satir,
                kayitSayisi: d.kayitSayisi,
                sonGuncelleme: d.sonGuncelleme,
              }
            : satir;
        })
      );
    } catch (err: any) {
      setSatirlar(varsayilanSatirlar());
      setHata(err?.message || "MASAK liste durumu okunamadı.");
    } finally {
      setDurumYukleniyor(false);
    }
  }, [varsayilanSatirlar]);

  const gecmisYukle = useCallback(async () => {
    setGecmisYukleniyor(true);
    try {
      setGecmis(await MasakService.getGecmis({ limit: 30 }));
    } catch {
      setGecmis([]);
    } finally {
      setGecmisYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    setSekme("adresler");
    setRapor(null);
    setSatirlar(varsayilanSatirlar());
    durumYukle();
  }, [show, durumYukle]);

  useEffect(() => {
    if (show && sekme === "gecmis") gecmisYukle();
  }, [show, sekme, gecmisYukle]);

  const satirGuncelle = (listeKod: MasakListeKod, degisiklik: Partial<KaynakSatiri>) => {
    setSatirlar((onceki) =>
      onceki.map((s) => (s.listeKod === listeKod ? { ...s, ...degisiklik } : s))
    );
  };

  const secililer = satirlar.filter((s) => s.secili);
  const gecersizAdresVar = secililer.some((s) => !masakAdresGecerliMi(s.url));
  const baslatilabilir = !durumYukleniyor && !guncelleniyor && secililer.length > 0 && !gecersizAdresVar;

  const guncellemeyiBaslat = async () => {
    setGuncelleniyor(true);
    setHata(null);
    setRapor(null);
    try {
      const sonuc = await MasakService.guncelle(
        secililer.map((s) => ({ listeKod: s.listeKod, url: s.url.trim() }))
      );
      setRapor(sonuc);
      setToplamKayit(sonuc.toplamKayit);
      setSonGuncelleme(sonuc.guncellemeZamani);
      setSatirlar((onceki) =>
        onceki.map((satir) => {
          const d = sonuc.durum.find((l) => l.listeKod === satir.listeKod);
          return d
            ? {
                ...satir,
                url: sonuc.sonuclar.some(s => s.listeKod === satir.listeKod && s.durum === 'basarili') ? '' : satir.url,
                kayitSayisi: d.kayitSayisi,
                sonGuncelleme: d.sonGuncelleme,
              }
            : satir;
        })
      );
    } catch (err: any) {
      setHata(err?.message || "Güncelleme yapılamadı.");
    } finally {
      setGuncelleniyor(false);
    }
  };

  const bayat = masakBayatMi(sonGuncelleme);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop={guncelleniyor ? "static" : true}>
      <Modal.Header closeButton={!guncelleniyor}>
        <Modal.Title as="h6" className="d-flex align-items-center gap-2 fw-bold mb-0">
          <IconShieldCheck size={20} className="text-danger" />
          MASAK Malvarlıkları Dondurulanlar
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {/* Durum bandı */}
        <div
          className={`d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded px-3 py-2 mb-3 ${
            bayat ? "border-danger bg-danger-subtle" : "bg-light"
          }`}
          style={{ fontSize: "0.82rem" }}
        >
          <div className="d-flex align-items-center gap-3">
            <span>
              Toplam kayıt: <strong>{masakSayi(toplamKayit)}</strong>
            </span>
            <span className="text-muted">
              Son güncelleme: <strong>{masakTarihSaat(sonGuncelleme)}</strong>
            </span>
          </div>
          {bayat && (
            <span className="text-danger fw-semibold d-flex align-items-center gap-1">
              <IconAlertTriangle size={15} />
              MASAK sitesinden listeleri sık aralıklarla güncelleyiniz.
            </span>
          )}
        </div>

        {/* Sekmeler */}
        <div className="d-flex align-items-center gap-1 mb-3">
          <Button
            variant={sekme === "adresler" ? "primary" : "outline-secondary"}
            size="sm"
            className="d-flex align-items-center gap-1"
            onClick={() => setSekme("adresler")}
          >
            <IconListDetails size={15} /> Liste Adresleri
          </Button>
          <Button
            variant={sekme === "gecmis" ? "primary" : "outline-secondary"}
            size="sm"
            className="d-flex align-items-center gap-1"
            onClick={() => setSekme("gecmis")}
            disabled={guncelleniyor}
          >
            <IconHistory size={15} /> Geçmiş
          </Button>
        </div>

        {hata && (
          <Alert variant="danger" className="py-2 px-3 mb-3" style={{ fontSize: "0.82rem" }}>
            {hata}
          </Alert>
        )}

        {sekme === "adresler" && (
          <>
            {durumYukleniyor ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-4 text-muted">
                <Spinner animation="border" variant="primary" size="sm" className="mb-2" />
                <span style={{ fontSize: "0.85rem" }}>Liste durumu okunuyor...</span>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {satirlar.map((satir) => {
                  const adresGecerli = masakAdresGecerliMi(satir.url);
                  return (
                    <div key={satir.listeKod} className="border rounded p-2 bg-white">
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                        <Form.Check
                          type="checkbox"
                          id={`masak-secim-${satir.listeKod}`}
                          checked={satir.secili}
                          disabled={guncelleniyor}
                          onChange={(e) =>
                            satirGuncelle(satir.listeKod, { secili: e.target.checked })
                          }
                          label={
                            <span className="d-flex align-items-center gap-2">
                              <Badge bg="secondary" style={{ minWidth: "42px" }}>
                                {satir.code}
                              </Badge>
                              <span className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                                {satir.baslik}
                              </span>
                            </span>
                          }
                        />
                        <span className="text-muted text-nowrap" style={{ fontSize: "0.78rem" }}>
                          {masakSayi(satir.kayitSayisi)} kayıt
                          {satir.sonGuncelleme ? ` · ${masakTarihSaat(satir.sonGuncelleme)}` : ""}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-1">
                        <Form.Control
                          size="sm"
                          type="text"
                          value={satir.url}
                          disabled={guncelleniyor}
                          aria-label={`${satir.code} liste adresi`}
                          autoComplete="off"
                          isInvalid={satir.secili && !!satir.url.trim() && !adresGecerli}
                          onChange={(e) => satirGuncelle(satir.listeKod, { url: e.target.value })}
                          placeholder="https://ms.hmb.gov.tr/uploads/... .xlsx"
                          className="font-monospace"
                          style={{ fontSize: "0.74rem" }}
                        />
                      </div>

                      {satir.secili && !!satir.url.trim() && !adresGecerli && (
                        <div className="text-danger mt-1" style={{ fontSize: "0.74rem" }}>
                          Adres https://ms.hmb.gov.tr/ ile başlamalı ve .xlsx ile bitmelidir.
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-muted" style={{ fontSize: "0.76rem" }}>
                  Güncellemek istediğiniz listelerin güncel adreslerini girin; diğer listelerin seçimini kaldırın.
                </div>
              </div>
            )}

            {/* Sonuç raporu */}
            {rapor && (
              <div className="border rounded mt-3">
                <div
                  className="px-3 py-2 border-bottom fw-semibold"
                  style={{ fontSize: "0.82rem", background: "linear-gradient(180deg, #eef5fc 0%, #dbe8f6 100%)" }}
                >
                  Güncelleme sonucu
                </div>
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.8rem" }}>
                    <tbody>
                      {rapor.sonuclar.map((s) => (
                        <tr key={s.listeKod}>
                          <td style={{ width: "60px" }} className="text-center">
                            {s.durum === "basarili" ? (
                              <IconCheck size={16} className="text-success" />
                            ) : (
                              <IconAlertTriangle size={16} className="text-danger" />
                            )}
                          </td>
                          <td style={{ width: "70px" }} className="fw-semibold">
                            {s.listeKod === "3AB" ? "3.A-B" : s.listeKod}
                          </td>
                          <td>
                            {s.durum === "basarili" ? (
                              <>
                                <strong>{masakSayi(s.kayitSayisi)}</strong> kayıt eklendi
                                <span className="text-muted"> (önceki {masakSayi(s.oncekiKayitSayisi)})</span>
                              </>
                            ) : (
                              <span className="text-danger">
                                {s.hata}
                                {s.oncekiKayitSayisi > 0 && (
                                  <span className="text-muted">
                                    {" "}
                                    Bu listenin mevcut {masakSayi(s.oncekiKayitSayisi)} kaydı korundu.
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td style={{ width: "80px" }} className="text-end text-muted">
                            {(s.sureMs / 1000).toFixed(1)} sn
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {sekme === "gecmis" && (
          <div className="table-responsive border rounded" style={{ maxHeight: "320px" }}>
            {gecmisYukleniyor ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-4 text-muted">
                <Spinner animation="border" variant="primary" size="sm" className="mb-2" />
                <span style={{ fontSize: "0.85rem" }}>Geçmiş yükleniyor...</span>
              </div>
            ) : (
              <table
                className="table table-sm table-bordered table-hover mb-0 align-middle"
                style={{ fontSize: "0.78rem" }}
              >
                <thead
                  className="sticky-top"
                  style={{ background: "linear-gradient(180deg, #dbe8f6 0%, #c8dcf0 100%)", zIndex: 2 }}
                >
                  <tr className="text-secondary text-nowrap">
                    <th className="py-1 px-2">Tarih</th>
                    <th className="py-1 px-2">Liste</th>
                    <th className="py-1 px-2">Sonuç</th>
                    <th className="py-1 px-2 text-end">Kayıt</th>
                    <th className="py-1 px-2">Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  {gecmis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        Henüz güncelleme kaydı yok.
                      </td>
                    </tr>
                  ) : (
                    gecmis.map((g, idx) => (
                      <tr key={g.guncellemeId} style={{ backgroundColor: idx % 2 === 1 ? "#f9fbfd" : "#ffffff" }}>
                        <td className="py-1 px-2 text-nowrap">{masakTarihSaat(g.baslamaZamani)}</td>
                        <td className="py-1 px-2">{g.listeKod === "3AB" ? "3.A-B" : g.listeKod}</td>
                        <td className="py-1 px-2">
                          {g.durum === "BASARILI" ? (
                            <span className="text-success">Başarılı</span>
                          ) : (
                            <span className="text-danger" title={g.hataMesaji || ""}>
                              Hata: {(g.hataMesaji || "").slice(0, 60)}
                            </span>
                          )}
                        </td>
                        <td className="py-1 px-2 text-end">{masakSayi(g.kayitSayisi)}</td>
                        <td className="py-1 px-2">{g.kullaniciAdi || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="d-flex justify-content-between">
        <Button
          variant="outline-primary"
          size="sm"
          disabled={guncelleniyor}
          onClick={() => {
            onHide();
            navigate("/ayarlar/masak-dondurulanlar");
          }}
        >
          MASAK Sayfasına Git
        </Button>

        <div className="d-flex align-items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onHide} disabled={guncelleniyor}>
            Kapat
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={guncellemeyiBaslat}
            disabled={!baslatilabilir}
            className="d-flex align-items-center gap-1"
          >
            {guncelleniyor ? (
              <>
                <Spinner as="span" animation="border" size="sm" /> Güncelleniyor...
              </>
            ) : (
              <>
                <IconRefresh size={15} /> MASAK Listelerini Güncelle
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default MasakModal;
