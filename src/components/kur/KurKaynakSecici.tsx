import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Form } from "react-bootstrap";
import { KurKaynakService, type KurKaynakBilgi } from "../../services/kurKaynakService";

/**
 * Firma Tanımları › Kur Kaynağı: Anlık Fiyat Listesi'nin hangi kaynaktan çekeceği (docs/KUR_KAYNAGI_YOL_HARITASI.md, K20).
 * Seçim firma bazında saklanır, varsayılan Merkez Bankası. Kayıt sayfanın Kaydet düğmesiyle.
 */

export interface KurKaynakSeciciRef {
  /** Seçim değiştiyse kaydeder */
  kaydet: () => Promise<boolean>;
}

const KurKaynakSecici = forwardRef<KurKaynakSeciciRef>((_props, ref) => {
  const [kaynaklar, setKaynaklar] = useState<KurKaynakBilgi[]>([]);
  const [secili, setSecili] = useState("tcmb");
  const [kayitli, setKayitli] = useState("tcmb");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    KurKaynakService.kaynaklar()
      .then((r) => {
        setKaynaklar(r.kaynaklar);
        setSecili(r.secili);
        setKayitli(r.secili);
      })
      .catch((e) => setHata(e?.message || "Kaynaklar yüklenemedi."));
  }, []);

  useImperativeHandle(ref, () => ({
    kaydet: async () => {
      if (secili === kayitli) return false;
      await KurKaynakService.seciliKaydet(secili);
      setKayitli(secili);
      return true;
    },
  }));

  return (
    <Form.Group className="mb-2">
      <Form.Label htmlFor="KUR_KAYNAGI" className="small fw-semibold text-secondary mb-1">
        Kurların çekileceği kaynak
      </Form.Label>
      <Form.Select
        id="KUR_KAYNAGI"
        size="sm"
        value={secili}
        onChange={(e) => setSecili(e.target.value)}
        disabled={kaynaklar.length === 0}
        style={{ maxWidth: 260 }}
      >
        {kaynaklar.length === 0 && <option value={secili}>Merkez Bankası</option>}
        {kaynaklar.map((k) => (
          <option key={k.kod} value={k.kod}>{k.ad}</option>
        ))}
      </Form.Select>
      {hata && <div className="small text-danger mt-1">{hata}</div>}
    </Form.Group>
  );
});

KurKaynakSecici.displayName = "KurKaynakSecici";
export default KurKaynakSecici;
