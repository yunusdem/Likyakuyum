/**
 * GİB mükellef sorgusundan (getUserList_EFatura) dönen kullanıcı kaydını
 * form alanlarına dönüştüren yardımcılar. GİB "e-posta" döndürmez; posta kutusu
 * etiketi (alias) çoğu zaman `urn:mail:adres@firma.com` biçimindedir, buradan e-posta türetilir.
 */
export interface GibKullanici {
  Identifier?: string;
  Alias?: string;
  Title?: string;
  Type?: string;
}

/** Alias'tan e-posta türetir; e-posta biçiminde değilse boş döner. */
export const gibAliasToEposta = (alias?: string): string => {
  const a = (alias || "").trim().replace(/^urn:mail:/i, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a) ? a.toLowerCase() : "";
};

/** Unvanı ad + soyad olarak ayırır (son kelime soyad). */
export const gibTitleToAdSoyad = (title?: string): { ad: string; soyad: string } => {
  const parca = (title || "").trim().split(/\s+/).filter(Boolean);
  if (parca.length <= 1) return { ad: parca[0] || "", soyad: "" };
  const soyad = parca.pop()!;
  return { ad: parca.join(" "), soyad };
};

/** Listedeki alias/unvan değerlerini tekilleştirip ekranda seçilebilir hale getirir. */
export const gibKullanicilariTekillestir = (liste: GibKullanici[]): GibKullanici[] => {
  const gorulen = new Set<string>();
  return liste.filter((k) => {
    const anahtar = `${(k.Alias || k.Identifier || "").toLowerCase()}|${(k.Title || "").toLowerCase()}`;
    if (gorulen.has(anahtar)) return false;
    gorulen.add(anahtar);
    return true;
  });
};
