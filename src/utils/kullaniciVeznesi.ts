/**
 * Fiş ekranlarında vezne giriş yapan kullanıcının kasasıdır (docs/YETKI_VE_VEZNE_YOL_HARITASI.md, K2): kullanıcı kartındaki
 * vezne (TODVZ_KULLANICI.VEZNE_ID; oturum profilinde vezneId, eski oturumlarda cashierCode). Ekranda değiştirilemez; sunucu
 * da yeni kayıtta kart veznesini, düzeltmede kaydın veznesini yazar. Listede bulunamazsa null döner (ilk vezneye düşülmez).
 */
export const kullaniciVeznesi = <T extends { id: number; kod?: string | null }>(
  liste: T[] | null | undefined,
  user: { vezneId?: number | null; cashierCode?: string | null } | null | undefined
): T | null => {
  if (!liste?.length || !user) return null;
  const id = Number(user.vezneId) || null;
  if (id) return liste.find((v) => v.id === id) ?? null;
  const k = String(user.cashierCode ?? "").trim().toLocaleLowerCase("tr-TR");
  if (!k) return null;
  return liste.find((v) => String(v.id) === k) ?? liste.find((v) => String(v.kod ?? "").trim().toLocaleLowerCase("tr-TR") === k) ?? null;
};
