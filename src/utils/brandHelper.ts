import { UserProfileDto } from "../services/userService";

export interface BrandInfo {
  prefix: string; // "LİKYA"
  suffix: string; // "ERP" | "DÖVİZ" | "GÜMÜŞ" | "KUYUM" ...
  fullTitle: string; // "LİKYA ERP" | "LİKYA DÖVİZ" | ...
}

/**
 * Kullanıcının ve firmanın lisans paketine (paketAdi) veya açık modüllerine göre
 * dinamik olarak LİKYA ERP, LİKYA DÖVİZ, LİKYA GÜMÜŞ veya LİKYA KUYUM marka başlığını belirler.
 */
export function getAppBrand(user?: UserProfileDto | null): BrandInfo {
  const rawPaket = (user?.merkez?.paketAdi || "").trim();
  const paketUpper = rawPaket.toUpperCase();
  const moduller = user?.merkez?.moduller; // null veya undefined = kısıtsız (Tüm modüller açık)

  // 0. Lisansta seçilen ürünler (docs/LISANS_URUN_PAKETLERI.md): varsa başlık doğrudan bunlardan gelir.
  //    ERP → "ERP"; Connector yalnız tek başınaysa yazılır; birden fazla ürün "KUYUM + DÖVİZ" gibi birleşir.
  const urunler = user?.merkez?.urunler || [];
  if (urunler.length) {
    const URUN_SONEKI: Record<string, string> = { kuyum: "KUYUM", doviz: "DÖVİZ", gumus: "GÜMÜŞ", ticari: "TİCARİ" };
    const ana = urunler.map((u) => URUN_SONEKI[u]).filter(Boolean);
    const suffix = urunler.includes("erp") ? "ERP" : ana.length ? ana.join(" + ") : "CONNECTOR";
    return { prefix: "LİKYA", suffix, fullTitle: `LİKYA ${suffix}` };
  }

  // 1. Doğrudan Lisans Paket Adı Kontrolü (Admin Panelinden Tanımlanan Paket)
  if (paketUpper) {
    if (
      paketUpper.includes("ERP") ||
      paketUpper.includes("FULL") ||
      paketUpper.includes("KURUMSAL") ||
      paketUpper.includes("PRO") ||
      paketUpper.includes("HEPSİ")
    ) {
      return { prefix: "LİKYA", suffix: "ERP", fullTitle: "LİKYA ERP" };
    }
    if (paketUpper.includes("DÖVİZ") || paketUpper.includes("DOVIZ")) {
      return { prefix: "LİKYA", suffix: "DÖVİZ", fullTitle: "LİKYA DÖVİZ" };
    }
    if (paketUpper.includes("GÜMÜŞ") || paketUpper.includes("GUMUS")) {
      return { prefix: "LİKYA", suffix: "GÜMÜŞ", fullTitle: "LİKYA GÜMÜŞ" };
    }
    if (paketUpper.includes("KUYUM") || paketUpper.includes("SARRAF") || paketUpper.includes("ALTIN")) {
      return { prefix: "LİKYA", suffix: "KUYUM", fullTitle: "LİKYA KUYUM" };
    }

    // Özel girilen paket adı varsa (Örn: "TAKICILIK", "SARRAFİYE")
    const customSuffix = rawPaket.replace(/^L[İI]KYA\s*/i, "").trim().toUpperCase();
    if (customSuffix) {
      return { prefix: "LİKYA", suffix: customSuffix, fullTitle: `LİKYA ${customSuffix}` };
    }
  }

  // 2. Modül Kısıtlamalarına Göre Akıllı Tespiti
  // Eğer modül kısıtı yoksa (null) -> Full ERP'dir
  if (moduller === null || moduller === undefined) {
    return { prefix: "LİKYA", suffix: "ERP", fullTitle: "LİKYA ERP" };
  }

  const hasVezne = moduller.some((m) => m.startsWith("vezne") || m.startsWith("ust:"));
  const hasDoviz = moduller.some((m) => m.includes("doviz") || m.includes("kur"));
  const hasSarrafAltin = moduller.some((m) => m.includes("sarraf") || m.includes("altin"));
  const hasGumusPerakende = moduller.some((m) => m.includes("gumus") || m.includes("etiket") || m.includes("perakende"));

  // Tüm ana modüller açıksa
  if (hasDoviz && hasSarrafAltin && hasGumusPerakende) {
    return { prefix: "LİKYA", suffix: "ERP", fullTitle: "LİKYA ERP" };
  }

  // Sadece Döviz odaklı ise
  if (hasDoviz && !hasSarrafAltin && !hasGumusPerakende) {
    return { prefix: "LİKYA", suffix: "DÖVİZ", fullTitle: "LİKYA DÖVİZ" };
  }

  // Sadece Gümüş / Perakende / Takı odaklı ise
  if (hasGumusPerakende && !hasSarrafAltin && !hasDoviz) {
    return { prefix: "LİKYA", suffix: "GÜMÜŞ", fullTitle: "LİKYA GÜMÜŞ" };
  }

  // Sarraf / Kuyumcu ise
  if (hasSarrafAltin) {
    return { prefix: "LİKYA", suffix: "KUYUM", fullTitle: "LİKYA KUYUM" };
  }

  return { prefix: "LİKYA", suffix: "ERP", fullTitle: "LİKYA ERP" };
}
