import dns from "node:dns/promises";
import net from "node:net";

export function normalizeTarget(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error("Bir site adresi girin.");
  let candidate = input.trim();
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let url;
  try { url = new URL(candidate); } catch { throw new Error("Geçerli bir internet adresi girin."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Yalnızca HTTP ve HTTPS adresleri denetlenebilir.");
  if (url.username || url.password) throw new Error("Kullanıcı bilgisi içeren adresler kabul edilmez.");
  if (url.port && !['80', '443'].includes(url.port)) throw new Error("Yalnızca 80 ve 443 portlarına izin verilir.");
  url.hash = "";
  return url;
}

export async function assertPublicUrl(input) {
  const url = input instanceof URL ? input : normalizeTarget(input);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Yerel ve özel ağ adresleri denetlenemez.");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Yerel ve özel ağ adresleri denetlenemez.");
    return url;
  }
  let records;
  try { records = await dns.lookup(host, { all: true, verbatim: true }); }
  catch { throw new Error("Alan adı çözümlenemedi."); }
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Alan adı güvenli, genel bir IP adresine çözülmüyor.");
  }
  return url;
}

export function isPrivateIp(address) {
  const ip = address.toLowerCase();
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    return ip === "::" || ip === "::1" || ip.startsWith("fe8") || ip.startsWith("fe9") ||
      ip.startsWith("fea") || ip.startsWith("feb") || ip.startsWith("fc") || ip.startsWith("fd") ||
      ip.startsWith("ff") || ip.startsWith("::ffff:127.") || ip.startsWith("::ffff:10.") ||
      ip.startsWith("::ffff:192.168.");
  }
  return true;
}
