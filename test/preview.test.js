// Unit tests for the pure parts of the AI answer preview: run with `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteSignals, hostOf, findSelf, cleanRecommendations, cleanName, cleanReason, usableQuestion, PreviewBudget } from '../preview.js';

test('siteSignals reads only what the site says about itself', () => {
  const html = `<html lang="it-IT"><head>
    <title>Calzature Rossi &amp; Figli | Scarpe artigianali</title>
    <meta content="Scarpe fatte a mano a Vigevano dal 1950" name="description">
    <meta property="og:site_name" content="Calzature Rossi">
    </head><body><h1>Scarpe <em>su misura</em></h1></body></html>`;
  assert.deepEqual(siteSignals(html), {
    title: 'Calzature Rossi & Figli | Scarpe artigianali',
    description: 'Scarpe fatte a mano a Vigevano dal 1950',
    siteName: 'Calzature Rossi',
    h1: 'Scarpe su misura',
    lang: 'it-it',
  });
  assert.equal(siteSignals('<p>nothing</p>').title, '');
});

test('hostOf strips www and tolerates bare domains', () => {
  assert.equal(hostOf('https://www.Esempio.it/x'), 'esempio.it');
  assert.equal(hostOf('esempio.it'), 'esempio.it');
  assert.equal(hostOf(''), '');
});

test('findSelf matches the host, subdomains included', () => {
  const recs = [{ name: 'Altro', website: 'altro.it' }, { name: 'Shop', website: 'https://shop.esempio.it' }];
  assert.equal(findSelf(recs, 'esempio.it', 'Qualcosa'), 1);
});

test('findSelf matches the brand name without case, spaces or accents', () => {
  const recs = [{ name: 'Altro', website: '' }, { name: 'Caffè Nero', website: '' }];
  assert.equal(findSelf(recs, 'caffenero.it', 'caffe nero'), 1);
});

test('findSelf does not match on short or unrelated names', () => {
  const recs = [{ name: 'Abbott', website: 'abbott.com' }];
  assert.equal(findSelf(recs, 'ab.it', 'AB'), -1);
  assert.equal(findSelf([{ name: 'Zalando', website: 'zalando.it' }], 'esempio.it', 'Esempio'), -1);
});

test('cleanRecommendations keeps at most 5 named entries', () => {
  const raw = [{ name: ' A ', website: 'a.it' }, { name: '' }, null, { website: 'x' }, ...'BCDEFG'.split('').map((n) => ({ name: n }))];
  const out = cleanRecommendations(raw);
  assert.equal(out.length, 5);
  assert.deepEqual(out[0], { name: 'A', website: 'a.it', reason: '' });
  assert.deepEqual(cleanRecommendations('nope'), []);
});

// A Durable Object storage good enough for the counter: get/put/deleteAll.
function fakeState() {
  const m = new Map();
  return {
    storage: {
      get: async (k) => m.get(k),
      put: async (k, v) => {
        if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) m.set(kk, vv);
        else m.set(k, v);
      },
      deleteAll: async () => m.clear(),
    },
  };
}

const take = (b, body) => b.fetch(new Request('https://budget/take', { method: 'POST', body: JSON.stringify(body) })).then((r) => r.json());

test('PreviewBudget: per-visitor cap, global cap, reset on a new day', async () => {
  const b = new PreviewBudget(fakeState());
  const base = { day: '2026-10-05', perVisitor: 2, global: 3 };
  assert.equal((await take(b, { ...base, visitor: 'a' })).ok, true);
  assert.equal((await take(b, { ...base, visitor: 'a' })).ok, true);
  assert.deepEqual(await take(b, { ...base, visitor: 'a' }), { ok: false, reason: 'visitor' });
  assert.equal((await take(b, { ...base, visitor: 'b' })).ok, true);
  assert.deepEqual(await take(b, { ...base, visitor: 'c' }), { ok: false, reason: 'global' });
  // Tomorrow everyone starts again.
  assert.equal((await take(b, { ...base, day: '2026-10-06', visitor: 'a' })).ok, true);
});

test('usableQuestion refuses questions that name the site', () => {
  const q = 'Quali sono le migliori scarpe artigianali in Italia?';
  assert.equal(usableQuestion('  ' + q + '\n', 'Calzature Rossi', 'calzaturerossi.it'), q);
  assert.equal(usableQuestion('Calzature Rossi è tra le migliori scarpe in Italia?', 'Calzature Rossi', 'calzaturerossi.it'), '');
  assert.equal(usableQuestion('Meglio calzaturerossi o altri?', 'X', 'calzaturerossi.it'), '');
  assert.equal(usableQuestion('Ciao?', 'X', 'x.it'), '');
  assert.equal(usableQuestion('a'.repeat(240), 'X', 'x.it'), '');
});

test('mergeRuns puts names found in both answers first, by average position', async () => {
  const { mergeRuns } = await import('../preview.js');
  const a = [{ name: 'Peec AI', website: 'peec.ai' }, { name: 'Search Party', website: 'searchparty.com' }, { name: 'Otterly', website: 'otterly.ai' }];
  const b = [{ name: 'OtterlyAI', website: 'https://otterly.ai/' }, { name: 'Profound', website: 'tryprofound.com' }, { name: 'Peec', website: 'https://www.peec.ai' }];
  const m = mergeRuns([a, b], 'trygeosuite.it', 'GeoSuite');
  assert.deepEqual(m.recommendations.map((r) => [r.name, r.runs]), [['Peec AI', 2], ['Otterly', 2], ['Search Party', 1], ['Profound', 1]]);
  assert.equal(m.position, null);
  assert.equal(m.mentions, 0);
  assert.equal(m.totalRuns, 2);
});

test('mergeRuns says how many answers named the site', async () => {
  const { mergeRuns } = await import('../preview.js');
  const a = [{ name: 'Decathlon', website: 'decathlon.it' }, { name: 'Cisalfa', website: '' }];
  const b = [{ name: 'Cisalfa Sport', website: '' }, { name: 'Intersport', website: '' }];
  const m = mergeRuns([a, b], 'decathlon.it', 'Decathlon');
  assert.equal(m.mentions, 1);
  assert.equal(m.recommendations[0].name, 'Cisalfa');
  assert.equal(m.position, 2);
});

test('cleanName keeps the name and drops the description glued to it', () => {
  assert.equal(cleanName('Nomina \u2014 la più adatta se vuoi capire se ChatGPT ti cita'), 'Nomina');
  assert.equal(cleanName('DF Sport Specialist - molto forte su running'), 'DF Sport Specialist');
  assert.equal(cleanName('BIKMA: ottima per misurare'), 'BIKMA');
  assert.equal(cleanName('Coca-Cola'), 'Coca-Cola');
  assert.equal(cleanName('  '), '');
});

test('cleanReason drops inline citations and never cuts mid-word', () => {
  assert.equal(cleanReason('Ottimo per la scelta. ([cisalfasport.it](https://www.cisalfasport.it/x))'), 'Ottimo per la scelta.');
  assert.equal(cleanReason('Vedi [qui](https://a.it) per i dettagli'), 'Vedi per i dettagli');
  const long = 'Lo consiglierei per l\u2019assortimento molto ampio e la presenza in tutta Italia. Inoltre puoi ritirare in negozio e provare i prodotti prima di comprarli online senza costi.';
  assert.equal(cleanReason(long), 'Lo consiglierei per l\u2019assortimento molto ampio e la presenza in tutta Italia.');
  const words = 'parola '.repeat(40);
  const out = cleanReason(words);
  assert.ok(out.endsWith('parola\u2026'), out);
  assert.ok(out.length <= 141);
});

test('PreviewBudget: a refund gives the slot back, and never goes below zero', async () => {
  const b = new PreviewBudget(fakeState());
  const base = { day: '2026-10-05', perVisitor: 1, global: 5 };
  assert.equal((await take(b, { ...base, visitor: 'a' })).ok, true);
  assert.deepEqual(await take(b, { ...base, visitor: 'a' }), { ok: false, reason: 'visitor' });
  await take(b, { day: base.day, visitor: 'a', refund: true });
  assert.equal((await take(b, { ...base, visitor: 'a' })).ok, true);
  await take(b, { day: base.day, visitor: 'z', refund: true });
  // A refund from yesterday changes nothing today.
  await take(b, { day: '2026-10-04', visitor: 'a', refund: true });
  assert.deepEqual(await take(b, { ...base, visitor: 'a' }), { ok: false, reason: 'visitor' });
});
