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
