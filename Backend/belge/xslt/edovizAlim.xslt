<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ccts="urn:un:unece:uncefact:documentation:2"
  xmlns:clm54217="urn:un:unece:uncefact:codelist:specification:54217:2001"
  xmlns:clm5639="urn:un:unece:uncefact:codelist:specification:5639:1988"
  xmlns:clm66411="urn:un:unece:uncefact:codelist:specification:66411:2001"
  xmlns:clmIANAMIMEMediaType="urn:un:unece:uncefact:codelist:specification:IANAMIMEMediaType:2003"
  xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"
  xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:xdt="http://www.w3.org/2005/xpath-datatypes" xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:lcl="http://www.efatura.gov.tr/local" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  exclude-result-prefixes="cac cbc ccts clm54217 clm5639 clm66411 clmIANAMIMEMediaType fn link n1 qdt udt xbrldi xbrli xdt xlink xs xsd xsi lcl">
  <xsl:character-map name="a">
    <xsl:output-character character="&#128;" string=""/>
    <xsl:output-character character="&#129;" string=""/>
    <xsl:output-character character="&#130;" string=""/>
    <xsl:output-character character="&#131;" string=""/>
    <xsl:output-character character="&#132;" string=""/>
    <xsl:output-character character="&#133;" string=""/>
    <xsl:output-character character="&#134;" string=""/>
    <xsl:output-character character="&#135;" string=""/>
    <xsl:output-character character="&#136;" string=""/>
    <xsl:output-character character="&#137;" string=""/>
    <xsl:output-character character="&#138;" string=""/>
    <xsl:output-character character="&#139;" string=""/>
    <xsl:output-character character="&#140;" string=""/>
    <xsl:output-character character="&#141;" string=""/>
    <xsl:output-character character="&#142;" string=""/>
    <xsl:output-character character="&#143;" string=""/>
    <xsl:output-character character="&#144;" string=""/>
    <xsl:output-character character="&#145;" string=""/>
    <xsl:output-character character="&#146;" string=""/>
    <xsl:output-character character="&#147;" string=""/>
    <xsl:output-character character="&#148;" string=""/>
    <xsl:output-character character="&#149;" string=""/>
    <xsl:output-character character="&#150;" string=""/>
    <xsl:output-character character="&#151;" string=""/>
    <xsl:output-character character="&#152;" string=""/>
    <xsl:output-character character="&#153;" string=""/>
    <xsl:output-character character="&#154;" string=""/>
    <xsl:output-character character="&#155;" string=""/>
    <xsl:output-character character="&#156;" string=""/>
    <xsl:output-character character="&#157;" string=""/>
    <xsl:output-character character="&#158;" string=""/>
    <xsl:output-character character="&#159;" string=""/>
  </xsl:character-map>
  <xsl:decimal-format name="european" decimal-separator="," grouping-separator="." NaN=""/>
  <xsl:output version="4.0" method="html" indent="no" encoding="UTF-8"
    doctype-public="-//W3C//DTD HTML 4.01 Transitional//EN"
    doctype-system="http://www.w3.org/TR/html4/loose.dtd" use-character-maps="a"/>
  <xsl:param name="SV_OutputFormat" select="'HTML'"/>
  <xsl:variable name="XML" select="/"/>
  <xsl:variable name="imgSign"
    select="'data:image/@wetsignatureimageformat@;base64,@wetsignatureimagecontent@'"/>
  <xsl:variable name="showWatermark" select="false()"/>
  <xsl:variable name="showCancelWatermark" select="false()"/>
  <xsl:variable name="dovizliFatura" select="false()"/>

  <xsl:variable name="SellersItemIdentificationDataType" select="false()"/>
  <xsl:variable name="BuyersItemIdentificationDataType" select="false()"/>
  <xsl:variable name="ManufacturersItemIdentificationDataType" select="false()"/>
  <xsl:variable name="NameDataType" select="false()"/>
  <xsl:variable name="BrandNameDataType" select="false()"/>
  <xsl:variable name="ModelNameDataType" select="false()"/>
  <xsl:variable name="DescriptionDataType" select="false()"/>
  <xsl:variable name="ItemCommodityClassificationDataType" select="false()"/>
  <xsl:variable name="imgCancelWatermarkContent"
    select="'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Fllv5BwOojHqf6CuKnUTvWm/kfSY3CShyZfh6e+rk+vz6JGb418FC5V9S0mMCYDMsKj73uPesLwf4wl0ScWWoFms2bHPWI/57V6H4Y1C91PQobnUofKmb2xvH97HauZ8a+Chcq+paTGBMBmWFR973HvRUptfvqQYTFwknl+O1WyfZ+v5M6jWtds9L0J755VZXT9yFOfMJHGK4D4c6VJea8+pyJ+5gBwx7uayNA0HUfE14lrvkW2t+HkfJWIZ5AHqfSvYdO0620qwjtLKPZFGOPUn1PqacOavNTaskTifZZVQnhqcuac9/Jf5lqiiiu4+XCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoo6dar219a3jSC1njlMTbXCNnafQ0XGotq6RYoIBBBGQeoNFFAjzDxt4JNiX1PSI82x5lhUf6r3H+z/L6dMPwn/Zs/iKI647FSfkLHKs3YMa9rIBBBGQeoNeYeNvBJsS+p6RHm2PMsKj/AFXuP9n+X06edWocj9pBfI+wy3NPrFP6piJWbVlL9PX8/U7/AFbWLPQ9NN1duFQDCIvVz2ArnPB/irU/EGrXaT2o+xgblkUY8o9lJ75/OuL0bS9V8YXsMEtxI1tbKFaZzkRL6D1Jr1zTNMtdIsI7OxjEcSD8WPck9zW1Oc60lJaRX4nn4vD4bL6Loy9+rL/yVf5/1tvZjijiBESKgJyQoxk06iius+fvcKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACijp1rmbvx7o9nq32KV3IBw0yjKqfSplOMfiZvRw9Wu2qUW7djc1O0kvtMntoZmgeRCqyL1U147FNq3gvxA24FZVPzqT8sy/1Hv2r2W0vba+gE1nMk0Z6MjZrP8ReHbXxDYGGcbJl5ilA5Q/4e1YVqTqJSg9UepluOjhJSo143hLfTVEuha7aa9p63No3PSSM/eQ+hrSrxOGbVfBXiAggpIhwyn7kyf4fyr0geONKPh7+1PM5+79nz8+/+7j+tKliFJWno0Vj8pnSmpYf3oS2t+X/BOkoIBBBGQeoNedeE9d1/XvFElx1s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'"/>

  <xsl:variable name="imgWatermarkContent"
    select="'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'"/>

  <xsl:variable name="imgWatermark" select="concat('data:image/jpeg;base64,', $imgWatermarkContent)"/>
  <xsl:variable name="imgCancelWatermark"
    select="concat('data:image/jpeg;base64,', $imgCancelWatermarkContent)"/>
  <xsl:template match="/">
    <html>
      <head>
        <meta http-equiv="X-UA-Compatible" content="IE=9"/>
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
          body {
              background-color: #FFFFFF;
              font-family: 'Tahoma', "Times New Roman", Times, serif;
              font-size: 9px;
              color: #666666;
          }
          h1,
          h2 {
              padding-bottom: 3px;
              padding-top: 3px;
              margin-bottom: 5px;
              text-transform: uppercase;
              font-family: Arial, Helvetica, sans-serif;
          }
          h1 {
              font-size: 12px;
              text-transform: none;
          }
          h2 {
              font-size: 9px;
              color: brown;
          }
          h3 {
              font-size: 9px;
              color: #333333;
              text-align: justify;
              margin: 0;
              padding: 0;
          }
          h4 {
              font-size: 10px;
              font-style: bold;
              font-family: Arial, Helvetica, sans-serif;
              color: #000000;
              margin: 0;
              padding: 0;
          }
          hr {
              height: 2px;
              color: #000000;
              border-bottom: 1px solid #000000;
          }
          p,
          ul,
          ol {
              margin-top: 1.5em;
          }
          ul,
          ol {
              margin-left: 3em;
          }
          blockquote {
              margin-left: 3em;
              margin-right: 3em;
              font-style: italic;
          }
          a {
              text-decoration: none;
              color: #70A300;
          }
          a:hover {
              border: none;
              color: #70A300;
          }
          #despatchTable {
              border-collapse: collapse;
              font-size: 9px;
              float: right;
              border-color: gray;
          }
          #ettnTable {
              border-collapse: collapse;
              font-size: 9px;
              border-color: gray;
          }
          #customerPartyTable {
              border-width: 0px;
              border-spacing: ;
              border-style: inset;
              border-color: gray;
              border-collapse: collapse;
          }
          #customerIDTable {
              border-width: 2px;
              border-spacing: ;
              border-style: inset;
              border-color: gray;
              border-collapse: collapse;
          }
          #customerIDTableTd {
              border-width: 2px;
              border-spacing: ;
              border-style: inset;
              border-color: gray;
              border-collapse: collapse;
          }
          #lineTable {
              border-width: 2px;
              border-spacing: ;
              border-style: inset;
              border-color: black;
              border-collapse: collapse;
          }
          #lineTableTd {
              border-width: 1px;
              padding: 1px;
              border-style: inset;
              border-color: black;
          }
          #lineTableTr {
              border-width: 1px;
              padding: 0px;
              border-style: inset;
              border-color: black;
              -moz-border-radius: ;
          }
          #lineTableDummyTd {
              border-width: 1px;
              border-color: white;
              padding: 1px;
              border-style: inset;
              border-color: black;
          }
          #lineTableBudgetTd {
              border-width: 2px;
              border-spacing: 0px;
              padding: 1px;
              border-style: inset;
              border-color: black;
              -moz-border-radius: ;
          }
          #infoTable {
              border-width: 0px;
              border-spacing: ;
              border-style: inset;
              border-color: black;
              border-collapse: collapse;
          }
          #notesTable {
              border-width: 2px;
              border-spacing: ;
              border-style: inset;
              border-color: black;
              border-collapse: collapse;
          }
          #notesTableTd {
              border-width: 0px;
              border-spacing: ;
              border-style: inset;
              border-color: black;
              border-collapse: collapse;
          }
          #infoTableTd {
              border-width: 2px;
              border-spacing: ;
              border-style: inset;
              border-color: black;
              border-collapse: collapse;
          }
          table {
              border-spacing: 0px;
          }
          #budgetContainerTable {
              border-width: 0px;
              border-spacing: 0px;
              border-style: inset;
              border-color: black;
              border-collapse: collapse;
          }
          td {
              border-color: gray;
          }
          ul.ddr {
              border: 2px solid black;
              list-style-type: none;
              display: inline-block;
              padding: 0;
              width: 697px;
              margin: 0;
              margin-bottom: 15px;
          }
          ul.ddr li {
              float: left;
              padding: 2px 3px;
              padding-right: 15px;
          }
          ul.ddr li.title {
              float: none;
              font-weight: bold;
              border-bottom: 1px dotted gray
          }
          }</style>
        <title>e-Döviz ve Kıymetli Maden Satım Belgesi</title>
      </head>
      <body style="margin-left=0.6in; margin-right=0.6in; margin-top=0.79in; margin-bottom=0.79in">
        <xsl:if test="$showWatermark">
          <img class="watermark" style="width:650px;position:absolute;z-index:-1;margin-top:250px;"
            src="{$imgWatermark}"/>
        </xsl:if>
        <xsl:if test="$showCancelWatermark">
          <img style="width:630px;position:absolute;z-index:-1;margin-top:160px;"
            src="{$imgCancelWatermark}"/>
        </xsl:if>
        <xsl:for-each select="$XML">
          <table style="border-color:blue; " border="0" cellspacing="0px" width="700"
            cellpadding="0px">
            <tbody>
              <tr valign="top">
                <td width="40%">
                  <br/>
                  <hr/>
                  <table align="center" border="0" width="100%">
                    <tbody>
                      <tr>
                        <td style="width:469px; " align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>DÜZENLEYEN YETKİLİ MÜESSESE BİLGİLERİ</xsl:text>
                          </span>
                        </td>
                      </tr>
                      <tr align="left">
                        <xsl:for-each select="n1:CreditNote/cac:AccountingSupplierParty/cac:Party">
                          <td align="left">
                            <xsl:if test="cac:PartyName">
                              <xsl:value-of select="cac:PartyName/cbc:Name"/>
                              <br/>
                            </xsl:if>
                            <xsl:for-each select="cac:Person">
                              <xsl:for-each select="cbc:Title">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                              <xsl:for-each select="cbc:FirstName">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                              <xsl:for-each select="cbc:MiddleName">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                              <xsl:for-each select="cbc:FamilyName">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                              <xsl:for-each select="cbc:NameSuffix">
                                <xsl:apply-templates/>
                              </xsl:for-each>
                            </xsl:for-each>
                          </td>
                        </xsl:for-each>
                      </tr>
                      <tr align="left">
                        <xsl:for-each select="n1:CreditNote/cac:AccountingSupplierParty/cac:Party">
                          <td align="left">
                            <xsl:for-each select="cac:PostalAddress">
                              <xsl:for-each select="cbc:StreetName">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                              <xsl:for-each select="cbc:BuildingName">
                                <xsl:apply-templates/>
                              </xsl:for-each>
                              <xsl:if test="cbc:BuildingNumber">
                                <xsl:text> No:</xsl:text>
                                <xsl:for-each select="cbc:BuildingNumber">
                                  <xsl:apply-templates/>
                                </xsl:for-each>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:if>
                              <br/>
                              <xsl:for-each select="cbc:PostalZone">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                              <xsl:for-each select="cbc:CitySubdivisionName">
                                <xsl:apply-templates/>
                              </xsl:for-each>
                              <xsl:text>/ </xsl:text>
                              <xsl:for-each select="cbc:CityName">
                                <xsl:apply-templates/>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                            </xsl:for-each>
                          </td>
                        </xsl:for-each>
                      </tr>
                      <xsl:if
                        test="//n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cac:Contact/cbc:Telephone or //n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cac:Contact/cbc:Telefax">
                        <tr align="left">
                          <xsl:for-each select="n1:CreditNote/cac:AccountingSupplierParty/cac:Party">
                            <td align="left">
                              <xsl:for-each select="cac:Contact">
                                <xsl:if test="cbc:Telephone">
                                  <xsl:text>Tel: </xsl:text>
                                  <xsl:for-each select="cbc:Telephone">
                                    <xsl:apply-templates/>
                                  </xsl:for-each>
                                </xsl:if>
                                <xsl:if test="cbc:Telefax">
                                  <xsl:text> Fax: </xsl:text>
                                  <xsl:for-each select="cbc:Telefax">
                                    <xsl:apply-templates/>
                                  </xsl:for-each>
                                </xsl:if>
                                <xsl:text>&#160;</xsl:text>
                              </xsl:for-each>
                            </td>
                          </xsl:for-each>
                        </tr>
                      </xsl:if>
                      <xsl:for-each
                        select="//n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cbc:WebsiteURI">
                        <tr align="left">
                          <td>
                            <xsl:text>Web Sitesi: </xsl:text>
                            <xsl:value-of select="."/>
                          </td>
                        </tr>
                      </xsl:for-each>
                      <xsl:for-each
                        select="//n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cac:Contact/cbc:ElectronicMail">
                        <tr align="left">
                          <td>
                            <xsl:text>E-Posta: </xsl:text>
                            <xsl:value-of select="."/>
                          </td>
                        </tr>
                      </xsl:for-each>
                      <tr align="left">
                        <xsl:for-each select="n1:CreditNote/cac:AccountingSupplierParty/cac:Party">
                          <td align="left">
                            <xsl:text>Vergi Dairesi: </xsl:text>
                            <xsl:for-each select="cac:PartyTaxScheme">
                              <xsl:for-each select="cac:TaxScheme">
                                <xsl:for-each select="cbc:Name">
                                  <xsl:apply-templates/>
                                </xsl:for-each>
                              </xsl:for-each>
                              <xsl:text>&#160; </xsl:text>
                            </xsl:for-each>
                          </td>
                        </xsl:for-each>
                      </tr>
                      <xsl:for-each
                        select="//n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification">
                        <tr align="left">
                          <td>
                            <xsl:value-of select="cbc:ID/@schemeID"/>
                            <xsl:text>: </xsl:text>
                            <xsl:value-of select="cbc:ID"/>
                          </td>
                        </tr>
                      </xsl:for-each>
                    </tbody>
                  </table>
                  <hr/>
                </td>
                <td width="20%" align="center" valign="middle">
                  <br/>
                  <br/>
                  <img style="width:91px;" align="middle" alt="E-Müstahsil Makbuz Logo"
                    src="data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAABkAAD/4QMZaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzEzMiA3OS4xNTkyODQsIDIwMTYvMDQvMTktMTM6MTM6NDAgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjZDNDJBNEI2QjVCRDExRThCQjM0REIwQkZGMEQxODY0IiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZDNDJBNEI1QjVCRDExRThCQjM0REIwQkZGMEQxODY0IiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzQgV2luZG93cyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSIzREVENkU1N0FDREVDNEJBNzkxNUM2M0NCN0RENzM0NyIgc3RSZWY6ZG9jdW1lbnRJRD0iM0RFRDZFNTdBQ0RFQzRCQTc5MTVDNjNDQjdERDczNDciLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAOQWRvYmUAZMAAAAAB/9sAhAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB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"/>

                  <h1 align="center">
                    <span style="font-weight:bold; ">
                      <xsl:text>e-DÖVİZ VE KIYMETLİ MADEN ALIM BELGESİ</xsl:text>
                    </span>
                  </h1>
                  <!-- <div id="wetsignatureimage"> -->
                  <!-- <img width="90"> -->
                  <!-- <xsl:attribute name="src"> -->
                  <!-- <xsl:value-of select="$imgSign"/> -->
                  <!-- </xsl:attribute> -->
                  <!-- <xsl:attribute name="alt"/> -->
                  <!-- </img> -->
                  <!-- </div> -->
                </td>
                <td width="40%" align="left" valign="top">
                  <br/>
                  <xsl:if test="n1:CreditNote/cbc:ProfileID = 'EKIYMETLIMADENBELGE'">
                    <table width="100%">
                      <tr>
                        <td align="right" valign="top"> </td>
                        <td align="right" valign="top" width="20%">
                          <div id="qrcode"/>
                          <div id="qrvalue"
                            style="visibility: hidden; height: 20px;width: 20px; ; display:none">
                              {"vkntckn":"<xsl:value-of
                              select="n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']"
                            />" ,"avkntckn":"<xsl:value-of
                              select="n1:CreditNote/cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']"
                            />", "senaryo":"<xsl:value-of select="n1:CreditNote/cbc:ProfileID"/>",
                              "tip":"<xsl:value-of select="n1:CreditNote/cbc:CreditNoteTypeCode"/>",
                              "tarih":"<xsl:value-of select="n1:CreditNote/cbc:IssueDate"/>",
                              "no":"<xsl:value-of select="n1:CreditNote/cbc:ID"/>",
                              "ettn":"<xsl:value-of select="n1:CreditNote/cbc:UUID"
                              />","miktari(<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount/@currencyID"
                              />)":"<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount"
                            />", "birimfiyati":"<xsl:value-of
                              select="format-number(1 div n1:CreditNote/cac:PaymentExchangeRate/cbc:CalculationRate, '###.##0,00', 'european')"
                            />", "odenecek":"<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:PayableAmount"/>"} </div>
                          <script type="text/javascript">
                            var qrcode = new QRCode(document.getElementById("qrcode"), {
                            width : 210,
                            height : 210,
                            orrectLevel : QRCode.CorrectLevel.H
                            });
                            
                            function makeCode (msg) {
                            var elText = document.getElementById("text");
                            
                            qrcode.makeCode(msg);
                            }
                            
                            makeCode(document.getElementById("qrvalue").innerHTML);
                          </script>
                        </td>
                      </tr>
                    </table>
                  </xsl:if>
                  <xsl:if test="n1:CreditNote/cbc:ProfileID = 'EDOVIZBELGE'">
                    <table width="100%">
                      <tr>
                        <td align="right" valign="top"> </td>
                        <td align="right" valign="top" width="20%">
                          <div id="qrcode"/>
                          <div id="qrvalue"
                            style="visibility: hidden; height: 20px;width: 20px; ; display:none">
                              {"vkntckn":"<xsl:value-of
                              select="n1:CreditNote/cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']"
                            />", "avkntckn":"<xsl:value-of
                              select="n1:CreditNote/cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID[@schemeID = 'TCKN' or @schemeID = 'VKN']"
                            />", "senaryo":"<xsl:value-of select="n1:CreditNote/cbc:ProfileID"
                              />","tip":"<xsl:value-of select="n1:CreditNote/cbc:CreditNoteTypeCode"
                            />", "tarih":"<xsl:value-of select="n1:CreditNote/cbc:IssueDate"/>",
                              "no":"<xsl:value-of select="n1:CreditNote/cbc:ID"
                              />","ettn":"<xsl:value-of select="n1:CreditNote/cbc:UUID"/>"
                            ,"miktari(<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount/@currencyID"
                            />)":"<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount"
                            />", "uygulanankur":"<xsl:for-each select="//n1:CreditNote/cac:PaymentExchangeRate">
                              <xsl:value-of
                                select="format-number(1 div cbc:CalculationRate, '###.##0,00', 'european')"
                              />
                            </xsl:for-each>","dovizkarsiligi":"<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount"
                            />", "tlkarsiligi":"<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"
                            />", "odenecek(<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:PayableAmount/@currencyID"
                            />)":"<xsl:value-of
                              select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:PayableAmount"/>"} </div>
                          <script type="text/javascript">
                            var qrcode = new QRCode(document.getElementById("qrcode"), {
                            width : 210,
                            height : 210
                            });
                            
                            <xsl:for-each select="//n1:CreditNote/cac:PaymentExchangeRate">
                              <xsl:value-of
                                select="format-number(1 div cbc:CalculationRate, '###.##0,00', 'european')"
                              />
                            </xsl:for-each>
                       
                            
                            function makeCode (msg) {
                            var elText = document.getElementById("text");
                            
                            qrcode.makeCode(msg);
                            }
                            
                            makeCode(document.getElementById("qrvalue").innerHTML);
                          </script>
                        </td>
                      </tr>
                    </table>
                  </xsl:if>
                </td>
              </tr>
              <tr style="height:118px; " valign="top">
                <td width="40%" align="right" valign="bottom">
                  <table id="customerPartyTable" align="left" border="0">
                    <tbody>
                      <tr style="height:71px; ">
                        <td>
                          <hr/>
                          <table align="center" border="0">
                            <tbody>
                              <tr>
                                <td style="width:469px; " align="left">
                                  <span style="font-weight:bold; ">
                                    <xsl:choose>
                                      <xsl:when test="n1:CreditNote/cbc:ProfileID = 'EDOVIZBELGE'">
                                        <xsl:text>DÖVİZ SATAN KİŞİ/KURULUŞ BİLGİLERİ</xsl:text>
                                      </xsl:when>
                                      <xsl:when
                                        test="n1:CreditNote/cbc:ProfileID = 'EKIYMETLIMADENBELGE'">
                                        <xsl:text>KIYMETLİ MADEN SATAN KİŞİ/KURULUŞ BİLGİLERİ</xsl:text>
                                      </xsl:when>
                                      <xsl:otherwise> </xsl:otherwise>

                                    </xsl:choose>
                                  </span>
                                </td>
                              </tr>
                              <tr>
                                <xsl:for-each
                                  select="n1:CreditNote/cac:AccountingCustomerParty/cac:Party">
                                  <xsl:call-template name="Party_Title">
                                    <xsl:with-param name="PartyType">OTHER</xsl:with-param>
                                  </xsl:call-template>
                                </xsl:for-each>
                              </tr>
                              <xsl:for-each
                                select="n1:CreditNote/cac:AccountingCustomerParty/cac:Party">
                                <tr>
                                  <xsl:call-template name="Party_Adress">
                                    <xsl:with-param name="PartyType">OTHER</xsl:with-param>
                                  </xsl:call-template>
                                </tr>
                                <xsl:call-template name="Party_Other">
                                  <xsl:with-param name="PartyType">OTHER</xsl:with-param>
                                </xsl:call-template>
                              </xsl:for-each>
                            </tbody>
                          </table>
                          <hr/>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <br/>
                </td>

                <td width="60%" align="center" valign="bottom" colspan="3">
                  <table border="2" height="13" id="despatchTable">
                    <span style="font-weight:bold; ">
                      <xsl:text>ALIM BELGESİ BİLGİLERİ</xsl:text>
                    </span>
                    <tbody>
                      <tr style="height:13px; ">
                        <td align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>Belge Numarası:</xsl:text>
                          </span>
                        </td>
                        <td align="left">
                          <xsl:for-each select="n1:CreditNote/cbc:ID">
                            <xsl:apply-templates/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr style="height:13px; ">
                        <td align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>Düzenlenme Tarihi:</xsl:text>
                          </span>
                        </td>
                        <td align="left">
                          <xsl:for-each select="n1:CreditNote/cbc:IssueDate">
                            <xsl:apply-templates select="."/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr style="height:13px; ">
                        <td align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>Dosya No-Şube Kodu:</xsl:text>
                          </span>
                        </td>
                        <td align="left">
                          <xsl:value-of
                            select="//cac:PaymentMeans/cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cac:FinancialInstitution/cbc:Name"
                          />
                        </td>
                      </tr>
                      <tr style="height:13px; ">
                        <td align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>İstatistik No.(lar):</xsl:text>
                          </span>
                        </td>
                        <td align="left">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'ISTATISTIKNO']">
                            <xsl:value-of select="cbc:ID"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr style="height:13px; ">
                        <td align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>Senaryo:</xsl:text>
                          </span>
                        </td>
                        <td align="left">
                          <xsl:for-each select="n1:CreditNote/cbc:ProfileID">
                            <xsl:apply-templates/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr style="height:13px; ">
                        <td align="left">
                          <span style="font-weight:bold; ">
                            <xsl:text>Tip:</xsl:text>
                          </span>
                        </td>
                        <td align="left">
                          <xsl:for-each select="n1:CreditNote/cbc:CreditNoteTypeCode">
                            <xsl:apply-templates/>
                          </xsl:for-each>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr align="left">
                <table id="ettnTable">
                  <tr style="height:13px;">
                    <td align="left" valign="top">
                      <span style="font-weight:bold; ">
                        <xsl:text>ETTN:</xsl:text>
                      </span>
                    </td>
                    <td align="left" width="240px">
                      <xsl:for-each select="n1:CreditNote">
                        <xsl:for-each select="cbc:UUID">
                          <xsl:apply-templates/>
                        </xsl:for-each>
                      </xsl:for-each>
                    </td>
                  </tr>
                </table>
              </tr>
            </tbody>
          </table>
          <div id="lineTableAligner">
            <span>
              <xsl:text>&#160;</xsl:text>
            </span>
          </div>
          <br/>
        </xsl:for-each>

        <!-- buraya -->
        <table id="infoTable" width="850px">
          <tbody>
            <tr>
              <b>
                <span style="font-size:10pt; color:black;"
                  >&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;
                  &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;
                  &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;
                  &#160;&#160;&#160;&#160;&#160;&#160; <xsl:choose>
                    <xsl:when test="n1:CreditNote/cbc:ProfileID = 'EDOVIZBELGE'">
                      <xsl:text>SATIN ALINAN DÖVİZE/EFEKTİFE AİT BİLGİLER</xsl:text>
                    </xsl:when>
                    <xsl:otherwise>
                      <xsl:text>SATIN ALINAN KIYMETLİ MADENE AİT BİLGİLER</xsl:text>
                    </xsl:otherwise>
                  </xsl:choose>
                </span>
              </b>
            </tr>
            <tr>
              <br/>
              <br/>
              <br/>
            </tr>
            <tr>
              <td>
                <table>
                  <xsl:choose>
                    <xsl:when test="n1:CreditNote/cbc:ProfileID = 'EDOVIZBELGE'">
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Döviz/Efektifinin Miktarı / Birimi</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:PayableAmount">
                            <xsl:call-template name="Curr_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="180px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Uygulanan Kur</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:81px; " align="right">
                          <xsl:for-each select="//n1:CreditNote/cac:PaymentExchangeRate">
                            <xsl:value-of
                              select="format-number(cbc:CalculationRate, '###.##0,00', 'european')"
                            />
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>TL Karşılığı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="//n1:CreditNote/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount">
                            <xsl:call-template name="Curr_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>ABD Doları Karşılığı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each select="//n1:CreditNote/cac:LegalMonetaryTotal">
                            <xsl:value-of
                              select="format-number(cbc:PayableAmount * //n1:CreditNote/cac:PricingExchangeRate/cbc:CalculationRate, '###.##0,00', 'european')"/>
                            <xsl:text> USD</xsl:text>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>BSMV</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each select="//cac:PricingExchangeRate">
                            <xsl:value-of select="cbc:TargetCurrencyBaseRate"/>
                          </xsl:for-each>
                          <xsl:for-each
                            select="//n1:CreditNote//cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme">
                            <xsl:if test="cbc:TaxTypeCode = '0021'">
                              <xsl:text> </xsl:text>
                              <xsl:for-each select="../../cbc:TaxAmount">
                                <xsl:call-template name="Curr_Type"/>
                              </xsl:for-each>
                            </xsl:if>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Toplam Tutar</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount">
                            <xsl:call-template name="Curr_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                    </xsl:when>
                    <xsl:otherwise>
                      <xsl:for-each
                        select="//n1:CreditNote//cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme">
                        <xsl:if test="cbc:TaxTypeCode = '0015'">
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="150px">
                              <span style="font-weight:bold; ">
                                <xsl:text>Kıymetli Madenin Miktarı / Birimi (ADET)</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:82px; " align="right">
                              <xsl:for-each
                                select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:PayableAmount">
                                <xsl:call-template name="Currency_Type"/>
                              </xsl:for-each>
                            </td>
                          </tr>
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="180px">
                              <span style="font-weight:bold; ">
                                <xsl:text>Birim Fiyatı</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:81px; " align="right">
                              <xsl:for-each select="//n1:CreditNote/cac:PaymentExchangeRate">
                                <xsl:value-of
                                  select="format-number(cbc:CalculationRate, '###.##0,00', 'european')"
                                />
                              </xsl:for-each>
                            </td>
                          </tr>
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="150px">
                              <span style="font-weight:bold; ">
                                <xsl:text>KDV Hariç Tutar</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:82px; " align="right">
                              <xsl:for-each select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount">
                                <xsl:call-template name="Curr_Type"/>
                              </xsl:for-each>
                            </td>
                          </tr>
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="150px">
                              <span style="font-weight:bold; ">
                                <xsl:text>KDV Matrahı</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:82px; " align="right">
                              <xsl:for-each select="n1:CreditNote/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount">
                                <xsl:call-template name="Curr_Type"/>
                              </xsl:for-each>
                            </td>
                          </tr>
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="150px">
                              <span style="font-weight:bold; ">
                                <xsl:text>Hesaplanan KDV Tutarı</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:82px; " align="right">
                              <xsl:for-each select="n1:CreditNote/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxAmount">
                                <xsl:call-template name="Curr_Type"/>
                              </xsl:for-each>
                            </td>
                          </tr>
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="150px">
                              <span style="font-weight:bold; ">
                                <xsl:text>KDV Dahil Tutar</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:82px; " align="right">
                              <xsl:for-each select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount">
                                <xsl:call-template name="Curr_Type"/>
                              </xsl:for-each>
                            </td>
                          </tr>
                          <tr id="budgetContainerTr">
                            <td/>
                            <td id="lineTableBudgetTd" width="150px">
                              <span style="font-weight:bold; ">
                                <xsl:text>Toplam Tutar</xsl:text>
                              </span>
                            </td>
                            <td id="lineTableBudgetTd" style="width:82px; " align="right">
                              <xsl:for-each
                                select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount">
                                <xsl:call-template name="Curr_Type"/>
                              </xsl:for-each>
                            </td>
                          </tr>
                         
                        </xsl:if>
                      </xsl:for-each>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Kıymetli Madenin Miktarı / Birimi (ADET)</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:PayableAmount">
                            <xsl:call-template name="Currency_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="180px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Birim Fiyatı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:81px; " align="right">
                          <xsl:for-each select="//n1:CreditNote/cac:PaymentExchangeRate">
                            <xsl:value-of
                              select="format-number(cbc:CalculationRate, '###.##0,00', 'european')"
                            />
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>KDV Hariç Tutar</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount">
                            <xsl:call-template name="Curr_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>KDV Matrahı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:text>0,00 TL</xsl:text>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Hesaplanan KDV Tutarı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:text>0,00 TL</xsl:text>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>KDV Dahil Tutar</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount">
                            <xsl:call-template name="Curr_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Toplam Tutar</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="n1:CreditNote/cac:LegalMonetaryTotal/cbc:LineExtensionAmount">
                            <xsl:call-template name="Curr_Type"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      
                    </xsl:otherwise>
                  </xsl:choose>
                </table>
              </td>
              <td id="notesTableTd1" height="100">
                <table>
                  <xsl:choose>
                    <xsl:when test="n1:CreditNote/cbc:ProfileID = 'EDOVIZBELGE'">
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Ait Olduğu Fatura No</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:81px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'FATURANO']">
                            <xsl:value-of select="cbc:ID"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="180px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Geldiği Ülke</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:81px; " align="right">
                          <xsl:for-each select="//cac:IssuerParty/cac:PostalAddress/cac:Country">
                            <xsl:value-of select="cbc:Name"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Geliş Nedeni</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'GELISNEDENI']">
                            <xsl:value-of select="cbc:ID"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Gümrük Beyannamelerinin Tarihi</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:81px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'GBTARIHI']">
                            <xsl:value-of select="cbc:IssueDate"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="180px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Gümrük Beyannamesi No.</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'GBNO']">
                            <xsl:value-of select="cbc:ID"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Döviz Beyan Tutanağı Tarihi</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'DBTTARIH']">
                            <xsl:value-of select="cbc:IssueDate"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="180px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Döviz Beyan Tutanağı Sayısı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:81px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'DBTSAYI']">
                            <xsl:value-of select="cbc:ID"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Gümrük Müdürlüğü Teyid Yazısı Tarihi</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'GMTYTARIH']">
                            <xsl:value-of select="cbc:IssueDate"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                      <tr id="budgetContainerTr">
                        <td/>
                        <td id="lineTableBudgetTd" width="150px">
                          <span style="font-weight:bold; ">
                            <xsl:text>Gümrük Müdürlüğü Teyid Yazısı Sayısı</xsl:text>
                          </span>
                        </td>
                        <td id="lineTableBudgetTd" style="width:82px; " align="right">
                          <xsl:for-each
                            select="//cac:AdditionalDocumentReference[cbc:DocumentTypeCode = 'GMTYSAYI']">
                            <xsl:value-of select="cbc:ID"/>
                          </xsl:for-each>
                        </td>
                      </tr>
                    </xsl:when>
                    <xsl:otherwise> </xsl:otherwise>
                  </xsl:choose>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <br/>
        <br/>
        <br/>
        <br/>
        <br/>
        <br/>
        <br/>
        <table id="infoTable" border="2" width="700" align="left">
          <tbody>
            <tr align="left">
              <td id="infoTableTd" height="100">
                <xsl:for-each select="//n1:CreditNote/cbc:Note">
                  <xsl:if test="position() &lt;= 1">
                    <b>&#160;&#160;&#160;&#160;&#160; Not: </b>
                    <xsl:value-of select="."/>
                    <br/>
                  </xsl:if>
                  <xsl:if test="position() &gt; 1">
                    <b style="visibility: hidden;">&#160;&#160;&#160;&#160;&#160; Not: </b>
                    <xsl:value-of select="."/>
                    <br/>
                  </xsl:if>
                </xsl:for-each>

              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="//cbc:IssueDate">
    <xsl:value-of select="substring(., 9, 2)"/>-<xsl:value-of select="substring(., 6, 2)"
      />-<xsl:value-of select="substring(., 1, 4)"/>
  </xsl:template>

  <xsl:template name="Party_Title">
    <xsl:param name="PartyType"/>
    <td style="width:469px; " align="left">
      <xsl:if test="cac:PartyName">
        <xsl:value-of select="cac:PartyName/cbc:Name"/>
        <br/>
      </xsl:if>
      <xsl:if test="cac:PartyLegalEntity">
        <span style="font-weight:bold; ">
          <xsl:text>VKN: ??</xsl:text>
        </span>
        <xsl:value-of select="cac:PartyLegalEntity/cbc:CompanyID"/>
        <br/>
      </xsl:if>
      <xsl:for-each select="cac:Person">
        <xsl:for-each select="cbc:Title">
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:FirstName">
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:MiddleName">
          <xsl:apply-templates/>
          <xsl:text>&#160; </xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:FamilyName">
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:NameSuffix">
          <xsl:apply-templates/>
        </xsl:for-each>
        <xsl:if test="$PartyType = 'TAXFREE'">
          <br/>
          <xsl:text>Pasaport No: </xsl:text>
          <xsl:value-of select="cac:IdentityDocumentReference/cbc:ID"/>
          <br/>
          <xsl:text>Ülkesi: </xsl:text>
          <xsl:for-each select="cbc:NationalityID">
            <xsl:call-template name="Country">
              <xsl:with-param name="CountryType">
                <xsl:value-of select="."/>
              </xsl:with-param>
            </xsl:call-template>
          </xsl:for-each>
        </xsl:if>

      </xsl:for-each>
    </td>
  </xsl:template>
  <xsl:template name="Party_Adress">
    <xsl:param name="PartyType"/>
    <td style="width:469px; " align="left">
      <xsl:for-each select="cac:PostalAddress">
        <xsl:for-each select="cbc:StreetName">
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:BuildingName">
          <xsl:apply-templates/>
        </xsl:for-each>
        <xsl:for-each select="cbc:BuildingNumber">
          <xsl:text> No:</xsl:text>
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <br/>
        <xsl:for-each select="cbc:Room">
          <xsl:text>Kapı No:</xsl:text>
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <br/>
        <xsl:for-each select="cbc:PostalZone">
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:CitySubdivisionName">
          <xsl:apply-templates/>
          <xsl:text>/ </xsl:text>
        </xsl:for-each>
        <xsl:for-each select="cbc:CityName">
          <xsl:apply-templates/>
          <xsl:text>&#160;</xsl:text>
        </xsl:for-each>
        <xsl:if test="$PartyType != 'OTHER'">
          <br/>
          <xsl:value-of select="cac:Country/cbc:Name"/>
          <br/>
        </xsl:if>
      </xsl:for-each>
    </td>
  </xsl:template>
  <xsl:template name="Country">
    <xsl:param name="CountryType"/>
    <xsl:choose>
      <xsl:when test="$CountryType = 'AF'">Afganistan</xsl:when>
      <xsl:when test="$CountryType = 'DE'">Almanya</xsl:when>
      <xsl:when test="$CountryType = 'AD'">Andorra</xsl:when>
      <xsl:when test="$CountryType = 'AO'">Angola</xsl:when>
      <xsl:when test="$CountryType = 'AG'">Antigua ve Barbuda</xsl:when>
      <xsl:when test="$CountryType = 'AR'">Arjantin</xsl:when>
      <xsl:when test="$CountryType = 'AL'">Arnavutluk</xsl:when>
      <xsl:when test="$CountryType = 'AW'">Aruba</xsl:when>
      <xsl:when test="$CountryType = 'AU'">Avustralya</xsl:when>
      <xsl:when test="$CountryType = 'AT'">Avusturya</xsl:when>
      <xsl:when test="$CountryType = 'AZ'">Azerbaycan</xsl:when>
      <xsl:when test="$CountryType = 'BS'">Bahamalar</xsl:when>
      <xsl:when test="$CountryType = 'BH'">Bahreyn</xsl:when>
      <xsl:when test="$CountryType = 'BD'">Bangladeş</xsl:when>
      <xsl:when test="$CountryType = 'BB'">Barbados</xsl:when>
      <xsl:when test="$CountryType = 'EH'">Batı Sahra (MA)</xsl:when>
      <xsl:when test="$CountryType = 'BE'">Belçika</xsl:when>
      <xsl:when test="$CountryType = 'BZ'">Belize</xsl:when>
      <xsl:when test="$CountryType = 'BJ'">Benin</xsl:when>
      <xsl:when test="$CountryType = 'BM'">Bermuda</xsl:when>
      <xsl:when test="$CountryType = 'BY'">Beyaz Rusya</xsl:when>
      <xsl:when test="$CountryType = 'BT'">Bhutan</xsl:when>
      <xsl:when test="$CountryType = 'AE'">Birleşik Arap Emirlikleri</xsl:when>
      <xsl:when test="$CountryType = 'US'">Birleşik Devletler</xsl:when>
      <xsl:when test="$CountryType = 'GB'">Birleşik Krallık</xsl:when>
      <xsl:when test="$CountryType = 'BO'">Bolivya</xsl:when>
      <xsl:when test="$CountryType = 'BA'">Bosna-Hersek</xsl:when>
      <xsl:when test="$CountryType = 'BW'">Botsvana</xsl:when>
      <xsl:when test="$CountryType = 'BR'">Brezilya</xsl:when>
      <xsl:when test="$CountryType = 'BN'">Bruney</xsl:when>
      <xsl:when test="$CountryType = 'BG'">Bulgaristan</xsl:when>
      <xsl:when test="$CountryType = 'BF'">Burkina Faso</xsl:when>
      <xsl:when test="$CountryType = 'BI'">Burundi</xsl:when>
      <xsl:when test="$CountryType = 'TD'">Çad</xsl:when>
      <xsl:when test="$CountryType = 'KY'">Cayman Adaları</xsl:when>
      <xsl:when test="$CountryType = 'GI'">Cebelitarık (GB)</xsl:when>
      <xsl:when test="$CountryType = 'CZ'">Çek Cumhuriyeti</xsl:when>
      <xsl:when test="$CountryType = 'DZ'">Cezayir</xsl:when>
      <xsl:when test="$CountryType = 'DJ'">Cibuti</xsl:when>
      <xsl:when test="$CountryType = 'CN'">Çin</xsl:when>
      <xsl:when test="$CountryType = 'DK'">Danimarka</xsl:when>
      <xsl:when test="$CountryType = 'CD'">Demokratik Kongo Cumhuriyeti</xsl:when>
      <xsl:when test="$CountryType = 'TL'">Doğu Timor</xsl:when>
      <xsl:when test="$CountryType = 'DO'">Dominik Cumhuriyeti</xsl:when>
      <xsl:when test="$CountryType = 'DM'">Dominika</xsl:when>
      <xsl:when test="$CountryType = 'EC'">Ekvador</xsl:when>
      <xsl:when test="$CountryType = 'GQ'">Ekvator Ginesi</xsl:when>
      <xsl:when test="$CountryType = 'SV'">El Salvador</xsl:when>
      <xsl:when test="$CountryType = 'ID'">Endonezya</xsl:when>
      <xsl:when test="$CountryType = 'ER'">Eritre</xsl:when>
      <xsl:when test="$CountryType = 'AM'">Ermenistan</xsl:when>
      <xsl:when test="$CountryType = 'MF'">Ermiş Martin (FR)</xsl:when>
      <xsl:when test="$CountryType = 'EE'">Estonya</xsl:when>
      <xsl:when test="$CountryType = 'ET'">Etiyopya</xsl:when>
      <xsl:when test="$CountryType = 'FK'">Falkland Adaları</xsl:when>
      <xsl:when test="$CountryType = 'FO'">Faroe Adaları (DK)</xsl:when>
      <xsl:when test="$CountryType = 'MA'">Fas</xsl:when>
      <xsl:when test="$CountryType = 'FJ'">Fiji</xsl:when>
      <xsl:when test="$CountryType = 'CI'">Fildişi Sahili</xsl:when>
      <xsl:when test="$CountryType = 'PH'">Filipinler</xsl:when>
      <xsl:when test="$CountryType = 'FI'">Finlandiya</xsl:when>
      <xsl:when test="$CountryType = 'FR'">Fransa</xsl:when>
      <xsl:when test="$CountryType = 'GF'">Fransız Guyanası (FR)</xsl:when>
      <xsl:when test="$CountryType = 'PF'">Fransız Polinezyası (FR)</xsl:when>
      <xsl:when test="$CountryType = 'GA'">Gabon</xsl:when>
      <xsl:when test="$CountryType = 'GM'">Gambiya</xsl:when>
      <xsl:when test="$CountryType = 'GH'">Gana</xsl:when>
      <xsl:when test="$CountryType = 'GN'">Gine</xsl:when>
      <xsl:when test="$CountryType = 'GW'">Gine Bissau</xsl:when>
      <xsl:when test="$CountryType = 'GD'">Grenada</xsl:when>
      <xsl:when test="$CountryType = 'GL'">Grönland (DK)</xsl:when>
      <xsl:when test="$CountryType = 'GP'">Guadeloupe (FR)</xsl:when>
      <xsl:when test="$CountryType = 'GT'">Guatemala</xsl:when>
      <xsl:when test="$CountryType = 'GG'">Guernsey (GB)</xsl:when>
      <xsl:when test="$CountryType = 'ZA'">Güney Afrika</xsl:when>
      <xsl:when test="$CountryType = 'KR'">Güney Kore</xsl:when>
      <xsl:when test="$CountryType = 'GE'">Gürcistan</xsl:when>
      <xsl:when test="$CountryType = 'GY'">Guyana</xsl:when>
      <xsl:when test="$CountryType = 'HT'">Haiti</xsl:when>
      <xsl:when test="$CountryType = 'IN'">Hindistan</xsl:when>
      <xsl:when test="$CountryType = 'HR'">Hırvatistan</xsl:when>
      <xsl:when test="$CountryType = 'NL'">Hollanda</xsl:when>
      <xsl:when test="$CountryType = 'HN'">Honduras</xsl:when>
      <xsl:when test="$CountryType = 'HK'">Hong Kong (CN)</xsl:when>
      <xsl:when test="$CountryType = 'VG'">İngiliz Virjin Adaları</xsl:when>
      <xsl:when test="$CountryType = 'IQ'">Irak</xsl:when>
      <xsl:when test="$CountryType = 'IR'">İran</xsl:when>
      <xsl:when test="$CountryType = 'IE'">İrlanda</xsl:when>
      <xsl:when test="$CountryType = 'ES'">İspanya</xsl:when>
      <xsl:when test="$CountryType = 'IL'">İsrail</xsl:when>
      <xsl:when test="$CountryType = 'SE'">İsveç</xsl:when>
      <xsl:when test="$CountryType = 'CH'">İsviçre</xsl:when>
      <xsl:when test="$CountryType = 'IT'">İtalya</xsl:when>
      <xsl:when test="$CountryType = 'IS'">İzlanda</xsl:when>
      <xsl:when test="$CountryType = 'JM'">Jamaika</xsl:when>
      <xsl:when test="$CountryType = 'JP'">Japonya</xsl:when>
      <xsl:when test="$CountryType = 'JE'">Jersey (GB)</xsl:when>
      <xsl:when test="$CountryType = 'KH'">Kamboçya</xsl:when>
      <xsl:when test="$CountryType = 'CM'">Kamerun</xsl:when>
      <xsl:when test="$CountryType = 'CA'">Kanada</xsl:when>
      <xsl:when test="$CountryType = 'ME'">Karadağ</xsl:when>
      <xsl:when test="$CountryType = 'QA'">Katar</xsl:when>
      <xsl:when test="$CountryType = 'KZ'">Kazakistan</xsl:when>
      <xsl:when test="$CountryType = 'KE'">Kenya</xsl:when>
      <xsl:when test="$CountryType = 'CY'">Kıbrıs</xsl:when>
      <xsl:when test="$CountryType = 'KG'">Kırgızistan</xsl:when>
      <xsl:when test="$CountryType = 'KI'">Kiribati</xsl:when>
      <xsl:when test="$CountryType = 'CO'">Kolombiya</xsl:when>
      <xsl:when test="$CountryType = 'KM'">Komorlar</xsl:when>
      <xsl:when test="$CountryType = 'CG'">Kongo Cumhuriyeti</xsl:when>
      <xsl:when test="$CountryType = 'KV'">Kosova (RS)</xsl:when>
      <xsl:when test="$CountryType = 'CR'">Kosta Rika</xsl:when>
      <xsl:when test="$CountryType = 'CU'">Küba</xsl:when>
      <xsl:when test="$CountryType = 'KW'">Kuveyt</xsl:when>
      <xsl:when test="$CountryType = 'KP'">Kuzey Kore</xsl:when>
      <xsl:when test="$CountryType = 'LA'">Laos</xsl:when>
      <xsl:when test="$CountryType = 'LS'">Lesoto</xsl:when>
      <xsl:when test="$CountryType = 'LV'">Letonya</xsl:when>
      <xsl:when test="$CountryType = 'LR'">Liberya</xsl:when>
      <xsl:when test="$CountryType = 'LY'">Libya</xsl:when>
      <xsl:when test="$CountryType = 'LI'">Lihtenştayn</xsl:when>
      <xsl:when test="$CountryType = 'LT'">Litvanya</xsl:when>
      <xsl:when test="$CountryType = 'LB'">Lübnan</xsl:when>
      <xsl:when test="$CountryType = 'LU'">Lüksemburg</xsl:when>
      <xsl:when test="$CountryType = 'HU'">Macaristan</xsl:when>
      <xsl:when test="$CountryType = 'MG'">Madagaskar</xsl:when>
      <xsl:when test="$CountryType = 'MO'">Makao (CN)</xsl:when>
      <xsl:when test="$CountryType = 'MK'">Makedonya</xsl:when>
      <xsl:when test="$CountryType = 'MW'">Malavi</xsl:when>
      <xsl:when test="$CountryType = 'MV'">Maldivler</xsl:when>
      <xsl:when test="$CountryType = 'MY'">Malezya</xsl:when>
      <xsl:when test="$CountryType = 'ML'">Mali</xsl:when>
      <xsl:when test="$CountryType = 'MT'">Malta</xsl:when>
      <xsl:when test="$CountryType = 'IM'">Man Adası (GB)</xsl:when>
      <xsl:when test="$CountryType = 'MH'">Marshall Adaları</xsl:when>
      <xsl:when test="$CountryType = 'MQ'">Martinique (FR)</xsl:when>
      <xsl:when test="$CountryType = 'MU'">Mauritius</xsl:when>
      <xsl:when test="$CountryType = 'YT'">Mayotte (FR)</xsl:when>
      <xsl:when test="$CountryType = 'MX'">Meksika</xsl:when>
      <xsl:when test="$CountryType = 'FM'">Mikronezya</xsl:when>
      <xsl:when test="$CountryType = 'EG'">Mısır</xsl:when>
      <xsl:when test="$CountryType = 'MN'">Moğolistan</xsl:when>
      <xsl:when test="$CountryType = 'MD'">Moldova</xsl:when>
      <xsl:when test="$CountryType = 'MC'">Monako</xsl:when>
      <xsl:when test="$CountryType = 'MR'">Moritanya</xsl:when>
      <xsl:when test="$CountryType = 'MZ'">Mozambik</xsl:when>
      <xsl:when test="$CountryType = 'MM'">Myanmar</xsl:when>
      <xsl:when test="$CountryType = 'NA'">Namibya</xsl:when>
      <xsl:when test="$CountryType = 'NR'">Nauru</xsl:when>
      <xsl:when test="$CountryType = 'NP'">Nepal</xsl:when>
      <xsl:when test="$CountryType = 'NE'">Nijer</xsl:when>
      <xsl:when test="$CountryType = 'NG'">Nijerya</xsl:when>
      <xsl:when test="$CountryType = 'NI'">Nikaragua</xsl:when>
      <xsl:when test="$CountryType = 'NO'">Norveç</xsl:when>
      <xsl:when test="$CountryType = 'CF'">Orta Afrika Cumhuriyeti</xsl:when>
      <xsl:when test="$CountryType = 'UZ'">Özbekistan</xsl:when>
      <xsl:when test="$CountryType = 'PK'">Pakistan</xsl:when>
      <xsl:when test="$CountryType = 'PW'">Palau</xsl:when>
      <xsl:when test="$CountryType = 'PA'">Panama</xsl:when>
      <xsl:when test="$CountryType = 'PG'">Papua Yeni Gine</xsl:when>
      <xsl:when test="$CountryType = 'PY'">Paraguay</xsl:when>
      <xsl:when test="$CountryType = 'PE'">Peru</xsl:when>
      <xsl:when test="$CountryType = 'PL'">Polonya</xsl:when>
      <xsl:when test="$CountryType = 'PT'">Portekiz</xsl:when>
      <xsl:when test="$CountryType = 'PR'">Porto Riko (US)</xsl:when>
      <xsl:when test="$CountryType = 'RE'">Réunion (FR)</xsl:when>
      <xsl:when test="$CountryType = 'RO'">Romanya</xsl:when>
      <xsl:when test="$CountryType = 'RW'">Ruanda</xsl:when>
      <xsl:when test="$CountryType = 'RU'">Rusya</xsl:when>
      <xsl:when test="$CountryType = 'BL'">Saint Barthélemy (FR)</xsl:when>
      <xsl:when test="$CountryType = 'KN'">Saint Kitts ve Nevis</xsl:when>
      <xsl:when test="$CountryType = 'LC'">Saint Lucia</xsl:when>
      <xsl:when test="$CountryType = 'PM'">Saint Pierre ve Miquelon (FR)</xsl:when>
      <xsl:when test="$CountryType = 'VC'">Saint Vincent ve Grenadinler</xsl:when>
      <xsl:when test="$CountryType = 'WS'">Samoa</xsl:when>
      <xsl:when test="$CountryType = 'SM'">San Marino</xsl:when>
      <xsl:when test="$CountryType = 'ST'">São Tomé ve Príncipe</xsl:when>
      <xsl:when test="$CountryType = 'SN'">Senegal</xsl:when>
      <xsl:when test="$CountryType = 'SC'">Seyşeller</xsl:when>
      <xsl:when test="$CountryType = 'SL'">Sierra Leone</xsl:when>
      <xsl:when test="$CountryType = 'CL'">Şili</xsl:when>
      <xsl:when test="$CountryType = 'SG'">Singapur</xsl:when>
      <xsl:when test="$CountryType = 'RS'">Sırbistan</xsl:when>
      <xsl:when test="$CountryType = 'SK'">Slovakya Cumhuriyeti</xsl:when>
      <xsl:when test="$CountryType = 'SI'">Slovenya</xsl:when>
      <xsl:when test="$CountryType = 'SB'">Solomon Adaları</xsl:when>
      <xsl:when test="$CountryType = 'SO'">Somali</xsl:when>
      <xsl:when test="$CountryType = 'SS'">South Sudan</xsl:when>
      <xsl:when test="$CountryType = 'SJ'">Spitsbergen (NO)</xsl:when>
      <xsl:when test="$CountryType = 'LK'">Sri Lanka</xsl:when>
      <xsl:when test="$CountryType = 'SD'">Sudan</xsl:when>
      <xsl:when test="$CountryType = 'SR'">Surinam</xsl:when>
      <xsl:when test="$CountryType = 'SY'">Suriye</xsl:when>
      <xsl:when test="$CountryType = 'SA'">Suudi Arabistan</xsl:when>
      <xsl:when test="$CountryType = 'SZ'">Svaziland</xsl:when>
      <xsl:when test="$CountryType = 'TJ'">Tacikistan</xsl:when>
      <xsl:when test="$CountryType = 'TZ'">Tanzanya</xsl:when>
      <xsl:when test="$CountryType = 'TH'">Tayland</xsl:when>
      <xsl:when test="$CountryType = 'TW'">Tayvan</xsl:when>
      <xsl:when test="$CountryType = 'TG'">Togo</xsl:when>
      <xsl:when test="$CountryType = 'TO'">Tonga</xsl:when>
      <xsl:when test="$CountryType = 'TT'">Trinidad ve Tobago</xsl:when>
      <xsl:when test="$CountryType = 'TN'">Tunus</xsl:when>
      <xsl:when test="$CountryType = 'TR'">Türkiye</xsl:when>
      <xsl:when test="$CountryType = 'TM'">Türkmenistan</xsl:when>
      <xsl:when test="$CountryType = 'TC'">Turks ve Caicos</xsl:when>
      <xsl:when test="$CountryType = 'TV'">Tuvalu</xsl:when>
      <xsl:when test="$CountryType = 'UG'">Uganda</xsl:when>
      <xsl:when test="$CountryType = 'UA'">Ukrayna</xsl:when>
      <xsl:when test="$CountryType = 'OM'">Umman</xsl:when>
      <xsl:when test="$CountryType = 'JO'">Ürdün</xsl:when>
      <xsl:when test="$CountryType = 'UY'">Uruguay</xsl:when>
      <xsl:when test="$CountryType = 'VU'">Vanuatu</xsl:when>
      <xsl:when test="$CountryType = 'VA'">Vatikan</xsl:when>
      <xsl:when test="$CountryType = 'VE'">Venezuela</xsl:when>
      <xsl:when test="$CountryType = 'VN'">Vietnam</xsl:when>
      <xsl:when test="$CountryType = 'WF'">Wallis ve Futuna (FR)</xsl:when>
      <xsl:when test="$CountryType = 'YE'">Yemen</xsl:when>
      <xsl:when test="$CountryType = 'NC'">Yeni Kaledonya (FR)</xsl:when>
      <xsl:when test="$CountryType = 'NZ'">Yeni Zelanda</xsl:when>
      <xsl:when test="$CountryType = 'CV'">Yeşil Burun Adaları</xsl:when>
      <xsl:when test="$CountryType = 'GR'">Yunanistan</xsl:when>
      <xsl:when test="$CountryType = 'ZM'">Zambiya</xsl:when>
      <xsl:when test="$CountryType = 'ZW'">Zimbabve</xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$CountryType"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:template name="CurrencyCode">
    <xsl:param name="CurrencyCodeType"/>
    <xsl:choose>
      <xsl:when test="$CurrencyCodeType = 'XAU_22C'">Çeyrek Altın</xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$CurrencyCodeType"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:template name="Party_Other">
    <xsl:param name="PartyType"/>
    <xsl:for-each select="cac:Person/cbc:NationalityID">
      <tr align="left">
        <td>
          <xsl:text>Uyruğu: </xsl:text>
          <xsl:value-of select="."/>
        </td>
      </tr>
    </xsl:for-each>
    <xsl:for-each select="cbc:WebsiteURI">
      <tr align="left">
        <td>
          <xsl:text>Web Sitesi: </xsl:text>
          <xsl:value-of select="."/>
        </td>
      </tr>
    </xsl:for-each>
    <xsl:for-each select="cac:Contact/cbc:ElectronicMail">
      <tr align="left">
        <td>
          <xsl:text>E-Posta: </xsl:text>
          <xsl:value-of select="."/>
        </td>
      </tr>
    </xsl:for-each>
    <xsl:for-each select="cac:Contact">
      <xsl:if test="cbc:Telephone or cbc:Telefax">
        <tr align="left">
          <td style="width:469px; " align="left">
            <xsl:for-each select="cbc:Telephone">
              <xsl:text>Tel: </xsl:text>
              <xsl:apply-templates/>
            </xsl:for-each>
            <xsl:for-each select="cbc:Telefax">
              <xsl:text> Fax: </xsl:text>
              <xsl:apply-templates/>
            </xsl:for-each>
            <xsl:text>&#160;</xsl:text>
          </td>
        </tr>
      </xsl:if>
    </xsl:for-each>
    <xsl:if test="$PartyType != 'TAXFREE' and $PartyType != 'EXPORT'">
      <xsl:for-each select="cac:PartyTaxScheme/cac:TaxScheme/cbc:Name">
        <tr align="left">
          <td>
            <xsl:text>Vergi Dairesi: </xsl:text>
            <xsl:apply-templates/>
          </td>
        </tr>
      </xsl:for-each>
      <xsl:for-each select="cac:PartyIdentification">
        <tr align="left">
          <td>
            <xsl:value-of select="cbc:ID/@schemeID"/>
            <xsl:text>: </xsl:text>
            <xsl:value-of select="cbc:ID"/>
          </td>
        </tr>
      </xsl:for-each>
    </xsl:if>
  </xsl:template>
  <xsl:template name="Curr_Type">
    <xsl:value-of select="format-number(., '###.##0,00', 'european')"/>
    <xsl:if test="@currencyID">
      <xsl:text> </xsl:text>
      <xsl:choose>
        <xsl:when test="@currencyID = 'TRL' or @currencyID = 'TRY'">
          <xsl:text>TL</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_22C' or @currencyID = '22C_XAU'">
          <xsl:text>Çeyrek Altın</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@currencyID"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>
  
  <xsl:template name="Currency_Type">
    <xsl:value-of select="format-number(., '###.##0', 'european')"/>
    <xsl:if test="@currencyID">
      <xsl:text> </xsl:text>
      <xsl:choose>
        <xsl:when test="@currencyID = 'TRL' or @currencyID = 'TRY'">
          <xsl:text>TL</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_22C' or @currencyID = '22C_XAU'">
          <xsl:text>Çeyrek Altın</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_22Y' or @currencyID = '22Y_XAU'">
          <xsl:text>Yarım Altın</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_22T' or @currencyID = '22T_XAU'">
          <xsl:text>Tam Altın</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_22I' or @currencyID = '22I_XAU'">
          <xsl:text>İki Buçukluk Altın</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_22B' or @currencyID = '22B_XAU'">
          <xsl:text>Beşlik Altın</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_24G' or @currencyID = '24G_XAU'">
          <xsl:text>24 Ayar Gram Altın</xsl:text>
        </xsl:when>
        <xsl:when test="@currencyID = 'XAU_24G_1000' or @currencyID = '24G_1000_XAU'">
          <xsl:text>Külçe Altın</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@currencyID"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
