// The poppy.json check of the AI Readiness Check: a copy of the checker of
// @geosuite/poppy-json (TryGeoSuite/poppy-json, src/check.js). Copy it again
// from there when it changes; test/poppy-golden.test.js runs the same golden
// fixture both repos and GeoSuite's audit run.
//
//
// Personal Agent Protocol ("Poppy", Sierra and Meta, draft 0.3,
// https://personalagentprotocol.org/docs/spec): the standard a person's own AI
// agent uses to find a company, sign in with that person's account and act for
// them. It all starts from one file, /.well-known/poppy.json.
//
// We read that file and check what an agent would check before using it
// (spec section 3): the version, the domain against the host that served the
// file, at least one channel. Then the discovery of the sign-in server: the
// domain's protected resource metadata (RFC 9728) names the OAuth issuer, or
// says there is none, and the issuer's metadata (RFC 8414) must list the
// domain in `protected_resources` and have the endpoints and grant types the
// spec requires. A file that fails these checks is, to an agent, the same as
// no file.
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
export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';
export const SPEC_URL = 'https://personalagentprotocol.org/docs/spec';
// Before 1.0 every minor version can break the one before (spec 3.1): an agent
// uses only the `major.minor` versions it knows.
const SUPPORTED_VERSIONS = new Set(['0.3']);
const API_TYPES = new Set(['openapi', 'mcp']);
const MEDIATED_EXTENSION = 'mediated-sign-in';
const DIRECT_GRANT = 'authorization_code';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const MAX_DOCUMENT_BYTES = 256_000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 20; // httpx's default, what the audit follows
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const UA = 'geosuite-open-check/1.0 (+https://tools.trygeosuite.it/check)';

// Every code validatePoppyDocument, checkIssuerMetadata and probePoppy can return.
export const ISSUE_CODES = [
  'not_an_object',
  'missing_protocol_version',
  'unsupported_version',
  'missing_organization',
  'domain_mismatch',
  'invalid_agent_protocol',
  'invalid_api_entry',
  'invalid_browser_session_endpoint',
  'no_channels',
  'invalid_auth_issuer',
  'sign_in_conflict',
  'not_https',
  'wrong_final_path',
  'protected_resource_unreachable',
  'protected_resource_invalid',
  'missing_auth_issuer',
  'issuer_not_listed',
  'sign_in_without_issuer',
  'issuer_metadata_unreachable',
  'issuer_metadata_invalid',
  'issuer_mismatch',
  'domain_not_in_issuer',
  'missing_token_endpoint',
  'missing_revocation_endpoint',
  'invalid_grant_types',
  'missing_authorization_endpoint',
  'missing_device_authorization_endpoint',
];

// Hosts are compared ignoring case, with no other normalization (spec 3.1).
const normHost = (host) => String(host || '').trim().toLowerCase();

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

// The spec's shape checks, no network. `servedHost` is the host that served the
// file, after any redirects: organization.domain must be that host (spec 3.1).
// `issuer` is the declared auth.issuer; the probe replaces it with the issuer
// discovery finds. `signInTypes` holds only what the file alone says (Mediated
// Sign-In, an extension): Direct and Device Sign-In come from the issuer's
// grant types, which only the probe reads.
export function validatePoppyDocument(document, servedHost) {
  const issues = [];
  if (!isObject(document)) {
    return { valid: false, issues: ['not_an_object'], protocolVersion: null, organizationDomain: null, issuer: null, signInTypes: [], signInDisabled: false, signedInAccess: false, apiTypes: [], hasConversation: false, hasBrowserSession: false };
  }

  const version = document.protocol_version;
  if (typeof version !== 'string' || !version.includes('.')) issues.push('missing_protocol_version');
  else if (!SUPPORTED_VERSIONS.has(version.split('.').slice(0, 2).join('.'))) issues.push('unsupported_version');

  const org = document.organization;
  let domain = null;
  if (!isObject(org) || !truthy(org.name) || !truthy(org.domain)) issues.push('missing_organization');
  else {
    domain = String(org.domain);
    if (normHost(domain) !== normHost(servedHost)) issues.push('domain_mismatch');
  }

  const agent = isObject(document.agent) ? document.agent : null;
  const apis = Array.isArray(document.apis) ? document.apis : null;
  const web = isObject(document.web) ? document.web : null;

  let hasConversation = false;
  let signedInAccess = false;
  const protocols = agent && Array.isArray(agent.protocols) ? agent.protocols : [];
  for (const entry of protocols) {
    if (!isObject(entry) || !truthy(entry.type) || !isHttpsUrl(entry.endpoint)) {
      issues.push('invalid_agent_protocol');
      break;
    }
    if (entry.type === 'poppy') {
      hasConversation = true;
      // Unknown `access` values are ignored, as an absent hint (spec 3.2).
      if (entry.access === 'signed_in') signedInAccess = true;
    }
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

  // auth is optional: a company that offers no sign-in needs no issuer (spec 3.2).
  const auth = isObject(document.auth) ? document.auth : null;
  const issuer = auth ? auth.issuer : undefined;
  if (issuer != null && !isHttpsUrl(issuer)) issues.push('invalid_auth_issuer');
  const signInDisabled = Boolean(auth && auth.disabled === true);
  const mediated = isObject(document.extensions) && isObject(document.extensions[MEDIATED_EXTENSION]);
  // Sign-in turned off cannot go with Mediated Sign-In or `signed_in` access (spec 3.2).
  if (signInDisabled && (mediated || signedInAccess)) issues.push('sign_in_conflict');

  return {
    valid: !issues.length,
    issues,
    protocolVersion: typeof version === 'string' ? version : null,
    organizationDomain: domain,
    issuer: isHttpsUrl(issuer) ? issuer : null,
    signInTypes: mediated && !signInDisabled ? ['mediated'] : [],
    signInDisabled,
    signedInAccess,
    apiTypes,
    hasConversation,
    hasBrowserSession,
  };
}

// Which issuer the domain's protected resource metadata (RFC 9728) name, as
// spec 3.2 reads them. `metadata` is the parsed answer of
// https://{domain}/.well-known/oauth-protected-resource, or null after a 404.
// Returns { issuer, issues }: issuer null means a company with no issuer, which
// is valid only when the file asks for no sign-in.
export function resolveIssuer(metadata, domain, declaredIssuer, wantsSignIn) {
  let servers = [];
  if (metadata !== null) {
    if (!isObject(metadata) || metadata.resource !== 'https://' + domain) return { issuer: null, issues: ['protected_resource_invalid'] };
    const listed = metadata.authorization_servers;
    if (listed != null && (!Array.isArray(listed) || !listed.every(isHttpsUrl))) return { issuer: null, issues: ['protected_resource_invalid'] };
    servers = listed || [];
  }
  if (!servers.length) {
    // A 404, or no authorization servers: the company has no issuer.
    return { issuer: null, issues: declaredIssuer || wantsSignIn ? ['sign_in_without_issuer'] : [] };
  }
  if (servers.length > 1 && !declaredIssuer) return { issuer: null, issues: ['missing_auth_issuer'] };
  const issuer = declaredIssuer || servers[0];
  if (!servers.includes(issuer)) return { issuer: null, issues: ['issuer_not_listed'] };
  return { issuer, issues: [] };
}

// What the spec asks an agent to check in the issuer's metadata (RFC 8414,
// spec 3.2) before trusting its tokens: `issuer` equal to the one discovery
// found, `protected_resources` listing https://{domain} (host compared without
// case), https token and revocation endpoints, and `grant_types_supported`
// with refresh_token. Then the endpoint each offered sign-in needs: the
// authorization endpoint for authorization_code (Direct Sign-In), the device
// authorization endpoint for the device code grant (Device Sign-In).
export function checkIssuerMetadata(metadata, issuer, domain) {
  if (!isObject(metadata)) return ['issuer_metadata_invalid'];
  const issues = [];
  if (metadata.issuer !== issuer) issues.push('issuer_mismatch');
  const resources = metadata.protected_resources;
  const wanted = 'https://' + normHost(domain);
  if (!Array.isArray(resources) || !resources.some((r) => typeof r === 'string' && r.toLowerCase() === wanted)) issues.push('domain_not_in_issuer');
  if (!isHttpsUrl(metadata.token_endpoint)) issues.push('missing_token_endpoint');
  if (!isHttpsUrl(metadata.revocation_endpoint)) issues.push('missing_revocation_endpoint');
  const grants = Array.isArray(metadata.grant_types_supported) ? metadata.grant_types_supported : null;
  if (!grants || !grants.includes('refresh_token')) issues.push('invalid_grant_types');
  if (grants && grants.includes(DIRECT_GRANT) && !isHttpsUrl(metadata.authorization_endpoint)) issues.push('missing_authorization_endpoint');
  if (grants && grants.includes(DEVICE_GRANT) && !isHttpsUrl(metadata.device_authorization_endpoint)) issues.push('missing_device_authorization_endpoint');
  return issues;
}

// The sign-in types a company offers, in the spec order: Direct and Device
// from the issuer's grant types, Mediated from the file's extensions. None when
// the file turns sign-in off.
export function signInTypesFrom(metadata, checked) {
  if (checked.signInDisabled) return [];
  const grants = isObject(metadata) && Array.isArray(metadata.grant_types_supported) ? metadata.grant_types_supported : [];
  const types = [];
  if (grants.includes(DIRECT_GRANT)) types.push('direct');
  if (grants.includes(DEVICE_GRANT)) types.push('device');
  return [...types, ...checked.signInTypes];
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
  // The file speaks for the host that served it, after the redirects, and
  // only from the exact well-known path, with no query (spec 3).
  const last = new URL(res.hops[res.hops.length - 1]);
  const { valid, issues: shapeIssues, ...checked } = validatePoppyDocument(res.json, last.hostname);
  const issues = [...shapeIssues];
  if (!res.hops.every((hop) => hop.startsWith('https://'))) issues.push('not_https');
  if (last.pathname !== POPPY_PATH || last.search) issues.push('wrong_final_path');

  const declaredIssuer = checked.issuer;
  checked.issuer = null;
  if (checked.organizationDomain && !issues.length) {
    const domain = normHost(checked.organizationDomain);
    const prm = await getJson('https://' + domain + PROTECTED_RESOURCE_PATH, fetchImpl, userAgent);
    let found = null;
    // Only a 404 says "no issuer": a timeout, another error or a broken answer
    // leaves the agent without an answer (spec 3.2).
    if (prm.status === null || (prm.status >= 400 && prm.status !== 404)) issues.push('protected_resource_unreachable');
    else if (prm.status !== 404 && prm.json === undefined) issues.push('protected_resource_invalid');
    else {
      const wantsSignIn = checked.signInTypes.length > 0 || checked.signedInAccess;
      found = resolveIssuer(prm.status === 404 ? null : prm.json, domain, declaredIssuer, wantsSignIn);
      issues.push(...found.issues);
    }

    if (found && found.issuer && !issues.length) {
      checked.issuer = found.issuer;
      const meta = await getJson(issuerMetadataUrl(found.issuer), fetchImpl, userAgent);
      // No answer or an HTTP error: unreachable. An answer that is not a JSON
      // object (an HTML page, a file over 256 KB): invalid.
      if (meta.status === null || meta.status >= 400) issues.push('issuer_metadata_unreachable');
      else {
        issues.push(...checkIssuerMetadata(meta.json, found.issuer, domain));
        checked.signInTypes = signInTypesFrom(meta.json, checked);
      }
    }
  }

  return { ...block, ...checked, issues, valid: !issues.length };
}
