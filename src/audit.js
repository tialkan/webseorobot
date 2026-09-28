import { normalizeTarget, assertPublicUrl } from "./security.js";
import { safeFetch, tryFetch } from "./http.js";
import { parseHtml, parseSitemap, sitemapLocations } from "./parser.js";
import { inspectBotRules } from "./bots.js";
import { calculateScores } from "./scoring.js";
import { SOURCES } from "./sources.js";

const MAX_PAGES = Math.min(20, Math.max(1, Number(process.env.AUDIT_MAX_PAGES || 8)));
const SEVERITY_ORDER = { "kritik": 0, "yüksek": 1, "orta": 2, "düşük": 3, "bilgi": 4 };

export async function auditSite(input, options = {}) {
  const started = Date.now();
  const target = normalizeTarget(input);
  await assertPublicUrl(target);
  const findings = [];
  const main = await tryFetch(target.href);
  if (!main.ok) {
    findings.push(finding("HTTP-UNREACHABLE", "erişilebilirlik", "kritik", "Siteye ulaşılamadı", main.error, target.href, undefined, "Tarama ve dizine alma başlayamaz.", "DNS, TLS, sunucu ve güvenlik duvarı kayıtlarını kontrol edin.", [SOURCES.robots]));
    return finalize({ target, main: null, findings, pages: [], variants: [], robots: null, sitemap: null, llms: [], started });
  }

  const canonicalBase = new URL(main.result.url);
  const variantsPromise = inspectVariants(canonicalBase, findings);
  const robotsPromise = inspectRobots(canonicalBase, findings);
  const llmsPromise = inspectLlms(canonicalBase);
  const parsedHome = parseHtml(main.result.body, main.result.url);
  const pages = [];
  inspectPage(main.result, parsedHome, findings);
  pages.push(pageSummary(main.result, parsedHome));

  const robots = await robotsPromise;
  const sitemap = await inspectSitemap(canonicalBase, robots, findings, options.maxSitemapUrls || 12);
  const crawlCandidates = collectCrawlCandidates(canonicalBase, parsedHome, sitemap, options.maxPages || MAX_PAGES);
  for (const url of crawlCandidates) {
    const fetched = await tryFetch(url);
    if (!fetched.ok) {
      findings.push(finding("PAGE-UNREACHABLE", "erişilebilirlik", "yüksek", "İç sayfaya ulaşılamadı", fetched.error, url, undefined, "Önemli içerik taranamayabilir.", "Bağlantıyı, sunucu yanıtını ve TLS yapılandırmasını kontrol edin.", [SOURCES.robots]));
      continue;
    }
    if (!/text\/html|application\/xhtml/i.test(fetched.result.headers["content-type"] || "")) continue;
    const parsed = parseHtml(fetched.result.body, fetched.result.url);
    inspectPage(fetched.result, parsed, findings);
    pages.push(pageSummary(fetched.result, parsed));
  }
  inspectDuplicates(pages, findings);
  const [variants, llms] = await Promise.all([variantsPromise, llmsPromise]);
  inspectVariantConsistency(variants, findings);
  inspectEvidenceSignals(pages, findings);
  return finalize({ target, main: main.result, findings, pages, variants, robots, sitemap, llms, started });
}

async function inspectRobots(base, findings) {
  const url = new URL("/robots.txt", base).href;
  const attempt = await tryFetch(url, { maxBytes: 500_000 });
  if (!attempt.ok || attempt.result.status !== 200) {
    findings.push(finding("ROBOTS-MISSING", "indekslenebilirlik", "düşük", "robots.txt bulunamadı", attempt.ok ? `HTTP ${attempt.result.status}` : attempt.error, url, undefined, "Tarayıcı tercihleri merkezi olarak açıklanamıyor; bu tek başına indeksleme hatası değildir.", "Taranmasını istemediğiniz yollar veya sitemap bildirimi varsa geçerli bir robots.txt yayımlayın.", [SOURCES.robots]));
    return { url, status: attempt.ok ? attempt.result.status : null, text: "", sitemaps: [], botlar: inspectBotRules("") };
  }
  const text = attempt.result.body;
  return { url, status: 200, text, sitemaps: sitemapLocations(text), botlar: inspectBotRules(text) };
}

async function inspectSitemap(base, robots, findings, sampleLimit) {
  const candidates = robots?.sitemaps?.length ? robots.sitemaps : [new URL("/sitemap.xml", base).href];
  const sitemapUrl = candidates[0];
  const attempt = await tryFetch(sitemapUrl, { maxBytes: 2_000_000 });
  if (!attempt.ok || attempt.result.status !== 200) {
    findings.push(finding("SITEMAP-MISSING", "indekslenebilirlik", "orta", "Sitemap bulunamadı", attempt.ok ? `HTTP ${attempt.result.status}` : attempt.error, sitemapUrl, undefined, "Arama motorlarının önemli adresleri keşfetmesi zorlaşabilir.", "Kanonik ve indekslenebilir URL’leri içeren bir sitemap yayımlayın; robots.txt içinde bildirin.", [SOURCES.sitemap]));
    return { url: sitemapUrl, status: attempt.ok ? attempt.result.status : null, valid: false, totalUrls: 0, sampledUrls: [] };
  }
  const parsed = parseSitemap(attempt.result.body);
  if (!parsed.valid) findings.push(finding("SITEMAP-INVALID", "indekslenebilirlik", "yüksek", "Sitemap geçerli görünmüyor", "urlset/sitemapindex veya loc kayıtları bulunamadı", sitemapUrl, undefined, "Adreslerin keşfi ve izlenmesi aksayabilir.", "XML’i sitemap protokolüne göre doğrulayın.", [SOURCES.sitemapProtocol]));
  const duplicates = parsed.urls.filter((u, i, arr) => arr.indexOf(u) !== i);
  if (duplicates.length) findings.push(finding("SITEMAP-DUPLICATE", "kanoniklik", "düşük", "Sitemap yinelenen adresler içeriyor", `${duplicates.length} yinelenen kayıt`, sitemapUrl, duplicates.slice(0, 3).join(", "), "Tarama sinyalleri gereksiz yere tekrarlanır.", "Her kanonik adresi yalnızca bir kez listeleyin.", [SOURCES.sitemap]));
  const mixed = parsed.urls.filter((u) => { try { const x = new URL(u); return x.protocol !== base.protocol || x.hostname !== base.hostname; } catch { return true; } });
  if (mixed.length) findings.push(finding("SITEMAP-MIXED-HOST", "kanoniklik", "yüksek", "Sitemap farklı protokol veya alan adı içeriyor", `${mixed.length} kayıt tercih edilen kökle uyuşmuyor`, sitemapUrl, mixed.slice(0, 3).join(", "), "Kanonik tercih bulanıklaşır.", "Sitemap’e yalnızca tercih edilen HTTPS/alan adı sürümünü yazın.", [SOURCES.sitemap]));
  const sampledUrls = parsed.urls.slice(0, sampleLimit);
  return { url: sitemapUrl, status: 200, valid: parsed.valid, isIndex: parsed.isIndex, totalUrls: parsed.urls.length, sampledUrls, sampleLimit };
}

async function inspectVariants(base, findings) {
  const naked = base.hostname.replace(/^www\./i, "");
  const hosts = [naked, `www.${naked}`];
  const urls = [...new Set(hosts.flatMap((host) => [`http://${host}/`, `https://${host}/`]))];
  return Promise.all(urls.map(async (url) => {
    const attempt = await tryFetch(url, { maxBytes: 600_000 });
    return attempt.ok ? { giris: url, durumKodu: attempt.result.chain[0]?.durumKodu, son: attempt.result.url, zincir: attempt.result.chain, imza: contentSignature(attempt.result.body), hsts: Boolean(attempt.result.headers["strict-transport-security"]) } : { giris: url, hata: attempt.error };
  }));
}

function inspectVariantConsistency(variants, findings) {
  for (const variant of variants) {
    if (!variant.zincir) continue;
    if (variant.giris.startsWith("http://") && new URL(variant.son).protocol !== "https:") findings.push(finding("HTTPS-NO-REDIRECT", "erisilebilirlik", "yüksek", "HTTP sürümü HTTPS’e geçmiyor", `Son hedef: ${variant.son}`, variant.giris, variant.durumKodu, "Güvenli ve tekil adres sinyali zayıflar.", "HTTP isteklerini tek adımda kalıcı olarak HTTPS’e yönlendirin.", [SOURCES.canonical]));
    if (variant.zincir.length > 2) findings.push(finding("REDIRECT-CHAIN", "erisilebilirlik", "orta", "Gereksiz yönlendirme zinciri", `${variant.zincir.length - 1} yönlendirme`, variant.giris, variant.durumKodu, "Tarama gecikir ve hata olasılığı artar.", "İlk adresi doğrudan nihai kanonik adrese yönlendirin.", [SOURCES.canonical]));
    const temporary = variant.zincir.slice(0, -1).find((x) => [302, 307].includes(x.durumKodu));
    if (temporary) findings.push(finding("REDIRECT-TEMPORARY", "kanoniklik", "orta", "Kanonik yönlendirmede geçici durum kodu", `HTTP ${temporary.durumKodu}`, temporary.url, temporary.durumKodu, "Kalıcı adres tercihi daha zayıf ifade edilir.", "Kalıcı taşımalarda 301 veya 308 kullanın.", [SOURCES.canonical]));
  }
  const direct200 = variants.filter((v) => v.durumKodu === 200 && v.zincir?.length === 1);
  const duplicatePair = direct200.some((a) => direct200.some((b) => a !== b && new URL(a.giris).hostname !== new URL(b.giris).hostname && a.imza && a.imza === b.imza));
  if (duplicatePair) findings.push(finding("DOMAIN-DUPLICATE", "kanoniklik", "kritik", "www ve çıplak alan adı aynı içeriği 200 ile sunuyor", "İki alan adı sürümü de yönlenmeden başarılı", direct200[0].giris, 200, "Aynı içerik birden fazla ana adresle tanınabilir.", "Tek sürümü seçin; diğerini her yol ve sorguyu koruyarak 301/308 ile yönlendirin.", [SOURCES.canonical]));
  const secureFinal = variants.find((v) => v.son?.startsWith("https://") && v.zincir?.at(-1)?.durumKodu === 200);
  if (secureFinal && !secureFinal.hsts) findings.push(finding("HSTS-MISSING", "erisilebilirlik", "düşük", "HSTS başlığı bulunamadı", "Strict-Transport-Security yok", secureFinal.son, 200, "Tarayıcı ilk bağlantıda HTTP kullanabilir.", "HTTPS yapılandırması doğrulandıktan sonra uygun bir HSTS başlığı ekleyin.", []));
}

function inspectPage(response, page, findings) {
  const url = response.url;
  if (response.status !== 200) findings.push(finding("PAGE-STATUS", "erisilebilirlik", response.status >= 500 ? "kritik" : "yüksek", "Sayfa 200 yanıtı vermiyor", `HTTP ${response.status}`, url, response.status, "Sayfa taranamayabilir veya dizine alınmayabilir.", "Sunucu durumunu ve yönlendirmeleri düzeltin.", [SOURCES.robots]));
  const robotHeader = response.headers["x-robots-tag"] || "";
  if (/noindex/i.test(`${page.robots},${robotHeader}`)) findings.push(finding("INDEX-NOINDEX", "indekslenebilirlik", "kritik", "Sayfa noindex ile kapalı", `meta=${page.robots || "yok"}; X-Robots-Tag=${robotHeader || "yok"}`, url, response.status, "Arama motoru sayfayı sonuçlarda göstermeyebilir.", "Görünmesi isteniyorsa noindex işaretini kaldırın; robots.txt erişimini de koruyun.", [SOURCES.robotsMeta]));
  if (!page.title) findings.push(finding("TITLE-MISSING", "anlasilabilirlik", "yüksek", "Sayfa başlığı eksik", "<title> bulunamadı", url, response.status, "Sonucun konusu arama motoru ve kullanıcı için belirsizleşir.", "Sayfanın amacını doğal biçimde anlatan özgün bir title yazın.", []));
  else if (page.title.length > 65) findings.push(finding("TITLE-LONG", "anlasilabilirlik", "düşük", "Sayfa başlığı kesilme riski taşıyor", `${page.title.length} karakter: ${page.title}`, url, response.status, "Arama sonucunda anlamın önemli kısmı görünmeyebilir.", "Karakter sayısını mutlak kural saymadan en önemli anlamı başa taşıyın.", []));
  if (!page.descriptions.length) findings.push(finding("DESCRIPTION-MISSING", "anlasilabilirlik", "orta", "Meta açıklaması eksik", "description bulunamadı", url, response.status, "Arama sonucu özeti sayfayı daha az açık anlatabilir.", "Sayfanın gerçek değerini özetleyen özgün bir açıklama yazın.", []));
  if (!page.h1s.length) findings.push(finding("H1-MISSING", "anlasilabilirlik", "orta", "Ana başlık bulunamadı", "H1 bulunamadı", url, response.status, "Sayfanın ana konusu yeterince açık olmayabilir.", "İçeriği doğru anlatan tek, görünür bir ana başlık ekleyin.", []));
  if (page.h1s.length > 1) findings.push(finding("H1-MULTIPLE", "anlasilabilirlik", "düşük", "Birden fazla ana başlık var", `${page.h1s.length} H1`, url, response.status, "Bilgi hiyerarşisi bulanıklaşabilir.", "Başlık hiyerarşisini içerik yapısına göre gözden geçirin.", []));
  if (!page.lang) findings.push(finding("LANG-MISSING", "anlasilabilirlik", "orta", "HTML dil bilgisi eksik", "html[lang] bulunamadı", url, response.status, "Dil ve erişilebilirlik araçları sayfayı yanlış yorumlayabilir.", "Gerçek içerik dilini geçerli bir BCP 47 koduyla belirtin.", [SOURCES.hreflang]));
  if (!page.canonicals.length) findings.push(finding("CANONICAL-MISSING", "kanoniklik", "orta", "Canonical işareti eksik", "rel=canonical bulunamadı", url, response.status, "Tercih edilen adres daha az açık ifade edilir.", "Kendine işaret eden mutlak canonical ekleyin ve sunucu yönlendirmeleriyle uyumlu tutun.", [SOURCES.canonical]));
  if (page.canonicals.length > 1) findings.push(finding("CANONICAL-MULTIPLE", "kanoniklik", "yüksek", "Birden fazla canonical bulundu", page.canonicals.join(", "), url, response.status, "Kanonik adres sinyalleri çelişir.", "HTML ve HTTP başlığında tek, uyumlu canonical bırakın.", [SOURCES.canonical]));
  for (const canonical of page.canonicals) {
    let resolved;
    try { resolved = new URL(canonical, url); } catch { resolved = null; }
    if (!resolved || !/^https?:$/.test(resolved.protocol)) findings.push(finding("CANONICAL-INVALID", "kanoniklik", "yüksek", "Canonical adresi geçersiz", canonical, url, response.status, "Tercih edilen adres okunamaz.", "Mutlak ve erişilebilir bir HTTP(S) URL kullanın.", [SOURCES.canonical]));
    else if (!/^https?:\/\//i.test(canonical)) findings.push(finding("CANONICAL-RELATIVE", "kanoniklik", "orta", "Canonical mutlak değil", canonical, url, response.status, "Farklı yorumlama riski oluşur.", "Protokol ve alan adı içeren mutlak adres kullanın.", [SOURCES.canonical]));
  }
  const invalidJson = page.jsonLd.filter((x) => !x.gecerli);
  if (invalidJson.length) findings.push(finding("JSONLD-INVALID", "anlasilabilirlik", "yüksek", "JSON-LD ayrıştırılamıyor", invalidJson[0].hata, url, response.status, "Yapılandırılmış veri kullanılamaz.", "JSON sözdizimini düzeltin; yalnızca sayfada görünen gerçek bilgileri işaretleyin.", [SOURCES.structured]));
  const meaningfulImages = page.images.filter((img) => img.alt === undefined || img.alt === null);
  if (meaningfulImages.length) findings.push(finding("IMAGE-ALT-MISSING", "anlasilabilirlik", "orta", "Alt niteliği eksik görseller var", `${meaningfulImages.length} görsel`, url, response.status, "Görseller erişilebilirlik araçları ve arama için açıklanamaz.", "Anlamlı görsellere bağlama uygun alt metni, dekoratiflere boş alt niteliği ekleyin.", []));
  if (!page.openGraph) findings.push(finding("OG-IMAGE-MISSING", "anlasilabilirlik", "düşük", "Open Graph görseli bulunamadı", "og:image yok", url, response.status, "Paylaşım önizlemesi görselsiz veya rastgele olabilir.", "Erişilebilir, mutlak adresli ve sayfayı temsil eden bir og:image ekleyin.", []));
  if (page.wordCount < 80) findings.push(finding("CONTENT-THIN", "ozgunluk", "orta", "Sayfa çok az metin içeriyor", `${page.wordCount} kelime`, url, response.status, "Sayfanın sunduğu değer ve bağlam yeterince anlaşılmayabilir.", "Kullanıcıya gerçek katkı sağlayan özgün bilgi ekleyin; otomatik kelime doldurmayın.", []));
}

function inspectDuplicates(pages, findings) {
  const byTitle = groupDuplicates(pages, (p) => p.title?.toLowerCase());
  for (const group of byTitle) findings.push(finding("TITLE-DUPLICATE", "anlasilabilirlik", "orta", "Aynı başlık birden fazla sayfada kullanılıyor", group.map((p) => p.url).join(", "), group[0].url, group[0].status, "Sayfalar arası anlam farkı zayıflar.", "Her sayfanın özgün amacını title içinde açıkça anlatın.", []));
  const byDescription = groupDuplicates(pages, (p) => p.description?.toLowerCase());
  for (const group of byDescription) findings.push(finding("DESCRIPTION-DUPLICATE", "anlasilabilirlik", "düşük", "Aynı açıklama birden fazla sayfada kullanılıyor", `${group.length} sayfa`, group[0].url, group[0].status, "Arama önizlemeleri sayfaları ayırt edemez.", "Açıklamayı her sayfanın gerçek içeriğine göre özgünleştirin.", []));
}

function inspectEvidenceSignals(pages, findings) {
  const home = pages[0];
  if (!home) return;
  if (!home.organizationSignals) findings.push(finding("ENTITY-UNCLEAR", "kanitlanabilirlik", "orta", "Kurum kimliği açık değil", "Organization/LocalBusiness veya belirgin kurumsal bağlantı sinyali bulunamadı", home.url, home.status, "Kaynak gösteren sistemler içeriği doğru varlıkla ilişkilendirmekte zorlanabilir.", "Gerçek ticari adı, iletişim/hukuki kimliği ve uygun olduğunda bunlarla uyumlu Organization türünü açıkça gösterin.", [SOURCES.structured]));
  if (!pages.some((p) => p.sourceSignals)) findings.push(finding("SOURCES-UNCLEAR", "kanitlanabilirlik", "düşük", "Kaynak gösterme sinyali bulunamadı", "İncelenen sayfalarda kaynakça/kaynaklar işareti yok", home.url, home.status, "Büyük iddiaların doğrulanması zorlaşabilir.", "Kaynak gerektiren iddiaları birincil kaynaklara bağlayın; her sayfaya yapay bir kaynakça eklemeyin.", []));
  if (!pages.some((p) => p.authorSignals || p.dateSignals)) findings.push(finding("AUTHOR-DATE-UNCLEAR", "kanitlanabilirlik", "düşük", "Yazar veya tarih sinyali bulunamadı", "İncelenen örnekte yazar/yayın/güncelleme işareti yok", home.url, home.status, "Tarihe ve uzmanlığa bağlı içeriklerin güvenilirliği değerlendirilemez.", "Gereken içeriklerde gerçek yazar, yayın ve güncelleme tarihini görünür biçimde belirtin.", []));
}

async function inspectLlms(base) {
  return Promise.all(["/llms.txt", "/llms-full.txt"].map(async (path) => {
    const url = new URL(path, base).href;
    const attempt = await tryFetch(url, { maxBytes: 500_000 });
    return attempt.ok ? { url, durumKodu: attempt.result.status, var: attempt.result.status === 200, contentType: attempt.result.headers["content-type"], boyut: attempt.result.body.length } : { url, var: false, hata: attempt.error };
  }));
}

function collectCrawlCandidates(base, home, sitemap, maxPages) {
  const candidates = [...(sitemap?.sampledUrls || []), ...home.anchors];
  return [...new Set(candidates)].filter((href) => { try { const url = new URL(href); return url.origin === base.origin && /^https?:$/.test(url.protocol) && !/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3)$/i.test(url.pathname) && url.pathname !== base.pathname; } catch { return false; } }).slice(0, Math.max(0, maxPages - 1));
}

function pageSummary(response, page) {
  return { url: response.url, status: response.status, title: page.title, description: page.descriptions[0] || "", canonical: page.canonicals[0] || "", lang: page.lang, wordCount: page.wordCount, h1Count: page.h1s.length, structuredDataBlocks: page.jsonLd.length, authorSignals: page.authorSignals, dateSignals: page.dateSignals, sourceSignals: page.sourceSignals, organizationSignals: page.organizationSignals };
}

function finalize({ target, main, findings, pages, variants, robots, sitemap, llms, started }) {
  const unique = [...new Map(findings.map((f) => [`${f.kod}:${f.kanit.url}:${f.kanit.bulunan || ""}`, f])).values()].sort((a, b) => SEVERITY_ORDER[a.seviye] - SEVERITY_ORDER[b.seviye]);
  return {
    surum: "0.1.0",
    olusturuldu: new Date().toISOString(),
    hedef: { girilen: target.href, son: main?.url || null },
    ozet: { sureMs: Date.now() - started, incelenenSayfa: pages.length, bulgu: unique.length, kritik: unique.filter((f) => f.seviye === "kritik").length, yuksek: unique.filter((f) => f.seviye === "yüksek").length },
    puanlar: calculateScores(unique),
    bulgular: unique,
    sayfalar: pages,
    yonlendirmeler: variants,
    robots,
    sitemap,
    yapayZekaTarayicilari: robots?.botlar || inspectBotRules(""),
    llms,
    sinirlar: ["JavaScript çalıştırılmaz.", `En fazla ${MAX_PAGES} sayfa incelenir.`, "İçerik doğruluğu ve özgünlüğü için insan incelemesi gerekir.", "llms.txt resmî bir sıralama standardı değildir.", "Rapor sıralama veya dizine alınma garantisi vermez."]
  };
}

function finding(kod, kategori, seviye, baslik, bulunan, url, durumKodu, etkisi, cozum, kaynaklar) {
  return { kod, kategori, seviye, baslik, aciklama: `${bulunan}. Bu bulgu canlı yanıt veya sayfa kaynağındaki kanıta dayanır.`, kanit: { url, ...(durumKodu ? { durumKodu } : {}), bulunan }, etkisi, cozum, otomatikDuzeltilebilir: false, kaynaklar };
}

function groupDuplicates(items, getter) {
  const map = new Map();
  for (const item of items) { const key = getter(item); if (key) map.set(key, [...(map.get(key) || []), item]); }
  return [...map.values()].filter((group) => group.length > 1);
}

function contentSignature(body = "") { return body.replace(/\s+/g, " ").replace(/\d{4}-\d{2}-\d{2}[^<\s]*/g, "").slice(0, 50_000); }
