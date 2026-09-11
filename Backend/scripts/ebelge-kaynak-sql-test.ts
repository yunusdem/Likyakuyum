/** Yerel yedeğe karşı gerçek sorgu regresyonu. Tüm fiş verisi ROLLBACK edilir.
 * node --import tsx scripts/ebelge-kaynak-sql-test.ts codex_kaynak_20260911
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { EbelgeKaynakRepository as repo } from '../src/models/ebelgeKaynak.repository.js';
const db = process.argv[2];
assert.match(db || '', /^codex_[a-z0-9_]+$/, 'Yalnız codex_ önekli yerel test veritabanı kullanılabilir.');
let query = '';
const request = { input() { return this; }, async query(q: string) { query = q; return { recordsets: [[{ toplam: 0 }], []] }; } };
(repo as any).pool = async () => ({ request: () => request });
await repo.list({ sayfa: 1 });
const listQuery = query;
await repo.dovizDetay({ evrakTuru: 99, belgeId: 1, belgeTuru: 0, belgeNo: 'DIA2026000000001' }).catch(() => undefined);
const detailQuery = query;
const dir = path.resolve('../tmp/ebelge-kaynak-qa'); mkdirSync(dir, { recursive: true });
const sql = `SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @u int=(SELECT MIN(KULLANICI_ID) FROM TODVZ_KULLANICI), @v int=(SELECT MIN(VEZNE_ID) FROM TODVZ_VEZNE);
INSERT INTO TODVZ_FIS(VEZNE_ID,TIP,TARIH,ZAMAN,KUR_TURU,UNVAN,KISILIK_TIPI,TOPLAM_TUTAR,YUVARLAMA,ODEME_TUTARI,EKLEYEN_ID,EKLEME_ZAMANI,GUNCELLEYEN_ID,GUNCELLEME_ZAMANI,GUID,MERKEZ_USD_KURU,GISE_USD_KURU,BELGE_TURU,E_FATURA_ETTN,SERI_NO,BELGE_NO,IPTAL,E_FATURA_DURUMU,ISTATISTIK_ID)
VALUES(@v,0,'20260911','20260911',0,'CODEX KAYNAK QA',0,10000,0,10000,@u,GETDATE(),@u,GETDATE(),NEWID(),1,1,0,'','DIA','1',0,0,(SELECT MIN(ISTATISTIK_ID) FROM TODVZ_ISTATISTIK WHERE FIS_DIZAYN_TIPI=0));
DECLARE @id int=SCOPE_IDENTITY(), @tip int=0, @no varchar(40)='DIA2026000000001';
INSERT INTO TODVZ_FIS_SATIRI(FIS_ID,SATIR_NO,MIKTAR,PARA_ID,KUR,GISE_KURU,TUTAR,KOMISYON_ORANI,KOMISYON,BMV_ORANI,BMV,ISCILIK,KDV_ORANI,KDV,KMV_ORANI,KMV,BELGE_NO,ETTN)
VALUES(@id,1,200,2,50,50,10000,0,0,0,0,0,0,0,0,0,@no,'B005795E-B8A8-4142-9FD4-A096F32BCBCC'),
(@id,2,100,2,50,50,5000,0,0,0,0,0,0,0,0,0,'DIA2026000000002','B005795E-B8A8-4142-9FD4-A096F32BCBCD');
IF OBJECT_ID('TODVZ_EBELGE_KAYNAK','U') IS NULL CREATE TABLE TODVZ_EBELGE_KAYNAK(ANAHTAR varchar(80), BELGE_NO varchar(40), DURUM varchar(30), HATA nvarchar(2000), TARIH datetime2);
IF OBJECT_ID('TODVZ_EBELGE_GIDEN','U') IS NULL CREATE TABLE TODVZ_EBELGE_GIDEN(UUID varchar(40), BELGE_NO varchar(40), GONDERIM_DURUMU varchar(30), ICE_RESPONSE_MESAJ nvarchar(2000), OLUSTURMA_TARIHI datetime2);
DECLARE @arama nvarchar(200)='%CODEX KAYNAK QA%', @durum varchar(30)=NULL, @tur int=NULL, @kaynak varchar(10)='DOVIZ', @ilk date='20260911', @son date='20260911', @atla int=0;
${listQuery}
IF (SELECT COUNT(*) FROM #Kaynak)<>2 THROW 51000,'Ayni fiste iki belge listelenmeli',1;
IF EXISTS(SELECT 1 FROM #Kaynak WHERE durum<>'GONDERILMEDI') THROW 51001,'Yeni ETTN gonderimi kilitlememeli',1;
DROP TABLE #Kaynak;
SET @kaynak='FATURA';
${listQuery.replaceAll('#Kaynak', '#Fatura')}
IF EXISTS(SELECT 1 FROM #Fatura WHERE kaynak='DOVIZ') THROW 51002,'Fatura filtresi doviz dondurdu',1;
DROP TABLE #Fatura;
${detailQuery}
IF (SELECT COUNT(*) FROM VODVZ_E_DOVIZ_BELGESI_XSLT X JOIN VODVZ_GONDERIME_HAZIR_E_DOVIZ_FISI D ON X.FIS_ID=D.BELGE_ID AND RTRIM(X.ID)=RTRIM(D.BELGE_NO) AND X.UUID=D.ETTN WHERE D.BELGE_ID=@id AND RTRIM(D.BELGE_NO)=@no)<>1 THROW 51003,'Belge detayi tekil olmali',1;
UPDATE TODVZ_FIS SET IPTAL=1 WHERE FIS_ID=@id;
SET @kaynak='DOVIZ';
${listQuery.replaceAll('#Kaynak', '#Iptal')}
IF EXISTS(SELECT 1 FROM #Iptal) THROW 51004,'Iptal fis listelenmemeli',1;
ROLLBACK;
PRINT 'PASS: tarih, kaynak filtresi, yeni ETTN, coklu belge detayi ve iptal';`;
const file = path.join(dir, 'kaynak-regresyon.sql'); writeFileSync(file, '\uFEFF' + sql);
const result = spawnSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-d', db, '-b', '-i', file, '-W'], { encoding: 'utf8' });
writeFileSync(path.join(dir, 'sql-result.txt'), result.stdout + result.stderr);
assert.equal(result.status, 0, result.stdout + result.stderr);
assert.match(result.stdout, /PASS:/);
console.log(result.stdout.match(/PASS:.*/)?.[0]);
