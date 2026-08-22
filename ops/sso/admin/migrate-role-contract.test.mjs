import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { UserStore } from './lib.mjs';
import { RoleMigrationError, migrateRoleContract } from './migrate-role-contract.mjs';

const digest = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$ZGlnZXN0';

function legacySource({ email = 'cks@bonifacio.work', groups = ['owners', 'users'], extra = '' } = {}) {
  const groupLines = groups.map((group) => `      - ${group}\n`).join('');
  return `---
users:
  cks:
    disabled: false
    displayname: cks
    password: "${digest}"
    email: ${email}
    groups:
${groupLines}${extra}`;
}

function revision(source) {
  return createHash('sha256').update(source).digest('hex');
}

async function fixture(source = legacySource()) {
  const state = await mkdtemp(join(tmpdir(), 'bonifacio-role-migration-'));
  const current = join(state, 'current');
  const path = join(current, 'users_database.yml');
  await mkdir(current, { mode: 0o700 });
  await writeFile(path, source, { mode: 0o600 });
  return { state, current, path, source };
}

test('role migration defaults to a write-free dry run', async () => {
  const value = await fixture();
  try {
    const result = await migrateRoleContract({
      path: value.path,
      expectedRevision: revision(value.source),
    });
    assert.equal(result.applied, false);
    assert.equal(result.beforeRevision, revision(value.source));
    assert.notEqual(result.afterRevision, result.beforeRevision);
    assert.equal(await readFile(value.path, 'utf8'), value.source);
    assert.deepEqual(await readdir(value.state), ['current']);
  } finally {
    await rm(value.state, { recursive: true, force: true });
  }
});

test('role migration preserves the opaque credential and commits atomically with audit', async () => {
  const value = await fixture();
  try {
    const result = await migrateRoleContract({
      path: value.path,
      expectedRevision: revision(value.source),
      apply: true,
    });
    assert.equal(result.applied, true);
    assert.equal((await stat(value.path)).mode & 0o777, 0o600);
    const migrated = await new UserStore(value.path).read();
    assert.deepEqual(migrated.users.cks.groups, ['user', 'developer', 'admin']);
    assert.equal(migrated.users.cks.password, digest);
    assert.equal(migrated.users.cks.email, 'cks@bonifacio.work');

    const backups = await readdir(join(value.state, 'backups'));
    assert.equal(backups.length, 1);
    const backupPath = join(value.state, 'backups', backups[0]);
    assert.equal(await readFile(backupPath, 'utf8'), value.source);
    assert.equal((await stat(backupPath)).mode & 0o777, 0o600);

    const audit = await readFile(join(value.state, 'audit.jsonl'), 'utf8');
    assert.match(audit, /"action":"migrate_role_contract_v1"/);
    assert.match(audit, /"phase":"prepared"/);
    assert.match(audit, /"phase":"committed"/);
    assert.equal(audit.includes(digest), false);
    assert.equal(audit.toLowerCase().includes('password'), false);
    assert.equal(await readFile(value.path, 'utf8').then(revision), result.afterRevision);
  } finally {
    await rm(value.state, { recursive: true, force: true });
  }
});

test('role migration rejects stale revisions and any identity or legacy-role drift', async () => {
  for (const [source, expectedCode] of [
    [legacySource({ email: 'other@bonifacio.work' }), 'unexpected_legacy_record'],
    [legacySource({ groups: ['users'] }), 'unexpected_legacy_record'],
    [
      `${legacySource()}  another:
    disabled: false
    displayname: Another
    password: "${digest}"
    email: another@bonifacio.work
    groups:
      - owners
      - users
`,
      'unexpected_identity_set',
    ],
  ]) {
    const value = await fixture(source);
    try {
      await assert.rejects(
        migrateRoleContract({
          path: value.path,
          expectedRevision: revision(source),
          apply: true,
        }),
        (error) => error instanceof RoleMigrationError && error.code === expectedCode,
      );
      assert.equal(await readFile(value.path, 'utf8'), source);
      assert.deepEqual(await readdir(value.state), ['current']);
    } finally {
      await rm(value.state, { recursive: true, force: true });
    }
  }

  const stale = await fixture();
  try {
    await assert.rejects(
      migrateRoleContract({
        path: stale.path,
        expectedRevision: '0'.repeat(64),
        apply: true,
      }),
      (error) => error instanceof RoleMigrationError && error.code === 'stale_revision',
    );
    assert.equal(await readFile(stale.path, 'utf8'), stale.source);
    assert.deepEqual(await readdir(stale.state), ['current']);
  } finally {
    await rm(stale.state, { recursive: true, force: true });
  }
});

test('role migration dry-run and apply require exact mode 0600 before creating a lock', async () => {
  const value = await fixture();
  try {
    await chmod(value.path, 0o400);
    for (const apply of [false, true]) {
      await assert.rejects(
        migrateRoleContract({
          path: value.path,
          expectedRevision: revision(value.source),
          apply,
        }),
        (error) => error instanceof RoleMigrationError && error.code === 'unsafe_database_mode',
      );
    }
    assert.equal(await readFile(value.path, 'utf8'), value.source);
    assert.deepEqual(await readdir(value.state), ['current']);
    assert.deepEqual(await readdir(value.current), ['users_database.yml']);
  } finally {
    await rm(value.state, { recursive: true, force: true });
  }
});

test('role migration refuses a database outside the dedicated current directory', async () => {
  const state = await mkdtemp(join(tmpdir(), 'bonifacio-role-migration-path-'));
  const path = join(state, 'users_database.yml');
  const source = legacySource();
  try {
    await writeFile(path, source, { mode: 0o600 });
    await assert.rejects(
      migrateRoleContract({
        path,
        expectedRevision: revision(source),
        apply: true,
      }),
      (error) => error instanceof RoleMigrationError && error.code === 'invalid_database_path',
    );
    assert.equal(await readFile(path, 'utf8'), source);
    assert.deepEqual(await readdir(state), ['users_database.yml']);
  } finally {
    await rm(state, { recursive: true, force: true });
  }
});
