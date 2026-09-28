import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { auditSite } from "../src/audit.js";
import { buildFixPrompt, reportToMarkdown } from "../src/report.js";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.env.PORT || 3000);
const rate = new Map();

const server = http.createServer(async (request, response) => {
  setSecurityHeaders(response);
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/^\/webseorobot(?=\/|$)/, "") || "/";
  try {
    if (request.method === "POST" && pathname === "/api/audit") {
      if (!allow(request.socket.remoteAddress || "unknown")) return json(response, 429, { hata: "Çok fazla istek. Bir dakika sonra yeniden deneyin." });
      const body = await readJson(request);
      const report = await auditSite(body.url, { maxPages: body.maxPages });
      report.markdown = reportToMarkdown(report);
      report.duzeltmeIstemi = buildFixPrompt(report);
      return json(response, 200, report);
    }
    if (request.method !== "GET") return json(response, 405, { hata: "Yönteme izin verilmiyor." });
    if (pathname === "/health") return json(response, 200, { durum: "ok" });
    return serveStatic(pathname, response);
  } catch (error) {
    const status = /JSON|gövdesi|site adresi|internet adresi|HTTP ve HTTPS|Yerel|özel ağ|port/i.test(error.message) ? 400 : 500;
    return json(response, status, { hata: status === 500 ? "Denetim tamamlanamadı. Biraz sonra yeniden deneyin." : error.message, ayrinti: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
});

server.listen(port, () => console.log(`WebSEORobot http://localhost:${port}/webseorobot adresinde çalışıyor.`));

async function serveStatic(pathname, response) {
  const wanted = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safe = normalize(wanted).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = join(root, safe);
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); }
  catch { file = join(root, "index.html"); }
  const data = await readFile(file);
  response.writeHead(200, { "content-type": mime(extname(file)), "cache-control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600" });
  response.end(data);
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error("İstek gövdesi çok büyük.");
  }
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("Geçerli JSON gönderin."); }
}

function allow(key) {
  const now = Date.now();
  const recent = (rate.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 6) return false;
  recent.push(now); rate.set(key, recent); return true;
}

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

function setSecurityHeaders(response) {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("content-security-policy", "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function mime(ext) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8" })[ext] || "application/octet-stream";
}
