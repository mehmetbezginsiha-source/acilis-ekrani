// Açılış Ekranı - arayüz
const $ = (id) => document.getElementById(id);
const ILK_SAAT = 6, SON_SAAT = 23;
const iki = (n) => String(n).padStart(2, '0');
const saatYaz = (d) => `${iki(d.getHours())}:${iki(d.getMinutes())}`;

function saatGuncelle() {
  const d = new Date();
  $('saat').textContent = saatYaz(d);
  $('tarih').textContent = d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (saatGuncelle.hicri) $('hicri').textContent = saatGuncelle.hicri;
  const s = d.getHours();
  $('selam').textContent = 'Hoş geldin patron · ' + (s < 5 ? 'Hayırlı geceler' : s < 11 ? 'Hayırlı sabahlar' : s < 17 ? 'İyi çalışmalar' : 'Hayırlı akşamlar');
}

function metinKoy(id, metin) { $(id).textContent = metin || ''; $(id).hidden = !metin; }

async function baslat() {
  const v = await window.ekran.baslangicVerisi();

  if (v.gorsel) {
    const url = window.ekran.dosyaUrl(v.gorsel.yol);
    const on = $('onYukleme');
    on.onload = () => { $('arkaplan').style.backgroundImage = `url("${url}")`; $('arkaplan').classList.add('yuklendi'); };
    on.src = url;
    $('eserBaslik').textContent = v.gorsel.baslik || '';
    $('eserBilgi').textContent = [v.gorsel.donem, v.gorsel.tarih, v.gorsel.yer].filter(Boolean).join(' · ') + ' · The Met, açık erişim (CC0)';
  }

  window.gunBaglam = {
    ozelGun: (v.gun?.ozel || []).map((o) => o.yazi).join(', '),
    ayet: v.ayet ? `${v.ayet.sure} ${v.ayet.ayet}: ${v.ayet.meal}` : '',
    hadis: v.hadis ? `${v.hadis.turkce} (${v.hadis.kaynak})` : '',
  };

  if (v.gun?.ozel?.length) {
    $('ozelGun').textContent = v.gun.ozel.map((o) => o.yazi).join(' · ');
    $('ozelGun').hidden = false;
  }

  if (v.ayet) {
    metinKoy('ayetArapca', v.ayet.arapca);
    metinKoy('ayetMeal', v.ayet.meal);
    metinKoy('ayetKaynak', `${v.ayet.sure} Suresi, ${v.ayet.ayet}. ${String(v.ayet.ayet).includes('-') ? 'ayetler' : 'ayet'} · Meal: Diyanet İşleri · Arapça metin: Tanzil (tanzil.net)`);
  } else {
    metinKoy('ayetArapca', ''); metinKoy('ayetKaynak', '');
    $('ayetMeal').hidden = false;
    $('ayetMeal').innerHTML = '<span class="bos">Diyanet\'in Kur\'an sitesinden alınan ayetler eklendiğinde burada Arapça metni ve meali ile görünecek.</span>';
  }

  // Uzun metinlerde yazıyı biraz küçült ki iki kart ekrana sığsın
  for (const [kart, uz] of [['ayetKart', (v.ayet?.arapca || '').length], ['hadisKart', (v.hadis?.arapca || '').length]]) {
    if (uz > 260) $(kart).classList.add('cokUzun'); else if (uz > 150) $(kart).classList.add('uzun');
  }

  if (v.hadis) {
    metinKoy('hadisArapca', v.hadis.arapca);
    metinKoy('hadisTurkce', v.hadis.turkce);
    metinKoy('hadisKaynak', v.hadis.kaynak);
  }

  await document.fonts.ready;
  sigdir();
  window.addEventListener('resize', sigdir);
  document.fonts.addEventListener('loadingdone', sigdir);
  setTimeout(sigdir, 1500);

  const ses = $('karsilama');
  ses.src = window.ekran.dosyaUrl(v.ses);
  ses.volume = v.sesSeviyesi;
  ses.play().catch(() => {});

  if (v.gun?.hicri) saatGuncelle.hicri = `${v.gun.hicri.gun} ${v.gun.hicri.ayAdi} ${v.gun.hicri.yil} (Hicrî)`;
  saatGuncelle();
  setInterval(saatGuncelle, 1000 * 15);
  $('isTarih').value = tarihYaz(new Date());
  gorunumUygula();
  setInterval(takvimCiz, 60 * 1000);
  window.ekran.islerDegisince(takvimCiz);

  const sonraki = new Date(); // varsayılan saat: bir sonraki yarım saat
  sonraki.setMinutes(Math.ceil((sonraki.getMinutes() + 1) / 30) * 30, 0, 0);
  $('isSaat').value = saatYaz(sonraki);
}

// Sol sütun ekrana sığmazsa yazıları kademeli küçült
function sigdir() {
  const sol = document.querySelector('.sol');
  sol.classList.remove('k1', 'k2', 'k3');
  for (const k of ['k1', 'k2', 'k3']) {
    if (sol.scrollHeight <= sol.clientHeight + 1) break;
    sol.classList.add(k);
  }
}

async function takvimCiz() {
  const isler = await window.ekran.isler();
  if (gorunum === 'hafta') return haftaCiz(isler);
  $('takvimBaslikYazi').textContent = 'Bugün';
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const yarin = new Date(bugun); yarin.setDate(yarin.getDate() + 1);
  const simdi = new Date();
  const bugunkuler = isler
    .map((i) => ({ ...i, bas: new Date(i.baslangic) }))
    .filter((i) => i.bas >= bugun && i.bas < yarin)
    .sort((a, b) => a.bas - b.bas);

  const ilk = Math.min(ILK_SAAT, ...bugunkuler.map((i) => i.bas.getHours()));
  const ol = $('saatler');
  const kaydirma = ol.scrollTop;
  ol.innerHTML = '';
  let simdiSatir = null;

  for (let s = ilk; s <= SON_SAAT; s++) {
    const li = document.createElement('li');
    li.className = 'saatSatir';
    if (s < simdi.getHours()) li.classList.add('gecti');
    if (s === simdi.getHours()) { li.classList.add('simdi'); simdiSatir = li; }
    li.innerHTML = `<span class="etiket">${iki(s)}:00</span><div class="isler"></div>`;
    const kap = li.querySelector('.isler');
    for (const is of bugunkuler.filter((i) => i.bas.getHours() === s)) kap.appendChild(isOgesi(is, simdi));
    if (s === simdi.getHours()) {
      const c = document.createElement('div');
      c.className = 'simdiCizgi';
      c.style.top = `${(simdi.getMinutes() / 60) * 100}%`;
      li.appendChild(c);
    }
    ol.appendChild(li);
  }

  const kalan = bugunkuler.filter((i) => !i.yapildi).length;
  $('ozet').textContent = bugunkuler.length ? `${bugunkuler.length} iş · ${kalan} kaldı` : 'Henüz iş yok';

  if (!takvimCiz.ilkKez && simdiSatir) { ol.scrollTop = Math.max(0, simdiSatir.offsetTop - 60); takvimCiz.ilkKez = true; }
  else ol.scrollTop = kaydirma;
}

function isOgesi(is, simdi) {
  const bit = new Date(is.bas.getTime() + (is.sureDk || 60) * 60000);
  const div = document.createElement('div');
  div.className = 'is';
  if (is.yapildi) div.classList.add('yapildi');
  else if (simdi > bit) div.classList.add('gecikti');
  div.innerHTML = `<button class="isaret" title="Yapıldı">✓</button><span class="ad"></span><span class="zaman">${saatYaz(is.bas)}–${saatYaz(bit)}</span><button class="sil" title="Sil">✕</button>`;
  div.querySelector('.ad').textContent = is.baslik;
  div.querySelector('.isaret').onclick = async () => { await window.ekran.isYapildi(is.id); takvimCiz(); };
  div.querySelector('.sil').onclick = async () => { await window.ekran.isSil(is.id); takvimCiz(); };
  return div;
}

$('isFormu').addEventListener('submit', async (e) => {
  e.preventDefault();
  const [yil, ay, gun] = $('isTarih').value.split('-').map(Number);
  const [sa, dk] = $('isSaat').value.split(':').map(Number);
  const bas = new Date(yil, ay - 1, gun, sa, dk, 0, 0);
  await window.ekran.isEkle({ baslik: $('isBaslik').value.trim(), baslangic: bas.toISOString(), sureDk: Number($('isSure').value) });
  $('isBaslik').value = '';
  takvimCiz();
});

// ---------- Gün / hafta görünümü ----------
const GUN_ADLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
let gorunum = 'hafta';
try { gorunum = localStorage.getItem('gorunum') || 'hafta'; } catch {}
let haftaKaydir = 0;
const tarihYaz = (d) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
const ayniGun = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function haftaBaslangici(kaydir = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + kaydir * 7); // pazartesi
  return d;
}

function gorunumUygula() {
  document.body.classList.toggle('haftaGorunumu', gorunum === 'hafta');
  $('saatler').hidden = gorunum === 'hafta';
  $('hafta').hidden = gorunum !== 'hafta';
  document.querySelectorAll('.gorunumSecici button').forEach((b) => b.classList.toggle('secili', b.dataset.gorunum === gorunum));
  document.querySelectorAll('.haftaOgesi').forEach((b) => { b.hidden = gorunum !== 'hafta'; });
  takvimCiz.ilkKez = false;
  takvimCiz();
}
document.querySelectorAll('.gorunumSecici button').forEach((b) => b.onclick = () => {
  gorunum = b.dataset.gorunum; try { localStorage.setItem('gorunum', gorunum); } catch {}
  gorunumUygula();
});
$('oncekiHafta').onclick = () => { haftaKaydir--; takvimCiz(); };
$('sonrakiHafta').onclick = () => { haftaKaydir++; takvimCiz(); };
$('buHafta').onclick = () => { haftaKaydir = 0; takvimCiz.ilkKez = false; takvimCiz(); };

function haftaCiz(isler) {
  const simdi = new Date();
  const bas = haftaBaslangici(haftaKaydir);
  const gunler = [...Array(7)].map((_, i) => { const d = new Date(bas); d.setDate(d.getDate() + i); return d; });
  const bitis = new Date(bas); bitis.setDate(bitis.getDate() + 7);
  const haftaIsleri = isler.map((i) => ({ ...i, bas: new Date(i.baslangic) })).filter((i) => i.bas >= bas && i.bas < bitis).sort((a, b) => a.bas - b.bas);
  const ilk = Math.min(ILK_SAAT, ...haftaIsleri.map((i) => i.bas.getHours()));

  const kap = $('hafta');
  const kaydirma = kap.scrollTop;
  kap.innerHTML = '';
  // başlık satırı
  kap.appendChild(Object.assign(document.createElement('div'), { className: 'hHucre hKose' }));
  for (const [i, g] of gunler.entries()) {
    const h = document.createElement('div');
    h.className = 'hHucre hGunBaslik' + (ayniGun(g, simdi) ? ' bugun' : '') + (g < simdi && !ayniGun(g, simdi) ? ' gecmis' : '');
    h.innerHTML = `<span>${GUN_ADLARI[i]}</span><b>${g.getDate()}</b>`;
    kap.appendChild(h);
  }
  let simdiHucre = null;
  for (let s = ilk; s <= SON_SAAT; s++) {
    const e = document.createElement('div');
    e.className = 'hHucre hSaat'; e.textContent = `${iki(s)}:00`;
    kap.appendChild(e);
    for (const g of gunler) {
      const c = document.createElement('div');
      const buGun = ayniGun(g, simdi);
      c.className = 'hHucre hGovde' + (buGun ? ' bugun' : '');
      const hucreSonu = new Date(g); hucreSonu.setHours(s + 1);
      if (hucreSonu < simdi) c.classList.add('gecmis');
      for (const is of haftaIsleri.filter((i) => ayniGun(i.bas, g) && i.bas.getHours() === s)) c.appendChild(haftaIsOgesi(is, simdi));
      if (buGun && s === simdi.getHours()) {
        const cz = document.createElement('div'); cz.className = 'simdiCizgi hafta';
        cz.style.top = `${(simdi.getMinutes() / 60) * 100}%`; c.appendChild(cz); simdiHucre = c;
      }
      c.addEventListener('dblclick', (ev) => {
        if (ev.target !== c) return;
        $('isTarih').value = tarihYaz(g); $('isSaat').value = `${iki(s)}:00`; $('isBaslik').focus();
      });
      c.title = 'Bu saate iş eklemek için çift tıkla';
      kap.appendChild(c);
    }
  }
  const son = new Date(bitis); son.setDate(son.getDate() - 1);
  const ayAdi = (d) => d.toLocaleDateString('tr-TR', { month: 'long' });
  $('takvimBaslikYazi').textContent = haftaKaydir === 0 ? 'Bu hafta' : `${bas.getDate()} ${bas.getMonth() !== son.getMonth() ? ayAdi(bas) + ' ' : ''}– ${son.getDate()} ${ayAdi(son)}`;
  const kalan = haftaIsleri.filter((i) => !i.yapildi).length;
  $('ozet').textContent = haftaIsleri.length ? `${haftaIsleri.length} iş · ${kalan} kaldı` : 'Bu hafta iş yok';
  if (!takvimCiz.ilkKez) {
    const hedef = simdiHucre || kap.children[8 + 8 * Math.max(0, 8 - ilk)];
    if (hedef) kap.scrollTop = Math.max(0, hedef.offsetTop - 90);
    takvimCiz.ilkKez = true;
  } else kap.scrollTop = kaydirma;
}

function haftaIsOgesi(is, simdi) {
  const bit = new Date(is.bas.getTime() + (is.sureDk || 60) * 60000);
  const d = document.createElement('div');
  d.className = 'hIs' + (is.yapildi ? ' yapildi' : simdi > bit ? ' gecikti' : '');
  d.innerHTML = `<span class="ad"></span><span class="zaman">${saatYaz(is.bas)}</span><span class="hIsDugmeler"><button class="isaret" title="Yapıldı">✓</button><button class="sil" title="Sil">✕</button></span>`;
  d.querySelector('.ad').textContent = is.baslik;
  d.title = `${is.baslik} · ${saatYaz(is.bas)}–${saatYaz(bit)}`;
  d.querySelector('.isaret').onclick = async () => { await window.ekran.isYapildi(is.id); takvimCiz(); };
  d.querySelector('.sil').onclick = async () => { await window.ekran.isSil(is.id); takvimCiz(); };
  return d;
}

baslat();
