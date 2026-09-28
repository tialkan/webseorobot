// Roller sağlayıcıların belgeleri değiştikçe bu tek dosyadan güncellenir.
export const AI_BOTS = [
  { ad: "OAI-SearchBot", grup: "arama", saglayici: "OpenAI" },
  { ad: "ChatGPT-User", grup: "kullanici", saglayici: "OpenAI" },
  { ad: "GPTBot", grup: "egitim", saglayici: "OpenAI" },
  { ad: "ClaudeBot", grup: "egitim", saglayici: "Anthropic" },
  { ad: "Claude-User", grup: "kullanici", saglayici: "Anthropic" },
  { ad: "Claude-SearchBot", grup: "arama", saglayici: "Anthropic" },
  { ad: "PerplexityBot", grup: "arama", saglayici: "Perplexity" },
  { ad: "Perplexity-User", grup: "kullanici", saglayici: "Perplexity" },
  { ad: "Google-Extended", grup: "egitim", saglayici: "Google" },
  { ad: "Applebot", grup: "arama", saglayici: "Apple" },
  { ad: "Applebot-Extended", grup: "egitim", saglayici: "Apple" },
  { ad: "Bingbot", grup: "arama", saglayici: "Microsoft" },
  { ad: "DuckAssistBot", grup: "arama", saglayici: "DuckDuckGo" },
  { ad: "Meta-ExternalAgent", grup: "egitim", saglayici: "Meta" },
  { ad: "CCBot", grup: "egitim", saglayici: "Common Crawl" },
  { ad: "MistralAI-User", grup: "kullanici", saglayici: "Mistral" },
  { ad: "YouBot", grup: "arama", saglayici: "You.com" }
];

export function inspectBotRules(robotsText = "") {
  const groups = parseGroups(robotsText);
  return AI_BOTS.map((bot) => {
    const own = groups.find((g) => g.agents.some((a) => a.toLowerCase() === bot.ad.toLowerCase()));
    const wildcard = groups.find((g) => g.agents.includes("*"));
    const selected = own || wildcard;
    const rootRule = selected?.rules
      .filter((r) => r.path === "/" || r.path === "/*")
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
    return {
      ...bot,
      durum: !selected ? "belirtilmemis" : rootRule?.type === "disallow" ? "engelli" : "izinli",
      kanit: own ? `User-agent: ${bot.ad}` : wildcard ? "User-agent: *" : "Bu bot için açık kural yok"
    };
  });
}

function parseGroups(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line || !line.includes(":")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ type: key, path: value });
    }
  }
  return groups;
}
