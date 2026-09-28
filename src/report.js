export function reportToMarkdown(report) {
  const lines = [
    `# WebSEORobot raporu`,
    "",
    `- Hedef: ${report.hedef.girilen}`,
    `- Son adres: ${report.hedef.son || "erişilemedi"}`,
    `- Oluşturulma: ${report.olusturuldu}`,
    `- İncelenen sayfa: ${report.ozet.incelenenSayfa}`,
    "",
    "## Alan puanları",
    ""
  ];
  for (const [key, value] of Object.entries(report.puanlar)) lines.push(`- ${title(key)}: ${value}/100`);
  lines.push("", "## Bulgular", "");
  if (!report.bulgular.length) lines.push("Denetim sınırları içinde sorun bulunmadı.", "");
  for (const finding of report.bulgular) {
    lines.push(`### [${finding.seviye.toUpperCase()}] ${finding.baslik}`, "", finding.aciklama, "", `**Kanıt:** ${finding.kanit.url}${finding.kanit.bulunan ? ` — ${finding.kanit.bulunan}` : ""}`, "", `**Etkisi:** ${finding.etkisi}`, "", `**Çözüm:** ${finding.cozum}`, "");
  }
  lines.push("## Yöntem notu", "", "Bu rapor canlı HTTP yanıtlarının sınırlı bir örneklemine dayanır. Sıralama veya dizine alınma garantisi vermez.");
  return lines.join("\n");
}

export function buildFixPrompt(report) {
  const payload = report.bulgular.filter((f) => ["kritik", "yüksek", "orta"].includes(f.seviye)).map((f) => ({ kod: f.kod, seviye: f.seviye, baslik: f.baslik, kanit: f.kanit, cozum: f.cozum }));
  return `Aşağıdaki WebSEORobot bulgularını mevcut projede düzelt. Önce repoyu, AGENTS.md dosyalarını ve framework belgelerini incele. Kullanıcının ilgisiz değişikliklerini koru. Her bulguyu canlı HTTP davranışıyla doğrula; yalnızca kaynak kodda doğru görünmesini başarı sayma. Uydurma kurum bilgisi, adres, telefon, hreflang veya schema üretme. Değişikliklerden sonra testleri çalıştır ve hangi bulgunun nasıl doğrulandığını raporla.\n\nHedef: ${report.hedef.son || report.hedef.girilen}\n\nBulgular:\n${JSON.stringify(payload, null, 2)}`;
}

function title(key) {
  return ({ erisilebilirlik: "Erişilebilirlik", indekslenebilirlik: "İndekslenebilirlik", kanoniklik: "Kanoniklik", anlasilabilirlik: "Anlaşılabilirlik", kanitlanabilirlik: "Kanıtlanabilirlik", ozgunluk: "Özgünlük" })[key] || key;
}
