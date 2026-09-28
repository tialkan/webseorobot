import test from "node:test";
import assert from "node:assert/strict";
import { parseHtml, parseSitemap, sitemapLocations } from "../src/parser.js";
import { inspectBotRules } from "../src/bots.js";
import { isPrivateIp, normalizeTarget } from "../src/security.js";
import { calculateScores } from "../src/scoring.js";

test("HTML sinyallerini ayrıştırır", () => {
  const page = parseHtml(`<!doctype html><html lang="tr"><head><title>Örnek &amp; Test</title><meta name="description" content="Açıklama"><link rel="canonical" href="https://example.com/"><script type="application/ld+json">{"@type":"Organization"}</script></head><body><h1>Merhaba</h1><a href="/hakkimizda">Hakkımızda</a><img src="hero.png" alt=""></body></html>`, "https://example.com/");
  assert.equal(page.title, "Örnek & Test");
  assert.equal(page.lang, "tr");
  assert.deepEqual(page.canonicals, ["https://example.com/"]);
  assert.equal(page.anchors[0], "https://example.com/hakkimizda");
  assert.equal(page.jsonLd[0].gecerli, true);
});

test("şirket olmayan gerçek site ve kişi kimliğini varlık sinyali sayar", () => {
  const page = parseHtml(`<html lang="tr"><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Örnek"},{"@type":"Person","name":"Ada"}]}</script></head><body><a href="/">Örnek</a></body></html>`, "https://example.com/");
  assert.equal(page.organizationSignals, true);
});

test("sitemap ve robots sitemap satırlarını ayrıştırır", () => {
  assert.deepEqual(sitemapLocations("User-agent: *\nSitemap: https://a.test/sitemap.xml"), ["https://a.test/sitemap.xml"]);
  const result = parseSitemap(`<?xml version="1.0"?><urlset><url><loc>https://a.test/</loc></url></urlset>`);
  assert.equal(result.valid, true);
  assert.deepEqual(result.urls, ["https://a.test/"]);
});

test("bot gruplarını amaçlarına göre ve wildcard ile değerlendirir", () => {
  const bots = inspectBotRules("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /");
  assert.equal(bots.find((b) => b.ad === "GPTBot").durum, "engelli");
  assert.equal(bots.find((b) => b.ad === "OAI-SearchBot").durum, "izinli");
  assert.equal(bots.find((b) => b.ad === "OAI-SearchBot").grup, "arama");
});

test("özel IP aralıklarını engeller", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.2", "169.254.1.1", "::1", "fd00::1"]) assert.equal(isPrivateIp(ip), true, ip);
  assert.equal(isPrivateIp("1.1.1.1"), false);
  assert.equal(normalizeTarget("example.com").href, "https://example.com/");
  assert.throws(() => normalizeTarget("ftp://example.com"));
});

test("kritik noindex indekslenebilirlik puanını üstten sınırlar", () => {
  const scores = calculateScores([{ kod: "INDEX-NOINDEX", kategori: "indekslenebilirlik", seviye: "kritik" }]);
  assert.equal(scores.indekslenebilirlik, 20);
  assert.equal(scores.erisilebilirlik, 100);
});
