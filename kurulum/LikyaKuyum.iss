; Likya Kuyum kurulum paketi (Inno Setup 6). docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, bolum 10
; Dogrudan derlenmez: Backend klasorunde "npm run kurulum:paketi" hazirlik klasorunu kurar ve ISCC'yi
; /DSurum=... /DKaynak=... /DCikti=... parametreleriyle cagirir.
;
; Kurulum: program {app} (C:\Program Files\LikyaKuyum) altina, veri C:\ProgramData\LikyaKuyum altina.
; firma.lky kurulum exe'si ile AYNI klasorde olmalidir (panelden indirilen ZIP'te birlikte gelir).

#ifndef Surum
  #define Surum "0.0.0"
#endif
#ifndef Kaynak
  #define Kaynak "hazirlik"
#endif
#ifndef Cikti
  #define Cikti "cikti"
#endif
; SQL Server 2025 Express Core (bolum 17): exe'ye gomulmez, bilgisayarda uygun SQL yoksa kurulum sirasinda indirilir.
; kurulum-paketi.ts --sql-adres ile degistirilebilir (ör. kendi sunucumuz).
#ifndef SqlAdres
  #define SqlAdres "https://download.microsoft.com/download/dea8c210-c44a-4a9d-9d80-0c81578860c5/ENU/SQLEXPR_x64_ENU.exe"
#endif

[Setup]
AppId={{8F0B9C52-4C2A-4F1E-9D47-2B5A1C0E7A11}
AppName=Likya Kuyum
AppVersion={#Surum}
AppVerName=Likya Kuyum {#Surum}
AppPublisher=Likya Kuyum
DefaultDirName={autopf}\LikyaKuyum
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#Cikti}
OutputBaseFilename=LikyaKuyumKurulum
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Likya Kuyum
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "tr"; MessagesFile: "compiler:Languages\Turkish.isl"

[InstallDelete]
; Yeniden kurulumda eski program dosyaları silinir: kalan fazla dosya (ör. kendini güncellemiş kurulumu eski exe ile yeniden
; kurunca) bütünlük denetiminde "listede olmayan dosya" kilidi verip kurulumdan sonra da sürüyordu.
; .env, uploads ve {app}\Belgeler'e dokunulmaz.
Type: filesandordirs; Name: "{app}\uygulama\backend\dist"
Type: filesandordirs; Name: "{app}\uygulama\backend\node_modules"
Type: filesandordirs; Name: "{app}\uygulama\backend\migrations"
Type: filesandordirs; Name: "{app}\uygulama\web"
Type: filesandordirs; Name: "{app}\uygulama.yeni"

[Files]
; Kurulumdan önce programı durdurur (PrepareToInstall, geçici klasörden çalışır)
Source: "{#Kaynak}\araclar\durdur.ps1"; Flags: dontcopy
; SQL indirme gerekip gerekmedigi (wpReady'den sonra, geçici klasörden çalışır)
Source: "{#Kaynak}\araclar\sql-bul.ps1"; Flags: dontcopy
Source: "{#Kaynak}\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs ignoreversion
Source: "{#Kaynak}\uygulama\*"; DestDir: "{app}\uygulama"; Flags: recursesubdirs ignoreversion
Source: "{#Kaynak}\araclar\*"; DestDir: "{app}\araclar"; Flags: recursesubdirs ignoreversion
Source: "{#Kaynak}\sablon\sablon.bak"; DestDir: "{app}\sablon"; Flags: ignoreversion
Source: "{src}\firma.lky"; DestDir: "{commonappdata}\LikyaKuyum"; Flags: external ignoreversion skipifsourcedoesntexist

[INI]
; Giriş ekranı: kök adres tanıtım sayfasını açıyordu
Filename: "{app}\LikyaKuyum.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://localhost:5000/login"

[Dirs]
; Firmanın belge klasörü (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K6): kaldırmada silinmez
Name: "{app}\Belgeler"; Flags: uninsneveruninstall

[Icons]
Name: "{commondesktop}\Likya Kuyum"; Filename: "{app}\LikyaKuyum.url"
Name: "{autoprograms}\Likya Kuyum"; Filename: "{app}\LikyaKuyum.url"
Name: "{autoprograms}\Likya Kuyum Belgeleri"; Filename: "{app}\Belgeler"

[Run]
; Kurulum tamamlanmadıysa (yeniden başlatma gerekiyor ya da hata) "aç" seçeneği gösterilmez
Filename: "{app}\LikyaKuyum.url"; Description: "Likya Kuyum'u aç"; Flags: postinstall shellexec nowait skipifsilent; Check: KurulumTamam

[UninstallDelete]
; Güncelleyicinin bıraktığı önceki / hatalı sürüm klasörleri ve kurulum sonrası yazılan kısayol dosyası
Type: filesandordirs; Name: "{app}\uygulama.onceki"
Type: filesandordirs; Name: "{app}\uygulama.hatali"
Type: filesandordirs; Name: "{app}\uygulama.yeni"
Type: files; Name: "{app}\LikyaKuyum.url"

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\araclar\kaldir.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "LikyaKaldir"

[Code]
var
  Tamamlandi: Boolean;
  IndirmeSayfasi: TDownloadWizardPage;

function KurulumTamam(): Boolean;
begin
  Result := Tamamlandi;
end;

procedure InitializeWizard();
begin
  IndirmeSayfasi := CreateDownloadPage('SQL Server indiriliyor', 'Bu bilgisayarda uygun SQL Server yok; SQL Server 2025 Express Microsoft''tan indiriliyor. İnternet hızına göre birkaç dakika sürebilir.', nil);
end;

{ Bilgisayarda kendi örneğimiz ya da kullanılabilir bir SQL Server yoksa (sql-bul.ps1 çıkış 10) kurulum dosyası indirilir.
  Denetim çalışmazsa da indirilir: hangi örneğin kullanılacağına son kararı kur-sonrasi.ps1 verir. }
function NextButtonClick(CurPageID: Integer): Boolean;
var
  Kod: Integer;
begin
  Result := True;
  if CurPageID <> wpReady then
    exit;
  ExtractTemporaryFile('sql-bul.ps1');
  if Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\sql-bul.ps1') + '" -Denetim', '', SW_HIDE, ewWaitUntilTerminated, Kod) and (Kod = 0) then
    exit;
  IndirmeSayfasi.Clear;
  IndirmeSayfasi.Add('{#SqlAdres}', 'SQLEXPR_x64_ENU.exe', '');
  IndirmeSayfasi.Show;
  try
    try
      IndirmeSayfasi.Download;
    except
      if IndirmeSayfasi.AbortedByUser then
        Log('SQL Server indirmesi kullanıcı tarafından durduruldu.')
      else
        MsgBox('SQL Server indirilemedi: ' + GetExceptionMessage + #13#10 + #13#10 + 'İnternet bağlantınızı kontrol edip tekrar deneyin.', mbError, MB_OK);
      Result := False;
    end;
  finally
    IndirmeSayfasi.Hide;
  end;
end;

{ Yeniden kurulum: çalışan program durdurulur (node.exe kilitliyken dosyalar yazılamıyordu) }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Kod: Integer;
begin
  Result := '';
  ExtractTemporaryFile('durdur.ps1');
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\durdur.ps1') + '" -Kok "' + ExpandConstant('{app}') + '"', '', SW_HIDE, ewWaitUntilTerminated, Kod);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if (not FileExists(ExpandConstant('{src}\firma.lky'))) and (not FileExists(ExpandConstant('{commonappdata}\LikyaKuyum\firma.lky'))) then
  begin
    MsgBox('firma.lky bulunamadı.' #13#10 #13#10 'Kurulum dosyasını, size gönderilen ZIP içinden çıkardığınız klasörde firma.lky ile birlikte çalıştırın.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Kod, Kod2: Integer;
  Parametre: String;
begin
  if CurStep = ssPostInstall then
  begin
    WizardForm.StatusLabel.Caption := 'Veritabanı ve program hazırlanıyor (birkaç dakika sürebilir)...';
    Parametre := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\araclar\kur-sonrasi.ps1') + '" -Kok "' + ExpandConstant('{app}') + '" -SqlKurulum "' + ExpandConstant('{tmp}\SQLEXPR_x64_ENU.exe') + '"';
    if not Exec('powershell.exe', Parametre, '', SW_HIDE, ewWaitUntilTerminated, Kod) then
      Kod := -1;
    Tamamlandi := Kod = 0;
    { Kurulum yarıda kaldıysa, başta durdurulan eski programın görevi yeniden etkinleştirilip başlatılır }
    if Kod <> 0 then
    begin
      Exec(ExpandConstant('{sys}\schtasks.exe'), '/Change /TN LikyaKuyum /ENABLE', '', SW_HIDE, ewWaitUntilTerminated, Kod2);
      Exec(ExpandConstant('{sys}\schtasks.exe'), '/Run /TN LikyaKuyum', '', SW_HIDE, ewWaitUntilTerminated, Kod2);
    end;
    if Kod = 2 then
      { Disk sektör boyutu için Windows ayarı yapıldı (kur-sonrasi.ps1): SQL Server ancak yeniden başlatmadan sonra açılır }
      MsgBox('Bu bilgisayarın diski için gereken bir Windows ayarı yapıldı.' + #13#10 + #13#10 + 'Lütfen bilgisayarı yeniden başlatın ve kurulumu (aynı klasördeki LikyaKuyumKurulum.exe) tekrar çalıştırın.', mbInformation, MB_OK)
    else if Kod <> 0 then
      MsgBox('Kurulum tamamlanamadı. Ayrıntı: ' + ExpandConstant('{commonappdata}\LikyaKuyum\log\kurulum.log') + #13#10 + 'Lütfen bu dosyayı bize iletin.', mbError, MB_OK);
  end;
end;
