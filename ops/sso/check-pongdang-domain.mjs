import assert from 'node:assert/strict';
import https from 'node:https';

// Check the real TLS virtual host locally; verify the public certificate and
// never print cookies, authorization state or callback query parameters.
function request(path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: '127.0.0.1', servername: 'pongdang.site', port: 443,
      path, method: 'GET', headers: { Host: 'pongdang.site', ...extraHeaders }, timeout: 10000,
    }, (res) => { res.resume(); res.on('end', () => resolve(res)); });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

for (const path of ['/', '/pongdang/', '/pongdang/api/data/summary', '/api/data/summary']) {
  const response = await request(path, { 'X-Pongdang-SSO-Subject': 'cks', 'X-Pongdang-SSO-Grants': 'chief-admin,access-pongdang', 'Remote-User': 'cks' });
  assert.equal(response.statusCode, 302, path);
  assert.equal(new URL(response.headers.location, 'https://pongdang.site').pathname, '/oauth2/start');
}
assert.equal((await request('/_pongdang_auth')).statusCode, 404);
assert.equal((await request('/oauth2/auth')).statusCode, 404);
const start = await request('/oauth2/start?rd=https%3A%2F%2Fpongdang.site%2F');
assert.equal(start.statusCode, 302);
const authorization = new URL(start.headers.location);
assert.equal(authorization.origin, 'https://bonifacio.work');
assert.equal(authorization.pathname, '/sso/api/oidc/authorization');
assert.equal(authorization.searchParams.get('client_id'), 'pongdang-site');
assert.equal(authorization.searchParams.get('redirect_uri'), 'https://pongdang.site/oauth2/callback');
assert.equal(authorization.searchParams.get('response_type'), 'code');
assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
assert.ok(authorization.searchParams.get('nonce'));
// Use a syntactically valid state but omit its browser CSRF cookie.
assert.equal((await request(`/oauth2/callback?code=invalid&state=${encodeURIComponent(authorization.searchParams.get('state'))}`)).statusCode, 403);
for (const cookie of start.headers['set-cookie'] ?? []) {
  assert.match(cookie, /; secure/i);
  assert.match(cookie, /; httponly/i);
  assert.match(cookie, /; samesite=lax/i);
  assert.doesNotMatch(cookie, /; domain=/i);
}
assert.ok(start.headers['set-cookie']?.length);
const login = await fetch(authorization, { redirect: 'manual' });
assert.equal(login.status, 302);
const loginURL = new URL(login.headers.get('location'));
assert.equal(loginURL.origin, 'https://bonifacio.work');
assert.equal(loginURL.searchParams.get('flow'), 'openid_connect');
assert.ok(loginURL.searchParams.get('flow_id'));
await login.body?.cancel();

// Authelia changes /sso/ to /sso in browser history. Reloading must keep the
// OIDC flow as well as the older same-domain login's encoded return URL.
const legacyQuery = new URLSearchParams({ rd: 'https://bonifacio.work/pongdang/?view=a&filter=b', rm: 'GET' });
for (const search of ['', loginURL.search, `?${legacyQuery}`]) {
  for (const method of ['GET', 'HEAD']) {
    const canonical = await fetch(`https://bonifacio.work/sso${search}`, { method, redirect: 'manual' });
    assert.equal(canonical.status, 308, `canonical ${method}`);
    const target = new URL(canonical.headers.get('location'), loginURL);
    assert.equal(target.origin, loginURL.origin);
    assert.equal(target.pathname, '/sso/');
    assert.equal(target.search, search, 'login context must survive slash normalization');
    assert.match(canonical.headers.get('cache-control') ?? '', /\bno-store\b/);
    await canonical.body?.cancel();
  }
}
console.log('PASS: TLS, access rejection, callback CSRF, OIDC/PKCE/nonce, secure cookies and both domains\' login context through portal redirects.');
