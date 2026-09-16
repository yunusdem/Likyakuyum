import React, { useMemo } from "react";
import { Form, Row, Col } from "react-bootstrap";
import { Country, State, City, ICountry, IState, ICity } from "country-state-city";

export interface GeoLocationValue {
  countryCode: string; // ISO2: "TR", "US", "DE" vb.
  countryName: string;
  stateCode: string;   // ISO: "01", "34", "48", "CA" vb.
  stateName: string;
  cityName: string;    // "Fethiye", "Bodrum", "Kadıköy" vb.
  country: ICountry | null;
  state: IState | null;
  city: ICity | null;
}

interface CountryStateCitySelectProps {
  countryCode?: string; // ISO kodu ("TR") veya isim ("Turkey", "Turkiye", "TÜRKİYE")
  stateCode?: string;   // ISO kodu ("01", "48") veya isim ("Adana", "Muğla", "İstanbul")
  cityName?: string;    // Şehir / İlçe adı
  labelColStyle?: React.CSSProperties;
  disabled?: boolean;
  onLocationChange: (value: GeoLocationValue) => void;
  renderAfterCountry?: React.ReactNode;
}

// Türkçe karakterleri ve aksanları İngilizce/ASCII eşdeğerlerine normalize eder
export const normalizeTr = (str: any): string => {
  if (!str) return "";
  return String(str)
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Ülke girdisini (kod veya isim) kesin ISO2 koduna ("TR", "US", "DE" vb.) dönüştürür
export const resolveCountryIso = (input?: string): string => {
  if (!input) return "TR";
  const trimmed = String(input).trim();
  
  // 1. Zaten 2 karakterli geçerli bir ISO kodu mu?
  if (trimmed.length === 2) {
    const byCode = Country.getCountryByCode(trimmed.toUpperCase());
    if (byCode) return byCode.isoCode;
  }

  const allCountries = Country.getAllCountries();

  // 2. 3 karakterli ISO kodu mu? (Örn: "TUR")
  if (trimmed.length === 3) {
    const byIso3 = allCountries.find(
      (c) => (c as any).iso3?.toUpperCase() === trimmed.toUpperCase()
    );
    if (byIso3) return byIso3.isoCode;
  }

  // 3. "Turkey", "Turkiye", "Türkiye" kontrolü
  const normInput = normalizeTr(trimmed);
  if (normInput.includes("turk") || normInput === "tr") {
    return "TR";
  }

  // 4. İsim bazlı normalizasyon eşleşmesi
  const found = allCountries.find((c) => normalizeTr(c.name) === normInput);
  if (found) return found.isoCode;

  console.warn(`[CountryStateCitySelect] "${input}" için ülke ISO kodu bulunamadı, varsayılan "TR" alındı.`);
  return "TR";
};

// İl / Eyalet girdisini (kod "01" veya isim "Adana") ilgili ülkenin kesin state.isoCode değerine dönüştürür
export const resolveStateIso = (states: IState[], input?: string): string => {
  if (!input || states.length === 0) return "";
  const trimmed = String(input).trim();

  // 1. Doğrudan isoCode eşleşmesi (Örn: "01", "34", "48") veya sayısal eşleşme (Örn: 1 -> "01")
  const byCode = states.find(
    (s) =>
      s.isoCode.toUpperCase() === trimmed.toUpperCase() ||
      (!isNaN(parseInt(s.isoCode, 10)) && !isNaN(parseInt(trimmed, 10)) && parseInt(s.isoCode, 10) === parseInt(trimmed, 10))
  );
  if (byCode) return byCode.isoCode;

  // 2. Türkçe karakter ve aksan duyarsız isim eşlemesi (Örn: "İstanbul" -> "34", "Muğla" -> "48")
  const normInput = normalizeTr(trimmed);
  const byName = states.find((s) => normalizeTr(s.name) === normInput);
  if (byName) return byName.isoCode;

  // 3. Kısmi eşleşme (Örn: "Afyon" -> "Afyonkarahisar")
  const partial = states.find(
    (s) => normalizeTr(s.name).startsWith(normInput) || normInput.startsWith(normalizeTr(s.name))
  );
  if (partial) return partial.isoCode;

  return "";
};

// İlçe adını liste içinde normalize ederek eşleştirir
export const resolveCityName = (cities: ICity[], input?: string): string => {
  if (!input || cities.length === 0) return "";
  const trimmed = String(input).trim();

  const exact = cities.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact.name;

  const normInput = normalizeTr(trimmed);
  const byNorm = cities.find((c) => normalizeTr(c.name) === normInput);
  return byNorm ? byNorm.name : trimmed;
};

export const CountryStateCitySelect: React.FC<CountryStateCitySelectProps> = ({
  countryCode = "TR",
  stateCode = "",
  cityName = "",
  labelColStyle,
  disabled = false,
  onLocationChange,
  renderAfterCountry,
}) => {
  // 1. Tüm Ülkeler Listesi
  const countries = useMemo(() => {
    const all = Country.getAllCountries();
    const tr = all.find((c) => c.isoCode === "TR");
    const others = all.filter((c) => c.isoCode !== "TR").sort((a, b) => a.name.localeCompare(b.name));
    return tr ? [tr, ...others] : all;
  }, []);

  // Kesin Ülke ISO Kodu (Örn: "TR", "US", "DE")
  const resolvedCountryIso = useMemo(() => {
    return resolveCountryIso(countryCode);
  }, [countryCode]);

  // Aktif Ülke Nesnesi
  const activeCountry = useMemo(() => {
    return Country.getCountryByCode(resolvedCountryIso) || null;
  }, [resolvedCountryIso]);

  // 2. İl / Eyalet Listesi: State.getStatesOfCountry(country.isoCode)
  const states = useMemo(() => {
    if (!resolvedCountryIso) {
      console.log("[CountryStateCitySelect] Ülke ISO kodu boş, il listesi boş dönüldü.");
      return [];
    }
    const list = [...State.getStatesOfCountry(resolvedCountryIso)];
    
    // Türkiye için plaka koduna göre (01 Adana ... 81 Düzce) sıralayalım
    if (resolvedCountryIso === "TR") {
      list.sort((a, b) => parseInt(a.isoCode, 10) - parseInt(b.isoCode, 10));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    console.log(
      `[CountryStateCitySelect] İl listesi yüklendi: Ülke="${activeCountry?.name || resolvedCountryIso}" (ISO: ${resolvedCountryIso}), Eleman Sayısı=${list.length}`
    );
    if (list.length === 0) {
      console.warn(`[CountryStateCitySelect] Dikkat: "${resolvedCountryIso}" ISO koduna ait il bulunamadı!`);
    }
    return list;
  }, [resolvedCountryIso, activeCountry]);

  // Kesin İl ISO Kodu (Örn: "01", "34", "48")
  const resolvedStateIso = useMemo(() => {
    return resolveStateIso(states, stateCode);
  }, [states, stateCode]);

  // Aktif İl Nesnesi
  const activeState = useMemo(() => {
    if (!resolvedStateIso) return null;
    return states.find((s) => s.isoCode === resolvedStateIso) || null;
  }, [states, resolvedStateIso]);

  // 3. İlçe / Şehir Listesi: City.getCitiesOfState(country.isoCode, state.isoCode)
  const cities = useMemo(() => {
    if (!resolvedCountryIso || !resolvedStateIso) {
      return [];
    }
    const list = City.getCitiesOfState(resolvedCountryIso, resolvedStateIso);
    console.log(
      `[CountryStateCitySelect] İlçe listesi yüklendi: Ülke ISO="${resolvedCountryIso}", İl="${activeState?.name || resolvedStateIso}" (ISO: ${resolvedStateIso}), Eleman Sayısı=${list.length}`
    );
    if (list.length === 0) {
      console.warn(
        `[CountryStateCitySelect] Dikkat: "${resolvedCountryIso}" - "${resolvedStateIso}" için kütüphanede ilçe bulunamadı!`
      );
    }
    return list;
  }, [resolvedCountryIso, resolvedStateIso, activeState]);

  // Kesin İlçe Adı
  const resolvedCityName = useMemo(() => {
    return resolveCityName(cities, cityName);
  }, [cities, cityName]);

  // Aktif İlçe Nesnesi
  const activeCity = useMemo(() => {
    if (!resolvedCityName) return null;
    return cities.find((c) => c.name === resolvedCityName) || null;
  }, [cities, resolvedCityName]);

  // 1. Ülke Değişikliği (İl ve İlçe otomatik sıfırlanır)
  const handleCountryChange = (newCountryIso: string) => {
    console.log(`[CountryStateCitySelect] Ülke seçildi -> ISO: ${newCountryIso}`);
    const cObj = Country.getCountryByCode(newCountryIso) || null;
    onLocationChange({
      countryCode: newCountryIso,
      countryName: cObj ? cObj.name : newCountryIso,
      stateCode: "",
      stateName: "",
      cityName: "",
      country: cObj,
      state: null,
      city: null,
    });
  };

  // 2. İl Değişikliği (İlçe otomatik sıfırlanır)
  const handleStateChange = (newStateIso: string) => {
    console.log(`[CountryStateCitySelect] İl seçildi -> State ISO: ${newStateIso}`);
    const sObj = states.find((s) => s.isoCode === newStateIso) || null;
    onLocationChange({
      countryCode: resolvedCountryIso,
      countryName: activeCountry ? activeCountry.name : resolvedCountryIso,
      stateCode: newStateIso,
      stateName: sObj ? sObj.name : newStateIso,
      cityName: "",
      country: activeCountry,
      state: sObj,
      city: null,
    });
  };

  // 3. İlçe Değişikliği
  const handleCityChange = (newCityName: string) => {
    console.log(`[CountryStateCitySelect] İlçe seçildi -> Ad: ${newCityName}`);
    const cObj = cities.find((c) => c.name === newCityName) || null;
    onLocationChange({
      countryCode: resolvedCountryIso,
      countryName: activeCountry ? activeCountry.name : resolvedCountryIso,
      stateCode: resolvedStateIso,
      stateName: activeState ? activeState.name : resolvedStateIso,
      cityName: newCityName,
      country: activeCountry,
      state: activeState,
      city: cObj,
    });
  };

  return (
    <>
      {/* 1. Ülke Dropdown */}
      <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
          Ülke
        </Form.Label>
        <Col>
          <Form.Select
            value={resolvedCountryIso}
            disabled={disabled}
            onChange={(e) => handleCountryChange(e.target.value)}
          >
            <option value="">Ülke Seçiniz</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.flag} {c.name} ({c.isoCode})
              </option>
            ))}
          </Form.Select>
        </Col>
      </Form.Group>

      {/* Ülke ve İl arasına yerleştirilen Uyruk veya ek slotlar */}
      {renderAfterCountry}

      {/* 2. İl (State) Dropdown */}
      <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
          İl
        </Form.Label>
        <Col>
          {states.length > 0 ? (
            <Form.Select
              value={resolvedStateIso}
              disabled={disabled || !resolvedCountryIso}
              onChange={(e) => handleStateChange(e.target.value)}
            >
              <option value="">
                {resolvedCountryIso ? `İl / Eyalet Seçiniz (${states.length} İl)` : "Önce Ülke Seçiniz"}
              </option>
              {states.map((s) => {
                const displayName = resolvedCountryIso === "TR" && s.isoCode === "34" && s.name === "Istanbul" ? "İstanbul" : s.name;
                return (
                  <option key={s.isoCode} value={s.isoCode}>
                    {resolvedCountryIso === "TR" ? `${s.isoCode} - ${displayName}` : s.name}
                  </option>
                );
              })}
            </Form.Select>
          ) : (
            <Form.Control
              type="text"
              maxLength={50}
              placeholder={resolvedCountryIso ? "İl / Eyalet adı giriniz" : "Önce Ülke Seçiniz"}
              disabled={disabled || !resolvedCountryIso}
              value={stateCode || ""}
              onChange={(e) => {
                const val = e.target.value;
                onLocationChange({
                  countryCode: resolvedCountryIso,
                  countryName: activeCountry ? activeCountry.name : resolvedCountryIso,
                  stateCode: val,
                  stateName: val,
                  cityName: "",
                  country: activeCountry,
                  state: null,
                  city: null,
                });
              }}
            />
          )}
        </Col>
      </Form.Group>

      {/* 3. İlçe (City) Dropdown */}
      <Form.Group as={Row} className="mb-2.5 align-items-center gx-2">
        <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap">
          İlçe
        </Form.Label>
        <Col>
          {cities.length > 0 ? (
            <Form.Select
              value={resolvedCityName}
              disabled={disabled || !resolvedStateIso}
              onChange={(e) => handleCityChange(e.target.value)}
            >
              <option value="">
                {resolvedStateIso ? `İlçe / Şehir Seçiniz (${cities.length} İlçe)` : "Önce İl Seçiniz"}
              </option>
              {cities.map((city, idx) => (
                <option key={`${city.name}-${idx}`} value={city.name}>
                  {city.name}
                </option>
              ))}
            </Form.Select>
          ) : (
            <Form.Control
              type="text"
              maxLength={50}
              placeholder={resolvedStateIso ? "İlçe / Bölge giriniz" : "Önce İl Seçiniz"}
              disabled={disabled || !resolvedStateIso}
              value={cityName || ""}
              onChange={(e) => handleCityChange(e.target.value)}
            />
          )}
        </Col>
      </Form.Group>
    </>
  );
};

export default CountryStateCitySelect;
