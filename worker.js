// "GeoSuite Open" landing — a static hub linking the free GEO tools + repos.
//
// The page is static except for ONE live figure in the header: the combined
// download count of the four hosted tools (all-time + last-month), as social
// proof. The four are npm-only; npm's downloads API is keyless, exact, and —
// unlike PyPI's pypistats — doesn't rate-limit, so we fetch it directly and keep
// a last-good copy in the Cache API so a blip never blanks the number.

import { PAGE } from './page.js';

const PKGS = [
  '@geosuite/ai-crawler-bots',
  '@geosuite/llms-txt-generator',
  '@geosuite/schema-templates',
  '@geosuite/sitemap-builder',
];

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

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

function render(stats) {
  // No numbers yet (cold cache + degraded npm): drop the line rather than show a zero.
  const line = stats
    ? `<p class="stats">⬇ <strong>${fmt(stats.total)}</strong> downloads · <strong>${fmt(stats.monthly)}</strong>/month across the toolkit</p>`
    : '';
  return PAGE.replace('{{STATS}}', line);
}

function html(body, maxAge) {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/') return new Response('Not found', { status: 404 });

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
      return html(render(stats), 3600);
    }

    // Degraded npm fetch: reuse the last good numbers (short TTL so we retry soon),
    // else serve the page with the line omitted.
    const cached = await cache.match(statsKey);
    if (cached) return html(render(await cached.json()), 600);
    return html(render(null), 300);
  },
};
