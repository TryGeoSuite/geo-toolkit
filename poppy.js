// The poppy.json check of the AI Readiness Check: a copy of the checker of
// @geosuite/poppy-json (TryGeoSuite/poppy-json, src/check.js). Copy it again
// from there when it changes; test/poppy-golden.test.js runs the same golden
// fixture both repos and GeoSuite's audit run.
//
//
// Personal Agent Protocol ("Poppy", Sierra and Meta, draft 0.1 of 09/10/2026,
// https://personalagentprotocol.org/docs/spec): the standard a person's own AI
// agent uses to find a company, sign in with that person's account and act for
// them. It all starts from one file, /.well-known/poppy.json.
//
// We read that file and check what an agent would check before using it:
// version, domain, at least one channel, the OAuth issuer and its metadata
// (RFC 8414), which must list the domain in `poppy_domains`. A file that fails
// these checks is, to an agent, the same as no file.
//
// This file is ported from GeoSuite's audit
// (backend/services/ingestion/personal_agent_protocol.py, TRY-192), issue codes
// included, and must give the same verdict for the same site.
// test/fixtures/golden.json holds the shared cases (documents, issuer metadata,
// whole probes with redirects and broken answers): this repo runs them here,
// GeoSuite runs a byte copy (backend/tests/fixtures/poppy_json_golden.json).
// Change a rule on both sides together, with a new golden case, and copy the
// fixture. TryGeoSuite/geo-toolkit/poppy.js (the AI Readiness Check) is a third
// copy of the same check. Local differences: the User-Agent, the ISSUE_CODES
// list and the optional `userAgent` of probePoppy.

export const POPPY_PATH = '/.well-known/poppy.json';
export const SPEC_URL = 'https://personalagentprotocol.org/docs/spec';
const SUPPORTED_MAJOR_VERSIONS = new Set(['0']);
const API_TYPES = new Set(['openapi', 'mcp']);
const SIGN_IN_TYPES = ['direct', 'device', 'mediated'];
const MAX_DOCUMENT_BYTES = 256_000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 20; // httpx's default, what the audit follows
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const UA = 'geosuite-open-check/1.0 (+https://tools.trygeosuite.it/check)';

// Every code validatePoppyDocument, checkIssuerMetadata and probePoppy can return.
export const ISSUE_CODES = [
  'not_an_object',
  'missing_protocol_version',
  'unsupported_major_version',
  'missing_organization',
  'domain_mismatch',
  'invalid_agent_protocol',
  'invalid_api_entry',
  'invalid_browser_session_endpoint',
  'no_channels',
  'missing_auth_issuer',
  'not_https',
  'issuer_metadata_unreachable',
  'issuer_metadata_invalid',
  'issuer_mismatch',
  'domain_not_in_issuer',
  'missing_token_endpoint',
  'missing_revocation_endpoint',
  'missing_authorization_endpoint',
  'missing_device_authorization_endpoint',
];

const bareHost = (host) => {
  const h = String(host || '').trim().toLowerCase().replace(/\.+$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Python's truthiness, so a field reads as "there" exactly when the audit says
// so: null, false, 0, '', [] and {} are all missing.
const truthy = (v) => {
  if (Array.isArray(v)) return v.length > 0;
  if (isObject(v)) return Object.keys(v).length > 0;
  return Boolean(v);
};

function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' && Boolean(u.host);
  } catch {
    return false;
  }
}

// Where the issuer's OAuth metadata live (RFC 8414, section 3): the issuer's
// path goes AFTER the well-known segment, `https://a.it/auth` becomes
// `https://a.it/.well-known/oauth-authorization-server/auth`.
export function issuerMetadataUrl(issuer) {
  const u = new URL(issuer);
  return 'https://' + u.host + '/.well-known/oauth-authorization-server' + u.pathname.replace(/\/+$/, '');
}

// The spec's shape checks, no network. `requestedHost` is the host the file was
// asked to, not where redirects ended: that is what must match organization.domain.
export function validatePoppyDocument(document, requestedHost) {
  const issues = [];
  if (!isObject(document)) {
    return { valid: false, issues: ['not_an_object'], protocolVersion: null, organizationDomain: null, issuer: null, signInTypes: [], apiTypes: [], hasConversation: false, hasBrowserSession: false };
  }

  const version = document.protocol_version;
  if (typeof version !== 'string' || !version.includes('.')) issues.push('missing_protocol_version');
  else if (!SUPPORTED_MAJOR_VERSIONS.has(version.split('.', 1)[0])) issues.push('unsupported_major_version');

  const org = document.organization;
  let domain = null;
  if (!isObject(org) || !truthy(org.name) || !truthy(org.domain)) issues.push('missing_organization');
  else {
    domain = String(org.domain);
    if (bareHost(domain) !== bareHost(requestedHost)) issues.push('domain_mismatch');
  }

  const agent = isObject(document.agent) ? document.agent : null;
  const apis = Array.isArray(document.apis) ? document.apis : null;
  const web = isObject(document.web) ? document.web : null;

  let hasConversation = false;
  const protocols = agent && Array.isArray(agent.protocols) ? agent.protocols : [];
  for (const entry of protocols) {
    if (!isObject(entry) || !truthy(entry.type) || !isHttpsUrl(entry.endpoint)) {
      issues.push('invalid_agent_protocol');
      break;
    }
    if (entry.type === 'poppy') hasConversation = true;
  }

  const apiTypes = [];
  for (const entry of apis || []) {
    if (!isObject(entry) || !truthy(entry.type) || !truthy(entry.url) || !truthy(entry.description)) {
      issues.push('invalid_api_entry');
      break;
    }
    if (API_TYPES.has(entry.type) && !apiTypes.includes(entry.type)) apiTypes.push(entry.type);
  }

  const browserEndpoint = web ? web.browser_session_endpoint : undefined;
  const hasBrowserSession = isHttpsUrl(browserEndpoint);
  if (browserEndpoint != null && !hasBrowserSession) issues.push('invalid_browser_session_endpoint');

  if (!agent && !apis && !web) issues.push('no_channels');

  const auth = isObject(document.auth) ? document.auth : null;
  const issuer = auth ? auth.issuer : undefined;
  const needsAuth = Boolean(agent || apis || browserEndpoint != null);
  if (needsAuth && !isHttpsUrl(issuer)) issues.push('missing_auth_issuer');
  const signInTypes = SIGN_IN_TYPES.filter((kind) => auth && isObject(auth[kind]));

  return {
    valid: !issues.length,
    issues,
    protocolVersion: typeof version === 'string' ? version : null,
    organizationDomain: domain,
    issuer: isHttpsUrl(issuer) ? issuer : null,
    signInTypes,
    apiTypes,
    hasConversation,
    hasBrowserSession,
  };
}

// What the spec asks an agent to check before trusting the tokens: the
// metadata's `issuer` equals auth.issuer, and `poppy_domains` lists the domain.
// Then the endpoints the spec makes required (section 3.2), all https: the
// token and revocation endpoints always, the authorization endpoint when
// auth.direct is declared, the device authorization endpoint with auth.device.
// Without them an agent finds the company and cannot sign in.
export function checkIssuerMetadata(metadata, issuer, domain, signInTypes = []) {
  if (!isObject(metadata)) return ['issuer_metadata_invalid'];
  const issues = [];
  if (metadata.issuer !== issuer) issues.push('issuer_mismatch');
  const domains = metadata.poppy_domains;
  if (!Array.isArray(domains) || !domains.some((d) => bareHost(d) === bareHost(domain))) issues.push('domain_not_in_issuer');
  if (!isHttpsUrl(metadata.token_endpoint)) issues.push('missing_token_endpoint');
  if (!isHttpsUrl(metadata.revocation_endpoint)) issues.push('missing_revocation_endpoint');
  if (signInTypes.includes('direct') && !isHttpsUrl(metadata.authorization_endpoint)) issues.push('missing_authorization_endpoint');
  if (signInTypes.includes('device') && !isHttpsUrl(metadata.device_authorization_endpoint)) issues.push('missing_device_authorization_endpoint');
  return issues;
}

// GET a JSON document, following redirects by hand so every hop is known (the
// audit checks that each one is https). Never throws:
// { status, json, hops, error }. `json` is undefined when the body is not JSON
// (many sites answer 200 with their HTML 404 page: that is a missing file, not
// a broken one), or is over MAX_DOCUMENT_BYTES (error 'too_large').
async function getJson(url, fetchImpl, userAgent = UA) {
  const hops = [url];
  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let current = url;
    let res;
    for (let redirects = 0; ; redirects++) {
      res = await fetchImpl(current, {
        headers: { 'user-agent': userAgent, accept: 'application/json' },
        redirect: 'manual',
        signal,
      });
      const location = REDIRECT_STATUSES.has(res.status) && res.headers && typeof res.headers.get === 'function' ? res.headers.get('location') : null;
      if (!location) break;
      if (redirects >= MAX_REDIRECTS) return { status: null, json: undefined, hops, error: 'fetch' };
      current = new URL(location, current).href;
      hops.push(current);
    }
    // A fetch that followed the redirects itself still tells where it landed.
    if (res.url && res.url !== current) hops.push(res.url);
    if (res.status >= 400) return { status: res.status, json: undefined, hops, error: null };
    const text = await res.text();
    if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES) return { status: res.status, json: undefined, hops, error: 'too_large' };
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json, hops, error: null };
  } catch (e) {
    return { status: null, json: undefined, hops, error: e && e.name === 'TimeoutError' ? 'timeout' : 'fetch' };
  }
}

// Reads poppy.json from the host and checks it the way an agent would.
// `present`: there is a JSON document at the address. `valid`: an agent would use it.
// `status` is null when no HTTP answer came back (then `error` says why).
export async function probePoppy(host, fetchImpl = fetch, { userAgent = UA } = {}) {
  const url = 'https://' + host + POPPY_PATH;
  const block = { present: false, valid: false, url, status: null, issues: [] };
  const res = await getJson(url, fetchImpl, userAgent);
  block.status = res.status;
  if (res.json === undefined) return res.error ? { ...block, error: res.error } : block;

  block.present = true;
  const { valid, issues: shapeIssues, ...checked } = validatePoppyDocument(res.json, host);
  const issues = [...shapeIssues];
  if (!res.hops.every((hop) => hop.startsWith('https://'))) issues.push('not_https');

  if (checked.issuer && checked.organizationDomain && !issues.length) {
    const meta = await getJson(issuerMetadataUrl(checked.issuer), fetchImpl, userAgent);
    // No answer or an HTTP error: unreachable. An answer that is not a JSON
    // object (an HTML page, a file over 256 KB): invalid.
    if (meta.status === null || meta.status >= 400) issues.push('issuer_metadata_unreachable');
    else issues.push(...checkIssuerMetadata(meta.json, checked.issuer, checked.organizationDomain, checked.signInTypes));
  }

  return { ...block, ...checked, issues, valid: !issues.length };
}
