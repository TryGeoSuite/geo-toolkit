// Ported from GeoSuite's backend/tests/ingestion/test_personal_agent_protocol.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePoppyDocument, checkIssuerMetadata, issuerMetadataUrl, probePoppy, resolveIssuer, signInTypesFrom } from '../poppy.js';

const ISSUER = 'https://auth.acme.it';
const POPPY_URL = 'https://acme.it/.well-known/poppy.json';
const PRM_URL = 'https://acme.it/.well-known/oauth-protected-resource';
const METADATA_URL = ISSUER + '/.well-known/oauth-authorization-server';
// What a real sign-in server publishes for draft 0.3: the domain in
// protected_resources, the grant types, and the endpoints the spec makes
// required (token and revocation always, authorization for authorization_code).
const ENDPOINTS = { token_endpoint: ISSUER + '/token', revocation_endpoint: ISSUER + '/revoke', authorization_endpoint: ISSUER + '/authorize' };
const GOOD_METADATA = { issuer: ISSUER, protected_resources: ['https://acme.it'], grant_types_supported: ['refresh_token', 'authorization_code'], ...ENDPOINTS };
const GOOD_PRM = { resource: 'https://acme.it', authorization_servers: [ISSUER] };

const doc = (over = {}) => ({
  protocol_version: '0.3',
  organization: { name: 'Acme', domain: 'acme.it' },
  auth: { issuer: ISSUER },
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
  const out = validatePoppyDocument(doc(), 'acme.it');
  assert.equal(out.valid, true);
  assert.deepEqual(out.issues, []);
  assert.deepEqual(out.apiTypes, ['mcp']);
  assert.equal(out.hasConversation, true);
  assert.equal(out.issuer, ISSUER);
});

test('the domain must be the host that served the file, www included', () => {
  assert.ok(validatePoppyDocument(doc(), 'other.it').issues.includes('domain_mismatch'));
  assert.ok(validatePoppyDocument(doc(), 'www.acme.it').issues.includes('domain_mismatch'));
});

test('only draft 0.3 is usable', () => {
  for (const v of ['0.1', '0.2', '1.0']) assert.deepEqual(validatePoppyDocument(doc({ protocol_version: v }), 'acme.it').issues, ['unsupported_version'], v);
});

test('a document without channels is invalid', () => {
  const d = doc();
  delete d.agent;
  delete d.apis;
  assert.deepEqual(validatePoppyDocument(d, 'acme.it').issues, ['no_channels']);
});

test('auth is optional, but a declared issuer must be https', () => {
  const d = doc();
  delete d.auth;
  assert.equal(validatePoppyDocument(d, 'acme.it').valid, true);
  assert.deepEqual(validatePoppyDocument(doc({ auth: { issuer: 'http://auth.acme.it' } }), 'acme.it').issues, ['invalid_auth_issuer']);
});

test('a JSON array is not a document', () => {
  assert.deepEqual(validatePoppyDocument([], 'acme.it').issues, ['not_an_object']);
});

test('issuer metadata: the path goes after the well-known segment', () => {
  assert.equal(issuerMetadataUrl('https://a.it/auth/'), 'https://a.it/.well-known/oauth-authorization-server/auth');
  assert.equal(issuerMetadataUrl(ISSUER), METADATA_URL);
});

test('issuer metadata must have the endpoints and grant types the spec makes required, https only', () => {
  const two = { issuer: ISSUER, protected_resources: ['https://acme.it'] };
  assert.deepEqual(checkIssuerMetadata(two, ISSUER, 'acme.it'), ['missing_token_endpoint', 'missing_revocation_endpoint', 'invalid_grant_types']);
  const grants = ['refresh_token', 'authorization_code', 'urn:ietf:params:oauth:grant-type:device_code'];
  assert.deepEqual(checkIssuerMetadata({ ...two, token_endpoint: ISSUER + '/token', revocation_endpoint: ISSUER + '/revoke', grant_types_supported: grants }, ISSUER, 'acme.it'), ['missing_authorization_endpoint', 'missing_device_authorization_endpoint']);
  assert.deepEqual(checkIssuerMetadata({ ...GOOD_METADATA, revocation_endpoint: 'http://auth.acme.it/revoke' }, ISSUER, 'acme.it'), ['missing_revocation_endpoint']);
});

test('issuer metadata must name the issuer and list the domain in protected_resources', () => {
  assert.deepEqual(checkIssuerMetadata(GOOD_METADATA, ISSUER, 'acme.it'), []);
  assert.deepEqual(checkIssuerMetadata(GOOD_METADATA, ISSUER, 'www.acme.it'), ['domain_not_in_issuer']);
  assert.deepEqual(checkIssuerMetadata({ ...GOOD_METADATA, issuer: 'https://x.it', protected_resources: [] }, ISSUER, 'acme.it'), ['issuer_mismatch', 'domain_not_in_issuer']);
  assert.deepEqual(checkIssuerMetadata('nope', ISSUER, 'acme.it'), ['issuer_metadata_invalid']);
});

test('resolveIssuer reads the protected resource metadata the way spec 3.2 does', () => {
  assert.deepEqual(resolveIssuer(null, 'acme.it', null, false), { issuer: null, issues: [] });
  assert.deepEqual(resolveIssuer(null, 'acme.it', ISSUER, false), { issuer: null, issues: ['sign_in_without_issuer'] });
  assert.deepEqual(resolveIssuer(GOOD_PRM, 'acme.it', null, false), { issuer: ISSUER, issues: [] });
  assert.deepEqual(resolveIssuer({ ...GOOD_PRM, resource: 'https://acme.it/' }, 'acme.it', null, false), { issuer: null, issues: ['protected_resource_invalid'] });
  assert.deepEqual(resolveIssuer({ ...GOOD_PRM, authorization_servers: [ISSUER, 'https://staff.acme.it'] }, 'acme.it', null, false), { issuer: null, issues: ['missing_auth_issuer'] });
  assert.deepEqual(resolveIssuer(GOOD_PRM, 'acme.it', 'https://staff.acme.it', false), { issuer: null, issues: ['issuer_not_listed'] });
});

test('sign-in types come from the grant types and the mediated extension, none when turned off', () => {
  const meta = { grant_types_supported: ['refresh_token', 'urn:ietf:params:oauth:grant-type:device_code', 'authorization_code'] };
  assert.deepEqual(signInTypesFrom(meta, { signInTypes: ['mediated'], signInDisabled: false }), ['direct', 'device', 'mediated']);
  assert.deepEqual(signInTypesFrom(meta, { signInTypes: [], signInDisabled: true }), []);
});

test('probe: a valid file with good discovery is valid', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ [POPPY_URL]: { body: doc() }, [PRM_URL]: { body: GOOD_PRM }, [METADATA_URL]: { body: GOOD_METADATA } }));
  assert.equal(out.present, true);
  assert.equal(out.valid, true);
  assert.deepEqual(out.signInTypes, ['direct']);
});

test('probe: an HTML 404 page answered with 200 is a missing file', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ [POPPY_URL]: '<!doctype html><title>404</title>' }));
  assert.equal(out.present, false);
  assert.equal(out.valid, false);
});

test('probe: unreachable issuer metadata make the file invalid', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ [POPPY_URL]: { body: doc() }, [PRM_URL]: { body: GOOD_PRM } }));
  assert.equal(out.present, true);
  assert.deepEqual(out.issues, ['issuer_metadata_unreachable']);
});

test('probe: a file that lands on http is flagged', async () => {
  const out = await probePoppy('acme.it', fakeFetch({ [POPPY_URL]: { body: doc(), finalUrl: 'http://acme.it/.well-known/poppy.json' } }));
  assert.ok(out.issues.includes('not_https'));
});

test('probe: a network error never throws', async () => {
  const out = await probePoppy('acme.it', async () => { throw new Error('boom'); });
  assert.equal(out.present, false);
  assert.equal(out.error, 'fetch');
});

test('the check page explains every issue code, in both languages', async () => {
  const { ISSUE_CODES } = await import('../poppy.js');
  const { renderCheckPage } = await import('../check-page.js');
  for (const lang of ['en', 'it']) {
    const html = renderCheckPage(lang, '');
    for (const code of ISSUE_CODES) assert.ok(html.includes(`"${code}":`), `${lang}: ${code}`);
  }
});
