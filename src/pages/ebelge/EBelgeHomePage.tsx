import React, { useCallback, useEffect, useState } from "react";
import { Badge, Card, Col, Row, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  IconFileCertificate,
  IconInbox,
  IconSend,
  IconSettings,
  IconFileCheck,
  IconTruckDelivery,
  IconCircleCheck,
  IconCircleX,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import { EbelgeAyar, ebelgeService } from "../../services/ebelgeService";

/**
 * e-Belge ana sayfası (hub).
 *
 * Sol menüye dal eklemek yerine bu sayfa kullanılıyor (docs/ice-baglanti.md karar #14):
 * üst şeritteki "E- Belge" bağlantısı buraya geliyor, alt ekranlara geçiş buradaki kartlardan.
 */

interface ModulKarti {
  baslik: string;
  aciklama: string;
  ikon: React.ReactNode;
  yol: string;
  hazir: boolean;
}

const KARTLAR: ModulKarti[] = [
  {
    baslik: "Gelen Kutusu",
    aciklama: "Firmanıza gelen e-Faturaları görüntüleyin, kabul veya red cevabı verin.",
    ikon: <IconInbox size={26} />,
    yol: "/e-belge/gelen",
    hazir: true,
  },
  {
    baslik: "Belge Doğrulama",
    aciklama: "UBL üretin ve doğrulayın. Ayrı onayla e-Fatura taslağı oluşturun veya gerçek e-Arşiv faturası gönderin.",
    ikon: <IconFileCheck size={26} />,
    yol: "/e-belge/dogrula",
    hazir: true,
  },
  {
    baslik: "Giden Kutusu",
    aciklama: "e-Fatura taslakları ve e-Arşiv belgeleri; durum, PDF ve iptal işlemleri. e-Arşiv iptali mali sonuç doğurur.",
    ikon: <IconSend size={26} />,
    yol: "/e-belge/giden",
    hazir: true,
  },
  {
    baslik: "e-İrsaliye",
    aciklama: "Sevk irsaliyesi düzenleyin — doğrulayın, GİB'e gönderin. İrsaliyede tutar yoktur.",
    ikon: <IconTruckDelivery size={26} />,
    yol: "/e-belge/irsaliye",
    hazir: true,
  },
  {
    baslik: "Bağlantı Ayarları",
    aciklama: "Entegratör (ICE Teknoloji) bağlantı bilgileri, bağlantı testi ve kontör durumu.",
    ikon: <IconSettings size={26} />,
    yol: "/ayarlar/e-belge",
    hazir: true,
  },
];

const EBelgeHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [ayar, setAyar] = useState<EbelgeAyar | null>(null);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);

  const durumYukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setAyar(await ebelgeService.getAyar());
    } catch {
      setAyar(null);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    durumYukle();
  }, [durumYukle]);

  const baglantiHazir = Boolean(ayar?.aktif && ayar?.sifreTanimli && ayar?.kullaniciAdi);

  return (
    <div className="ebelge-home-container container-fluid px-2 py-2">
      <ERPToolbar
        pageTitle="E- Belge"
        pageIcon={<IconFileCertificate size={22} className="text-primary" />}
        onRefresh={durumYukle}
        disabled={yukleniyor}
      />

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Entegratör Durumu
            </span>

            {yukleniyor ? (
              <Spinner animation="border" size="sm" />
            ) : baglantiHazir ? (
              <span className="d-flex align-items-center gap-1 small">
                <IconCircleCheck size={16} style={{ color: "#22c55e" }} />
                Bağlantı tanımlı ve aktif
                <Badge bg="secondary-subtle" text="secondary" className="ms-1">
                  {ayar?.ortam}
                </Badge>
              </span>
            ) : (
              <span className="d-flex align-items-center gap-1 small">
                <IconCircleX size={16} style={{ color: "#dc2626" }} />
                Bağlantı henüz yapılandırılmadı — Bağlantı Ayarları ekranından tanımlayınız.
              </span>
            )}

            {ayar?.firmaVkn && (
              <span className="text-secondary small ms-auto font-monospace">VKN: {ayar.firmaVkn}</span>
            )}
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3">
        {KARTLAR.map((kart) => (
          <Col xs={12} md={6} xl={4} key={kart.yol}>
            <Card
              className="shadow-sm border border-secondary-subtle rounded-3 h-100"
              role={kart.hazir ? "button" : undefined}
              onClick={kart.hazir ? () => navigate(kart.yol) : undefined}
              style={kart.hazir ? undefined : { opacity: 0.65 }}
            >
              <Card.Body className="p-3 bg-body d-flex flex-column">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ color: "#0284c7" }}>{kart.ikon}</span>
                  <span className="fw-semibold" style={{ fontSize: "14px" }}>
                    {kart.baslik}
                  </span>
                  {!kart.hazir && (
                    <Badge bg="warning-subtle" text="warning" className="ms-auto">
                      Hazırlanıyor
                    </Badge>
                  )}
                </div>
                <div className="text-secondary small">{kart.aciklama}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default EBelgeHomePage;
