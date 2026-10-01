import React from "react";
import { IconArrowsMaximize, IconArrowsMinimize, IconEyeOff, IconExternalLink, IconArrowUpRight, IconArrowDownRight } from "@tabler/icons-react";
import type { PiyasaKaynak, PiyasaSatiri, PiyasaGrubu } from "../../services/piyasaService";
import Deger from "./Deger";
import { kaynakGorunum, saatYaz, suzgeceUyar, yuzdeYaz, type EnIyi, type Suzgec } from "./piyasaBicim";

interface Props {
  kaynak: PiyasaKaynak;
  suzgec: Suzgec;
  arama: string;
  enIyiler: Map<string, EnIyi>;
  parlat: boolean;
  buyuk: boolean;
  onBuyut: () => void;
  onGizle: () => void;
}

const DURUM_YAZI = { canli: "Canlı", bekliyor: "Bağlanıyor", kopuk: "Bağlantı yok" } as const;

const aramaUyar = (s: PiyasaSatiri, q: string) =>
  !q || `${s.ad} ${s.altAd ?? ""} ${s.kod}`.toLocaleLowerCase("tr-TR").includes(q);

const Satir: React.FC<{ s: PiyasaSatiri; enIyi?: EnIyi; parlat: boolean }> = ({ s, enIyi, parlat }) => {
  const karsilastir = !!enIyi && enIyi.sayi >= 2;
  const enIyiAlis = karsilastir && s.alis !== null && s.alis === enIyi!.alis;
  const enIyiSatis = karsilastir && s.satis !== null && s.satis === enIyi!.satis;
  return (
    <div className="pz-satir">
      <div className="pz-satir-ad">
        <span className="pz-ad">{s.ad}</span>
        {s.altAd && <span className="pz-altad">{s.altAd}</span>}
      </div>
      <Deger
        deger={s.alis}
        ondalik={s.ondalik}
        yon={s.yon}
        parlat={parlat}
        className={`pz-alis ${enIyiAlis ? "pz-eniyi-alis" : ""}`}
        title={enIyiAlis ? "Kaynaklar arasında en yüksek alış" : undefined}
      />
      <Deger
        deger={s.satis}
        ondalik={s.ondalik}
        yon={s.yon}
        parlat={parlat}
        className={`pz-satis ${enIyiSatis ? "pz-eniyi-satis" : ""}`}
        title={enIyiSatis ? "Kaynaklar arasında en düşük satış" : undefined}
      />
      <span className={`pz-yon ${s.yon === "yukari" ? "pz-yukari" : s.yon === "asagi" ? "pz-asagi" : ""}`}>
        {s.degisim !== null && s.degisim !== undefined ? (
          <span className={`pz-yuzde ${s.degisim > 0 ? "pz-yukari" : s.degisim < 0 ? "pz-asagi" : ""}`}>{yuzdeYaz(s.degisim)}</span>
        ) : s.yon === "yukari" ? (
          <IconArrowUpRight size={14} stroke={2.4} />
        ) : s.yon === "asagi" ? (
          <IconArrowDownRight size={14} stroke={2.4} />
        ) : null}
      </span>
    </div>
  );
};

const IscilikSatiri: React.FC<{ s: PiyasaSatiri; parlat: boolean }> = ({ s, parlat }) => (
  <div className="pz-satir pz-satir-4">
    <div className="pz-satir-ad">
      <span className="pz-ad">{s.ad}</span>
    </div>
    <Deger deger={s.alis} ondalik={s.ondalik} yon={s.yon} parlat={parlat} className="pz-alis" />
    <Deger deger={s.satis} ondalik={s.ondalik} yon={s.yon} parlat={parlat} className="pz-satis" />
    <Deger deger={s.eskiAlis} ondalik={s.ondalik} parlat={false} className="pz-alis pz-eski" />
    <Deger deger={s.eskiSatis} ondalik={s.ondalik} parlat={false} className="pz-satis pz-eski" />
  </div>
);

const Grup: React.FC<{ g: PiyasaGrubu; satirlar: PiyasaSatiri[]; enIyiler: Map<string, EnIyi>; parlat: boolean }> = ({
  g,
  satirlar,
  enIyiler,
  parlat,
}) => {
  const dort = g.tur === "yeni-eski";
  return (
    <section className="pz-grup">
      <div className={`pz-grup-baslik ${dort ? "pz-satir-4" : ""}`}>
        <span className="pz-grup-ad">
          {g.baslik}
          <span className="pz-grup-sayi">{satirlar.length}</span>
        </span>
        {dort ? (
          <>
            <span>Yeni Alış</span>
            <span>Yeni Satış</span>
            <span>Eski Alış</span>
            <span>Eski Satış</span>
          </>
        ) : (
          <>
            <span>Alış</span>
            <span>Satış</span>
            <span />
          </>
        )}
      </div>
      {satirlar.map((s) =>
        dort ? (
          <IscilikSatiri key={s.kod} s={s} parlat={parlat} />
        ) : (
          <Satir key={s.kod} s={s} enIyi={s.ortakKod ? enIyiler.get(s.ortakKod) : undefined} parlat={parlat} />
        ),
      )}
    </section>
  );
};

const KaynakKarti: React.FC<Props> = ({ kaynak, suzgec, arama, enIyiler, parlat, buyuk, onBuyut, onGizle }) => {
  const gor = kaynakGorunum(kaynak.kod, kaynak.ad);
  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const gruplar = kaynak.gruplar
    .filter((g) => suzgeceUyar(g.kod, suzgec))
    .map((g) => ({ g, satirlar: g.satirlar.filter((s) => aramaUyar(s, q)) }))
    .filter((x) => x.satirlar.length > 0);
  const toplam = gruplar.reduce((a, x) => a + x.satirlar.length, 0);

  return (
    <article className={`pz-kart pz-durum-${kaynak.durum} ${buyuk ? "pz-kart-buyuk" : ""}`} style={{ "--pz-kaynak": gor.renk } as React.CSSProperties}>
      <div className="pz-kart-ust">
        <span className="pz-monogram" aria-hidden>
          {gor.kisa}
        </span>
        <div className="pz-kart-kimlik">
          <div className="pz-kart-ad">{kaynak.ad}</div>
          <a className="pz-kart-site" href={`https://${kaynak.site}`} target="_blank" rel="noreferrer noopener">
            {kaynak.site}
            <IconExternalLink size={11} />
          </a>
        </div>
        <div className="pz-kart-durum" title={kaynak.hata ?? undefined}>
          <span className="pz-nokta" />
          <span>{DURUM_YAZI[kaynak.durum]}</span>
          <span className="pz-kart-saat">{saatYaz(kaynak.sonGuncelleme)}</span>
        </div>
        <div className="pz-kart-dugmeler">
          <button type="button" className="pz-ikon-dugme" onClick={onBuyut} title={buyuk ? "Küçült" : "Büyüt"}>
            {buyuk ? <IconArrowsMinimize size={15} /> : <IconArrowsMaximize size={15} />}
          </button>
          <button type="button" className="pz-ikon-dugme" onClick={onGizle} title="Bu kaynağı gizle">
            <IconEyeOff size={15} />
          </button>
        </div>
      </div>

      <div className="pz-kart-govde">
        {kaynak.durum === "bekliyor" && !kaynak.gruplar.length ? (
          <div className="pz-iskelet">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        ) : !kaynak.gruplar.length ? (
          <div className="pz-bos">
            <strong>Bu kaynaktan veri alınamıyor</strong>
            <span>{kaynak.hata ?? "Site yanıt vermedi"}</span>
            <span>Bağlantı arka planda yeniden deneniyor.</span>
          </div>
        ) : toplam === 0 ? (
          <div className="pz-bos">
            <span>Bu süzgeçte kalem yok</span>
          </div>
        ) : (
          gruplar.map(({ g, satirlar }, i) => (
            <Grup key={`${g.kod}-${i}`} g={g} satirlar={satirlar} enIyiler={enIyiler} parlat={parlat} />
          ))
        )}
      </div>
      {kaynak.durum === "kopuk" && kaynak.gruplar.length > 0 && (
        <div className="pz-kart-uyari">Bağlantı koptu — son alınan fiyatlar gösteriliyor ({saatYaz(kaynak.sonGuncelleme)})</div>
      )}
    </article>
  );
};

export default React.memo(KaynakKarti);
