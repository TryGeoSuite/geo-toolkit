// Unit tests for the pure parts of the AI Readiness Check: run with `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { originOf, parseJsonLd, parseLlmsTxt, parseSitemap, sitemapUrlsFromRobots, scoreOf, WEIGHTS } from '../check.js';

test('weights add up to 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('originOf normalizes public domains and refuses the rest', () => {
  assert.equal(originOf('example.com'), 'https://example.com');
  assert.equal(originOf('  http://Example.com/path?x=1 '), 'http://example.com');
  for (const bad of ['', 'localhost', 'intranet', '127.0.0.1', 'http://[::1]/', 'ftp://example.com', 'printer.local']) {
    assert.throws(() => originOf(bad), bad);
  }
});

test('parseJsonLd walks @graph and nested types, counts invalid blocks', () => {
  const html = `
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"X"},{"@type":["WebSite","Thing"]}]}</script>
    <script type='application/ld+json'>{"@type":"Article","author":{"@type":"Person"}}</script>
    <script type="application/ld+json">{ not json</script>`;
  const r = parseJsonLd(html);
  assert.equal(r.blocks, 3);
  assert.equal(r.invalid, 1);
  assert.deepEqual(r.types, ['Article', 'Organization', 'Person', 'Thing', 'WebSite']);
  assert.equal(r.entity, true);
});

test('parseJsonLd: JSON-LD without an entity type is not an entity', () => {
  const r = parseJsonLd('<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>');
  assert.equal(r.entity, false);
  assert.equal(parseJsonLd('<p>no data</p>').blocks, 0);
});

test('parseJsonLd accepts full schema.org IRIs as types', () => {
  assert.equal(parseJsonLd('<script type="application/ld+json">{"@type":"https://schema.org/LocalBusiness"}</script>').entity, true);
});

test('parseLlmsTxt wants plain text starting with an H1', () => {
  const ok = parseLlmsTxt({ status: 200, type: 'text/plain', body: '# Site\n\n> desc\n\n- [A](https://a)\n- [B](https://b)\n' });
  assert.deepEqual(ok, { found: true, valid: true, links: 2 });
  assert.equal(parseLlmsTxt({ status: 200, type: 'text/plain', body: 'Site\n- [A](x)' }).valid, false);
  // An SPA answering every path with its index.html is not an llms.txt.
  assert.equal(parseLlmsTxt({ status: 200, type: 'text/html', body: '<!doctype html><html>' }).found, false);
  assert.equal(parseLlmsTxt({ status: 404, type: 'text/plain', body: '' }).found, false);
});

test('sitemap: robots lines and XML detection', () => {
  assert.deepEqual(sitemapUrlsFromRobots('User-agent: *\nSitemap: https://a.it/s1.xml\n  sitemap:https://a.it/s2.xml'), ['https://a.it/s1.xml', 'https://a.it/s2.xml']);
  assert.deepEqual(parseSitemap({ status: 200, body: '<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>' }), { index: false, urls: 2 });
  assert.deepEqual(parseSitemap({ status: 200, body: '<sitemapindex><sitemap><loc>a</loc></sitemap></sitemapindex>' }), { index: true, urls: 1 });
  assert.equal(parseSitemap({ status: 200, body: '<!doctype html>' }), null);
});

test('scoreOf: full marks, partial marks, nothing', () => {
  const full = scoreOf({
    crawlers: { score: 100 },
    schema: { blocks: 1, entity: true },
    llms: { found: true, valid: true },
    sitemap: { found: true },
  });
  assert.equal(full.total, 100);

  const partial = scoreOf({
    crawlers: { score: 50 },
    schema: { blocks: 2, entity: false },
    llms: { found: true, valid: false },
    sitemap: { found: false },
  });
  assert.deepEqual(partial, { crawlers: 20, schema: 15, llms: 10, sitemap: 0, total: 45 });

  // Unknown crawler verdict (robots.txt unreadable) gives no points, not a crash.
  const none = scoreOf({ crawlers: { score: null }, schema: { blocks: 0 }, llms: { found: false }, sitemap: { found: false } });
  assert.equal(none.total, 0);
});

test('the check page ships a client script that parses, in both languages', async () => {
  const { renderCheckPage } = await import('../check-page.js');
  for (const lang of ['en', 'it']) {
    const html = renderCheckPage(lang, 'esempio.it');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, 1, lang);
    // new Function only parses: a syntax error throws here, nothing runs.
    assert.doesNotThrow(() => new Function(scripts[0]), lang);
    assert.ok(!/\u2014/.test(html), `${lang}: no em dash in the copy`);
  }
});

test('the shared ?url= is escaped into the input, not injected', async () => {
  const { renderCheckPage } = await import('../check-page.js');
  const html = renderCheckPage('en', '"><script>alert(1)</script>');
  assert.ok(html.includes('value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
});

test('every T.<key> the page script reads exists in both client dictionaries', async () => {
  const { renderCheckPage } = await import('../check-page.js');
  for (const lang of ['en', 'it']) {
    const html = renderCheckPage(lang, '');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    const dict = new Function(script.match(/var T = ([\s\S]*?);\n  var \$/)[1].replace(/^/, 'return '))();
    const used = new Set([...script.matchAll(/\bT\.([a-zA-Z]+)/g)].map((m) => m[1]));
    for (const k of used) assert.ok(k in dict, `${lang}: T.${k} is used but missing`);
  }
});

test('scoreOf: a home behind a bot wall leaves schema out instead of zeroing it', () => {
  const r = scoreOf({
    access: { status: 403, refused: true },
    crawlers: { score: 100 },
    schema: { blocks: 0 },
    llms: { found: false },
    sitemap: { found: true },
  });
  assert.equal(r.schema, null);
  assert.equal(r.total, 73); // (40 + 0 + 15) / 75
});
