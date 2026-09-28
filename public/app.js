const form = document.querySelector('#audit-form');
const progress = document.querySelector('#progress');
const results = document.querySelector('#results');
const progressTitle = document.querySelector('#progress-title');
const progressPercent = document.querySelector('#progress-percent');
const progressBar = document.querySelector('#progress-bar');
const progressNote = document.querySelector('#progress-note');
let currentReport = null;

const stages = [
  [8, 'Adresi güvenli biçimde doğruluyoruz…', 'Yerel ve özel ağ hedefleri engellenir.'],
  [22, 'HTTP ve HTTPS sürümlerini sınıyoruz…', 'www, çıplak alan adı ve yönlendirme zincirleri açılıyor.'],
  [40, 'Robots ve sitemap okunuyor…', 'Tarama izni, sitemap bildirimi ve URL örneklemi denetleniyor.'],
  [61, 'Önemli sayfalar inceleniyor…', 'Başlık, canonical, dil, görseller ve JSON-LD okunuyor.'],
  [78, 'Yapay zekâ tarayıcı tercihleri ayrıştırılıyor…', 'Arama, kullanıcı erişimi ve model geliştirme ayrı tutuluyor.'],
  [92, 'Kanıtlar önceliklendiriliyor…', 'Kritik sorunlar küçük başarılardan ayrı gösteriliyor.']
];

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#site-url');
  if (!input.value.trim()) return input.focus();
  results.classList.add('hidden'); progress.classList.remove('hidden');
  progress.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let index = 0; updateStage(stages[index]);
  const ticker = setInterval(() => { if (index < stages.length - 1) updateStage(stages[++index]); }, 1800);
  try {
    const response = await fetch('/webseorobot/api/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: input.value.trim() }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.hata || 'Denetim tamamlanamadı.');
    currentReport = data; updateStage([100, 'Rapor hazır.', `${data.ozet.incelenenSayfa} sayfa ve ${data.ozet.bulgu} bulgu işlendi.`]);
    render(data); setTimeout(() => { progress.classList.add('hidden'); results.classList.remove('hidden'); results.scrollIntoView({ behavior: 'smooth' }); }, 400);
  } catch (error) {
    progressTitle.textContent = error.name === 'AbortError' ? 'Denetim zaman aşımına uğradı.' : error.message;
    progressNote.textContent = 'Adresi ve sitenin herkese açık olduğunu kontrol edip yeniden deneyin.';
    progressBar.style.background = 'var(--coral)';
  } finally { clearTimeout(timeout); clearInterval(ticker); }
});

function updateStage([percent, title, note]) { progressTitle.textContent = title; progressPercent.textContent = `${String(percent).padStart(2, '0')}%`; progressBar.style.width = `${percent}%`; progressNote.textContent = note; }

function render(report) {
  document.querySelector('#summary').innerHTML = [
    [report.ozet.incelenenSayfa, 'İNCELENEN SAYFA'], [report.ozet.bulgu, 'TOPLAM BULGU'], [report.ozet.kritik, 'KRİTİK'], [`${(report.ozet.sureMs / 1000).toFixed(1)} sn`, 'SÜRE']
  ].map(([value, label]) => `<div><b>${escapeHtml(value)}</b><span>${label}</span></div>`).join('');
  const names = { erisilebilirlik:'Erişilebilirlik',indekslenebilirlik:'İndekslenebilirlik',kanoniklik:'Kanoniklik',anlasilabilirlik:'Anlaşılabilirlik',kanitlanabilirlik:'Kanıtlanabilirlik',ozgunluk:'Özgünlük' };
  document.querySelector('#scores').innerHTML = Object.entries(report.puanlar).map(([key,value]) => `<article class="score-card"><b>${value}</b><span>${names[key]}</span></article>`).join('');
  renderFindings(report.bulgular, 'tumu');
  document.querySelector('#bots').innerHTML = `<div class="bot-grid">${report.yapayZekaTarayicilari.map(bot => `<div class="bot"><b>${escapeHtml(bot.ad)}</b><span>${groupName(bot.grup)} · ${escapeHtml(bot.saglayici)}</span><strong class="${bot.durum}">${statusName(bot.durum)}</strong></div>`).join('')}</div>`;
}

function renderFindings(findings, filter) {
  const shown = filter === 'tumu' ? findings : findings.filter(f => f.seviye === filter);
  document.querySelector('#findings').innerHTML = shown.length ? shown.map((f, index) => `<details class="finding" ${index === 0 ? 'open' : ''}><summary><span class="severity ${f.seviye}">${escapeHtml(f.seviye)}</span><b>${escapeHtml(f.baslik)}</b></summary><div class="finding-body"><div><h4>KANIT</h4><code>${escapeHtml(f.kanit.url)}${f.kanit.bulunan ? `\n${escapeHtml(f.kanit.bulunan)}` : ''}</code></div><div><h4>ETKİSİ</h4><p>${escapeHtml(f.etkisi)}</p></div><div><h4>NE YAPMALI?</h4><p>${escapeHtml(f.cozum)}</p></div></div></details>`).join('') : '<p>Bu filtrede bulgu yok.</p>';
}

document.querySelector('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('button'); if (!button || !currentReport) return;
  document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('selected', b === button));
  renderFindings(currentReport.bulgular, button.dataset.filter);
});

document.querySelector('#download-json').addEventListener('click', () => download(JSON.stringify(stripExtras(currentReport), null, 2), 'webseorobot-raporu.json', 'application/json'));
document.querySelector('#download-md').addEventListener('click', () => download(currentReport?.markdown || '', 'webseorobot-raporu.md', 'text/markdown'));
document.querySelector('#copy-prompt').addEventListener('click', async (event) => { await navigator.clipboard.writeText(currentReport?.duzeltmeIstemi || ''); event.currentTarget.textContent = 'Kopyalandı ✓'; setTimeout(() => event.currentTarget.textContent = 'Düzeltme istemini kopyala', 1800); });

function download(content, filename, type) { if (!content) return; const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function stripExtras(report) { const copy={...report}; delete copy.markdown; delete copy.duzeltmeIstemi; return copy; }
function groupName(value) { return ({arama:'arama',kullanici:'kullanıcı erişimi',egitim:'model geliştirme'})[value] || value; }
function statusName(value) { return ({izinli:'izinli',engelli:'engelli',belirtilmemis:'açık kural yok'})[value] || value; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
