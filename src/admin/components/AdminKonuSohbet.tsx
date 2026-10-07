import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { IconLockOpen, IconLock, IconSend } from "@tabler/icons-react";
import { adminApi, AdminDto, DestekKonuDetay } from "../services/adminApi";
import { MesajBalonu } from "../../components/destek/MesajBalonu";
import { DURUM_ADI, DURUM_RENGI, konuEtiketi, zamanYaz } from "../../components/destek/destekOrtak";

const TAZELEME_MS = 10_000; // K13
export const ADMIN_DESTEK_DEGISTI = "likya-admin-destek-degisti";
const degisti = () => window.dispatchEvent(new Event(ADMIN_DESTEK_DEGISTI));

interface Props {
  konuId: number;
  adminler: AdminDto[];
  onDegisti?: () => void;
}

/** Admin tarafı sohbet (K12, K16): cevap, iç not, atama, kapat / yeniden aç. Bildirimler burada yalnız okunur. */
const AdminKonuSohbet: React.FC<Props> = ({ konuId, adminler, onDegisti }) => {
  const [detay, setDetay] = useState<DestekKonuDetay | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [metin, setMetin] = useState("");
  const [icNot, setIcNot] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const altRef = useRef<HTMLDivElement>(null);
  // Yalnız mesaj kutusu kayar; sayfa (pencere) yerinden oynamaz
  const altaKaydir = () => {
    const kutu = altRef.current?.parentElement;
    if (kutu) kutu.scrollTop = kutu.scrollHeight;
  };
  const sonMesajId = useRef(0);

  const uygula = useCallback(
    (d: DestekKonuDetay) => {
      setDetay(d);
      const son = d.mesajlar[d.mesajlar.length - 1]?.mesajId ?? 0;
      if (son !== sonMesajId.current) {
        sonMesajId.current = son;
        setTimeout(() => altaKaydir(), 30);
      }
      onDegisti?.();
      degisti();
    },
    [onDegisti]
  );

  const yukle = useCallback(
    async (sessiz = false) => {
      if (!sessiz) setYukleniyor(true);
      try {
        uygula(await adminApi.destekKonu(konuId));
        setHata(null);
      } catch (err: any) {
        if (!sessiz) setHata(err?.message || "Kayıt okunamadı.");
      } finally {
        if (!sessiz) setYukleniyor(false);
      }
    },
    [konuId, uygula]
  );

  useEffect(() => {
    sonMesajId.current = 0;
    setMetin("");
    setIcNot(false);
    yukle();
    const z = setInterval(() => document.visibilityState === "visible" && yukle(true), TAZELEME_MS);
    return () => clearInterval(z);
  }, [yukle]);

  const gonder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!metin.trim()) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      uygula(await adminApi.destekMesajYaz(konuId, metin.trim(), icNot));
      setMetin("");
    } catch (err: any) {
      setHata(err?.message || "Mesaj gönderilemedi.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const guncelle = async (veri: { durum?: "KAPALI" | "ACIK"; atananAdminId?: number | null }) => {
    setHata(null);
    try {
      uygula(await adminApi.destekKonuGuncelle(konuId, veri));
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    }
  };

  if (yukleniyor && !detay) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 py-5">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }
  if (!detay) return <Alert variant="danger">{hata || "Kayıt bulunamadı."}</Alert>;

  const k = detay.konu;
  const talepGibi = k.tur !== "BILDIRIM";

  return (
    <div className="destek-sohbet">
      <div className="destek-sohbet-ust">
        <div className="d-flex align-items-start gap-2 flex-wrap">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate" title={k.baslik}>
              {k.baslik}
            </div>
            <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
              <span>{konuEtiketi(k)}</span>
              <Badge bg={DURUM_RENGI[k.durum]}>{DURUM_ADI[k.durum]}</Badge>
              {k.tur === "TALEP" && k.oncelik === "ACIL" && <Badge bg="danger">Acil</Badge>}
              {k.firmaId && (
                <Link to={`/firmalar/${k.firmaId}`} className="text-decoration-none">
                  {k.firmaUnvan} <span className="text-muted">({k.firmaKodu})</span>
                </Link>
              )}
              {k.kullaniciAdi && <span>· {k.kullaniciAdi}</span>}
              <span>· {zamanYaz(k.olusturmaTarihi)}</span>
              {k.ekran && <span className="text-muted">· ekran: {k.ekran}</span>}
              {k.kaynakKonuId && <span className="text-muted">· bildirim #{k.kaynakKonuId} yanıtı</span>}
            </div>
          </div>
          {talepGibi && (
            <div className="d-flex align-items-center gap-2">
              <Form.Select
                size="sm"
                style={{ width: 170 }}
                value={k.atananAdminId ?? ""}
                onChange={(e) => guncelle({ atananAdminId: e.target.value ? Number(e.target.value) : null })}
                title="Atanan admin"
              >
                <option value="">Atanmadı</option>
                {adminler.map((a) => (
                  <option key={a.adminId} value={a.adminId}>
                    {a.adSoyad}
                  </option>
                ))}
              </Form.Select>
              {k.durum === "KAPALI" ? (
                <Button size="sm" variant="outline-secondary" onClick={() => guncelle({ durum: "ACIK" })}>
                  <IconLockOpen size={16} className="me-1" />
                  Yeniden aç
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => window.confirm("Kayıt kapatılsın mı? Eklenen görseller sunucudan silinir.") && guncelle({ durum: "KAPALI" })}
                >
                  <IconLock size={16} className="me-1" />
                  Kapat
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="destek-mesajlar">
        {detay.mesajlar.map((m) => (
          <MesajBalonu key={m.mesajId} m={m} benimTaraf="ADMIN" adres={adminApi.destekEkAdresi} />
        ))}
        <div ref={altRef} />
      </div>

      {hata && (
        <Alert variant="danger" className="py-1 px-3 small m-2 mb-0">
          {hata}
        </Alert>
      )}

      {talepGibi ? (
        <Form className="destek-yaz" onSubmit={gonder}>
          <Form.Control
            as="textarea"
            rows={2}
            maxLength={4000}
            placeholder={icNot ? "İç not (kullanıcı görmez)…" : "Cevabınız…"}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gonder();
            }}
            disabled={gonderiliyor}
            className={icNot ? "bg-warning-subtle" : ""}
          />
          <div className="d-flex align-items-center gap-3 mt-2">
            <Form.Check type="switch" id={`icnot-${konuId}`} label="İç not" checked={icNot} onChange={(e) => setIcNot(e.target.checked)} />
            <span className="small text-muted ms-auto">Ctrl+Enter gönderir</span>
            <Button size="sm" variant={icNot ? "warning" : "primary"} type="submit" disabled={gonderiliyor || !metin.trim()}>
              {gonderiliyor ? <Spinner size="sm" /> : <IconSend size={16} />}
              <span className="ms-1">{icNot ? "Not ekle" : "Cevapla"}</span>
            </Button>
          </div>
        </Form>
      ) : (
        <div className="destek-yaz small text-muted">
          {k.hedef === "TUMU" ? "Hedef: tüm firmalar" : `Hedef: ${detay.hedefler?.map((h) => h.kullaniciAdi ? `${h.unvan} / ${h.kullaniciAdi}` : h.unvan).join(", ") || "-"}`}
          {typeof detay.yanitSayisi === "number" && detay.yanitSayisi > 0 && (
            <>
              {" · "}
              <Link to={`/destek?kaynak=${k.konuId}`}>{detay.yanitSayisi} yanıt talebi</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminKonuSohbet;
