import { tryFetch } from "./http.js";

const MAX_LINKS = 8;

export function linkCandidates(base, parsedPages, checkedUrls = [], limit = MAX_LINKS) {
  const seen = new Set(checkedUrls);
  const candidates = [];
  for (const page of parsedPages) for (const href of page.anchors) {
    let url;
    try { url = new URL(href); } catch { continue; }
    if (url.origin !== base.origin || !/^https?:$/.test(url.protocol) || seen.has(url.href)) continue;
    if (/\.(?:pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|css|js)$/i.test(url.pathname)) continue;
    seen.add(url.href); candidates.push(url.href);
    if (candidates.length >= limit) return candidates;
  }
  return candidates;
}

export async function inspectLinks(urls, fetcher = tryFetch) {
  const results = [];
  for (const url of urls) {
    const attempt = await fetcher(url, { maxBytes: 1_000_000, timeout: 6_000 });
    results.push(attempt.ok
      ? { url, son: attempt.result.url, durumKodu: attempt.result.status, durum: [404, 410].includes(attempt.result.status) ? "kırık" : attempt.result.status >= 400 ? "belirsiz" : "çalışıyor" }
      : { url, durum: "doğrulanamadı", hata: attempt.error });
  }
  return results;
}
