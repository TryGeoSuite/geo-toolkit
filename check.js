// "AI Readiness Check": one scan that runs the whole toolkit against a site.
//
// Four checks, each mapped to the free tool that fixes it:
//   crawlers  → AI Crawl Check (robots.txt verdicts, via the ai-crawl-check Worker)
//   llms.txt  → llms.txt Generator
//   schema    → Schema Templates (JSON-LD found on the home page)
//   sitemap   → Sitemap Builder
//
// The robots.txt analysis is NOT reimplemented here: it is asked to the
// ai-crawl-check Worker (service binding CRAWL, or its public URL as fallback),
// so the score is the same number that tool shows. Everything else is a plain
// fetch plus a parse, no AI, no cost per scan.
//
// It answers "can AI models read this site?". Whether they actually CITE it is
// a different question, measured by GeoSuite's free analysis, which is where
// the result page sends people.

const UA = 'geosuite-open-check/1.0 (+https://tools.trygeosuite.it/check)';
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const CRAWL_PUBLIC = 'https://ai-crawl-check.geosuite.workers.dev';

// Weights of the total score. They add up to 100 and are shown on the page,
// so a visitor can see why they got the number they got.
export const WEIGHTS = { crawlers: 40, schema: 25, llms: 20, sitemap: 15 };

// schema.org types that tell a model WHO the site is. Having JSON-LD is good;
// having one of these is what makes a brand recognizable as an entity.
const ENTITY_TYPES = new Set([
  'organization',
  'corporation',
  'localbusiness',
  'onlinestore',
  'store',
  'restaurant',
  'hotel',
  'professionalservice',
  'person',
  'product',
  'brand',
  'website',
]);

export function originOf(input) {
  let u = String(input || '').trim();
  if (!u) throw new Error('empty');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const url = new URL(u);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
  const host = url.hostname.toLowerCase();
  // A public domain only: no localhost, no bare names, no IP literals.
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local')) throw new Error('host');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) throw new Error('ip');
  return url.origin;
}

// Bot walls answer the same request 200 one moment and 403 the next (seen on
// decathlon.it, 05/10/2026: home 403, 200, 403 in three runs), so the score
// flipped between runs. One retry on the statuses a wall uses.
const WALL = new Set([0, 403, 429, 503]);

async function get(url) {
  const first = await getOnce(url);
  if (!WALL.has(first.status)) return first;
  await new Promise((r) => setTimeout(r, 400));
  return getOnce(url);
}

// GET with a timeout and a byte cap. Never throws: { status, body, type, error }.
async function getOnce(url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,text/plain,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    let body = '';
    if (res.status < 400) {
      const text = await res.text();
      body = text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
    }
    return { status: res.status, body, type, finalUrl: res.url || url, error: null };
  } catch (e) {
    return { status: 0, body: '', type: '', finalUrl: url, error: e && e.name === 'TimeoutError' ? 'timeout' : 'fetch' };
  }
}

const looksLikeHtml = (r) => r.type.includes('text/html') || /^\s*<(!doctype|html)/i.test(r.body);

// ---- pure parsers (exported for the tests) ---------------------------------

// Collect every @type in a JSON-LD value, walking @graph and nested objects.
function collectTypes(node, out) {
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const t = node['@type'];
  if (typeof t === 'string') out.add(t);
  else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && out.add(x));
  for (const [k, v] of Object.entries(node)) {
    if (k !== '@type' && v && typeof v === 'object') collectTypes(v, out);
  }
}

export function parseJsonLd(html) {
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set();
  let blocks = 0;
  let invalid = 0;
  let m;
  while ((m = re.exec(html))) {
    blocks++;
    try {
      collectTypes(JSON.parse(m[1].trim()), types);
    } catch {
      invalid++;
    }
  }
  const list = [...types].sort();
  const entity = list.some((t) => ENTITY_TYPES.has(t.replace(/^.*[/#]/, '').toLowerCase()));
  return { blocks, invalid, types: list, entity };
}

// llms.txt per llmstxt.org: plain text whose first line is an H1 ("# Name").
export function parseLlmsTxt(r) {
  if (r.status !== 200 || !r.body || looksLikeHtml(r)) return { found: false, valid: false, links: 0 };
  const firstLine = r.body.replace(/^﻿/, '').trimStart().split('\n', 1)[0];
  const links = (r.body.match(/^\s*-\s*\[[^\]]+\]\([^)]+\)/gm) || []).length;
  return { found: true, valid: /^#\s+\S/.test(firstLine), links };
}

export function sitemapUrlsFromRobots(robots) {
  return (robots.match(/^\s*sitemap\s*:\s*(\S+)/gim) || []).map((l) => l.replace(/^\s*sitemap\s*:\s*/i, '').trim());
}

export function parseSitemap(r) {
  if (r.status !== 200 || !r.body || !/<(urlset|sitemapindex)\b/i.test(r.body)) return null;
  return {
    index: /<sitemapindex\b/i.test(r.body),
    urls: (r.body.match(/<loc>/gi) || []).length,
  };
}

// Points of each check, 0..weight. Pure, so the page and the tests agree.
//
// The structured data is the one check read from the home page. When the home
// refuses us (a bot wall), it is not measurable rather than missing: schema is
// null and the total is rescaled on the other three, or a site behind a flaky
// wall would score 80 and 55 on two runs a minute apart.
export function scoreOf(result) {
  const s = {};
  s.crawlers = result.crawlers.score == null ? 0 : Math.round((result.crawlers.score / 100) * WEIGHTS.crawlers);
  s.llms = !result.llms.found ? 0 : result.llms.valid ? WEIGHTS.llms : Math.round(WEIGHTS.llms * 0.5);
  s.sitemap = result.sitemap.found ? WEIGHTS.sitemap : 0;
  if (result.access && result.access.refused) {
    s.schema = null;
    s.total = Math.round(((s.crawlers + s.llms + s.sitemap) / (100 - WEIGHTS.schema)) * 100);
    return s;
  }
  s.schema = !result.schema.blocks ? 0 : result.schema.entity ? WEIGHTS.schema : Math.round(WEIGHTS.schema * 0.6);
  s.total = s.crawlers + s.schema + s.llms + s.sitemap;
  return s;
}

// ---- the scan ---------------------------------------------------------------

async function crawlerVerdict(origin, env) {
  const path = '/api/check?url=' + encodeURIComponent(origin);
  const viaBinding = async () => {
    if (!env || !env.CRAWL) throw new Error('no binding');
    const res = await env.CRAWL.fetch('https://ai-crawl-check' + path);
    if (!res.ok && res.status !== 400) throw new Error('binding ' + res.status);
    return res;
  };
  try {
    // The binding is the normal path; the public URL covers `wrangler dev`,
    // where the other Worker is not running and the binding answers 503.
    const res = await viaBinding().catch(() =>
      fetch(CRAWL_PUBLIC + path, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS + 2000) }),
    );
    const j = await res.json();
    return {
      score: typeof j.score === 'number' ? j.score : null,
      fetchStatus: typeof j.fetchStatus === 'number' ? j.fetchStatus : null,
      blocked: (j.blocked || []).map((b) => b.name),
      // Bots the file does not mention are allowed too: count them, or a site
      // with a short robots.txt reads as "0 crawlers allowed".
      allowed: (j.allowed || []).length + (j.notSpecified || []).length,
      managedBlock: j.managedBlock || null,
      error: j.error || null,
    };
  } catch {
    return { score: null, fetchStatus: null, blocked: [], allowed: 0, managedBlock: null, error: 'unavailable' };
  }
}

async function sitemapCheck(origin, robotsBody) {
  const candidates = [...sitemapUrlsFromRobots(robotsBody), origin + '/sitemap.xml', origin + '/sitemap_index.xml'];
  const seen = new Set();
  for (const url of candidates) {
    if (seen.has(url) || seen.size >= 3) continue;
    seen.add(url);
    const parsed = parseSitemap(await get(url));
    if (parsed) return { found: true, url, ...parsed };
  }
  return { found: false, url: null, index: false, urls: 0 };
}

export async function scan(rawUrl, env) {
  let origin;
  try {
    origin = originOf(rawUrl);
  } catch {
    return { error: 'invalid_url' };
  }

  const [home, llmsRes, robots, crawlers] = await Promise.all([
    get(origin + '/'),
    get(origin + '/llms.txt'),
    get(origin + '/robots.txt'),
    crawlerVerdict(origin, env),
  ]);

  if (home.status === 0 && robots.status === 0) return { error: 'unreachable', origin };

  const sitemap = await sitemapCheck(origin, robots.status === 200 ? robots.body : '');
  const result = {
    origin,
    checkedAt: new Date().toISOString(),
    // A home page that refuses a plain reader (403, 429, a bot wall) is a
    // finding, not "no structured data": the same wall often stops AI
    // crawlers too, whatever robots.txt says. See scoreOf.
    access: { status: home.status, refused: home.status === 0 || home.status >= 400 },
    crawlers,
    schema: home.status && home.status < 400 ? parseJsonLd(home.body) : { blocks: 0, invalid: 0, types: [], entity: false },
    llms: parseLlmsTxt(llmsRes),
    sitemap,
  };
  result.points = scoreOf(result);
  return result;
}
