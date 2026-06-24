// "GeoSuite Open" landing — a static, bilingual (en/it) hub linking the free GEO
// tools + repos.
//
// Routes:
//   GET /     → locale picked from Accept-Language (it → Italian, else English)
//   GET /en   → English   |   GET /it → Italian
//
// The only dynamic bit is one live figure in the header: the combined download
// count of the four hosted tools (all-time + last-month), as social proof. The
// four are npm-only; npm's downloads API is keyless, exact, and — unlike PyPI's
// pypistats — doesn't rate-limit, so we fetch it directly and keep a last-good
// copy in the Cache API so a blip never blanks the number.

import { renderPage } from './page.js';

const PKGS = [
  '@geosuite/ai-crawler-bots',
  '@geosuite/llms-txt-generator',
  '@geosuite/schema-templates',
  '@geosuite/sitemap-builder',
];

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

function html(body, maxAge, extraHeaders) {
  return new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path !== '/' && path !== '/en' && path !== '/it') {
      return new Response('Not found', { status: 404 });
    }

    const lang = pickLang(request, path);
    // '/' is content-negotiated, so it must not be cached language-agnostically.
    const vary = path === '/' ? { vary: 'Accept-Language' } : undefined;

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
      return html(renderPage(lang, stats), 3600, vary);
    }

    // Degraded npm fetch: reuse the last good numbers (short TTL so we retry soon),
    // else serve the page with the figure omitted.
    const cached = await cache.match(statsKey);
    if (cached) return html(renderPage(lang, await cached.json()), 600, vary);
    return html(renderPage(lang, null), 300, vary);
  },
};
