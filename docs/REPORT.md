# Rapor biçimi

Rapor üst düzeyde `surum`, `olusturuldu`, `hedef`, `ozet`, `puanlar`, `bulgular`, `sayfalar`, `yonlendirmeler`, `robots`, `sitemap`, `yapayZekaTarayicilari` ve `sinirlar` alanlarını içerir.

Her bulgu aşağıdaki kararlı biçimi kullanır:

```json
{
  "kod": "INDEX-NOINDEX",
  "kategori": "indekslenebilirlik",
  "seviye": "kritik",
  "baslik": "Sayfa noindex ile kapalı",
  "aciklama": "Canlı yanıtta noindex bulundu.",
  "kanit": { "url": "https://example.com", "bulunan": "noindex" },
  "etkisi": "Arama motoru bu sayfayı sonuçlarda göstermeyebilir.",
  "cozum": "Sayfanın görünmesi isteniyorsa noindex işaretini kaldırın.",
  "otomatikDuzeltilebilir": false,
  "kaynaklar": [{ "ad": "Google Search Central", "url": "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", "erisimTarihi": "2026-09-28" }]
}
```

Puanlar karşılaştırma ve önceliklendirme içindir; sıralama garantisi değildir. Kritik bir `noindex`, erişilememe veya yinelenen alan adı sorunu ilgili alan puanını üstten sınırlar.
