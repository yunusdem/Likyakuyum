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

[Files]
Source: "{#Kaynak}\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs ignoreversion
Source: "{#Kaynak}\uygulama\*"; DestDir: "{app}\uygulama"; Flags: recursesubdirs ignoreversion
Source: "{#Kaynak}\araclar\*"; DestDir: "{app}\araclar"; Flags: recursesubdirs ignoreversion
Source: "{#Kaynak}\sablon\sablon.bak"; DestDir: "{app}\sablon"; Flags: ignoreversion
Source: "{#Kaynak}\sql\*"; DestDir: "{tmp}\sql"; Flags: recursesubdirs deleteafterinstall skipifsourcedoesntexist
Source: "{src}\firma.lky"; DestDir: "{commonappdata}\LikyaKuyum"; Flags: external ignoreversion skipifsourcedoesntexist

[INI]
Filename: "{app}\LikyaKuyum.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://localhost:5000"

[Icons]
Name: "{commondesktop}\Likya Kuyum"; Filename: "{app}\LikyaKuyum.url"
Name: "{autoprograms}\Likya Kuyum"; Filename: "{app}\LikyaKuyum.url"

[Run]
Filename: "{app}\LikyaKuyum.url"; Description: "Likya Kuyum'u aç"; Flags: postinstall shellexec nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\araclar\kaldir.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "LikyaKaldir"

[Code]
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
  Kod: Integer;
  Parametre: String;
begin
  if CurStep = ssPostInstall then
  begin
    WizardForm.StatusLabel.Caption := 'Veritabanı ve program hazırlanıyor (birkaç dakika sürebilir)...';
    Parametre := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\araclar\kur-sonrasi.ps1') + '" -Kok "' + ExpandConstant('{app}') + '" -SqlKurulum "' + ExpandConstant('{tmp}\sql\SQLEXPR_x64_ENU.exe') + '"';
    if (not Exec('powershell.exe', Parametre, '', SW_HIDE, ewWaitUntilTerminated, Kod)) or (Kod <> 0) then
      MsgBox('Kurulum tamamlanamadı. Ayrıntı: ' + ExpandConstant('{commonappdata}\LikyaKuyum\log\kurulum.log') + #13#10 + 'Lütfen bu dosyayı bize iletin.', mbError, MB_OK);
  end;
end;
