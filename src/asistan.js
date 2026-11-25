// Sesli asistan: konuşmayı yazıya çevirme (Whisper, bilgisayarda), Claude ile sohbet, Türkçe seslendirme.
const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk').default;
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const acici = require('./acici');

const ANAHTAR_DOSYASI = () => path.join(app.getPath('userData'), 'anahtar.bin');
const AYAR_DOSYASI = () => path.join(app.getPath('userData'), 'asistan.json');
const VARSAYILAN_MODEL = 'claude-opus-5-5';
const SES = 'tr-TR-AhmetNeural';
const SOHBET_ZAMAN_ASIMI = 30 * 60 * 1000; // 30 dk sessizlikte sohbet sıfırlanır

// ---------- API anahtarı (yalnızca bu bilgisayarda, Windows'un şifrelemesiyle) ----------
function anahtarOku() {
  try {
    const veri = fs.readFileSync(ANAHTAR_DOSYASI());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(veri) : veri.toString('utf8');
  } catch { return null; }
}
function anahtarKaydet(anahtar) {
  anahtar = String(anahtar || '').trim();
  if (!anahtar.startsWith('sk-ant-')) throw new Error('Bu bir Claude API anahtarına benzemiyor (sk-ant- ile başlamalı).');
  const veri = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(anahtar) : Buffer.from(anahtar, 'utf8');
  fs.writeFileSync(ANAHTAR_DOSYASI(), veri);
  istemci = null;
}
function ayarlar() {
  try { return { model: VARSAYILAN_MODEL, ...JSON.parse(fs.readFileSync(AYAR_DOSYASI(), 'utf8')) }; } catch { return { model: VARSAYILAN_MODEL }; }
}

// ---------- Konuşmayı yazıya çevirme ----------
let tanima = null;
async function tanimaYukle(ilerleme) {
  if (!tanima) {
    tanima = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = path.join(app.getPath('userData'), 'modeller');
      return pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', {
        dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
        progress_callback: (p) => { if (p.status === 'progress' && ilerleme) ilerleme({ dosya: p.file, yuzde: Math.round(p.progress || 0) }); },
      });
    })();
    tanima.catch(() => { tanima = null; });
  }
  return tanima;
}
async function yaziyaCevir(ses16k) {
  const asr = await tanimaYukle();
  const r = await asr(new Float32Array(ses16k), { language: 'turkish', task: 'transcribe' });
  return (r.text || '').trim();
}

// ---------- Seslendirme ----------
async function seslendir(metin) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(SES, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(metin);
  return new Promise((coz, reddet) => {
    const parcalar = [];
    audioStream.on('data', (d) => parcalar.push(d));
    audioStream.on('end', () => { tts.close?.(); coz(Buffer.concat(parcalar)); });
    audioStream.on('error', (e) => { tts.close?.(); reddet(e); });
  });
}

// ---------- Claude ile sohbet ----------
let istemci = null;
let mesajlar = [];
let sonKonusma = 0;

const ARACLAR = [
  {
    name: 'takvimi_getir',
    description: 'Belirli bir günün takvimindeki işleri getirir. Kullanıcı bugünü, yarını veya bir günü sorduğunda kullan.',
    input_schema: { type: 'object', properties: { tarih: { type: 'string', description: 'YYYY-MM-DD biçiminde gün' } }, required: ['tarih'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'is_ekle',
    description: 'Takvime yeni bir iş ekler. Kullanıcı bir şeyi hatırlatmanı ya da takvime koymanı istediğinde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        baslik: { type: 'string', description: 'İşin kısa adı' },
        baslangic: { type: 'string', description: 'Yerel saatle YYYY-MM-DDTHH:MM' },
        sure_dk: { type: 'integer', description: 'Süre (dakika). Belirtilmezse 60.' },
      },
      required: ['baslik', 'baslangic', 'sure_dk'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'is_durumu',
    description: 'Takvimdeki bir işi yapıldı ya da yapılmadı olarak işaretler. İşin id değerini önce takvimi_getir ile bul.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, yapildi: { type: 'boolean' } }, required: ['id', 'yapildi'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'ac',
    description: 'Bilgisayarda bir şey açar. Kullanıcı "Chrome\'u aç", "YouTube\'u aç", "Word\'ü aç", "indirilenleri aç", "şunu Google\'da ara" gibi bir şey istediğinde kullan. tur: program (yüklü uygulama), site (web sitesi), arama (Google araması), klasor (belgeler, indirilenler, masaüstü, resimler, müzik, videolar). Programlarda tam ve resmi adı yaz (ör. "vs code" için "Visual Studio Code", "chrome" için "Google Chrome"). Bilinen bir site adı söylenirse (YouTube, WhatsApp, Gmail) tur site olsun ve hedefe sitenin adresini yaz.',
    input_schema: {
      type: 'object',
      properties: {
        tur: { type: 'string', enum: ['program', 'site', 'arama', 'klasor'] },
        hedef: { type: 'string', description: 'Program adı, web adresi, arama metni ya da klasör adı' },
      },
      required: ['tur', 'hedef'],
      additionalProperties: false,
    },
    strict: true,
  },
];

function sistemMetni(baglam) {
  const simdi = new Date();
  const tarih = simdi.toLocaleString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `Sen bu bilgisayardaki "Açılış Ekranı" uygulamasının sesli asistanısın. Kullanıcıya samimi ama saygılı bir dille, zaman zaman "patron" diye hitap edersin.

Cevapların sesli okunacak. Bu yüzden:
- Kısa konuş: çoğu cevap bir iki cümle olsun. Kullanıcı ayrıntı isterse uzat.
- Madde işareti, başlık, emoji, yıldız gibi biçimlendirme kullanma; düz konuşma cümleleriyle yaz.
- Saatleri "saat on dört otuz" gibi değil, "14.30" gibi yaz.

Bilgisayarda program, site ya da klasör açman istendiğinde ac aracını kullan; açtıktan sonra yalnızca "Açıyorum patron" gibi çok kısa bir cümle söyle.\n\nTakvim için araçların var: işleri sorulduğunda takvimi_getir, yeni bir şey eklemen istendiğinde is_ekle, bir iş bittiğinde is_durumu. Gün ve saatleri aşağıdaki şimdiki zamana göre hesapla. Ekledikten sonra ne eklediğini kısaca söyle.

Dini konularda dikkatli ol: ayet ya da hadis aktarırken emin olmadığın bir metni uydurma; emin değilsen bunu açıkça söyle ve Diyanet'in kaynaklarına bakmasını öner. Fıkhi meselelerde görüş ayrılıklarını belirt.

Şimdiki zaman: ${tarih} (Türkiye saati).
${baglam?.ozelGun ? `Bugünün özelliği: ${baglam.ozelGun}.` : ''}
${baglam?.ayet ? `Ekrandaki günün ayeti: ${baglam.ayet}` : ''}
${baglam?.hadis ? `Ekrandaki günün hadisi: ${baglam.hadis}` : ''}`.trim();
}

function yerelIso(d) {
  const iki = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}T${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

async function araciCalistir(ad, girdi, takvim) {
  if (ad === 'ac') return acici.ac(girdi);
  if (ad === 'takvimi_getir') {
    const gun = String(girdi.tarih || '').slice(0, 10);
    const isler = takvim.oku()
      .filter((i) => yerelIso(new Date(i.baslangic)).startsWith(gun))
      .sort((a, b) => new Date(a.baslangic) - new Date(b.baslangic))
      .map((i) => ({ id: i.id, baslik: i.baslik, baslangic: yerelIso(new Date(i.baslangic)), sure_dk: i.sureDk, yapildi: i.yapildi }));
    return { gun, isler };
  }
  if (ad === 'is_ekle') {
    const bas = new Date(girdi.baslangic);
    if (isNaN(bas)) throw new Error('Geçersiz tarih: ' + girdi.baslangic);
    const is = takvim.ekle({ baslik: girdi.baslik, baslangic: bas.toISOString(), sureDk: girdi.sure_dk || 60 });
    return { eklendi: true, is: { ...is, baslangic: yerelIso(bas) } };
  }
  if (ad === 'is_durumu') {
    const ok = takvim.durum(girdi.id, girdi.yapildi);
    if (!ok) throw new Error('Bu id ile iş bulunamadı');
    return { guncellendi: true };
  }
  throw new Error('Bilinmeyen araç: ' + ad);
}

// "Chrome'u aç" gibi basit komutlar Claude'a gitmeden, anında yapılır
async function hizliKomut(metin) {
  const m = String(metin).trim().replace(/[.!?]+$/, '').match(/^(.+?)\s+(aç|açar mısın|açsana|açabilir misin|başlat)$/i);
  if (!m) return null;
  const hedef = m[1].replace(/^(bana|lütfen|hey)\s+/i, '');
  for (const tur of ['klasor', 'program', 'site']) {
    try {
      if (tur === 'site' && !/\.|youtube|google|gmail|whatsapp|instagram|twitter|diyanet|kuran/i.test(hedef)) continue;
      const r = await acici.ac({ tur, hedef });
      return { cevap: 'Açıyorum patron.', acildi: r.acildi };
    } catch { /* sıradaki türü dene */ }
  }
  return null;
}

async function sor(metin, baglam, takvim) {
  const hizli = await hizliKomut(metin);
  if (hizli) return hizli;
  const anahtar = anahtarOku();
  if (!anahtar) return { anahtarYok: true };
  if (!istemci) istemci = new Anthropic({ apiKey: anahtar });
  if (Date.now() - sonKonusma > SOHBET_ZAMAN_ASIMI || mesajlar.length > 60) mesajlar = [];
  sonKonusma = Date.now();

  const { model } = ayarlar();
  const onceki = mesajlar.length;
  mesajlar.push({ role: 'user', content: metin });
  let takvimDegisti = false;

  for (let tur = 0; tur < 6; tur++) {
    const istek = {
      model,
      max_tokens: 16000,
      system: sistemMetni(baglam),
      tools: ARACLAR,
      output_config: { effort: 'low' },
      messages: mesajlar,
    };
    // Opus/Sonnet: güvenlik sınıflandırıcısı reddederse istek otomatik olarak uygun modele yönlendirilir
    if (!model.includes('haiku')) Object.assign(istek, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

    let cevap;
    try {
      cevap = await istemci.beta.messages.create(istek);
    } catch (e) {
      mesajlar.length = onceki; // yarım kalan turu geri al
      if (e instanceof Anthropic.AuthenticationError) return { hata: 'API anahtarı geçersiz görünüyor. Ayarlardan yeniden girebilirsin.', anahtarGecersiz: true };
      if (e instanceof Anthropic.RateLimitError) return { hata: 'Şu an çok fazla istek var, biraz sonra tekrar dene.' };
      if (e instanceof Anthropic.APIConnectionError) return { hata: 'İnternete bağlanamadım.' };
      if (e instanceof Anthropic.APIError) return { hata: `Claude hatası (${e.status}): ${e.message}` };
      throw e;
    }

    mesajlar.push({ role: 'assistant', content: cevap.content });

    if (cevap.stop_reason === 'refusal') return { cevap: 'Bu konuda yardımcı olamıyorum, patron.', takvimDegisti };
    if (cevap.stop_reason !== 'tool_use') {
      const yazi = cevap.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      return { cevap: yazi || 'Anlayamadım, tekrar söyler misin?', takvimDegisti };
    }

    const sonuclar = [];
    for (const blok of cevap.content) {
      if (blok.type !== 'tool_use') continue;
      try {
        const sonuc = await araciCalistir(blok.name, blok.input, takvim);
        if (blok.name === 'is_ekle' || blok.name === 'is_durumu') takvimDegisti = true;
        sonuclar.push({ type: 'tool_result', tool_use_id: blok.id, content: JSON.stringify(sonuc) });
      } catch (e) {
        sonuclar.push({ type: 'tool_result', tool_use_id: blok.id, content: String(e.message || e), is_error: true });
      }
    }
    mesajlar.push({ role: 'user', content: sonuclar });
  }
  return { cevap: 'Bu biraz uzun sürdü, bir daha dener misin?', takvimDegisti };
}

module.exports = { yaziyaCevir, tanimaYukle, seslendir, sor, anahtarKaydet, anahtarVar: () => !!anahtarOku(), ayarlar };
