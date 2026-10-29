const fs = require("fs");
const path = require("path");

function patchSubsystem(targetFilePath) {
  const filePath = path.resolve(targetFilePath);
  if (!fs.existsSync(filePath)) {
    console.error(`[patch-subsystem] Dosya bulunamadı: ${filePath}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);

  // DOS header check
  const magicDos = buf.toString("ascii", 0, 2);
  if (magicDos !== "MZ") {
    console.error("[patch-subsystem] Geçersiz DOS başlığı (MZ bekleniyor).");
    process.exit(1);
  }

  // e_lfanew offset to PE Header
  const peOffset = buf.readUInt32LE(0x3c);
  const peSig = buf.toString("ascii", peOffset, peOffset + 4);
  if (peSig !== "PE\0\0") {
    console.error(`[patch-subsystem] Geçersiz PE imzası: ${peSig}`);
    process.exit(1);
  }

  // Optional Header starts at peOffset + 24
  // Subsystem field is at offset 68 of Optional Header for both PE32 (0x10b) and PE32+ (0x20b)
  const subsystemOffset = peOffset + 24 + 68;
  const currentSubsystem = buf.readUInt16LE(subsystemOffset);

  console.log(`[patch-subsystem] PE Başlangıç: 0x${peOffset.toString(16)}, Subsystem Ofseti: 0x${subsystemOffset.toString(16)} (${subsystemOffset})`);
  console.log(`[patch-subsystem] Mevcut Subsystem Değeri: ${currentSubsystem} (${currentSubsystem === 3 ? "Console / CUI" : currentSubsystem === 2 ? "GUI / Windows" : "Bilinmiyor"})`);

  if (currentSubsystem === 2) {
    console.log("[patch-subsystem] Subsystem zaten GUI (2). Değişiklik gerekmedi.");
    return;
  }

  // Patch subsystem to 2 (IMAGE_SUBSYSTEM_WINDOWS_GUI)
  buf.writeUInt16LE(2, subsystemOffset);
  fs.writeFileSync(filePath, buf);

  console.log(`[patch-subsystem] Başarılı! Subsystem 3 (Console) -> 2 (Windows GUI) olarak yamalandı.`);
  console.log(`[patch-subsystem] Artık ${path.basename(filePath)} çalıştırıldığında CMD konsol penceresi AÇILMAYACAK, doğrudan arka planda / sistem tepsisinde çalışacaktır.`);
}

const target = process.argv[2] || "dist/PrinterAgent.exe";
patchSubsystem(target);
