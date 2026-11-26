import React, { useEffect, useState } from "react";
import { Button, Form, InputGroup, Spinner } from "react-bootstrap";
import { adminApi, FirmaDto, LisansDto } from "../services/adminApi";

/**
 * Restorant başlığının firmaya özel adı (26.11.2026, karar R4): firmanın kullanıcı uygulamasındaki sol menüde Restorant başlığı bu adla
 * görünür ("Kafe", "Lokanta", "Pastane" …). Boş = "Restorant". Etkin lisansta yeni lisans yazmadan değiştirilir; kullanıcılar bir sonraki
 * girişte / sayfa yenilemede yeni adı görür.
 */
export default function FirmaRestoranAdi({ firma, lisanslar, onGuncel }: {
  firma: FirmaDto;
  lisanslar: LisansDto[];
  onGuncel: (s: { firma: FirmaDto; lisanslar: LisansDto[] }) => void;
}) {
  const aktif = lisanslar.find((l) => l.aktif) || null;
  const [ad, setAd] = useState(aktif?.restoranAdi ?? "");
  const [mesgul, setMesgul] = useState(false);
  const [ileti, setIleti] = useState<{ tur: "ok" | "hata"; metin: string } | null>(null);
  useEffect(() => { setAd(aktif?.restoranAdi ?? ""); }, [aktif?.lisansId, aktif?.restoranAdi]);
  if (!aktif) return null;
  const degisti = ad.trim() !== (aktif.restoranAdi ?? "");
  const kaydet = async () => {
    setMesgul(true); setIleti(null);
    try {
      const s = await adminApi.restoranAdi(firma.firmaId, ad.trim() || null);
      onGuncel(s);
      setIleti({ tur: "ok", metin: `Kaydedildi: menüde "${s.lisanslar.find((l) => l.aktif)?.restoranAdi || "Restorant"}" görünecek.` });
    } catch (e: any) {
      setIleti({ tur: "hata", metin: e?.message || "Kaydedilemedi." });
    } finally { setMesgul(false); }
  };
  return (
    <div className="border rounded p-2 mb-3" style={{ background: "#fafaf9" }} aria-label="Restorant başlık adı">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <Form.Label htmlFor="restoranAdi" className="mb-0 fw-semibold small">Restorant başlık adı</Form.Label>
        <InputGroup size="sm" style={{ maxWidth: 360 }}>
          <Form.Control id="restoranAdi" maxLength={40} placeholder="Restorant" value={ad} onChange={(e) => setAd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && degisti && !mesgul) void kaydet(); }} />
          <Button className="btn-adm" disabled={!degisti || mesgul} onClick={() => void kaydet()}>{mesgul ? <Spinner size="sm" /> : "Kaydet"}</Button>
        </InputGroup>
        <span className="small text-muted">Kullanıcı uygulamasında sol menüdeki Restorant başlığı (ör. Kafe, Lokanta). Boş = "Restorant".</span>
      </div>
      {ileti && <div className={`small mt-1 ${ileti.tur === "ok" ? "text-success" : "text-danger"}`}>{ileti.metin}</div>}
    </div>
  );
}
