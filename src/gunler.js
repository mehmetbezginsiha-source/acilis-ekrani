// Günün anlam ve önemini bulur (Hicrî takvim: Ümmü'l-Kurâ hesabı).
// Not: Diyanet'in takvimi bazı yıllarda bir gün farklı olabilir.
const AYLAR = ['Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir', 'Cemaziyelevvel', 'Cemaziyelahir', 'Recep', 'Şaban', 'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'];

function hicri(tarih) {
  const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(tarih);
  const al = (t) => Number(p.find((x) => x.type === t)?.value.replace(/\D/g, ''));
  return { gun: al('day'), ay: al('month'), yil: al('year') };
}

function gunEkle(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d; }

// Önem sırasına göre bugünün özel durumları: [{ anahtar, yazi }]
function ozelGunler(bugun = new Date()) {
  const h = hicri(bugun);
  const yarin = hicri(gunEkle(bugun, 1));
  const l = [];
  const ekle = (anahtar, yazi) => l.push({ anahtar, yazi });

  // Kandiller: gecesi, Hicrî günün başladığı akşamdır; yani bir önceki gün kutlanır
  if (yarin.ay === 3 && yarin.gun === 12) ekle('mevlid', 'Mevlid Kandiliniz mübarek olsun');
  if (bugun.getDay() === 4 && yarin.ay === 7 && yarin.gun <= 7) ekle('regaip', 'Regaip Kandiliniz mübarek olsun');
  if (yarin.ay === 7 && yarin.gun === 27) ekle('mirac', 'Mirac Kandiliniz mübarek olsun');
  if (yarin.ay === 8 && yarin.gun === 15) ekle('berat', 'Berat Kandiliniz mübarek olsun');
  if (yarin.ay === 9 && yarin.gun === 27) ekle('kadir', 'Kadir Geceniz mübarek olsun');
  if (h.ay === 10 && h.gun <= 3) ekle('ramazanBayrami', `Ramazan Bayramı${h.gun > 1 ? ` ${h.gun}. gün` : ''} · Bayramınız mübarek olsun`);
  if (h.ay === 12 && h.gun === 9) ekle('arefe', 'Kurban Bayramı arefesi');
  if (h.ay === 12 && h.gun >= 10 && h.gun <= 13) ekle('kurbanBayrami', `Kurban Bayramı ${h.gun - 9}. gün · Bayramınız mübarek olsun`);
  if (h.ay === 1 && h.gun === 1) ekle('hicriYilbasi', `Hicrî ${h.yil} yılınız hayırlı olsun`);
  if (h.ay === 1 && h.gun === 10) ekle('asure', 'Aşure Günü');
  if (h.ay === 9) ekle('ramazan', `Ramazan'ın ${h.gun}. günü`);
  if (bugun.getDay() === 5) ekle('cuma', 'Hayırlı Cumalar');
  return { hicri: { ...h, ayAdi: AYLAR[h.ay - 1] }, ozel: l };
}

// Özel güne uygun olanlardan, yoksa genel listeden rastgele seçer
function sec(liste, ozel) {
  if (!liste?.length) return null;
  for (const o of ozel) {
    const uygun = liste.filter((x) => (x.etiketler || []).includes(o.anahtar));
    if (uygun.length) return uygun[Math.floor(Math.random() * uygun.length)];
  }
  const genel = liste.filter((x) => !(x.etiketler || []).length);
  const havuz = genel.length ? genel : liste;
  return havuz[Math.floor(Math.random() * havuz.length)];
}

module.exports = { ozelGunler, sec, hicri };
