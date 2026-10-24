import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert, Spinner, Modal } from "react-bootstrap";
import {
  IconUser,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconArrowRight,
  IconArrowLeft,
  IconDatabase,
  IconId,
  IconSearch,
  IconCircleCheck,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { AuthService, MusteriVeritabani } from "../../services/authService";
import { SistemBilgisi, SistemService } from "../../services/sistemService";
import LisansKilitPenceresi, { LisansKilitBilgisi } from "../../components/lisans/LisansKilitPenceresi";

const MUSTERI_NO_KEY = "kuyumcu_erp_musteri_no";
const FIRMA_ID_KEY = "kuyumcu_erp_firma_id";

// Yönetim panelinden gelen giriş engelleri açılır pencerede gösterilir (docs/ADMIN_PANEL_YOL_HARITASI.md K3)
const ENGEL_BASLIKLARI: Record<string, string> = {
  FIRMA_DONDURULDU: "Hesabınız donduruldu",
  LISANS_BITTI: "Hesabınız donduruldu",
  FIRMA_PASIF: "Hesap kullanımda değil",
  KULLANICI_PASIF: "Kullanıcı hesabı kapalı",
  MUSTERI_NO_BULUNAMADI: "Müşteri no bulunamadı",
  BAGLANTI_EKSIK: "Bağlantı bilgisi eksik",
};

/** Müşteri no yazımı: boşluksuz, büyük harf, yalnız harf-rakam (panelde de böyle kaydedilir) */
const musteriNoTemizle = (v: string): string => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const LoginPage: React.FC = () => {
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    const saved = localStorage.getItem("kuyumcu_erp_remember_me");
    return saved === "true";
  });

  const [username, setUsername] = useState<string>(() => {
    const savedRemember = localStorage.getItem("kuyumcu_erp_remember_me");
    if (savedRemember === "true") {
      return localStorage.getItem("kuyumcu_erp_remember_user") || "";
    }
    return "";
  });

  // Şifre alanı her zaman kesinlikle boş olmalı
  const [password, setPassword] = useState<string>("");

  // Müşteri no → o müşterinin veritabanları (docs/GIRIS_VE_EBELGE_DUZENLEME.md G5)
  const [musteriNo, setMusteriNo] = useState<string>(() => localStorage.getItem(MUSTERI_NO_KEY) || "");
  const [veritabanlari, setVeritabanlari] = useState<MusteriVeritabani[]>([]);
  const [firmaId, setFirmaId] = useState<number>(0);
  const [dbAraniyor, setDbAraniyor] = useState<boolean>(false);
  const [dbHata, setDbHata] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [engel, setEngel] = useState<{ baslik: string; mesaj: string } | null>(null);

  // Kurulum (exe) sürümü: tek firma, müşteri no / veritabanı seçimi yok; lisans kilidi ve ilk yönetici
  const [sistem, setSistem] = useState<SistemBilgisi | null>(null);
  const [kilit, setKilit] = useState<LisansKilitBilgisi | null>(null);
  const [kilitKapatilabilir, setKilitKapatilabilir] = useState(false);
  const [ilkYonetici, setIlkYonetici] = useState(false);
  const [ilkAdSoyad, setIlkAdSoyad] = useState("");
  const [sifreTekrar, setSifreTekrar] = useState("");
  const kurulum = !!sistem?.kurulum;

  const kurulumuYukle = async () => {
    const b = await SistemService.bilgi(true);
    setSistem(b);
    if (!b.kurulum) return;
    try {
      const d = await SistemService.lisansDurumu();
      if (d.durum === "KILITLI") {
        setKilitKapatilabilir(false);
        setKilit({ mesaj: d.mesaj || "Program kilitli.", neden: d.neden, iletisim: d.iletisim, makineKimligi: d.makineKimligi });
        return;
      }
      setKilit(null);
    } catch {
      /* lisans durumu okunamadı; giriş denemesi 423 ile pencereyi açar */
    }
    setIlkYonetici(b.kullaniciVar === false);
  };

  useEffect(() => {
    kurulumuYukle();
  }, []);

  /** Giriş bir yönetim engeline takıldıysa pencereyi açar ve true döner. */
  const engelGoster = (err: any): boolean => {
    // Kurulum: lisans kilidi (423) · Bulut: lisans bitti (iletişim bilgisiyle)
    if (err?.status === 423 && err?.kod === "LISANS_KILIT") {
      setKilitKapatilabilir(false);
      setKilit({ mesaj: err.message, neden: err.ayrinti?.neden, iletisim: err.ayrinti?.iletisim, makineKimligi: err.ayrinti?.makineKimligi });
      return true;
    }
    if (err?.kod === "LISANS_BITTI") {
      setKilitKapatilabilir(true);
      setKilit({ mesaj: err.message, neden: "LISANS_BITTI", iletisim: err.ayrinti?.iletisim });
      return true;
    }
    const baslik = err?.kod ? ENGEL_BASLIKLARI[err.kod] : undefined;
    if (!baslik) return false;
    setEngel({ baslik, mesaj: err.message });
    return true;
  };

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Tarayıcıların ve Google'ın şifreyi otomatik doldurmasını engellemek için açılışta sıfırla
  useEffect(() => {
    setPassword("");
    const timer = setTimeout(() => {
      setPassword("");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Müşteri no yazarken sorgulanmaz; Enter ya da Sorgula düğmesiyle veritabanları listelenir.
  // Dönen değer: tek veritabanı (ya da hatırlanan seçim) varsa onun firmaId'si, yoksa 0.
  const kullaniciAdiRef = useRef<HTMLInputElement>(null);
  const [sorgulanan, setSorgulanan] = useState<string>("");

  const sorgula = async (odaklan = true): Promise<number> => {
    const no = musteriNoTemizle(musteriNo);
    setVeritabanlari([]);
    setFirmaId(0);
    setDbHata(null);
    setSorgulanan("");
    if (no.length < 3) {
      setDbHata("Müşteri numaranızı eksiksiz giriniz.");
      return 0;
    }
    setDbAraniyor(true);
    try {
      const liste = await AuthService.musteriVeritabanlari(no);
      setVeritabanlari(liste);
      setSorgulanan(no);
      if (liste.length === 0) {
        setDbHata("Bu müşteri numarasına ait veritabanı bulunamadı.");
        return 0;
      }
      let secilen = 0;
      if (liste.length === 1) {
        secilen = liste[0].firmaId;
      } else {
        const son = Number(localStorage.getItem(FIRMA_ID_KEY) || 0);
        if (liste.some((v) => v.firmaId === son)) secilen = son;
      }
      setFirmaId(secilen);
      if (odaklan && secilen) setTimeout(() => kullaniciAdiRef.current?.focus(), 0);
      return secilen;
    } catch (err: any) {
      const mesaj = String(err?.message || "");
      setDbHata(!mesaj || /^HTTP Hata|ulaşılamadı|zaman aşımı/i.test(mesaj)
        ? "Veritabanları alınamadı; sunucuya ulaşılamıyor. Biraz sonra tekrar deneyin."
        : mesaj);
      return 0;
    } finally {
      setDbAraniyor(false);
    }
  };

  // Hatırlanan müşteri no açılışta bir kez sorgulanır (her girişte Sorgula'ya basılmasın)
  useEffect(() => {
    if (sistem && !sistem.kurulum && musteriNoTemizle(musteriNo).length >= 3) sorgula(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistem?.kurulum]);

  const handleMusteriNoChange = (val: string) => {
    const temiz = musteriNoTemizle(val);
    setMusteriNo(temiz);
    // Numara değişince önceki sorgunun sonucu geçersizdir
    if (temiz !== sorgulanan) {
      setVeritabanlari([]);
      setFirmaId(0);
      setSorgulanan("");
    }
    setDbHata(null);
  };

  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/\s+/g, "");
    setUsername(clean);
    if (rememberMe) {
      localStorage.setItem("kuyumcu_erp_remember_user", clean);
    }
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    localStorage.setItem("kuyumcu_erp_remember_me", checked ? "true" : "false");
    if (!checked) {
      localStorage.removeItem("kuyumcu_erp_remember_user");
    } else if (username.trim()) {
      localStorage.setItem("kuyumcu_erp_remember_user", username.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().replace(/\s+/g, "");
    if (kurulum) {
      if (!cleanUsername || !password) {
        setErrorMsg("Lütfen kullanıcı adınızı ve şifrenizi giriniz.");
        return;
      }
      if (ilkYonetici) {
        if (password !== sifreTekrar) {
          setErrorMsg("Şifre ile tekrarı aynı değil.");
          return;
        }
      }
      try {
        setIsLoading(true);
        if (ilkYonetici) {
          await SistemService.ilkYonetici({ username: cleanUsername, fullName: ilkAdSoyad.trim() || cleanUsername, password });
        }
        await login({ musteriNo: sistem?.firma?.musteriNo || "KURULUM", firmaId: 1, username: cleanUsername, password });
        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        if (engelGoster(err)) return;
        setErrorMsg(err?.status === 401 ? "Kullanıcı adı veya şifre hatalı." : err?.message || "Giriş başarısız.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const no = musteriNoTemizle(musteriNo);
    if (!no) {
      setErrorMsg("Lütfen müşteri numaranızı giriniz.");
      return;
    }
    // Sorgulanmadan giriş istenirse önce sorgulanır; tek veritabanı çıkarsa giriş sürer
    // (sonuç alanın altında ya da veritabanı listesinde görünür)
    let secilenFirma = firmaId;
    if (!secilenFirma) {
      if (sorgulanan !== no) {
        secilenFirma = await sorgula(false);
        if (!secilenFirma) return;
      } else {
        setErrorMsg(
          veritabanlari.length > 1
            ? "Lütfen giriş yapılacak veritabanını seçiniz."
            : dbHata || "Müşteri numarasına ait veritabanı bulunamadı."
        );
        return;
      }
    }
    if (!cleanUsername) {
      setErrorMsg("Lütfen kullanıcı adınızı giriniz.");
      return;
    }
    if (!password) {
      setErrorMsg("Lütfen şifrenizi giriniz.");
      return;
    }

    try {
      setIsLoading(true);
      localStorage.setItem(MUSTERI_NO_KEY, no);
      localStorage.setItem(FIRMA_ID_KEY, String(secilenFirma));
      if (rememberMe) {
        localStorage.setItem("kuyumcu_erp_remember_me", "true");
        localStorage.setItem("kuyumcu_erp_remember_user", cleanUsername);
      } else {
        localStorage.setItem("kuyumcu_erp_remember_me", "false");
        localStorage.removeItem("kuyumcu_erp_remember_user");
      }

      await login({ musteriNo: no, firmaId: secilenFirma, username: cleanUsername, password });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      if (engelGoster(err)) return;
      // Kullanıcı seçilen veritabanında tanımlı değilse de aynı yanıt döner (kullanıcı adı sızdırılmaz)
      setErrorMsg(
        err?.status === 401
          ? "Kullanıcı adı veya şifre hatalı ya da seçilen veritabanına giriş yetkiniz yok."
          : err?.message || "Giriş başarısız. Lütfen bilgilerinizi kontrol ediniz."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const secili = veritabanlari.find((v) => v.firmaId === firmaId);

  return (
    <div className="login-sayfa">
      <style>{`
        .login-sayfa {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5rem 1rem 2.5rem;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(900px 500px at 85% -10%, rgba(200, 143, 24, 0.14), transparent 60%),
            radial-gradient(700px 450px at -10% 110%, rgba(158, 100, 11, 0.10), transparent 60%),
            linear-gradient(160deg, #fbf8f3 0%, #f4eee3 100%);
          font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif;
        }
        .login-sayfa::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(120, 68, 5, 0.07) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);
          pointer-events: none;
        }
        .login-icerik { position: relative; z-index: 1; width: 100%; max-width: 480px; }
        .login-marka { text-align: center; margin-bottom: 1.5rem; }
        .login-marka-ad { font-size: 2.1rem; line-height: 1.1; margin: 0; }
        /* Genel marka yazısı koyu zemin için açık altın; açık zeminde okunsun diye koyu altın */
        .login-marka .brand-text-likya,
        .login-marka .brand-text-kuyum {
          background: linear-gradient(135deg, #d9a632 0%, #b07a16 55%, #7a4a07 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
        }
        .login-marka-alt {
          display: inline-block;
          margin-top: 0.55rem;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #9e640b;
        }
        .login-kart {
          position: relative;
          background: #ffffff;
          border: 1px solid #ece3d4;
          border-radius: 20px;
          padding: 1.75rem 1.75rem 1.5rem;
          box-shadow: 0 1px 2px rgba(60, 35, 5, 0.04), 0 24px 48px -20px rgba(90, 50, 10, 0.22);
          overflow: hidden;
        }
        .login-kart::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, #e8b84b, #c88f18 50%, #9e640b);
        }
        .login-alan { margin-bottom: 0.85rem; }
        .login-alan-satir {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }
        .login-etiket {
          width: 105px;
          min-width: 105px;
          padding-top: 9px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #5c4a35;
          text-align: right;
          margin-bottom: 0;
          flex-shrink: 0;
          line-height: 1.25;
        }
        .login-govde {
          flex: 1;
          min-width: 0;
        }
        .login-grup {
          display: flex;
          align-items: stretch;
          border: 1px solid #e4d9c8;
          border-radius: 10px;
          background: #ffffff;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          overflow: hidden;
        }
        .login-grup:focus-within { border-color: #c88f18; box-shadow: 0 0 0 4px rgba(200, 143, 24, 0.14); }
        .login-grup.hatali { border-color: #dc3545; }
        .login-grup.hatali:focus-within { box-shadow: 0 0 0 4px rgba(220, 53, 69, 0.12); }
        .login-grup.bulundu { border-color: #86c79b; }
        .login-grup-ikon { display: flex; align-items: center; padding: 0 0.15rem 0 0.75rem; color: #b09a7c; }
        .login-grup .form-control,
        .login-grup .form-select {
          border: none !important;
          box-shadow: none !important;
          background-color: transparent !important;
          height: 38px;
          font-size: 0.88rem;
          color: #2b1d0e;
        }
        .login-grup .form-control[readonly] { color: #2b1d0e; cursor: default; }
        .login-grup .form-control::placeholder { color: #bcae9a; }
        .login-goz { border: none; background: transparent; color: #a08a6b; padding: 0 0.75rem; }
        .login-goz:hover { color: #784405; }
        .login-sorgula {
          border: none;
          margin: 3px;
          padding: 0 0.85rem;
          border-radius: 7px;
          background: linear-gradient(135deg, #22a559 0%, #15803d 100%);
          color: #ffffff;
          font-weight: 600;
          font-size: 0.8rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          white-space: nowrap;
          transition: filter 0.15s ease, transform 0.15s ease;
        }
        .login-sorgula:hover:not(:disabled) { filter: brightness(1.08); }
        .login-sorgula:active:not(:disabled) { transform: translateY(1px); }
        .login-sorgula:disabled { opacity: 0.65; }
        .login-ipucu { font-size: 0.75rem; color: #9a8b78; margin-top: 0.3rem; }
        .login-hata { font-size: 0.76rem; color: #c0392b; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.3rem; }
        .login-sayfa .form-check-input:checked { background-color: #c88f18; border-color: #c88f18; }
        .login-sayfa .form-check-input:focus { box-shadow: 0 0 0 0.2rem rgba(200, 143, 24, 0.18); border-color: #c88f18; }
        .login-gir {
          width: 100%;
          height: 42px;
          border: none !important;
          border-radius: 10px !important;
          background: linear-gradient(135deg, #c88f18 0%, #9e640b 100%) !important;
          color: #ffffff !important;
          font-weight: 600;
          font-size: 0.92rem;
          box-shadow: 0 8px 18px -8px rgba(158, 100, 11, 0.6) !important;
          transition: filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease !important;
        }
        .login-gir:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 12px 22px -10px rgba(158, 100, 11, 0.7) !important; }
        .login-alt { text-align: center; margin-top: 1.5rem; font-size: 0.75rem; color: #a3937e; letter-spacing: 0.3px; }
        .login-geri {
          position: absolute;
          top: 1.25rem;
          left: 1.25rem;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.5rem 1rem;
          border-radius: 999px;
          border: 1px solid #e7dcce;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          color: #784405;
          font-size: 0.84rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .login-geri:hover { background: #ffffff; border-color: #c88f18; color: #9e640b; transform: translateX(-2px); }
        @media (max-width: 575.98px) {
          .login-kart { padding: 1.25rem 1rem 1rem; border-radius: 16px; }
          .login-marka-ad { font-size: 1.75rem; }
          .login-geri span { display: none; }
          .login-geri { padding: 0.5rem 0.65rem; top: 1rem; left: 1rem; }
          .login-etiket { width: 90px; min-width: 90px; font-size: 0.78rem; padding-top: 8px; }
          .login-alan-satir { gap: 0.5rem; }
        }
      `}</style>

      {/* Kurulumda (exe) tanıtım sayfası yok */}
      {sistem && !kurulum && (
        <button type="button" onClick={() => navigate("/")} className="login-geri" title="Tanıtım ve Ana Sayfaya Dön">
          <IconArrowLeft size={18} style={{ color: "#c88f18" }} />
          <span>Ana Sayfaya Dön</span>
        </button>
      )}

      <div className="login-icerik">
        {/* Test ortamı (likyakuyum.com): canlıyla karıştırılmasın (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md) */}
        {sistem?.ortam === "test" && (
          <div
            className="text-center fw-bold small rounded-3 mb-3 py-2 px-3"
            style={{ background: "#dc3545", color: "#fff", letterSpacing: "0.08em" }}
            title={sistem.commit ? `Commit ${sistem.commit.slice(0, 9)}` : undefined}
          >
            TEST ORTAMI — burada girilen kayıtlar canlıya yazılmaz{sistem.commit ? ` · ${sistem.commit.slice(0, 9)}` : ""}
          </div>
        )}
        {/* Marka */}
        <div className="login-marka">
          <div className="d-inline-flex align-items-center gap-3">
            <img src="/images/logo/logo.svg" alt="Likya ERP Logo" style={{ width: "56px", height: "56px", objectFit: "contain" }} />
            <h1 className="login-marka-ad fw-bold">
              <span className="brand-text-likya">Likya</span> <span className="brand-text-kuyum">ERP</span>
            </h1>
          </div>
          <div>
            <span className="login-marka-alt">Döviz &amp; Altın Yönetim Platformu</span>
          </div>
        </div>

        <div className="login-kart">
          {errorMsg && (
            <Alert variant="danger" className="d-flex align-items-center gap-2 py-2 px-3 mb-3 rounded-3 small">
              <IconAlertCircle size={18} className="flex-shrink-0 text-danger" />
              <span>{errorMsg}</span>
            </Alert>
          )}

          {kurulum && (
            <Alert variant={ilkYonetici ? "info" : "light"} className="py-2 small border rounded-3 mb-3">
              <div className="fw-semibold">{sistem?.firma?.unvan || "Likya ERP"}</div>
              {ilkYonetici
                ? "İlk kurulum: programın yöneticisi olacak kullanıcıyı oluşturun. Diğer kullanıcıları içeriden açabilirsiniz."
                : `Sürüm ${sistem?.surum || ""}`}
            </Alert>
          )}

          {/* Giriş: Müşteri No (Sorgula) → Veritabanı → Kullanıcı Adı → Şifre */}
          <Form onSubmit={handleSubmit} autoComplete="off" noValidate>
            {!kurulum && (
              <>
                <Form.Group className="login-alan login-alan-satir">
                  <Form.Label htmlFor="musteriNoInput" className="login-etiket">
                    Müşteri No <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="login-govde">
                    <div className={`login-grup ${dbHata ? "hatali" : secili ? "bulundu" : ""}`}>
                      <span className="login-grup-ikon">
                        <IconId size={18} />
                      </span>
                      <Form.Control
                        id="musteriNoInput"
                        type="text"
                        autoFocus={!musteriNo}
                        value={musteriNo}
                        disabled={isLoading}
                        onChange={(e) => handleMusteriNoChange(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter formu göndermez, yalnız sorgular
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!dbAraniyor) sorgula();
                          }
                        }}
                        placeholder="Örn: D20AC0001"
                        style={{ letterSpacing: "0.5px" }}
                        autoComplete="off"
                        maxLength={20}
                      />
                      <button
                        type="button"
                        className="login-sorgula"
                        disabled={isLoading || dbAraniyor || !musteriNo}
                        onClick={() => sorgula()}
                        title="Müşteri numarasına ait veritabanlarını getir"
                      >
                        {dbAraniyor ? <Spinner animation="border" size="sm" /> : <IconSearch size={16} />}
                        <span>Sorgula</span>
                      </button>
                    </div>
                    {dbHata ? (
                      <div className="login-hata">
                        <IconAlertCircle size={14} />
                        {dbHata}
                      </div>
                    ) : !sorgulanan ? (
                      <div className="login-ipucu">Numarayı yazıp Enter'a basın ya da Sorgula'ya tıklayın.</div>
                    ) : null}
                  </div>
                </Form.Group>

                {/* Veritabanı: tek ise doğrudan gösterilir, birden çoksa seçilir */}
                <Form.Group className="login-alan login-alan-satir">
                  <Form.Label htmlFor="veritabaniSecim" className="login-etiket">
                    Veritabanı <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="login-govde">
                    <div className={`login-grup ${secili ? "bulundu" : ""}`}>
                      <span className="login-grup-ikon">
                        <IconDatabase size={18} />
                      </span>
                      {veritabanlari.length > 1 ? (
                        <Form.Select
                          id="veritabaniSecim"
                          value={firmaId || ""}
                          disabled={isLoading}
                          onChange={(e) => setFirmaId(Number(e.target.value) || 0)}
                        >
                          <option value="">Veritabanı seçiniz ({veritabanlari.length})</option>
                          {veritabanlari.map((v) => (
                            <option key={v.firmaId} value={v.firmaId}>
                              {v.unvan} — {v.dbName}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <Form.Control
                          id="veritabaniSecim"
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={secili ? `${secili.unvan} — ${secili.dbName}` : ""}
                          placeholder={dbAraniyor ? "Aranıyor..." : "Müşteri no sorgulanınca gelir"}
                        />
                      )}
                      {secili && (
                        <span className="login-grup-ikon pe-3" style={{ color: "#15803d" }}>
                          <IconCircleCheck size={18} />
                        </span>
                      )}
                    </div>
                  </div>
                </Form.Group>
              </>
            )}

            {kurulum && ilkYonetici && (
              <Form.Group className="login-alan login-alan-satir">
                <Form.Label className="login-etiket">Ad Soyad</Form.Label>
                <div className="login-govde">
                  <div className="login-grup">
                    <span className="login-grup-ikon">
                      <IconUser size={18} />
                    </span>
                    <Form.Control value={ilkAdSoyad} disabled={isLoading} onChange={(e) => setIlkAdSoyad(e.target.value)} maxLength={100} />
                  </div>
                </div>
              </Form.Group>
            )}

            <Form.Group className="login-alan login-alan-satir">
              <Form.Label htmlFor="kullaniciAdiInput" className="login-etiket">
                Kullanıcı Adı <span className="text-danger">*</span>
              </Form.Label>
              <div className="login-govde">
                <div className="login-grup">
                  <span className="login-grup-ikon">
                    <IconUser size={18} />
                  </span>
                  <Form.Control
                    ref={kullaniciAdiRef}
                    id="kullaniciAdiInput"
                    type="text"
                    autoFocus={!!musteriNo || kurulum}
                    value={username}
                    disabled={isLoading}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>
            </Form.Group>

            <Form.Group className="login-alan login-alan-satir">
              <Form.Label htmlFor="passwordInput" className="login-etiket">
                Şifre <span className="text-danger">*</span>
              </Form.Label>
              <div className="login-govde">
                <div className="login-grup">
                  <span className="login-grup-ikon">
                    <IconLock size={18} />
                  </span>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    name="no_autofill_pwd"
                    id="passwordInput"
                    autoComplete="new-password"
                    value={password}
                    disabled={isLoading}
                    onChange={(e) => setPassword(e.target.value)}
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  <button
                    type="button"
                    className="login-goz"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>
            </Form.Group>

            {kurulum && ilkYonetici && (
              <Form.Group className="login-alan login-alan-satir">
                <Form.Label className="login-etiket">Şifre tekrar</Form.Label>
                <div className="login-govde">
                  <div className="login-grup">
                    <span className="login-grup-ikon">
                      <IconLock size={18} />
                    </span>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={sifreTekrar}
                      disabled={isLoading}
                      onChange={(e) => setSifreTekrar(e.target.value)}
                    />
                  </div>
                  <div className="login-ipucu">En az 8 karakter; harf ve rakam içermeli.</div>
                </div>
              </Form.Group>
            )}

            <div className="login-alan-satir mb-3">
              <div className="login-etiket"></div>
              <div className="login-govde">
                <Form.Check
                  type="checkbox"
                  id="rememberMeCheck"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange(e.target.checked)}
                  label={<span className="small" style={{ color: "#6b5a45" }}>Beni hatırla</span>}
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="login-gir d-flex align-items-center justify-content-center gap-2">
              {isLoading ? (
                <>
                  <Spinner animation="border" size="sm" />
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <span>{kurulum && ilkYonetici ? "Yöneticiyi Oluştur ve Gir" : "Sisteme Giriş Yap"}</span>
                  <IconArrowRight size={18} />
                </>
              )}
            </Button>
          </Form>
        </div>

        <div className="login-alt">Likya ERP · v2026 Enterprise</div>
      </div>

      <LisansKilitPenceresi
        bilgi={kilit}
        kapat={kilitKapatilabilir ? () => setKilit(null) : undefined}
        yuklendi={() => {
          setKilit(null);
          kurulumuYukle();
        }}
      />

      <Modal show={!!engel} onHide={() => setEngel(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5" className="d-flex align-items-center gap-2">
            <IconAlertCircle size={22} className="text-danger" />
            {engel?.baslik}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{engel?.mesaj}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEngel(null)}>
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LoginPage;

