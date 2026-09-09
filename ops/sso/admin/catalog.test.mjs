import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeEntry, readCatalog, saveCatalogEntry } from './catalog.mjs';
import { catalogAuthorize } from './catalog-auth.mjs';
import { UserStore, serializeUserDatabase, groupsForAssignment, normalizeGroups, assignmentFromWireGroups } from './lib.mjs';
import { createHandler, identity } from './server.mjs';

test('catalog persists applications, enforces cks ownership, and authorizes actual URL prefixes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bonifacio-catalog-'));
  process.env.APPLICATION_CATALOG_PATH = join(directory, 'catalog.json');
  const userDirectory = join(directory, 'current');
  await mkdir(userDirectory, { mode: 0o700 });
  const user = (name, groups) => ({ disabled: false, displayname: name, email: `${name}@example.com`, password: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$ZGlnZXN0', groups });
  const database = { users: {
    cks: user('cks', ['user', 'admin', 'chief-admin', 'portfolio-v2']),
    other: user('other', ['user', 'admin', 'chief-admin', 'portfolio-v2']),
    member: user('member', ['user', 'portfolio-v2', 'access-react', 'access-pongdang']),
    denied: user('denied', ['user', 'portfolio-v2']),
  } };
  const path = join(userDirectory, 'users_database.yml');
  await writeFile(path, serializeUserDatabase(database), { mode: 0o600 });
  const store = new UserStore(path, { minimumWriteIntervalMs: 0 });
  const edgeSecret = 'catalog-test-only-edge-secret-32-bytes';
  const headersFor = (name) => ({
    'Remote-User': name, 'Remote-Name': name, 'Remote-Email': `${name}@example.com`,
    'Remote-Groups': database.users[name].groups.join(','), 'X-Portfolio-Edge-Secret': edgeSecret,
  });
  const server = createServer(createHandler({ store, edgeSecret }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const endpoint = `${base}/sso/user/api/applications`;
  try {
    await t.test('URL validation rejects executable, reserved, ambiguous and overlapping routes', () => {
      const entry = { id: 'sample', title: 'Sample', href: '/sample/', description: '' };
      for (const href of ['javascript:alert(1)', '//evil.example/', '/sso/', '/api/', '/react/', '/wgang/', '/nested/path/', '/sample/?x=1', '/sample/../sso/', 'https://user:pass@example.com/', 'http://example.com/', '/sample\\evil/']) {
        assert.throws(() => normalizeEntry({ ...entry, href }), `accepted ${href}`);
      }
      assert.equal(normalizeEntry({ ...entry, href: 'https://bonifacio.work/sample/' }).href, '/sample/');
      assert.equal(normalizeEntry({ ...entry, href: 'https://example.com/docs' }).href, 'https://example.com/docs');
    });
    await t.test('anonymous and forged requests cannot list or write the catalog', async () => {
      assert.equal((await fetch(endpoint)).status, 401);
      assert.equal((await fetch(endpoint, { headers: { ...headersFor('cks'), 'Remote-Email': 'forged@example.com' } })).status, 403);
      assert.equal((await fetch(endpoint, { method: 'POST', headers: headersFor('cks') })).status, 403);
      assert.equal((await fetch(`${base}/internal/catalog/authz`)).status, 401);
    });
    await t.test('cks adds a persistent application; other chief admins and stale writes are rejected', async () => {
      const initial = await (await fetch(endpoint, { headers: headersFor('cks') })).json();
      assert.equal(initial.canManage, true);
      assert.equal(initial.entries[0].id, 'pongdang');
      const entry = { id: 'sample', title: '새 앱', href: '/different-url/', description: '설명' };
      async function post(name, revision = initial.revision) {
        const session = await fetch(`${base}/sso/user/api/session`, { headers: headersFor(name) });
        const token = (await session.json()).csrfToken;
        return fetch(endpoint, { method: 'POST', headers: {
          ...headersFor(name), Origin: 'https://bonifacio.work', 'Content-Type': 'application/json',
          Cookie: session.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': token, 'If-Match': revision,
        }, body: JSON.stringify(entry) });
      }
      assert.equal((await post('other')).status, 403);
      const response = await post('cks');
      assert.equal(response.status, 201);
      const result = await response.json();
      assert.deepEqual(readCatalog().entries.at(-1), entry);
      assert.equal((await stat(process.env.APPLICATION_CATALOG_PATH)).mode & 0o777, 0o600);
      assert.equal((await post('cks')).status, 409);
      assert.equal((await post('cks', result.revision)).status, 409);
      assert.deepEqual(groupsForAssignment('user', ['pongdang', 'sample']), ['user', 'portfolio-v2', 'access-pongdang', 'access-sample']);
      assert.throws(() => normalizeGroups(['user', 'portfolio-v2', 'access-sample', 'access-pongdang']));
      assert.throws(() => normalizeGroups(['user', 'portfolio-v2', 'access-unregistered']));
      assert.equal(assignmentFromWireGroups(['user', 'developer']).applications.includes('sample'), false);
      const session = await (await fetch(`${base}/sso/admin/api/session`, { headers: headersFor('cks') })).json();
      assert.ok(session.authorization.applications.some(({ id }) => id === 'sample'));
      await saveCatalogEntry({ id: 'external', title: 'External', href: 'https://example.com/', description: '' }, result.revision);
      assert.throws(() => groupsForAssignment('user', ['external']));
    });
    await t.test('authorization checks active database grants and projects old product headers', async () => {
      async function authorize(name, url, status = 200, groups) {
        let authUrl;
        const response = { status: 0, headers: {}, writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this; }, end() { return this; } };
        await catalogAuthorize({ headers: { 'x-original-url': `https://bonifacio.work${url}`, cookie: 'test-session' } }, response, {
          store, identity,
          fetchAuth: async (target, options) => {
            assert.equal(target, 'http://127.0.0.1:9091/api/authz/auth-request');
            authUrl = options.headers['X-Original-URL'];
            return new Response(null, { status, headers: { ...headersFor(name), ...(groups ? { 'Remote-Groups': groups } : {}) } });
          },
        });
        return { ...response, authUrl };
      }
      assert.equal((await authorize('member', '/pongdang/api/data')).status, 200);
      assert.equal((await authorize('member', '/pongdang/api/data')).authUrl, 'https://bonifacio.work/sso/user/');
      assert.equal((await authorize('denied', '/pongdang/')).status, 403);
      assert.equal((await authorize('cks', '/different-url/')).status, 200);
      assert.equal((await authorize('member', '/different-url/')).status, 403);
      assert.equal((await authorize('member', '/react/')).headers['remote-groups'], 'user,portfolio-v2,access-react');
      assert.equal((await authorize('member', '/sso/user/')).headers['remote-groups'], 'user,portfolio-v2,access-react,access-pongdang');
      assert.equal((await authorize('member', '/pongdang/%2fapi')).status, 403);
      const anonymous = await authorize('member', '/pongdang/', 401);
      assert.equal(anonymous.status, 401);
      assert.match(anonymous.headers.Location, /rd=https%3A%2F%2Fbonifacio.work%2Fpongdang%2F/);
      await assert.rejects(authorize('member', '/pongdang/', 200, 'user,portfolio-v2,access-pongdang'));
      await assert.rejects(authorize('member', '/react/', 200, 'user,portfolio-v2,access-unregistered'));
      database.users.member.disabled = true;
      await writeFile(path, serializeUserDatabase(database), { mode: 0o600 });
      await assert.rejects(authorize('member', '/pongdang/'));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.APPLICATION_CATALOG_PATH;
    await rm(directory, { recursive: true, force: true });
  }
});
