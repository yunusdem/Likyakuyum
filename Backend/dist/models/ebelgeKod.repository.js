import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { ApiError } from "../utils/ApiError.js";
const TOHUM = {
    ISTISNA: [
        ["201", "17/1 Kültür ve eğitim amacı taşıyan işlemler"],
        ["202", "17/2-a Sağlık, çevre ve sosyal yardım amaçlı işlemler"],
        ["204", "17/2-c Yabancı diplomatik organ ve hayır kurumlarının yapacakları bağışlarla ilgili mal ve hizmet alışları"],
        ["205", "17/2-d Taşınmaz kültür varlıklarına ilişkin teslimler ve mimarlık hizmetleri"],
        ["206", "17/2-e Mesleki kuruluşların işlemleri"],
        ["207", "17/3 Askeri fabrika, tersane ve atölyelerin işlemleri"],
        ["208", "17/4-c Birleşme, devir, dönüşüm ve bölünme işlemleri"],
        ["209", "17/4-e Banka ve sigorta muameleleri vergisi kapsamına giren işlemler"],
        ["211", "17/4-h Zirai amaçlı su teslimleri ile köy tüzel kişiliklerince yapılan içme suyu teslimleri"],
        ["212", "17/4-ı Serbest bölgelerde verilen hizmetler"],
        ["213", "17/4-j Boru hattı ile yapılan petrol ve gaz taşımacılığı"],
        ["214", "17/4-k Organize sanayi bölgelerindeki arsa ve işyeri teslimleri"],
        ["215", "17/4-l Varlık yönetim şirketlerinin işlemleri"],
        ["216", "17/4-m Tasarruf Mevduatı Sigorta Fonunun işlemleri"],
        ["217", "17/4-n Basın-Yayın ve Enformasyon Genel Müdürlüğüne verilen haber hizmetleri"],
        ["218", "17/4-o Gümrük antrepoları, geçici depolama yerleri ve gümrüklü sahalarda verilen hizmetler"],
        ["219", "17/4-p Hazine ve Arsa Ofisi Genel Müdürlüğünün işlemleri"],
        ["220", "17/4-r İki tam yıl süreyle sahip olunan taşınmaz ve iştirak hisseleri satışları"],
        ["221", "Geçici 15 Konut yapı kooperatifleri, belediyeler ve sosyal güvenlik kuruluşlarına verilen inşaat taahhüt hizmeti"],
        ["223", "Geçici 20/1 Teknoloji geliştirme bölgelerinde yapılan işlemler"],
        ["225", "Geçici 23 Milli Eğitim Bakanlığına yapılan bilgisayar bağışları ile ilgili teslimler"],
        ["226", "17/2-b Özel okullar, üniversite ve yüksekokullar tarafından verilen bedelsiz eğitim ve öğretim hizmetleri"],
        ["227", "17/2-b Kanunların gösterdiği gerek üzerine bedelsiz olarak yapılan teslim ve hizmetler"],
        ["228", "17/2-b Kanunun 17/1 maddesinde sayılan kurum ve kuruluşlara bedelsiz olarak yapılan teslimler"],
        ["229", "17/4-g Külçe altın, külçe gümüş ve kıymetli taşların teslimi"],
        ["230", "17/4-g Metal, plastik, lastik, kauçuk, kağıt, cam hurda ve atıkların teslimi"],
        ["231", "17/4-g Döviz, para, damga pulu, değerli kağıtlar, hisse senedi ve tahvil teslimleri"],
        ["250", "Diğerleri (kısmi istisna)"],
        ["301", "11/1-a Mal ihracatı"],
        ["302", "11/1-a Hizmet ihracatı"],
        ["303", "11/1-a Roaming hizmetleri"],
        ["304", "13/a Deniz, hava ve demiryolu taşıma araçlarının teslimi ile inşa, tadil, bakım ve onarımları"],
        ["305", "13/b Deniz ve hava taşıma araçları için liman ve hava meydanlarında yapılan hizmetler"],
        ["306", "13/c Petrol aramaları ve petrol boru hatlarının inşa ve modernizasyonuna ilişkin teslim ve hizmetler"],
        ["307", "13/c Maden arama, altın, gümüş ve platin madenleri için işletme, zenginleştirme ve rafinaj faaliyetleri"],
        ["308", "13/d Teşvikli yatırım mallarının teslimi"],
        ["309", "13/e Liman ve hava meydanlarının inşası, yenilenmesi ve genişletilmesi"],
        ["310", "13/f Ulusal güvenlik amaçlı teslim ve hizmetler"],
        ["311", "14/1 Uluslararası taşımacılık"],
        ["312", "15/a Diplomatik organ ve misyonlara yapılan teslim ve hizmetler"],
        ["313", "15/b Uluslararası kuruluşlara yapılan teslim ve hizmetler"],
        ["314", "19/2 Usulüne göre yürürlüğe girmiş uluslararası anlaşmalar kapsamındaki istisnalar"],
        ["315", "14/3 İhraç konusu eşyayı taşıyan kamyon, çekici ve yarı romorklara yapılan motorin teslimleri"],
        ["316", "11/1-a Serbest bölgelerdeki müşteriler için yapılan fason hizmetler"],
        ["317", "17/4-s Engellilerin eğitimleri, meslekleri ve günlük yaşamlarına ilişkin araç-gereç ve bilgisayar programları"],
        ["318", "Geçici 29 Yap-işlet-devret projeleri kapsamındaki teslim ve hizmetler"],
        ["322", "11/1-a Türkiye'de ikamet etmeyenlere özel fatura ile yapılan teslimler (bavul ticareti)"],
        ["339", "13/m Yatırım teşvik belgesi kapsamındaki inşaat işleri"],
        ["350", "Diğerleri (tam istisna)"],
        ["351", "KDV - İstisna olmayan diğer"],
    ],
    TEVKIFAT: [
        ["601", "Yapım işleri ile bu işlerle birlikte ifa edilen mühendislik-mimarlık ve etüt-proje hizmetleri", 40],
        ["602", "Etüt, plan-proje, danışmanlık, denetim ve benzeri hizmetler", 90],
        ["603", "Makine, teçhizat, demirbaş ve taşıtlara ait tadil, bakım ve onarım hizmetleri", 70],
        ["604", "Yemek servis hizmeti", 50],
        ["605", "Organizasyon hizmeti", 50],
        ["606", "İşgücü temin hizmetleri", 90],
        ["607", "Özel güvenlik hizmeti", 90],
        ["608", "Yapı denetim hizmetleri", 90],
        ["609", "Fason olarak yaptırılan tekstil ve konfeksiyon işleri, çanta ve ayakkabı dikim işleri ve bu işlere aracılık hizmetleri", 70],
        ["610", "Turistik mağazalara verilen müşteri bulma / götürme hizmetleri", 90],
        ["611", "Spor kulüplerinin yayın, reklam ve isim hakkı gelirlerine konu işlemleri", 90],
        ["612", "Temizlik hizmeti", 90],
        ["613", "Çevre ve bahçe bakım hizmetleri", 90],
        ["614", "Servis taşımacılığı hizmeti", 50],
        ["615", "Her türlü baskı ve basım hizmetleri", 70],
        ["616", "Diğer hizmetler", 50],
        ["617", "Hurda metalden elde edilen külçe teslimleri", 70],
        ["618", "Hurda metalden elde edilenler dışındaki bakır, çinko ve alüminyum külçe teslimleri", 70],
        ["619", "Bakır, çinko ve alüminyum ürünlerinin teslimi", 70],
        ["620", "İstisnadan vazgeçenlerin hurda ve atık teslimi", 70],
        ["621", "Metal, plastik, lastik, kauçuk, kağıt ve cam hurda ve atıklardan elde edilen hammadde teslimi", 90],
        ["622", "Pamuk, tiftik, yün ve yapağı ile ham post ve deri teslimleri", 90],
        ["623", "Ağaç ve orman ürünleri teslimi", 50],
        ["624", "Yük taşımacılığı hizmeti", 20],
        ["625", "Ticari reklam hizmetleri", 30],
        ["626", "Diğer teslimler", 20],
        ["627", "Demir-çelik ürünlerinin teslimi", 50],
    ],
    OZELMATRAH: [
        ["801", "Milli Piyango, Spor Toto vb. oyunlar"],
        ["802", "At yarışları ve diğer müşterek bahis ve talih oyunları"],
        ["803", "Profesyonel sanatçıların yer aldığı gösteriler, konserler, profesyonel sporcuların katıldığı sportif faaliyetler, maçlar, yarışlar ve yarışmalar"],
        ["804", "Gümrük depolarında ve müzayede mahallerinde yapılan satışlar"],
        ["805", "Altından mamül veya altın ihtiva eden ziynet eşyaları ile sikke altınların teslimi"],
        ["806", "Tütün mamülleri"],
        ["807", "Muzır neşriyat kapsamındaki gazete, dergi vb. periyodik yayınlar"],
        ["808", "Gümüşten mamül veya gümüş ihtiva eden ziynet eşyaları ile sikke gümüşlerin teslimi"],
        ["809", "Belediyeler tarafından yapılan şehiriçi yolcu taşımacılığında kullanılan biletlerin, kartların ve jetonların bayiler tarafından satışı"],
        ["810", "Ön ödemeli elektronik haberleşme hizmetleri"],
        ["811", "TŞOF tarafından araç plakaları ile sürücü kurslarında kullanılan bir kısım evrakın teslimi"],
        ["812", "KDV uygulanmadan alınan ikinci el motorlu kara taşıtı veya taşınmaz teslimi"],
    ],
    IHRACKAYITLI: [
        ["701", "3065 s. KDV Kanununun 11/1-c ve geçici 17 nci maddeleri kapsamında ihraç kayıtlı satış"],
        ["702", "DİİB ve geçici kabul rejimi kapsamındaki satışlar"],
        ["703", "4760 s. ÖTV Kanununun 8/2 maddesi kapsamında ihraç kayıtlı satış"],
    ],
};
const hazirlanan = new Set();
export class EbelgeKodRepository {
    static async pool(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        const anahtar = `${ctx?.dbServer || ""}|${ctx?.dbName || ""}`;
        if (hazirlanan.has(anahtar))
            return pool;
        await pool.request().query(`
      IF OBJECT_ID('dbo.TODVZ_EBELGE_KOD','U') IS NULL
      BEGIN TRY
        CREATE TABLE dbo.TODVZ_EBELGE_KOD (
          TUR varchar(12) NOT NULL, KOD varchar(10) NOT NULL, AD nvarchar(300) NOT NULL,
          ORAN decimal(5,2) NULL, SISTEM bit NOT NULL DEFAULT 0,
          EKLEYEN nvarchar(50) NULL, EKLEME_TARIHI datetime2 NOT NULL DEFAULT SYSDATETIME(),
          CONSTRAINT PK_TODVZ_EBELGE_KOD PRIMARY KEY (TUR, KOD)
        );
      END TRY BEGIN CATCH IF ERROR_NUMBER() <> 2714 THROW; END CATCH;
    `);
        // Tohum: yalnızca eksik kodlar eklenir; kullanıcının eklediği ya da değiştirdiği kayıtlara dokunulmaz.
        const tohum = Object.entries(TOHUM)
            .flatMap(([tur, liste]) => liste.map(([kod, ad, oran]) => ({ tur, kod, ad, oran: oran ?? null })));
        const mevcut = new Set((await pool.request().query(`SELECT RTRIM(TUR)+':'+RTRIM(KOD) a FROM dbo.TODVZ_EBELGE_KOD`)).recordset.map((x) => x.a));
        for (const t of tohum.filter((x) => !mevcut.has(`${x.tur}:${x.kod}`))) {
            await pool.request().input("tur", sql.VarChar(12), t.tur).input("kod", sql.VarChar(10), t.kod)
                .input("ad", sql.NVarChar(300), t.ad).input("oran", sql.Decimal(5, 2), t.oran)
                .query(`IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_EBELGE_KOD WHERE TUR=@tur AND KOD=@kod)
          INSERT INTO dbo.TODVZ_EBELGE_KOD (TUR, KOD, AD, ORAN, SISTEM) VALUES (@tur, @kod, @ad, @oran, 1);`);
        }
        hazirlanan.add(anahtar);
        return pool;
    }
    static async list(tur, ctx) {
        const pool = await this.pool(ctx);
        const r = await pool.request().input("tur", sql.VarChar(12), tur || null).query(`
      SELECT RTRIM(TUR) tur, RTRIM(KOD) kod, AD ad, ORAN oran, SISTEM sistem
      FROM dbo.TODVZ_EBELGE_KOD WHERE @tur IS NULL OR TUR=@tur ORDER BY TUR, KOD;
    `);
        return r.recordset.map((k) => ({ ...k, oran: k.oran == null ? null : Number(k.oran), sistem: !!k.sistem }));
    }
    static async ekle(k, kullanici, ctx) {
        const pool = await this.pool(ctx);
        try {
            await pool.request().input("tur", sql.VarChar(12), k.tur).input("kod", sql.VarChar(10), k.kod)
                .input("ad", sql.NVarChar(300), k.ad).input("oran", sql.Decimal(5, 2), k.oran ?? null)
                .input("ekleyen", sql.NVarChar(50), kullanici)
                .query(`INSERT INTO dbo.TODVZ_EBELGE_KOD (TUR, KOD, AD, ORAN, SISTEM, EKLEYEN) VALUES (@tur, @kod, @ad, @oran, 0, @ekleyen);`);
        }
        catch (e) {
            if (e?.number === 2627 || e?.number === 2601)
                throw ApiError.badRequest(`${k.kod} kodu listede zaten var.`);
            throw e;
        }
        return { tur: k.tur, kod: k.kod, ad: k.ad, oran: k.oran ?? null, sistem: false };
    }
}
