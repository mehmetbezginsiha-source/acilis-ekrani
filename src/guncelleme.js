// Otomatik güncelleme: GitHub Releases'taki yeni sürümü arka planda indirir ve kurar.
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

const ACILIS = Date.now();
const KONTROL_ARALIGI = 6 * 60 * 60 * 1000; // 6 saatte bir

function baslat(bildir, cikisaHazirla) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (e) => console.error('Güncelleme hatası:', e?.message || e));
  autoUpdater.on('update-downloaded', (bilgi) => {
    // Açılıştan hemen sonra hazırsa (ör. bir önceki gün indirildiyse) sessizce kurup yeniden aç
    if (Date.now() - ACILIS < 2 * 60 * 1000) {
      cikisaHazirla();
      autoUpdater.quitAndInstall(true, true);
      return;
    }
    bildir('Yeni sürüm hazır: ' + bilgi.version, 'Bilgisayarı bir sonraki açışında kendiliğinden kurulacak.');
  });
  const kontrol = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(kontrol, 5000);
  setInterval(kontrol, KONTROL_ARALIGI);
}

module.exports = { baslat };
