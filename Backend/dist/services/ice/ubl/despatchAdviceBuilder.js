import { randomUUID } from "crypto";
import { escapeXml } from "../ice.client.js";
import { ApiError } from "../../../utils/ApiError.js";
import { kimlikSemasi } from "./invoiceBuilder.js";
/* ==========================================================================
   Yardımcılar
   ========================================================================== */
const miktarStr = (n) => String(Math.round(n * 100000) / 100000);
const bugun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const simdi = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Istanbul", hour12: false });
const etiket = (ad, deger) => {
    if (deger === undefined || deger === null || String(deger).trim() === "")
        return "";
    return `<${ad}>${escapeXml(deger)}</${ad}>`;
};
const gecerliTarih = (t) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
        return false;
    const d = new Date(t);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === t;
};
/* ==========================================================================
   Doğrulama
   ========================================================================== */
export const dogrulaIrsaliye = (girdi) => {
    const belgeNo = girdi.belgeNo?.trim() || "";
    if (!/^[A-Z0-9]{3}\d{13}$/.test(belgeNo)) {
        throw ApiError.badRequest("İrsaliye numarası 3 karakter seri + 13 hane biçiminde olmalıdır. Örnek: ABC2026000000001");
    }
    const tarih = girdi.tarih || bugun();
    if (!gecerliTarih(tarih)) {
        throw ApiError.badRequest("Geçerli bir düzenleme tarihi giriniz.");
    }
    if (belgeNo.slice(3, 7) !== tarih.slice(0, 4)) {
        throw ApiError.badRequest("Belge numarasındaki yıl, düzenleme tarihiyle aynı olmalıdır.");
    }
    for (const [ad, taraf] of [
        ["Gönderici", girdi.gonderici],
        ["Alıcı", girdi.alici],
    ]) {
        const kimlik = taraf?.vknTckn?.trim() || "";
        if (!/^\d{10}$|^\d{11}$/.test(kimlik)) {
            throw ApiError.badRequest(`${ad} VKN/TCKN 10 veya 11 haneli rakam olmalıdır.`);
        }
        if (kimlik.length === 11 && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
            throw ApiError.badRequest(`${ad} TCKN ile tanımlandığında ad ve soyad zorunludur.`);
        }
        if (!taraf.unvan?.trim() && !(taraf.ad?.trim() && taraf.soyad?.trim())) {
            throw ApiError.badRequest(`${ad} için unvan ya da ad+soyad girilmelidir.`);
        }
        // UBL-TR AddressType'ta CitySubdivisionName (ilçe) ve CityName (il) zorunludur;
        // eksikse ICE şema doğrulaması "PostalAddress ... geçersiz Country alt öğesi" der.
        if (!taraf.ilce?.trim() || !taraf.il?.trim()) {
            throw ApiError.badRequest(`${ad} adresinde il ve ilçe zorunludur (UBL-TR kuralı).` +
                (ad === "Gönderici" ? " E-Belge → Bağlantı Ayarları ekranından firma il/ilçe bilgisini giriniz." : ""));
        }
    }
    if (!girdi.satirlar?.length) {
        throw ApiError.badRequest("İrsaliyede en az bir satır bulunmalıdır.");
    }
    girdi.satirlar.forEach((satir, i) => {
        const no = i + 1;
        if (!satir.ad?.trim())
            throw ApiError.badRequest(`${no}. satırda mal adı zorunludur.`);
        if (!Number.isFinite(satir.miktar) || satir.miktar <= 0) {
            throw ApiError.badRequest(`${no}. satırda sevk miktarı sıfırdan büyük olmalıdır.`);
        }
    });
    const sevk = girdi.sevkiyat;
    if (!sevk)
        throw ApiError.badRequest("Sevkiyat bilgisi zorunludur.");
    if (!gecerliTarih(sevk.sevkTarihi || "")) {
        throw ApiError.badRequest("Fiili sevk tarihi YYYY-AA-GG biçiminde ve geçerli olmalıdır.");
    }
    // Sevk tarihi düzenleme tarihinden önce olamaz
    if (sevk.sevkTarihi < tarih) {
        throw ApiError.badRequest("Fiili sevk tarihi, irsaliye düzenleme tarihinden önce olamaz.");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(sevk.sevkSaati || "")) {
        throw ApiError.badRequest("Fiili sevk saati zorunludur ve SS:DD:SS biçiminde geçerli olmalıdır.");
    }
    if (!/^\d{5}$/.test(sevk.teslimatAdresi?.postaKodu?.trim() || "")) {
        throw ApiError.badRequest("Teslimat posta kodu 5 haneli olmalıdır.");
    }
    // 14.09.2026 itibarıyla e-İrsaliye plaka kontrolüne hazırlık:
    // taşıyıcı firma bilgisi verilmiş olsa dahi araç plakası zorunludur.
    if (!sevk.plaka?.trim()) {
        throw ApiError.badRequest("Sevkiyatta araç plakası zorunludur.");
    }
    if (sevk.tasiyici && !/^\d{10}$|^\d{11}$/.test(sevk.tasiyici.vknTckn?.trim() || "")) {
        throw ApiError.badRequest("Taşıyıcı firma VKN/TCKN 10 veya 11 haneli rakam olmalıdır.");
    }
    (sevk.soforler || []).forEach((s, i) => {
        if (!s.ad?.trim() || !s.soyad?.trim()) {
            throw ApiError.badRequest(`${i + 1}. şoför için ad ve soyad zorunludur.`);
        }
        if (s.tckn && !/^\d{11}$/.test(s.tckn.trim())) {
            throw ApiError.badRequest(`${i + 1}. şoförün TCKN'si 11 haneli olmalıdır.`);
        }
    });
    if (girdi.siparisNo && girdi.siparisTarihi && !gecerliTarih(girdi.siparisTarihi)) {
        throw ApiError.badRequest("Sipariş tarihi YYYY-AA-GG biçiminde olmalıdır.");
    }
};
/* ==========================================================================
   XML parçaları
   ========================================================================== */
const partyXml = (taraf) => {
    const kimlik = taraf.vknTckn.trim();
    const sema = kimlikSemasi(kimlik);
    const kisiAdi = [taraf.ad?.trim(), taraf.soyad?.trim()].filter(Boolean).join(" ");
    const unvan = taraf.unvan?.trim() || kisiAdi;
    return (`<cac:Party>` +
        etiket("cbc:WebsiteURI", taraf.webAdresi) +
        `<cac:PartyIdentification><cbc:ID schemeID="${sema}">${escapeXml(kimlik)}</cbc:ID></cac:PartyIdentification>` +
        (unvan ? `<cac:PartyName><cbc:Name>${escapeXml(unvan)}</cbc:Name></cac:PartyName>` : "") +
        `<cac:PostalAddress>` +
        etiket("cbc:StreetName", taraf.adres) +
        etiket("cbc:CitySubdivisionName", taraf.ilce) +
        etiket("cbc:CityName", taraf.il) +
        `<cac:Country><cbc:Name>${escapeXml(taraf.ulke || "Türkiye")}</cbc:Name></cac:Country>` +
        `</cac:PostalAddress>` +
        (taraf.vergiDairesi?.trim()
            ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${escapeXml(taraf.vergiDairesi)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>`
            : "") +
        (taraf.telefon?.trim() || taraf.eposta?.trim()
            ? `<cac:Contact>` +
                etiket("cbc:Telephone", taraf.telefon) +
                etiket("cbc:ElectronicMail", taraf.eposta) +
                `</cac:Contact>`
            : "") +
        (sema === "TCKN" && taraf.ad?.trim() && taraf.soyad?.trim()
            ? `<cac:Person><cbc:FirstName>${escapeXml(taraf.ad)}</cbc:FirstName>` +
                `<cbc:FamilyName>${escapeXml(taraf.soyad)}</cbc:FamilyName></cac:Person>`
            : "") +
        `</cac:Party>`);
};
/**
 * `cac:Shipment` — sevkiyat bilgisi.
 *
 * ShipmentType sequence: ID → … → Delivery → … ; ShipmentStage `Delivery`'den ÖNCE gelmez,
 * şema sırası: `GoodsItem[] → ShipmentStage[] → Delivery → TransportHandlingUnit[]`.
 */
const shipmentXml = (sevk, alici) => {
    const adres = {
        adres: alici.adres,
        ilce: alici.ilce,
        il: alici.il,
        ulke: alici.ulke,
        ...sevk.teslimatAdresi,
    };
    const soforXml = (sevk.soforler || [])
        .map((s) => `<cac:DriverPerson>` +
        `<cbc:FirstName>${escapeXml(s.ad)}</cbc:FirstName>` +
        `<cbc:FamilyName>${escapeXml(s.soyad)}</cbc:FamilyName>` +
        (s.tckn?.trim() ? `<cbc:NationalityID schemeID="TCKN">${escapeXml(s.tckn.trim())}</cbc:NationalityID>` : "") +
        `</cac:DriverPerson>`)
        .join("");
    const stageXml = sevk.plaka?.trim() || soforXml
        ? `<cac:ShipmentStage>` +
            (sevk.plaka?.trim()
                ? `<cac:TransportMeans><cac:RoadTransport>` +
                    `<cbc:LicensePlateID schemeID="PLAKA">${escapeXml(sevk.plaka.replace(/\s/g, "").toUpperCase())}</cbc:LicensePlateID>` +
                    `</cac:RoadTransport></cac:TransportMeans>`
                : "") +
            soforXml +
            `</cac:ShipmentStage>`
        : "";
    return (`<cac:Shipment>` +
        `<cbc:ID>1</cbc:ID>` +
        stageXml +
        `<cac:Delivery>` +
        `<cac:DeliveryAddress>` +
        etiket("cbc:StreetName", adres.adres) +
        etiket("cbc:CitySubdivisionName", adres.ilce) +
        etiket("cbc:CityName", adres.il) +
        etiket("cbc:PostalZone", adres.postaKodu) +
        `<cac:Country><cbc:Name>${escapeXml(adres.ulke || "Türkiye")}</cbc:Name></cac:Country>` +
        `</cac:DeliveryAddress>` +
        (sevk.tasiyici
            ? `<cac:CarrierParty>` +
                `<cac:PartyIdentification><cbc:ID schemeID="${kimlikSemasi(sevk.tasiyici.vknTckn)}">` +
                `${escapeXml(sevk.tasiyici.vknTckn)}</cbc:ID></cac:PartyIdentification>` +
                `<cac:PartyName><cbc:Name>${escapeXml(sevk.tasiyici.unvan)}</cbc:Name></cac:PartyName>` +
                `</cac:CarrierParty>`
            : "") +
        `<cac:Despatch>` +
        `<cbc:ActualDespatchDate>${escapeXml(sevk.sevkTarihi)}</cbc:ActualDespatchDate>` +
        `<cbc:ActualDespatchTime>${escapeXml(sevk.sevkSaati)}</cbc:ActualDespatchTime>` +
        `</cac:Despatch>` +
        `</cac:Delivery>` +
        `</cac:Shipment>`);
};
/**
 * `cac:DespatchLine` — irsaliye satırı.
 * **Tutar yoktur**: miktar, zorunlu satır referansı ve mal bilgisi.
 */
const despatchLineXml = (satir, siraNo) => `<cac:DespatchLine>` +
    `<cbc:ID>${siraNo}</cbc:ID>` +
    (satir.not?.trim() ? `<cbc:Note>${escapeXml(satir.not)}</cbc:Note>` : "") +
    `<cbc:DeliveredQuantity unitCode="${escapeXml(satir.birimKodu || "C62")}">${miktarStr(satir.miktar)}</cbc:DeliveredQuantity>` +
    `<cac:OrderLineReference><cbc:LineID>${siraNo}</cbc:LineID></cac:OrderLineReference>` +
    `<cac:Item>` +
    etiket("cbc:Description", satir.aciklama) +
    `<cbc:Name>${escapeXml(satir.ad)}</cbc:Name>` +
    etiket("cbc:BrandName", satir.marka) +
    (satir.stokKodu?.trim()
        ? `<cac:SellersItemIdentification><cbc:ID>${escapeXml(satir.stokKodu)}</cbc:ID></cac:SellersItemIdentification>`
        : "") +
    `</cac:Item>` +
    `</cac:DespatchLine>`;
export const buildDespatchAdviceXml = (girdi) => {
    dogrulaIrsaliye(girdi);
    const uuid = girdi.uuid?.trim() || randomUUID();
    const tarih = girdi.tarih?.trim() || bugun();
    const saat = girdi.saat?.trim() || simdi();
    const belgeNo = girdi.belgeNo.trim().toUpperCase();
    const notlarXml = (girdi.notlar || [])
        .filter((n) => n && n.trim())
        .map((n) => `<cbc:Note>${escapeXml(n)}</cbc:Note>`)
        .join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
        `<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"` +
        ` xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"` +
        ` xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">` +
        // ICE serileştiricisi imza icin ext:UBLExtensions ekliyor; onek burada bildirilmezse
        // "prefix ext is not bound" hatasi aliniyor. UBL-TR-de bu eleman ilk cocuk olmali.
        `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>` +
        `<cbc:UBLVersionID>2.1</cbc:UBLVersionID>` +
        `<cbc:CustomizationID>TR1.2.1</cbc:CustomizationID>` +
        `<cbc:ProfileID>${escapeXml(girdi.senaryo || "TEMELIRSALIYE")}</cbc:ProfileID>` +
        `<cbc:ID>${escapeXml(belgeNo)}</cbc:ID>` +
        `<cbc:CopyIndicator>false</cbc:CopyIndicator>` +
        `<cbc:UUID>${escapeXml(uuid)}</cbc:UUID>` +
        `<cbc:IssueDate>${escapeXml(tarih)}</cbc:IssueDate>` +
        `<cbc:IssueTime>${escapeXml(saat)}</cbc:IssueTime>` +
        `<cbc:DespatchAdviceTypeCode>${escapeXml(girdi.irsaliyeTipi)}</cbc:DespatchAdviceTypeCode>` +
        notlarXml +
        `<cbc:LineCountNumeric>${girdi.satirlar.length}</cbc:LineCountNumeric>` +
        // sequence: LineCountNumeric → OrderReference[] → AdditionalDocumentReference[] → Signature[]
        (girdi.siparisNo?.trim()
            ? `<cac:OrderReference>` +
                `<cbc:ID>${escapeXml(girdi.siparisNo)}</cbc:ID>` +
                (girdi.siparisTarihi ? `<cbc:IssueDate>${escapeXml(girdi.siparisTarihi)}</cbc:IssueDate>` : "") +
                `</cac:OrderReference>`
            : "") +
        `<cac:DespatchSupplierParty>${partyXml(girdi.gonderici)}</cac:DespatchSupplierParty>` +
        `<cac:DeliveryCustomerParty>${partyXml(girdi.alici)}</cac:DeliveryCustomerParty>` +
        shipmentXml(girdi.sevkiyat, girdi.alici) +
        girdi.satirlar.map((satir, i) => despatchLineXml(satir, i + 1)).join("") +
        `</DespatchAdvice>`;
    return { xml, uuid, satirSayisi: girdi.satirlar.length };
};
