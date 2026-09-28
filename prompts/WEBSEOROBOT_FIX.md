# WebSEORobot düzeltme istemi

Aşağıdaki WebSEORobot raporunu mevcut web projesinde uygula.

Önce repodaki `AGENTS.md`, README, paket dosyaları, framework sürümü ve yerel framework belgelerini incele. Kullanıcının ilgisiz değişikliklerini koru. Her bulguyu canlı HTTP davranışıyla yeniden doğrula; yalnızca kaynak kodda doğru görünmesini başarı sayma.

Kurallar:

1. Bulguları kritik, yüksek, orta, düşük sırasıyla ele al.
2. HTTP/HTTPS ve www/çıplak alan adı yönlendirmelerinde yol ile sorgu dizesini koru.
3. Canonical, sitemap, hreflang ve iç bağlantı sinyallerini aynı tercih edilen adresle uyumlu tut.
4. Olmayan dil sayfası, kurum bilgisi, adres, telefon, yazar, tarih, değerlendirme veya schema verisi uydurma.
5. `robots.txt` izninin dizine alınma garantisi olmadığını; canonical işaretinin de sunucu yönlendirmesinin yerine geçmediğini kabul et.
6. Yapay zekâ tarayıcılarında arama/kaynak gösterme, kullanıcı adına erişim ve model geliştirme tercihlerini birbirine karıştırma.
7. `llms.txt` dosyasını temel SEO’nun yerine koyma ve resmî sıralama standardı gibi sunma.
8. İlgili testleri çalıştır; mümkünse yayımlanan önizlemenin canlı HTTP yanıtlarını tekrar denetle.

Teslimde her bulgu için değişen dosyayı, yapılan düzeltmeyi ve canlı doğrulama sonucunu kısa bir tabloda göster. Düzeltilemeyen bulguları gerekçesiyle açıkça bırak.

## Rapor

Buraya WebSEORobot JSON raporunu yapıştırın.
