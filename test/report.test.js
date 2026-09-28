import test from "node:test";
import assert from "node:assert/strict";
import { buildFixPrompt, reportToMarkdown } from "../src/report.js";

const report = {
  hedef: { girilen: "https://example.com/", son: "https://example.com/" },
  olusturuldu: "2026-09-28T00:00:00.000Z",
  ozet: { incelenenSayfa: 1 },
  puanlar: { erisilebilirlik: 100 },
  bulgular: [{ kod: "TITLE-MISSING", seviye: "yüksek", baslik: "Başlık eksik", aciklama: "Yok", kanit: { url: "https://example.com/", bulunan: "title yok" }, etkisi: "Belirsizlik", cozum: "Title ekle" }]
};

test("Markdown rapor kanıtı ve çözümü içerir", () => {
  const markdown = reportToMarkdown(report);
  assert.match(markdown, /Başlık eksik/);
  assert.match(markdown, /Title ekle/);
});

test("düzeltme istemi güvenli uygulama kurallarını taşır", () => {
  const prompt = buildFixPrompt(report);
  assert.match(prompt, /canlı HTTP davranışı/);
  assert.match(prompt, /TITLE-MISSING/);
});
