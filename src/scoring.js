export const SCORE_WEIGHTS = {
  kritik: 35,
  yuksek: 18,
  orta: 9,
  dusuk: 3,
  bilgi: 0
};

const CATEGORIES = ["erisilebilirlik", "indekslenebilirlik", "kanoniklik", "anlasilabilirlik", "kanitlanabilirlik", "ozgunluk"];

export function calculateScores(findings) {
  const scores = Object.fromEntries(CATEGORIES.map((key) => [key, 100]));
  for (const finding of findings) {
    const key = normalizeCategory(finding.kategori);
    if (scores[key] === undefined) continue;
    const severity = finding.seviye === "yüksek" ? "yuksek" : finding.seviye === "düşük" ? "dusuk" : finding.seviye;
    scores[key] -= SCORE_WEIGHTS[severity] ?? 0;
  }
  for (const key of CATEGORIES) scores[key] = Math.max(0, Math.round(scores[key]));
  if (findings.some((f) => f.kod === "INDEX-NOINDEX")) scores.indekslenebilirlik = Math.min(scores.indekslenebilirlik, 20);
  if (findings.some((f) => f.kod === "HTTP-UNREACHABLE")) scores.erisilebilirlik = 0;
  if (findings.some((f) => f.kod === "DOMAIN-DUPLICATE")) scores.kanoniklik = Math.min(scores.kanoniklik, 25);
  return scores;
}

function normalizeCategory(category) {
  return String(category).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
}
