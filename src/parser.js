export function parseHtml(html, pageUrl) {
  const clean = html.replace(/<!--[^]*?-->/g, " ");
  const title = decode(strip(first(clean, /<title\b[^>]*>([^]*?)<\/title>/i)));
  const descriptions = attrsFor(clean, "meta")
    .filter((a) => (a.name || "").toLowerCase() === "description")
    .map((a) => a.content || "").filter(Boolean);
  const robots = attrsFor(clean, "meta")
    .filter((a) => ["robots", "googlebot"].includes((a.name || "").toLowerCase()))
    .map((a) => a.content || "").join(", ").toLowerCase();
  const links = attrsFor(clean, "link");
  const canonicals = links.filter((a) => token(a.rel, "canonical")).map((a) => a.href).filter(Boolean);
  const hreflang = links.filter((a) => token(a.rel, "alternate") && a.hreflang).map((a) => ({ dil: a.hreflang, url: absolute(a.href, pageUrl) }));
  const anchors = attrsFor(clean, "a").map((a) => absolute(a.href, pageUrl)).filter(Boolean);
  const images = attrsFor(clean, "img").map((a) => ({ src: absolute(a.src, pageUrl), alt: a.alt, width: a.width, height: a.height }));
  const h1s = [...clean.matchAll(/<h1\b[^>]*>([^]*?)<\/h1>/gi)].map((m) => decode(strip(m[1]))).filter(Boolean);
  const headings = [...clean.matchAll(/<h([1-6])\b[^>]*>([^]*?)<\/h\1>/gi)].map((m) => ({ seviye: Number(m[1]), metin: decode(strip(m[2])) }));
  const htmlAttrs = parseAttrs(first(clean, /<html\b([^>]*)>/i));
  const jsonLd = [...clean.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)].map((m) => {
    try { return { gecerli: true, veri: JSON.parse(m[1]) }; }
    catch (error) { return { gecerli: false, hata: error.message }; }
  });
  const meta = attrsFor(clean, "meta");
  const visible = decode(strip(clean.replace(/<script\b[^]*?<\/script>/gi, " ").replace(/<style\b[^]*?<\/style>/gi, " ")));
  const words = visible.split(/\s+/).filter(Boolean);
  return {
    title,
    descriptions,
    robots,
    canonicals,
    hreflang,
    anchors: [...new Set(anchors)],
    images,
    h1s,
    headings,
    lang: htmlAttrs.lang || "",
    dir: htmlAttrs.dir || "",
    jsonLd,
    wordCount: words.length,
    visibleText: visible.slice(0, 5000),
    openGraph: meta.some((a) => (a.property || "").toLowerCase() === "og:image"),
    twitterCard: meta.some((a) => (a.name || "").toLowerCase() === "twitter:card"),
    verification: meta.filter((a) => /verification|verify/i.test(a.name || "")).map((a) => a.name),
    authorSignals: /\b(author|yazar|written by)\b/i.test(clean),
    dateSignals: /<time\b|datePublished|dateModified|yayın tarihi|güncellendi/i.test(clean),
    sourceSignals: /\b(kaynakça|kaynaklar|references|bibliography)\b/i.test(visible),
    organizationSignals: /Organization|LocalBusiness|kurumsal|hakkımızda|about us/i.test(clean)
  };
}

export function parseSitemap(xml) {
  const urls = [...xml.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map((m) => decode(m[1].trim()));
  const lastmods = [...xml.matchAll(/<lastmod\b[^>]*>([^<]+)<\/lastmod>/gi)].map((m) => m[1].trim());
  return { urls, lastmods, isIndex: /<sitemapindex\b/i.test(xml), valid: /<(urlset|sitemapindex)\b/i.test(xml) && urls.length > 0 };
}

export function sitemapLocations(robotsText) {
  return [...robotsText.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
}

function attrsFor(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))].map((m) => parseAttrs(m[1]));
}

function parseAttrs(raw = "") {
  const attrs = {};
  for (const match of raw.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function token(value = "", expected) { return value.toLowerCase().split(/\s+/).includes(expected); }
function first(value, regex) { return value.match(regex)?.[1] || ""; }
function strip(value = "") { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function decode(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function absolute(value, base) {
  if (!value || /^(mailto:|tel:|javascript:|data:)/i.test(value)) return "";
  try { const url = new URL(value, base); url.hash = ""; return url.href; } catch { return ""; }
}
