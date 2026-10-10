import type React from "react";
import type { Urun } from "../veri/urunler";

/** Ürünün vurgu rengini kapsayıcıya CSS değişkeni olarak verir (--u, --u-acik). */
export const urunStili = (u: Pick<Urun, "renk" | "renkAcik">): React.CSSProperties =>
  ({ "--u": u.renk, "--u-acik": u.renkAcik }) as React.CSSProperties;
