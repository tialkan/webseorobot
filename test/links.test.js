import test from "node:test";
import assert from "node:assert/strict";
import { inspectLinks, linkCandidates } from "../src/links.js";

test("yalnızca sınırlı, kontrol edilmemiş iç HTML bağlantılarını seçer", () => {
  const urls = linkCandidates(new URL("https://example.com/"), [{ anchors: ["https://example.com/", "https://example.com/kirik", "https://other.com/", "https://example.com/a.pdf", "https://example.com/ikinci"] }], ["https://example.com/"], 1);
  assert.deepEqual(urls, ["https://example.com/kirik"]);
});

test("yalnızca kesin 404 ve 410 yanıtlarını kırık sayar", async () => {
  const fetcher = async (url) => ({ ok: true, result: { url, status: Number(new URL(url).pathname.slice(1)) } });
  const links = await inspectLinks(["https://example.com/404", "https://example.com/410", "https://example.com/403", "https://example.com/200"], fetcher);
  assert.deepEqual(links.map((item) => item.durum), ["kırık", "kırık", "belirsiz", "çalışıyor"]);
});
