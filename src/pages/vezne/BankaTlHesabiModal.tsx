import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal, Button, Table, Form, InputGroup, Alert, Badge } from "react-bootstrap";
import { BankaService, BankaHesapItem } from "../../services/bankaService";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import {
  IconBuildingBank,
  IconTrash,
  IconCheck,
  IconArrowDownLeft,
  IconInfoCircle,
  IconBinoculars,
  IconAlertCircle,
  IconPlus,
  IconCash,
  IconRefresh,
} from "@tabler/icons-react";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";

export interface BankaDagitimSatiri {
  id: string; // unique key for UI
  bankaId: number;
  hesapNo?: string;
  hesapAdi?: string;
  bankaAdi: string;
  iban?: string;
  tutar: number;
  aciklama: string;
}

export interface BankaTlHesabiApplyPayload {
  bankaSatirlari: Array<{
    bankaId: number;
    bankaAdi: string;
    hesapNo?: string;
    iban?: string;
    tutar: number;
    aciklama: string;
  }>;
  vezneTutari: number;
  vezneId?: number | null;
  vezneKodu?: string | null;
  vezneAdi?: string | null;
  bankaAciklama: string;
}

interface BankaTlHesabiModalProps {
  show: boolean;
  onClose: () => void;
  toplamTutar: number;
  islemTipi?: "tahsilat" | "odeme";
  initialBankaSatirlari?: Array<{
    bankaId: number;
    bankaAdi?: string;
    hesapNo?: string;
    iban?: string;
    tutar: number;
    aciklama?: string;
  }>;
  initialVezneTutari?: number;
  initialVezneId?: number | null;
  initialBankaAciklama?: string;
  currentVezneId?: number | null;
  currentVezneKod?: string;
  currentVezneAd?: string;
  onApply: (data: BankaTlHesabiApplyPayload) => void;
}

export const BankaTlHesabiModal: React.FC<BankaTlHesabiModalProps> = ({
  show,
  onClose,
  toplamTutar,
  islemTipi = "tahsilat",
  initialBankaSatirlari,
  initialVezneTutari = 0,
  initialVezneId,
  initialBankaAciklama = "",
  currentVezneId,
  currentVezneKod,
  currentVezneAd,
  onApply,
}) => {
  const [bankalar, setBankalar] = useState<BankaHesapItem[]>([]);
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [seciliVezneId, setSeciliVezneId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<BankaDagitimSatiri[]>([]);
  const [vezneTutari, setVezneTutari] = useState<number>(0);
  const [bankaAciklama, setBankaAciklama] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Vezne (Nakit Kasa) Dağılım Alanı
  const [showVezneAlani, setShowVezneAlani] = useState<boolean>(false);
  const vezneInputRef = useRef<HTMLInputElement | null>(null);

  // Dürbün ile Banka Seçim Modalı Durumları
  const [showBankaLookup, setShowBankaLookup] = useState<boolean>(false);
  const [lookupTargetRowId, setLookupTargetRowId] = useState<string | null>(null);
  const [lookupSearchTerm, setLookupSearchTerm] = useState<string>("");

  const hesapNoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const tutarInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const aciklamaInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const vezneFieldRef = useRef<HTMLInputElement | null>(null);

  const initialLoadDoneRef = useRef(false);

  // Klavyeden sağ / sol yön tuşları ile input içi gezinme kontrolleri
  const isInputAtStart = (el: HTMLInputElement | null) => {
    if (!el) return true;
    try {
      const len = el.value.length;
      if (len === 0) return true;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === null || end === null) return true;
      const isAllSelected = start === 0 && end === len;
      return (start === 0 && end === 0) || isAllSelected;
    } catch {
      return true;
    }
  };

  const isInputAtEnd = (el: HTMLInputElement | null) => {
    if (!el) return true;
    try {
      const len = el.value.length;
      if (len === 0) return true;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === null || end === null) return true;
      const isAllSelected = start === 0 && end === len;
      return (start === len && end === len) || isAllSelected;
    } catch {
      return true;
    }
  };

  const focusInput = (el: HTMLInputElement | null, selectAll = true) => {
    if (!el) return;
    el.focus();
    if (selectAll) {
      try {
        el.select();
      } catch {
        // ignore
      }
    }
  };

  // Bankaları yükle
  const fetchBankalar = useCallback(async () => {
    try {
      setLoading(true);
      const list = await BankaService.getBankalar({ aktif: true }, true);
      setBankalar(list || []);
      return list || [];
    } catch {
      setBankalar([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (show) {
      fetchBankalar();
      setErrorMessage(null);
      CashDeskService.getVezneler()
        .then((list) => {
          setVezneler(list || []);
          if (initialVezneId) {
            setSeciliVezneId(initialVezneId);
          } else if (currentVezneId) {
            setSeciliVezneId(currentVezneId);
          } else if (list && list.length > 0) {
            setSeciliVezneId(list[0].id);
          }
        })
        .catch(() => {
          setVezneler([]);
        });
    }
  }, [show, fetchBankalar, initialVezneId, currentVezneId]);

  // Modal açıldığında SADECE BİR KEZ başlangıç durumunu ayarla (tuşlamada state sıfırlanmasını engeller)
  useEffect(() => {
    if (show && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      setBankaAciklama(initialBankaAciklama || "");
      const initVezne = initialVezneTutari || 0;
      setVezneTutari(initVezne);
      setShowVezneAlani(initVezne > 0);

      if (initialBankaSatirlari && initialBankaSatirlari.length > 0) {
        const validInitial = initialBankaSatirlari.filter(
          (item) => (item.bankaId && item.bankaId > 0) || (item.tutar && Number(item.tutar) > 0) || (item.hesapNo && item.hesapNo.trim() !== "")
        );
        if (validInitial.length > 0) {
          setRows(
            validInitial.map((item, idx) => ({
              id: `row-${Date.now()}-${idx}`,
              bankaId: item.bankaId || 0,
              hesapNo: item.hesapNo || "",
              hesapAdi: item.bankaAdi || "",
              bankaAdi: item.bankaAdi || "",
              iban: item.iban || "",
              tutar: Number(item.tutar) || 0,
              aciklama: item.aciklama || "",
            }))
          );
        } else {
          const initId = `row-${Date.now()}-0`;
          setRows([
            {
              id: initId,
              bankaId: 0,
              hesapNo: "",
              hesapAdi: "",
              bankaAdi: "",
              iban: "",
              tutar: 0,
              aciklama: "",
            },
          ]);
          setTimeout(() => focusInput(hesapNoInputRefs.current[initId]), 100);
        }
      } else {
        // İlk açılışta satır eskisi gibi olacak fakat içi boş olacak
        const initId = `row-${Date.now()}-0`;
        setRows([
          {
            id: initId,
            bankaId: 0,
            hesapNo: "",
            hesapAdi: "",
            bankaAdi: "",
            iban: "",
            tutar: 0,
            aciklama: "",
          },
        ]);
        setTimeout(() => focusInput(hesapNoInputRefs.current[initId]), 100);
      }
    } else if (!show) {
      initialLoadDoneRef.current = false;
      setShowVezneAlani(false);
    }
  }, [show]);

  // Bankalar yüklendiğinde var olan satırlardaki eksik hesap bilgilerini zenginleştir
  useEffect(() => {
    if (bankalar.length > 0 && rows.length > 0) {
      setRows((prev) =>
        prev.map((r) => {
          if (r.bankaId && (!r.hesapNo || !r.hesapAdi)) {
            const found = bankalar.find((b) => b.bankaId === r.bankaId);
            if (found) {
              return {
                ...r,
                hesapNo: r.hesapNo || found.hesapNo || "",
                hesapAdi: r.hesapAdi || found.hesapAdi || "",
                bankaAdi: r.bankaAdi || found.bankaAdi || "",
                iban: r.iban || found.iban || "",
              };
            }
          }
          return r;
        })
      );
    }
  }, [bankalar]);

  // Hesaplamalar
  const toplamBankaTutari = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.tutar) || 0), 0);
  }, [rows]);

  // Kalan (eksik) tutar
  const kalanTutar = useMemo(() => {
    const raw = (toplamTutar || 0) - toplamBankaTutari - (vezneTutari || 0);
    return Math.abs(raw) < 0.001 ? 0 : raw;
  }, [toplamTutar, toplamBankaTutari, vezneTutari]);

  // Bankalardan sonra kalan (Vezneye veya yeni banka satırına aktarılabilir tutar)
  const bankaSonrasiKalan = useMemo(() => {
    const raw = (toplamTutar || 0) - toplamBankaTutari;
    return Math.abs(raw) < 0.001 ? 0 : raw;
  }, [toplamTutar, toplamBankaTutari]);

  // Dürbün Arama Modalını Açma
  const openBankaLookup = (rowId: string | null = null, initialSearch: string = "") => {
    setLookupTargetRowId(rowId);
    setLookupSearchTerm(initialSearch);
    setShowBankaLookup(true);
    setErrorMessage(null);
  };

  // Bir banka hesabını belirli bir satıra uygula ve otomatik Tutar alanına odaklan
  const handleSelectBankaToRow = (rowId: string, selected: BankaHesapItem) => {
    setErrorMessage(null);
    const bankName = selected.bankaAdi || selected.hesapAdi || "Banka";
    const hesapTitle = selected.hesapAdi || "";

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const currentTutar = Number(r.tutar) || 0;
        return {
          ...r,
          bankaId: selected.bankaId,
          hesapNo: selected.hesapNo || "",
          hesapAdi: hesapTitle,
          bankaAdi: bankName,
          iban: selected.iban || "",
          tutar:
            currentTutar > 0
              ? currentTutar
              : bankaSonrasiKalan > 0
              ? bankaSonrasiKalan
              : toplamTutar > 0
              ? toplamTutar
              : 0,
        };
      })
    );

    // Enter ile ilerleme: Bir sonraki alan olan Tutar'a geç
    setTimeout(() => {
      focusInput(tutarInputRefs.current[rowId]);
    }, 60);
  };

  // Dürbün Modalından Banka Seçildiğinde
  const handleSelectBankaFromLookup = (selected: BankaHesapItem) => {
    if (lookupTargetRowId) {
      handleSelectBankaToRow(lookupTargetRowId, selected);
    } else {
      const targetId = rows.length > 0 ? rows[rows.length - 1].id : null;
      if (targetId && (!rows[rows.length - 1].bankaId || rows[rows.length - 1].bankaId === 0)) {
        handleSelectBankaToRow(targetId, selected);
      } else {
        const newId = `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newRow: BankaDagitimSatiri = {
          id: newId,
          bankaId: selected.bankaId,
          hesapNo: selected.hesapNo || "",
          hesapAdi: selected.hesapAdi || "",
          bankaAdi: selected.bankaAdi || "",
          iban: selected.iban || "",
          tutar: bankaSonrasiKalan > 0 ? bankaSonrasiKalan : (toplamTutar > 0 ? toplamTutar : 0),
          aciklama: bankaAciklama || "",
        };
        setRows((prev) => [...prev, newRow]);
        setTimeout(() => {
          tutarInputRefs.current[newId]?.focus();
          tutarInputRefs.current[newId]?.select();
        }, 60);
      }
    }

    setShowBankaLookup(false);
    setLookupTargetRowId(null);
  };

  // Yeni satır ekle
  const handleAddEmptyRow = () => {
    // Halihazırda son satır boşsa yenisini eklemeyip direkt ona odaklan
    const lastRow = rows[rows.length - 1];
    if (lastRow && (!lastRow.bankaId || lastRow.bankaId === 0) && (!lastRow.tutar || Number(lastRow.tutar) === 0) && (!lastRow.hesapNo || !lastRow.hesapNo.trim())) {
      focusInput(hesapNoInputRefs.current[lastRow.id]);
      return;
    }

    const onerilenTutar = bankaSonrasiKalan > 0 ? bankaSonrasiKalan : 0;
    const newId = `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newRow: BankaDagitimSatiri = {
      id: newId,
      bankaId: 0,
      hesapNo: "",
      hesapAdi: "",
      bankaAdi: "",
      iban: "",
      tutar: onerilenTutar,
      aciklama: bankaAciklama || "",
    };

    setRows((prev) => [...prev, newRow]);
    setErrorMessage(null);
    setTimeout(() => {
      focusInput(hesapNoInputRefs.current[newId]);
    }, 60);
  };

  // Satır boş kaldıysa otomatik kapanması / silinmesi kontrolü
  const handleRowBlur = (rowId: string) => {
    setTimeout(() => {
      const activeEl = document.activeElement;
      const isStillInSameRow =
        activeEl === hesapNoInputRefs.current[rowId] ||
        activeEl === tutarInputRefs.current[rowId] ||
        activeEl === aciklamaInputRefs.current[rowId];

      if (!isStillInSameRow) {
        setRows((prev) => {
          if (prev.length <= 1) return prev; // En az 1 satır kalsın
          const target = prev.find((r) => r.id === rowId);
          if (!target) return prev;

          const isEmpty =
            (!target.bankaId || target.bankaId === 0) &&
            (!target.tutar || Number(target.tutar) === 0) &&
            (!target.hesapNo || !target.hesapNo.trim()) &&
            (!target.aciklama || !target.aciklama.trim());

          if (isEmpty) {
            return prev.filter((r) => r.id !== rowId);
          }
          return prev;
        });
      }
    }, 150);
  };

  // Hesap No metin değişikliği
  const handleHesapNoChange = (rowId: string, val: string) => {
    setErrorMessage(null);

    // Satırın hesapNo değerini doğrudan güncelle (yazı yazabilmeyi garanti eder)
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          hesapNo: val,
        };
      })
    );
  };

  // Hesap No KeyDown: Sağ/Sol/Yukarı/Aşağı ok tuşları ile gezinti, Enterla doğrulama/arama, F4 ile dürbün
  const handleHesapNoKeyDown = (
    e: React.KeyboardEvent<any>,
    row: BankaDagitimSatiri,
    index: number
  ) => {
    // F4 veya F3: Dürbün arama modalı
    if (e.key === "F4" || e.key === "F3") {
      e.preventDefault();
      e.stopPropagation();
      openBankaLookup(row.id, row.hesapNo || "");
      return;
    }

    // F7: Yeni satır ekle
    if (e.key === "F7") {
      e.preventDefault();
      handleAddEmptyRow();
      return;
    }

    // Backspace: Eğer satır boşsa ve birden fazla satır varsa bu boş satırı otomatik kapat ve öncekine geç
    if (
      e.key === "Backspace" &&
      (!row.hesapNo || !row.hesapNo.trim()) &&
      (!row.tutar || Number(row.tutar) === 0) &&
      index > 0
    ) {
      e.preventDefault();
      const prevRow = rows[index - 1];
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTimeout(() => {
        focusInput(aciklamaInputRefs.current[prevRow.id]);
      }, 50);
      return;
    }

    // Yukarı ok: Bir önceki satırın Hesap No alanına geç
    if (e.key === "ArrowUp") {
      if (index > 0) {
        e.preventDefault();
        const prevRow = rows[index - 1];
        focusInput(hesapNoInputRefs.current[prevRow.id]);
      }
      return;
    }

    // Aşağı ok: Bir sonraki satırın Hesap No alanına geç
    if (e.key === "ArrowDown") {
      if (index < rows.length - 1) {
        e.preventDefault();
        const nextRow = rows[index + 1];
        focusInput(hesapNoInputRefs.current[nextRow.id]);
      }
      return;
    }

    // Sağ ok: Girişin sonundaysa Tutar alanına geç
    if (e.key === "ArrowRight") {
      const inputEl = hesapNoInputRefs.current[row.id];
      if (isInputAtEnd(inputEl)) {
        e.preventDefault();
        focusInput(tutarInputRefs.current[row.id]);
      }
      return;
    }

    // Sol ok: Girişin başındaysa ve önceki satır varsa önceki satırın Açıklama alanına geç
    if (e.key === "ArrowLeft") {
      const inputEl = hesapNoInputRefs.current[row.id];
      if (isInputAtStart(inputEl) && index > 0) {
        e.preventDefault();
        const prevRow = rows[index - 1];
        focusInput(aciklamaInputRefs.current[prevRow.id]);
      }
      return;
    }

    // Enter / Tab ile doğrulama ve ilerleme
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const val = (row.hesapNo || "").trim().toLowerCase();

      // Boşsa dürbün modalını aç
      if (!val) {
        openBankaLookup(row.id, "");
        return;
      }

      // Bankalar listesinde ara
      const matches = bankalar.filter(
        (b) =>
          (b.hesapNo && b.hesapNo.toLowerCase().includes(val)) ||
          (b.hesapAdi && b.hesapAdi.toLowerCase().includes(val)) ||
          (b.bankaAdi && b.bankaAdi.toLowerCase().includes(val)) ||
          (b.iban && b.iban.toLowerCase().includes(val))
      );

      // KURAL: Eğer tek kayıt varsa otomatik seçmeli, yoksa veya birden fazlaysa modalda aramalı
      if (matches.length === 1) {
        handleSelectBankaToRow(row.id, matches[0]);
      } else {
        openBankaLookup(row.id, row.hesapNo || "");
      }
    }
  };

  // Tutar güncelleme
  const handleTutarChange = (id: string, val: string) => {
    setErrorMessage(null);
    const num = parseFloat(val) || 0;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, tutar: num } : r))
    );
  };

  // Tutar KeyDown: Sağ/Sol/Yukarı/Aşağı ok tuşları ile gezinti, Enter ile Açıklama alanına ilerler
  const handleTutarKeyDown = (
    e: React.KeyboardEvent<any>,
    row: BankaDagitimSatiri,
    index: number
  ) => {
    // Yukarı ok: Bir önceki satırın Tutar alanına geç
    if (e.key === "ArrowUp") {
      if (index > 0) {
        e.preventDefault();
        const prevRow = rows[index - 1];
        focusInput(tutarInputRefs.current[prevRow.id]);
      }
      return;
    }

    // Aşağı ok: Bir sonraki satırın Tutar alanına geç
    if (e.key === "ArrowDown") {
      if (index < rows.length - 1) {
        e.preventDefault();
        const nextRow = rows[index + 1];
        focusInput(tutarInputRefs.current[nextRow.id]);
      }
      return;
    }

    // Sol ok: Baştaysa Hesap No alanına dön
    if (e.key === "ArrowLeft") {
      const inputEl = tutarInputRefs.current[row.id];
      if (isInputAtStart(inputEl)) {
        e.preventDefault();
        focusInput(hesapNoInputRefs.current[row.id]);
      }
      return;
    }

    // Sağ ok: Sonundaysa Açıklama alanına ilerle
    if (e.key === "ArrowRight") {
      const inputEl = tutarInputRefs.current[row.id];
      if (isInputAtEnd(inputEl)) {
        e.preventDefault();
        focusInput(aciklamaInputRefs.current[row.id]);
      }
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      focusInput(aciklamaInputRefs.current[row.id]);
    }
  };

  // Açıklama güncelleme
  const handleAciklamaChange = (id: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, aciklama: val } : r))
    );
  };

  // Açıklama KeyDown: Sağ/Sol/Yukarı/Aşağı ok tuşları ile gezinti, Enter ile sonraki satıra geçer veya otomatik yeni satır ekler
  const handleAciklamaKeyDown = (
    e: React.KeyboardEvent<any>,
    row: BankaDagitimSatiri,
    index: number
  ) => {
    // Yukarı ok: Bir önceki satırın Açıklama alanına geç
    if (e.key === "ArrowUp") {
      if (index > 0) {
        e.preventDefault();
        const prevRow = rows[index - 1];
        focusInput(aciklamaInputRefs.current[prevRow.id]);
      }
      return;
    }

    // Aşağı ok: Bir sonraki satırın Açıklama alanına geç
    if (e.key === "ArrowDown") {
      if (index < rows.length - 1) {
        e.preventDefault();
        const nextRow = rows[index + 1];
        focusInput(aciklamaInputRefs.current[nextRow.id]);
      }
      return;
    }

    // Sol ok: Baştaysa Tutar alanına dön
    if (e.key === "ArrowLeft") {
      const inputEl = aciklamaInputRefs.current[row.id];
      if (isInputAtStart(inputEl)) {
        e.preventDefault();
        focusInput(tutarInputRefs.current[row.id]);
      }
      return;
    }

    // Sağ ok: Sonundaysa ve sonraki satır varsa sonraki satırın Hesap No alanına geç
    if (e.key === "ArrowRight") {
      const inputEl = aciklamaInputRefs.current[row.id];
      if (isInputAtEnd(inputEl) && index < rows.length - 1) {
        e.preventDefault();
        const nextRow = rows[index + 1];
        focusInput(hesapNoInputRefs.current[nextRow.id]);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (index === rows.length - 1) {
        // Satır sonunda Enter: Eğer satır doluysa otomatik yeni satır ekle
        const isCurrentEmpty =
          (!row.bankaId || row.bankaId === 0) &&
          (!row.tutar || Number(row.tutar) === 0) &&
          (!row.hesapNo || !row.hesapNo.trim());

        if (!isCurrentEmpty) {
          handleAddEmptyRow();
        } else {
          // Boş kaldıysa ve birden fazla satır varsa bu boş satırı otomatik kapat
          if (rows.length > 1) {
            setRows((prev) => prev.filter((r) => r.id !== row.id));
          }
          handleApply();
        }
      } else {
        const next = rows[index + 1];
        if (next) {
          focusInput(hesapNoInputRefs.current[next.id]);
        }
      }
    }
  };

  // Satır silme
  const handleRemoveRow = (id: string) => {
    setRows((prev) => {
      const remaining = prev.filter((r) => r.id !== id);
      if (remaining.length === 0) {
        const newId = `row-${Date.now()}-0`;
        setTimeout(() => focusInput(hesapNoInputRefs.current[newId]), 60);
        return [
          {
            id: newId,
            bankaId: 0,
            hesapNo: "",
            hesapAdi: "",
            bankaAdi: "",
            iban: "",
            tutar: 0,
            aciklama: "",
          },
        ];
      }
      return remaining;
    });
  };

  // Eksik tutarı vezneye aktarma (altta vezne alanını açar)
  const handleEksikTutariVezneyeAktar = () => {
    const eksik = Math.max(0, (toplamTutar || 0) - toplamBankaTutari);
    setVezneTutari(eksik);
    setShowVezneAlani(true);
    setErrorMessage(null);
    setTimeout(() => {
      vezneInputRef.current?.focus();
      vezneInputRef.current?.select();
    }, 80);
  };

  // Vezne alanını kapatma ve tutarını sıfırlama
  const handleVezneAlaniKapat = () => {
    setVezneTutari(0);
    setShowVezneAlani(false);
  };

  // Uygula ve fişe aktar
  const handleApply = () => {
    const validRows = rows.filter((r) => r.bankaId > 0 && r.tutar > 0);

    if (validRows.length === 0 && (!vezneTutari || Number(vezneTutari) <= 0)) {
      setErrorMessage("Lütfen en az bir banka hesabı seçiniz veya vezne tutarı giriniz.");
      return;
    }

    const eksikBanka = rows.some((r) => r.tutar > 0 && (!r.bankaId || r.bankaId === 0));
    if (eksikBanka) {
      setErrorMessage("Tutar girilen satırlarda banka hesabı seçilmelidir (Dürbün veya arama ile banka seçiniz).");
      return;
    }

    const payloadSatirlar = validRows.map((r) => {
      const hesapDisplay = r.hesapAdi
        ? `${r.bankaAdi ? r.bankaAdi + " - " : ""}${r.hesapAdi}`
        : (r.bankaAdi || r.hesapNo || "BANKA");
      return {
        bankaId: r.bankaId,
        bankaAdi: hesapDisplay,
        hesapNo: r.hesapNo || "",
        iban: r.iban || "",
        tutar: Number(r.tutar),
        aciklama: r.aciklama || bankaAciklama || "",
      };
    });

    const seciliVezne = vezneler.find((v) => v.id === seciliVezneId);
    onApply({
      bankaSatirlari: payloadSatirlar,
      vezneTutari: Number(vezneTutari) || 0,
      vezneId: seciliVezneId || undefined,
      vezneKodu: seciliVezne ? seciliVezne.kod : currentVezneKod,
      vezneAdi: seciliVezne ? seciliVezne.ad : currentVezneAd,
      bankaAciklama: bankaAciklama.trim(),
    });
    onClose();
  };

  // Modal geneli tuşlamalar
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (showBankaLookup) return;

    if (e.key === "F7") {
      e.preventDefault();
      handleAddEmptyRow();
      return;
    }
  };

  const islemBasligi = islemTipi === "odeme" ? "Banka TL Ödeme" : "Banka TL Tahsilat";

  // Dürbün Modal Tablo Kolonları
  const bankaLookupColumns: LookupColumn<BankaHesapItem>[] = useMemo(
    () => [
      {
        header: "Hesap No / Kod",
        width: "130px",
        align: "left",
        highlight: true,
        render: (item) => (
          <span className="font-monospace fw-bold text-primary">
            {item.hesapNo || "-"}
          </span>
        ),
      },
      {
        header: "Hesap Adı",
        align: "left",
        highlight: true,
        render: (item) => (
          <span className="fw-semibold text-dark">
            {item.hesapAdi}
          </span>
        ),
      },
      {
        header: "Banka Adı",
        width: "160px",
        align: "left",
        highlight: true,
        render: (item) => (
          <span className="text-secondary fw-medium">
            {item.bankaAdi || "-"}
          </span>
        ),
      },
      {
        header: "IBAN",
        width: "190px",
        align: "left",
        highlight: true,
        render: (item) => (
          <span className="font-monospace small text-muted">
            {item.iban || "-"}
          </span>
        ),
      },
      {
        header: "Şube",
        width: "120px",
        align: "left",
        render: (item) => (
          <span className="text-muted small">
            {item.subeAdi || "-"}
          </span>
        ),
      },
      {
        header: "Bakiye",
        width: "120px",
        align: "right",
        render: (item) => (
          <span className={`font-monospace fw-bold ${(item.bakiye || 0) < 0 ? "text-danger" : "text-success"}`}>
            {(item.bakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
          </span>
        ),
      },
    ],
    []
  );

  // Dürbün Filtreleme Fonksiyonu
  const bankaFilterFn = useCallback((item: BankaHesapItem, term: string) => {
    const t = term.toLowerCase().trim();
    if (!t) return true;
    return (
      (item.hesapAdi ? item.hesapAdi.toLowerCase().includes(t) : false) ||
      (item.bankaAdi ? item.bankaAdi.toLowerCase().includes(t) : false) ||
      (item.hesapNo ? item.hesapNo.toLowerCase().includes(t) : false) ||
      (item.iban ? item.iban.toLowerCase().includes(t) : false) ||
      (item.subeAdi ? item.subeAdi.toLowerCase().includes(t) : false)
    );
  }, []);

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        size="xl"
        centered
        onKeyDown={handleModalKeyDown}
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-primary text-white py-2 px-3">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconBuildingBank size={20} />
            Banka TL Hesabı (Shift+F5) - {islemBasligi}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-3" style={{ backgroundColor: "#f8fafc" }}>
          {errorMessage && (
            <Alert
              variant="danger"
              className="py-2 px-3 mb-2.5 small d-flex align-items-center gap-2"
              dismissible
              onClose={() => setErrorMessage(null)}
            >
              <IconAlertCircle size={18} className="flex-shrink-0" />
              <div>{errorMessage}</div>
            </Alert>
          )}

          {/* Tutar Özet Kartları */}
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <div className="p-2 rounded border bg-white shadow-2xs">
                <div className="text-muted small fw-medium">Fiş Toplamı</div>
                <div className="fs-6 fw-bold text-dark font-monospace">
                  {toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-2 rounded border bg-white shadow-2xs">
                <div className="text-muted small fw-medium">Banka Toplamı</div>
                <div className="fs-6 fw-bold text-primary font-monospace">
                  {toplamBankaTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-2 rounded border bg-white shadow-2xs">
                <div className="text-muted small fw-medium">Vezne (Nakit)</div>
                <div className="fs-6 fw-bold text-secondary font-monospace">
                  {vezneTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div
                className={`p-2 rounded border shadow-2xs ${
                  kalanTutar === 0
                    ? "bg-success-subtle border-success"
                    : "bg-warning-subtle border-warning"
                }`}
              >
                <div className="text-muted small fw-medium">Kalan (Eksik) Tutar</div>
                <div
                  className={`fs-6 fw-bold font-monospace ${
                    kalanTutar === 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {kalanTutar.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </div>
              </div>
            </div>
          </div>

          {/* Banka Dağılım Tablosu (ERP Tablo Yapısı - Üst butonlar kaldırıldı) */}
          <div className="border rounded bg-white shadow-2xs overflow-hidden mb-3">
            <div className="bg-light px-3 py-1.5 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-secondary" style={{ fontSize: "12px" }}>
                  BANKA HESAP DAĞILIM TABLOSU
                </span>
                <Badge bg={rows.length > 0 ? "primary" : "secondary"} pill style={{ fontSize: "10px" }}>
                  {rows.length} Banka Satırı
                </Badge>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small" style={{ fontSize: "11px" }}>
                  Hesap kodunu yazıp <strong>Enter</strong> ile ilerleyebilir, <strong>F4</strong> ile banka arayabilirsiniz. Satır sonunda <strong>Enter</strong> ile yeni satır eklenir.
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto", maxHeight: "280px" }}>
              <Table bordered size="sm" hover className="mb-0 align-middle" style={{ fontSize: "12px", minWidth: 800 }}>
                <thead style={{ background: "#d9e8fb", color: "#000" }}>
                  <tr className="text-center align-middle">
                    <th style={{ width: 35 }} className="text-center py-1.5">#</th>
                    <th style={{ width: 170 }} className="text-center py-1.5">Banka Kodu / Hesap No</th>
                    <th style={{ minWidth: 200 }} className="text-start py-1.5">Banka &amp; Hesap Adı</th>
                    <th style={{ width: 175 }} className="text-start py-1.5">IBAN</th>
                    <th style={{ width: 145 }} className="text-end py-1.5">Tutar (TL)</th>
                    <th style={{ minWidth: 170 }} className="text-start py-1.5">Satır Açıklaması</th>
                    <th style={{ width: 45 }} className="text-center py-1.5">Sil</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted bg-white">
                        <span style={{ fontSize: "13px" }}>Banka hesap dağılım satırı bulunmuyor.</span>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                    const hasBanka = Boolean(row.bankaId && row.bankaId > 0);
                    const hesapDisplay = row.hesapAdi
                      ? `${row.bankaAdi ? row.bankaAdi + " - " : ""}${row.hesapAdi}`
                      : (row.bankaAdi || (row.hesapNo ? `Hesap: ${row.hesapNo}` : ""));

                    return (
                      <tr key={row.id}>
                        {/* 1. Sıra No */}
                        <td className="text-center text-muted small fw-bold font-monospace">
                          {index + 1}
                        </td>

                        {/* 2. Banka Kodu / Hesap No (+ Dürbün İkonu) */}
                        <td>
                          <InputGroup size="sm">
                            <Form.Control
                              ref={(el) => {
                                hesapNoInputRefs.current[row.id] = el;
                              }}
                              type="text"
                              autoComplete="off"
                              value={row.hesapNo || ""}
                              placeholder="Hesap No / Kod..."
                              className={`font-monospace fw-bold ${hasBanka ? "text-primary" : "text-dark"}`}
                              style={{ fontSize: "12px", padding: "2px 6px" }}
                              onChange={(e) => handleHesapNoChange(row.id, e.target.value)}
                              onKeyDown={(e) => handleHesapNoKeyDown(e, row, index)}
                              onBlur={() => handleRowBlur(row.id)}
                            />
                            <Button
                              type="button"
                              variant={hasBanka ? "primary" : "outline-primary"}
                              className="px-1.5 py-0 d-flex align-items-center"
                              title="Dürbün ile Banka Seç (F4)"
                              onClick={() => openBankaLookup(row.id, row.hesapNo || "")}
                            >
                              <IconBinoculars size={14} />
                            </Button>
                          </InputGroup>
                        </td>

                        {/* 3. Banka & Hesap Adı (Otomatik Dolar) */}
                        <td>
                          <Form.Control
                            size="sm"
                            type="text"
                            readOnly
                            value={hesapDisplay || (hasBanka ? "Banka Hesabı" : "-")}
                            placeholder="Hesap seçiniz..."
                            className="bg-light text-dark fw-semibold"
                            style={{ fontSize: "12px", padding: "2px 6px" }}
                            title={hesapDisplay}
                          />
                        </td>

                        {/* 4. IBAN (Otomatik Dolar) */}
                        <td>
                          <Form.Control
                            size="sm"
                            type="text"
                            readOnly
                            value={row.iban || "-"}
                            className="bg-light text-muted font-monospace small"
                            style={{ fontSize: "11px", padding: "2px 6px" }}
                            title={row.iban || ""}
                          />
                        </td>

                        {/* 5. Tutar (TL) */}
                        <td>
                          <Form.Control
                            ref={(el) => {
                              tutarInputRefs.current[row.id] = el;
                            }}
                            size="sm"
                            type="number"
                            step="any"
                            value={row.tutar || ""}
                            placeholder="0.00"
                            className="text-end font-monospace fw-bold text-primary"
                            style={{ fontSize: "13px", padding: "2px 6px" }}
                            onChange={(e) => handleTutarChange(row.id, e.target.value)}
                            onKeyDown={(e) => handleTutarKeyDown(e, row, index)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleRowBlur(row.id)}
                          />
                        </td>

                        {/* 6. Satır Açıklaması */}
                        <td>
                          <Form.Control
                            ref={(el) => {
                              aciklamaInputRefs.current[row.id] = el;
                            }}
                            size="sm"
                            type="text"
                            value={row.aciklama}
                            placeholder="Havale / EFT notu, dekont no..."
                            style={{ fontSize: "12px", padding: "2px 6px" }}
                            onChange={(e) => handleAciklamaChange(row.id, e.target.value)}
                            onKeyDown={(e) => handleAciklamaKeyDown(e, row, index)}
                            onBlur={() => handleRowBlur(row.id)}
                          />
                        </td>

                        {/* 7. Sil */}
                        <td className="text-center">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            className="p-1 border-0"
                            title="Satırı Kaldır"
                            onClick={() => handleRemoveRow(row.id)}
                          >
                            <IconTrash size={15} />
                          </Button>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
                <tfoot className="table-light border-top">
                  <tr>
                    <td colSpan={4} className="py-2 px-3 small text-muted">
                      <strong>Toplam:</strong> {rows.length} Banka Satırı (Yeni satır eklemek için açıklama alanında <strong>Enter</strong> veya <strong>F7</strong> tuşlayabilirsiniz)
                    </td>
                    <td className="text-end py-2 px-2 font-monospace fw-bold fs-6 text-primary">
                      {toplamBankaTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </Table>
            </div>
          </div>

          {/* Eksik Tutar & Vezne Alanı */}
          <div className="card shadow-2xs border mb-3">
            <div className="card-body p-2.5">
              {!showVezneAlani ? (
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <IconCash size={18} className="text-secondary" />
                    <span className="small text-muted">
                      Kalan tutarı vezneye (nakit kasaya) aktarmak istiyorsanız butona basınız:
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={bankaSonrasiKalan > 0 ? "warning" : "light"}
                    className="d-inline-flex align-items-center gap-1.5 fw-bold text-dark border py-1.5 px-3 shadow-2xs"
                    style={{ fontSize: "12.5px" }}
                    onClick={handleEksikTutariVezneyeAktar}
                    title="Kalan eksik tutarı vezneye aktarmak için alanı açar"
                  >
                    <IconArrowDownLeft size={16} />
                    Eksik Tutarı ({bankaSonrasiKalan.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL) Vezneye Yaz
                  </Button>
                </div>
              ) : (
                <div className="p-2.5 rounded border border-success bg-success-subtle bg-opacity-10">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    {/* Sol Kısım: Hangi Vezneye (Küçük Alan) */}
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-1.5 bg-success text-white rounded d-flex align-items-center justify-content-center">
                        <IconCash size={18} />
                      </div>
                      <div>
                        <div className="text-muted fw-bold" style={{ fontSize: "11px", marginBottom: "2px" }}>
                          Hangi Vezneye (Kasa):
                        </div>
                        <div style={{ width: "170px" }}>
                          {vezneler.length > 0 ? (
                            <Form.Select
                              size="sm"
                              value={seciliVezneId || ""}
                              onChange={(e) => setSeciliVezneId(Number(e.target.value) || null)}
                              style={{ fontSize: "12px", padding: "2px 6px" }}
                              className="fw-bold text-dark bg-white border-success"
                            >
                              {vezneler.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.kod ? `${v.kod} - ` : ""}{v.ad || `Vezne #${v.id}`}
                                </option>
                              ))}
                            </Form.Select>
                          ) : (
                            <Form.Control
                              size="sm"
                              readOnly
                              value={currentVezneAd || currentVezneKod || "Merkez Kasa"}
                              style={{ fontSize: "12px", padding: "2px 6px" }}
                              className="fw-bold text-dark bg-white"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sağ Kısım: Ne Kadar Yazdığı (Tutar) ve İşlemler */}
                    <div className="d-flex align-items-center gap-2">
                      <div>
                        <div className="text-muted fw-bold text-end" style={{ fontSize: "11px", marginBottom: "2px" }}>
                          Yazılacak Tutar (TL):
                        </div>
                        <div style={{ width: "160px" }}>
                          <InputGroup size="sm">
                            <Form.Control
                              ref={vezneInputRef}
                              type="number"
                              step="any"
                              value={vezneTutari || ""}
                              placeholder="0.00"
                              className="text-end font-monospace fw-bold text-success border-success"
                              style={{ fontSize: "13.5px" }}
                              onChange={(e) => setVezneTutari(parseFloat(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                            />
                            <InputGroup.Text className="small fw-bold bg-white text-success border-success">
                              TL
                            </InputGroup.Text>
                          </InputGroup>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-1.5" style={{ paddingTop: "17px" }}>
                        {bankaSonrasiKalan !== vezneTutari && (
                          <Button
                            size="sm"
                            variant="outline-warning"
                            className="d-inline-flex align-items-center gap-1 text-dark py-1 px-2.5 fw-semibold"
                            style={{ fontSize: "11px" }}
                            onClick={handleEksikTutariVezneyeAktar}
                            title="Farkı yeniden hesaplayarak vezne tutarını eksik tutara eşitler"
                          >
                            <IconRefresh size={13} />
                            Eşitle ({bankaSonrasiKalan.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL)
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="d-inline-flex align-items-center gap-1 py-1 px-2.5"
                          style={{ fontSize: "11px" }}
                          onClick={handleVezneAlaniKapat}
                          title="Vezne tutarını sıfırlar ve alanı kapatır"
                        >
                          <IconTrash size={13} />
                          Kaldır
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Banka Açıklaması (Cari Raporlarda Gösterilecek Alan) */}
          <div className="card shadow-2xs border">
            <div className="card-body p-2.5">
              <Form.Group>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <Form.Label className="small fw-bold text-dark mb-0 d-flex align-items-center gap-1">
                    <IconInfoCircle size={15} className="text-primary" />
                    Banka Açıklaması (Cari Raporlarda Açıklama Kolonunda Gösterilir):
                  </Form.Label>
                  <span className="text-muted" style={{ fontSize: "11px" }}>
                    Bu alana yazılan açıklama cari hareket ekstresinde görünür.
                  </span>
                </div>
                <Form.Control
                  type="text"
                  size="sm"
                  value={bankaAciklama}
                  onChange={(e) => setBankaAciklama(e.target.value)}
                  placeholder="Örn: Garanti Bankası Havale / EFT ile tahsil edildi - Dekont No: 12345"
                  maxLength={250}
                  style={{ fontSize: "12.5px" }}
                />
              </Form.Group>
            </div>
          </div>

          {kalanTutar !== 0 && (
            <Alert variant="info" className="mt-2.5 mb-0 py-1.5 px-2.5 small d-flex align-items-center gap-2">
              <IconInfoCircle size={16} />
              <div>
                Fiş tutarı ile banka + vezne toplamı arasında{" "}
                <strong>{kalanTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</strong> fark bulunmaktadır.
                İsterseniz <strong>"Eksik Tutarı Vezneye Yaz"</strong> butonuna tıklayarak farkı anında sıfırlayabilirsiniz.
              </div>
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
          <Button size="sm" variant="secondary" onClick={onClose} className="px-3" style={{ fontSize: "12px" }}>
            İptal (Esc)
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleApply}
            className="px-4 d-inline-flex align-items-center gap-1.5 fw-bold"
            style={{ fontSize: "12px" }}
          >
            <IconCheck size={16} /> Fişe Aktar / Uygula (Enter)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Dürbün Banka Arama Modalı */}
      <LookupModal<BankaHesapItem>
        show={showBankaLookup}
        onHide={() => {
          setShowBankaLookup(false);
          setLookupTargetRowId(null);
        }}
        title="Banka Hesabı Seçimi (TODVZ_BANKA)"
        searchPlaceholder="Banka Adı, Hesap Adı, Hesap No veya IBAN ile arayın..."
        initialSearchTerm={lookupSearchTerm}
        columns={bankaLookupColumns}
        items={bankalar}
        filterFn={bankaFilterFn}
        onSelect={handleSelectBankaFromLookup}
      />
    </>
  );
};
