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
  await takvimCiz();
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
  const [sa, dk] = $('isSaat').value.split(':').map(Number);
  const bas = new Date(); bas.setHours(sa, dk, 0, 0);
  await window.ekran.isEkle({ baslik: $('isBaslik').value.trim(), baslangic: bas.toISOString(), sureDk: Number($('isSure').value) });
  $('isBaslik').value = '';
  takvimCiz();
});

baslat();
