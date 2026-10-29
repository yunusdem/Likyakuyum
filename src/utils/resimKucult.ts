/**
 * Hızlı satış buton resmi (docs/HIZLI_SATIS_YOL_HARITASI.md, U2): tarayıcıda en büyük kenarı `azami` piksele küçültülüp
 * JPEG data URL'ye çevrilir (saydam alan beyaz olur). Sunucuda resim kitaplığı yok; satış ekranı hızlı açılsın diye küçük tutulur.
 */
export const BUTON_RESIM_PIKSEL = 300;
/** Ürün fotoğrafı: telefon fotoğrafı (3–5 MB) olduğu gibi veritabanına yazılıyordu (kurulumda SQL Express 10 GB sınırı) */
export const URUN_RESIM_PIKSEL = 1600;

export const resimBoyutu = (gen: number, yuk: number, azami: number): { w: number; h: number } => {
  if (gen <= 0 || yuk <= 0) return { w: 0, h: 0 };
  const oran = Math.min(1, azami / Math.max(gen, yuk));
  return { w: Math.max(1, Math.round(gen * oran)), h: Math.max(1, Math.round(yuk * oran)) };
};

const resimYukle = (kaynak: string): Promise<HTMLImageElement> =>
  new Promise((tamam, hata) => {
    const img = new Image();
    img.onload = () => tamam(img);
    img.onerror = () => hata(new Error("Resim okunamadı."));
    img.src = kaynak;
  });

const dosyaOku = (dosya: File): Promise<string> =>
  new Promise((tamam, hata) => {
    const r = new FileReader();
    r.onload = () => tamam(String(r.result));
    r.onerror = () => hata(new Error("Dosya okunamadı."));
    r.readAsDataURL(dosya);
  });

/** Sunucunun kabul ettiği en büyük buton resmi (hizliSatisKural BUTON_RESIM_AZAMI ile aynı) */
const BUTON_RESIM_BAYT = 400_000;
const saydamMi = (girdi: File | string) => (girdi instanceof File ? /png|webp|gif/i.test(girdi.type) : /^data:image\/(png|webp|gif)/i.test(girdi));

/**
 * File ya da data URL → küçültülmüş data URL. PNG / WEBP / GIF kaynakta saydamlık korunur (PNG; arkada butonun zemin rengi görünür),
 * sonuç sınırı aşarsa ya da kaynak JPEG ise beyaz zeminli JPEG.
 */
export async function resimKucult(girdi: File | string, azami = BUTON_RESIM_PIKSEL, kalite = 0.85): Promise<string> {
  if (girdi instanceof File && !/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(girdi.type)) throw new Error("Yalnız resim dosyası seçilebilir (PNG, JPEG, WEBP).");
  const kaynak = typeof girdi === "string" ? girdi : await dosyaOku(girdi);
  const img = await resimYukle(kaynak);
  const { w, h } = resimBoyutu(img.naturalWidth || img.width, img.naturalHeight || img.height, azami);
  if (!w || !h) throw new Error("Resim boyutu okunamadı.");
  const tuval = document.createElement("canvas");
  tuval.width = w;
  tuval.height = h;
  const c = tuval.getContext("2d");
  if (!c) throw new Error("Tarayıcı resmi küçültemedi.");
  c.imageSmoothingQuality = "high";
  if (saydamMi(girdi)) {
    c.drawImage(img, 0, 0, w, h);
    const png = tuval.toDataURL("image/png");
    if (png.length <= BUTON_RESIM_BAYT) return png;
    c.clearRect(0, 0, w, h);
  }
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, w, h);
  c.drawImage(img, 0, 0, w, h);
  return tuval.toDataURL("image/jpeg", kalite);
}
