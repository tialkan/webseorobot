# WebSEORobot

WebSEORobot, bir internet sitesinin arama motorları ve kaynak gösteren yapay zekâ sistemleri tarafından bulunabilirliğini **canlı HTTP davranışına bakarak** denetleyen açık kaynak araçtır.

Bir “Google’da birinci olma” vaadi ya da uydurma bir AI görünürlük puanı sunmaz. Yönlendirme, indekslenebilirlik, canonical, sitemap, içerik, yapılandırılmış veri ve yapay zekâ tarayıcı tercihlerini kanıtlarıyla inceler; düzeltmeleri önem sırasına koyar.

**Kolay kullanım, yöntem ve sonuçların nasıl okunacağı:** [tezatlas.com/webseorobot](https://tezatlas.com/webseorobot)

**Kaynak kod ve katkı:** [github.com/tialkan/webseorobot](https://github.com/tialkan/webseorobot)

## Hızlı başlangıç

Node.js 20.11 veya üstü yeterlidir; çalışma zamanı bağımlılığı yoktur.

```bash
npm start
# http://localhost:3000/webseorobot
```

Komut satırından:

```bash
node bin/webseorobot.js https://example.com --format json
node bin/webseorobot.js https://example.com --format markdown --output rapor.md
```

## Neleri denetler?

- HTTP/HTTPS ve `www`/çıplak alan adı yönlendirmeleri
- `robots.txt`, meta robots ve `X-Robots-Tag`
- Canonical işaretleri ve canlı hedef davranışı
- Sitemap varlığı, geçerliliği ve sınırlı URL örneklemi
- En fazla sekiz ek iç bağlantıda canlı 404/410 kontrolü (403/429 ve ağ hataları kırık sayılmaz)
- Başlıklar, açıklamalar, H1 yapısı, dil ve hreflang işaretleri
- JSON-LD, sosyal paylaşım etiketleri ve görsel alt metinleri
- Arama, kullanıcı adına erişim ve model geliştirme botları için robots tercihleri
- `llms.txt` ve `llms-full.txt` (yardımcı kaynak; resmî sıralama standardı değildir)
- Kurum kimliği, yazar/tarih/kaynak işaretleri gibi kaynak olmaya elverişlilik sinyalleri

Sonuç altı bağımsız alanda açıklanır: erişilebilirlik, indekslenebilirlik, kanoniklik, anlaşılabilirlik, kanıtlanabilirlik ve özgünlük. Ağırlıklar [`src/scoring.js`](src/scoring.js) içinde açıktır.

## API

```bash
curl -X POST http://localhost:3000/webseorobot/api/audit \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

API ile CLI aynı denetim motorunu kullanır. JSON rapor şeması [`docs/REPORT.md`](docs/REPORT.md) içinde açıklanır.

## Güvenlik ve sınırlar

Kullanıcı girdisi sunucudan istek başlattığı için yerel, özel ve bağlantı-yerel IP aralıkları engellenir; her yönlendirme yeniden doğrulanır, yalnızca 80/443 portlarına izin verilir, yanıt boyutu ve süre sınırlandırılır. Üretimde yine de uygulamayı ağ seviyesinde egress kuralları, oran sınırlama ve ayrıcalıksız bir çalışma ortamıyla koruyun. Ayrıntı: [SECURITY.md](SECURITY.md).

Araç JavaScript çalıştırmaz ve erişim gerektiren sayfalara giriş yapmaz. İçerik doğruluğu, özgünlük ve yapılandırılmış verinin gerçek dünyayla uyuşması gibi konularda otomatik bulgular kesin hüküm değil, insan incelemesine başlangıçtır.

## Katkı

Hata bildirimi ve küçük, odaklı pull request’ler memnuniyetle karşılanır. Yeni bir kural eklerken:

1. Canlı HTTP kanıtını rapora ekleyin.
2. Kullanıcıya etkisini sade dille açıklayın.
3. Birincil ve güncel kaynağı bulguya bağlayın.
4. Başarı ve hata senaryosu için test ekleyin.

## Lisans

[MIT](LICENSE) · TezAtlas’ın açık kaynak projesi.
