const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');
contextBridge.exposeInMainWorld('ekran', {
  baslangicVerisi: () => ipcRenderer.invoke('baslangic-verisi'),
  isler: () => ipcRenderer.invoke('isler'),
  isEkle: (is) => ipcRenderer.invoke('is-ekle', is),
  isYapildi: (id) => ipcRenderer.invoke('is-yapildi', id),
  isSil: (id) => ipcRenderer.invoke('is-sil', id),
  dosyaUrl: (yol) => pathToFileURL(yol).href,
  islerDegisince: (f) => ipcRenderer.on('isler-degisti', f),
});
contextBridge.exposeInMainWorld('asistan', {
  anahtarVar: () => ipcRenderer.invoke('anahtar-var'),
  anahtarKaydet: (a) => ipcRenderer.invoke('anahtar-kaydet', a),
  hazirla: () => ipcRenderer.invoke('asistan-hazirla'),
  modelIndirmeDinle: (f) => ipcRenderer.on('model-indirme', (_e, p) => f(p)),
  dinle: (ses) => ipcRenderer.invoke('asistan-dinle', ses),
  sor: (metin, baglam) => ipcRenderer.invoke('asistan-sor', metin, baglam),
  seslendir: (metin) => ipcRenderer.invoke('asistan-seslendir', metin),
});
