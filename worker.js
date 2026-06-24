// "GeoSuite Open" landing — a static, bilingual (en/it) hub linking the free GEO
// tools + repos. It also dogfoods the toolkit: it serves a robots.txt that welcomes
// AI crawlers (so it scores 100 on its own AI Crawl Check), an llms.txt, a
// sitemap.xml and JSON-LD structured data.
//
// Page routes:
//   GET /     → locale picked from Accept-Language (it → Italian, else English)
//   GET /en   → English   |   GET /it → Italian
// Asset routes:
//   GET /og.png  /favicon.svg  /robots.txt  /llms.txt  /sitemap.xml
//
// The only dynamic bit is one live figure in the header: the combined download
// count of the four hosted tools (all-time + last-month), as social proof. The
// four are npm-only; npm's downloads API is keyless, exact, and — unlike PyPI's
// pypistats — doesn't rate-limit, so we fetch it directly and keep a last-good
// copy in the Cache API so a blip never blanks the number.

import { renderPage } from './page.js';
import OG_PNG from './og.png'; // bundled as ArrayBuffer via the wrangler "Data" rule

const BASE = 'https://tools.trygeosuite.it';

const PKGS = [
  '@geosuite/ai-crawler-bots',
  '@geosuite/llms-txt-generator',
  '@geosuite/schema-templates',
  '@geosuite/sitemap-builder',
];

// A geo "location pin" mark in the GeoSuite accent — inline SVG, no binary.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0f17"/><path d="M32 13c-8.3 0-15 6.4-15 14.6C17 38 32 51 32 51s15-13 15-23.4C47 19.4 40.3 13 32 13z" fill="#5b8def"/><circle cx="32" cy="27.5" r="5.6" fill="#0b0f17"/></svg>`;

// We practice what we preach: every crawler, AI included, is welcome.
const ROBOTS = `# GeoSuite Open — a GEO toolkit that's maximally legible to AI crawlers.
User-agent: *
Allow: /

Sitemap: ${BASE}/sitemap.xml
`;

// llmstxt.org format — generated in the spirit of our own llms-txt-generator.
const LLMS = `# GeoSuite Open

> Free, open-source tools for Generative Engine Optimization (GEO) — making your site legible to ChatGPT, Gemini, Claude and Perplexity. Zero dependencies.

## Tools

- [AI Crawl Check](https://ai-crawl-check.geosuite.workers.dev): see which AI crawlers your robots.txt allows or blocks, with an AI-visibility score.
- [llms.txt Generator](https://llmstxt-generator.geosuite.workers.dev): turn a sitemap.xml into an llms.txt.
- [Schema Templates](https://schema-templates.geosuite.workers.dev): copy-paste schema.org JSON-LD templates and validate structured data.
- [Sitemap Builder](https://sitemap-builder.geosuite.workers.dev): crawl a site and build a sitemap.xml.

## About

- [GeoSuite](https://trygeosuite.it): the AI-visibility platform behind these tools.
- [Source on GitHub](https://github.com/TryGeoSuite)
`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${BASE}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${BASE}/en"/>
    <xhtml:link rel="alternate" hreflang="it" href="${BASE}/it"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/"/>
  </url>
  <url><loc>${BASE}/en</loc></url>
  <url><loc>${BASE}/it</loc></url>
</urlset>
`;

// Returns a number, or null on failure / non-numeric upstream.
async function npmCount(pkg, range) {
  try {
    const r = await fetch(`https://api.npmjs.org/downloads/point/${range}/${pkg}`);
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.downloads === 'number' ? j.downloads : null;
  } catch {
    return null;
  }
}

async function combinedStats() {
  const today = new Date().toISOString().slice(0, 10);
  const [totals, monthlies] = await Promise.all([
    Promise.all(PKGS.map((p) => npmCount(p, `2015-01-01:${today}`))),
    Promise.all(PKGS.map((p) => npmCount(p, 'last-month'))),
  ]);
  const complete = !totals.includes(null) && !monthlies.includes(null);
  return {
    total: totals.reduce((a, b) => a + (b || 0), 0),
    monthly: monthlies.reduce((a, b) => a + (b || 0), 0),
    complete,
  };
}

// '/it' → 'it', '/en' → 'en', '/' → first Accept-Language tag (it → 'it', else 'en').
function pickLang(request, path) {
  if (path === '/it') return 'it';
  if (path === '/en') return 'en';
  const first = (request.headers.get('accept-language') || '').split(',')[0].trim().toLowerCase();
  return first.startsWith('it') ? 'it' : 'en';
}

function text(body, type, maxAge) {
  return new Response(body, {
    headers: { 'content-type': type, 'cache-control': `public, max-age=${maxAge}` },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Static assets (no analytics) ---
    if (path === '/og.png') {
      return new Response(OG_PNG, {
        headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
      });
    }
    if (path === '/favicon.svg') return text(FAVICON, 'image/svg+xml; charset=utf-8', 86400);
    if (path === '/robots.txt') return text(ROBOTS, 'text/plain; charset=utf-8', 86400);
    if (path === '/llms.txt') return text(LLMS, 'text/plain; charset=utf-8', 86400);
    if (path === '/sitemap.xml') return text(SITEMAP, 'application/xml; charset=utf-8', 86400);

    if (path !== '/' && path !== '/en' && path !== '/it') {
      return new Response('Not found', { status: 404 });
    }

    const lang = pickLang(request, path);

    // Privacy-light: locale + path + referrer host only, never visitor data.
    if (env && env.AE) {
      try {
        env.AE.writeDataPoint({
          indexes: [lang],
          blobs: [path, lang, (request.headers.get('referer') || '').replace(/^https?:\/\//, '').slice(0, 64)],
          doubles: [1],
        });
      } catch {
        // Never let analytics break the page.
      }
    }

    // '/' is content-negotiated, so it must not be cached language-agnostically.
    const vary = path === '/' ? { vary: 'Accept-Language' } : {};
    const htmlHeaders = (maxAge) => ({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
      ...vary,
    });

    const cache = caches.default;
    const statsKey = new Request(url.origin + '/__stats', { method: 'GET' });
    const stats = await combinedStats();

    if (stats.complete) {
      const payload = JSON.stringify({ total: stats.total, monthly: stats.monthly });
      ctx.waitUntil(
        cache.put(
          statsKey,
          new Response(payload, {
            headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=604800' },
          }),
        ),
      );
      return new Response(renderPage(lang, stats), { headers: htmlHeaders(3600) });
    }

    // Degraded npm fetch: reuse the last good numbers (short TTL so we retry soon),
    // else serve the page with the figure omitted.
    const cached = await cache.match(statsKey);
    if (cached) return new Response(renderPage(lang, await cached.json()), { headers: htmlHeaders(600) });
    return new Response(renderPage(lang, null), { headers: htmlHeaders(300) });
  },
};
