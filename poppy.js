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
// Ported from GeoSuite's audit (backend/services/ingestion/personal_agent_protocol.py,
// TRY-192), issue codes included: keep the two in step. A missing file is not a
// defect, the standard is a week old: it stays out of the score.

export const POPPY_PATH = '/.well-known/poppy.json';
export const SPEC_URL = 'https://personalagentprotocol.org/docs/spec';
const SUPPORTED_MAJOR_VERSIONS = new Set(['0']);
const API_TYPES = new Set(['openapi', 'mcp']);
const SIGN_IN_TYPES = ['direct', 'device', 'mediated'];
const MAX_DOCUMENT_BYTES = 256_000;
const FETCH_TIMEOUT_MS = 8000;
const UA = 'geosuite-open-check/1.0 (+https://tools.trygeosuite.it/check)';

const bareHost = (host) => {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

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
  if (!isObject(org) || !org.name || !org.domain) issues.push('missing_organization');
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
    if (!isObject(entry) || !entry.type || !isHttpsUrl(entry.endpoint)) {
      issues.push('invalid_agent_protocol');
      break;
    }
    if (entry.type === 'poppy') hasConversation = true;
  }

  const apiTypes = [];
  for (const entry of apis || []) {
    if (!isObject(entry) || !entry.type || !entry.url || !entry.description) {
      issues.push('invalid_api_entry');
      break;
    }
    if (API_TYPES.has(entry.type) && !apiTypes.includes(entry.type)) apiTypes.push(String(entry.type));
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
export function checkIssuerMetadata(metadata, issuer, domain) {
  if (!isObject(metadata)) return ['issuer_metadata_invalid'];
  const issues = [];
  if (metadata.issuer !== issuer) issues.push('issuer_mismatch');
  const domains = metadata.poppy_domains;
  if (!Array.isArray(domains) || !domains.some((d) => bareHost(d) === bareHost(domain))) issues.push('domain_not_in_issuer');
  return issues;
}

// GET a JSON document. Never throws: { status, json, finalUrl, error }.
// `json` is undefined when the body is not JSON (many sites answer 200 with
// their HTML 404 page: that is a missing file, not a broken one).
async function getJson(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 400) return { status: res.status, json: undefined, finalUrl: res.url || url, error: null };
    const text = await res.text();
    if (text.length > MAX_DOCUMENT_BYTES) return { status: res.status, json: undefined, finalUrl: res.url || url, error: 'too_large' };
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json, finalUrl: res.url || url, error: null };
  } catch (e) {
    return { status: 0, json: undefined, finalUrl: url, error: e && e.name === 'TimeoutError' ? 'timeout' : 'fetch' };
  }
}

// Reads poppy.json from the host and checks it the way an agent would.
// `present`: there is a JSON document at the address. `valid`: an agent would use it.
// fetch only shows the final URL of a redirect chain, so "every hop is https"
// (the audit's check) is reduced here to "it ends on https".
export async function probePoppy(host, fetchImpl = fetch) {
  const url = 'https://' + host + POPPY_PATH;
  const block = { present: false, valid: false, url, status: null, issues: [] };
  const res = await getJson(url, fetchImpl);
  block.status = res.status;
  if (res.json === undefined) return res.error ? { ...block, error: res.error } : block;

  block.present = true;
  const { valid, issues: shapeIssues, ...checked } = validatePoppyDocument(res.json, host);
  const issues = [...shapeIssues];
  if (!String(res.finalUrl).startsWith('https://')) issues.push('not_https');

  if (checked.issuer && checked.organizationDomain && !issues.length) {
    const meta = await getJson(issuerMetadataUrl(checked.issuer), fetchImpl);
    if (meta.status === 0 || meta.status >= 400) issues.push('issuer_metadata_unreachable');
    else issues.push(...checkIssuerMetadata(meta.json, checked.issuer, checked.organizationDomain));
  }

  return { ...block, ...checked, issues, valid: !issues.length };
}
