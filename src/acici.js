// "Şunu aç" komutları: Başlat menüsündeki programlar, web siteleri, bilinen klasörler.
// Güvenlik: yalnızca Başlat menüsü kısayolları, birkaç yerleşik Windows aracı, http(s) adresleri ve bilinen klasörler açılır.
const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const YERLESIK = {
  'hesap makinesi': 'calc.exe', 'not defteri': 'notepad.exe', 'paint': 'mspaint.exe',
  'dosya gezgini': 'explorer.exe', 'görev yöneticisi': 'taskmgr.exe', 'komut istemi': 'cmd.exe',
  'ayarlar': 'ms-settings:', 'takvim': 'outlookcal:', 'saat': 'ms-clock:', 'kamera': 'microsoft.windows.camera:',
  'mağaza': 'ms-windows-store:', 'microsoft store': 'ms-windows-store:', 'fotoğraflar': 'ms-photos:',
};
const KLASORLER = { 'belgeler': 'documents', 'indirilenler': 'downloads', 'masaüstü': 'desktop', 'resimler': 'pictures', 'müzik': 'music', 'videolar': 'videos' };
const SITELER = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com', gmail: 'https://mail.google.com',
  whatsapp: 'https://web.whatsapp.com', instagram: 'https://www.instagram.com', twitter: 'https://x.com', x: 'https://x.com',
  'diyanet': 'https://www.diyanet.gov.tr', 'kuran': 'https://kuran.diyanet.gov.tr', 'hadislerle islam': 'https://hadislerleislam.diyanet.gov.tr',
  'namaz vakitleri': 'https://namazvakitleri.diyanet.gov.tr', 'haritalar': 'https://maps.google.com', 'hava durumu': 'https://www.mgm.gov.tr',
};

const sadelestir = (s) => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/['’]\S*/g, '') // Chrome'u -> chrome
  .replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

let kisayolOnbellek = null;
function kisayollar() {
  if (kisayolOnbellek) return kisayolOnbellek;
  const kokler = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];
  const liste = [];
  const gez = (d, derinlik = 0) => {
    if (derinlik > 4) return;
    let girdiler = [];
    try { girdiler = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const g of girdiler) {
      const tam = path.join(d, g.name);
      if (g.isDirectory()) gez(tam, derinlik + 1);
      else if (/\.(lnk|url)$/i.test(g.name) && !/uninstall|kaldır|readme|help|yardım/i.test(g.name)) liste.push({ ad: g.name.replace(/\.(lnk|url)$/i, ''), yol: tam });
    }
  };
  kokler.forEach((k) => gez(k));
  kisayolOnbellek = liste;
  setTimeout(() => { kisayolOnbellek = null; }, 10 * 60 * 1000).unref?.();
  return liste;
}

// "spotifyı", "hesap makinesini" gibi -i hâli eklerini atar
const ekiAt = (s) => s.replace(/(n|y)?[iu]$/, '');

function enIyiKisayol(ad) {
  return enIyiKisayolTam(sadelestir(ad)) || enIyiKisayolTam(ekiAt(sadelestir(ad)));
}

function enIyiKisayolTam(aranan) {
  if (!aranan) return null;
  let en = null, enPuan = 0;
  for (const k of kisayollar()) {
    const s = sadelestir(k.ad);
    let puan = 0;
    if (s === aranan) puan = 100;
    else if (s.startsWith(aranan)) puan = 80;
    else if (s.split(' ').includes(aranan)) puan = 70;
    else if (s.includes(aranan)) puan = 50;
    else if (aranan.split(' ').every((p) => s.includes(p))) puan = 40;
    if (puan && s.length < 40) puan += 5; // kısa adları öne al
    if (puan > enPuan) { en = k; enPuan = puan; }
  }
  return en;
}

async function ac({ tur, hedef }) {
  hedef = String(hedef || '').trim();
  const s = sadelestir(hedef);
  if (tur === 'site' || /^https?:\/\//i.test(hedef)) {
    let url = SITELER[s] || SITELER[ekiAt(s)] || hedef;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Yalnızca web adresleri açılabilir');
    await shell.openExternal(u.href);
    return { acildi: u.href };
  }
  if (tur === 'arama') {
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(hedef);
    await shell.openExternal(url);
    return { acildi: 'Google araması: ' + hedef };
  }
  if (tur === 'klasor') {
    const anahtar = Object.keys(KLASORLER).find((k) => sadelestir(k) === s || s.startsWith(sadelestir(k)));
    if (!anahtar) throw new Error('Bu klasörü bilmiyorum. Bildiklerim: ' + Object.keys(KLASORLER).join(', '));
    const hata = await shell.openPath(app.getPath(KLASORLER[anahtar]));
    if (hata) throw new Error(hata);
    return { acildi: anahtar + ' klasörü' };
  }
  // program
  const yerlesik = Object.keys(YERLESIK).find((k) => sadelestir(k) === s || sadelestir(k) === ekiAt(s));
  if (yerlesik) {
    const hedefYol = YERLESIK[yerlesik];
    if (hedefYol.endsWith(':')) await shell.openExternal(hedefYol);
    else execFile(hedefYol, { windowsHide: false }, () => {}).unref();
    return { acildi: yerlesik };
  }
  const k = enIyiKisayol(hedef);
  if (!k) {
    const site = SITELER[s] || SITELER[ekiAt(s)];
    if (site) { await shell.openExternal(site); return { acildi: site }; }
    throw new Error(`"${hedef}" adında yüklü bir program bulamadım`);
  }
  const hata = await shell.openPath(k.yol);
  if (hata) throw new Error(hata);
  return { acildi: k.ad };
}

module.exports = { ac, kisayollar };
