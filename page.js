// Landing page for the GeoSuite Open GEO toolkit — a hub linking the free hosted
// tools and their open-source repos. Bilingual (en/it): the worker picks a locale
// and calls renderPage(lang, stats); all copy lives in the S dictionary below.

const BASE = 'https://tools.trygeosuite.it';

// Language-invariant per tool: name, emoji, links, CLI command. Only the blurb is
// translated (see S[lang].tools[i]).
const TOOLS = [
  {
    emoji: '🤖',
    name: 'AI Crawl Check',
    open: 'https://ai-crawl-check.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/ai-crawler-bots',
    cmd: 'npx @geosuite/ai-crawler-bots robots &lt;url&gt;',
  },
  {
    emoji: '📄',
    name: 'llms.txt Generator',
    open: 'https://llmstxt-generator.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/llms-txt-generator',
    cmd: 'npx @geosuite/llms-txt-generator &lt;sitemap&gt;',
  },
  {
    emoji: '🔖',
    name: 'Schema Templates',
    open: 'https://schema-templates.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/schema-templates',
    cmd: 'npx @geosuite/schema-templates show Organization',
  },
  {
    emoji: '🗺️',
    name: 'Sitemap Builder',
    open: 'https://sitemap-builder.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/sitemap-builder',
    cmd: 'npx @geosuite/sitemap-builder &lt;url&gt;',
  },
];

const S = {
  en: {
    title: 'GeoSuite Open — free GEO tools',
    desc: 'Free, open-source tools for Generative Engine Optimization (GEO): audit AI crawlers, generate llms.txt, build schema.org JSON-LD, and create sitemaps.',
    lead: `Free, open-source tools for <strong style="color:var(--text)">Generative Engine Optimization</strong> — making your site legible to ChatGPT, Gemini, Claude &amp; Perplexity. Zero dependencies, run in your terminal or right here.`,
    cta: 'Explore GeoSuite →',
    open: 'Open tool →',
    stats: (t, m) => `⬇ <strong>${t}</strong> downloads · <strong>${m}</strong>/month across the toolkit`,
    footer: `Open source (MIT) by <a href="https://github.com/matte97p">Matteo Perino</a> · maintained under <a href="https://trygeosuite.it">GeoSuite</a> · <a href="https://github.com/TryGeoSuite">github.com/TryGeoSuite</a>`,
    tools: [
      `See which AI crawlers (GPTBot, ClaudeBot, PerplexityBot…) your <code style="display:inline">robots.txt</code> allows or blocks — with an AI-visibility score. Plus a public bot-list API.`,
      `Turn any site's <code style="display:inline">sitemap.xml</code> into an <code style="display:inline">llms.txt</code> — the curated index that tells AI models which pages matter.`,
      `Copy-paste schema.org JSON-LD templates (Organization, Product, FAQPage, Article…) and validate your own structured data.`,
      `Crawl a site and build a <code style="display:inline">sitemap.xml</code> — a quick capped version here, or a full crawl from the CLI.`,
    ],
  },
  it: {
    title: 'GeoSuite Open — strumenti GEO gratuiti',
    desc: 'Strumenti gratuiti e open-source per la Generative Engine Optimization (GEO): controlla i crawler AI, genera llms.txt, crea JSON-LD schema.org e costruisci sitemap.',
    lead: `Strumenti gratuiti e open-source per la <strong style="color:var(--text)">Generative Engine Optimization</strong> — per rendere il tuo sito leggibile a ChatGPT, Gemini, Claude e Perplexity. Zero dipendenze, dal terminale o direttamente qui.`,
    cta: 'Scopri GeoSuite →',
    open: 'Apri lo strumento →',
    stats: (t, m) => `⬇ <strong>${t}</strong> download · <strong>${m}</strong>/mese in tutta la suite`,
    footer: `Open source (MIT) di <a href="https://github.com/matte97p">Matteo Perino</a> · mantenuto sotto <a href="https://trygeosuite.it">GeoSuite</a> · <a href="https://github.com/TryGeoSuite">github.com/TryGeoSuite</a>`,
    tools: [
      `Scopri quali crawler AI (GPTBot, ClaudeBot, PerplexityBot…) il tuo <code style="display:inline">robots.txt</code> permette o blocca — con un punteggio di visibilità AI. Più una API pubblica con la lista dei bot.`,
      `Trasforma il <code style="display:inline">sitemap.xml</code> di qualsiasi sito in un <code style="display:inline">llms.txt</code> — l'indice curato che dice ai modelli AI quali pagine contano.`,
      `Template JSON-LD schema.org pronti da copiare (Organization, Product, FAQPage, Article…) e valida i tuoi dati strutturati.`,
      `Esplora un sito e costruisci un <code style="display:inline">sitemap.xml</code> — qui una versione rapida e limitata, o un crawl completo da CLI.`,
    ],
  },
};

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

// lang: 'en' | 'it'. stats: { total, monthly } or null (cold/degraded → line omitted).
export function renderPage(lang, stats) {
  const t = S[lang] || S.en;
  const statsLine = stats ? `<p class="stats">${t.stats(fmt(stats.total), fmt(stats.monthly))}</p>` : '';
  const cards = TOOLS.map(
    (tool, i) => `    <div class="tool">
      <h2><span class="emoji">${tool.emoji}</span> ${tool.name}</h2>
      <p>${t.tools[i]}</p>
      <div class="links">
        <a class="open" href="${tool.open}" target="_blank" rel="noopener">${t.open}</a>
        <a class="ghost" href="${tool.gh}" target="_blank" rel="noopener">GitHub</a>
      </div>
      <code>${tool.cmd}</code>
    </div>`,
  ).join('\n\n');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.desc}">
<link rel="canonical" href="${BASE}/${lang}">
<link rel="alternate" hreflang="en" href="${BASE}/en">
<link rel="alternate" hreflang="it" href="${BASE}/it">
<link rel="alternate" hreflang="x-default" href="${BASE}/">
<style>
  :root {
    --bg: #0b0f17; --panel: #131a26; --line: #243042; --text: #e7edf5;
    --muted: #8b9bb4; --accent: #5b8def;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { position: relative; max-width: 900px; margin: 0 auto; padding: 56px 20px 80px; }
  .lang { position: absolute; top: 18px; right: 20px; display: flex; gap: 6px; font-size: .8rem; }
  .lang a { color: var(--muted); text-decoration: none; padding: 4px 9px; border-radius: 7px; border: 1px solid transparent; }
  .lang a.on { color: var(--text); border-color: var(--line); background: var(--panel); }
  .lang a:hover { color: var(--text); }
  header { text-align: center; margin-bottom: 36px; }
  header h1 { font-size: 2rem; margin: 0 0 10px; letter-spacing: -0.02em; }
  header p { color: var(--muted); margin: 0 auto; max-width: 560px; }
  header .cta { display: inline-block; margin-top: 18px; background: var(--accent); color: #fff; font-weight: 600; padding: 11px 20px; border-radius: 10px; text-decoration: none; }
  header .cta:hover { opacity: .9; }
  header .stats { margin: 18px auto 0; color: var(--muted); font-size: .9rem; }
  header .stats strong { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  .tool { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; }
  .tool h2 { margin: 0 0 6px; font-size: 1.15rem; }
  .tool .emoji { font-size: 1.5rem; }
  .tool p { color: var(--muted); margin: 0 0 14px; font-size: .92rem; flex: 1; }
  .tool .links { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tool a.open { background: var(--accent); color: #fff; font-weight: 600; font-size: .9rem; padding: 9px 15px; border-radius: 9px; text-decoration: none; }
  .tool a.open:hover { opacity: .9; }
  .tool a.ghost { border: 1px solid var(--line); color: var(--text); font-size: .9rem; padding: 9px 13px; border-radius: 9px; text-decoration: none; }
  .tool a.ghost:hover { border-color: var(--accent); color: var(--accent); }
  .tool code { display: block; margin-top: 12px; color: var(--muted); font-size: .8rem; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  footer { margin-top: 40px; color: var(--muted); font-size: .88rem; text-align: center; }
  footer a { color: var(--accent); text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <nav class="lang" aria-label="Language">
    <a href="/en"${lang === 'en' ? ' class="on"' : ''}>EN</a>
    <a href="/it"${lang === 'it' ? ' class="on"' : ''}>IT</a>
  </nav>
  <header>
    <h1>GeoSuite Open</h1>
    <p>${t.lead}</p>
    <a class="cta" href="https://trygeosuite.it" target="_blank" rel="noopener">${t.cta}</a>
    ${statsLine}
  </header>

  <div class="grid">
${cards}
  </div>

  <footer>
    ${t.footer}
  </footer>
</div>
</body>
</html>`;
}
