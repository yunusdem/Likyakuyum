<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:schold="http://www.ascc.net/xml/schematron"
                xmlns:iso="http://purl.oclc.org/dsdl/schematron"
                xmlns:xhtml="http://www.w3.org/1999/xhtml"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:earsiv="http://earsiv.efatura.gov.tr"
                xmlns:dsig="http://www.w3.org/2000/09/xmldsig#"
                xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
                xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                xmlns:cn="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
                version="1.0">
   <xsl:param name="archiveDirParameter"/>
   <xsl:param name="archiveNameParameter"/>
   <xsl:param name="fileNameParameter"/>
   <xsl:param name="fileDirParameter"/>
   <xsl:variable name="document-uri">
      <xsl:value-of select="document-uri(/)"/>
   </xsl:variable>

   <!-- Geçerli para birimi kodları listesi (ISO 4217) -->
   <xsl:variable name="CurrencyCodeList"
      select="',AED,AFN,ALL,AMD,ANG,AOA,ARS,AUD,AWG,AZN,BAM,BBD,BDT,BGN,BHD,BIF,BMD,BND,BOB,BOV,BRL,BSD,BTN,BWP,BYN,BZD,CAD,CDF,CHE,CHF,CHW,CLF,CLP,CNY,COP,COU,CRC,CUC,CUP,CVE,CZK,DJF,DKK,DOP,DZD,EEK,EGP,ERN,ETB,EUR,FJD,FKP,GBP,GEL,GHS,GIP,GMD,GNF,GTQ,GWP,GYD,HKD,HNL,HRK,HTG,HUF,IDR,ILS,INR,IQD,IRR,ISK,JMD,JOD,JPY,KES,KGS,KHR,KMF,KPW,KRW,KWD,KYD,KZT,LAK,LBP,LKR,LRD,LSL,LTL,LVL,LYD,MAD,MDL,MGA,MKD,MMK,MNT,MOP,MRU,MUR,MVR,MWK,MXN,MXV,MYR,MZN,NAD,NGN,NIO,NOK,NPR,NZD,OMR,PAB,PEN,PGK,PHP,PKR,PLN,PYG,QAR,RON,RSD,RUB,RWF,SAR,SBD,SCR,SDG,SEK,SGD,SHP,SLE,SLL,SOS,SRD,SSP,STD,STN,SVC,SYP,SZL,THB,TJS,TMT,TND,TOP,TRY,TTD,TWD,TZS,UAH,UGX,USD,USN,USS,UYI,UYU,UYW,UZS,VEF,VND,VUV,WST,XAD,XAF,XAG,XAU,XBA,XBB,XBC,XBD,XCD,XCG,XDR,XFU,XOF,XPD,XPF,XPT,XSU,XTS,XUA,XXX,VED,VES,YER,ZAR,ZMK,ZMW,ZWG,ZWL,'"/>

   <!-- Geçerli kıymetli maden kodları listesi -->
   <xsl:variable name="preciousMetalCodes"
      select="',XAU_22C,XAU_22Y,XAU_22T,XAU_22I,XAU_22B,XAU_24G,XAU_24G_1000,'"/>

   <!-- Geçerli PartyIdentification schemeID değerleri -->
   <xsl:variable name="PartyIdentificationIDType"
      select="',TCKN,VKN,SUBENO,PASAPORTNO,MUSTERITURU,'"/>

   <!-- Geçerli ProfileID değerleri -->
   <xsl:variable name="ProfileIDList"
      select="',EDOVIZBELGE,EKIYMETLIMADENBELGE,'"/>

   <!-- Geçerli CreditNoteTypeCode değerleri -->
   <xsl:variable name="CreditNoteTypeCodeList"
      select="',ALIM,SATIM,'"/>

   <!-- Geçerli PaymentMeansCode değerleri -->
   <xsl:variable name="PaymentMeansCodeList" select="',10,46,55,68,'"/>

   <!-- Geçerli MUSTERITURU değerleri -->
   <xsl:variable name="MusteriTuruList"
      select="',BANKA,GERCEKKISI,TUZELKISI,YETKILIMUESSESE,'"/>

   <!--PHASES-->
   <!--PROLOG-->
   <!--XSD TYPES FOR XSLT2-->
   <!--KEYS AND FUNCTIONS-->
   <!--DEFAULT RULES-->

   <!--MODE: SCHEMATRON-SELECT-FULL-PATH-->
   <xsl:template match="*" mode="schematron-select-full-path">
      <xsl:apply-templates select="." mode="schematron-get-full-path"/>
   </xsl:template>

   <!--MODE: SCHEMATRON-FULL-PATH-->
   <xsl:template match="*" mode="schematron-get-full-path">
      <xsl:apply-templates select="parent::*" mode="schematron-get-full-path"/>
      <xsl:text>/</xsl:text>
      <xsl:choose>
         <xsl:when test="namespace-uri()=''">
            <xsl:value-of select="name()"/>
            <xsl:variable name="p_1" select="1+count(preceding-sibling::*[name()=name(current())])"/>
            <xsl:if test="$p_1&gt;1 or following-sibling::*[name()=name(current())]">[<xsl:value-of select="$p_1"/>]</xsl:if>
         </xsl:when>
         <xsl:otherwise>
            <xsl:text>*[local-name()='</xsl:text>
            <xsl:value-of select="local-name()"/>
            <xsl:text>']</xsl:text>
            <xsl:variable name="p_2" select="1+count(preceding-sibling::*[local-name()=local-name(current())])"/>
            <xsl:if test="$p_2&gt;1 or following-sibling::*[local-name()=local-name(current())]">[<xsl:value-of select="$p_2"/>]</xsl:if>
         </xsl:otherwise>
      </xsl:choose>
   </xsl:template>
   <xsl:template match="@*" mode="schematron-get-full-path">
      <xsl:text>/</xsl:text>
      <xsl:choose>
         <xsl:when test="namespace-uri()=''">@<xsl:value-of select="name()"/>
         </xsl:when>
         <xsl:otherwise>
            <xsl:text>@*[local-name()='</xsl:text>
            <xsl:value-of select="local-name()"/>
            <xsl:text>' and namespace-uri()='</xsl:text>
            <xsl:value-of select="namespace-uri()"/>
            <xsl:text>']</xsl:text>
         </xsl:otherwise>
      </xsl:choose>
   </xsl:template>

   <!--MODE: SCHEMATRON-FULL-PATH-2-->
   <xsl:template match="node() | @*" mode="schematron-get-full-path-2">
      <xsl:for-each select="ancestor-or-self::*">
         <xsl:text>/</xsl:text>
         <xsl:value-of select="name(.)"/>
         <xsl:if test="preceding-sibling::*[name(.)=name(current())]">
            <xsl:text>[</xsl:text>
            <xsl:value-of select="count(preceding-sibling::*[name(.)=name(current())])+1"/>
            <xsl:text>]</xsl:text>
         </xsl:if>
      </xsl:for-each>
      <xsl:if test="not(self::*)">
         <xsl:text/>/@<xsl:value-of select="name(.)"/>
      </xsl:if>
   </xsl:template>
   <!--MODE: SCHEMATRON-FULL-PATH-3-->
   <xsl:template match="node() | @*" mode="schematron-get-full-path-3">
      <xsl:for-each select="ancestor-or-self::*">
         <xsl:text>/</xsl:text>
         <xsl:value-of select="name(.)"/>
         <xsl:if test="parent::*">
            <xsl:text>[</xsl:text>
            <xsl:value-of select="count(preceding-sibling::*[name(.)=name(current())])+1"/>
            <xsl:text>]</xsl:text>
         </xsl:if>
      </xsl:for-each>
      <xsl:if test="not(self::*)">
         <xsl:text/>/@<xsl:value-of select="name(.)"/>
      </xsl:if>
   </xsl:template>

   <!--MODE: GENERATE-ID-FROM-PATH -->
   <xsl:template match="/" mode="generate-id-from-path"/>
   <xsl:template match="text()" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.text-', 1+count(preceding-sibling::text()), '-')"/>
   </xsl:template>
   <xsl:template match="comment()" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.comment-', 1+count(preceding-sibling::comment()), '-')"/>
   </xsl:template>
   <xsl:template match="processing-instruction()" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.processing-instruction-', 1+count(preceding-sibling::processing-instruction()), '-')"/>
   </xsl:template>
   <xsl:template match="@*" mode="generate-id-from-path">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:value-of select="concat('.@', name())"/>
   </xsl:template>
   <xsl:template match="*" mode="generate-id-from-path" priority="-0.5">
      <xsl:apply-templates select="parent::*" mode="generate-id-from-path"/>
      <xsl:text>.</xsl:text>
      <xsl:value-of select="concat('.',name(),'-',1+count(preceding-sibling::*[name()=name(current())]),'-')"/>
   </xsl:template>

   <!--MODE: GENERATE-ID-2 -->
   <xsl:template match="/" mode="generate-id-2">U</xsl:template>
   <xsl:template match="*" mode="generate-id-2" priority="2">
      <xsl:text>U</xsl:text>
      <xsl:number level="multiple" count="*"/>
   </xsl:template>
   <xsl:template match="node()" mode="generate-id-2">
      <xsl:text>U.</xsl:text>
      <xsl:number level="multiple" count="*"/>
      <xsl:text>n</xsl:text>
      <xsl:number count="node()"/>
   </xsl:template>
   <xsl:template match="@*" mode="generate-id-2">
      <xsl:text>U.</xsl:text>
      <xsl:number level="multiple" count="*"/>
      <xsl:text>_</xsl:text>
      <xsl:value-of select="string-length(local-name(.))"/>
      <xsl:text>_</xsl:text>
      <xsl:value-of select="translate(name(),':','.')"/>
   </xsl:template>
   <!--Strip characters-->
   <xsl:template match="text()" priority="-1"/>

   <!--SCHEMA SETUP-->
   <xsl:template match="/">
      <xsl:apply-templates select="/" mode="M1"/>
   </xsl:template>

   <!--SCHEMATRON PATTERNS-->
   <!--PATTERN -->

   <xsl:variable name="NodeType" select="',baslik,belge,belgeIptal,'"/>

   <!--RULE: eArsivRaporu alt elemanları -->
   <xsl:template match="earsiv:eArsivRaporu/*" priority="1001" mode="M1">
      <xsl:choose>
         <xsl:when test="contains($NodeType, concat(',',local-name(),','))"/>
         <xsl:otherwise>Geçersiz şema elemanı: <xsl:text/>
            <xsl:value-of select="local-name()"/>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <!--RULE: eArsivRaporu -->
   <xsl:template match="earsiv:eArsivRaporu" priority="1001" mode="M1">
      <xsl:choose>
         <xsl:when test="not(earsiv:belgeIptal) or earsiv:baslik/dsig:Signature"/>
         <xsl:otherwise>belgeIptal varsa baslikta imza zorunludur.<xsl:text/>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <!--RULE: internetSatisBilgi -->
   <xsl:template match="earsiv:eArsivRaporu/earsiv:fatura/earsiv:internetSatisBilgi" priority="1000" mode="M1">
      <xsl:choose>
         <xsl:when test="earsiv:odemeSekli = 'KAPIDAODEME' or starts-with(earsiv:odemeSekli,'DIGER') or earsiv:odemeTarihi"/>
         <xsl:otherwise>
            İnternet satışlarında ödeme şekli KAPIDAODEME ya da DIGER - " " değilse, ödeme tarihi zorunludur.
            <xsl:value-of select="string('&#xA;')"/>
         </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <!-- ============================================================ -->
   <!-- RULE: Tüm CreditNote - SADECE root CreditNote (priority=900) -->
   <!-- ============================================================ -->
   <xsl:template match="/cn:CreditNote" priority="900" mode="M1">

      <!-- ===== ProfileID zorunlu + değer kontrolü ===== -->
      <xsl:choose>
         <xsl:when test="cbc:ProfileID and normalize-space(cbc:ProfileID) != '' and contains($ProfileIDList, concat(',', cbc:ProfileID, ','))"/>
         <xsl:otherwise>
            ProfileID zorunludur ve EDOVIZBELGE veya EKIYMETLIMADENBELGE olmalıdır. Mevcut değer: <xsl:value-of select="cbc:ProfileID"/>
            <xsl:value-of select="string('&#xA;')"/>
         </xsl:otherwise>
      </xsl:choose>

      <!-- ===== CreditNoteTypeCode zorunlu + değer kontrolü ===== -->
      <xsl:choose>
         <xsl:when test="cbc:CreditNoteTypeCode and normalize-space(cbc:CreditNoteTypeCode) != '' and contains($CreditNoteTypeCodeList, concat(',', cbc:CreditNoteTypeCode, ','))"/>
         <xsl:otherwise>
            CreditNoteTypeCode zorunludur ve ALIM veya SATIM olmalıdır. Mevcut değer: <xsl:value-of select="cbc:CreditNoteTypeCode"/>
            <xsl:value-of select="string('&#xA;')"/>
         </xsl:otherwise>
      </xsl:choose>

      <!-- ===== TaxTotal zorunlu ===== -->
      <xsl:choose>
         <xsl:when test="cac:TaxTotal"/>
         <xsl:otherwise>CreditNote belgesinde TaxTotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:TaxTotal) or (cac:TaxTotal/cbc:TaxAmount and normalize-space(cac:TaxTotal/cbc:TaxAmount) != '')"/>
         <xsl:otherwise>CreditNote belgesinde TaxTotal altında TaxAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:TaxTotal) or cac:TaxTotal/cac:TaxSubtotal"/>
         <xsl:otherwise>CreditNote belgesinde TaxTotal altında en az bir TaxSubtotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- TaxSubtotal çoklanabilir; her biri için kontrol -->
      <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal">
         <xsl:variable name="idx" select="position()"/>
         <xsl:choose><xsl:when test="cbc:TaxableAmount and normalize-space(cbc:TaxableAmount) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxableAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:TaxAmount and normalize-space(cbc:TaxAmount) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:CalculationSequenceNumeric and normalize-space(cbc:CalculationSequenceNumeric) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında CalculationSequenceNumeric alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:Percent and normalize-space(cbc:Percent) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında Percent alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:TaxCategory"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxCategory alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory) or cac:TaxCategory/cac:TaxScheme"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxCategory altında TaxScheme alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory/cac:TaxScheme) or (cac:TaxCategory/cac:TaxScheme/cbc:Name and normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:Name) != '')"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxScheme altında Name alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory/cac:TaxScheme) or (cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode and normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode) != '')"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxScheme altında TaxTypeCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:for-each>

      <!-- ===== PaymentMeans zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:PaymentMeans"/><xsl:otherwise>CreditNote belgesinde PaymentMeans alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans) or (cac:PaymentMeans/cbc:PaymentMeansCode and normalize-space(cac:PaymentMeans/cbc:PaymentMeansCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentMeans altında PaymentMeansCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans) or cac:PaymentMeans/cac:PayeeFinancialAccount"/><xsl:otherwise>CreditNote belgesinde PaymentMeans altında PayeeFinancialAccount alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans/cac:PayeeFinancialAccount) or (cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID and normalize-space(cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID) != '')"/><xsl:otherwise>CreditNote belgesinde PayeeFinancialAccount altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== LegalMonetaryTotal zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:LegalMonetaryTotal"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:LineExtensionAmount and normalize-space(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında LineExtensionAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount and normalize-space(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında TaxExclusiveAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount and normalize-space(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında TaxInclusiveAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:PayableAmount and normalize-space(cac:LegalMonetaryTotal/cbc:PayableAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında PayableAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== LegalMonetaryTotal en fazla 2 ondalık basamak ===== -->
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or not(contains(cac:LegalMonetaryTotal/cbc:LineExtensionAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:LineExtensionAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde LineExtensionAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount) or not(contains(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde TaxExclusiveAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount) or not(contains(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde TaxInclusiveAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(contains(cac:LegalMonetaryTotal/cbc:PayableAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:PayableAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde PayableAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:PayableAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== PaymentExchangeRate zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:PaymentExchangeRate"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:SourceCurrencyCode and normalize-space(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında SourceCurrencyCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:TargetCurrencyCode and normalize-space(cac:PaymentExchangeRate/cbc:TargetCurrencyCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında TargetCurrencyCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:CalculationRate and normalize-space(cac:PaymentExchangeRate/cbc:CalculationRate) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında CalculationRate alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== PartyIdentification schemeID listesi kontrolü ===== -->
      <xsl:for-each select=".//cac:PartyIdentification/cbc:ID[@schemeID]">
         <xsl:choose>
            <xsl:when test="contains($PartyIdentificationIDType, concat(',', @schemeID, ','))"/>
            <xsl:otherwise>
               Geçersiz PartyIdentification schemeID değeri: <xsl:value-of select="@schemeID"/>. Geçerli değerler: TCKN, VKN, SUBENO, PASAPORTNO, MUSTERITURU.
               <xsl:value-of select="string('&#xA;')"/>
            </xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== AccountingSupplierParty: tam olarak bir TCKN veya VKN ===== -->
      <xsl:variable name="supplierTCKN" select="count(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/>
      <xsl:variable name="supplierVKN"  select="count(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/>

      <xsl:choose>
         <xsl:when test="($supplierTCKN = 1 and $supplierVKN = 0) or ($supplierTCKN = 0 and $supplierVKN = 1)"/>
         <xsl:otherwise>AccountingSupplierParty/Party altında tam olarak bir TCKN veya bir VKN bulunmalıdır (ikisi birden veya hiçbiri olamaz).<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- AccountingSupplierParty TCKN varsa: 11 hane + Person zorunlu -->
      <xsl:if test="$supplierTCKN = 1">
         <xsl:variable name="supplierTCKNVal" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']"/>
         <xsl:choose>
            <xsl:when test="string-length($supplierTCKNVal) = 11"/>
            <xsl:otherwise>AccountingSupplierParty/Party altında TCKN 11 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$supplierTCKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="cac:AccountingSupplierParty/cac:Party/cac:Person"/>
            <xsl:otherwise>AccountingSupplierParty/Party altında TCKN varsa Person alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FirstName and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FirstName) != '')"/>
            <xsl:otherwise>AccountingSupplierParty/Party/Person altında FirstName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FamilyName and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FamilyName) != '')"/>
            <xsl:otherwise>AccountingSupplierParty/Party/Person altında FamilyName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:NationalityID and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:NationalityID) != '')"/>
            <xsl:otherwise>AccountingSupplierParty/Party/Person altında NationalityID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- AccountingSupplierParty VKN varsa: 10 hane + PartyName zorunlu -->
      <xsl:if test="$supplierVKN = 1">
         <xsl:variable name="supplierVKNVal" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN']"/>
         <xsl:choose>
            <xsl:when test="string-length($supplierVKNVal) = 10"/>
            <xsl:otherwise>AccountingSupplierParty/Party altında VKN 10 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$supplierVKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="cac:AccountingSupplierParty/cac:Party/cac:PartyName"/>
            <xsl:otherwise>AccountingSupplierParty/Party altında VKN varsa PartyName alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:PartyName) or (cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name) != '')"/>
            <xsl:otherwise>AccountingSupplierParty/Party/PartyName altında Name (ünvan) alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- ===== AccountingCustomerParty: tam olarak bir TCKN veya VKN ===== -->
      <xsl:variable name="customerTCKN" select="count(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/>
      <xsl:variable name="customerVKN"  select="count(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/>

      <xsl:choose>
         <xsl:when test="($customerTCKN = 1 and $customerVKN = 0) or ($customerTCKN = 0 and $customerVKN = 1)"/>
         <xsl:otherwise>AccountingCustomerParty/Party altında tam olarak bir TCKN veya bir VKN bulunmalıdır (ikisi birden veya hiçbiri olamaz).<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- AccountingCustomerParty TCKN varsa: 11 hane + Person zorunlu -->
      <xsl:if test="$customerTCKN = 1">
         <xsl:variable name="customerTCKNVal" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']"/>
         <xsl:choose>
            <xsl:when test="string-length($customerTCKNVal) = 11"/>
            <xsl:otherwise>AccountingCustomerParty/Party altında TCKN 11 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$customerTCKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="cac:AccountingCustomerParty/cac:Party/cac:Person"/>
            <xsl:otherwise>AccountingCustomerParty/Party altında TCKN varsa Person alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FirstName and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FirstName) != '')"/>
            <xsl:otherwise>AccountingCustomerParty/Party/Person altında FirstName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FamilyName and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FamilyName) != '')"/>
            <xsl:otherwise>AccountingCustomerParty/Party/Person altında FamilyName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:NationalityID and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:NationalityID) != '')"/>
            <xsl:otherwise>AccountingCustomerParty/Party/Person altında NationalityID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- AccountingCustomerParty VKN varsa: 10 hane + PartyName zorunlu -->
      <xsl:if test="$customerVKN = 1">
         <xsl:variable name="customerVKNVal" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN']"/>
         <xsl:choose>
            <xsl:when test="string-length($customerVKNVal) = 10"/>
            <xsl:otherwise>AccountingCustomerParty/Party altında VKN 10 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$customerVKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="cac:AccountingCustomerParty/cac:Party/cac:PartyName"/>
            <xsl:otherwise>AccountingCustomerParty/Party altında VKN varsa PartyName alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
         <xsl:choose>
            <xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:PartyName) or (cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name) != '')"/>
            <xsl:otherwise>AccountingCustomerParty/Party/PartyName altında Name (ünvan) alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- ===== Signature zorunlu ===== -->
      <xsl:choose>
         <xsl:when test="cac:Signature"/>
         <xsl:otherwise>CreditNote belgesinde Signature alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== Signature/ID zorunlu, schemeID="VKN_TCKN", 10 veya 11 karakter ===== -->
      <xsl:choose>
         <xsl:when test="not(cac:Signature) or (cac:Signature/cbc:ID and normalize-space(cac:Signature/cbc:ID) != '')"/>
         <xsl:otherwise>Signature altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cbc:ID) or cac:Signature/cbc:ID/@schemeID = 'VKN_TCKN'"/>
         <xsl:otherwise>Signature/ID altında schemeID sadece 'VKN_TCKN' olabilir. Mevcut değer: <xsl:value-of select="cac:Signature/cbc:ID/@schemeID"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cbc:ID) or string-length(cac:Signature/cbc:ID) = 10 or string-length(cac:Signature/cbc:ID) = 11"/>
         <xsl:otherwise>Signature/ID değeri 10 (VKN) veya 11 (TCKN) karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cbc:ID)"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== Signature/SignatoryParty/PartyIdentification: schemeID VKN veya TCKN, uzunluk kontrolü ===== -->
      <xsl:choose>
         <xsl:when test="not(cac:Signature) or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID"/>
         <xsl:otherwise>Signature/SignatoryParty altında PartyIdentification/ID alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID) or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID = 'VKN' or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID = 'TCKN'"/>
         <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID altında schemeID sadece 'VKN' veya 'TCKN' olabilir. Mevcut değer: <xsl:value-of select="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <!-- VKN ise 10 hane -->
      <xsl:if test="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN']">
         <xsl:choose>
            <xsl:when test="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN']) = 10"/>
            <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID schemeID='VKN' ise 10 karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>
      <!-- TCKN ise 11 hane -->
      <xsl:if test="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']">
         <xsl:choose>
            <xsl:when test="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']) = 11"/>
            <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID schemeID='TCKN' ise 11 karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- ===== ORTAK EK KURALLAR ===== -->
      <xsl:call-template name="ortakEkKurallar"/>

      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <!-- ============================================================ -->
   <!-- RULE: EDOVIZBELGE - Sadece root CreditNote (priority=1000)   -->
   <!-- ============================================================ -->
   <xsl:template match="/cn:CreditNote[cbc:ProfileID='EDOVIZBELGE']" priority="1000" mode="M1">

      <!-- ===== CreditNoteTypeCode değer kontrolü ===== -->
      <xsl:choose>
         <xsl:when test="cbc:CreditNoteTypeCode and normalize-space(cbc:CreditNoteTypeCode) != '' and contains($CreditNoteTypeCodeList, concat(',', cbc:CreditNoteTypeCode, ','))"/>
         <xsl:otherwise>CreditNoteTypeCode zorunludur ve ALIM veya SATIM olmalıdır. Mevcut değer: <xsl:value-of select="cbc:CreditNoteTypeCode"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
	  
	  <xsl:choose>
         <xsl:when test="not(cbc:ID) or normalize-space(cbc:ID) = ''">
            <xsl:text>ID alanı zorunludur.&#xA;</xsl:text>
         </xsl:when>
         <xsl:when test="string-length(normalize-space(cbc:ID)) != 16"> <xsl:text>ID 16 haneli olmalıdır. Mevcut: </xsl:text><xsl:value-of select="cbc:ID"/><xsl:text>&#xA;</xsl:text>
         </xsl:when>
      </xsl:choose>
      
      <xsl:choose>
         <xsl:when test="not(cbc:UUID) or normalize-space(cbc:UUID) = ''">
            <xsl:text>UUID alanı zorunludur.&#xA;</xsl:text>
         </xsl:when>
         <xsl:when test="string-length(normalize-space(cbc:UUID)) != 36"> <xsl:text>UUID 36 haneli olmalıdır. Mevcut: </xsl:text><xsl:value-of select="cbc:UUID"/><xsl:text>&#xA;</xsl:text>
         </xsl:when>
      </xsl:choose>
      
      <xsl:choose>
         <xsl:when test="not(cbc:ProfileID) or normalize-space(cbc:ProfileID) = ''">
            <xsl:text>ProfileID alanı zorunludur.&#xA;</xsl:text>
         </xsl:when>
      </xsl:choose>
      

      <!-- ===== TaxTotal zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:TaxTotal"/><xsl:otherwise>CreditNote belgesinde TaxTotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:TaxTotal) or (cac:TaxTotal/cbc:TaxAmount and normalize-space(cac:TaxTotal/cbc:TaxAmount) != '')"/><xsl:otherwise>CreditNote belgesinde TaxTotal altında TaxAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:TaxTotal) or cac:TaxTotal/cac:TaxSubtotal"/><xsl:otherwise>CreditNote belgesinde TaxTotal altında en az bir TaxSubtotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal">
         <xsl:variable name="idx" select="position()"/>
         <xsl:choose><xsl:when test="cbc:TaxableAmount and normalize-space(cbc:TaxableAmount) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxableAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:TaxAmount and normalize-space(cbc:TaxAmount) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:CalculationSequenceNumeric and normalize-space(cbc:CalculationSequenceNumeric) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında CalculationSequenceNumeric alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:Percent and normalize-space(cbc:Percent) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında Percent alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:TaxCategory"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxCategory alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory) or cac:TaxCategory/cac:TaxScheme"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxCategory altında TaxScheme alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory/cac:TaxScheme) or (cac:TaxCategory/cac:TaxScheme/cbc:Name and normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:Name) != '')"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxScheme altında Name alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory/cac:TaxScheme) or (cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode and normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode) != '')"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxScheme altında TaxTypeCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:for-each>

      <!-- ===== PaymentMeans zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:PaymentMeans"/><xsl:otherwise>CreditNote belgesinde PaymentMeans alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans) or (cac:PaymentMeans/cbc:PaymentMeansCode and normalize-space(cac:PaymentMeans/cbc:PaymentMeansCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentMeans altında PaymentMeansCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans) or cac:PaymentMeans/cac:PayeeFinancialAccount"/><xsl:otherwise>CreditNote belgesinde PaymentMeans altında PayeeFinancialAccount alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans/cac:PayeeFinancialAccount) or (cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID and normalize-space(cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID) != '')"/><xsl:otherwise>CreditNote belgesinde PayeeFinancialAccount altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== EDOVIZBELGE'YE ÖZEL: PayerFinancialAccount ===== -->
      <xsl:choose>
         <xsl:when test="not(cac:PaymentMeans) or cac:PaymentMeans/cac:PayerFinancialAccount"/>
         <xsl:otherwise>EDOVIZBELGE belgesinde PaymentMeans altında PayerFinancialAccount alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:PaymentMeans/cac:PayerFinancialAccount) or (cac:PaymentMeans/cac:PayerFinancialAccount/cbc:ID and normalize-space(cac:PaymentMeans/cac:PayerFinancialAccount/cbc:ID) != '')"/>
         <xsl:otherwise>EDOVIZBELGE belgesinde PayerFinancialAccount altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== LegalMonetaryTotal zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:LegalMonetaryTotal"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:LineExtensionAmount and normalize-space(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında LineExtensionAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount and normalize-space(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında TaxExclusiveAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount and normalize-space(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında TaxInclusiveAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:PayableAmount and normalize-space(cac:LegalMonetaryTotal/cbc:PayableAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında PayableAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== LegalMonetaryTotal en fazla 2 ondalık basamak ===== -->
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or not(contains(cac:LegalMonetaryTotal/cbc:LineExtensionAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:LineExtensionAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde LineExtensionAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount) or not(contains(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde TaxExclusiveAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount) or not(contains(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde TaxInclusiveAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(contains(cac:LegalMonetaryTotal/cbc:PayableAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:PayableAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde PayableAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:PayableAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== PaymentExchangeRate zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:PaymentExchangeRate"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:SourceCurrencyCode and normalize-space(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında SourceCurrencyCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:TargetCurrencyCode and normalize-space(cac:PaymentExchangeRate/cbc:TargetCurrencyCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında TargetCurrencyCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:CalculationRate and normalize-space(cac:PaymentExchangeRate/cbc:CalculationRate) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında CalculationRate alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== PartyIdentification schemeID listesi kontrolü ===== -->
      <xsl:for-each select=".//cac:PartyIdentification/cbc:ID[@schemeID]">
         <xsl:choose>
            <xsl:when test="contains($PartyIdentificationIDType, concat(',', @schemeID, ','))"/>
            <xsl:otherwise>Geçersiz PartyIdentification schemeID değeri: <xsl:value-of select="@schemeID"/>. Geçerli değerler: TCKN, VKN, SUBENO, PASAPORTNO, MUSTERITURU.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== AccountingSupplierParty: tam olarak bir TCKN veya VKN ===== -->
      <xsl:variable name="supplierTCKN" select="count(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/>
      <xsl:variable name="supplierVKN"  select="count(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/>

      <xsl:choose>
         <xsl:when test="($supplierTCKN = 1 and $supplierVKN = 0) or ($supplierTCKN = 0 and $supplierVKN = 1)"/>
         <xsl:otherwise>AccountingSupplierParty/Party altında tam olarak bir TCKN veya bir VKN bulunmalıdır (ikisi birden veya hiçbiri olamaz).<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <xsl:if test="$supplierTCKN = 1">
         <xsl:variable name="supplierTCKNVal" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']"/>
         <xsl:choose><xsl:when test="string-length($supplierTCKNVal) = 11"/><xsl:otherwise>AccountingSupplierParty/Party altında TCKN 11 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$supplierTCKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingSupplierParty/cac:Party/cac:Person"/><xsl:otherwise>AccountingSupplierParty/Party altında TCKN varsa Person alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FirstName and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FirstName) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/Person altında FirstName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FamilyName and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FamilyName) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/Person altında FamilyName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:NationalityID and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:NationalityID) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/Person altında NationalityID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <xsl:if test="$supplierVKN = 1">
         <xsl:variable name="supplierVKNVal" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN']"/>
         <xsl:choose><xsl:when test="string-length($supplierVKNVal) = 10"/><xsl:otherwise>AccountingSupplierParty/Party altında VKN 10 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$supplierVKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingSupplierParty/cac:Party/cac:PartyName"/><xsl:otherwise>AccountingSupplierParty/Party altında VKN varsa PartyName alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:PartyName) or (cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/PartyName altında Name (ünvan) alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <!-- ===== AccountingCustomerParty: tam olarak bir TCKN veya VKN ===== -->
      <xsl:variable name="customerTCKN" select="count(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/>
      <xsl:variable name="customerVKN"  select="count(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/>

      <xsl:choose>
         <xsl:when test="($customerTCKN = 1 and $customerVKN = 0) or ($customerTCKN = 0 and $customerVKN = 1)"/>
         <xsl:otherwise>AccountingCustomerParty/Party altında tam olarak bir TCKN veya bir VKN bulunmalıdır (ikisi birden veya hiçbiri olamaz).<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <xsl:if test="$customerTCKN = 1">
         <xsl:variable name="customerTCKNVal" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']"/>
         <xsl:choose><xsl:when test="string-length($customerTCKNVal) = 11"/><xsl:otherwise>AccountingCustomerParty/Party altında TCKN 11 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$customerTCKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingCustomerParty/cac:Party/cac:Person"/><xsl:otherwise>AccountingCustomerParty/Party altında TCKN varsa Person alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FirstName and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FirstName) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/Person altında FirstName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FamilyName and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FamilyName) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/Person altında FamilyName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:NationalityID and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:NationalityID) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/Person altında NationalityID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <xsl:if test="$customerVKN = 1">
         <xsl:variable name="customerVKNVal" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN']"/>
         <xsl:choose><xsl:when test="string-length($customerVKNVal) = 10"/><xsl:otherwise>AccountingCustomerParty/Party altında VKN 10 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$customerVKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingCustomerParty/cac:Party/cac:PartyName"/><xsl:otherwise>AccountingCustomerParty/Party altında VKN varsa PartyName alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:PartyName) or (cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/PartyName altında Name (ünvan) alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <!-- ===== EDOVIZBELGE: currencyID ISO 4217 listesinde olmalı ===== -->
      <xsl:for-each select=".//*[@currencyID]">
         <xsl:choose>
            <xsl:when test="contains($CurrencyCodeList, concat(',', @currencyID, ','))"/>
            <xsl:otherwise>EDOVIZBELGE belgesinde geçersiz para birimi kodu: <xsl:value-of select="@currencyID"/> (<xsl:value-of select="local-name()"/> alanında). Geçerli ISO 4217 kodlarından biri kullanılmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== EDOVIZBELGE: PricingExchangeRate kontrolleri ===== -->
      <xsl:choose>
         <xsl:when test="not(cac:PricingExchangeRate/cbc:SourceCurrencyCode) or contains($CurrencyCodeList, concat(',', cac:PricingExchangeRate/cbc:SourceCurrencyCode, ','))"/>
         <xsl:otherwise>EDOVIZBELGE belgesinde PricingExchangeRate altında SourceCurrencyCode değeri geçerli ISO 4217 para birimi kodlarından biri olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:PricingExchangeRate/cbc:TargetCurrencyCode) or contains($CurrencyCodeList, concat(',', cac:PricingExchangeRate/cbc:TargetCurrencyCode, ','))"/>
         <xsl:otherwise>EDOVIZBELGE belgesinde PricingExchangeRate altında TargetCurrencyCode değeri geçerli ISO 4217 para birimi kodlarından biri olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== EDOVIZBELGE: Hesaplama kontrolleri ===== -->
      <xsl:choose>
         <xsl:when test="not(cac:PaymentExchangeRate/cbc:CalculationRate) or not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or round((cac:LegalMonetaryTotal/cbc:PayableAmount * cac:PaymentExchangeRate/cbc:CalculationRate) * 100) = round(cac:LegalMonetaryTotal/cbc:LineExtensionAmount * 100)"/>
         <xsl:otherwise>EDOVIZBELGE belgesinde PayableAmount ile CalculationRate çarpımı LineExtensionAmount değerine eşit olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:PaymentExchangeRate/cbc:CalculationRate) or not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or cac:PaymentExchangeRate/cbc:CalculationRate = 0 or round((cac:LegalMonetaryTotal/cbc:LineExtensionAmount div cac:PaymentExchangeRate/cbc:CalculationRate) * 100) = round(cac:LegalMonetaryTotal/cbc:PayableAmount * 100)"/>
         <xsl:otherwise>EDOVIZBELGE belgesinde LineExtensionAmount değerinin CalculationRate değerine bölümü PayableAmount değerine eşit olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== EDOVIZBELGE - ALIM ===== -->
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'ALIM' or not(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) or contains($CurrencyCodeList, concat(',', cac:PaymentExchangeRate/cbc:SourceCurrencyCode, ','))"/>
         <xsl:otherwise>DAB (ALIM) belgesinde PaymentExchangeRate altında SourceCurrencyCode değeri geçerli ISO 4217 para birimi kodlarından biri olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'ALIM' or not(cac:PaymentExchangeRate) or cac:PaymentExchangeRate/cbc:TargetCurrencyCode = 'TRY'"/>
         <xsl:otherwise>DAB (ALIM) belgesinde PaymentExchangeRate altında TargetCurrencyCode sadece 'TRY' olarak yazılabilir.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== EDOVIZBELGE - SATIM ===== -->
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'SATIM' or not(cac:PaymentExchangeRate) or cac:PaymentExchangeRate/cbc:SourceCurrencyCode = 'TRY'"/>
         <xsl:otherwise>DSB (SATIM) belgesinde PaymentExchangeRate altında SourceCurrencyCode sadece 'TRY' olarak yazılabilir.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'SATIM' or not(cac:PaymentExchangeRate/cbc:TargetCurrencyCode) or contains($CurrencyCodeList, concat(',', cac:PaymentExchangeRate/cbc:TargetCurrencyCode, ','))"/>
         <xsl:otherwise>DSB (SATIM) belgesinde PaymentExchangeRate altında TargetCurrencyCode değeri geçerli ISO 4217 para birimi kodlarından biri olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== Signature zorunlu ===== -->
      <xsl:choose>
         <xsl:when test="cac:Signature"/>
         <xsl:otherwise>CreditNote belgesinde Signature alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature) or (cac:Signature/cbc:ID and normalize-space(cac:Signature/cbc:ID) != '')"/>
         <xsl:otherwise>Signature altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cbc:ID) or cac:Signature/cbc:ID/@schemeID = 'VKN_TCKN'"/>
         <xsl:otherwise>Signature/ID altında schemeID sadece 'VKN_TCKN' olabilir. Mevcut değer: <xsl:value-of select="cac:Signature/cbc:ID/@schemeID"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cbc:ID) or string-length(cac:Signature/cbc:ID) = 10 or string-length(cac:Signature/cbc:ID) = 11"/>
         <xsl:otherwise>Signature/ID değeri 10 (VKN) veya 11 (TCKN) karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cbc:ID)"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature) or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID"/>
         <xsl:otherwise>Signature/SignatoryParty altında PartyIdentification/ID alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID) or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID = 'VKN' or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID = 'TCKN'"/>
         <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID altında schemeID sadece 'VKN' veya 'TCKN' olabilir. Mevcut değer: <xsl:value-of select="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:if test="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN']">
         <xsl:choose>
            <xsl:when test="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN']) = 10"/>
            <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID schemeID='VKN' ise 10 karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>
      <xsl:if test="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']">
         <xsl:choose>
            <xsl:when test="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']) = 11"/>
            <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID schemeID='TCKN' ise 11 karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- ===== ORTAK EK KURALLAR ===== -->
      <xsl:call-template name="ortakEkKurallar"/>

      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <!-- ============================================================ -->
   <!-- RULE: EKIYMETLIMADENBELGE - Sadece root (priority=1000)      -->
   <!-- ============================================================ -->
   <xsl:template match="/cn:CreditNote[cbc:ProfileID='EKIYMETLIMADENBELGE']" priority="1000" mode="M1">

      <!-- ===== CreditNoteTypeCode değer kontrolü ===== -->
      <xsl:choose>
         <xsl:when test="cbc:CreditNoteTypeCode and normalize-space(cbc:CreditNoteTypeCode) != '' and contains($CreditNoteTypeCodeList, concat(',', cbc:CreditNoteTypeCode, ','))"/>
         <xsl:otherwise>CreditNoteTypeCode zorunludur ve ALIM veya SATIM olmalıdır. Mevcut değer: <xsl:value-of select="cbc:CreditNoteTypeCode"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
	  
	  
	  <xsl:choose>
         <xsl:when test="not(cbc:ID) or normalize-space(cbc:ID) = ''">
            <xsl:text>ID alanı zorunludur.&#xA;</xsl:text>
         </xsl:when>
         <xsl:when test="string-length(normalize-space(cbc:ID)) != 16"> <xsl:text>ID 16 haneli olmalıdır. Mevcut: </xsl:text><xsl:value-of select="cbc:ID"/><xsl:text>&#xA;</xsl:text>
         </xsl:when>
      </xsl:choose>
      
      <xsl:choose>
         <xsl:when test="not(cbc:UUID) or normalize-space(cbc:UUID) = ''">
            <xsl:text>UUID alanı zorunludur.&#xA;</xsl:text>
         </xsl:when>
         <xsl:when test="string-length(normalize-space(cbc:UUID)) != 36"> <xsl:text>UUID 36 haneli olmalıdır. Mevcut: </xsl:text><xsl:value-of select="cbc:UUID"/><xsl:text>&#xA;</xsl:text>
         </xsl:when>
      </xsl:choose>
      
      <xsl:choose>
         <xsl:when test="not(cbc:ProfileID) or normalize-space(cbc:ProfileID) = ''">
            <xsl:text>ProfileID alanı zorunludur.&#xA;</xsl:text>
         </xsl:when>
      </xsl:choose>
      
      
      <xsl:choose>
         <xsl:when test="not(cac:PaymentExchangeRate/cbc:CalculationRate) or not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or round((cac:LegalMonetaryTotal/cbc:PayableAmount * cac:PaymentExchangeRate/cbc:CalculationRate) * 100) = round(cac:LegalMonetaryTotal/cbc:LineExtensionAmount * 100)"/>
         <xsl:otherwise>EKIYMETLIMADEN belgesinde PayableAmount ile CalculationRate çarpımı LineExtensionAmount değerine eşit olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:PaymentExchangeRate/cbc:CalculationRate) or not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or cac:PaymentExchangeRate/cbc:CalculationRate = 0 or round((cac:LegalMonetaryTotal/cbc:LineExtensionAmount div cac:PaymentExchangeRate/cbc:CalculationRate) * 100) = round(cac:LegalMonetaryTotal/cbc:PayableAmount * 100)"/>
         <xsl:otherwise>EKIYMETLIMADEN belgesinde LineExtensionAmount değerinin CalculationRate değerine bölümü PayableAmount değerine eşit olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== TaxTotal zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:TaxTotal"/><xsl:otherwise>CreditNote belgesinde TaxTotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:TaxTotal) or (cac:TaxTotal/cbc:TaxAmount and normalize-space(cac:TaxTotal/cbc:TaxAmount) != '')"/><xsl:otherwise>CreditNote belgesinde TaxTotal altında TaxAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:TaxTotal) or cac:TaxTotal/cac:TaxSubtotal"/><xsl:otherwise>CreditNote belgesinde TaxTotal altında en az bir TaxSubtotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal">
         <xsl:variable name="idx" select="position()"/>
         <xsl:choose><xsl:when test="cbc:TaxableAmount and normalize-space(cbc:TaxableAmount) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxableAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:TaxAmount and normalize-space(cbc:TaxAmount) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:CalculationSequenceNumeric and normalize-space(cbc:CalculationSequenceNumeric) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında CalculationSequenceNumeric alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cbc:Percent and normalize-space(cbc:Percent) != ''"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında Percent alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:TaxCategory"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>] altında TaxCategory alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory) or cac:TaxCategory/cac:TaxScheme"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxCategory altında TaxScheme alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory/cac:TaxScheme) or (cac:TaxCategory/cac:TaxScheme/cbc:Name and normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:Name) != '')"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxScheme altında Name alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:TaxCategory/cac:TaxScheme) or (cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode and normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode) != '')"/><xsl:otherwise>TaxSubtotal[<xsl:value-of select="$idx"/>]/TaxScheme altında TaxTypeCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:for-each>

      <!-- ===== PaymentMeans zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:PaymentMeans"/><xsl:otherwise>CreditNote belgesinde PaymentMeans alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans) or (cac:PaymentMeans/cbc:PaymentMeansCode and normalize-space(cac:PaymentMeans/cbc:PaymentMeansCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentMeans altında PaymentMeansCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans) or cac:PaymentMeans/cac:PayeeFinancialAccount"/><xsl:otherwise>CreditNote belgesinde PaymentMeans altında PayeeFinancialAccount alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentMeans/cac:PayeeFinancialAccount) or (cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID and normalize-space(cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID) != '')"/><xsl:otherwise>CreditNote belgesinde PayeeFinancialAccount altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== LegalMonetaryTotal zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:LegalMonetaryTotal"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:LineExtensionAmount and normalize-space(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında LineExtensionAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount and normalize-space(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında TaxExclusiveAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount and normalize-space(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında TaxInclusiveAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal) or (cac:LegalMonetaryTotal/cbc:PayableAmount and normalize-space(cac:LegalMonetaryTotal/cbc:PayableAmount) != '')"/><xsl:otherwise>CreditNote belgesinde LegalMonetaryTotal altında PayableAmount alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== LegalMonetaryTotal en fazla 2 ondalık basamak ===== -->
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:LineExtensionAmount) or not(contains(cac:LegalMonetaryTotal/cbc:LineExtensionAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:LineExtensionAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde LineExtensionAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount) or not(contains(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde TaxExclusiveAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount) or not(contains(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde TaxInclusiveAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:LegalMonetaryTotal/cbc:PayableAmount) or not(contains(cac:LegalMonetaryTotal/cbc:PayableAmount, '.')) or string-length(substring-after(cac:LegalMonetaryTotal/cbc:PayableAmount, '.')) &lt;= 2"/><xsl:otherwise>CreditNote belgesinde PayableAmount en fazla 2 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="cac:LegalMonetaryTotal/cbc:PayableAmount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== PaymentExchangeRate zorunlu ===== -->
      <xsl:choose><xsl:when test="cac:PaymentExchangeRate"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:SourceCurrencyCode and normalize-space(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında SourceCurrencyCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:TargetCurrencyCode and normalize-space(cac:PaymentExchangeRate/cbc:TargetCurrencyCode) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında TargetCurrencyCode alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      <xsl:choose><xsl:when test="not(cac:PaymentExchangeRate) or (cac:PaymentExchangeRate/cbc:CalculationRate and normalize-space(cac:PaymentExchangeRate/cbc:CalculationRate) != '')"/><xsl:otherwise>CreditNote belgesinde PaymentExchangeRate altında CalculationRate alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>

      <!-- ===== PartyIdentification schemeID listesi kontrolü ===== -->
      <xsl:for-each select=".//cac:PartyIdentification/cbc:ID[@schemeID]">
         <xsl:choose>
            <xsl:when test="contains($PartyIdentificationIDType, concat(',', @schemeID, ','))"/>
            <xsl:otherwise>Geçersiz PartyIdentification schemeID değeri: <xsl:value-of select="@schemeID"/>. Geçerli değerler: TCKN, VKN, SUBENO, PASAPORTNO, MUSTERITURU.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== AccountingSupplierParty: tam olarak bir TCKN veya VKN ===== -->
      <xsl:variable name="supplierTCKN" select="count(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/>
      <xsl:variable name="supplierVKN"  select="count(cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/>

      <xsl:choose>
         <xsl:when test="($supplierTCKN = 1 and $supplierVKN = 0) or ($supplierTCKN = 0 and $supplierVKN = 1)"/>
         <xsl:otherwise>AccountingSupplierParty/Party altında tam olarak bir TCKN veya bir VKN bulunmalıdır (ikisi birden veya hiçbiri olamaz).<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <xsl:if test="$supplierTCKN = 1">
         <xsl:variable name="supplierTCKNVal" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']"/>
         <xsl:choose><xsl:when test="string-length($supplierTCKNVal) = 11"/><xsl:otherwise>AccountingSupplierParty/Party altında TCKN 11 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$supplierTCKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingSupplierParty/cac:Party/cac:Person"/><xsl:otherwise>AccountingSupplierParty/Party altında TCKN varsa Person alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FirstName and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FirstName) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/Person altında FirstName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FamilyName and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:FamilyName) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/Person altında FamilyName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:Person) or (cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:NationalityID and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:Person/cbc:NationalityID) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/Person altında NationalityID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <xsl:if test="$supplierVKN = 1">
         <xsl:variable name="supplierVKNVal" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN']"/>
         <xsl:choose><xsl:when test="string-length($supplierVKNVal) = 10"/><xsl:otherwise>AccountingSupplierParty/Party altında VKN 10 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$supplierVKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingSupplierParty/cac:Party/cac:PartyName"/><xsl:otherwise>AccountingSupplierParty/Party altında VKN varsa PartyName alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingSupplierParty/cac:Party/cac:PartyName) or (cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name and normalize-space(cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name) != '')"/><xsl:otherwise>AccountingSupplierParty/Party/PartyName altında Name (ünvan) alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <!-- ===== AccountingCustomerParty: tam olarak bir TCKN veya VKN ===== -->
      <xsl:variable name="customerTCKN" select="count(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/>
      <xsl:variable name="customerVKN"  select="count(cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/>

      <xsl:choose>
         <xsl:when test="($customerTCKN = 1 and $customerVKN = 0) or ($customerTCKN = 0 and $customerVKN = 1)"/>
         <xsl:otherwise>AccountingCustomerParty/Party altında tam olarak bir TCKN veya bir VKN bulunmalıdır (ikisi birden veya hiçbiri olamaz).<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <xsl:if test="$customerTCKN = 1">
         <xsl:variable name="customerTCKNVal" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']"/>
         <xsl:choose><xsl:when test="string-length($customerTCKNVal) = 11"/><xsl:otherwise>AccountingCustomerParty/Party altında TCKN 11 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$customerTCKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingCustomerParty/cac:Party/cac:Person"/><xsl:otherwise>AccountingCustomerParty/Party altında TCKN varsa Person alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FirstName and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FirstName) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/Person altında FirstName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FamilyName and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:FamilyName) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/Person altında FamilyName alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:Person) or (cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:NationalityID and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:Person/cbc:NationalityID) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/Person altında NationalityID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <xsl:if test="$customerVKN = 1">
         <xsl:variable name="customerVKNVal" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='VKN']"/>
         <xsl:choose><xsl:when test="string-length($customerVKNVal) = 10"/><xsl:otherwise>AccountingCustomerParty/Party altında VKN 10 haneli olmalıdır. Mevcut değer: <xsl:value-of select="$customerVKNVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="cac:AccountingCustomerParty/cac:Party/cac:PartyName"/><xsl:otherwise>AccountingCustomerParty/Party altında VKN varsa PartyName alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
         <xsl:choose><xsl:when test="not(cac:AccountingCustomerParty/cac:Party/cac:PartyName) or (cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name and normalize-space(cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name) != '')"/><xsl:otherwise>AccountingCustomerParty/Party/PartyName altında Name (ünvan) alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise></xsl:choose>
      </xsl:if>

      <!-- ===== EKIYMETLIMADENBELGE: currencyID - ISO 4217 VEYA preciousMetalCodes ===== -->
      <xsl:for-each select=".//*[@currencyID]">
         <xsl:choose>
            <xsl:when test="contains($CurrencyCodeList, concat(',', @currencyID, ',')) or contains($preciousMetalCodes, concat(',', @currencyID, ','))"/>
            <xsl:otherwise>EKIYMETLIMADENBELGE belgesinde geçersiz para birimi/maden kodu: <xsl:value-of select="@currencyID"/> (<xsl:value-of select="local-name()"/> alanında). Geçerli ISO 4217 veya kıymetli maden kodlarından biri kullanılmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== EKIYMETLIMADENBELGE - ALIM ===== -->
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'ALIM' or not(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) or contains($preciousMetalCodes, concat(',', cac:PaymentExchangeRate/cbc:SourceCurrencyCode, ','))"/>
         <xsl:otherwise>EKIYMETLIMADENBELGE (ALIM) belgesinde PaymentExchangeRate altında SourceCurrencyCode değeri geçerli kıymetli maden kodlarından biri olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'ALIM' or not(cac:PaymentExchangeRate) or cac:PaymentExchangeRate/cbc:TargetCurrencyCode = 'TRY'"/>
         <xsl:otherwise>EKIYMETLIMADENBELGE (ALIM) belgesinde PaymentExchangeRate altında TargetCurrencyCode sadece 'TRY' olarak yazılabilir.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== EKIYMETLIMADENBELGE - SATIM ===== -->
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'SATIM' or not(cac:PaymentExchangeRate) or cac:PaymentExchangeRate/cbc:SourceCurrencyCode = 'TRY'"/>
         <xsl:otherwise>EKIYMETLIMADENBELGE (SATIM) belgesinde PaymentExchangeRate altında SourceCurrencyCode sadece 'TRY' olarak yazılabilir.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cbc:CreditNoteTypeCode) or cbc:CreditNoteTypeCode != 'SATIM' or not(cac:PaymentExchangeRate/cbc:TargetCurrencyCode) or contains($preciousMetalCodes, concat(',', cac:PaymentExchangeRate/cbc:TargetCurrencyCode, ','))"/>
         <xsl:otherwise>EKIYMETLIMADENBELGE (SATIM) belgesinde PaymentExchangeRate altında TargetCurrencyCode değeri geçerli kıymetli maden kodlarından biri olmalıdır.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== Signature zorunlu ===== -->
      <xsl:choose>
         <xsl:when test="cac:Signature"/>
         <xsl:otherwise>CreditNote belgesinde Signature alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature) or (cac:Signature/cbc:ID and normalize-space(cac:Signature/cbc:ID) != '')"/>
         <xsl:otherwise>Signature altında ID alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cbc:ID) or cac:Signature/cbc:ID/@schemeID = 'VKN_TCKN'"/>
         <xsl:otherwise>Signature/ID altında schemeID sadece 'VKN_TCKN' olabilir. Mevcut değer: <xsl:value-of select="cac:Signature/cbc:ID/@schemeID"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cbc:ID) or string-length(cac:Signature/cbc:ID) = 10 or string-length(cac:Signature/cbc:ID) = 11"/>
         <xsl:otherwise>Signature/ID değeri 10 (VKN) veya 11 (TCKN) karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cbc:ID)"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature) or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID"/>
         <xsl:otherwise>Signature/SignatoryParty altında PartyIdentification/ID alanı zorunludur.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="not(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID) or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID = 'VKN' or cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID = 'TCKN'"/>
         <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID altında schemeID sadece 'VKN' veya 'TCKN' olabilir. Mevcut değer: <xsl:value-of select="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID/@schemeID"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:if test="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN']">
         <xsl:choose>
            <xsl:when test="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN']) = 10"/>
            <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID schemeID='VKN' ise 10 karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='VKN'])"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>
      <xsl:if test="cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']">
         <xsl:choose>
            <xsl:when test="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN']) = 11"/>
            <xsl:otherwise>Signature/SignatoryParty/PartyIdentification/ID schemeID='TCKN' ise 11 karakter olmalıdır. Mevcut uzunluk: <xsl:value-of select="string-length(cac:Signature/cac:SignatoryParty/cac:PartyIdentification/cbc:ID[@schemeID='TCKN'])"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:if>

      <!-- ===== ORTAK EK KURALLAR ===== -->
      <xsl:call-template name="ortakEkKurallar"/>

      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <xsl:template match="text()" priority="-1" mode="M1"/>
   <xsl:template match="@*|node()" priority="-2" mode="M1">
      <xsl:apply-templates select="*|comment()|processing-instruction()" mode="M1"/>
   </xsl:template>

   <!-- ============================================================ -->
   <!-- ORTAK EK KURALLAR                                            -->
   <!-- Uc CreditNote sablonundan da cagrilir. Baglam dugumu (context -->
   <!-- node) cagiran sablondaki /cn:CreditNote koku olarak kalir.    -->
   <!-- ============================================================ -->
   <xsl:template name="ortakEkKurallar">

      <!-- ===== KURAL 1: CalculationRate en fazla 6 ondalık basamak ===== -->
      <xsl:for-each select="cac:PaymentExchangeRate/cbc:CalculationRate | cac:PricingExchangeRate/cbc:CalculationRate">
         <xsl:variable name="rateVal" select="normalize-space(.)"/>
         <xsl:choose>
            <xsl:when test="not(contains($rateVal, '.')) or string-length(substring-after($rateVal, '.')) &lt;= 6"/>
            <xsl:otherwise><xsl:value-of select="local-name(..)"/> altında CalculationRate en fazla 6 ondalık basamak içerebilir. Mevcut değer: <xsl:value-of select="$rateVal"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== KURAL 2: IssueDate zorunlu ve yyyy-MM-dd biçiminde ===== -->
      <xsl:variable name="issueDateVal" select="normalize-space(cbc:IssueDate)"/>
      <xsl:choose>
         <xsl:when test="not(cbc:IssueDate) or $issueDateVal = ''">IssueDate alanı zorunludur ve boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:when>
         <xsl:when test="string-length($issueDateVal) != 10 or translate($issueDateVal, '0123456789', '##########') != '####-##-##'">IssueDate alanı yyyy-MM-dd biçiminde olmalıdır. Mevcut değer: <xsl:value-of select="$issueDateVal"/><xsl:value-of select="string('&#xA;')"/></xsl:when>
         <xsl:when test="number(substring($issueDateVal, 6, 2)) &lt; 1 or number(substring($issueDateVal, 6, 2)) &gt; 12">IssueDate alanındaki ay değeri 01 ile 12 arasında olmalıdır. Mevcut değer: <xsl:value-of select="$issueDateVal"/><xsl:value-of select="string('&#xA;')"/></xsl:when>
         <xsl:when test="number(substring($issueDateVal, 9, 2)) &lt; 1 or number(substring($issueDateVal, 9, 2)) &gt; 31">IssueDate alanındaki gün değeri 01 ile 31 arasında olmalıdır. Mevcut değer: <xsl:value-of select="$issueDateVal"/><xsl:value-of select="string('&#xA;')"/></xsl:when>
      </xsl:choose>

      <!-- ===== KURAL 3: Tam olarak iki PaymentMeans; biri Payee, digeri Payer ===== -->
      <xsl:variable name="pmCount" select="count(cac:PaymentMeans)"/>
      <xsl:variable name="pmPayee" select="count(cac:PaymentMeans[cac:PayeeFinancialAccount])"/>
      <xsl:variable name="pmPayer" select="count(cac:PaymentMeans[cac:PayerFinancialAccount])"/>
      <xsl:variable name="pmBoth" select="count(cac:PaymentMeans[cac:PayeeFinancialAccount and cac:PayerFinancialAccount])"/>
      <xsl:choose>
         <xsl:when test="$pmCount = 2"/>
         <xsl:otherwise>CreditNote belgesinde tam olarak iki adet PaymentMeans alanı bulunmalıdır. Mevcut adet: <xsl:value-of select="$pmCount"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
         <xsl:when test="$pmPayee = 1 and $pmPayer = 1 and $pmBoth = 0"/>
         <xsl:otherwise>PaymentMeans alanlarından biri PayeeFinancialAccount, diğeri PayerFinancialAccount içermelidir; ikisi aynı PaymentMeans altında yer alamaz. PayeeFinancialAccount içeren: <xsl:value-of select="$pmPayee"/>, PayerFinancialAccount içeren: <xsl:value-of select="$pmPayer"/>, ikisini birlikte içeren: <xsl:value-of select="$pmBoth"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== KURAL 4: PaymentMeansCode sadece 10, 46, 55, 68 ===== -->
      <xsl:for-each select="cac:PaymentMeans/cbc:PaymentMeansCode">
         <xsl:choose>
            <xsl:when test="contains($PaymentMeansCodeList, concat(',', normalize-space(.), ','))"/>
            <xsl:otherwise>Geçersiz PaymentMeansCode değeri: <xsl:value-of select="."/>. Geçerli değerler: 10, 46, 55, 68.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== KURAL 5: PaymentExchangeRate Source ile Target ayni olamaz ===== -->
      <xsl:choose>
         <xsl:when test="not(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) or not(cac:PaymentExchangeRate/cbc:TargetCurrencyCode) or normalize-space(cac:PaymentExchangeRate/cbc:SourceCurrencyCode) != normalize-space(cac:PaymentExchangeRate/cbc:TargetCurrencyCode)"/>
         <xsl:otherwise>PaymentExchangeRate altında SourceCurrencyCode ile TargetCurrencyCode aynı para birimi olamaz. Mevcut değer: <xsl:value-of select="cac:PaymentExchangeRate/cbc:SourceCurrencyCode"/><xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== KURAL 6: MUSTERITURU degeri kod listesinde olmali ===== -->
      <xsl:for-each select=".//cac:PartyIdentification/cbc:ID[@schemeID='MUSTERITURU']">
         <xsl:choose>
            <xsl:when test="contains($MusteriTuruList, concat(',', normalize-space(.), ','))"/>
            <xsl:otherwise>Geçersiz MUSTERITURU değeri: <xsl:value-of select="."/>. Geçerli değerler: BANKA, GERCEKKISI, TUZELKISI, YETKILIMUESSESE.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
         </xsl:choose>
      </xsl:for-each>

      <!-- ===== KURAL 7: AccountingSupplierParty altinda SUBENO zorunlu ve dolu ===== -->
      <xsl:variable name="supplierSubeNo" select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='SUBENO']"/>
      <xsl:choose>
         <xsl:when test="$supplierSubeNo and normalize-space($supplierSubeNo) != ''"/>
         <xsl:otherwise>CreditNote belgesinde AccountingSupplierParty altında schemeID="SUBENO" olan PartyIdentification alanı zorunludur ve içeriği boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

      <!-- ===== KURAL 8: AccountingCustomerParty altinda MUSTERITURU zorunlu ve dolu ===== -->
      <xsl:variable name="customerMusteriTuru" select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID='MUSTERITURU']"/>
      <xsl:choose>
         <xsl:when test="$customerMusteriTuru and normalize-space($customerMusteriTuru) != ''"/>
         <xsl:otherwise>CreditNote belgesinde AccountingCustomerParty altında schemeID="MUSTERITURU" olan PartyIdentification alanı zorunludur ve içeriği boş olamaz.<xsl:value-of select="string('&#xA;')"/></xsl:otherwise>
      </xsl:choose>

   </xsl:template>

</xsl:stylesheet>