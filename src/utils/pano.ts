/**
 * Panoya kopyalama. `navigator.clipboard` yalnız güvenli bağlamda (https ya da localhost) vardır; kurulumda (exe) ağdaki
 * diğer bilgisayarlar programa http ile girdiği için orada tanımsızdır ve kopyalama sessizce çalışmıyordu. O durumda
 * eski yönteme (gizli metin kutusu + execCommand) düşülür. Kopyalanabildiyse true.
 */
export async function panoyaKopyala(metin: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(metin);
      return true;
    }
  } catch {
    /* eski yönteme düşülür */
  }
  try {
    const t = document.createElement("textarea");
    t.value = metin;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.left = "-9999px";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const tamam = document.execCommand("copy");
    document.body.removeChild(t);
    return tamam;
  } catch {
    return false;
  }
}
