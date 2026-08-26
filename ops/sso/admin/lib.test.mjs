import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  AdminError,
  APPLICATIONS,
  ROLE_CONTRACT,
  UserStore,
  assertAdminMayCreate,
  assertAdminMayResetPassword,
  assertAdminMutationAllowed,
  assertAuthorizedAdmin,
  assertAuthorizedUser,
  assignmentFromWireGroups,
  groupsForAssignment,
  normalizeChosenPassword,
  normalizeGroups,
  normalizePassword,
  parseUserDatabase,
  publicUser,
  publicUsers,
  serializeUserDatabase,
} from './lib.mjs';
import {
  createHandler,
  identity,
  requireMutationProtection,
  requireTrustedEdge,
  requireUserMutationProtection,
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
        groups: ['user', 'admin', 'chief-admin', 'portfolio-v2'],
      },
      member: {
        disabled: false,
        displayname: 'Member',
        password: digest,
        email: 'member@example.com',
        groups: ['user', 'portfolio-v2', 'access-feelmyrythm'],
      },
    },
  };
}

test('user database round-trips without exposing password hashes', () => {
  const parsed = parseUserDatabase(serializeUserDatabase(database()));
  assert.deepEqual(Object.keys(parsed.users), ['member', 'owner']);
  assert.deepEqual(publicUser(parsed, 'member'), {
    username: 'member',
    displayName: 'Member',
    email: 'member@example.com',
    role: 'user',
    applications: ['feelmyrythm'],
    disabled: false,
  });
  assert.equal(publicUser(parsed, 'missing'), undefined);
  const publicResult = publicUsers(parsed);
  assert.equal(publicResult.length, 2);
  assert.equal(JSON.stringify(publicResult).includes('argon2'), false);
  assert.equal(JSON.stringify(publicResult).includes('password'), false);
});

test('stored and current passwords retain compatibility while chosen passwords match policy', () => {
  assert.equal(normalizePassword('1234'), '1234');
  assert.equal(normalizePassword('x', '현재 비밀번호', 1), 'x');
  assert.equal(normalizePassword('내가 원하는 안전한 비밀번호!'), '내가 원하는 안전한 비밀번호!');
  for (const value of ['123', 'line\nbreak', 'x'.repeat(129), null]) {
    assert.throws(
      () => normalizePassword(value),
      (error) => error instanceof AdminError && error.code === 'invalid_password',
    );
  }
  const minimum = `Aa1!${'x'.repeat(10)}`;
  assert.equal(Array.from(minimum).length, 14);
  assert.equal(normalizeChosenPassword(minimum), minimum);
  assert.equal(normalizeChosenPassword('StrongPassword1!'), 'StrongPassword1!');
  assert.equal(normalizeChosenPassword('StrongPassword1★'), 'StrongPassword1★');
  const maximum = `Aa1!${'x'.repeat(124)}`;
  assert.equal(Array.from(maximum).length, 128);
  assert.equal(normalizeChosenPassword(maximum), maximum);
  for (const value of [
    'Short1!',
    `Aa1!${'x'.repeat(9)}`,
    'lowercaseonly1!',
    'UPPERCASEONLY1!',
    'NoNumberPassword!',
    'NoSpecialPass12',
    'SpaceIsNotSpec1 ',
    `Aa1!${'x'.repeat(125)}`,
    'StrongPass1!\nunsafe',
    null,
  ]) {
    assert.throws(
      () => normalizeChosenPassword(value),
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

test('v2 groups require a role prefix, marker, and catalog-ordered application grants', () => {
  assert.deepEqual(ROLE_CONTRACT.roles, ['user', 'admin', 'chief-admin']);
  assert.deepEqual(
    groupsForAssignment('admin', ['monitor', 'feelmyrythm']),
    ['user', 'admin', 'portfolio-v2', 'access-monitor', 'access-feelmyrythm'],
  );
  assert.deepEqual(
    groupsForAssignment('chief-admin', []),
    ['user', 'admin', 'chief-admin', 'portfolio-v2'],
  );
  for (const value of [
    [],
    ['user'],
    ['admin', 'portfolio-v2'],
    ['user', 'admin'],
    ['user', 'portfolio-v2', 'access-monitor', 'access-react'],
    ['user', 'portfolio-v2', 'access-api'],
    ['user', 'portfolio-v2', 'portfolio-v2'],
    ['user', 'user'],
    ['user', 'owners'],
    ['user', ''],
  ]) {
    assert.throws(
      () => normalizeGroups(value),
      (error) => error instanceof AdminError && error.code === 'invalid_groups',
    );
  }
});

test('legacy wire groups are expanded narrowly without exposing developer as a v2 role', () => {
  assert.deepEqual(
    assignmentFromWireGroups(['user']).groups,
    groupsForAssignment('user', APPLICATIONS.map(({ id }) => id).filter((id) => id !== 'monitor')),
  );
  assert.deepEqual(
    assignmentFromWireGroups(['user', 'developer']).groups,
    groupsForAssignment('user', APPLICATIONS.map(({ id }) => id)),
  );
  assert.deepEqual(
    assignmentFromWireGroups(['user', 'developer', 'admin']).groups,
    groupsForAssignment('chief-admin', []),
  );
  for (const value of [
    ['developer'],
    ['user', 'admin'],
    ['user', 'developer', 'portfolio-v2'],
    ['user', 'developer', 'developer'],
    ['admin', 'developer', 'user'],
  ]) assert.throws(() => assignmentFromWireGroups(value), AdminError);
});

test('legacy database records read through expand compatibility and serialize only v2', () => {
  const canonical = serializeUserDatabase(database());
  const legacy = canonical
    .replace(
      '    groups:\n      - user\n      - portfolio-v2\n      - access-feelmyrythm\n',
      '    groups:\n      - user\n',
    )
    .replace(
      '    groups:\n      - user\n      - admin\n      - chief-admin\n      - portfolio-v2\n',
      '    groups:\n      - user\n      - developer\n      - admin\n',
    );
  const expanded = parseUserDatabase(legacy);
  assert.deepEqual(
    expanded.users.owner.groups,
    ['user', 'admin', 'chief-admin', 'portfolio-v2'],
  );
  assert.equal(expanded.users.member.groups.includes('access-monitor'), false);
  const rewritten = serializeUserDatabase(expanded);
  assert.equal(rewritten.includes('developer'), false);
  assert.equal(rewritten.includes('portfolio-v2'), true);
});

test('last chief and current administrator cannot change protected self assignments', () => {
  const value = database();
  const disabledAdmin = { ...value.users.owner, disabled: true };
  assert.throws(
    () => assertAdminMutationAllowed(value, { username: 'owner' }, 'owner', disabledAdmin),
    (error) => error instanceof AdminError && error.code === 'self_assignment_forbidden',
  );
  value.users.backup = {
    ...value.users.owner,
    disabled: true,
    email: 'backup@bonifacio.work',
  };
  assert.throws(
    () => assertAdminMutationAllowed(value, { username: 'backup' }, 'owner', disabledAdmin),
    (error) => error instanceof AdminError && error.code === 'last_chief_admin',
  );
});

test('delegated admins can manage only non-admin accounts', () => {
  const value = database();
  value.users.delegate = {
    disabled: false,
    displayname: 'Delegate',
    password: digest,
    email: 'delegate@bonifacio.work',
    groups: groupsForAssignment('admin', ['monitor']),
  };
  const actor = { username: 'delegate' };
  const memberNext = {
    ...value.users.member,
    groups: groupsForAssignment('user', ['monitor', 'feelmyrythm']),
  };
  assert.doesNotThrow(() => assertAdminMutationAllowed(value, actor, 'member', memberNext));
  assert.throws(
    () => assertAdminMutationAllowed(value, actor, 'member', {
      ...memberNext,
      groups: groupsForAssignment('admin', ['monitor']),
    }),
    (error) => error instanceof AdminError && error.code === 'chief_admin_required',
  );
  assert.throws(
    () => assertAdminMutationAllowed(value, actor, 'delegate', value.users.delegate),
    (error) => error instanceof AdminError && error.code === 'chief_admin_required',
  );
  assert.throws(
    () => assertAdminMayCreate(value, actor, 'admin'),
    (error) => error instanceof AdminError && error.code === 'chief_admin_required',
  );
  assert.throws(
    () => assertAdminMayResetPassword(value, actor, 'owner'),
    (error) => error instanceof AdminError && error.code === 'chief_admin_required',
  );
});

test('current user and administrator are exactly revalidated against the database snapshot', () => {
  const value = database();
  const member = {
    username: 'member',
    displayName: 'Member',
    email: 'member@example.com',
    groups: ['user', 'portfolio-v2', 'access-feelmyrythm'],
  };
  assert.doesNotThrow(() => assertAuthorizedUser(value, member));
  for (const actor of [
    { ...member, displayName: 'Forged Member' },
    { ...member, email: 'forged@example.com' },
    { ...member, groups: ['user', 'portfolio-v2'] },
    { ...member, username: 'missing' },
  ]) {
    assert.throws(
      () => assertAuthorizedUser(value, actor),
      (error) => error instanceof AdminError && error.code === 'user_required',
    );
  }
  value.users.member.disabled = true;
  assert.throws(
    () => assertAuthorizedUser(value, member),
    (error) => error instanceof AdminError && error.code === 'user_required',
  );
  value.users.member.disabled = false;
  assert.doesNotThrow(() =>
    assertAuthorizedAdmin(value, {
      username: 'owner',
      displayName: 'Owner',
      email: 'owner@bonifacio.work',
      groups: ['user', 'admin', 'chief-admin', 'portfolio-v2'],
    }),
  );
  value.users.owner.groups = ['user', 'admin', 'portfolio-v2'];
  assert.throws(
    () => assertAuthorizedAdmin(value, {
      username: 'owner',
      displayName: 'Owner',
      email: 'owner@bonifacio.work',
      groups: ['user', 'admin', 'chief-admin', 'portfolio-v2'],
    }),
    (error) => error instanceof AdminError && error.code === 'admin_required',
  );
});

test('identity accepts every canonical user and the two portals have isolated CSRF tokens', () => {
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
  assert.equal(identity({ headers: {
    'remote-user': 'member',
    'remote-name': 'Member',
    'remote-email': 'member@example.com',
    'remote-groups': 'user,portfolio-v2,access-feelmyrythm',
  } }).role, 'user');
  for (const groups of [
    'user,admin,chief-admin,portfolio-v2,chief-admin',
    'user,admin,portfolio-v2,unknown',
    'user,,admin,portfolio-v2',
    'user, admin,portfolio-v2',
    'user,admin,portfolio-v2 ',
    'admin,user,portfolio-v2',
  ]) {
    assert.throws(
      () => identity({ headers: {
        'remote-user': 'owner',
        'remote-name': 'Owner',
        'remote-email': 'owner@bonifacio.work',
        'remote-groups': groups,
      } }),
      (error) => error instanceof AdminError && error.code === 'invalid_identity',
    );
  }
  const request = {
    headers: {
      'remote-user': 'owner',
      'remote-name': 'Owner',
      'remote-email': 'owner@bonifacio.work',
      'remote-groups': 'user,admin,chief-admin,portfolio-v2',
      origin: 'https://bonifacio.work',
      cookie: 'bonifacio_admin_csrf=known-token',
      'x-csrf-token': 'known-token',
    },
  };
  assert.equal(identity(request).username, 'owner');
  assert.deepEqual(identity(request).groups, ['user', 'admin', 'chief-admin', 'portfolio-v2']);
  assert.equal(identity(request).role, 'chief-admin');
  assert.equal(identity({ headers: {
    'remote-user': 'owner',
    'remote-name': 'Owner',
    'remote-email': 'owner@bonifacio.work',
    'remote-groups': 'user,developer,admin',
  } }).role, 'chief-admin');
  assert.doesNotThrow(() => requireMutationProtection(request));
  assert.throws(
    () => requireUserMutationProtection(request),
    (error) => error instanceof AdminError && error.code === 'invalid_csrf',
  );
  const userRequest = {
    ...request,
    headers: {
      ...request.headers,
      cookie: 'bonifacio_user_csrf=known-token',
    },
  };
  assert.doesNotThrow(() => requireUserMutationProtection(userRequest));
  assert.throws(
    () => requireMutationProtection(userRequest),
    (error) => error instanceof AdminError && error.code === 'invalid_csrf',
  );
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
  let credentialVerificationCalls = 0;
  let passwordHashCalls = 0;
  await mkdir(current, { mode: 0o700 });
  await writeFile(path, serializeUserDatabase(database()), { mode: 0o600 });
  const server = createServer(createHandler({
    store: new UserStore(path, { minimumWriteIntervalMs: 0 }),
    edgeSecret,
    generateCredential: async () => ({ password: temporaryPassword, digest }),
    verifyCredential: async () => {
      credentialVerificationCalls += 1;
      return true;
    },
    hashCredential: async () => {
      passwordHashCalls += 1;
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
      'Remote-Name': 'Owner',
      'Remote-Email': 'owner@bonifacio.work',
      'Remote-Groups': 'user,admin,chief-admin,portfolio-v2',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    const sessionResponse = await fetch(`${base}/session`, { headers: identityHeaders });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(cookie);
    const editorAccessResponse = await fetch(`${base}/editor-access`, { headers: identityHeaders });
    assert.equal(editorAccessResponse.status, 200);
    assert.deepEqual(await editorAccessResponse.json(), {
      canEditContent: true,
      subject: 'owner',
    });
    const memberEditorAccessResponse = await fetch(`${base}/editor-access`, {
      headers: {
        ...identityHeaders,
        'Remote-User': 'member',
        'Remote-Name': 'Member',
        'Remote-Email': 'member@example.com',
        'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm',
      },
    });
    assert.equal(memberEditorAccessResponse.status, 403);

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
        role: 'user',
        applications: ['feelmyrythm', 'garak'],
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.temporaryPassword, temporaryPassword);
    assert.equal(created.user.role, 'user');
    assert.deepEqual(created.user.applications, ['feelmyrythm', 'garak']);
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
        role: 'admin',
        applications: ['monitor'],
        disabled: false,
      }),
    });
    assert.equal(promoteResponse.status, 200);
    const promoted = await promoteResponse.json();
    assert.equal(promoted.user.role, 'admin');
    assert.deepEqual(promoted.user.applications, ['monitor']);
    assert.match(promoted.revision, /^[a-f0-9]{64}$/);

    const unavailablePasswordResponse = await fetch(`${base}/account/password`, {
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
    assert.equal(unavailablePasswordResponse.status, 404);
    assert.equal(credentialVerificationCalls, 0);
    assert.equal(passwordHashCalls, 0);
    assert.equal((await new UserStore(path).read()).users.owner.password, digest);

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
      body: JSON.stringify({
        displayName: 'Member',
        role: 'user',
        applications: ['feelmyrythm'],
        disabled: 'false',
      }),
    });
    assert.equal(invalidDisabledResponse.status, 400);

    const invalidApplicationsResponse = await fetch(`${base}/users/member`, {
      method: 'PATCH',
      headers: {
        ...identityHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': promoted.revision,
      },
      body: JSON.stringify({
        displayName: 'Member',
        role: 'user',
        applications: ['garak', 'monitor'],
        disabled: false,
      }),
    });
    assert.equal(invalidApplicationsResponse.status, 400);

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
      body: JSON.stringify({
        displayName: 'Stale edit',
        role: 'user',
        applications: ['feelmyrythm'],
        disabled: false,
      }),
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

test('self-service API exposes one exact profile and changes only that account password', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bonifacio-user-api-'));
  const currentDirectory = join(directory, 'current');
  const path = join(currentDirectory, 'users_database.yml');
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  const value = database();
  value.users.delegate = {
    disabled: false,
    displayname: 'Delegate',
    password: digest,
    email: 'delegate@bonifacio.work',
    groups: groupsForAssignment('admin', ['monitor']),
  };
  value.users.disabled = {
    disabled: true,
    displayname: 'Disabled',
    password: digest,
    email: 'disabled@example.com',
    groups: groupsForAssignment('user', []),
  };
  const verified = [];
  const hashed = [];
  await mkdir(currentDirectory, { mode: 0o700 });
  await writeFile(path, serializeUserDatabase(value), { mode: 0o600 });
  const server = createServer(createHandler({
    store: new UserStore(path, { minimumWriteIntervalMs: 0 }),
    edgeSecret,
    verifyCredential: async (password, currentDigest) => {
      verified.push({ password, currentDigest });
      return password === 'current-member-password';
    },
    hashCredential: async (password) => {
      hashed.push(password);
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
    const service = `http://127.0.0.1:${address.port}`;
    const userApi = `${service}/sso/user/api`;
    const memberHeaders = {
      'Remote-User': 'member',
      'Remote-Name': 'Member',
      'Remote-Email': 'member@example.com',
      'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };

    const sessionResponse = await fetch(`${userApi}/session`, { headers: memberHeaders });
    assert.equal(sessionResponse.status, 200);
    const setCookie = sessionResponse.headers.get('set-cookie');
    const cookie = setCookie?.split(';', 1)[0];
    assert.match(setCookie ?? '', /^bonifacio_user_csrf=[A-Za-z0-9_-]+;/);
    assert.match(setCookie ?? '', /Path=\/sso\/user\//);
    assert.equal(setCookie?.includes('bonifacio_admin_csrf'), false);
    assert.ok(cookie);
    const session = await sessionResponse.json();
    assert.deepEqual(Object.keys(session).sort(), [
      'applications',
      'canManageUsers',
      'csrfToken',
      'profile',
      'revision',
    ]);
    assert.deepEqual(session.profile, {
      username: 'member',
      displayName: 'Member',
      email: 'member@example.com',
      role: 'user',
      applications: ['feelmyrythm'],
    });
    assert.equal(session.canManageUsers, false);
    assert.match(session.revision, /^[a-f0-9]{64}$/);
    assert.equal(session.applications.length, APPLICATIONS.length);
    assert.equal(
      session.applications.every((application) => (
        Object.keys(application).sort().join(',') === 'id,label'
      )),
      true,
    );
    const sessionWire = JSON.stringify(session);
    for (const secret of ['owner@bonifacio.work', digest, 'password', 'groups', 'disabled']) {
      assert.equal(sessionWire.includes(secret), false);
    }
    for (const [route, contentType] of [
      ['/sso/user/', 'text/html'],
      ['/sso/user/user.css', 'text/css'],
      ['/sso/user/user.js', 'text/javascript'],
    ]) {
      const staticResponse = await fetch(`${service}${route}`, { headers: memberHeaders });
      assert.equal(staticResponse.status, 200);
      assert.match(staticResponse.headers.get('content-type') ?? '', new RegExp(`^${contentType}`));
    }

    const ordinaryAdminResponse = await fetch(`${service}/sso/admin/api/session`, {
      headers: memberHeaders,
    });
    assert.equal(ordinaryAdminResponse.status, 403);
    const userListResponse = await fetch(`${userApi}/users`, { headers: memberHeaders });
    assert.equal(userListResponse.status, 404);
    const userResetResponse = await fetch(`${userApi}/users/member/reset-password`, {
      method: 'POST',
      headers: memberHeaders,
    });
    assert.equal(userResetResponse.status, 404);

    const passwordBody = {
      currentPassword: 'current-member-password',
      newPassword: 'ChosenMember12!',
      confirmPassword: 'ChosenMember12!',
    };
    const crossCsrfResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: 'bonifacio_admin_csrf=admin-token',
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': 'admin-token',
        'If-Match': session.revision,
      },
      body: JSON.stringify(passwordBody),
    });
    assert.equal(crossCsrfResponse.status, 403);
    assert.equal(verified.length, 0);

    const missingRevisionResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify(passwordBody),
    });
    assert.equal(missingRevisionResponse.status, 428);
    assert.equal(verified.length, 0);

    const staleResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': 'a'.repeat(64),
      },
      body: JSON.stringify(passwordBody),
    });
    assert.equal(staleResponse.status, 409);
    assert.equal(verified.length, 0);

    const weakPasswordResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({
        ...passwordBody,
        newPassword: 'weak-password',
        confirmPassword: 'weak-password',
      }),
    });
    assert.equal(weakPasswordResponse.status, 400);
    assert.equal((await weakPasswordResponse.json()).error, 'invalid_password');
    assert.equal(verified.length, 0);

    const unchangedPassword = 'SamePassword12!';
    const unchangedResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({
        currentPassword: unchangedPassword,
        newPassword: unchangedPassword,
        confirmPassword: unchangedPassword,
      }),
    });
    assert.equal(unchangedResponse.status, 400);
    assert.equal((await unchangedResponse.json()).error, 'password_unchanged');
    assert.equal(verified.length, 0);
    assert.equal(hashed.length, 0);

    const wrongCurrentResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({ ...passwordBody, currentPassword: 'wrong-member-password' }),
    });
    assert.equal(wrongCurrentResponse.status, 400);
    assert.equal(verified.length, 1);
    assert.equal(hashed.length, 0);

    const targetInjectionResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({ ...passwordBody, username: 'owner' }),
    });
    assert.equal(targetInjectionResponse.status, 400);
    assert.equal(verified.length, 1);

    const changeResponse = await fetch(`${userApi}/account/password`, {
      method: 'POST',
      headers: {
        ...memberHeaders,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify(passwordBody),
    });
    assert.equal(changeResponse.status, 200);
    const changed = await changeResponse.json();
    assert.deepEqual(Object.keys(changed).sort(), ['changed', 'logoutUrl', 'revision']);
    assert.equal(changed.changed, true);
    assert.equal(
      changed.logoutUrl,
      '/sso/logout?rd=https%3A%2F%2Fbonifacio.work%2Fsso%2Fuser%2F',
    );
    assert.match(changed.revision, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(changed).includes('ChosenMember12!'), false);
    assert.deepEqual(hashed, ['ChosenMember12!']);
    const stored = await new UserStore(path).read();
    assert.equal(stored.users.member.password, changedDigest);
    assert.equal(stored.users.owner.password, digest);
    assert.equal(stored.users.delegate.password, digest);

    const ownerSessionResponse = await fetch(`${userApi}/session`, {
      headers: {
        ...memberHeaders,
        'Remote-User': 'owner',
        'Remote-Name': 'Owner',
        'Remote-Email': 'owner@bonifacio.work',
        'Remote-Groups': 'user,admin,chief-admin,portfolio-v2',
      },
    });
    assert.equal(ownerSessionResponse.status, 200);
    const ownerSession = await ownerSessionResponse.json();
    assert.equal(ownerSession.profile.role, 'chief-admin');
    assert.equal(ownerSession.canManageUsers, true);

    const delegateHeaders = {
      ...memberHeaders,
      'Remote-User': 'delegate',
      'Remote-Name': 'Delegate',
      'Remote-Email': 'delegate@bonifacio.work',
      'Remote-Groups': 'user,admin,portfolio-v2,access-monitor',
    };
    const delegateUserResponse = await fetch(`${userApi}/session`, { headers: delegateHeaders });
    assert.equal(delegateUserResponse.status, 200);
    assert.equal((await delegateUserResponse.json()).canManageUsers, true);
    const delegateAdminResponse = await fetch(`${service}/sso/admin/api/session`, {
      headers: delegateHeaders,
    });
    assert.equal(delegateAdminResponse.status, 200);
    const adminModelResponse = await fetch(`${service}/sso/admin/ui-model.js`, {
      headers: delegateHeaders,
    });
    assert.equal(adminModelResponse.status, 200);
    assert.match(adminModelResponse.headers.get('content-type') ?? '', /^text\/javascript/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('self-service rejects malformed, forged, missing, and disabled identities', async () => {
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  const value = database();
  value.users.disabled = {
    disabled: true,
    displayname: 'Disabled',
    password: digest,
    email: 'disabled@example.com',
    groups: groupsForAssignment('user', []),
  };
  const store = {
    async read() {
      return value;
    },
    async readVersioned() {
      return { database: value, revision: 'b'.repeat(64) };
    },
  };
  const server = createServer(createHandler({ store, edgeSecret }));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/sso/user/api/session`;
    const valid = {
      'Remote-User': 'member',
      'Remote-Name': 'Member',
      'Remote-Email': 'member@example.com',
      'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    for (const headers of [
      { ...valid, 'Remote-User': 'Member' },
      { ...valid, 'Remote-Email': 'MEMBER@example.com' },
      { ...valid, 'Remote-Groups': 'user, portfolio-v2,access-feelmyrythm' },
      { ...valid, 'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm,' },
    ]) {
      const response = await fetch(url, { headers });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, 'invalid_identity');
    }
    for (const headers of [
      { ...valid, 'Remote-Name': 'Forged' },
      { ...valid, 'Remote-Email': 'forged@example.com' },
      { ...valid, 'Remote-Groups': 'user,portfolio-v2' },
      { ...valid, 'Remote-User': 'missing', 'Remote-Name': 'Missing' },
      {
        ...valid,
        'Remote-User': 'disabled',
        'Remote-Name': 'Disabled',
        'Remote-Email': 'disabled@example.com',
        'Remote-Groups': 'user,portfolio-v2',
      },
    ]) {
      const response = await fetch(url, { headers });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, 'user_required');
    }
    const untrustedResponse = await fetch(url, {
      headers: { ...valid, 'X-Portfolio-Edge-Secret': 'wrong-secret' },
    });
    assert.equal(untrustedResponse.status, 401);
    assert.equal((await untrustedResponse.json()).error, 'untrusted_edge');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('self-service mutation rechecks the exact user under the writer lock', async () => {
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  let verified = 0;
  let hashed = 0;
  const store = {
    async read() {
      return database();
    },
    async readVersioned() {
      return { database: database(), revision: 'c'.repeat(64) };
    },
    async mutate({ transform }) {
      const locked = database();
      locked.users.member.disabled = true;
      await transform(locked);
    },
  };
  const server = createServer(createHandler({
    store,
    edgeSecret,
    verifyCredential: async () => {
      verified += 1;
      return true;
    },
    hashCredential: async () => {
      hashed += 1;
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
    const base = `http://127.0.0.1:${address.port}/sso/user/api`;
    const headers = {
      'Remote-User': 'member',
      'Remote-Name': 'Member',
      'Remote-Email': 'member@example.com',
      'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    const sessionResponse = await fetch(`${base}/session`, { headers });
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    const response = await fetch(`${base}/account/password`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({
        currentPassword: 'current-member-password',
        newPassword: 'ChosenMember12!',
        confirmPassword: 'ChosenMember12!',
      }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'user_required');
    assert.equal(verified, 0);
    assert.equal(hashed, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('self-service limits each account to five crypto attempts per rolling ten minutes', async () => {
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  let now = 1_000;
  let writerCalls = 0;
  let verificationCalls = 0;
  let hashCalls = 0;
  const revision = 'd'.repeat(64);
  const store = {
    async read() {
      return database();
    },
    async readVersioned() {
      return { database: database(), revision };
    },
    async mutate({ transform }) {
      writerCalls += 1;
      await transform(database());
    },
  };
  const server = createServer(createHandler({
    store,
    edgeSecret,
    limiterNow: () => now,
    verifyCredential: async () => {
      verificationCalls += 1;
      return false;
    },
    hashCredential: async () => {
      hashCalls += 1;
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
    const base = `http://127.0.0.1:${address.port}/sso/user/api`;
    const memberHeaders = {
      'Remote-User': 'member',
      'Remote-Name': 'Member',
      'Remote-Email': 'member@example.com',
      'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    const memberSessionResponse = await fetch(`${base}/session`, { headers: memberHeaders });
    const memberSession = await memberSessionResponse.json();
    const memberCookie = memberSessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    const attempt = (headers, session, cookie) => fetch(`${base}/account/password`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({
        currentPassword: 'wrong-current-password',
        newPassword: 'AnotherStrong12!',
        confirmPassword: 'AnotherStrong12!',
      }),
    });

    for (let index = 0; index < 6; index += 1) {
      const staleResponse = await fetch(`${base}/account/password`, {
        method: 'POST',
        headers: {
          ...memberHeaders,
          'Content-Type': 'application/json',
          Cookie: memberCookie,
          Origin: 'https://bonifacio.work',
          'X-CSRF-Token': memberSession.csrfToken,
          'If-Match': 'f'.repeat(64),
        },
        body: JSON.stringify({
          currentPassword: 'wrong-current-password',
          newPassword: 'AnotherStrong12!',
          confirmPassword: 'AnotherStrong12!',
        }),
      });
      assert.equal(staleResponse.status, 409);
    }
    assert.equal(writerCalls, 0);
    assert.equal(verificationCalls, 0);

    for (let index = 0; index < 5; index += 1) {
      const response = await attempt(memberHeaders, memberSession, memberCookie);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'current_password_invalid');
    }
    assert.equal(writerCalls, 5);
    assert.equal(verificationCalls, 5);
    assert.equal(hashCalls, 0);

    const limitedResponse = await attempt(memberHeaders, memberSession, memberCookie);
    assert.equal(limitedResponse.status, 429);
    assert.equal((await limitedResponse.json()).error, 'password_attempt_rate_limited');
    assert.equal(writerCalls, 5);
    assert.equal(verificationCalls, 5);
    assert.equal(hashCalls, 0);

    const ownerHeaders = {
      ...memberHeaders,
      'Remote-User': 'owner',
      'Remote-Name': 'Owner',
      'Remote-Email': 'owner@bonifacio.work',
      'Remote-Groups': 'user,admin,chief-admin,portfolio-v2',
    };
    const ownerSessionResponse = await fetch(`${base}/session`, { headers: ownerHeaders });
    const ownerSession = await ownerSessionResponse.json();
    const ownerCookie = ownerSessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    const ownerResponse = await attempt(ownerHeaders, ownerSession, ownerCookie);
    assert.equal(ownerResponse.status, 400);
    assert.equal(writerCalls, 6);
    assert.equal(verificationCalls, 6);

    now += 10 * 60 * 1000 + 1;
    const expiredResponse = await attempt(memberHeaders, memberSession, memberCookie);
    assert.equal(expiredResponse.status, 400);
    assert.equal(writerCalls, 7);
    assert.equal(verificationCalls, 7);
    assert.equal(hashCalls, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('self-service reserves three successful changes per rolling day without charging failures', async () => {
  const edgeSecret = 'test-edge-secret-with-at-least-32-bytes';
  let now = 10_000;
  let writerCalls = 0;
  let verificationCalls = 0;
  let hashCalls = 0;
  const revision = 'e'.repeat(64);
  const store = {
    async read() {
      return database();
    },
    async readVersioned() {
      return { database: database(), revision };
    },
    async mutate({ transform }) {
      writerCalls += 1;
      await transform(database());
    },
  };
  const server = createServer(createHandler({
    store,
    edgeSecret,
    limiterNow: () => now,
    verifyCredential: async (password) => {
      verificationCalls += 1;
      return password === 'accepted-current-password';
    },
    hashCredential: async () => {
      hashCalls += 1;
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
    const base = `http://127.0.0.1:${address.port}/sso/user/api`;
    const headers = {
      'Remote-User': 'member',
      'Remote-Name': 'Member',
      'Remote-Email': 'member@example.com',
      'Remote-Groups': 'user,portfolio-v2,access-feelmyrythm',
      'X-Portfolio-Edge-Secret': edgeSecret,
    };
    const sessionResponse = await fetch(`${base}/session`, { headers });
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie')?.split(';', 1)[0];
    const change = (currentPassword) => fetch(`${base}/account/password`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'https://bonifacio.work',
        'X-CSRF-Token': session.csrfToken,
        'If-Match': session.revision,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword: 'DailyStrongPass1!',
        confirmPassword: 'DailyStrongPass1!',
      }),
    });

    const failedResponse = await change('wrong-current-password');
    assert.equal(failedResponse.status, 400);
    assert.equal((await failedResponse.json()).error, 'current_password_invalid');
    for (let index = 0; index < 3; index += 1) {
      const response = await change('accepted-current-password');
      assert.equal(response.status, 200);
    }
    assert.equal(writerCalls, 4);
    assert.equal(verificationCalls, 4);
    assert.equal(hashCalls, 3);

    const limitedResponse = await change('accepted-current-password');
    assert.equal(limitedResponse.status, 429);
    assert.equal((await limitedResponse.json()).error, 'password_change_rate_limited');
    assert.equal(writerCalls, 4);
    assert.equal(verificationCalls, 4);
    assert.equal(hashCalls, 3);

    now += 24 * 60 * 60 * 1000 + 1;
    const expiredResponse = await change('accepted-current-password');
    assert.equal(expiredResponse.status, 200);
    assert.equal(writerCalls, 5);
    assert.equal(verificationCalls, 5);
    assert.equal(hashCalls, 4);
  } finally {
    await new Promise((resolve) => server.close(resolve));
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
      locked.users.owner.groups = ['user', 'portfolio-v2'];
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
      'Remote-Name': 'Owner',
      'Remote-Email': 'owner@bonifacio.work',
      'Remote-Groups': 'user,admin,chief-admin,portfolio-v2',
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
        role: 'user',
        applications: [],
      }),
    });
    assert.equal(response.status, 403);
    assert.equal(generated, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
