// Landing page for the GeoSuite Open GEO toolkit: a hub linking the free hosted
// tools and their open-source repos. Bilingual (en/it): the worker picks a locale
// and calls renderPage(lang, stats); all copy lives in the S dictionary below.
//
// It wears the same clothes as the AI Readiness Check (theme.js), and its form
// is the way in to it: the hero asks for the site, /check answers with what an
// AI recommends and what to fix, and the four tools below are those fixes.
//
// The page also dogfoods the toolkit it advertises: JSON-LD structured data here,
// plus /robots.txt, /llms.txt, /sitemap.xml and an OG image served by the worker.

import { FONTS, BASE_CSS, ENGINES } from './theme.js';
import { exampleCard, ICONS } from './check-page.js';

const BASE = 'https://tools.trygeosuite.it';
const ANALYSIS = 'https://trygeosuite.it/analisi-gratuita?utm_source=geosuite-open&utm_medium=tool&utm_campaign=hub';

// Line icons, 24px grid, drawn with currentColor: decoration next to the name,
// never the only label.
const GLYPHS = {
  crawlers: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M9 13v1M15 13v1M2 14h2M20 14h2"/>',
  llms: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  schema: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>',
  agents: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  sitemap: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-3h14v3"/>',
};
const glyph = (key) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[key]}</svg>`;

// Language-invariant per tool: name, links, CLI command. Only the blurb is
// translated (see S[lang].tools[i]).
const TOOLS = [
  {
    key: 'crawlers',
    name: 'AI Crawl Check',
    open: 'https://ai-crawl-check.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/ai-crawler-bots',
    cmd: 'npx @geosuite/ai-crawler-bots robots &lt;url&gt;',
  },
  {
    key: 'llms',
    name: 'llms.txt Generator',
    open: 'https://llmstxt-generator.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/llms-txt-generator',
    cmd: 'npx @geosuite/llms-txt-generator &lt;sitemap&gt;',
  },
  {
    key: 'schema',
    name: 'Schema Templates',
    open: 'https://schema-templates.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/schema-templates',
    cmd: 'npx @geosuite/schema-templates show Organization',
  },
  {
    key: 'sitemap',
    name: 'Sitemap Builder',
    open: 'https://sitemap-builder.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/sitemap-builder',
    cmd: 'npx @geosuite/sitemap-builder &lt;url&gt;',
  },
  {
    key: 'agents',
    name: 'Poppy Check',
    open: 'https://poppy-check.geosuite.workers.dev',
    gh: 'https://github.com/TryGeoSuite/poppy-json',
    cmd: 'npx @geosuite/poppy-json check &lt;url&gt;',
  },
];

const S = {
  en: {
    title: 'GeoSuite Open: free GEO tools',
    desc: 'Free, open-source tools for Generative Engine Optimization (GEO): audit AI crawlers, generate llms.txt, build schema.org JSON-LD, create sitemaps and check the Personal Agent Protocol file (poppy.json).',
    check: 'AI Readiness Check',
    eyebrow: 'Free and open source',
    h1: 'Make your site easy for AI to read, and to recommend',
    lead: 'Free tools for Generative Engine Optimization: see what ChatGPT, Gemini, Claude and Perplexity find on your site, and fix what they miss.',
    label: 'Your website',
    placeholder: 'yoursite.com',
    run: 'Check my site',
    facts: ['Free', 'No sign-up', 'Open source (MIT)'],
    stats: (t, m) => `<strong>${t}</strong> npm downloads, <strong>${m}</strong> last month`,
    toolsHead: 'Five tools, one for each gap',
    toolsLead: 'Use them right here in the browser, or from your terminal: each one is also a zero-dependency CLI on npm.',
    open: 'Open the tool',
    copy: 'Copy',
    copied: 'Copied',
    copyLabel: 'Copy the command',
    ctaTitle: 'Readable is step one. Recommended is the goal.',
    ctaText: 'GeoSuite asks ChatGPT, Gemini and Perplexity the questions your customers really ask, and tells you where you appear, who wins instead and what to fix first. The report arrives by email.',
    ctaButton: 'Get the free analysis',
    footer: 'Open source (MIT) by <a href="https://github.com/matte97p">Matteo Perino</a>, maintained under <a href="https://trygeosuite.it">GeoSuite</a>, the Italian platform for AI visibility. Code on <a href="https://github.com/TryGeoSuite">github.com/TryGeoSuite</a>.',
    tools: [
      'See which AI crawlers (GPTBot, ClaudeBot, PerplexityBot…) your <code>robots.txt</code> allows or blocks, with an AI-visibility score. Plus a public bot-list API.',
      'Turn any site’s <code>sitemap.xml</code> into an <code>llms.txt</code>: the curated index that tells AI models which pages matter.',
      'Copy-paste schema.org JSON-LD templates (Organization, Product, FAQPage, Article…) and validate your own structured data.',
      'Crawl a site and build a <code>sitemap.xml</code>: a quick capped version here, or a full crawl from the CLI.',
      'Check and generate the <code>/.well-known/poppy.json</code> of the Personal Agent Protocol: the file people’s own AI agents read to find your business and sign in for them.',
    ],
  },
  it: {
    title: 'GeoSuite Open: strumenti GEO gratuiti',
    desc: 'Strumenti gratuiti e open-source per la Generative Engine Optimization (GEO): controlla i crawler AI, genera llms.txt, crea JSON-LD schema.org, costruisci sitemap e controlla il file del Personal Agent Protocol (poppy.json).',
    check: 'AI Readiness Check',
    eyebrow: 'Gratis e open source',
    h1: 'Rendi il tuo sito facile da leggere, e da consigliare, per le AI',
    lead: 'Strumenti gratuiti per la Generative Engine Optimization: guarda cosa trovano ChatGPT, Gemini, Claude e Perplexity sul tuo sito, e correggi quello che manca.',
    label: 'Il tuo sito',
    placeholder: 'tuosito.it',
    run: 'Controlla il mio sito',
    facts: ['Gratis', 'Senza registrazione', 'Open source (MIT)'],
    stats: (t, m) => `<strong>${t}</strong> download da npm, <strong>${m}</strong> nell’ultimo mese`,
    toolsHead: 'Cinque strumenti, uno per ogni lacuna',
    toolsLead: 'Usali qui nel browser, o dal terminale: ognuno è anche una CLI su npm, senza dipendenze.',
    open: 'Apri lo strumento',
    copy: 'Copia',
    copied: 'Copiato',
    copyLabel: 'Copia il comando',
    ctaTitle: 'Farsi leggere è il primo passo. Farsi consigliare è l’obiettivo.',
    ctaText: 'GeoSuite fa a ChatGPT, Gemini e Perplexity le domande che i tuoi clienti fanno davvero, e ti dice dove compari, chi vince al posto tuo e cosa correggere per primo. Il report arriva via mail.',
    ctaButton: 'Richiedi l’analisi gratuita',
    footer: 'Open source (MIT) di <a href="https://github.com/matte97p">Matteo Perino</a>, mantenuto da <a href="https://trygeosuite.it">GeoSuite</a>, la piattaforma italiana per la visibilità sulle AI. Codice su <a href="https://github.com/TryGeoSuite">github.com/TryGeoSuite</a>.',
    tools: [
      'Scopri quali crawler AI (GPTBot, ClaudeBot, PerplexityBot…) il tuo <code>robots.txt</code> permette o blocca, con un punteggio di visibilità AI. Più una API pubblica con la lista dei bot.',
      'Trasforma il <code>sitemap.xml</code> di qualsiasi sito in un <code>llms.txt</code>: l’indice curato che dice ai modelli AI quali pagine contano.',
      'Template JSON-LD schema.org pronti da copiare (Organization, Product, FAQPage, Article…) e valida i tuoi dati strutturati.',
      'Esplora un sito e costruisci un <code>sitemap.xml</code>: qui una versione rapida e limitata, o un crawl completo da CLI.',
      'Controlla e genera il <code>/.well-known/poppy.json</code> del Personal Agent Protocol: il file che gli agenti AI personali leggono per trovare la tua azienda ed entrare per conto dei clienti.',
    ],
  },
};

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '');

// schema.org JSON-LD: Organization + an ItemList of the SoftwareApplications.
function jsonLd(t) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'GeoSuite', url: 'https://trygeosuite.it', sameAs: ['https://github.com/TryGeoSuite'] },
      {
        '@type': 'ItemList',
        name: t.title,
        itemListElement: TOOLS.map((tool, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'SoftwareApplication',
            name: tool.name,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Web, Node.js',
            description: stripTags(t.tools[i]),
            url: tool.open,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
          },
        })),
      },
    ],
  }).replace(/</g, '\\u003c');
}

// lang: 'en' | 'it'. stats: { total, monthly } or null (cold/degraded → line omitted).
export function renderPage(lang, stats) {
  const t = S[lang] || S.en;
  const facts = t.facts.map((f) => `<li>${ICONS.ok}${f}</li>`);
  if (stats) facts.push(`<li>${t.stats(fmt(stats.total), fmt(stats.monthly))}</li>`);
  const cards = TOOLS.map(
    (tool, i) => `      <li class="panel tool">
        <h3><span class="glyph">${glyph(tool.key)}</span>${tool.name}</h3>
        <p>${t.tools[i]}</p>
        <div class="cmd"><code>${tool.cmd}</code></div>
        <div class="links">
          <a class="open" href="${tool.open}" target="_blank" rel="noopener">${t.open} →</a>
          <a class="ghost" href="${tool.gh}" target="_blank" rel="noopener">GitHub</a>
        </div>
      </li>`,
  ).join('\n');

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
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GeoSuite Open">
<meta property="og:title" content="${t.title}">
<meta property="og:description" content="${t.desc}">
<meta property="og:url" content="${BASE}/${lang}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'it' ? 'it_IT' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t.title}">
<meta name="twitter:description" content="${t.desc}">
<meta name="twitter:image" content="${BASE}/og.png">
${FONTS}
<script type="application/ld+json">${jsonLd(t)}</script>
<style>
${BASE_CSS}
  .tools { margin-top:56px; }
  .tools > h2 { font-size:1.5rem; line-height:1.25; letter-spacing:-.015em; margin:0 0 6px; }
  .tools > p { color:var(--ink-2); margin:0 0 20px; max-width:60ch; }
  .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; list-style:none; margin:0; padding:0; }
  .tool { padding:20px; display:flex; flex-direction:column; }
  .tool h3 { display:flex; align-items:center; gap:10px; font-size:1.0625rem; margin:0 0 8px; letter-spacing:-.01em; }
  .glyph { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:8px; background:var(--sunk); color:var(--ink-2); flex:none; }
  .glyph svg { width:20px; height:20px; }
  .tool p { color:var(--ink-2); font-size:.9375rem; margin:0 0 16px; flex:1; }
  .tool p code { font-size:.875em; }
  code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .cmd { display:flex; align-items:center; gap:8px; padding:4px 4px 4px 12px; background:var(--surface-2); border:1px solid var(--line); border-radius:8px; margin:0 0 16px; }
  .cmd code { flex:1; min-width:0; overflow-x:auto; white-space:nowrap; color:var(--ink-2); font-size:.8125rem; padding:6px 0; }
  .cmd button { flex:none; min-height:32px; padding:4px 10px; font-size:.8125rem; }
  .links { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .links a { text-decoration:none; display:inline-flex; align-items:center; }
  .links a.open { font-weight:600; font-size:.9375rem; min-height:36px; padding:0 4px 0 0; }
  .links a.open:hover { text-decoration:underline; }
  .links a.ghost { margin-left:auto; }
  .cta { margin-top:32px; }
  @media (max-width:640px) {
    .grid { grid-template-columns:minmax(0, 1fr); }
    .tools { margin-top:40px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <a class="brand" href="https://trygeosuite.it">GeoSuite</a>
    <nav aria-label="Language">
      <a href="/${lang}/check">${t.check}</a>
      <a href="/en"${lang === 'en' ? ' aria-current="page"' : ''} hreflang="en">EN</a>
      <a href="/it"${lang === 'it' ? ' aria-current="page"' : ''} hreflang="it">IT</a>
    </nav>
  </header>

  <main>
    <div class="hero">
      <div>
        <p class="eyebrow">${t.eyebrow}</p>
        <h1>${t.h1}</h1>
        <p class="lead">${t.lead}</p>
        <form class="urlform" action="/${lang}/check" method="get">
          <label for="u">${t.label}</label>
          <input id="u" name="url" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="${t.placeholder}" required>
          <button class="primary" type="submit">${t.run}</button>
        </form>
        <ul class="facts">${facts.join('')}</ul>
      </div>
      ${exampleCard(lang)}
    </div>

    <section class="tools" aria-labelledby="tools-head">
      <h2 id="tools-head">${t.toolsHead}</h2>
      <p>${t.toolsLead}</p>
      <ul class="grid">
${cards}
      </ul>
    </section>

    <section class="panel cta">
      <div>
        <h2>${t.ctaTitle}</h2>
        <p>${t.ctaText}</p>
        ${ENGINES}
      </div>
      <a class="primary" href="${ANALYSIS}" target="_blank" rel="noopener">${t.ctaButton}</a>
    </section>
  </main>

  <footer>${t.footer}</footer>
</div>
<script>
(function () {
  var L = { copy: ${JSON.stringify(t.copy)}, copied: ${JSON.stringify(t.copied)}, label: ${JSON.stringify(t.copyLabel)} };
  if (!navigator.clipboard) return;
  document.querySelectorAll('.cmd').forEach(function (box) {
    var cmd = box.querySelector('code').textContent.trim();
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ghost'; b.textContent = L.copy; b.setAttribute('aria-label', L.label);
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(cmd).then(function () {
        b.textContent = L.copied;
        setTimeout(function () { b.textContent = L.copy; }, 1200);
      }).catch(function () {});
    });
    box.appendChild(b);
  });
})();
</script>
</body>
</html>`;
}
