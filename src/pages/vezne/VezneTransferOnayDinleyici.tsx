import React, { useEffect, useState, useCallback, useRef } from "react";
import { Modal, Button, Table, Badge, Spinner, Alert } from "react-bootstrap";
import { IconCheck, IconX, IconArrowsExchange } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import {
  VezneTransferiService,
  VezneTransferOnayItem,
} from "../../services/vezneTransferiService";
import { notifyVezneBakiyeChanged } from "../../services/vezneSyncService";

/**
 * 1) Onay verecek veznenin kullanıcılarında bekleyen Vezne Transferi taleplerini popup olarak açar.
 *    Aynı vezneden herhangi biri onay/red verince diğer kullanıcıların ekranından otomatik kalkar.
 * 2) İstek gönderen kullanıcıda red/kabul sonucu geldiğinde hangi kayıt olduğu ve içeriğiyle birlikte
 *    sonuç modalını gösterir; kullanıcı Tamam'a basınca kapanır.
 */
export const VezneTransferOnayDinleyici: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [pendingQueue, setPendingQueue] = useState<VezneTransferOnayItem[]>([]);
  const [resultQueue, setResultQueue] = useState<VezneTransferOnayItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activePendingIdRef = useRef<number | null>(null);
  const activeResultIdRef = useRef<number | null>(null);

  const activePending = pendingQueue.length > 0 ? pendingQueue[0] : null;
  const activeResult = !activePending && resultQueue.length > 0 ? resultQueue[0] : null;
  activePendingIdRef.current = activePending?.onayId ?? null;
  activeResultIdRef.current = activeResult?.onayId ?? null;

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const [pendingList, resultList] = await Promise.all([
          VezneTransferiService.getPendingApprovals().catch(() => []),
          VezneTransferiService.getUnseenApprovalResults().catch(() => []),
        ]);
        if (cancelled) return;

        setPendingQueue((prev) => {
          if (pendingList.length === 0) return prev.length === 0 ? prev : [];
          if (activePendingIdRef.current) {
            const cur = pendingList.find((x) => x.onayId === activePendingIdRef.current);
            if (cur) {
              return [cur, ...pendingList.filter((x) => x.onayId !== cur.onayId)];
            }
          }
          return pendingList;
        });

        setResultQueue((prev) => {
          if (resultList.length === 0) return prev.length === 0 ? prev : [];
          if (activeResultIdRef.current) {
            const cur = resultList.find((x) => x.onayId === activeResultIdRef.current);
            if (cur) {
              return [cur, ...resultList.filter((x) => x.onayId !== cur.onayId)];
            }
          }
          return resultList;
        });
      } catch {
        // sessiz
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, user?.id]);

  const handleDecision = useCallback(
    async (karar: "ONAYLANDI" | "REDDEDILDI") => {
      if (!activePending || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await VezneTransferiService.decideApproval(activePending.onayId, karar);
        setPendingQueue((prev) => prev.filter((x) => x.onayId !== activePending.onayId));
      } catch (err: any) {
        setError(err?.message || "İşlem onaylanırken hata oluştu.");
      } finally {
        setSubmitting(false);
      }
    },
    [activePending, submitting]
  );

  const handleAcknowledgeResult = useCallback(async () => {
    if (!activeResult || submitting) return;
    setSubmitting(true);
    try {
      await VezneTransferiService.markApprovalResultSeen(activeResult.onayId);
      if (activeResult.durum === "ONAYLANDI") {
        notifyVezneBakiyeChanged({ type: "transfer" });
      }
      setResultQueue((prev) => prev.filter((x) => x.onayId !== activeResult.onayId));
    } catch {
      setResultQueue((prev) => prev.filter((x) => x.onayId !== activeResult.onayId));
    } finally {
      setSubmitting(false);
    }
  }, [activeResult, submitting]);

  // 1) Onaylayıcı Popup (Kabul / Red)
  if (activePending) {
    return (
      <Modal show={true} backdrop="static" keyboard={false} centered>
        <Modal.Header className="bg-primary-subtle border-primary py-2">
          <Modal.Title className="fs-6 fw-bold text-primary d-flex align-items-center gap-2">
            <IconArrowsExchange size={20} />
            Vezne Transferi İşlem İzni
            <Badge bg={activePending.islemTipi === "DUZELTME" ? "warning" : "primary"} className="ms-1">
              {activePending.islemTipi === "DUZELTME" ? "Düzeltme" : "Yeni Kayıt"}
            </Badge>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          {error && (
            <Alert variant="danger" className="py-2 px-3 small mb-2">
              {error}
            </Alert>
          )}

          <div className="p-2 bg-light rounded border mb-2 small">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Talep Eden:</span>
              <strong className="text-dark">{activePending.talepEdenAd}</strong>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Tarih:</span>
              <strong className="font-monospace">{activePending.tarih}</strong>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Veren Vezne:</span>
              <strong className="text-danger">{activePending.verenVezneAd}</strong>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Alan Vezne:</span>
              <strong className="text-success">{activePending.alanVezneAd}</strong>
            </div>
            {activePending.aciklama && (
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Açıklama:</span>
                <span className="text-dark text-end">{activePending.aciklama}</span>
              </div>
            )}
          </div>

          <Table size="sm" bordered className="mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th>Para Birimi</th>
                <th className="text-end" style={{ width: "140px" }}>Miktar</th>
              </tr>
            </thead>
            <tbody>
              {(activePending.satirlar || []).map((s, idx) => (
                <tr key={idx}>
                  <td className="fw-semibold">
                    {s.paraKodu ? `${s.paraKodu} - ${s.paraAdi || ""}` : `#${s.paraId}`}
                  </td>
                  <td className="text-end font-monospace fw-bold">
                    {Number(s.miktar || 0).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer className="py-2 d-flex justify-content-between">
          <Button
            variant="danger"
            size="sm"
            disabled={submitting}
            onClick={() => void handleDecision("REDDEDILDI")}
            className="d-inline-flex align-items-center gap-1 px-3 fw-semibold"
          >
            {submitting ? <Spinner animation="border" size="sm" /> : <IconX size={16} />} Reddet
          </Button>
          <Button
            variant="success"
            size="sm"
            disabled={submitting}
            onClick={() => void handleDecision("ONAYLANDI")}
            className="d-inline-flex align-items-center gap-1 px-3 fw-semibold"
          >
            {submitting ? <Spinner animation="border" size="sm" /> : <IconCheck size={16} />} Kabul Et &amp; Kaydet
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  // 2) Talep Eden Kullanıcı İçin Sonuç Popup'ı (Kabul / Red + Kayıt Detayı)
  if (activeResult) {
    const isApproved = activeResult.durum === "ONAYLANDI";
    return (
      <Modal show={true} backdrop="static" keyboard={false} centered>
        <Modal.Header
          className={`py-2 ${
            isApproved ? "bg-success-subtle border-success" : "bg-danger-subtle border-danger"
          }`}
        >
          <Modal.Title
            className={`fs-6 fw-bold d-flex align-items-center gap-2 ${
              isApproved ? "text-success" : "text-danger"
            }`}
          >
            {isApproved ? <IconCheck size={20} /> : <IconX size={20} />}
            {isApproved ? "Vezne Transferi Kabul Edildi" : "Vezne Transferi Reddedildi"}
            <Badge bg={activeResult.islemTipi === "DUZELTME" ? "warning" : "secondary"} className="ms-1">
              {activeResult.islemTipi === "DUZELTME" ? "Düzeltme" : "Yeni Kayıt"}
            </Badge>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <Alert variant={isApproved ? "success" : "danger"} className="py-2 px-3 small mb-2 fw-semibold">
            {isApproved
              ? `Talebiniz ${activeResult.kararVerenAd || "yetkili"} tarafından KABUL EDİLDİ ve kaydedildi.${
                  activeResult.transferId ? ` (Kayıt No: #${activeResult.transferId})` : ""
                }`
              : `Talebiniz ${activeResult.kararVerenAd || "yetkili"} tarafından REDDEDİLDİ. Kayıt yapılmadı.`}
          </Alert>

          <div className="p-2 bg-light rounded border mb-2 small">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Tarih:</span>
              <strong className="font-monospace">{activeResult.tarih}</strong>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Veren Vezne:</span>
              <strong className="text-danger">{activeResult.verenVezneAd}</strong>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-secondary">Alan Vezne:</span>
              <strong className="text-success">{activeResult.alanVezneAd}</strong>
            </div>
            {activeResult.aciklama && (
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Açıklama:</span>
                <span className="text-dark text-end">{activeResult.aciklama}</span>
              </div>
            )}
          </div>

          <Table size="sm" bordered className="mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th>Para Birimi</th>
                <th className="text-end" style={{ width: "140px" }}>Miktar</th>
              </tr>
            </thead>
            <tbody>
              {(activeResult.satirlar || []).map((s, idx) => (
                <tr key={idx}>
                  <td className="fw-semibold">
                    {s.paraKodu ? `${s.paraKodu} - ${s.paraAdi || ""}` : `#${s.paraId}`}
                  </td>
                  <td className="text-end font-monospace fw-bold">
                    {Number(s.miktar || 0).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer className="py-2 justify-content-end">
          <Button
            variant={isApproved ? "success" : "danger"}
            size="sm"
            disabled={submitting}
            autoFocus
            onClick={() => void handleAcknowledgeResult()}
            className="px-4 fw-semibold"
          >
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return null;
};

export default VezneTransferOnayDinleyici;
