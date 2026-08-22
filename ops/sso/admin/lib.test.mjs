import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  AdminError,
  ROLE_CONTRACT,
  UserStore,
  assertAdminMutationAllowed,
  assertAuthorizedAdmin,
  normalizePassword,
  normalizeRoles,
  parseUserDatabase,
  publicUsers,
  serializeUserDatabase,
} from './lib.mjs';
import {
  createHandler,
  identity,
  requireMutationProtection,
  requireTrustedEdge,
  validateEdgeSecret,
} from './server.mjs';

const digest = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$ZGlnZXN0';
const changedDigest = '$argon2id$v=19$m=65536,t=3,p=4$bmV3c2FsdA$bmV3ZGlnZXN0';

function database() {
  return {
    users: {
      owner: {
        disabled: false,
        displayname: 'Owner',
        password: digest,
        email: 'owner@bonifacio.work',
        groups: ['user', 'developer', 'admin'],
      },
      member: {
        disabled: false,
        displayname: 'Member',
        password: digest,
        email: 'member@example.com',
        groups: ['user'],
      },
    },
  };
}

test('user database round-trips without exposing password hashes', () => {
  const parsed = parseUserDatabase(serializeUserDatabase(database()));
  assert.deepEqual(Object.keys(parsed.users), ['member', 'owner']);
  const publicResult = publicUsers(parsed);
  assert.equal(publicResult.length, 2);
  assert.equal(JSON.stringify(publicResult).includes('argon2'), false);
  assert.equal(JSON.stringify(publicResult).includes('password'), false);
});

test('chosen passwords allow four-character bootstrap values and reject unsafe input', () => {
  assert.equal(normalizePassword('1234'), '1234');
  assert.equal(normalizePassword('내가 원하는 안전한 비밀번호!'), '내가 원하는 안전한 비밀번호!');
  for (const value of ['123', 'line\nbreak', 'x'.repeat(129), null]) {
    assert.throws(
      () => normalizePassword(value),
      (error) => error instanceof AdminError && error.code === 'invalid_password',
    );
  }
});

test('database rejects duplicate YAML keys and unknown groups', () => {
  assert.throws(
    () => parseUserDatabase(`---\nusers:\n  owner: {}\n  owner: {}\n`),
    AdminError,
  );
  const unsafe = database();
  unsafe.users.member.groups = ['user', 'auditor'];
  assert.throws(() => serializeUserDatabase(unsafe), AdminError);
  const duplicateEmail = database();
  duplicateEmail.users.member.email = 'owner@bonifacio.work';
  assert.throws(() => serializeUserDatabase(duplicateEmail), AdminError);
  for (const disabled of ['true', 0, null]) {
    const invalidDisabled = database();
    invalidDisabled.users.member.disabled = disabled;
    assert.throws(() => serializeUserDatabase(invalidDisabled), AdminError);
  }
  const unknownField = database();
  unknownField.users.member.passwordHint = 'must-not-be-silently-dropped';
  assert.throws(() => serializeUserDatabase(unknownField), AdminError);
  const unknownRoot = serializeUserDatabase(database()).replace(
    'users:\n',
    'metadata: should-not-be-silently-dropped\nusers:\n',
  );
  assert.throws(() => parseUserDatabase(unknownRoot), AdminError);
});

test('central roles are strict hierarchy-closed prefixes', () => {
  assert.deepEqual(ROLE_CONTRACT.roles, ['user', 'developer', 'admin']);
  assert.deepEqual(normalizeRoles(['user', 'developer', 'admin']), ['user', 'developer', 'admin']);
  for (const value of [
    [],
    ['developer'],
    ['admin', 'user', 'developer'],
    ['developer', 'user'],
    ['user', 'admin'],
    ['user', 'user'],
    ['user', 'owners'],
    ['user', ''],
  ]) {
    assert.throws(
      () => normalizeRoles(value),
      (error) => error instanceof AdminError && error.code === 'invalid_roles',
    );
  }
});

test('last admin and current administrator cannot lock themselves out', () => {
  const value = database();
  const disabledAdmin = { ...value.users.owner, disabled: true };
  assert.throws(
    () => assertAdminMutationAllowed(value, 'owner', 'owner', disabledAdmin),
    (error) => error instanceof AdminError && error.code === 'self_lockout',
  );
  assert.throws(
    () => assertAdminMutationAllowed(value, 'another-admin', 'owner', disabledAdmin),
    (error) => error instanceof AdminError && error.code === 'last_admin',
  );
});

test('current administrator is revalidated against the locked database snapshot', () => {
  const value = database();
  assert.doesNotThrow(() =>
    assertAuthorizedAdmin(value, {
      username: 'owner',
      email: 'owner@bonifacio.work',
      groups: ['user', 'developer', 'admin'],
    }),
  );
  value.users.owner.groups = ['user', 'developer'];
  assert.throws(
    () => assertAuthorizedAdmin(value, {
      username: 'owner',
      email: 'owner@bonifacio.work',
      groups: ['user', 'developer', 'admin'],
    }),
    (error) => error instanceof AdminError && error.code === 'admin_required',
  );
});

test('identity requires exact canonical admin roles and mutations require origin plus CSRF', () => {
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  assert.throws(
    () => requireTrustedEdge({ headers: {} }, edgeSecret),
    (error) => error instanceof AdminError && error.code === 'untrusted_edge',
  );
  assert.doesNotThrow(() =>
    requireTrustedEdge(
      { headers: { 'x-portfolio-edge-secret': edgeSecret } },
      edgeSecret,
    ),
  );
  assert.throws(
    () => identity({ headers: {
      'remote-user': 'owner',
      'remote-email': 'owner@bonifacio.work',
      'remote-groups': 'user,developer',
    } }),
    (error) => error instanceof AdminError && error.status === 403,
  );
  for (const groups of [
    'user,developer,admin,admin',
    'user,unknown,admin',
    'user,,developer,admin',
    'user, developer,admin',
    'user,developer,admin ',
    'admin,developer,user',
  ]) {
    assert.throws(
      () => identity({ headers: {
        'remote-user': 'owner',
        'remote-email': 'owner@bonifacio.work',
        'remote-groups': groups,
      } }),
      (error) => error instanceof AdminError && error.code === 'invalid_identity',
    );
  }
  const request = {
    headers: {
      'remote-user': 'owner',
      'remote-email': 'owner@bonifacio.work',
      'remote-groups': 'user,developer,admin',
      origin: 'https://bonifacio.work',
      cookie: 'bonifacio_admin_csrf=known-token',
      'x-csrf-token': 'known-token',
    },
  };
  assert.equal(identity(request).username, 'owner');
  assert.deepEqual(identity(request).groups, ['user', 'developer', 'admin']);
  assert.doesNotThrow(() => requireMutationProtection(request));
  assert.throws(
    () => requireMutationProtection({ ...request, headers: { ...request.headers, origin: 'https://evil.invalid' } }),
    AdminError,
  );
});

test('admin edge secret rejects placeholders and non-printable values', () => {
  assert.equal(validateEdgeSecret('valid-private-edge-secret-value-2026'), 'valid-private-edge-secret-value-2026');
  for (const value of ['short', 'replace-with-a-private-edge-secret-value', `valid-secret-${'a'.repeat(32)}\n`]) {
    assert.throws(
      () => validateEdgeSecret(value),
      (error) => error instanceof AdminError && error.code === 'edge_secret_invalid',
    );
  }
});

test('atomic store keeps a backup, mode 0600, and redacted audit log', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bonifacio-userdb-'));
  const path = join(directory, 'users_database.yml');
  try {
    await writeFile(path, serializeUserDatabase(database()), { mode: 0o600 });
    const store = new UserStore(path, { minimumWriteIntervalMs: 0 });
    await store.mutate({
      actor: 'owner',
      action: 'disable_user',
      target: 'member',
      transform: async (value) => {
        value.users.member.disabled = true;
      },
    });
    assert.equal((await store.read()).users.member.disabled, true);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal((await readdir(join(directory, 'backups'))).length, 1);
    const audit = await readFile(join(directory, 'audit.jsonl'), 'utf8');
    assert.match(audit, /"actor":"owner"/);
    assert.match(audit, /"phase":"prepared"/);
    assert.match(audit, /"phase":"committed"/);
    assert.equal(audit.includes(digest), false);
    assert.equal(audit.toLowerCase().includes('password'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('admin API creates and lists a redacted account through all authentication checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bonifacio-admin-api-'));
  const current = join(directory, 'current');
  const path = join(current, 'users_database.yml');
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  const temporaryPassword = 'one-time-password-not-stored';
  let verifiedPassword;
  let chosenPassword;
  await mkdir(current, { mode: 0o700 });
  await writeFile(path, serializeUserDatabase(database()), { mode: 0o600 });
  const server = createServer(createHandler({
    store: new UserStore(path, { minimumWriteIntervalMs: 0 }),
    edgeSecret,
    generateCredential: async () => ({ password: temporaryPassword, digest }),
    verifyCredential: async (password, currentDigest) => {
      verifiedPassword = password;
      assert.equal(currentDigest, digest);
      return password === 'current-owner-password';
    },
    hashCredential: async (password) => {
      chosenPassword = password;
      return changedDigest;
    },
  }));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}/sso/admin/api`;
    const identityHeaders = {
      'Remote-User': 'owner',
      'Remote-Email': 'owner@bonifacio.work',
      'Remote-Groups': 'user,developer,admin',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    const sessionResponse = await fetch(`${base}/session`, { headers: identityHeaders });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(cookie);

    const initialListResponse = await fetch(`${base}/users`, { headers: identityHeaders });
    assert.equal(initialListResponse.status, 200);
    const initialList = await initialListResponse.json();
    assert.match(initialList.revision, /^[a-f0-9]{64}$/);

    const createResponse = await fetch(`${base}/users`, {
      method: 'POST',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': initialList.revision,
      },
      body: JSON.stringify({
        username: 'new-member',
        displayName: 'New Member',
        email: 'new-member@example.com',
        roles: ['user', 'developer'],
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.temporaryPassword, temporaryPassword);
    assert.deepEqual(created.user.groups, ['user', 'developer']);
    assert.match(created.revision, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(created).includes(digest), false);

    const listResponse = await fetch(`${base}/users`, { headers: identityHeaders });
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json();
    assert.equal(listed.users.some((user) => user.username === 'new-member'), true);
    assert.equal(JSON.stringify(listed).includes('password'), false);
    assert.equal(JSON.stringify(listed).includes('argon2'), false);

    const promoteResponse = await fetch(`${base}/users/new-member`, {
      method: 'PATCH',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': created.revision,
      },
      body: JSON.stringify({
        displayName: 'New Member',
        roles: ['user', 'developer', 'admin'],
        disabled: false,
      }),
    });
    assert.equal(promoteResponse.status, 200);
    const promoted = await promoteResponse.json();
    assert.deepEqual(promoted.user.groups, ['user', 'developer', 'admin']);
    assert.match(promoted.revision, /^[a-f0-9]{64}$/);

    const wrongCurrentResponse = await fetch(`${base}/account/password`, {
      method: 'POST',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': promoted.revision,
      },
      body: JSON.stringify({
        currentPassword: 'wrong-owner-password',
        newPassword: '1234',
        confirmPassword: '1234',
      }),
    });
    assert.equal(wrongCurrentResponse.status, 400);
    assert.equal(chosenPassword, undefined);

    const changePasswordResponse = await fetch(`${base}/account/password`, {
      method: 'POST',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': promoted.revision,
      },
      body: JSON.stringify({
        currentPassword: 'current-owner-password',
        newPassword: 'chosen-owner-password',
        confirmPassword: 'chosen-owner-password',
      }),
    });
    assert.equal(changePasswordResponse.status, 200);
    const changed = await changePasswordResponse.json();
    assert.equal(changed.changed, true);
    assert.equal(changed.logoutUrl, '/sso/logout?rd=https%3A%2F%2Fbonifacio.work%2Fsso%2Fadmin%2F');
    assert.match(changed.revision, /^[a-f0-9]{64}$/);
    assert.equal(verifiedPassword, 'current-owner-password');
    assert.equal(chosenPassword, 'chosen-owner-password');
    assert.equal((await new UserStore(path).read()).users.owner.password, changedDigest);
    assert.equal(JSON.stringify(changed).includes('chosen-owner-password'), false);

    const invalidDisabledResponse = await fetch(`${base}/users/member`, {
      method: 'PATCH',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': created.revision,
      },
      body: JSON.stringify({ displayName: 'Member', roles: ['user'], disabled: 'false' }),
    });
    assert.equal(invalidDisabledResponse.status, 400);

    const invalidRolesResponse = await fetch(`${base}/users/member`, {
      method: 'PATCH',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': changed.revision,
      },
      body: JSON.stringify({
        displayName: 'Member',
        roles: ['user', 'admin'],
        disabled: false,
      }),
    });
    assert.equal(invalidRolesResponse.status, 400);

    const staleResponse = await fetch(`${base}/users/member`, {
      method: 'PATCH',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': initialList.revision,
      },
      body: JSON.stringify({ displayName: 'Stale edit', roles: ['user'], disabled: false }),
    });
    assert.equal(staleResponse.status, 409);

    const staleGroupResponse = await fetch(`${base}/users`, {
      headers: { ...identityHeaders, 'Remote-User': 'member', 'Remote-Email': 'member@example.com' },
    });
    assert.equal(staleGroupResponse.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('admin mutation rechecks central admin state before spawning a password hash', async () => {
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  let generated = 0;
  const store = {
    async read() {
      return database();
    },
    async readVersioned() {
      return { database: database(), revision: 'a'.repeat(64) };
    },
    async mutate({ transform }) {
      const locked = database();
      locked.users.owner.groups = ['user', 'developer'];
      await transform(locked);
    },
  };
  const server = createServer(createHandler({
    store,
    edgeSecret,
    generateCredential: async () => {
      generated += 1;
      return { password: 'should-not-be-created', digest };
    },
  }));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}/sso/admin/api`;
    const headers = {
      'Remote-User': 'owner',
      'Remote-Email': 'owner@bonifacio.work',
      'Remote-Groups': 'user,developer,admin',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    const sessionResponse = await fetch(`${base}/session`, { headers });
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    const response = await fetch(`${base}/users`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': 'a'.repeat(64),
      },
      body: JSON.stringify({
        username: 'blocked-user',
        displayName: 'Blocked User',
        email: 'blocked@example.com',
        roles: ['user'],
      }),
    });
    assert.equal(response.status, 403);
    assert.equal(generated, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
