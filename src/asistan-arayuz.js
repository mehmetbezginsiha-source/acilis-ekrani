// Sesli asistan arayüzü: mikrofon, yazıya çevirme, soru-cevap ve seslendirme
(() => {
  const $ = (id) => document.getElementById(id);
  const kutu = $('asistan');
  const balon = $('balon');
  const durum = (d) => { kutu.dataset.durum = d; };
  const goster = (soru, cevap, bekliyor = false) => {
    balon.hidden = false;
    $('balonSoru').textContent = soru || '';
    $('balonCevap').textContent = cevap || '';
    $('balonCevap').classList.toggle('bekliyor', bekliyor);
    clearTimeout(goster.zaman);
    if (!bekliyor) goster.zaman = setTimeout(() => { if (kutu.dataset.durum === 'hazir') balon.hidden = true; }, 45000);
  };

  // ---------- API anahtarı ----------
  const pencere = $('anahtarPencere');
  let anahtarSonrasi = null;
  function anahtarIste(sonra) {
    anahtarSonrasi = sonra; $('anahtarHata').hidden = true; $('anahtarGirdi').value = '';
    pencere.showModal();
  }
  $('anahtarIptal').onclick = () => pencere.close();
  $('anahtarFormu').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await window.asistan.anahtarKaydet($('anahtarGirdi').value);
    if (r.hata) { $('anahtarHata').textContent = r.hata; $('anahtarHata').hidden = false; return; }
    pencere.close();
    const f = anahtarSonrasi; anahtarSonrasi = null; f?.();
  });

  // ---------- Soru sor, cevabı göster ve seslendir ----------
  const sesCalar = $('asistanSes');
  async function sor(metin) {
    metin = (metin || '').trim();
    if (!metin) { durum('hazir'); return; }
    durum('dusunuyor');
    goster(metin, 'Düşünüyorum…', true);
    const r = await window.asistan.sor(metin, window.gunBaglam || {});
    if (r.anahtarYok || r.anahtarGecersiz) {
      durum('hazir');
      goster(metin, r.hata || 'Önce API anahtarını girmen gerekiyor.');
      anahtarIste(() => sor(metin));
      return;
    }
    if (r.hata) { durum('hazir'); goster(metin, r.hata); return; }
    goster(metin, r.cevap);
    await konus(r.cevap);
  }
  async function konus(metin) {
    durum('konusuyor');
    const s = await window.asistan.seslendir(metin);
    if (s.hata || !s.ses) { durum('hazir'); return; }
    const url = URL.createObjectURL(new Blob([s.ses], { type: 'audio/mpeg' }));
    sesCalar.src = url; sesCalar.volume = 0.7;
    sesCalar.onended = () => { URL.revokeObjectURL(url); durum('hazir'); };
    sesCalar.play().catch(() => durum('hazir'));
  }

  // ---------- Mikrofon: konuşmayı kaydet, sessizlikte kendiliğinden dur ----------
  let kayit = null;
  async function dinlemeyeBasla() {
    sesCalar.pause();
    if (!dinlemeyeBasla.modelHazir) {
      durum('hazirlaniyor');
      goster('', 'Ses tanıma hazırlanıyor… (ilk seferde yaklaşık 250 MB indirilir)', true);
      const h = await window.asistan.hazirla();
      if (h.hata) { durum('hazir'); goster('', h.hata); return; }
      dinlemeyeBasla.modelHazir = true;
    }
    let akis;
    try { akis = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
    catch { durum('hazir'); goster('', 'Mikrofona erişemedim. Windows Ayarları > Gizlilik > Mikrofon bölümünden masaüstü uygulamalarına izin ver.'); return; }

    const ctx = new AudioContext({ sampleRate: 16000 });
    const kaynak = ctx.createMediaStreamSource(akis);
    const isleyici = ctx.createScriptProcessor(4096, 1, 1);
    const parcalar = [];
    let konustu = false, sessizBaslangic = 0;
    const baslangic = performance.now();
    isleyici.onaudioprocess = (e) => {
      const veri = new Float32Array(e.inputBuffer.getChannelData(0));
      parcalar.push(veri);
      let t = 0; for (const x of veri) t += x * x;
      const rms = Math.sqrt(t / veri.length);
      const simdi = performance.now();
      if (rms > 0.02) { konustu = true; sessizBaslangic = 0; }
      else if (konustu) { sessizBaslangic ||= simdi; if (simdi - sessizBaslangic > 1400) dinlemeyiBitir(); }
      if (simdi - baslangic > 20000 || (!konustu && simdi - baslangic > 7000)) dinlemeyiBitir();
    };
    kaynak.connect(isleyici); isleyici.connect(ctx.destination);
    kayit = { akis, ctx, isleyici, parcalar, konustu: () => konustu };
    durum('dinliyor');
    goster('', 'Dinliyorum…', true);
  }
  async function dinlemeyiBitir() {
    if (!kayit) return;
    const k = kayit; kayit = null;
    k.isleyici.disconnect(); k.akis.getTracks().forEach((t) => t.stop()); k.ctx.close();
    if (!k.konustu()) { durum('hazir'); balon.hidden = true; return; }
    const uzunluk = k.parcalar.reduce((a, p) => a + p.length, 0);
    const ses = new Float32Array(uzunluk);
    let o = 0; for (const p of k.parcalar) { ses.set(p, o); o += p.length; }
    durum('dusunuyor');
    goster('', 'Anlamaya çalışıyorum…', true);
    const r = await window.asistan.dinle(ses);
    if (r.hata) { durum('hazir'); goster('', r.hata); return; }
    if (!r.metin) { durum('hazir'); goster('', 'Bir şey duyamadım, tekrar dener misin?'); return; }
    await sor(r.metin);
  }
  const mikrofonaBas = () => {
    const d = kutu.dataset.durum;
    if (d === 'dinliyor') dinlemeyiBitir();
    else if (d === 'konusuyor') { sesCalar.pause(); durum('hazir'); }
    else if (d === 'hazir') dinlemeyeBasla();
  };
  $('mikrofon').onclick = mikrofonaBas;
  document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); mikrofonaBas(); } });

  // ---------- Yazarak sorma ----------
  $('klavyeDugme').onclick = () => { $('yaziFormu').hidden = !$('yaziFormu').hidden; if (!$('yaziFormu').hidden) $('yaziGirdi').focus(); };
  $('yaziFormu').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = $('yaziGirdi').value; $('yaziGirdi').value = '';
    if (kutu.dataset.durum === 'hazir') sor(m);
  });
})();
