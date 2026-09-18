import React from "react";
import { Modal, Button, Table, Badge, Alert } from "react-bootstrap";
import { IconShieldCheck, IconShieldX, IconUserCheck, IconAlertTriangle } from "@tabler/icons-react";
import { MasakEslesme } from "../../services/masakService";

interface MasakSonucModalProps {
  show: boolean;
  onHide: () => void;
  queriedName?: string;
  queriedId?: string;
  matches: MasakEslesme[];
  searched: boolean;
  onOpenMasakManagement?: () => void;
}

export const MasakSonucModal: React.FC<MasakSonucModalProps> = ({
  show,
  onHide,
  queriedName,
  queriedId,
  matches,
  searched,
  onOpenMasakManagement,
}) => {
  const hasMatches = matches && matches.length > 0;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static" keyboard={true}>
      <Modal.Header closeButton className={hasMatches ? "bg-danger text-white py-2.5" : "bg-success text-white py-2.5"}>
        <Modal.Title className="d-flex align-items-center gap-2 fs-6 fw-bold">
          {hasMatches ? (
            <>
              <IconShieldX size={22} className="text-white" />
              <span>MASAK Malvarlığı Dondurulanlar Sorgu Uyarısı</span>
            </>
          ) : (
            <>
              <IconShieldCheck size={22} className="text-white" />
              <span>MASAK Malvarlığı Dondurulanlar Sorgulama Sonucu</span>
            </>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {/* Sorgulanan Bilgiler Özeti */}
        <div className="bg-light p-2.5 rounded-2 border mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-3">
            <div>
              <span className="text-muted small d-block">Sorgulanan İsim / Ünvan:</span>
              <strong className="text-dark">{queriedName || "—"}</strong>
            </div>
            {queriedId && (
              <div className="border-start ps-3">
                <span className="text-muted small d-block">Sorgulanan T.C. / VKN:</span>
                <strong className="font-monospace text-dark">{queriedId}</strong>
              </div>
            )}
          </div>
          <div>
            <Badge bg={hasMatches ? "danger" : "success"} className="px-2 py-1.5 fs-7">
              {hasMatches ? `${matches.length} EŞLEŞME TESPİT EDİLDİ` : "TEMİZ (KAYIT BULUNAMADI)"}
            </Badge>
          </div>
        </div>

        {/* Eşleşme Varsa */}
        {hasMatches ? (
          <div>
            <Alert variant="danger" className="d-flex align-items-start gap-2 py-2 px-3 mb-3 border-danger">
              <IconAlertTriangle size={24} className="text-danger flex-shrink-0 mt-0.5" />
              <div style={{ fontSize: "12.5px" }}>
                <strong>DİKKAT: YASAL YAPTIRIM / BLOKE LİSTESİNDE EŞLEŞME BULUNDU!</strong>
                <div className="mt-1 text-danger-emphasis">
                  Bu kişi / kuruluş Terörizmin Finansmanı veya Kitle İmha Silahları Malvarlığının Dondurulması (MASAK) listelerinde yer almaktadır. Mevzuat uyarınca işlem yapılması engellenmeli veya derhal Uyum Görevlisine / Yetkiliye bildirilmelidir.
                </div>
              </div>
            </Alert>

            <div className="table-responsive border rounded-2" style={{ maxHeight: "320px" }}>
              <Table size="sm" hover className="mb-0 align-middle" style={{ fontSize: "12px" }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th>#</th>
                    <th>Liste</th>
                    <th>Ad / Ünvan & Diğer İsimler</th>
                    <th>Kimlik / TCKN / VKN</th>
                    <th>Doğum Tarihi / Yeri</th>
                    <th>Örgüt / Gerekçe</th>
                    <th>Eşleşme</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, idx) => (
                    <tr key={m.masakId || idx} className="table-danger">
                      <td className="text-muted fw-bold">{idx + 1}</td>
                      <td>
                        <Badge bg="dark" className="font-monospace">{m.listeKod}</Badge>
                      </td>
                      <td>
                        <div className="fw-bold text-danger">{m.adUnvan}</div>
                        {m.digerIsimler && (
                          <div className="text-muted small" style={{ fontSize: "11px" }}>
                            Diğer: {m.digerIsimler}
                          </div>
                        )}
                        {m.orijinalAd && (
                          <div className="text-muted small" style={{ fontSize: "11px" }}>
                            Orijinal: {m.orijinalAd}
                          </div>
                        )}
                      </td>
                      <td className="font-monospace">
                        {m.tckn || m.vkn || m.kimlikNo || "—"}
                      </td>
                      <td>
                        <div>{m.dogumTarihi || "—"}</div>
                        {m.dogumYeri && <div className="text-muted small">{m.dogumYeri}</div>}
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: "160px" }} title={m.orgut || m.kararBilgi || ""}>
                          {m.orgut || m.kararBilgi || "—"}
                        </div>
                      </td>
                      <td>
                        <Badge bg={m.skor >= 90 ? "danger" : "warning"} className="font-monospace">
                          %{m.skor} ({m.eslesmeTipi})
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
          /* Eşleşme Yoksa (Temiz) */
          <div className="text-center py-4">
            <div className="d-inline-flex p-3 rounded-circle bg-success-subtle text-success mb-3">
              <IconUserCheck size={48} />
            </div>
            <h6 className="fw-bold text-success mb-1">MASAK Kayıtlarında Herhangi Bir Eşleşme Bulunamadı</h6>
            <p className="text-muted small mb-0 px-4">
              Sorgulanan isim ve kimlik numarası TODVZ_MASAK_LISTE (A, B, C, 3AB) ve güncel malvarlığı dondurulanlar listesinde temizdir. Fiş işleminize mevzuata uygun şekilde devam edebilirsiniz.
            </p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
        <div>
          {onOpenMasakManagement && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                onHide();
                onOpenMasakManagement();
              }}
            >
              MASAK Listelerini Yönet
            </Button>
          )}
        </div>
        <Button variant={hasMatches ? "danger" : "secondary"} size="sm" onClick={onHide} className="px-4 fw-semibold">
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
