// Açılış Ekranı - ana süreç (pencere, açılışta başlama, takvim kaydı, bildirimler)
const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { ozelGunler, sec } = require('./gunler');
const guncelleyici = require('./guncelleme');

const KOK = path.join(__dirname, '..');
const KULLANICI = () => app.getPath('userData');
const TAKVIM_DOSYASI = () => path.join(KULLANICI(), 'takvim.json');
const DURUM_DOSYASI = () => path.join(KULLANICI(), 'durum.json');
const GECIKME_DK = 15; // bitiş saatinden bu kadar dakika sonra hâlâ yapılmadıysa "gecikti" uyarısı

let pencere = null;
let tepsi = null;
let cikisIstendi = false;

app.setPath('userData', path.join(app.getPath('appData'), 'AcilisEkrani')); // takvim burada saklanır: %APPDATA%\AcilisEkrani
app.commandLine.appendSwitch('lang', 'tr-TR'); // saat ve tarih alanları Türkçe/24 saat olsun
if (!app.requestSingleInstanceLock()) app.quit();

function jsonOku(dosya, varsayilan) {
  try { return JSON.parse(fs.readFileSync(dosya, 'utf8')); } catch { return varsayilan; }
}
function jsonYaz(dosya, veri) {
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, JSON.stringify(veri, null, 2), 'utf8');
}
const isleriOku = () => jsonOku(TAKVIM_DOSYASI(), []);
const isleriYaz = (l) => jsonYaz(TAKVIM_DOSYASI(), l);

// Her açılışta farklı arka plan: bir önceki görseli tekrar seçmez
function gorselSec() {
  const liste = jsonOku(path.join(KOK, 'gorseller', 'gorseller.json'), []);
  if (!liste.length) return null;
  const durum = jsonOku(DURUM_DOSYASI(), {});
  const adaylar = liste.length > 1 ? liste.filter((g) => g.dosya !== durum.sonGorsel) : liste;
  const secilen = adaylar[Math.floor(Math.random() * adaylar.length)];
  jsonYaz(DURUM_DOSYASI(), { ...durum, sonGorsel: secilen.dosya });
  return { ...secilen, yol: path.join(KOK, 'gorseller', secilen.dosya) };
}

const listeOku = (dosya) => jsonOku(path.join(KOK, 'veri', dosya), { liste: [] }).liste || [];

function bildir(baslik, govde) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: baslik, body: govde, silent: false });
  n.on('click', pencereyiGoster);
  n.show();
}

// Her 30 saniyede bir: başlama zamanı gelen ve süresi geçip yapılmayan işler için uyarı
function hatirlaticiKontrol() {
  const simdi = Date.now();
  const isler = isleriOku();
  let degisti = false;
  for (const is of isler) {
    if (is.yapildi) continue;
    const bas = new Date(is.baslangic).getTime();
    const bit = bas + (is.sureDk || 60) * 60000;
    if (!is.basladiBildirildi && simdi >= bas && simdi < bit) {
      bildir('Zamanı geldi: ' + is.baslik, 'Bitiş: ' + new Date(bit).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
      is.basladiBildirildi = true; degisti = true;
    }
    if (!is.gecikmeBildirildi && simdi >= bit + GECIKME_DK * 60000) {
      bildir('Süresi geçti: ' + is.baslik, 'Bu iş henüz "yapıldı" olarak işaretlenmedi. Yeni bir zamana almak ister misin?');
      is.gecikmeBildirildi = true; is.basladiBildirildi = true; degisti = true;
    }
  }
  if (degisti) { isleriYaz(isler); pencere?.webContents.send('isler-degisti'); }
}

function pencereyiGoster() {
  if (!pencere) return pencereOlustur();
  pencere.show(); pencere.focus();
}

function pencereOlustur() {
  pencere = new BrowserWindow({
    width: 1400, height: 900, show: false, backgroundColor: '#0e1a1f',
    autoHideMenuBar: true, title: 'Açılış Ekranı',
    icon: path.join(KOK, 'src', 'simge.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  pencere.maximize();
  pencere.loadFile(path.join(__dirname, 'index.html'));
  pencere.once('ready-to-show', () => pencere.show());
  // Kapatınca kapanmasın, tepsiye insin: hatırlatıcılar çalışmaya devam etsin
  pencere.on('close', (e) => { if (!cikisIstendi) { e.preventDefault(); pencere.hide(); } });
}

function tepsiOlustur() {
  const simge = nativeImage.createFromPath(path.join(KOK, 'src', 'simge.png'));
  tepsi = new Tray(simge.isEmpty() ? nativeImage.createEmpty() : simge.resize({ width: 16, height: 16 }));
  tepsi.setToolTip('Açılış Ekranı');
  const acilistaBasla = () => app.getLoginItemSettings().openAtLogin;
  const menuKur = () => tepsi.setContextMenu(Menu.buildFromTemplate([
    { label: 'Göster', click: pencereyiGoster },
    { label: 'Bilgisayar açılınca başlat', type: 'checkbox', checked: acilistaBasla(),
      click: (m) => { app.setLoginItemSettings({ openAtLogin: m.checked }); menuKur(); } },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { cikisIstendi = true; app.quit(); } },
  ]));
  menuKur();
  tepsi.on('click', pencereyiGoster);
}

ipcMain.handle('baslangic-verisi', () => {
  const gun = ozelGunler();
  return {
  gun,
  surum: app.getVersion(),
  gorsel: gorselSec(),
  ayet: sec(listeOku('ayetler.json'), gun.ozel),
  hadis: sec(listeOku('hadisler.json'), gun.ozel),
  ses: path.join(KOK, 'ses', 'hos-geldiniz.mp3'),
  sesSeviyesi: 0.5,
  };
});
ipcMain.handle('isler', () => isleriOku());
ipcMain.handle('is-ekle', (_e, is) => {
  const l = isleriOku();
  l.push({ id: Date.now().toString(36), baslik: String(is.baslik).slice(0, 200), baslangic: is.baslangic, sureDk: Number(is.sureDk) || 60, yapildi: false });
  isleriYaz(l); return l;
});
ipcMain.handle('is-yapildi', (_e, id) => {
  const l = isleriOku(); const is = l.find((x) => x.id === id);
  if (is) is.yapildi = !is.yapildi; isleriYaz(l); return l;
});
ipcMain.handle('is-sil', (_e, id) => { const l = isleriOku().filter((x) => x.id !== id); isleriYaz(l); return l; });

app.on('second-instance', pencereyiGoster);
app.whenReady().then(() => {
  app.setAppUserModelId('com.sema.acilisekrani'); // Windows bildirimleri için gerekli
  // Paketlenmiş sürüm ilk çalıştığında kendini Windows açılışına ekler (tepsi menüsünden kapatılabilir)
  const durum = jsonOku(DURUM_DOSYASI(), {});
  if (app.isPackaged && !durum.acilisAyarlandi) {
    app.setLoginItemSettings({ openAtLogin: true });
    jsonYaz(DURUM_DOSYASI(), { ...durum, acilisAyarlandi: true });
  }
  pencereOlustur();
  try { tepsiOlustur(); } catch (e) { console.error('Tepsi oluşturulamadı', e); }
  hatirlaticiKontrol();
  setInterval(hatirlaticiKontrol, 30000);
  if (app.isPackaged) guncelleyici.baslat(bildir, () => { cikisIstendi = true; });
});
app.on('window-all-closed', (e) => e.preventDefault());
