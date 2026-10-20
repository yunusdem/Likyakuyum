import { UserProfileDto } from "../services/userService";
import { ModulKaydi, modulKatalogu } from "./modulKatalogu";

/**
 * Kullanıcı görünümü (docs/KULLANICI_GORUNUM_YOL_HARITASI.md): yönetici çalışana, yönetim panelindeki modül ağacının
 * aynısında (firmanın lisansına süzülmüş) gizle/göster yapar. Etkin liste = firma lisansı − kapalılar (G2); kontrol
 * düğmeleri (G3) katalogda olmayan, yalnız kullanıcı bazında kapatılan düğmelerdir.
 */

export const KONTROL_GRUBU = "kontrol";

export const KONTROL_DUGMELERI: { key: string; baslik: string; etiketGerekli?: boolean }[] = [
  { key: "kontrol:katalog", baslik: "Katalog Aç (TV / katalog menüsü)", etiketGerekli: true },
  { key: "kontrol:tema", baslik: "Tema seçici" },
  { key: "kontrol:yenile", baslik: "Sayfayı yenile" },
  { key: "kontrol:tam-ekran", baslik: "Tam ekran" },
  { key: "kontrol:destek", baslik: "Destek zili" },
];

/** Görünümden muaf / görünümü yöneten kullanıcı (G5): merkez açıkken firma yöneticisi, değilse sistem yöneticisi */
export const gorunumYoneticisiMi = (user: UserProfileDto | null | undefined): boolean => {
  if (!user) return false;
  if (user.merkez) return !!user.merkez.firmaYoneticisi;
  return !!user.isSysAdmin || user.role === "admin";
};

/**
 * Yöneticinin göreceği ağaç: katalog firmanın lisansına süzülür (lisans null = kısıtsız, hepsi) + kontrol grubu.
 * Katalog Aç yalnız Etiket lisansı (etiket ana menüsü) açıkken listelenir.
 */
export const gorunumKatalogu = (firmaModulleri: string[] | null | undefined): ModulKaydi[] => {
  const lisans = firmaModulleri ? new Set(firmaModulleri) : null;
  const liste = modulKatalogu().filter((m) => !lisans || lisans.has(m.modulKodu));
  const etiketAcik = !lisans || lisans.has("etiket");
  let sira = liste.length;
  liste.push({ modulKodu: KONTROL_GRUBU, ustKodu: null, baslik: "Üst Çubuk Kontrol Düğmeleri", tur: "ANA", sira: sira++ });
  for (const d of KONTROL_DUGMELERI) {
    if (d.etiketGerekli && !etiketAcik) continue;
    liste.push({ modulKodu: d.key, ustKodu: KONTROL_GRUBU, baslik: d.baslik, tur: "UST_KISAYOL", sira: sira++ });
  }
  return liste;
};

/** Kapalı kümeyi ağaç kuralıyla genişletir: üstü kapalı olan düğüm de kapalıdır (kontrol grubu dahil) */
export const kapaliGenislet = (kapali: Iterable<string>): Set<string> => {
  const k = new Set(kapali);
  if (!k.size) return k;
  const katalog = gorunumKatalogu(null);
  for (let degisti = true; degisti; ) {
    degisti = false;
    for (const m of katalog) {
      if (m.ustKodu && k.has(m.ustKodu) && !k.has(m.modulKodu)) {
        k.add(m.modulKodu);
        degisti = true;
      }
    }
  }
  return k;
};

/**
 * Etkin modül listesi (G2): firma lisansı − kapalılar. Lisans null (kısıtsız) ve kapalı varsa tam katalogdan düşülür.
 * Kapalı yoksa lisans listesi aynı dizi olarak döner (AuthContext karşılaştırmaları bozulmasın).
 */
export const etkinModuller = (firmaModulleri: string[] | null | undefined, kapali: string[] | null | undefined): string[] | null => {
  if (!kapali?.length) return firmaModulleri ?? null;
  const k = kapaliGenislet(kapali);
  const kaynak = firmaModulleri ?? modulKatalogu().map((m) => m.modulKodu);
  return kaynak.filter((kod) => !k.has(kod));
};

/**
 * Sunucudan gelen profili ekrana hazırlar: yönetici olmayanda `merkez.moduller` etkin listeye iner; kapalı liste
 * `gorunumKapali`'da kalır (kontrol düğmeleri oradan okunur). Yöneticide dokunulmaz.
 */
export const profiliGorunumeGoreHazirla = <T extends UserProfileDto | null>(u: T): T => {
  if (!u || gorunumYoneticisiMi(u)) return u;
  const kapali = u.gorunumKapali;
  // Merkez bilgisi yoksa (geliştirme: merkez kapalı) lisans süzgeci zaten yok; menü kısıtı uygulanmaz, kontrol düğmeleri uygulanır
  if (!kapali?.length || !u.merkez) return u;
  return { ...u, merkez: { ...u.merkez, moduller: etkinModuller(u.merkez.moduller, kapali) } } as T;
};
