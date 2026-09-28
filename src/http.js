import { assertPublicUrl } from "./security.js";

const DEFAULT_LIMIT = Number(process.env.AUDIT_MAX_RESPONSE_BYTES || 2_000_000);
const DEFAULT_TIMEOUT = Number(process.env.AUDIT_TIMEOUT_MS || 10_000);

export async function safeFetch(input, options = {}) {
  let current = await assertPublicUrl(input);
  const chain = [];
  const maxRedirects = options.maxRedirects ?? 5;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT);
    let response;
    try {
      response = await fetch(current, {
        method: options.method || "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "WebSEORobot/0.1 (+https://tezatlas.com/webseorobot)",
          accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1"
        }
      });
    } catch (error) {
      clearTimeout(timer);
      throw new Error(error.name === "AbortError" ? "İstek zaman aşımına uğradı." : `İstek başarısız: ${error.message}`);
    }
    clearTimeout(timer);
    const step = { url: current.href, durumKodu: response.status, konum: response.headers.get("location") || undefined };
    chain.push(step);
    if ([301, 302, 303, 307, 308].includes(response.status) && step.konum) {
      if (hop === maxRedirects) throw new Error("Yönlendirme sınırı aşıldı.");
      current = new URL(step.konum, current);
      continue;
    }
    const body = options.method === "HEAD" ? "" : await readLimited(response, options.maxBytes ?? DEFAULT_LIMIT);
    return {
      url: current.href,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      chain
    };
  }
  throw new Error("Yönlendirme tamamlanamadı.");
}

async function readLimited(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Yanıt ${maxBytes} bayt sınırını aşıyor.`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function tryFetch(url, options) {
  try { return { ok: true, result: await safeFetch(url, options) }; }
  catch (error) { return { ok: false, error: error.message }; }
}
