import React, { useCallback, useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Alert, Badge } from "react-bootstrap";
import {
  IconShieldCheck,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconHistory,
  IconListDetails,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { MASAK_LISTS } from "data/masakData";
import {
  MasakService,
  masakAdresGecerliMi,
  masakBayatMi,
  masakKodEtiketi,
  masakListeKodGecerliMi,
  masakSayi,
  masakStandartListeMi,
  masakTarihSaat,
  type MasakGecmisKaydi,
  type MasakGuncellemeRaporu,
  type MasakListeDurumu,
  type MasakListeKod,
} from "../../services/masakService";

interface MasakModalProps {
  show: boolean;
  onHide: () => void;
}

interface KaynakSatiri {
  /** Satırı ayırt eden anahtar; yeni eklenen satırlarda kod değişse de sabit kalır */
  anahtar: string;
  listeKod: MasakListeKod;
  baslik: string;
  url: string;
  secili: boolean;
  kayitSayisi: number;
  sonGuncelleme: string | null;
  /** Kullanıcı tanımlı liste (standart A/B/C/3AB dışı) */
  ozel: boolean;
  /** Ekranda yeni eklendi, henüz hiç güncellenmedi (sunucuda kaydı yok) */
  yeni: boolean;
}

type Sekme = "adresler" | "gecmis";

/** Standart listelerin ekran başlığı ve yedek adresi (sunucu adres döndürmezse) */
const standartTanim = (listeKod: string) => MASAK_LISTS.find((l) => l.listeKod === listeKod);

/**
 * Sunucudan gelen liste durumunu ekran satırlarına çevirir.
 * Adres alanı son girilen adresle dolu gelir; standart listede o da yoksa varsayılan adres kullanılır.
 * `onceki` verilirse seçim durumu ve henüz kaydedilmemiş yeni satırlar korunur.
 */
const satirlariOlustur = (listeler: MasakListeDurumu[], onceki: KaynakSatiri[] = []): KaynakSatiri[] => {
  const oncekiMap = new Map(onceki.map((s) => [s.listeKod, s]));

  const sunucudan: KaynakSatiri[] = listeler.map((d) => {
    const tanim = standartTanim(d.listeKod);
    const eski = oncekiMap.get(d.listeKod);
    return {
      anahtar: d.listeKod,
      listeKod: d.listeKod,
      baslik: tanim?.shortTitle || d.listeAdi || d.listeKod,
      // Kullanıcının ekranda yazdığı adres korunur; yoksa sunucudaki son girilen adres
      url: eski?.url || d.kaynakUrl || tanim?.url || "",
      secili: eski ? eski.secili : true,
      kayitSayisi: d.kayitSayisi,
      sonGuncelleme: d.sonGuncelleme,
      ozel: d.ozel ?? !masakStandartListeMi(d.listeKod),
      yeni: false,
    };
  });

  // Sunucu yanıtı gelmediyse bile standart dört liste her zaman görünür
  for (const tanim of MASAK_LISTS) {
    if (!sunucudan.some((s) => s.listeKod === tanim.listeKod)) {
      const eski = oncekiMap.get(tanim.listeKod);
      sunucudan.push({
        anahtar: tanim.listeKod,
        listeKod: tanim.listeKod,
        baslik: tanim.shortTitle,
        url: eski?.url || tanim.url,
        secili: eski ? eski.secili : true,
        kayitSayisi: 0,
        sonGuncelleme: null,
        ozel: false,
        yeni: false,
      });
    }
  }

  // Ekranda eklenmiş ama sunucuda hâlâ olmayan satırlar (ör. seçimi kaldırılıp güncellenmemiş)
  const kaydedilmemis = onceki.filter((s) => s.yeni && !sunucudan.some((x) => x.listeKod === s.listeKod));

  return [...sunucudan, ...kaydedilmemis];
};

let yeniSatirSayaci = 0;

export const MasakModal: React.FC<MasakModalProps> = ({ show, onHide }) => {
  const navigate = useNavigate();

  const [sekme, setSekme] = useState<Sekme>("adresler");
  const [satirlar, setSatirlar] = useState<KaynakSatiri[]>([]);
  const [toplamKayit, setToplamKayit] = useState<number>(0);
  const [sonGuncelleme, setSonGuncelleme] = useState<string | null>(null);
  const [durumYukleniyor, setDurumYukleniyor] = useState<boolean>(false);
  const [guncelleniyor, setGuncelleniyor] = useState<boolean>(false);
  const [silinenKod, setSilinenKod] = useState<string | null>(null);
  const [rapor, setRapor] = useState<MasakGuncellemeRaporu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [gecmis, setGecmis] = useState<MasakGecmisKaydi[]>([]);
  const [gecmisYukleniyor, setGecmisYukleniyor] = useState<boolean>(false);

  const durumYukle = useCallback(async () => {
    setDurumYukleniyor(true);
    setHata(null);
    try {
      const durum = await MasakService.getDurum();
      setToplamKayit(durum.toplamKayit);
      setSonGuncelleme(durum.sonGuncelleme);
      setSatirlar((onceki) => satirlariOlustur(durum.listeler, onceki));
    } catch (err: any) {
      setSatirlar((onceki) => satirlariOlustur([], onceki));
      setHata(err?.message || "MASAK liste durumu okunamadı.");
    } finally {
      setDurumYukleniyor(false);
    }
  }, []);

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
    setSatirlar([]);
    durumYukle();
  }, [show, durumYukle]);

  useEffect(() => {
    if (show && sekme === "gecmis") gecmisYukle();
  }, [show, sekme, gecmisYukle]);

  const satirGuncelle = (anahtar: string, degisiklik: Partial<KaynakSatiri>) => {
    setSatirlar((onceki) => onceki.map((s) => (s.anahtar === anahtar ? { ...s, ...degisiklik } : s)));
  };

  const yeniSatirEkle = () => {
    yeniSatirSayaci += 1;
    setSatirlar((onceki) => [
      ...onceki,
      {
        anahtar: `yeni-${yeniSatirSayaci}`,
        listeKod: "",
        baslik: "",
        url: "",
        secili: true,
        kayitSayisi: 0,
        sonGuncelleme: null,
        ozel: true,
        yeni: true,
      },
    ]);
  };

  const satirSil = async (satir: KaynakSatiri) => {
    if (satir.yeni) {
      setSatirlar((onceki) => onceki.filter((s) => s.anahtar !== satir.anahtar));
      return;
    }
    const onay = window.confirm(
      `${masakKodEtiketi(satir.listeKod)} listesi ve ${masakSayi(satir.kayitSayisi)} kaydı ile güncelleme geçmişi silinecek. Devam edilsin mi?`
    );
    if (!onay) return;

    setSilinenKod(satir.listeKod);
    setHata(null);
    try {
      await MasakService.sil(satir.listeKod);
      setSatirlar((onceki) => onceki.filter((s) => s.anahtar !== satir.anahtar));
      await durumYukle();
    } catch (err: any) {
      setHata(err?.message || "Liste silinemedi.");
    } finally {
      setSilinenKod(null);
    }
  };

  /** Satır bazlı doğrulama; seçili olmayan satırlar güncellemeyi engellemez */
  const satirHatasi = (satir: KaynakSatiri): string | null => {
    if (!satir.secili) return null;
    if (satir.ozel) {
      const kod = satir.listeKod.trim();
      if (!masakListeKodGecerliMi(kod)) {
        return "Liste kodu büyük harf ve rakamdan oluşmalı, en fazla 10 karakter olmalıdır (ör. D).";
      }
      if (satirlar.some((s) => s.anahtar !== satir.anahtar && s.listeKod.trim() === kod)) {
        return `${kod} kodu zaten kullanılıyor.`;
      }
      if (!satir.baslik.trim()) return "Listenin açıklamasını giriniz.";
    }
    if (!satir.url.trim()) return "Adres giriniz.";
    if (!masakAdresGecerliMi(satir.url)) {
      return "Adres https://ms.hmb.gov.tr/ ile başlamalı ve .xlsx ile bitmelidir.";
    }
    return null;
  };

  const secililer = satirlar.filter((s) => s.secili);
  const hataliSatirVar = secililer.some((s) => satirHatasi(s) !== null);
  const mesgul = guncelleniyor || !!silinenKod;
  const baslatilabilir = !durumYukleniyor && !mesgul && secililer.length > 0 && !hataliSatirVar;

  const guncellemeyiBaslat = async () => {
    setGuncelleniyor(true);
    setHata(null);
    setRapor(null);
    try {
      const sonuc = await MasakService.guncelle(
        secililer.map((s) => ({
          listeKod: s.listeKod.trim().toUpperCase(),
          url: s.url.trim(),
          listeAdi: s.ozel ? s.baslik.trim() : undefined,
        }))
      );
      setRapor(sonuc);
      setToplamKayit(sonuc.toplamKayit);
      setSonGuncelleme(sonuc.guncellemeZamani);
      // Adresler silinmez: sunucu son girilen adresi döndürür, ekran onunla yenilenir.
      setSatirlar((onceki) =>
        satirlariOlustur(
          sonuc.durum,
          onceki.map((s) => ({ ...s, listeKod: s.listeKod.trim().toUpperCase() }))
        )
      );
    } catch (err: any) {
      setHata(err?.message || "Güncelleme yapılamadı.");
    } finally {
      setGuncelleniyor(false);
    }
  };

  const bayat = masakBayatMi(sonGuncelleme);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop={mesgul ? "static" : true}>
      <Modal.Header closeButton={!mesgul}>
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
            disabled={mesgul}
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
                  const satirHata = satirHatasi(satir);
                  const dokunuldu = satir.ozel ? true : !!satir.url.trim();
                  const siliniyor = silinenKod === satir.listeKod;
                  return (
                    <div
                      key={satir.anahtar}
                      className={`border rounded p-2 ${satir.yeni ? "bg-warning-subtle" : "bg-white"}`}
                    >
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <Form.Check
                            type="checkbox"
                            id={`masak-secim-${satir.anahtar}`}
                            checked={satir.secili}
                            disabled={mesgul}
                            onChange={(e) => satirGuncelle(satir.anahtar, { secili: e.target.checked })}
                            aria-label={satir.ozel ? "Listeyi güncellemeye dahil et" : undefined}
                            label={
                              satir.ozel ? undefined : (
                                <span className="d-flex align-items-center gap-2">
                                  <Badge bg="secondary" style={{ minWidth: "42px" }}>
                                    {masakKodEtiketi(satir.listeKod)}
                                  </Badge>
                                  <span className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                                    {satir.baslik}
                                  </span>
                                </span>
                              )
                            }
                          />
                          {satir.ozel && (
                              <span className="d-flex align-items-center gap-2">
                                <Form.Control
                                  size="sm"
                                  type="text"
                                  value={satir.listeKod}
                                  disabled={mesgul || !satir.yeni}
                                  maxLength={10}
                                  placeholder="Kod"
                                  aria-label="Yeni liste kodu"
                                  autoComplete="off"
                                  onChange={(e) =>
                                    satirGuncelle(satir.anahtar, {
                                      listeKod: e.target.value.toLocaleUpperCase("tr-TR").replace(/[^A-Z0-9._-]/g, ""),
                                    })
                                  }
                                  className="font-monospace fw-bold text-center"
                                  style={{ width: "72px", fontSize: "0.78rem" }}
                                />
                                <Form.Control
                                  size="sm"
                                  type="text"
                                  value={satir.baslik}
                                  disabled={mesgul}
                                  maxLength={200}
                                  placeholder="Listenin açıklaması (ör. Yeni MASAK listesi)"
                                  aria-label="Liste açıklaması"
                                  autoComplete="off"
                                  onChange={(e) => satirGuncelle(satir.anahtar, { baslik: e.target.value })}
                                  style={{ width: "300px", fontSize: "0.8rem" }}
                                />
                                {satir.yeni && (
                                  <Badge bg="warning" text="dark">
                                    Yeni
                                  </Badge>
                                )}
                              </span>
                          )}
                        </div>
                        <span className="d-flex align-items-center gap-2 text-nowrap">
                          <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                            {satir.yeni
                              ? "Henüz indirilmedi"
                              : `${masakSayi(satir.kayitSayisi)} kayıt${
                                  satir.sonGuncelleme ? ` · ${masakTarihSaat(satir.sonGuncelleme)}` : ""
                                }`}
                          </span>
                          {satir.ozel && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="py-0 px-1"
                              disabled={mesgul}
                              onClick={() => satirSil(satir)}
                              title={satir.yeni ? "Satırı kaldır" : "Listeyi ve kayıtlarını sil"}
                            >
                              {siliniyor ? (
                                <Spinner as="span" animation="border" size="sm" />
                              ) : (
                                <IconTrash size={14} />
                              )}
                            </Button>
                          )}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-1">
                        <Form.Control
                          size="sm"
                          type="text"
                          value={satir.url}
                          disabled={mesgul}
                          aria-label={`${masakKodEtiketi(satir.listeKod) || "Yeni"} liste adresi`}
                          autoComplete="off"
                          isInvalid={dokunuldu && satirHata !== null && !!satir.url.trim()}
                          onChange={(e) => satirGuncelle(satir.anahtar, { url: e.target.value })}
                          placeholder="https://ms.hmb.gov.tr/uploads/... .xlsx"
                          className="font-monospace"
                          style={{ fontSize: "0.74rem" }}
                        />
                      </div>

                      {satirHata && (satir.url.trim() || (satir.ozel && satir.listeKod.trim())) && (
                        <div className="text-danger mt-1" style={{ fontSize: "0.74rem" }}>
                          {satirHata}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="d-flex align-items-center gap-2">
                  <Button
                    variant="outline-success"
                    size="sm"
                    className="d-flex align-items-center gap-1"
                    onClick={yeniSatirEkle}
                    disabled={mesgul}
                  >
                    <IconPlus size={15} /> Yeni Liste Ekle
                  </Button>
                  <span className="text-muted" style={{ fontSize: "0.76rem" }}>
                    Adresler son girilen bağlantıyla dolu gelir; değiştirip güncellediğinizde yeni adres hatırlanır.
                  </span>
                </div>

                <div className="text-muted" style={{ fontSize: "0.76rem" }}>
                  <strong>Yeni Liste Ekle:</strong> MASAK sitesinde yeni bir liste yayımlanırsa (ör. <strong>D</strong>) buradan
                  kısa bir kod, açıklama ve listenin Excel adresini girerek ekleyebilirsiniz. Güncelle tuşuna basıldığında
                  liste indirilip kaydedilir; kod, açıklama ve adres sonraki açılışlarda hatırlanır. Güncellemek
                  istemediğiniz listelerin seçimini kaldırmanız yeterlidir.
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
                            {masakKodEtiketi(s.listeKod)}
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
                        <td className="py-1 px-2">{masakKodEtiketi(g.listeKod)}</td>
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
          disabled={mesgul}
          onClick={() => {
            onHide();
            navigate("/ayarlar/masak-dondurulanlar");
          }}
        >
          MASAK Sayfasına Git
        </Button>

        <div className="d-flex align-items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onHide} disabled={mesgul}>
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
