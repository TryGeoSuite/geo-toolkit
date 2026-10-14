// Ported from GeoSuite's backend/tests/ingestion/test_personal_agent_protocol.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePoppyDocument, checkIssuerMetadata, issuerMetadataUrl, probePoppy } from '../poppy.js';

const ISSUER = 'https://auth.acme.it';
const METADATA_URL = ISSUER + '/.well-known/oauth-authorization-server';
const GOOD_METADATA = { issuer: ISSUER, poppy_domains: ['acme.it'] };

const doc = (over = {}) => ({
  protocol_version: '0.1',
  organization: { name: 'Acme', domain: 'acme.it' },
  auth: { issuer: ISSUER, direct: { scopes: ['poppy:read', 'poppy:write'] } },
  agent: { protocols: [{ type: 'poppy', endpoint: 'https://acme.it/poppy' }] },
  apis: [{ type: 'mcp', url: 'https://acme.it/mcp', description: 'Ordini' }],
  ...over,
});

// A fetch double: routes map a URL to { status, body } or a string body.
function fakeFetch(routes) {
  return async (url) => {
    const r = routes[url];
    if (!r) return { status: 404, url, text: async () => 'not found' };
    const { status = 200, body, finalUrl = url } = typeof r === 'string' ? { body: r } : r;
    return { status, url: finalUrl, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
}

test('a complete document is valid', () => {
  const out = validatePoppyDocument(doc(), 'www.acme.it');
  assert.equal(out.valid, true);
  assert.deepEqual(out.issues, []);
  assert.deepEqual(out.signInTypes, ['direct']);
  assert.deepEqual(out.apiTypes, ['mcp']);
  assert.equal(out.hasConversation, true);
  assert.equal(out.issuer, ISSUER);
});

test('the domain must match the requested host', () => {
  assert.ok(validatePoppyDocument(doc(), 'other.it').issues.includes('domain_mismatch'));
});

test('a new major version is not usable', () => {
  assert.ok(validatePoppyDocument(doc({ protocol_version: '1.0' }), 'acme.it').issues.includes('unsupported_major_version'));
});

test('a document without channels is invalid', () => {
  const d = doc();
  delete d.agent;
  delete d.apis;
  assert.deepEqual(validatePoppyDocument(d, 'acme.it').issues, ['no_channels']);
});

test('channels need an https issuer', () => {
  assert.ok(validatePoppyDocument(doc({ auth: { issuer: 'http://auth.acme.it' } }), 'acme.it').issues.includes('missing_auth_issuer'));
});

test('a JSON array is not a document', () => {
  assert.deepEqual(validatePoppyDocument([], 'acme.it').issues, ['not_an_object']);
});

test('issuer metadata: the path goes after the well-known segment', () => {
  assert.equal(issuerMetadataUrl('https://a.it/auth/'), 'https://a.it/.well-known/oauth-authorization-server/auth');
  assert.equal(issuerMetadataUrl(ISSUER), METADATA_URL);
});

test('issuer metadata must name the issuer and list the domain', () => {
  assert.deepEqual(checkIssuerMetadata(GOOD_METADATA, ISSUER, 'www.acme.it'), []);
  assert.deepEqual(checkIssuerMetadata({ issuer: 'https://x.it', poppy_domains: [] }, ISSUER, 'acme.it'), ['issuer_mismatch', 'domain_not_in_issuer']);
  assert.deepEqual(checkIssuerMetadata('nope', ISSUER, 'acme.it'), ['issuer_metadata_invalid']);
});

test('probe: a valid file with good issuer metadata is valid', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ 'https://acme.it/.well-known/poppy.json': { body: doc() }, [METADATA_URL]: { body: GOOD_METADATA } }));
  assert.equal(out.present, true);
  assert.equal(out.valid, true);
});

test('probe: an HTML 404 page answered with 200 is a missing file', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ 'https://acme.it/.well-known/poppy.json': '<!doctype html><title>404</title>' }));
  assert.equal(out.present, false);
  assert.equal(out.valid, false);
});

test('probe: unreachable issuer metadata make the file invalid', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ 'https://acme.it/.well-known/poppy.json': { body: doc() } }));
  assert.equal(out.present, true);
  assert.deepEqual(out.issues, ['issuer_metadata_unreachable']);
});

test('probe: a file that lands on http is flagged', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ 'https://acme.it/.well-known/poppy.json': { body: doc(), finalUrl: 'http://acme.it/.well-known/poppy.json' } }));
  assert.ok(out.issues.includes('not_https'));
});

test('probe: a network error never throws', async () => {
  const out = await probePoppy('acme.it', async () => { throw new Error('boom'); });
  assert.equal(out.present, false);
  assert.equal(out.error, 'fetch');
});
