# Açılış Ekranı (sürüm 0.1)

Bilgisayar açılınca gelen ekran: saat saat bugünün takvimi, günün ayeti, çalışmayla ilgili bir hadis, her açılışta değişen İslam sanatı eseri ve "Hoş geldiniz" sesi.

## Hemen denemek (Windows)
1. `Acilis Ekrani-0.1.0-win.zip` dosyasını indir ve bir klasöre çıkar (ör. `Belgeler\AcilisEkrani`).
2. Klasördeki `Acilis Ekrani.exe` dosyasını çalıştır. Windows "bilinmeyen yayıncı" uyarısı verirse **Ek bilgi → Yine de çalıştır** de (uygulama imzalı değil).
3. İlk çalıştırmada kendini Windows açılışına ekler. Kapatmak için saatin yanındaki tepsi simgesine sağ tıklayıp **Bilgisayar açılınca başlat** işaretini kaldır.
4. Pencereyi kapatınca uygulama tepsiye iner ve hatırlatıcılar çalışmaya devam eder. Tamamen kapatmak için tepsi menüsünden **Çıkış**.

## Ne yapıyor
- **Takvim:** "Yeni iş ekle" alanına işi, saati ve süreyi yaz, + ile ekle. ✓ ile yapıldı işaretle, ✕ ile sil. İşler `%APPDATA%\AcilisEkrani\takvim.json` içinde saklanır.
- **Hatırlatıcı:** İşin saati gelince Windows bildirimi çıkar. Bitiş saatinden 15 dakika sonra hâlâ yapılmadıysa "Süresi geçti" bildirimi çıkar ve iş turuncu görünür.
- **Ayet:** `veri/ayetler.json` içinde çalışma, emek ve sabır üzerine 14 ayet var. Arapça metin, Tanzil Projesi'nin (tanzil.net) uzmanlarca doğrulanmış Uthmani metni; hiç değiştirilmeden kullanıldı. Meal, Diyanet İşleri meali (Tanzil'deki tr.diyanet). Mealin birden fazla ayeti birlikte çevirdiği yerler, Arapça ile meal birebir örtüşsün diye listeye alınmadı.
- **Hadis:** `veri/hadisler.json` içinde 7 hadis var (Arapça, Türkçe, kaynak). Hepsi `dogrulandi: false`; Diyanet'in "Hadislerle İslam" eseriyle kontrol edilmeli.
- **Arka plan:** `gorseller/` klasöründe Metropolitan Sanat Müzesi'nin İslam Sanatı bölümünden 39 açık erişim (CC0) eser var. Her açılışta bir öncekinden farklı biri seçilir.
- **Ses:** `ses/hos-geldiniz.mp3` ("Hoş geldin patron"), Microsoft'un Türkçe nöral sesi (Ahmet) ile üretildi, hafif yankı eklendi. %50 seviyede çalar.

## Sesli asistan
- Sağ alttaki mikrofon düğmesine bas (ya da Ctrl+Boşluk) ve konuş; susunca kendiliğinden dinlemeyi bırakır. ⌨ düğmesiyle yazarak da sorabilirsin.
- Konuşma bilgisayarda yazıya çevrilir (Whisper small, ilk kullanımda ~250 MB indirilir, `%APPDATA%\AcilisEkrani\modeller`).
- Cevapları Claude verir; takvime bakabilir, iş ekleyebilir, işi yapıldı işaretleyebilir. İlk kullanımda Claude API anahtarı sorulur; anahtar Windows şifrelemesiyle yalnızca bu bilgisayarda saklanır.
- Cevaplar Türkçe nöral sesle (Ahmet) okunur.
- "Chrome'u aç", "YouTube'u aç", "Word'ü aç", "indirilenleri aç" gibi komutlar anında yapılır (API anahtarı gerekmez). Programlar Başlat menüsündeki kısayollardan bulunur; yalnızca yüklü programlar, web siteleri ve bilinen klasörler açılabilir. "Şunu Google'da ara" gibi daha serbest istekleri Claude anlayıp yapar.

## Koddan çalıştırmak (geliştirme)
Node.js 20+ kurulu olmalı.
```
npm install
npm start          # uygulamayı aç
npm run paketle    # Windows kurulum dosyası (dist klasörüne)
```

## Sonraki adımlar
- Ayet listesini genişletmek
- Google Takvim senkronu (telefona bildirim)
- İstenirse kişisel karşılama: "Hoş geldiniz Sema, bugün 3 işin var"
