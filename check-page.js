// Page of the AI Readiness Check (/check). Bilingual like the hub: the worker
// picks a locale and calls renderCheckPage(lang, url). Both requests run in the
// browser on submit, in parallel: /api/preview (what an AI answers, ~20s) leads
// the page because it is the finding people care about, /api/scan (can the AI
// read the site, ~1s) sits under it, compact, as the "why". A shared
// /check?url=… link re-runs both.
//
// Visuals follow GeoSuite's design system (geo/design-system/geosuite/MASTER.md):
// Inter, flat surfaces with one-pixel lines, magenta only for the primary action
// and the visitor's own row, semantic colors always paired with text or an icon,
// light and dark both first-class. Token values are copied from
// frontend/assets/css/99-workspace-ds-sweep.css; keep them in step. The brand is
// text, like GeoSuite's own header: the official wordmark is white on
// transparent and must not be recolored for the light theme.
//
// The page ends on GeoSuite's free analysis: one question is a taste, the
// analysis asks many across several models, behind GeoSuite's own form.

import { WEIGHTS } from './check.js';

const BASE = 'https://tools.trygeosuite.it';
const ANALYSIS = 'https://trygeosuite.it/analisi-gratuita';

const TOOL_LINKS = {
  crawlers: 'https://ai-crawl-check.geosuite.workers.dev',
  llms: 'https://llmstxt-generator.geosuite.workers.dev',
  schema: 'https://schema-templates.geosuite.workers.dev',
  sitemap: 'https://sitemap-builder.geosuite.workers.dev',
};

// A real result, shown before the visitor runs one, so they know what they get.
// Recorded on 05/10/2026 from this tool; refresh it if the names drift.
const EXAMPLE = {
  site: 'decathlon.it',
  question: {
    it: 'Dove posso comprare online articoli sportivi e attrezzatura per tanti sport diversi in Italia?',
    en: 'Where can I buy sports gear online for lots of different sports in Italy?',
  },
  names: ['Decathlon', 'Cisalfa Sport', 'Intersport'],
  you: 0,
};

// Server-rendered copy: plain strings only.
const S = {
  en: {
    title: 'Does AI recommend you, or your competitors? Free check',
    desc: 'Enter your site: we ask an AI the question your customers ask and show who it recommends, then check whether AI can read your site. Free, no sign-up.',
    tools: 'Free tools',
    eyebrow: 'A free tool by GeoSuite',
    h1: 'Does AI recommend you, or your competitors?',
    lead: 'Enter your site: we ask an AI the question your customers ask, and show you who it recommends.',
    label: 'Your website',
    placeholder: 'yoursite.com',
    run: 'Ask the AI',
    facts: ['Free', 'No sign-up', 'About 20 seconds'],
    exampleLabel: 'Real example',
    exampleDate: '5 October 2026',
    exampleVerdict: 'Named first in both answers',
    you: 'you',
    answerHead: 'The AI’s answer',
    readHead: 'Can AI read your site?',
    readMore: 'What we checked',
    ctaTitle: 'One question is a taste. The full picture is free too.',
    ctaText: 'GeoSuite asks ChatGPT, Gemini and Perplexity the questions your customers really ask, and tells you where you appear, who wins instead and what to fix first. The report arrives by email.',
    ctaButton: 'Get the free analysis',
    share: 'Copy link to this result',
    ownLabel: 'Try your own question',
    ownPlaceholder: 'e.g. What are the best tools to see if ChatGPT recommends my company?',
    ownButton: 'Ask',
    footer: 'A free tool by <a href="https://trygeosuite.it">GeoSuite</a>, the Italian platform for AI visibility. <a href="https://github.com/TryGeoSuite/geo-toolkit">Open source</a> (MIT). We read only the public pages of the site you enter.',
  },
  it: {
    title: 'Le AI consigliano te o i tuoi concorrenti? Controllo gratuito',
    desc: 'Inserisci il tuo sito: facciamo a un’AI la domanda dei tuoi clienti e ti mostriamo chi consiglia, poi controlliamo se le AI riescono a leggere il sito. Gratis, senza registrazione.',
    tools: 'Strumenti gratuiti',
    eyebrow: 'Uno strumento gratuito di GeoSuite',
    h1: 'Le AI consigliano te o i tuoi concorrenti?',
    lead: 'Inserisci il tuo sito: facciamo all’AI la domanda dei tuoi clienti e ti mostriamo chi consiglia.',
    label: 'Il tuo sito',
    placeholder: 'tuosito.it',
    run: 'Chiedi all’AI',
    facts: ['Gratis', 'Senza registrazione', 'Circa 20 secondi'],
    exampleLabel: 'Esempio reale',
    exampleDate: '5 ottobre 2026',
    exampleVerdict: 'Nominato per primo in entrambe le risposte',
    you: 'tu',
    answerHead: 'La risposta dell’AI',
    readHead: 'Le AI riescono a leggere il tuo sito?',
    readMore: 'Cosa abbiamo controllato',
    ctaTitle: 'Una domanda è un assaggio. Anche il quadro completo è gratis.',
    ctaText: 'GeoSuite fa a ChatGPT, Gemini e Perplexity le domande che i tuoi clienti fanno davvero, e ti dice dove compari, chi vince al posto tuo e cosa correggere per primo. Il report arriva via mail.',
    ctaButton: 'Richiedi l’analisi gratuita',
    share: 'Copia il link a questo risultato',
    ownLabel: 'Prova con la tua domanda',
    ownPlaceholder: 'Es. Quali strumenti mi dicono se ChatGPT consiglia la mia azienda?',
    ownButton: 'Chiedi',
    footer: 'Uno strumento gratuito di <a href="https://trygeosuite.it">GeoSuite</a>, la piattaforma italiana per la visibilità sulle AI. <a href="https://github.com/TryGeoSuite/geo-toolkit">Open source</a> (MIT). Leggiamo solo le pagine pubbliche del sito che inserisci.',
  },
};

// Client copy: strings and small functions, shipped as source (see serialize).
const C = {
  en: {
    run: 'Ask the AI',
    running: 'Asking…',
    copied: 'Link copied',
    stages: ['Reading your site to understand what you sell…', 'Asking the AI your customers’ question, twice, with a web search…', 'Comparing the two answers with your site…'],
    verdict: (pos, mentions, total, brand) => {
      const who = brand || 'your site';
      if (pos && mentions === total && total > 1) return [`The AI names ${who} in both answers`, `At number ${pos} among the five it recommends to someone looking for what you sell.`];
      if (pos) return [`The AI names ${who} in ${mentions} answer out of ${total}`, `At number ${pos} overall: not a stable recommendation yet.`];
      if (mentions) return [`The AI names ${who} once, but not in the top five`, 'Someone asking this question would most likely see these names first.'];
      return [`The AI does not name ${who}`, 'To someone looking for what you sell, it recommends these instead.'];
    },
    you: 'you',
    both: 'in both answers',
    method: (m, total, web) => `${total > 1 ? `${total} answers` : 'One answer'} from ${m}${web ? ' with a web search, like ChatGPT' : ''}. Names that come back every time come first. Answers vary between questions and models: this is a sample, not a measurement.`,
    names: { crawlers: 'AI crawlers', schema: 'Structured data', llms: 'llms.txt', sitemap: 'Sitemap' },
    state: { ok: 'OK', partial: 'Partial', missing: 'Missing', refused: 'Not measurable' },
    fix: 'Fix it free',
    open: 'Open the tool',
    errors: {
      invalid_url: 'Enter a public website address, like yoursite.com.',
      unreachable: 'The site did not answer. Check the address and try again.',
      generic: 'Something went wrong. Try again in a minute.',
      limit: 'You have used today’s free AI answers. The technical check below still works, and the full analysis has no such limit.',
      busy: 'Too many requests today: the AI answer is paused until tomorrow. The technical check below still works.',
      unclear: 'From your home page we could not tell what you sell, so we could not ask the question.',
      names_site: 'Your question names the site itself: ask it the way a customer who does not know you yet would.',
      bad_question: 'Write a question between 10 and 500 characters, without your site\u2019s name.',
    },
    ownNote: 'You wrote this question.',
    cachedOn: (d) => ` This answer was given on ${d} and is kept for 7 days.`,
    crawlersOk: (n) => `${n} AI crawlers allowed, none of the main ones blocked.`,
    crawlersBlocked: (list, more) => `Blocked: ${list}${more ? ` and ${more} more` : ''}.`,
    crawlersManaged: (list) => `A managed section (e.g. Cloudflare) overrides your robots.txt and blocks: ${list}.`,
    crawlersNone: 'Could not read robots.txt, so the crawlers’ verdict is unknown.',
    crawlersWall: (st) => ` But robots.txt itself answered HTTP ${st}: the standard reads that as “all allowed”, in practice it is often a bot wall.`,
    schemaEntity: (types) => `Found: ${types}. AI models can tell who you are.`,
    schemaGeneric: (types) => `Found: ${types}, but nothing that says who you are (Organization, LocalBusiness, Product…).`,
    schemaNone: 'No JSON-LD on the home page: models have to guess who you are from the text.',
    schemaInvalid: (n) => ` ${n} block(s) are not valid JSON and get ignored.`,
    llmsOk: (n) => `Present and well formed${n ? `, ${n} links` : ''}.`,
    llmsBad: 'Present, but it does not start with a “# Title” line as the standard requires.',
    llmsNone: 'No /llms.txt: the index that tells models which pages matter.',
    sitemapOk: (n, idx) => (idx ? `Sitemap index found (${n} sitemaps).` : `Found, ${n} URLs.`),
    sitemapNone: 'No sitemap found in robots.txt or at /sitemap.xml.',
    refused: (st) => (st ? `Your home page refused our reader (HTTP ${st}), so we could not check this and left it out of the score. A wall like that often stops AI crawlers too.` : 'Your home page did not answer in time, so we could not check this and left it out of the score.'),
  },
  it: {
    run: 'Chiedi all’AI',
    running: 'Un momento…',
    copied: 'Link copiato',
    stages: ['Leggiamo il tuo sito per capire cosa vendi…', 'Facciamo all’AI la domanda dei tuoi clienti, due volte, con una ricerca web…', 'Confrontiamo le due risposte con il tuo sito…'],
    verdict: (pos, mentions, total, brand) => {
      const who = brand || 'il tuo sito';
      if (pos && mentions === total && total > 1) return [`L’AI nomina ${who} in entrambe le risposte`, `Al ${pos}° posto fra i cinque che consiglia a chi cerca quello che vendi.`];
      if (pos) return [`L’AI nomina ${who} in ${mentions} risposta su ${total}`, `Al ${pos}° posto nel complesso: non è ancora una raccomandazione stabile.`];
      if (mentions) return [`L’AI nomina ${who} una volta, ma non fra i primi cinque`, 'Chi fa questa domanda vede prima, con ogni probabilità, questi nomi.'];
      return [`L’AI non nomina ${who}`, 'A chi cerca quello che vendi consiglia invece questi.'];
    },
    you: 'tu',
    both: 'in entrambe le risposte',
    method: (m, total, web) => `${total > 1 ? `${total} risposte` : 'Una risposta'} di ${m}${web ? ' con ricerca web, come fa ChatGPT' : ''}. Prima i nomi che tornano ogni volta. Le risposte cambiano fra una domanda e l’altra e fra un modello e l’altro: è un campione, non una misura.`,
    names: { crawlers: 'Crawler AI', schema: 'Dati strutturati', llms: 'llms.txt', sitemap: 'Sitemap' },
    state: { ok: 'OK', partial: 'Parziale', missing: 'Manca', refused: 'Non misurabile' },
    fix: 'Correggilo gratis',
    open: 'Apri lo strumento',
    errors: {
      invalid_url: 'Scrivi l’indirizzo di un sito pubblico, per esempio tuosito.it.',
      unreachable: 'Il sito non ha risposto. Controlla l’indirizzo e riprova.',
      generic: 'Qualcosa non ha funzionato. Riprova fra un minuto.',
      limit: 'Hai usato le risposte AI gratuite di oggi. Il controllo tecnico qui sotto funziona lo stesso, e l’analisi completa non ha questo limite.',
      busy: 'Troppe richieste oggi: la risposta AI riprende domani. Il controllo tecnico qui sotto funziona lo stesso.',
      unclear: 'Dalla tua home non capiamo cosa vendi, quindi non abbiamo potuto fare la domanda.',
      names_site: 'La domanda nomina il sito stesso: falla come la farebbe un cliente che ancora non ti conosce.',
      bad_question: 'Scrivi una domanda fra 10 e 500 caratteri, senza il nome del tuo sito.',
    },
    ownNote: 'La domanda l\u2019hai scritta tu.',
    cachedOn: (d) => ` Questa risposta è del ${d} e viene conservata per 7 giorni.`,
    crawlersOk: (n) => `${n} crawler AI ammessi, nessuno dei principali bloccato.`,
    crawlersBlocked: (list, more) => `Bloccati: ${list}${more ? ` e altri ${more}` : ''}.`,
    crawlersManaged: (list) => `Una sezione gestita (per esempio Cloudflare) scavalca il tuo robots.txt e blocca: ${list}.`,
    crawlersNone: 'Non siamo riusciti a leggere il robots.txt, quindi il verdetto sui crawler non è noto.',
    crawlersWall: (st) => ` Però il robots.txt stesso ha risposto HTTP ${st}: lo standard lo legge come «tutto permesso», in pratica spesso è un muro anti-bot.`,
    schemaEntity: (types) => `Trovati: ${types}. Le AI capiscono chi sei.`,
    schemaGeneric: (types) => `Trovati: ${types}, ma niente che dica chi sei (Organization, LocalBusiness, Product…).`,
    schemaNone: 'Nessun JSON-LD in home: le AI devono indovinare chi sei dal testo.',
    schemaInvalid: (n) => ` ${n} blocchi non sono JSON valido e vengono ignorati.`,
    llmsOk: (n) => `Presente e ben formato${n ? `, ${n} link` : ''}.`,
    llmsBad: 'Presente, ma non inizia con una riga “# Titolo” come chiede lo standard.',
    llmsNone: 'Manca /llms.txt: l’indice che dice alle AI quali pagine contano.',
    sitemapOk: (n, idx) => (idx ? `Trovato un indice di sitemap (${n} sitemap).` : `Trovata, ${n} URL.`),
    sitemapNone: 'Nessuna sitemap nel robots.txt né su /sitemap.xml.',
    refused: (st) => (st ? `La tua home ha rifiutato la lettura (HTTP ${st}), quindi non abbiamo potuto controllarla e l\u2019abbiamo esclusa dal voto. Un muro così spesso ferma anche i crawler AI.` : 'La tua home non ha risposto in tempo, quindi non abbiamo potuto controllarla e l\u2019abbiamo esclusa dal voto.'),
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// JSON cannot carry functions, so the client dictionary is written as source.
function serialize(v) {
  if (typeof v === 'function') return v.toString();
  if (Array.isArray(v)) return '[' + v.map(serialize).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}:${serialize(x)}`).join(',') + '}';
  return JSON.stringify(v);
}

function jsonLd(t, lang) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'AI Readiness Check',
    url: `${BASE}/${lang}/check`,
    description: t.desc,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@type': 'Organization', name: 'GeoSuite', url: 'https://trygeosuite.it' },
  }).replace(/</g, '\\u003c');
}

// Inline SVG status icons: state is never color alone (MASTER.md).
const ICONS = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M6 10.5l2.6 2.6L14 7.7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  partial: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M6 10h8" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
  missing: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M7 7l6 6M13 7l-6 6" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
};

function exampleCard(t, lang) {
  const rows = EXAMPLE.names
    .map((n, i) => `<li${i === EXAMPLE.you ? ' class="you"' : ''}><span class="n">${i + 1}</span><span class="name">${esc(n)}${i === EXAMPLE.you ? ` <span class="tag">${t.you}</span>` : ''}</span></li>`)
    .join('');
  return `<figure class="example" id="example" aria-label="${t.exampleLabel}">
      <figcaption><span class="label">${t.exampleLabel}</span> <span class="ex-meta">${EXAMPLE.site} · ${t.exampleDate}</span></figcaption>
      <p class="q">“${esc(EXAMPLE.question[lang] || EXAMPLE.question.en)}”</p>
      <p class="ex-verdict">${ICONS.ok}<span>${t.exampleVerdict}</span></p>
      <ol class="recs compact">${rows}</ol>
    </figure>`;
}

// lang: 'en' | 'it'. initialUrl: the ?url= of a shared link, or ''.
// initialQuestion: the ?q= of a shared link, the visitor's own question.
export function renderCheckPage(lang, initialUrl, initialQuestion = '') {
  const t = S[lang] || S.en;
  const config = { lang, weights: WEIGHTS, tools: TOOL_LINKS, analysis: ANALYSIS, icons: ICONS, q: String(initialQuestion || '').slice(0, 500) };

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${BASE}/${lang}/check">
<link rel="alternate" hreflang="en" href="${BASE}/en/check">
<link rel="alternate" hreflang="it" href="${BASE}/it/check">
<link rel="alternate" hreflang="x-default" href="${BASE}/check">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GeoSuite">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${BASE}/${lang}/check">
<meta property="og:image" content="${BASE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${jsonLd(t, lang)}</script>
<style>
  :root {
    --bg:#f4f5f7; --surface:#fff; --surface-2:#f8f9fb; --sunk:#eef0f3;
    --ink:#111318; --ink-2:#424854; --ink-3:#596474;
    --line:#e5e7eb; --line-2:#d8dce2;
    --accent:#e0327d; --accent-deep:#b81862; --accent-soft:#fdeaf3; --accent-ink:#a3105a; --on-accent:#fff;
    --ok:#127348; --ok-soft:#e7f6ec; --warn:#875000; --warn-soft:#fbf1de; --crit:#bd2838; --crit-soft:#fdeaeb;
    --shadow:0 1px 2px rgba(17,19,24,.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#111318; --surface:#181b21; --surface-2:#20242c; --sunk:#0d0f13;
      --ink:#f5f7fa; --ink-2:#c5cad3; --ink-3:#979eaa;
      --line:#282d36; --line-2:#353c48;
      --accent:#f2529a; --accent-deep:#b81862; --accent-soft:#2a1420; --accent-ink:#f7a6cb;
      --ok:#39c877; --ok-soft:#12241a; --warn:#e0a53c; --warn-soft:#27200f; --crit:#f0666d; --crit-soft:#2a1416;
      --shadow:0 1px 2px rgba(0,0,0,.28);
    }
  }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing:antialiased; }
  a { color:var(--accent-ink); }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
  .wrap { max-width:880px; margin:0 auto; padding:0 16px 64px; }

  .bar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0; }
  .brand { color:var(--ink); text-decoration:none; font-size:19px; font-weight:700; letter-spacing:-.035em; }
  .bar nav { display:flex; align-items:center; gap:4px; font-size:.875rem; }
  .bar nav a { color:var(--ink-3); text-decoration:none; padding:6px 10px; border-radius:8px; min-height:32px; display:inline-flex; align-items:center; }
  .bar nav a:hover { color:var(--ink); background:var(--sunk); }
  .bar nav a[aria-current="page"] { color:var(--ink); background:var(--surface); box-shadow:inset 0 0 0 1px var(--line); }

  .hero { display:grid; grid-template-columns:1fr; gap:32px; padding:40px 0 8px; align-items:start; }
  @media (min-width:900px) { .wrap { max-width:1080px; } .hero { grid-template-columns:1.15fr 1fr; gap:48px; } }
  .eyebrow { display:inline-block; font-size:.8125rem; font-weight:600; color:var(--accent-ink); background:var(--accent-soft); padding:4px 10px; border-radius:999px; margin:0 0 16px; }
  h1 { font-size:clamp(2rem, 4.6vw, 3rem); line-height:1.08; letter-spacing:-.03em; margin:0 0 14px; text-wrap:balance; }
  .lead { color:var(--ink-2); font-size:1.125rem; margin:0 0 24px; max-width:48ch; }
  #f { display:flex; gap:8px; }
  #f label { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  input { flex:1; min-width:0; height:52px; background:var(--surface); border:1px solid var(--line-2); color:var(--ink); border-radius:8px; padding:0 16px; font:inherit; font-size:1.0625rem; }
  input::placeholder { color:var(--ink-3); }
  button { font:inherit; cursor:pointer; }
  .primary { height:52px; padding:0 22px; border:0; border-radius:8px; background:var(--accent-deep); color:var(--on-accent); font-weight:600; white-space:nowrap; min-width:150px; }
  .primary:hover { background:#9a1352; }
  .primary[disabled] { opacity:.65; cursor:progress; }
  .facts { display:flex; flex-wrap:wrap; gap:6px 16px; list-style:none; margin:14px 0 0; padding:0; color:var(--ink-3); font-size:.875rem; }
  .facts li { display:flex; align-items:center; gap:6px; }
  .facts svg { width:14px; height:14px; } .facts svg circle { fill:var(--ok); } .facts svg path { stroke:#fff; }
  .err { color:var(--crit); margin:12px 0 0; min-height:1.5em; font-size:.9375rem; }

  .panel, .example { background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); }
  .label { font-size:.75rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); margin:0; }
  .q { font-size:1.0625rem; font-weight:500; color:var(--ink); margin:12px 0 16px; padding-left:14px; border-left:3px solid var(--line-2); }

  .example { padding:20px; }
  .example figcaption { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
  .ex-meta { color:var(--ink-3); font-size:.8125rem; }
  .ex-verdict { display:flex; gap:8px; align-items:center; font-weight:600; margin:0 0 12px; }
  .ex-verdict svg { width:18px; height:18px; flex:none; } .ex-verdict svg circle { fill:var(--ok); } .ex-verdict svg path { stroke:#fff; }
  .example[hidden], section[hidden], div[hidden] { display:none; }

  .answer { margin-top:32px; padding:24px; }
  .verdict { display:flex; gap:12px; align-items:flex-start; padding:16px; border-radius:8px; margin:0 0 16px; }
  .verdict svg { flex:none; width:24px; height:24px; margin-top:2px; }
  .verdict strong { display:block; font-size:1.25rem; line-height:1.3; letter-spacing:-.01em; }
  .verdict span { display:block; color:var(--ink-2); font-size:.9375rem; margin-top:2px; }
  .verdict.yes { background:var(--ok-soft); } .verdict.yes svg circle { fill:var(--ok); } .verdict.yes svg path { stroke:#fff; }
  .verdict.mid { background:var(--warn-soft); } .verdict.mid svg circle { fill:var(--warn); } .verdict.mid svg path { stroke:#fff; }
  .verdict.no { background:var(--crit-soft); } .verdict.no svg circle { fill:var(--crit); } .verdict.no svg path { stroke:#fff; }

  ol.recs { list-style:none; margin:0; padding:0; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  ol.recs li { display:grid; grid-template-columns:28px 1fr auto; align-items:start; gap:12px; padding:12px 14px; border-top:1px solid var(--line); }
  ol.recs li:first-child { border-top:0; }
  ol.recs .n { font-variant-numeric:tabular-nums; font-weight:600; color:var(--ink-3); text-align:center; line-height:1.5; }
  ol.recs .name { font-weight:600; min-width:0; overflow-wrap:anywhere; }
  ol.recs .why { display:block; font-weight:400; color:var(--ink-2); font-size:.875rem; margin-top:2px; }
  ol.recs .side { text-align:right; font-size:.8125rem; color:var(--ink-3); white-space:nowrap; line-height:1.5; }
  ol.recs .both { display:block; color:var(--ok); font-weight:500; }
  ol.recs li.you { background:var(--accent-soft); }
  ol.recs li.you .n, ol.recs li.you .name { color:var(--accent-ink); }
  ol.recs.compact li { grid-template-columns:28px 1fr; padding:10px 12px; }
  .tag { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:var(--accent-deep); color:var(--on-accent); font-size:.75rem; font-weight:600; vertical-align:2px; }
  .method { color:var(--ink-3); font-size:.8125rem; margin:14px 0 0; }
  .stages { list-style:none; margin:16px 0 0; padding:0; }
  .stages li { display:flex; gap:10px; align-items:center; color:var(--ink-3); padding:6px 0; }
  .stages li::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--line-2); flex:none; }
  .stages li.on { color:var(--ink); } .stages li.on::before { background:var(--accent); animation:pulse 1.2s ease-in-out infinite; }
  .stages li.done { color:var(--ink-2); } .stages li.done::before { background:var(--ok); }
  @keyframes pulse { 50% { opacity:.35; } }
  .notice { color:var(--ink-2); margin:12px 0 0; }
  .own { margin-top:20px; padding-top:16px; border-top:1px solid var(--line); }
  .own label { display:block; font-size:.875rem; font-weight:600; color:var(--ink-2); margin-bottom:8px; }
  .own .row { display:flex; gap:8px; width:100%; }
  .own input { flex:1; }
  .own input { height:44px; font-size:.9375rem; }
  .own button { height:44px; min-width:96px; }
  .own-note { display:inline-block; font-size:.75rem; font-weight:600; color:var(--accent-ink); background:var(--accent-soft); padding:2px 8px; border-radius:999px; margin:0 0 8px; }
  @media (max-width:640px) { .own .row { flex-direction:column; } }

  .read { margin-top:16px; }
  .read-head { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 24px; }
  .read-head h2 { font-size:1.0625rem; margin:0 0 10px; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; list-style:none; margin:0; padding:0; }
  .chips li { display:inline-flex; align-items:center; gap:6px; padding:4px 10px 4px 6px; border-radius:999px; background:var(--sunk); font-size:.8125rem; font-weight:500; }
  .chips svg { width:16px; height:16px; } .chips svg path { stroke:#fff; }
  .chips .ok svg circle { fill:var(--ok); } .chips .partial svg circle { fill:var(--warn); } .chips .missing svg circle { fill:var(--crit); }
  .score { font-variant-numeric:tabular-nums; font-size:2.25rem; font-weight:700; letter-spacing:-.02em; line-height:1; white-space:nowrap; }
  .score small { font-size:.875rem; font-weight:500; color:var(--ink-3); }
  details { border-top:1px solid var(--line); }
  summary { cursor:pointer; padding:14px 24px; color:var(--ink-2); font-size:.875rem; font-weight:500; list-style:none; display:flex; align-items:center; gap:8px; }
  summary::-webkit-details-marker { display:none; }
  summary::before { content:""; width:6px; height:6px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(-45deg); transition:transform .15s; }
  details[open] summary::before { transform:rotate(45deg); }
  ul.checks { list-style:none; margin:0; padding:0; }
  ul.checks li { display:grid; grid-template-columns:20px 1fr auto; gap:12px; padding:14px 24px; border-top:1px solid var(--line); }
  ul.checks svg { width:20px; height:20px; margin-top:2px; } ul.checks svg path { stroke:#fff; }
  ul.checks .ok svg circle { fill:var(--ok); } ul.checks .partial svg circle { fill:var(--warn); } ul.checks .missing svg circle { fill:var(--crit); }
  ul.checks .t { font-weight:600; }
  ul.checks .st { font-weight:500; font-size:.8125rem; margin-left:6px; }
  ul.checks .ok .st { color:var(--ok); } ul.checks .partial .st { color:var(--warn); } ul.checks .missing .st { color:var(--crit); }
  ul.checks .d { color:var(--ink-2); font-size:.9375rem; margin-top:2px; overflow-wrap:anywhere; }
  ul.checks .side { text-align:right; font-size:.875rem; white-space:nowrap; }
  ul.checks .pts { font-variant-numeric:tabular-nums; color:var(--ink-3); display:block; }
  ul.checks .side a { display:inline-block; margin-top:4px; font-weight:600; text-decoration:none; }
  ul.checks .side a:hover { text-decoration:underline; }

  .cta { margin-top:16px; padding:28px; display:grid; grid-template-columns:1fr auto; gap:24px; align-items:center; }
  .cta h2 { font-size:1.375rem; line-height:1.25; margin:0 0 8px; letter-spacing:-.015em; }
  .cta p { color:var(--ink-2); margin:0; max-width:58ch; }
  .engines { display:flex; align-items:center; gap:14px; margin-top:16px; color:var(--ink-3); font-size:.8125rem; flex-wrap:wrap; }
  .engines span { display:inline-flex; align-items:center; gap:6px; color:var(--ink-2); font-weight:500; }
  .engines img { width:20px; height:20px; display:block; }
  .cta a.primary { display:inline-flex; align-items:center; text-decoration:none; }
  .sharebar { margin-top:12px; text-align:right; }
  .ghost { background:none; border:1px solid var(--line-2); color:var(--ink-2); border-radius:8px; padding:8px 12px; font-size:.875rem; min-height:36px; }
  .ghost:hover { color:var(--ink); border-color:var(--ink-3); }

  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line); color:var(--ink-3); font-size:.8125rem; }
  footer a { color:var(--ink-2); }

  @media (max-width:640px) {
    .hero { padding-top:20px; }
    #f { flex-direction:column; }
    .primary { width:100%; }
    .answer { padding:18px; }
    ol.recs li { grid-template-columns:24px 1fr; }
    ol.recs .side { grid-column:2; text-align:left; }
    .read-head { align-items:flex-start; padding:18px; }
    summary { padding-left:18px; }
    ul.checks li { grid-template-columns:20px 1fr; padding-left:18px; padding-right:18px; }
    ul.checks .side { grid-column:2; text-align:left; }
    .cta { grid-template-columns:1fr; padding:20px; }
    .cta a.primary { justify-content:center; }
  }
  @media (prefers-reduced-motion: reduce) { .stages li.on::before { animation:none; } summary::before { transition:none; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <a class="brand" href="https://trygeosuite.it">GeoSuite</a>
    <nav aria-label="Language">
      <a href="/${lang}">${t.tools}</a>
      <a href="/en/check"${lang === 'en' ? ' aria-current="page"' : ''} hreflang="en">EN</a>
      <a href="/it/check"${lang === 'it' ? ' aria-current="page"' : ''} hreflang="it">IT</a>
    </nav>
  </header>

  <main>
    <div class="hero">
      <div>
        <p class="eyebrow">${t.eyebrow}</p>
        <h1>${t.h1}</h1>
        <p class="lead">${t.lead}</p>
        <form id="f" novalidate>
          <label for="u">${t.label}</label>
          <input id="u" name="url" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="${t.placeholder}" value="${esc(initialUrl)}" required>
          <button class="primary" id="go" type="submit">${t.run}</button>
        </form>
        <ul class="facts">${t.facts.map((f) => `<li>${ICONS.ok}${f}</li>`).join('')}</ul>
        <p class="err" id="err" role="alert"></p>
      </div>
      ${exampleCard(t, lang)}
    </div>

    <section class="panel answer" id="answer" hidden aria-live="polite" aria-labelledby="answer-label">
      <p class="label" id="answer-label">${t.answerHead}</p>
      <div id="answer-body"></div>
      <form class="own" id="own" hidden novalidate>
        <label for="own-q">${t.ownLabel}</label>
        <div class="row">
          <input id="own-q" type="text" maxlength="500" placeholder="${esc(t.ownPlaceholder)}" value="${esc(String(initialQuestion || '').slice(0, 500))}">
          <button class="primary" id="own-go" type="submit">${t.ownButton}</button>
        </div>
      </form>
    </section>

    <section class="panel read" id="read" hidden aria-labelledby="read-title">
      <div class="read-head">
        <div><h2 id="read-title">${t.readHead}</h2><ul class="chips" id="chips"></ul></div>
        <div class="score" id="score"></div>
      </div>
      <details><summary>${t.readMore}</summary><ul class="checks" id="checks"></ul></details>
    </section>

    <section class="panel cta" id="cta" hidden>
      <div>
        <h2>${t.ctaTitle}</h2>
        <p>${t.ctaText}</p>
        <div class="engines" aria-hidden="true">
          <span><img src="/logos/chatgpt.svg" alt="">ChatGPT</span>
          <span><img src="/logos/gemini.svg" alt="">Gemini</span>
          <span><img src="/logos/perplexity.svg" alt="">Perplexity</span>
        </div>
      </div>
      <a class="primary" id="cta-link" href="${ANALYSIS}" target="_blank" rel="noopener">${t.ctaButton}</a>
    </section>
    <div class="sharebar" id="sharebar" hidden><button type="button" class="ghost" id="share">${t.share}</button></div>
  </main>

  <footer>${t.footer}</footer>
</div>
<script>
(function () {
  var CFG = ${JSON.stringify(config)};
  var T = ${serialize(C[lang] || C.en)};
  var $ = function (id) { return document.getElementById(id); };
  var ORDER = ['crawlers', 'schema', 'llms', 'sitemap'];
  var run = 0, stageTimer = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function host(u) { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).host.replace(/^www[.]/, ''); } catch (e) { return ''; } }
  function icon(kind) { var s = el('span'); s.innerHTML = CFG.icons[kind]; return s.firstChild; }

  // ---- the AI's answer ----
  function showStages() {
    var body = $('answer-body'); body.textContent = '';
    var ul = el('ul', 'stages');
    T.stages.forEach(function (s) { ul.appendChild(el('li', null, s)); });
    body.appendChild(ul);
    var items = ul.children, i = 0;
    items[0].className = 'on';
    // Stages advance on time, not on events: the server answers once. The last
    // one stays on until the answer arrives.
    clearInterval(stageTimer);
    stageTimer = setInterval(function () {
      if (i >= items.length - 1) return;
      items[i].className = 'done'; i++; items[i].className = 'on';
    }, 5000);
    $('answer').hidden = false;
  }

  function showAnswer(p) {
    clearInterval(stageTimer);
    $('own').hidden = false;
    var body = $('answer-body'); body.textContent = '';
    if (p.error) {
      if (T.errors[p.error]) body.appendChild(el('p', 'notice', T.errors[p.error]));
      else $('answer').hidden = true;
      return;
    }
    if (p.ownQuestion) body.appendChild(el('span', 'own-note', T.ownNote));
    body.appendChild(el('p', 'q', '\\u201C' + p.question + '\\u201D'));
    var total = p.totalRuns || 1, mentions = p.mentions || 0;
    var tone = p.position && mentions === total ? 'yes' : mentions ? 'mid' : 'no';
    var words = T.verdict(p.position, mentions, total, p.brand);
    var v = el('div', 'verdict ' + tone);
    v.appendChild(icon(tone === 'yes' ? 'ok' : tone === 'mid' ? 'partial' : 'missing'));
    var vt = el('div');
    vt.appendChild(el('strong', null, words[0]));
    vt.appendChild(el('span', null, words[1]));
    v.appendChild(vt);
    body.appendChild(v);
    var ol = el('ol', 'recs');
    p.recommendations.forEach(function (r, i) {
      var li = el('li', r.isYou ? 'you' : null);
      li.appendChild(el('span', 'n', String(i + 1)));
      var name = el('span', 'name', r.name);
      if (r.isYou) name.appendChild(el('span', 'tag', T.you));
      if (r.reason) name.appendChild(el('span', 'why', r.reason));
      li.appendChild(name);
      var side = el('span', 'side', host(r.website || ''));
      if (total > 1 && r.runs === total) side.appendChild(el('span', 'both', T.both));
      li.appendChild(side);
      ol.appendChild(li);
    });
    body.appendChild(ol);
    // A shared link may serve a cached answer: say when it was given, so an
    // answer from days ago never reads as today's.
    var when = p.cached && p.askedAt ? T.cachedOn(new Date(p.askedAt).toLocaleDateString(CFG.lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long' })) : '';
    body.appendChild(el('p', 'method', T.method(p.model, total, p.webSearch) + when));
  }

  // ---- can the AI read the site ----
  function stateOf(key, r) {
    if (key === 'schema' && r.points.schema == null) return 'refused';
    var pts = r.points[key], w = CFG.weights[key];
    return pts >= w ? 'ok' : pts > 0 ? 'partial' : 'missing';
  }

  function detail(key, r) {
    if (key === 'schema' && r.points.schema == null) return T.refused(r.access && r.access.status);
    if (key === 'crawlers') {
      var c = r.crawlers;
      if (c.score == null) return T.crawlersNone;
      if (c.managedBlock && c.managedBlock.blockedBotNames && c.managedBlock.blockedBotNames.length) return T.crawlersManaged(c.managedBlock.blockedBotNames.join(', '));
      var v = c.blocked.length ? T.crawlersBlocked(c.blocked.slice(0, 6).join(', '), Math.max(0, c.blocked.length - 6)) : T.crawlersOk(c.allowed);
      return [401, 403, 429].indexOf(c.fetchStatus) >= 0 ? v + T.crawlersWall(c.fetchStatus) : v;
    }
    if (key === 'schema') {
      var s = r.schema, types = s.types.slice(0, 6).join(', ');
      var base = !s.blocks ? T.schemaNone : s.entity ? T.schemaEntity(types) : T.schemaGeneric(types || 'JSON-LD');
      return s.invalid ? base + T.schemaInvalid(s.invalid) : base;
    }
    if (key === 'llms') return !r.llms.found ? T.llmsNone : r.llms.valid ? T.llmsOk(r.llms.links) : T.llmsBad;
    return r.sitemap.found ? T.sitemapOk(r.sitemap.urls, r.sitemap.index) : T.sitemapNone;
  }

  function showRead(r) {
    $('score').textContent = '';
    $('score').appendChild(document.createTextNode(String(r.points.total)));
    $('score').appendChild(el('small', null, ' / 100'));
    var chips = $('chips'), ul = $('checks');
    chips.textContent = ''; ul.textContent = '';
    ORDER.forEach(function (key) {
      var st = stateOf(key, r), look = st === 'refused' ? 'partial' : st;
      var chip = el('li', look);
      chip.appendChild(icon(look));
      chip.appendChild(document.createTextNode(T.names[key] + ' \\u00B7 ' + T.state[st]));
      chips.appendChild(chip);

      var li = el('li', look);
      li.appendChild(icon(look));
      var main = el('div');
      var t = el('div', 't', T.names[key]); t.appendChild(el('span', 'st', T.state[st])); main.appendChild(t);
      main.appendChild(el('div', 'd', detail(key, r)));
      li.appendChild(main);
      var side = el('div', 'side');
      side.appendChild(el('span', 'pts', (r.points[key] == null ? '\u2013' : r.points[key]) + ' / ' + CFG.weights[key]));
      var a = el('a', null, (st === 'ok' ? T.open : T.fix) + ' \\u2192');
      a.href = CFG.tools[key]; a.target = '_blank'; a.rel = 'noopener';
      side.appendChild(a);
      li.appendChild(side);
      ul.appendChild(li);
    });
    $('read').hidden = false;
  }

  function analysisUrl(origin) {
    var q = new URLSearchParams({ url: host(origin), utm_source: 'geosuite-open', utm_medium: 'tool', utm_campaign: 'ai-readiness-check' });
    return CFG.analysis + '?' + q.toString();
  }

  function get(path, value, q) {
    return fetch(path + '?url=' + encodeURIComponent(value) + '&lang=' + CFG.lang + (q ? '&q=' + encodeURIComponent(q) : '')).then(function (res) { return res.json(); });
  }

  var site = '', ownQ = CFG.q || '';
  function shareUrl() {
    return '/' + CFG.lang + '/check?url=' + encodeURIComponent(site) + (ownQ ? '&q=' + encodeURIComponent(ownQ) : '');
  }

  // The visitor's own question: only the AI answer runs again, the reading
  // check below does not depend on the question.
  function askOwn(q) {
    q = q.trim();
    if (!site || !q) return;
    ownQ = q;
    var me = ++run;
    $('own-go').disabled = true;
    showStages();
    get('/api/preview', site, q).then(function (p) { if (me === run) showAnswer(p); })
      .catch(function () { if (me === run) { clearInterval(stageTimer); $('answer-body').textContent = T.errors.generic; } })
      .then(function () { $('own-go').disabled = false; history.replaceState(null, '', shareUrl()); });
  }

  function start(value) {
    value = value.trim();
    $('err').textContent = '';
    if (!value) { $('err').textContent = T.errors.invalid_url; return; }
    var me = ++run;
    ['read', 'cta', 'sharebar'].forEach(function (id) { $(id).hidden = true; });
    $('example').hidden = true;
    $('go').disabled = true; $('go').textContent = T.running;
    showStages();
    $('answer').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

    var scan = get('/api/scan', value).then(function (r) {
      if (me !== run) return;
      if (r.error) {
        clearInterval(stageTimer);
        $('answer').hidden = true; $('example').hidden = false;
        $('err').textContent = T.errors[r.error] || T.errors.generic;
        return 'stop';
      }
      showRead(r);
      $('cta-link').href = analysisUrl(r.origin);
      $('cta').hidden = false; $('sharebar').hidden = false;
      site = host(r.origin);
      history.replaceState(null, '', shareUrl());
    }).catch(function () { if (me === run) $('err').textContent = T.errors.generic; });

    var answer = get('/api/preview', value, ownQ).then(function (p) {
      return scan.then(function (s) { if (me === run && s !== 'stop') showAnswer(p); });
    }).catch(function () { if (me === run) { clearInterval(stageTimer); $('answer').hidden = true; } });

    Promise.all([scan, answer]).then(function () {
      if (me !== run) return;
      $('go').disabled = false; $('go').textContent = T.run;
    });
  }

  $('f').addEventListener('submit', function (e) { e.preventDefault(); start($('u').value); });
  $('own').addEventListener('submit', function (e) { e.preventDefault(); askOwn($('own-q').value); });
  $('share').addEventListener('click', function () {
    var b = this, old = b.textContent;
    navigator.clipboard.writeText(location.href).then(function () {
      b.textContent = T.copied; setTimeout(function () { b.textContent = old; }, 1400);
    }).catch(function () {});
  });
  if ($('u').value) start($('u').value);
})();
</script>
</body>
</html>`;
}
