<?xml version="1.0" encoding="UTF-8"?>
<!--
  LİKYA ERP — kuyum faturası görünümü (Kütükçü düzeni). docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF19, U7.
  Faturaya AdditionalDocumentReference ile Base64 eklenir (invoiceBuilder gorunum = "KUYUM"). XSLT 1.0.
  QR betiği ve GİB logosu GİB e-Gider Pusulası şablonundan (Backend/belge/xslt/giderPusulasi.xslt) alınmıştır.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
	xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
	xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
	exclude-result-prefixes="cac cbc n1">
	<xsl:decimal-format name="tr" decimal-separator="," grouping-separator="." NaN=""/>
	<xsl:output method="html" indent="no" encoding="UTF-8" doctype-public="-//W3C//DTD HTML 4.01 Transitional//EN" doctype-system="http://www.w3.org/TR/html4/loose.dtd"/>

	<xsl:variable name="F" select="/n1:Invoice"/>
	<xsl:variable name="earsiv" select="$F/cbc:ProfileID = 'EARSIVFATURA'"/>
	<xsl:variable name="pb">
		<xsl:choose>
			<xsl:when test="not($F/cbc:DocumentCurrencyCode) or $F/cbc:DocumentCurrencyCode = 'TRY' or $F/cbc:DocumentCurrencyCode = 'TL'">TL</xsl:when>
			<xsl:otherwise><xsl:value-of select="$F/cbc:DocumentCurrencyCode"/></xsl:otherwise>
		</xsl:choose>
	</xsl:variable>

	<xsl:template name="para">
		<xsl:param name="d"/>
		<xsl:value-of select="format-number($d, '#.##0,00', 'tr')"/>
		<xsl:text> </xsl:text>
		<xsl:value-of select="$pb"/>
	</xsl:template>

	<xsl:template name="tarih">
		<xsl:param name="d"/>
		<xsl:param name="ayrac" select="' - '"/>
		<xsl:value-of select="concat(substring($d, 9, 2), $ayrac, substring($d, 6, 2), $ayrac, substring($d, 1, 4))"/>
	</xsl:template>

	<xsl:template name="birim">
		<xsl:param name="k"/>
		<xsl:choose>
			<xsl:when test="$k = 'GRM'">Gram</xsl:when>
			<xsl:when test="$k = 'KGM'">Kg</xsl:when>
			<xsl:when test="$k = 'C62' or $k = 'NIU'">Adet</xsl:when>
			<xsl:when test="$k = 'MTR'">Metre</xsl:when>
			<xsl:when test="$k = 'LTR'">Litre</xsl:when>
			<xsl:otherwise><xsl:value-of select="$k"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<!-- Taraf bloğu: Kütükçü düzeninde satıcı ve alıcı aynı biçimde -->
	<xsl:template name="taraf">
		<xsl:param name="p"/>
		<div class="ad">
			<xsl:choose>
				<xsl:when test="normalize-space($p/cac:PartyName/cbc:Name)"><xsl:value-of select="$p/cac:PartyName/cbc:Name"/></xsl:when>
				<xsl:otherwise><xsl:value-of select="concat($p/cac:Person/cbc:FirstName, ' ', $p/cac:Person/cbc:FamilyName)"/></xsl:otherwise>
			</xsl:choose>
		</div>
		<xsl:variable name="a" select="$p/cac:PostalAddress"/>
		<div>
			<xsl:value-of select="$a/cbc:StreetName"/>
			<xsl:if test="normalize-space($a/cbc:BuildingName)"><xsl:value-of select="concat(' ', $a/cbc:BuildingName)"/></xsl:if>
			<xsl:if test="normalize-space($a/cbc:BuildingNumber)"><xsl:value-of select="concat(' No:', $a/cbc:BuildingNumber)"/></xsl:if>
			<xsl:if test="normalize-space($a/cbc:Room)"><xsl:value-of select="concat(' D:', $a/cbc:Room)"/></xsl:if>
			<xsl:text>   </xsl:text>
			<xsl:value-of select="$a/cbc:CitySubdivisionName"/>
			<xsl:text>/ </xsl:text>
			<xsl:value-of select="$a/cbc:CityName"/>
			<xsl:if test="normalize-space($a/cac:Country/cbc:Name)"><xsl:value-of select="concat(' /', $a/cac:Country/cbc:Name)"/></xsl:if>
		</div>
		<div>Tel: <xsl:value-of select="$p/cac:Contact/cbc:Telephone"/> Fax: <xsl:value-of select="$p/cac:Contact/cbc:Telefax"/></div>
		<div>Web Sitesi: <xsl:value-of select="$p/cbc:WebsiteURI"/></div>
		<div>E-Posta: <xsl:value-of select="$p/cac:Contact/cbc:ElectronicMail"/></div>
		<div>Vergi Dairesi: <xsl:value-of select="$p/cac:PartyTaxScheme/cac:TaxScheme/cbc:Name"/></div>
		<xsl:for-each select="$p/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']">
			<div><xsl:value-of select="@schemeID"/>: <xsl:value-of select="."/></div>
		</xsl:for-each>
		<xsl:for-each select="$p/cac:PartyIdentification/cbc:ID[@schemeID = 'MERSISNO' or @schemeID = 'TICARETSICILNO']">
			<div><xsl:value-of select="@schemeID"/>: <xsl:value-of select="."/></div>
		</xsl:for-each>
	</xsl:template>

	<xsl:template match="/">
		<html>
			<head>
				<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
				<title><xsl:value-of select="$F/cbc:ID"/></title>
				<script type="text/javascript">
					<![CDATA[
                var QRCode; ! function () {
                    function a(a) {
                        this.mode = c.MODE_8BIT_BYTE, this.data = a, this.parsedData =[];
                        for (var b =[], d = 0, e = this.data.length; e > d; d++) {
                            var f = this.data.charCodeAt(d);
                            f > 65536 ?(b[0] = 240 |(1835008 & f) >>> 18, b[1] = 128 |(258048 & f) >>> 12, b[2] = 128 |(4032 & f) >>> 6, b[3] = 128 | 63 & f): f > 2048 ?(b[0] = 224 |(61440 & f) >>> 12, b[1] = 128 |(4032 & f) >>> 6, b[2] = 128 | 63 & f): f > 128 ?(b[0] = 192 |(1984 & f) >>> 6, b[1] = 128 | 63 & f): b[0] = f, this.parsedData = this.parsedData.concat(b)
                        }
                        this.parsedData.length != this.data.length &&(this.parsedData.unshift(191), this.parsedData.unshift(187), this.parsedData.unshift(239))
                    }
                    function b(a, b) {
                        this.typeNumber = a, this.errorCorrectLevel = b, this.modules = null, this.moduleCount = 0, this.dataCache = null, this.dataList =[]
                    }
                    function i(a, b) {
                        if (void 0 == a.length) throw new Error(a.length + "/" + b);
                        for (var c = 0; c < a.length && 0 == a[c];) c++;
                        this.num = new Array(a.length - c + b);
                        for (var d = 0; d < a.length - c; d++) this.num[d] = a[d + c]
                    }
                    function j(a, b) {
                        this.totalCount = a, this.dataCount = b
                    }
                    function k() {
                        this.buffer =[], this.length = 0
                    }
                    function m() {
                        return "undefined" != typeof CanvasRenderingContext2D
                    }
                    function n() {
                        var a = ! 1, b = navigator.userAgent;
                        return /android/i.test(b) &&(a = ! 0, aMat = b.toString().match(/android ([0-9]\.[0-9])/i), aMat && aMat[1] &&(a = parseFloat(aMat[1]))), a
                    }
                    function r(a, b) {
                        for (var c = 1, e = s(a), f = 0, g = l.length; g >= f; f++) {
                            var h = 0;
                            switch (b) {
                                case d.L: h = l[f][0];
                                break;
                                case d.M: h = l[f][1];
                                break;
                                case d.Q: h = l[f][2];
                                break;
                                case d.H: h = l[f][3]
                            }
                            if (h >= e) break;
                            c++
                        }
                        if (c > l.length) throw new Error("Too long data");
                        return c
                    }
                    function s(a) {
                        var b = encodeURI(a).toString().replace(/\%[0-9a-fA-F]{2}/g, "a");
                        return b.length +(b.length != a ? 3: 0)
                    }
                    a.prototype = {
                        getLength: function () {
                            return this.parsedData.length
                        },
                        write: function (a) {
                            for (var b = 0, c = this.parsedData.length; c > b; b++) a.put(this.parsedData[b], 8)
                        }
                    },
                    b.prototype = {
                        addData: function (b) {
                            var c = new a(b);
                            this.dataList.push(c), this.dataCache = null
                        },
                        isDark: function (a, b) {
                            if (0 > a || this.moduleCount <= a || 0 > b || this.moduleCount <= b) throw new Error(a + "," + b);
                            return this.modules[a][b]
                        },
                        getModuleCount: function () {
                            return this.moduleCount
                        },
                        make: function () {
                            this.makeImpl(! 1, this.getBestMaskPattern())
                        },
                        makeImpl: function (a, c) {
                            this.moduleCount = 4 * this.typeNumber + 17, this.modules = new Array(this.moduleCount);
                            for (var d = 0; d < this.moduleCount; d++) {
                                this.modules[d] = new Array(this.moduleCount);
                                for (var e = 0; e < this.moduleCount; e++) this.modules[d][e] = null
                            }
                            this.setupPositionProbePattern(0, 0), this.setupPositionProbePattern(this.moduleCount -7, 0), this.setupPositionProbePattern(0, this.moduleCount -7), this.setupPositionAdjustPattern(), this.setupTimingPattern(), this.setupTypeInfo(a, c), this.typeNumber >= 7 && this.setupTypeNumber(a), null == this.dataCache &&(this.dataCache = b.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)), this.mapData(this.dataCache, c)
                        },
                        setupPositionProbePattern: function (a, b) {
                            for (var c = -1; 7 >= c; c++) if (!(-1 >= a + c || this.moduleCount <= a + c)) for (var d = -1; 7 >= d; d++) -1 >= b + d || this.moduleCount <= b + d ||(this.modules[a + c][b + d] = c >= 0 && 6 >= c &&(0 == d || 6 == d) || d >= 0 && 6 >= d &&(0 == c || 6 == c) || c >= 2 && 4 >= c && d >= 2 && 4 >= d ? ! 0: ! 1)
                        },
                        getBestMaskPattern: function () {
                            for (var a = 0, b = 0, c = 0; 8 > c; c++) {
                                this.makeImpl(! 0, c);
                                var d = f.getLostPoint(this);
                                (0 == c || a > d) &&(a = d, b = c)
                            }
                            return b
                        },
                        createMovieClip: function (a, b, c) {
                            var d = a.createEmptyMovieClip(b, c), e = 1;
                            this.make();
                            for (var f = 0; f < this.modules.length; f++) for (var g = f * e, h = 0; h < this.modules[f].length; h++) {
                                var i = h * e, j = this.modules[f][h];
                                j &&(d.beginFill(0, 100), d.moveTo(i, g), d.lineTo(i + e, g), d.lineTo(i + e, g + e), d.lineTo(i, g + e), d.endFill())
                            }
                            return d
                        },
                        setupTimingPattern: function () {
                            for (var a = 8; a < this.moduleCount -8; a++) null == this.modules[a][6] &&(this.modules[a][6] = 0 == a % 2);
                            for (var b = 8; b < this.moduleCount -8; b++) null == this.modules[6][b] &&(this.modules[6][b] = 0 == b % 2)
                        },
                        setupPositionAdjustPattern: function () {
                            for (var a = f.getPatternPosition(this.typeNumber), b = 0; b < a.length; b++) for (var c = 0; c < a.length; c++) {
                                var d = a[b], e = a[c];
                                if (null == this.modules[d][e]) for (var g = -2; 2 >= g; g++) for (var h = -2; 2 >= h; h++) this.modules[d + g][e + h] = -2 == g || 2 == g || -2 == h || 2 == h || 0 == g && 0 == h ? ! 0: ! 1
                            }
                        },
                        setupTypeNumber: function (a) {
                            for (var b = f.getBCHTypeNumber(this.typeNumber), c = 0; 18 > c; c++) {
                                var d = ! a && 1 ==(1 & b >> c);
                                this.modules[Math.floor(c / 3)][c % 3 + this.moduleCount -8 -3] = d
                            }
                            for (var c = 0; 18 > c; c++) {
                                var d = ! a && 1 ==(1 & b >> c);
                                this.modules[c % 3 + this.moduleCount -8 -3][Math.floor(c / 3)] = d
                            }
                        },
                        setupTypeInfo: function (a, b) {
                            for (var c = this.errorCorrectLevel << 3 | b, d = f.getBCHTypeInfo(c), e = 0; 15 > e; e++) {
                                var g = ! a && 1 ==(1 & d >> e);
                                6 > e ? this.modules[e][8] = g: 8 > e ? this.modules[e + 1][8] = g: this.modules[ this.moduleCount -15 + e][8] = g
                            }
                            for (var e = 0; 15 > e; e++) {
                                var g = ! a && 1 ==(1 & d >> e);
                                8 > e ? this.modules[8][ this.moduleCount - e -1] = g: 9 > e ? this.modules[8][15 - e -1 + 1] = g: this.modules[8][15 - e -1] = g
                            }
                            this.modules[ this.moduleCount -8][8] = ! a
                        },
                        mapData: function (a, b) {
                            for (var c = -1, d = this.moduleCount -1, e = 7, g = 0, h = this.moduleCount -1; h > 0; h -= 2) for (6 == h && h--;;) {
                                for (var i = 0; 2 > i; i++) if (null == this.modules[d][h - i]) {
                                    var j = ! 1;
                                    g < a.length &&(j = 1 ==(1 & a[g] >>> e));
                                    var k = f.getMask(b, d, h - i);
                                    k &&(j = ! j), this.modules[d][h - i] = j, e--, -1 == e &&(g++, e = 7)
                                }
                                if (d += c, 0 > d || this.moduleCount <= d) {
                                    d -= c, c = - c;
                                    break
                                }
                            }
                        }
                    },
                    b.PAD0 = 236, b.PAD1 = 17, b.createData = function (a, c, d) {
                        for (var e = j.getRSBlocks(a, c), g = new k, h = 0; h < d.length; h++) {
                            var i = d[h];
                            g.put(i.mode, 4), g.put(i.getLength(), f.getLengthInBits(i.mode, a)), i.write(g)
                        }
                        for (var l = 0, h = 0; h < e.length; h++) l += e[h].dataCount;
                        if (g.getLengthInBits() > 8 * l) throw new Error("code length overflow. (" + g.getLengthInBits() + ">" + 8 * l + ")");
                        for (g.getLengthInBits() + 4 <= 8 * l && g.put(0, 4);
                        0 != g.getLengthInBits() % 8;) g.putBit(! 1);
                        for (;;) {
                            if (g.getLengthInBits() >= 8 * l) break;
                            if (g.put(b.PAD0, 8), g.getLengthInBits() >= 8 * l) break;
                            g.put(b.PAD1, 8)
                        }
                        return b.createBytes(g, e)
                    },
                    b.createBytes = function (a, b) {
                        for (var c = 0, d = 0, e = 0, g = new Array(b.length), h = new Array(b.length), j = 0; j < b.length; j++) {
                            var k = b[j].dataCount, l = b[j].totalCount - k;
                            d = Math.max(d, k), e = Math.max(e, l), g[j] = new Array(k);
                            for (var m = 0; m < g[j].length; m++) g[j][m] = 255 & a.buffer[m + c];
                            c += k;
                            var n = f.getErrorCorrectPolynomial(l), o = new i(g[j], n.getLength() -1), p = o.mod(n);
                            h[j] = new Array(n.getLength() -1);
                            for (var m = 0; m < h[j].length; m++) {
                                var q = m + p.getLength() - h[j].length;
                                h[j][m] = q >= 0 ? p. get (q): 0
                            }
                        }
                        for (var r = 0, m = 0; m < b.length; m++) r += b[m].totalCount;
                        for (var s = new Array(r), t = 0, m = 0; d > m; m++) for (var j = 0; j < b.length; j++) m < g[j].length &&(s[t++] = g[j][m]);
                        for (var m = 0; e > m; m++) for (var j = 0; j < b.length; j++) m < h[j].length &&(s[t++] = h[j][m]);
                        return s
                    };
                    for (var c = {
                        MODE_NUMBER: 1, MODE_ALPHA_NUM: 2, MODE_8BIT_BYTE: 4, MODE_KANJI: 8
                    },
                    d = {
                        L: 1, M: 0, Q: 3, H: 2
                    },
                    e = {
                        PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3, PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7
                    },
                    f = {
                        PATTERN_POSITION_TABLE:[[],[6, 18],[6, 22],[6, 26],[6, 30],[6, 34],[6, 22, 38],[6, 24, 42],[6, 26, 46],[6, 28, 50],[6, 30, 54],[6, 32, 58],[6, 34, 62],[6, 26, 46, 66],[6, 26, 48, 70],[6, 26, 50, 74],[6, 30, 54, 78],[6, 30, 56, 82],[6, 30, 58, 86],[6, 34, 62, 90],[6, 28, 50, 72, 94],[6, 26, 50, 74, 98],[6, 30, 54, 78, 102],[6, 28, 54, 80, 106],[6, 32, 58, 84, 110],[6, 30, 58, 86, 114],[6, 34, 62, 90, 118],[6, 26, 50, 74, 98, 122],[6, 30, 54, 78, 102, 126],[6, 26, 52, 78, 104, 130],[6, 30, 56, 82, 108, 134],[6, 34, 60, 86, 112, 138],[6, 30, 58, 86, 114, 142],[6, 34, 62, 90, 118, 146],[6, 30, 54, 78, 102, 126, 150],[6, 24, 50, 76, 102, 128, 154],[6, 28, 54, 80, 106, 132, 158],[6, 32, 58, 84, 110, 136, 162],[6, 26, 54, 82, 110, 138, 166],[6, 30, 58, 86, 114, 142, 170]], G15: 1335, G18: 7973, G15_MASK: 21522, getBCHTypeInfo: function (a) {
                            for (var b = a << 10; f.getBCHDigit(b) - f.getBCHDigit(f.G15) >= 0;) b ^= f.G15 << f.getBCHDigit(b) - f.getBCHDigit(f.G15);
                            return (a << 10 | b) ^ f.G15_MASK
                        },
                        getBCHTypeNumber: function (a) {
                            for (var b = a << 12; f.getBCHDigit(b) - f.getBCHDigit(f.G18) >= 0;) b ^= f.G18 << f.getBCHDigit(b) - f.getBCHDigit(f.G18);
                            return a << 12 | b
                        },
                        getBCHDigit: function (a) {
                            for (var b = 0; 0 != a;) b++, a >>>= 1; return b
                        },
                        getPatternPosition: function (a) {
                            return f.PATTERN_POSITION_TABLE[a -1]
                        },
                        getMask: function (a, b, c) {
                            switch (a) {
                                case e.PATTERN000: return 0 ==(b + c) % 2; case e.PATTERN001: return 0 == b % 2; case e.PATTERN010: return 0 == c % 3; case e.PATTERN011: return 0 ==(b + c) % 3; case e.PATTERN100: return 0 ==(Math.floor(b / 2) + Math.floor(c / 3)) % 2; case e.PATTERN101: return 0 == b * c % 2 + b * c % 3; case e.PATTERN110: return 0 ==(b * c % 2 + b * c % 3) % 2; case e.PATTERN111: return 0 ==(b * c % 3 +(b + c) % 2) % 2; default: throw new Error("bad maskPattern:" + a)
                            }
                        },
                        getErrorCorrectPolynomial: function (a) {
                            for (var b = new i([1], 0), c = 0; a > c; c++) b = b.multiply(new i([1, g.gexp(c)], 0));
                            return b
                        },
                        getLengthInBits: function (a, b) {
                            if (b >= 1 && 10 > b) switch (a) {
                                case c.MODE_NUMBER: return 10; case c.MODE_ALPHA_NUM: return 9; case c.MODE_8BIT_BYTE: return 8; case c.MODE_KANJI: return 8; default: throw new Error("mode:" + a)
                            } else if (27 > b) switch (a) {
                                case c.MODE_NUMBER: return 12; case c.MODE_ALPHA_NUM: return 11; case c.MODE_8BIT_BYTE: return 16; case c.MODE_KANJI: return 10; default: throw new Error("mode:" + a)
                            } else {
                                if (!(41 > b)) throw new Error("type:" + b);
                                switch (a) {
                                    case c.MODE_NUMBER: return 14; case c.MODE_ALPHA_NUM: return 13; case c.MODE_8BIT_BYTE: return 16; case c.MODE_KANJI: return 12; default: throw new Error("mode:" + a)
                                }
                            }
                        },
                        getLostPoint: function (a) {
                            for (var b = a.getModuleCount(), c = 0, d = 0; b > d; d++) for (var e = 0; b > e; e++) {
                                for (var f = 0, g = a.isDark(d, e), h = -1; 1 >= h; h++) if (!(0 > d + h || d + h >= b)) for (var i = -1; 1 >= i; i++) 0 > e + i || e + i >= b ||(0 != h || 0 != i) && g == a.isDark(d + h, e + i) && f++; f > 5 &&(c += 3 + f -5)
                            }
                            for (var d = 0; b -1 > d; d++) for (var e = 0; b -1 > e; e++) {
                                var j = 0; a.isDark(d, e) && j++, a.isDark(d + 1, e) && j++, a.isDark(d, e + 1) && j++, a.isDark(d + 1, e + 1) && j++,(0 == j || 4 == j) &&(c += 3)
                            }
                            for (var d = 0; b > d; d++) for (var e = 0; b -6 > e; e++) a.isDark(d, e) && ! a.isDark(d, e + 1) && a.isDark(d, e + 2) && a.isDark(d, e + 3) && a.isDark(d, e + 4) && ! a.isDark(d, e + 5) && a.isDark(d, e + 6) &&(c += 40);
                            for (var e = 0; b > e; e++) for (var d = 0; b -6 > d; d++) a.isDark(d, e) && ! a.isDark(d + 1, e) && a.isDark(d + 2, e) && a.isDark(d + 3, e) && a.isDark(d + 4, e) && ! a.isDark(d + 5, e) && a.isDark(d + 6, e) &&(c += 40);
                            for (var k = 0, e = 0; b > e; e++) for (var d = 0; b > d; d++) a.isDark(d, e) && k++; var l = Math.abs(100 * k / b / b -50) / 5; return c += 10 * l
                        }
                    },
                    g = {
                        glog: function (a) {
                            if (1 > a) throw new Error("glog(" + a + ")");
                            return g.LOG_TABLE[a]
                        },
                        gexp: function (a) {
                            for (; 0 > a;) a += 255; for (; a >= 256;) a -= 255; return g.EXP_TABLE[a]
                        },
                        EXP_TABLE: new Array(256), LOG_TABLE: new Array(256)
                    },
                    h = 0; 8 > h; h++) g.EXP_TABLE[h] = 1 << h;
                    for (var h = 8; 256 > h; h++) g.EXP_TABLE[h] = g.EXP_TABLE[h -4] ^ g.EXP_TABLE[h -5] ^ g.EXP_TABLE[h -6] ^ g.EXP_TABLE[h -8];
                    for (var h = 0; 255 > h; h++) g.LOG_TABLE[g.EXP_TABLE[h]] = h;
                    i.prototype = {
                        get: function (a) {
                            return this.num[a]
                        },
                        getLength: function () {
                            return this.num.length
                        },
                        multiply: function (a) {
                            for (var b = new Array(this.getLength() + a.getLength() -1), c = 0; c < this.getLength();
                            c++) for (var d = 0; d < a.getLength();
                            d++) b[c + d] ^= g.gexp(g.glog(this. get (c)) + g.glog(a. get (d)));
                            return new i(b, 0)
                        },
                        mod: function (a) {
                            if (this.getLength() - a.getLength() < 0) return this;
                            for (var b = g.glog(this. get (0)) - g.glog(a. get (0)), c = new Array(this.getLength()), d = 0; d < this.getLength();
                            d++) c[d] = this. get (d);
                            for (var d = 0; d < a.getLength();
                            d++) c[d] ^= g.gexp(g.glog(a. get (d)) + b);
                            return new i(c, 0).mod(a)
                        }
                    },
                    j.RS_BLOCK_TABLE =[[1, 26, 19],[1, 26, 16],[1, 26, 13],[1, 26, 9],[1, 44, 34],[1, 44, 28],[1, 44, 22],[1, 44, 16],[1, 70, 55],[1, 70, 44],[2, 35, 17],[2, 35, 13],[1, 100, 80],[2, 50, 32],[2, 50, 24],[4, 25, 9],[1, 134, 108],[2, 67, 43],[2, 33, 15, 2, 34, 16],[2, 33, 11, 2, 34, 12],[2, 86, 68],[4, 43, 27],[4, 43, 19],[4, 43, 15],[2, 98, 78],[4, 49, 31],[2, 32, 14, 4, 33, 15],[4, 39, 13, 1, 40, 14],[2, 121, 97],[2, 60, 38, 2, 61, 39],[4, 40, 18, 2, 41, 19],[4, 40, 14, 2, 41, 15],[2, 146, 116],[3, 58, 36, 2, 59, 37],[4, 36, 16, 4, 37, 17],[4, 36, 12, 4, 37, 13],[2, 86, 68, 2, 87, 69],[4, 69, 43, 1, 70, 44],[6, 43, 19, 2, 44, 20],[6, 43, 15, 2, 44, 16],[4, 101, 81],[1, 80, 50, 4, 81, 51],[4, 50, 22, 4, 51, 23],[3, 36, 12, 8, 37, 13],[2, 116, 92, 2, 117, 93],[6, 58, 36, 2, 59, 37],[4, 46, 20, 6, 47, 21],[7, 42, 14, 4, 43, 15],[4, 133, 107],[8, 59, 37, 1, 60, 38],[8, 44, 20, 4, 45, 21],[12, 33, 11, 4, 34, 12],[3, 145, 115, 1, 146, 116],[4, 64, 40, 5, 65, 41],[11, 36, 16, 5, 37, 17],[11, 36, 12, 5, 37, 13],[5, 109, 87, 1, 110, 88],[5, 65, 41, 5, 66, 42],[5, 54, 24, 7, 55, 25],[11, 36, 12],[5, 122, 98, 1, 123, 99],[7, 73, 45, 3, 74, 46],[15, 43, 19, 2, 44, 20],[3, 45, 15, 13, 46, 16],[1, 135, 107, 5, 136, 108],[10, 74, 46, 1, 75, 47],[1, 50, 22, 15, 51, 23],[2, 42, 14, 17, 43, 15],[5, 150, 120, 1, 151, 121],[9, 69, 43, 4, 70, 44],[17, 50, 22, 1, 51, 23],[2, 42, 14, 19, 43, 15],[3, 141, 113, 4, 142, 114],[3, 70, 44, 11, 71, 45],[17, 47, 21, 4, 48, 22],[9, 39, 13, 16, 40, 14],[3, 135, 107, 5, 136, 108],[3, 67, 41, 13, 68, 42],[15, 54, 24, 5, 55, 25],[15, 43, 15, 10, 44, 16],[4, 144, 116, 4, 145, 117],[17, 68, 42],[17, 50, 22, 6, 51, 23],[19, 46, 16, 6, 47, 17],[2, 139, 111, 7, 140, 112],[17, 74, 46],[7, 54, 24, 16, 55, 25],[34, 37, 13],[4, 151, 121, 5, 152, 122],[4, 75, 47, 14, 76, 48],[11, 54, 24, 14, 55, 25],[16, 45, 15, 14, 46, 16],[6, 147, 117, 4, 148, 118],[6, 73, 45, 14, 74, 46],[11, 54, 24, 16, 55, 25],[30, 46, 16, 2, 47, 17],[8, 132, 106, 4, 133, 107],[8, 75, 47, 13, 76, 48],[7, 54, 24, 22, 55, 25],[22, 45, 15, 13, 46, 16],[10, 142, 114, 2, 143, 115],[19, 74, 46, 4, 75, 47],[28, 50, 22, 6, 51, 23],[33, 46, 16, 4, 47, 17],[8, 152, 122, 4, 153, 123],[22, 73, 45, 3, 74, 46],[8, 53, 23, 26, 54, 24],[12, 45, 15, 28, 46, 16],[3, 147, 117, 10, 148, 118],[3, 73, 45, 23, 74, 46],[4, 54, 24, 31, 55, 25],[11, 45, 15, 31, 46, 16],[7, 146, 116, 7, 147, 117],[21, 73, 45, 7, 74, 46],[1, 53, 23, 37, 54, 24],[19, 45, 15, 26, 46, 16],[5, 145, 115, 10, 146, 116],[19, 75, 47, 10, 76, 48],[15, 54, 24, 25, 55, 25],[23, 45, 15, 25, 46, 16],[13, 145, 115, 3, 146, 116],[2, 74, 46, 29, 75, 47],[42, 54, 24, 1, 55, 25],[23, 45, 15, 28, 46, 16],[17, 145, 115],[10, 74, 46, 23, 75, 47],[10, 54, 24, 35, 55, 25],[19, 45, 15, 35, 46, 16],[17, 145, 115, 1, 146, 116],[14, 74, 46, 21, 75, 47],[29, 54, 24, 19, 55, 25],[11, 45, 15, 46, 46, 16],[13, 145, 115, 6, 146, 116],[14, 74, 46, 23, 75, 47],[44, 54, 24, 7, 55, 25],[59, 46, 16, 1, 47, 17],[12, 151, 121, 7, 152, 122],[12, 75, 47, 26, 76, 48],[39, 54, 24, 14, 55, 25],[22, 45, 15, 41, 46, 16],[6, 151, 121, 14, 152, 122],[6, 75, 47, 34, 76, 48],[46, 54, 24, 10, 55, 25],[2, 45, 15, 64, 46, 16],[17, 152, 122, 4, 153, 123],[29, 74, 46, 14, 75, 47],[49, 54, 24, 10, 55, 25],[24, 45, 15, 46, 46, 16],[4, 152, 122, 18, 153, 123],[13, 74, 46, 32, 75, 47],[48, 54, 24, 14, 55, 25],[42, 45, 15, 32, 46, 16],[20, 147, 117, 4, 148, 118],[40, 75, 47, 7, 76, 48],[43, 54, 24, 22, 55, 25],[10, 45, 15, 67, 46, 16],[19, 148, 118, 6, 149, 119],[18, 75, 47, 31, 76, 48],[34, 54, 24, 34, 55, 25],[20, 45, 15, 61, 46, 16]], j.getRSBlocks = function (a, b) {
                        var c = j.getRsBlockTable(a, b);
                        if (void 0 == c) throw new Error("bad rs block @ typeNumber:" + a + "/errorCorrectLevel:" + b);
                        for (var d = c.length / 3, e =[], f = 0; d > f; f++) for (var g = c[3 * f + 0], h = c[3 * f + 1], i = c[3 * f + 2], k = 0; g > k; k++) e.push(new j(h, i));
                        return e
                    },
                    j.getRsBlockTable = function (a, b) {
                        switch (b) {
                            case d.L: return j.RS_BLOCK_TABLE[4 *(a -1) + 0];
                            case d.M: return j.RS_BLOCK_TABLE[4 *(a -1) + 1];
                            case d.Q: return j.RS_BLOCK_TABLE[4 *(a -1) + 2];
                            case d.H: return j.RS_BLOCK_TABLE[4 *(a -1) + 3];
                            default: return void 0
                        }
                    },
                    k.prototype = {
                        get: function (a) {
                            var b = Math.floor(a / 8);
                            return 1 ==(1 & this.buffer[b] >>> 7 - a % 8)
                        },
                        put: function (a, b) {
                            for (var c = 0; b > c; c++) this.putBit(1 ==(1 & a >>> b - c -1))
                        },
                        getLengthInBits: function () {
                            return this.length
                        },
                        putBit: function (a) {
                            var b = Math.floor(this.length / 8);
                            this.buffer.length <= b && this.buffer.push(0), a &&(this.buffer[b] |= 128 >>> this.length % 8), this.length++
                        }
                    };
                    var l =[[17, 14, 11, 7],[32, 26, 20, 14],[53, 42, 32, 24],[78, 62, 46, 34],[106, 84, 60, 44],[134, 106, 74, 58],[154, 122, 86, 64],[192, 152, 108, 84],[230, 180, 130, 98],[271, 213, 151, 119],[321, 251, 177, 137],[367, 287, 203, 155],[425, 331, 241, 177],[458, 362, 258, 194],[520, 412, 292, 220],[586, 450, 322, 250],[644, 504, 364, 280],[718, 560, 394, 310],[792, 624, 442, 338],[858, 666, 482, 382],[929, 711, 509, 403],[1003, 779, 565, 439],[1091, 857, 611, 461],[1171, 911, 661, 511],[1273, 997, 715, 535],[1367, 1059, 751, 593],[1465, 1125, 805, 625],[1528, 1190, 868, 658],[1628, 1264, 908, 698],[1732, 1370, 982, 742],[1840, 1452, 1030, 790],[1952, 1538, 1112, 842],[2068, 1628, 1168, 898],[2188, 1722, 1228, 958],[2303, 1809, 1283, 983],[2431, 1911, 1351, 1051],[2563, 1989, 1423, 1093],[2699, 2099, 1499, 1139],[2809, 2213, 1579, 1219],[2953, 2331, 1663, 1273]], o = function () {
                        var a = function (a, b) {
                            this._el = a, this._htOption = b
                        };
                        return a.prototype.draw = function (a) {
                            function g(a, b) {
                                var c = document.createElementNS("http://www.w3.org/2000/svg", a);
                                for (var d in b) b.hasOwnProperty(d) && c.setAttribute(d, b[d]);
                                return c
                            }
                            var b = this._htOption, c = this._el, d = a.getModuleCount();
                            Math.floor(b.width / d), Math.floor(b.height / d), this.clear();
                            var h = g("svg", {
                                viewBox: "0 0 " + String(d) + " " + String(d), width: "100%", height: "100%", fill: b.colorLight
                            });
                            h.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink"), c.appendChild(h), h.appendChild(g("rect", {
                                fill: b.colorDark, width: "1", height: "1", id: "template"
                            }));
                            for (var i = 0; d > i; i++) for (var j = 0; d > j; j++) if (a.isDark(i, j)) {
                                var k = g("use", {
                                    x: String(i), y: String(j)
                                });
                                k.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#template"), h.appendChild(k)
                            }
                        },
                        a.prototype.clear = function () {
                            for (; this._el.hasChildNodes();) this._el.removeChild(this._el.lastChild)
                        },
                        a
                    }
                    (), p = "svg" === document.documentElement.tagName.toLowerCase(), q = p ? o: m() ? function () {
                        function a() {
                            this._elImage.src = this._elCanvas.toDataURL("image/png"), this._elImage.style.display = "block", this._elCanvas.style.display = "none"
                        }
                        function d(a, b) {
                            var c = this;
                            if (c._fFail = b, c._fSuccess = a, null === c._bSupportDataURI) {
                                var d = document.createElement("img"), e = function () {
                                    c._bSupportDataURI = ! 1, c._fFail && _fFail.call(c)
                                },
                                f = function () {
                                    c._bSupportDataURI = ! 0, c._fSuccess && c._fSuccess.call(c)
                                };
                                return d.onabort = e, d.onerror = e, d.onload = f, d.src = "data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==", void 0
                            }
                            c._bSupportDataURI === ! 0 && c._fSuccess ? c._fSuccess.call(c): c._bSupportDataURI === ! 1 && c._fFail && c._fFail.call(c)
                        }
                        if (this._android && this._android <= 2.1) {
                            var b = 1 / window.devicePixelRatio, c = CanvasRenderingContext2D.prototype.drawImage;
                            CanvasRenderingContext2D.prototype.drawImage = function (a, d, e, f, g, h, i, j) {
                                if ("nodeName" in a && /img/i.test(a.nodeName)) for (var l = arguments.length -1; l >= 1; l--) arguments[l] = arguments[l] * b; else "undefined" == typeof j &&(arguments[1] *= b, arguments[2] *= b, arguments[3] *= b, arguments[4] *= b);
                                c.apply(this, arguments)
                            }
                        }
                        var e = function (a, b) {
                            this._bIsPainted = ! 1, this._android = n(), this._htOption = b, this._elCanvas = document.createElement("canvas"), this._elCanvas.width = b.width, this._elCanvas.height = b.height, a.appendChild(this._elCanvas), this._el = a, this._oContext = this._elCanvas.getContext("2d"), this._bIsPainted = ! 1, this._elImage = document.createElement("img"), this._elImage.style.display = "none", this._el.appendChild(this._elImage), this._bSupportDataURI = null
                        };
                        return e.prototype.draw = function (a) {
                            var b = this._elImage, c = this._oContext, d = this._htOption, e = a.getModuleCount(), f = d.width / e, g = d.height / e, h = Math.round(f), i = Math.round(g);
                            b.style.display = "none", this.clear();
                            for (var j = 0; e > j; j++) for (var k = 0; e > k; k++) {
                                var l = a.isDark(j, k), m = k * f, n = j * g;
                                c.strokeStyle = l ? d.colorDark: d.colorLight, c.lineWidth = 1, c.fillStyle = l ? d.colorDark: d.colorLight, c.fillRect(m, n, f, g), c.strokeRect(Math.floor(m) + .5, Math.floor(n) + .5, h, i), c.strokeRect(Math.ceil(m) -.5, Math.ceil(n) -.5, h, i)
                            }
                            this._bIsPainted = ! 0
                        },
                        e.prototype.makeImage = function () {
                            this._bIsPainted && d.call(this, a)
                        },
                        e.prototype.isPainted = function () {
                            return this._bIsPainted
                        },
                        e.prototype.clear = function () {
                            this._oContext.clearRect(0, 0, this._elCanvas.width, this._elCanvas.height), this._bIsPainted = ! 1
                        },
                        e.prototype.round = function (a) {
                            return a ? Math.floor(1e3 * a) / 1e3: a
                        },
                        e
                    }
                    (): function () {
                        var a = function (a, b) {
                            this._el = a, this._htOption = b
                        };
                        return a.prototype.draw = function (a) {
                            for (var b = this._htOption, c = this._el, d = a.getModuleCount(), e = Math.floor(b.width / d), f = Math.floor(b.height / d), g =[ '<table style="border:0;border-collapse:collapse;">'], h = 0; d > h; h++) {
                                g.push("<tr>");
                                for (var i = 0; d > i; i++) g.push('<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' + e + "px;height:" + f + "px;background-color:" +(a.isDark(h, i) ? b.colorDark: b.colorLight) + ';"></td>');
                                g.push("</tr>")
                            }
                            g.push("</table>"), c.innerHTML = g.join("");
                            var j = c.childNodes[0], k =(b.width - j.offsetWidth) / 2, l =(b.height - j.offsetHeight) / 2;
                            k > 0 && l > 0 &&(j.style.margin = l + "px " + k + "px")
                        },
                        a.prototype.clear = function () {
                            this._el.innerHTML = ""
                        },
                        a
                    }
                    ();
                    QRCode = function (a, b) {
                        if (this._htOption = {
                            width: 256, height: 256, typeNumber: 4, colorDark: "#000000", colorLight: "#ffffff", correctLevel: d.H
                        },
                        "string" == typeof b &&(b = {
                            text: b
                        }), b) for (var c in b) this._htOption[c] = b[c];
                        "string" == typeof a &&(a = document.getElementById(a)), this._android = n(), this._el = a, this._oQRCode = null, this._oDrawing = new q(this._el, this._htOption), this._htOption.text && this.makeCode(this._htOption.text)
                    },
                    QRCode.prototype.makeCode = function (a) {
                        this._oQRCode = new b(r(a, this._htOption.correctLevel), this._htOption.correctLevel), this._oQRCode.addData(a), this._oQRCode.make(), this._el.title = a, this._oDrawing.draw(this._oQRCode), this.makeImage()
                    },
                    QRCode.prototype.makeImage = function () {
                        "function" == typeof this._oDrawing.makeImage &&(! this._android || this._android >= 3) && this._oDrawing.makeImage()
                    },
                    QRCode.prototype.clear = function () {
                        this._oDrawing.clear()
                    },
                    QRCode.CorrectLevel = d
                }
                ();//]]>
				</script>
				<style type="text/css">
					body { background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; }
					table, td, th, div { font-size: 11px; }
					.sayfa { width: 800px; margin: 0 auto; padding: 24px 20px; }
					.ust { width: 100%; border-collapse: collapse; }
					.ust td { vertical-align: top; padding: 0; }
					.taraf { width: 400px; line-height: 15px; }
					.taraf .ad { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
					.cizgi { border-bottom: 1px solid #000; padding-bottom: 6px; }
					.alici-baslik { font-weight: bold; margin-top: 28px; }
					.belge { font-size: 12px; font-weight: bold; text-align: center; margin-top: 6px; }
					.bilgi { border-collapse: collapse; margin-left: auto; }
					.bilgi td { padding: 1px 6px; font-size: 11px; }
					.bilgi td.e { font-weight: bold; }
					.ettn { margin-top: 10px; }
					.satirlar { width: 100%; border-collapse: collapse; margin-top: 18px; border: 2px solid #000; }
					.satirlar th { font-size: 10px; font-weight: bold; color: #555; border: 1px solid #000; padding: 4px 3px; background: #fff; }
					.satirlar td { border: 1px solid #000; padding: 2px 4px; }
					.sag { text-align: right; } .orta { text-align: center; }
					.toplam { border-collapse: collapse; margin-left: auto; margin-top: 8px; }
					.toplam td { padding: 3px 4px; border-bottom: 1px solid #ddd; }
					.toplam td.e { font-weight: bold; text-align: right; min-width: 210px; }
					.toplam td.d { text-align: right; min-width: 90px; }
					.notlar { border: 1px solid #000; margin-top: 26px; padding: 8px 14px; line-height: 15px; }
					.notlar b { font-weight: bold; }
				</style>
			</head>
			<body>
				<div class="sayfa">
					<table class="ust">
						<tr>
							<td class="taraf">
								<div style="height: 50px;"/>
								<div class="cizgi">
									<xsl:call-template name="taraf"><xsl:with-param name="p" select="$F/cac:AccountingSupplierParty/cac:Party"/></xsl:call-template>
								</div>
							</td>
							<td style="width: 150px; text-align: center;">
								<img style="width: 91px; display: block; margin: 0 auto 2px auto;" alt="GİB" src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QBoRXhpZgAASUkqAAgAAAADABIBAwABAAAAAQAAADEBAgAQ AAAAMgAAAGmHBAABAAAAQgAAAAAAAABTaG90d2VsbCAwLjIyLjAAAgACoAkAAQAAAKYBAAADoAkA AQAAAKYBAAAAAAAA/+EJ9Gh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJl Z2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxu czp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNC40LjAtRXhpdjIiPiA8cmRm OlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1u cyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpleGlmPSJodHRwOi8vbnMu YWRvYmUuY29tL2V4aWYvMS4wLyIgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZm LzEuMC8iIGV4aWY6UGl4ZWxYRGltZW5zaW9uPSI0MjIiIGV4aWY6UGl4ZWxZRGltZW5zaW9uPSI0 MjIiIHRpZmY6SW1hZ2VXaWR0aD0iNDIyIiB0aWZmOkltYWdlSGVpZ2h0PSI0MjIiIHRpZmY6T3Jp ZW50YXRpb249IjEiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/9sA QwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwP FxgWFBgSFBUU/9sAQwEDBAQFBAUJBQUJFA0LDRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBQUFBQUFBQUFBQUFBQU/8AAEQgAaQBpAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAA AAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQy gZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVm Z2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS 09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYH CAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1Lw FWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5 eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj 5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A/VOiioL6+ttMsp7y8njtbSBGlmnmcIkaKMsz MeAABkk0bgT1458QP2nfDvhbxDJ4W8N2F/8AEHxsvB0Hw6gla3PTNzMf3cC567jkelcJqHjHxT+1 FJeL4Z1a48B/Bq03i88Vg+Tfa0qZ8wWpb/UwDBzMeTjj+IVTl+JHhz4QeArPT/gf4dtJ7SG/FtqE j6dcuVLQmSGaX7ssiT4wtyPMU/wiQkLXuUcCoO1Vc0/5dkv8T6P+6tel09DzqmIurwdl36v0X6/m dDdaJ8c/HdpJfeJ/GWh/B7QgNz2OhwpfXqIf4ZbubEaN/tRrisTSv2evhJ4v8XXnhrxD4w8W/EHx Daq7Twa9r94UOzZ5gTyzHG2wyR7lTOzeoYDIr1P4l/CeL41aDod415eeGNUjETuypuZ7dmjkmtJo yQGB2Lz1VlBHcHW0D4L+GfDPxC1Xxlp0E9vq2pl3uFWUiFncIHfb3J8tepIB3FQCzZFjeSD5Zckt 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"/>
								<div class="belge">
									<xsl:choose>
										<xsl:when test="$earsiv">e-Arşiv Fatura</xsl:when>
										<xsl:otherwise>e-Fatura</xsl:otherwise>
									</xsl:choose>
								</div>
							</td>
							<td style="text-align: right;">
								<div id="qrcode" style="display: inline-block;"/>
								<div id="qrvalue" style="display: none;">{"vkntckn":"<xsl:value-of select="$F/cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']"/>","avkntckn":"<xsl:value-of select="$F/cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']"/>","senaryo":"<xsl:value-of select="$F/cbc:ProfileID"/>","tip":"<xsl:value-of select="$F/cbc:InvoiceTypeCode"/>","tarih":"<xsl:value-of select="$F/cbc:IssueDate"/>","no":"<xsl:value-of select="$F/cbc:ID"/>","ettn":"<xsl:value-of select="$F/cbc:UUID"/>","parabirimi":"<xsl:value-of select="$F/cbc:DocumentCurrencyCode"/>","malhizmettoplam":"<xsl:value-of select="$F/cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/>"<xsl:for-each select="$F/cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode = '0015']">,"kdvmatrah(<xsl:value-of select="cbc:Percent"/>)":"<xsl:value-of select="cbc:TaxableAmount"/>","hesaplanankdv(<xsl:value-of select="cbc:Percent"/>)":"<xsl:value-of select="cbc:TaxAmount"/>"</xsl:for-each>,"vergidahil":"<xsl:value-of select="$F/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/>","odenecek":"<xsl:value-of select="$F/cac:LegalMonetaryTotal/cbc:PayableAmount"/>"}</div>
								<script type="text/javascript">
									try {
										var qrcode = new QRCode(document.getElementById("qrcode"), { width: 150, height: 150, correctLevel: QRCode.CorrectLevel.L });
										qrcode.makeCode(document.getElementById("qrvalue").innerHTML);
									} catch (e) {}
								</script>
							</td>
						</tr>
					</table>

					<table class="ust" style="margin-top: 10px;">
						<tr>
							<td class="taraf">
								<div class="alici-baslik">Alıcı Bilgileri</div>
								<div class="cizgi">
									<xsl:call-template name="taraf"><xsl:with-param name="p" select="$F/cac:AccountingCustomerParty/cac:Party"/></xsl:call-template>
								</div>
							</td>
							<td style="vertical-align: bottom;">
								<table class="bilgi">
									<tr><td class="e">Özelleştirme No:</td><td><xsl:value-of select="$F/cbc:CustomizationID"/></td></tr>
									<tr><td class="e">Senaryo:</td><td><xsl:value-of select="$F/cbc:ProfileID"/></td></tr>
									<tr><td class="e">Fatura Tipi:</td><td><xsl:value-of select="$F/cbc:InvoiceTypeCode"/></td></tr>
									<tr><td class="e">Fatura No:</td><td><xsl:value-of select="$F/cbc:ID"/></td></tr>
									<tr><td class="e">Fatura Tarihi:</td><td><xsl:call-template name="tarih"><xsl:with-param name="d" select="$F/cbc:IssueDate"/></xsl:call-template></td></tr>
									<tr><td class="e">Fatura Saati:</td><td><xsl:value-of select="substring($F/cbc:IssueTime, 1, 8)"/></td></tr>
									<tr><td class="e">Son Ödeme Tarihi:</td><td>
										<xsl:call-template name="tarih">
											<xsl:with-param name="d">
												<xsl:choose>
													<xsl:when test="normalize-space($F/cac:PaymentMeans/cbc:PaymentDueDate)"><xsl:value-of select="$F/cac:PaymentMeans/cbc:PaymentDueDate"/></xsl:when>
													<xsl:otherwise><xsl:value-of select="$F/cbc:IssueDate"/></xsl:otherwise>
												</xsl:choose>
											</xsl:with-param>
											<xsl:with-param name="ayrac" select="'-'"/>
										</xsl:call-template>
									</td></tr>
								</table>
							</td>
						</tr>
					</table>
					<div class="ettn"><b>ETTN: </b><xsl:value-of select="$F/cbc:UUID"/></div>

					<table class="satirlar">
						<tr>
							<th style="width: 28px;">S.N</th>
							<th>Mal/Hizmet</th>
							<th style="width: 70px;">Miktar</th>
							<th style="width: 60px;">Birim</th>
							<th style="width: 95px;">Fiyat</th>
							<th style="width: 60px;">KDV O.</th>
							<th style="width: 95px;">KDV Tutarı</th>
							<th style="width: 140px;">Tutar</th>
						</tr>
						<xsl:for-each select="$F/cac:InvoiceLine">
							<xsl:variable name="kdv" select="cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode = '0015'][1]"/>
							<tr>
								<td class="orta"><xsl:value-of select="cbc:ID"/></td>
								<td><xsl:value-of select="cac:Item/cbc:Name"/></td>
								<td class="orta"><xsl:value-of select="format-number(cbc:InvoicedQuantity, '#.##0,###', 'tr')"/></td>
								<td class="orta"><xsl:call-template name="birim"><xsl:with-param name="k" select="cbc:InvoicedQuantity/@unitCode"/></xsl:call-template></td>
								<td class="orta"><xsl:value-of select="concat(format-number(cac:Price/cbc:PriceAmount, '#.##0,##', 'tr'), ' ', $pb)"/></td>
								<td class="orta"><xsl:value-of select="concat('%', format-number(sum($kdv/cbc:Percent), '0,00', 'tr'))"/></td>
								<td class="orta"><xsl:call-template name="para"><xsl:with-param name="d" select="sum($kdv/cbc:TaxAmount)"/></xsl:call-template></td>
								<td class="sag"><xsl:call-template name="para"><xsl:with-param name="d" select="cbc:LineExtensionAmount"/></xsl:call-template></td>
							</tr>
						</xsl:for-each>
					</table>

					<table class="toplam">
						<tr><td class="e">Mal/Hizmet Toplam Tutarı</td><td class="d"><xsl:call-template name="para"><xsl:with-param name="d" select="$F/cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/></xsl:call-template></td></tr>
						<xsl:if test="$F/cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount &gt; 0">
							<tr><td class="e">Toplam İskonto</td><td class="d"><xsl:call-template name="para"><xsl:with-param name="d" select="$F/cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount"/></xsl:call-template></td></tr>
						</xsl:if>
						<xsl:for-each select="$F/cac:TaxTotal/cac:TaxSubtotal">
							<tr>
								<td class="e">
									<xsl:choose>
										<xsl:when test="normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:Name)"><xsl:value-of select="cac:TaxCategory/cac:TaxScheme/cbc:Name"/></xsl:when>
										<xsl:otherwise>KDV</xsl:otherwise>
									</xsl:choose>
									<xsl:value-of select="concat('(', format-number(cbc:TaxableAmount, '#.##0,00', 'tr'), ' %', format-number(cbc:Percent, '0,##', 'tr'), ')')"/>
								</td>
								<td class="d"><xsl:call-template name="para"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template></td>
							</tr>
						</xsl:for-each>
						<xsl:for-each select="$F/cac:WithholdingTaxTotal/cac:TaxSubtotal">
							<tr>
								<td class="e"><xsl:value-of select="concat('KDV Tevkifat (', cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode, ')')"/></td>
								<td class="d"><xsl:call-template name="para"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template></td>
							</tr>
						</xsl:for-each>
						<tr><td class="e">Vergiler Dahil Toplam Tutar</td><td class="d"><xsl:call-template name="para"><xsl:with-param name="d" select="$F/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/></xsl:call-template></td></tr>
						<tr><td class="e">Ödenecek Tutar</td><td class="d"><xsl:call-template name="para"><xsl:with-param name="d" select="$F/cac:LegalMonetaryTotal/cbc:PayableAmount"/></xsl:call-template></td></tr>
					</table>

					<div class="notlar">
						<xsl:for-each select="$F/cac:TaxTotal/cac:TaxSubtotal[normalize-space(cac:TaxCategory/cbc:TaxExemptionReasonCode)]">
							<div style="padding-left: 4px;">
								<b>Vergi İstisna Muafiyet Sebebi: </b>
								<xsl:value-of select="cac:TaxCategory/cbc:TaxExemptionReasonCode"/>
								<xsl:if test="normalize-space(cac:TaxCategory/cbc:TaxExemptionReason)">-<xsl:value-of select="cac:TaxCategory/cbc:TaxExemptionReason"/></xsl:if>
							</div>
						</xsl:for-each>
						<xsl:for-each select="$F/cbc:Note[starts-with(normalize-space(.), 'YALNIZ')]">
							<div><xsl:value-of select="."/></div>
						</xsl:for-each>
						<xsl:for-each select="$F/cbc:Note[starts-with(normalize-space(.), 'Ödeme Notu:')]">
							<div style="margin-top: 10px; padding-left: 4px;"><b>Ödeme Notu:</b><xsl:value-of select="substring-after(., 'Ödeme Notu:')"/></div>
						</xsl:for-each>
						<xsl:for-each select="$F/cbc:Note[not(starts-with(normalize-space(.), 'YALNIZ')) and not(starts-with(normalize-space(.), 'Ödeme Notu:'))]">
							<div style="margin-top: 4px;"><xsl:value-of select="."/></div>
						</xsl:for-each>
						<div style="margin-top: 10px;"><b>İrsaliye yerine geçer.</b></div>
						<xsl:if test="$earsiv"><div><b>e-Arşiv İzni Kapsamında Üretilmiştir.</b></div></xsl:if>
					</div>
				</div>
			</body>
		</html>
	</xsl:template>
</xsl:stylesheet>
