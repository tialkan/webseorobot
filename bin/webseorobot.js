#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { auditSite } from "../src/audit.js";
import { reportToMarkdown } from "../src/report.js";

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("-"));
const value = (flag, fallback) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : fallback; };
if (!url || args.includes("--help") || args.includes("-h")) {
  console.log("Kullanım: webseorobot <url> [--format json|markdown] [--output dosya]");
  process.exit(url ? 0 : 1);
}
try {
  const report = await auditSite(url);
  const format = value("--format", "json");
  const output = format === "markdown" ? reportToMarkdown(report) : JSON.stringify(report, null, 2);
  const outputFile = value("--output");
  if (outputFile) await writeFile(outputFile, output);
  else process.stdout.write(`${output}\n`);
  process.exitCode = report.ozet.kritik ? 2 : report.ozet.yuksek ? 1 : 0;
} catch (error) {
  console.error(`Hata: ${error.message}`);
  process.exitCode = 3;
}
