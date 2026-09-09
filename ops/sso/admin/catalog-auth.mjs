import { readCatalog } from './catalog.mjs';
import { ROLE_CONTRACT, CHIEF_ADMIN_ROLE, assertAuthorizedUser } from './lib.mjs';

const identityHeaders = ['remote-user', 'remote-groups', 'remote-name', 'remote-email'];
const baselineGroups = new Set(ROLE_CONTRACT.applications.map(({ group }) => group));

export async function catalogAuthorize(request, response, { store, identity, fetchAuth = fetch }) {
  let url;
  try { url = new URL(request.headers['x-original-url']); } catch { response.writeHead(403).end(); return; }
  if (url.protocol !== 'https:' || !['bonifacio.work', 'www.bonifacio.work'].includes(url.host)
    || url.username || url.password || /%(?:2f|5c|2e|00)/i.test(url.pathname) || url.pathname.includes('\\')) {
    response.writeHead(403).end(); return;
  }
  const dynamic = readCatalog().entries.find(({ href }) => href.startsWith('/')
    && (url.pathname === href.slice(0, -1) || url.pathname.startsWith(href)));
  const headers = {
    'X-Original-URL': dynamic ? `${url.origin}/sso/user/` : url.href,
    'X-Original-Method': request.headers['x-original-method'] ?? 'GET',
    'X-Forwarded-For': request.headers['x-forwarded-for'] ?? '',
    'X-Forwarded-Proto': 'https',
    Cookie: request.headers.cookie ?? '',
  };
  const upstream = await fetchAuth('http://127.0.0.1:9091/api/authz/auth-request', {
    headers, redirect: 'manual', signal: AbortSignal.timeout(7000),
  });
  if (upstream.status !== 200) {
    const status = [401, 403].includes(upstream.status) ? upstream.status : 503;
    const location = `${url.origin}/sso/?rd=${encodeURIComponent(url.href)}`;
    response.writeHead(status, { 'Cache-Control': 'no-store', ...(status === 401 ? { Location: location } : {}) }).end();
    await upstream.body?.cancel();
    return;
  }
  const trusted = Object.fromEntries(identityHeaders.map((name) => [name, upstream.headers.get(name) ?? '']));
  const actor = identity({ headers: trusted });
  if (dynamic) {
    assertAuthorizedUser(await store.read(), actor);
    if (actor.role !== CHIEF_ADMIN_ROLE && !actor.applications.includes(dynamic.id)) {
      response.writeHead(403, { 'Cache-Control': 'no-store' }).end();
      await upstream.body?.cancel();
      return;
    }
  }
  // Existing product parsers know the committed v2 prefix only. Central account
  // APIs and the landing keep the complete assertion for database revalidation.
  const isProduct = ROLE_CONTRACT.applications.some(({ id }) => url.pathname === `/${id}` || url.pathname.startsWith(`/${id}/`))
    || url.pathname.startsWith('/api/');
  if (isProduct && trusted['remote-groups'].split(',').includes('portfolio-v2')) {
    trusted['remote-groups'] = trusted['remote-groups'].split(',')
      .filter((group) => !group.startsWith('access-') || baselineGroups.has(group)).join(',');
  }
  response.writeHead(200, { 'Cache-Control': 'no-store', ...trusted }).end();
  await upstream.body?.cancel();
}
