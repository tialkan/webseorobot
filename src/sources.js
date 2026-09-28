export const ERISIM_TARIHI = "2026-09-28";

export const SOURCES = {
  robots: source("Google — robots.txt giriş", "https://developers.google.com/search/docs/crawling-indexing/robots/intro"),
  robotsMeta: source("Google — robots meta ve X-Robots-Tag", "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"),
  canonical: source("Google — canonical URL belirtme", "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"),
  sitemap: source("Google — sitemap hakkında", "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"),
  hreflang: source("Google — yerelleştirilmiş sürümler", "https://developers.google.com/search/docs/specialty/international/localized-versions"),
  structured: source("Google — yapılandırılmış veri ilkeleri", "https://developers.google.com/search/docs/appearance/structured-data/sd-policies"),
  openaiBots: source("OpenAI — crawler kullanıcı ajanları", "https://platform.openai.com/docs/bots"),
  indexNow: source("IndexNow protokolü", "https://www.indexnow.org/documentation"),
  sitemapProtocol: source("Sitemaps protokolü", "https://www.sitemaps.org/protocol.html")
};

function source(ad, url) {
  return { ad, url, erisimTarihi: ERISIM_TARIHI };
}
