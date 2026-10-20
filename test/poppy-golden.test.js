// The golden cases shared with GeoSuite's audit
// (backend/tests/ingestion/test_personal_agent_protocol_golden.py runs the same
// file). A failure here means the free tool and the audit would disagree on a
// site: change the rule on both sides, then copy the fixture to GeoSuite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePoppyDocument, checkIssuerMetadata, issuerMetadataUrl, probePoppy, ISSUE_CODES } from '../poppy.js';

const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/poppy-golden.json'), 'utf8'));

// The audit's field names for validatePoppyDocument's result.
const SNAKE = {
  valid: 'valid',
  issues: 'issues',
  protocolVersion: 'protocol_version',
  organizationDomain: 'organization_domain',
  issuer: 'issuer',
  signInTypes: 'sign_in_types',
  apiTypes: 'api_types',
  hasConversation: 'has_conversation',
  hasBrowserSession: 'has_browser_session',
};
const toSnake = (out) => Object.fromEntries(Object.entries(SNAKE).map(([camel, snake]) => [snake, out[camel]]));

// A fetch that answers from the fixture's routes, redirects included (it
// honours redirect: 'manual' the way the Workers and Node fetch do).
function routedFetch(routes) {
  return async (url) => {
    const route = routes[url];
    if (!route) return { status: 404, url, headers: new Headers(), text: async () => 'not found' };
    if (route.raise === 'timeout') throw Object.assign(new Error('slow'), { name: 'TimeoutError' });
    if (route.raise) throw new Error('boom');
    const headers = new Headers(route.location ? { location: route.location } : {});
    const body = route.oversize
      ? JSON.stringify({ pad: 'x'.repeat(256_001) })
      : route.json !== undefined
        ? JSON.stringify(route.json)
        : route.body || '';
    return { status: route.status || 200, url, headers, text: async () => body };
  };
}

test('ISSUE_CODES is the golden list', () => {
  assert.deepEqual(ISSUE_CODES, golden.issue_codes);
});

for (const c of golden.validate_cases) {
  test(`golden document: ${c.name}`, () => {
    assert.deepEqual(toSnake(validatePoppyDocument(c.document, c.host)), c.expected);
  });
}

for (const c of golden.metadata_cases) {
  test(`golden metadata: ${c.name}`, () => {
    assert.deepEqual(checkIssuerMetadata(c.metadata, c.issuer, c.domain, c.sign_in_types || []), c.expected);
  });
}

test('golden metadata URLs', () => {
  for (const c of golden.metadata_url_cases) assert.equal(issuerMetadataUrl(c.issuer), c.expected, c.issuer);
});

for (const c of golden.probe_cases) {
  test(`golden probe: ${c.name}`, async () => {
    const out = await probePoppy(c.host, routedFetch(c.routes));
    const { present, valid, issues, status } = out;
    assert.deepEqual({ present, valid, issues, status, error: out.error ?? null }, c.expected);
  });
}
