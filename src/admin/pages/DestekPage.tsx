import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { adminApi, AdminDto, DestekKonuFiltresi } from "../services/adminApi";
import AdminKonuSohbet from "../components/AdminKonuSohbet";
import { DURUM_ADI, DURUM_RENGI, KonuOzet, konuEtiketi, zamanOnce } from "../../components/destek/destekOrtak";
import "../../components/destek/destek.scss";

const SAYFA_BOYU = 50;

/** Panel > Destek: talepler ve sistem kayıtları (K12). Solda filtreli liste, sağda sohbet. */
const DestekPage: React.FC = () => {
  const [arama, setArama] = useSearchParams();
  const seciliId = Number(arama.get("konu")) || null;
  const kaynakId = Number(arama.get("kaynak")) || undefined;
  const [tur, setTur] = useState<"TALEP_SISTEM" | "TALEP" | "SISTEM">("TALEP_SISTEM");
  const [durum, setDurum] = useState<string>("ACIK_HEPSI");
  const [metinArama, setMetinArama] = useState("");
  const [firmaId, setFirmaId] = useState<number | undefined>(undefined);
  const [sayfa, setSayfa] = useState(1);
  const [satirlar, setSatirlar] = useState<KonuOzet[]>([]);
  const [toplam, setToplam] = useState(0);
  const [kurulu, setKurulu] = useState(true);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [firmalar, setFirmalar] = useState<{ firmaId: number; unvan: string; firmaKodu: string }[]>([]);
  const [adminler, setAdminler] = useState<AdminDto[]>([]);

  useEffect(() => {
    adminApi.bildirimHedefleri().then((h) => setFirmalar(h.firmalar)).catch(() => undefined);
    adminApi.adminler().then((a) => setAdminler(a.adminler.filter((x) => x.durum === "AKTIF"))).catch(() => undefined);
  }, []);

  const yukle = useCallback(
    async (sessiz = false) => {
      if (!sessiz) setYukleniyor(true);
      const f: DestekKonuFiltresi = { tur, sayfa, sayfaBoyu: SAYFA_BOYU };
      if (durum !== "HEPSI") f.durum = durum;
      if (metinArama.trim()) f.arama = metinArama.trim();
      if (firmaId) f.firmaId = firmaId;
      if (kaynakId) f.kaynakKonuId = kaynakId;
      try {
        const s = await adminApi.destekKonular(f);
        setSatirlar(s.satirlar);
        setToplam(s.toplam);
        setKurulu(s.kurulu);
        setHata(null);
      } catch (err: any) {
        setHata(err?.message || "Liste okunamadı.");
      } finally {
        setYukleniyor(false);
      }
    },
    [tur, durum, metinArama, firmaId, sayfa, kaynakId]
  );

  useEffect(() => {
    yukle();
  }, [yukle]);

  useEffect(() => {
    const z = setInterval(() => document.visibilityState === "visible" && yukle(true), 30_000);
    return () => clearInterval(z);
  }, [yukle]);

  const sec = (k: KonuOzet) => {
    const yeni = new URLSearchParams(arama);
    yeni.set("konu", String(k.konuId));
    setArama(yeni);
  };
  const sohbetDegisti = useCallback(() => yukle(true), [yukle]);
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h5 className="mb-0">Destek</h5>
            <small className="text-muted">{toplam} kayıt{kaynakId ? ` · #${kaynakId} bildirimine yanıtlar` : ""}</small>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Form.Control size="sm" style={{ width: 220 }} placeholder="Başlık, firma, kullanıcı…" value={metinArama} onChange={(e) => { setMetinArama(e.target.value); setSayfa(1); }} />
            <Form.Select size="sm" style={{ width: 150 }} value={tur} onChange={(e) => { setTur(e.target.value as typeof tur); setSayfa(1); }}>
              <option value="TALEP_SISTEM">Talep + Sistem</option>
              <option value="TALEP">Yalnız talepler</option>
              <option value="SISTEM">Yalnız sistem</option>
            </Form.Select>
            <Form.Select size="sm" style={{ width: 160 }} value={durum} onChange={(e) => { setDurum(e.target.value); setSayfa(1); }}>
              <option value="ACIK_HEPSI">Kapalı olmayanlar</option>
              <option value="HEPSI">Tüm durumlar</option>
              <option value="ACIK">Açık</option>
              <option value="KULLANICI_YANITLADI">Kullanıcı yanıtladı</option>
              <option value="CEVAPLANDI">Cevaplandı</option>
              <option value="KAPALI">Kapalı</option>
            </Form.Select>
            <Form.Select size="sm" style={{ width: 200 }} value={firmaId ?? ""} onChange={(e) => { setFirmaId(e.target.value ? Number(e.target.value) : undefined); setSayfa(1); }}>
              <option value="">Tüm firmalar</option>
              {firmalar.map((f) => (
                <option key={f.firmaId} value={f.firmaId}>
                  {f.unvan} ({f.firmaKodu})
                </option>
              ))}
            </Form.Select>
            <Button size="sm" variant="outline-secondary" onClick={() => yukle()} title="Yenile">
              <IconRefresh size={16} />
            </Button>
          </div>
        </div>

        {!kurulu && <Alert variant="warning">Destek tabloları kurulu değil. Sunucuda docs/sql/LIKYA_ADMIN_DESTEK.sql çalıştırılmalı.</Alert>}
        {hata && <Alert variant="danger">{hata}</Alert>}

        <div className="destek-sayfa" style={{ height: "calc(100vh - 230px)" }}>
          <div className="destek-sol">
            {yukleniyor && satirlar.length === 0 ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="sm" />
              </div>
            ) : satirlar.length === 0 ? (
              <div className="text-center text-muted small py-5">Kayıt yok.</div>
            ) : (
              <div className="destek-liste">
                {satirlar.map((k) => (
                  <div
                    key={k.konuId}
                    role="button"
                    tabIndex={0}
                    className={`destek-satir${k.okunmamis ? " okunmamis" : ""}${seciliId === k.konuId ? " secili" : ""}`}
                    onClick={() => sec(k)}
                    onKeyDown={(e) => e.key === "Enter" && sec(k)}
                  >
                    <div className="destek-govde">
                      <div className="destek-baslik" title={k.baslik}>
                        {k.baslik}
                      </div>
                      <div className="destek-ozet">
                        {k.firmaUnvan || "-"}
                        {k.kullaniciAdi ? ` · ${k.kullaniciAdi}` : ""}
                      </div>
                      {k.sonMesaj && (
                        <div className="destek-ozet">
                          {k.sonMesajTaraf === "ADMIN" ? "Siz: " : ""}
                          {k.sonMesaj}
                        </div>
                      )}
                      <div className="destek-alt">
                        <span>{konuEtiketi(k)}</span>
                        <Badge bg={DURUM_RENGI[k.durum]} className="fw-normal">
                          {DURUM_ADI[k.durum]}
                        </Badge>
                        {k.oncelik === "ACIL" && k.tur === "TALEP" && (
                          <Badge bg="danger" className="fw-normal">
                            Acil
                          </Badge>
                        )}
                        {k.atananAdmin && <span title="Atanan">→ {k.atananAdmin}</span>}
                        <span className="ms-auto">{zamanOnce(k.sonMesajTarihi)}</span>
                      </div>
                    </div>
                    {k.okunmamis && <div className="destek-nokta" />}
                  </div>
                ))}
              </div>
            )}
            {sayfaSayisi > 1 && (
              <div className="d-flex justify-content-between align-items-center p-2 border-top small">
                <Button size="sm" variant="outline-secondary" disabled={sayfa <= 1} onClick={() => setSayfa(sayfa - 1)}>
                  Önceki
                </Button>
                <span>
                  {sayfa} / {sayfaSayisi}
                </span>
                <Button size="sm" variant="outline-secondary" disabled={sayfa >= sayfaSayisi} onClick={() => setSayfa(sayfa + 1)}>
                  Sonraki
                </Button>
              </div>
            )}
          </div>
          <div className="destek-sag">
            {seciliId ? (
              <AdminKonuSohbet key={seciliId} konuId={seciliId} adminler={adminler} onDegisti={sohbetDegisti} />
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted py-5">Soldan bir kayıt seçin.</div>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default DestekPage;
