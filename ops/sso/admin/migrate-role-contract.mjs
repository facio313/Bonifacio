#!/usr/bin/env node

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants as fileConstants } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  rename,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import YAML from 'yaml';

import { UserStore, parseUserDatabase, serializeUserDatabase } from './lib.mjs';

const TARGET_USERNAME = 'cks';
const TARGET_EMAIL = 'cks@bonifacio.work';
const LEGACY_GROUPS = Object.freeze(['owners', 'users']);
const CANONICAL_ROLES = Object.freeze(['user', 'developer', 'admin']);
const EXPECTED_FIELDS = Object.freeze(['disabled', 'displayname', 'email', 'groups', 'password']);

export class RoleMigrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoleMigrationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new RoleMigrationError(code, message);
}

function hashSource(source) {
  return createHash('sha256').update(source).digest('hex');
}

function plainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseLegacyCandidate(source) {
  let document;
  try {
    document = YAML.parseDocument(source, { maxAliasCount: 0, uniqueKeys: true });
  } catch {
    fail('invalid_legacy_database', 'Legacy user database YAML is unreadable.');
  }
  if (document.errors.length > 0) {
    fail('invalid_legacy_database', 'Legacy user database YAML is invalid.');
  }
  const root = document.toJS({ maxAliasCount: 0 });
  if (
    !plainObject(root)
    || !plainObject(root.users)
    || Object.keys(root).length !== 1
    || !Object.hasOwn(root, 'users')
    || Object.keys(root.users).length !== 1
    || !Object.hasOwn(root.users, TARGET_USERNAME)
  ) {
    fail('unexpected_identity_set', 'Expected exactly one cks identity.');
  }
  const record = root.users[TARGET_USERNAME];
  if (
    !plainObject(record)
    || JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(EXPECTED_FIELDS)
    || record.disabled !== false
    || record.email !== TARGET_EMAIL
    || !Array.isArray(record.groups)
    || JSON.stringify(record.groups) !== JSON.stringify(LEGACY_GROUPS)
  ) {
    fail('unexpected_legacy_record', 'The cks legacy identity does not match the migration contract.');
  }

  const preserved = {
    disabled: record.disabled,
    displayname: record.displayname,
    password: record.password,
    email: record.email,
  };
  const migrated = {
    users: {
      [TARGET_USERNAME]: {
        ...preserved,
        groups: [...CANONICAL_ROLES],
      },
    },
  };
  const candidateSource = serializeUserDatabase(migrated);
  const validated = parseUserDatabase(candidateSource).users[TARGET_USERNAME];
  for (const field of ['disabled', 'displayname', 'password', 'email']) {
    if (validated[field] !== preserved[field]) {
      fail('record_changed', 'A non-role identity field would change during migration.');
    }
  }
  return candidateSource;
}

async function fsyncFile(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function validateExpectedSource(store, expectedRevision) {
  if (!/^[a-f0-9]{64}$/.test(expectedRevision)) {
    fail('invalid_expected_revision', 'Expected SHA-256 must be 64 lowercase hexadecimal characters.');
  }
  const source = await store.readSource();
  const metadata = await lstat(store.path);
  if ((metadata.mode & 0o777) !== 0o600) {
    fail('unsafe_database_mode', 'Live user database mode must be exactly 0600.');
  }
  const actualRevision = hashSource(source);
  if (!safeEqual(actualRevision, expectedRevision)) {
    fail('stale_revision', 'The live user database does not match the expected SHA-256.');
  }
  return { source, actualRevision, candidateSource: parseLegacyCandidate(source) };
}

export async function migrateRoleContract({ path, expectedRevision, apply = false }) {
  if (
    typeof path !== 'string'
    || !isAbsolute(path)
    || basename(path) !== 'users_database.yml'
    || basename(dirname(path)) !== 'current'
  ) {
    fail(
      'invalid_database_path',
      'Database path must be an absolute current/users_database.yml path.',
    );
  }
  const store = new UserStore(path, { minimumWriteIntervalMs: 0 });
  if (!apply) {
    const checked = await validateExpectedSource(store, expectedRevision);
    return {
      applied: false,
      beforeRevision: checked.actualRevision,
      afterRevision: hashSource(checked.candidateSource),
    };
  }

  // Keep invalid paths and records write-free. The same checks are repeated
  // after acquiring the shared administrator lock to close the race window.
  await validateExpectedSource(store, expectedRevision);
  const lock = await store.acquireLock();
  let temporaryPath;
  try {
    const checked = await validateExpectedSource(store, expectedRevision);
    const beforeMetadata = await lstat(path);
    if ((beforeMetadata.mode & 0o777) !== 0o600) {
      fail('unsafe_database_mode', 'Live user database mode must be exactly 0600.');
    }
    const candidateSource = checked.candidateSource;
    if (Buffer.byteLength(candidateSource, 'utf8') > 1024 * 1024) {
      fail('database_too_large', 'Migrated user database is too large.');
    }

    try {
      const auditMetadata = await lstat(store.auditPath);
      if (
        !auditMetadata.isFile()
        || auditMetadata.isSymbolicLink()
        || auditMetadata.size > 16 * 1024 * 1024
        || (auditMetadata.mode & 0o077) !== 0
      ) {
        fail('unsafe_audit', 'User database audit log is unsafe.');
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }

    const stateDirectory = dirname(dirname(path));
    const currentDirectory = dirname(path);
    const backupDirectory = join(stateDirectory, 'backups');
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    const backupMetadata = await lstat(backupDirectory);
    if (
      !backupMetadata.isDirectory()
      || backupMetadata.isSymbolicLink()
      || (backupMetadata.mode & 0o077) !== 0
    ) {
      fail('unsafe_backup_directory', 'Backup directory is unsafe.');
    }
    await chmod(backupDirectory, 0o700);

    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 17);
    const backupPath = join(
      backupDirectory,
      `${stamp}-${checked.actualRevision.slice(0, 12)}.yml`,
    );
    await copyFile(path, backupPath, fileConstants.COPYFILE_EXCL);
    await chmod(backupPath, 0o600);
    await fsyncFile(backupPath);
    await fsyncDirectory(backupDirectory);
    await fsyncDirectory(stateDirectory);

    temporaryPath = join(
      currentDirectory,
      `.users_database.role-migration.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
    );
    const temporary = await open(temporaryPath, 'wx', 0o600);
    try {
      await temporary.writeFile(candidateSource, 'utf8');
      await temporary.chmod(0o600);
      await temporary.sync();
    } finally {
      await temporary.close();
    }

    const currentSource = await store.readSource();
    if (!safeEqual(hashSource(currentSource), checked.actualRevision)) {
      fail('database_changed', 'The live user database changed during migration.');
    }
    const auditBase = {
      id: randomBytes(16).toString('hex'),
      at: new Date().toISOString(),
      actor: 'operator',
      action: 'migrate_role_contract_v1',
      target: TARGET_USERNAME,
    };
    await store.appendAudit({ ...auditBase, phase: 'prepared' });
    await fsyncFile(store.auditPath);
    await fsyncDirectory(stateDirectory);
    await rename(temporaryPath, path);
    temporaryPath = undefined;

    try {
      await fsyncDirectory(currentDirectory);
      await store.appendAudit({
        ...auditBase,
        at: new Date().toISOString(),
        phase: 'committed',
      });
      await fsyncFile(store.auditPath);
      await fsyncDirectory(stateDirectory);
    } catch {
      console.error('SSO role migration post-commit durability warning');
    }
    await store.pruneBackups().catch(() => console.error('SSO role migration backup-prune warning'));
    return {
      applied: true,
      beforeRevision: checked.actualRevision,
      afterRevision: hashSource(candidateSource),
    };
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => undefined);
    await store.releaseLock(lock);
  }
}

function parseArguments(argv) {
  let path;
  let expectedRevision;
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--database') {
      path = argv[index + 1];
      index += 1;
    } else if (argument === '--expected-sha256') {
      expectedRevision = argv[index + 1];
      index += 1;
    } else if (argument === '--apply') {
      apply = true;
    } else {
      fail('invalid_arguments', 'Expected --database, --expected-sha256, and optional --apply.');
    }
  }
  if (!path || !expectedRevision) {
    fail('invalid_arguments', '--database and --expected-sha256 are required.');
  }
  return { path, expectedRevision, apply };
}

async function main() {
  const result = await migrateRoleContract(parseArguments(process.argv.slice(2)));
  const mode = result.applied ? 'committed' : 'dry-run valid';
  console.log(
    `Central role migration ${mode}: ${result.beforeRevision} -> ${result.afterRevision}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = error instanceof RoleMigrationError ? error.code : 'migration_failed';
    console.error(`Central role migration failed (${code}).`);
    process.exitCode = 1;
  });
}
