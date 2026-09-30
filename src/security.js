import dns from "node:dns/promises";
import dnsCb from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

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

// Özel, yerel, belgeleme ve geçiş ağları. IPv4 eşlemeli IPv6 (::ffff:a9fe:a9fe gibi),
// NAT64 ve 6to4 biçimleri de kapsanır; aksi halde AAAA kaydıyla bulut meta veri
// servisine (169.254.169.254) ulaşılabilir.
const ENGELLI4 = new net.BlockList();
const ENGELLI6 = new net.BlockList();
for (const [adres, onek] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]]) ENGELLI4.addSubnet(adres, onek, "ipv4");
for (const [adres, onek] of [["::", 127], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8]]) ENGELLI6.addSubnet(adres, onek, "ipv6");

export function isPrivateIp(address) {
  const ip = String(address).toLowerCase().replace(/^\[|\]$/g, "");
  // Listeler ayrı: BlockList IPv4 adresini ::ffff:0:0/96 kuralıyla da eşleştirir.
  if (net.isIPv4(ip)) return ENGELLI4.check(ip, "ipv4");
  if (net.isIPv6(ip)) return ENGELLI6.check(ip, "ipv6");
  return true;
}

// DNS yeniden bağlama (rebinding) koruması: ön denetimden sonra alan adı başka bir
// adrese çözülebilir. Bağlantı anında yapılan çözüm burada yeniden denetlenir.
function guvenliCozumle(hostname, options, callback) {
  dnsCb.lookup(hostname, { ...options, all: true, verbatim: true }, (hata, kayitlar) => {
    if (hata) return callback(hata);
    if (!kayitlar.length || kayitlar.some((k) => isPrivateIp(k.address))) {
      return callback(Object.assign(new Error("Yerel ve özel ağ adresleri denetlenemez."), { code: "EPRIVATE" }));
    }
    if (options?.all) return callback(null, kayitlar);
    return callback(null, kayitlar[0].address, kayitlar[0].family);
  });
}

const guvenliAjan = new Agent({ connect: { lookup: guvenliCozumle } });

export function guvenliFetch(url, secenekler = {}) {
  return undiciFetch(url, { ...secenekler, dispatcher: guvenliAjan });
}
