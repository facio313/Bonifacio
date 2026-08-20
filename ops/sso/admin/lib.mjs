import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants as fileConstants } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import YAML from 'yaml';

const USERNAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const GROUP = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ARGON2ID = /^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;
const ALLOWED_GROUPS = new Set(['owners', 'users']);

export class AdminError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AdminError';
    this.status = status;
    this.code = code;
  }
}

function plainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanText(value, field, maxLength = 120) {
  if (typeof value !== 'string') {
    throw new AdminError(400, 'invalid_input', `${field} 형식이 올바르지 않습니다.`);
  }
  const clean = value.trim();
  if (!clean || clean.length > maxLength || /[\u0000-\u001f\u007f]/.test(clean)) {
    throw new AdminError(400, 'invalid_input', `${field} 형식이 올바르지 않습니다.`);
  }
  return clean;
}

export function normalizeUsername(value) {
  const username = cleanText(value, '아이디', 64).toLowerCase();
  if (!USERNAME.test(username)) {
    throw new AdminError(
      400,
      'invalid_username',
      '아이디는 영문 소문자 또는 숫자로 시작하고 영문 소문자, 숫자, _ 및 -만 사용할 수 있습니다.',
    );
  }
  return username;
}

export function normalizeEmail(value) {
  const email = cleanText(value, '이메일', 254).toLowerCase();
  if (
    email.includes(' ') ||
    email.split('@').length !== 2 ||
    !/^[^@]+@[^@]+\.[^@]+$/.test(email)
  ) {
    throw new AdminError(400, 'invalid_email', '유효한 이메일 주소를 입력하세요.');
  }
  return email;
}

export function normalizeDisplayName(value) {
  return cleanText(value, '표시 이름');
}

function normalizeGroups(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AdminError(400, 'invalid_groups', '사용자 그룹이 하나 이상 필요합니다.');
  }
  const groups = [...new Set(value.map((item) => cleanText(item, '그룹', 64).toLowerCase()))];
  if (groups.some((group) => !GROUP.test(group) || !ALLOWED_GROUPS.has(group))) {
    throw new AdminError(400, 'invalid_groups', '허용되지 않은 사용자 그룹입니다.');
  }
  return groups.sort();
}

function normalizeRecord(username, value) {
  if (!plainObject(value)) {
    throw new AdminError(500, 'invalid_database', `${username} 사용자 레코드가 올바르지 않습니다.`);
  }
  const allowedFields = new Set(['disabled', 'displayname', 'password', 'email', 'groups']);
  if (Object.keys(value).some((field) => !allowedFields.has(field)) || typeof value.disabled !== 'boolean') {
    throw new AdminError(500, 'invalid_database', `${username} 사용자 필드가 올바르지 않습니다.`);
  }
  if (typeof value.password !== 'string' || !ARGON2ID.test(value.password)) {
    throw new AdminError(500, 'invalid_database', `${username} 사용자의 비밀번호 해시가 올바르지 않습니다.`);
  }
  return {
    disabled: value.disabled,
    displayname: normalizeDisplayName(value.displayname),
    password: value.password,
    email: normalizeEmail(value.email),
    groups: normalizeGroups(value.groups ?? ['users']),
  };
}

export function parseUserDatabase(source) {
  let document;
  try {
    document = YAML.parseDocument(source, { maxAliasCount: 0, uniqueKeys: true });
  } catch {
    throw new AdminError(500, 'invalid_database', '사용자 데이터베이스를 읽을 수 없습니다.');
  }
  if (document.errors.length > 0) {
    throw new AdminError(500, 'invalid_database', '사용자 데이터베이스 문법이 올바르지 않습니다.');
  }
  const root = document.toJS({ maxAliasCount: 0 });
  if (
    !plainObject(root) ||
    !plainObject(root.users) ||
    Object.keys(root).length !== 1 ||
    !Object.hasOwn(root, 'users')
  ) {
    throw new AdminError(500, 'invalid_database', '사용자 데이터베이스 구조가 올바르지 않습니다.');
  }
  const users = {};
  const emails = new Set();
  for (const [rawUsername, record] of Object.entries(root.users)) {
    const username = normalizeUsername(rawUsername);
    if (username !== rawUsername) {
      throw new AdminError(500, 'invalid_database', '정규화되지 않은 사용자 아이디가 있습니다.');
    }
    users[username] = normalizeRecord(username, record);
    if (emails.has(users[username].email)) {
      throw new AdminError(500, 'invalid_database', '중복된 사용자 이메일이 있습니다.');
    }
    emails.add(users[username].email);
  }
  if (Object.keys(users).length === 0) {
    throw new AdminError(500, 'invalid_database', '사용자 데이터베이스가 비어 있습니다.');
  }
  return { users };
}

export function serializeUserDatabase(database) {
  const users = {};
  for (const username of Object.keys(database.users).sort()) {
    users[username] = normalizeRecord(username, database.users[username]);
  }
  const source = `---\n${YAML.stringify({ users }, { indent: 2, lineWidth: 0 })}`;
  parseUserDatabase(source);
  return source;
}

export function publicUsers(database) {
  return Object.entries(database.users)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([username, record]) => ({
      username,
      displayName: record.displayname,
      email: record.email,
      groups: [...record.groups],
      disabled: record.disabled,
    }));
}

export function assertOwnerMutationAllowed(database, actor, target, nextRecord) {
  const current = database.users[target];
  if (!current) throw new AdminError(404, 'user_not_found', '사용자를 찾을 수 없습니다.');
  const wasOwner = current.groups.includes('owners') && !current.disabled;
  const remainsOwner = nextRecord.groups.includes('owners') && !nextRecord.disabled;
  if (actor === target && !remainsOwner) {
    throw new AdminError(409, 'self_lockout', '현재 로그인한 관리자 권한은 제거할 수 없습니다.');
  }
  if (wasOwner && !remainsOwner) {
    const otherEnabledOwners = Object.entries(database.users).filter(
      ([username, record]) =>
        username !== target && !record.disabled && record.groups.includes('owners'),
    );
    if (otherEnabledOwners.length === 0) {
      throw new AdminError(409, 'last_owner', '마지막 활성 관리자는 비활성화할 수 없습니다.');
    }
  }
}

export function assertAuthorizedOwner(database, actor) {
  const record = database.users[actor.username];
  if (
    !record ||
    record.disabled ||
    !record.groups.includes('owners') ||
    record.email !== actor.email.trim().toLowerCase()
  ) {
    throw new AdminError(403, 'owner_required', '사용자 관리 권한이 없습니다.');
  }
}

function hashSource(source) {
  return createHash('sha256').update(source).digest('hex');
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class UserStore {
  constructor(
    path,
    { backupLimit = 50, lockWaitMs = 3000, staleLockMs = 300000, minimumWriteIntervalMs = 1100 } = {},
  ) {
    this.path = path;
    this.directory = dirname(path);
    this.stateDirectory = basename(this.directory) === 'current' ? dirname(this.directory) : this.directory;
    this.backupDirectory = join(this.stateDirectory, 'backups');
    this.auditPath = join(this.stateDirectory, 'audit.jsonl');
    this.lockPath = join(this.stateDirectory, '.admin.lock');
    this.backupLimit = backupLimit;
    this.lockWaitMs = lockWaitMs;
    this.staleLockMs = staleLockMs;
    this.minimumWriteIntervalMs = minimumWriteIntervalMs;
    this.lastWriteAt = 0;
  }

  async readSource() {
    const directoryMetadata = await lstat(this.directory);
    const stateDirectoryMetadata = await lstat(this.stateDirectory);
    const fileMetadata = await lstat(this.path);
    if (
      !directoryMetadata.isDirectory() ||
      directoryMetadata.isSymbolicLink() ||
      !stateDirectoryMetadata.isDirectory() ||
      stateDirectoryMetadata.isSymbolicLink() ||
      (directoryMetadata.mode & 0o077) !== 0 ||
      (stateDirectoryMetadata.mode & 0o077) !== 0
    ) {
      throw new AdminError(500, 'unsafe_database', '사용자 데이터 디렉터리가 안전하지 않습니다.');
    }
    if (
      !fileMetadata.isFile() ||
      fileMetadata.isSymbolicLink() ||
      fileMetadata.size > 1024 * 1024 ||
      (fileMetadata.mode & 0o077) !== 0
    ) {
      throw new AdminError(500, 'unsafe_database', '사용자 데이터 파일이 안전하지 않습니다.');
    }
    return readFile(this.path, 'utf8');
  }

  async read() {
    return parseUserDatabase(await this.readSource());
  }

  async readVersioned() {
    const source = await this.readSource();
    return { database: parseUserDatabase(source), revision: hashSource(source) };
  }

  async acquireLock() {
    const deadline = Date.now() + this.lockWaitMs;
    while (true) {
      try {
        const handle = await open(this.lockPath, 'wx', 0o600);
        const token = randomBytes(24).toString('hex');
        await handle.writeFile(`${token} ${process.pid} ${new Date().toISOString()}\n`);
        await handle.sync();
        return { handle, token };
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        try {
          const metadata = await stat(this.lockPath);
          if (Date.now() - metadata.mtimeMs > this.staleLockMs) {
            await unlink(this.lockPath);
            continue;
          }
        } catch (metadataError) {
          if (metadataError?.code === 'ENOENT') continue;
          throw metadataError;
        }
        if (Date.now() >= deadline) {
          throw new AdminError(409, 'database_busy', '다른 사용자 관리 작업이 진행 중입니다.');
        }
        await delay(75);
      }
    }
  }

  async releaseLock(lock) {
    await lock.handle.close().catch(() => undefined);
    try {
      const current = await readFile(this.lockPath, 'utf8');
      if (current.startsWith(`${lock.token} `)) await unlink(this.lockPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') console.error('SSO admin lock-release warning');
    }
  }

  async pruneBackups() {
    const entries = (await readdir(this.backupDirectory))
      .filter((name) => name.endsWith('.yml'))
      .sort()
      .reverse();
    await Promise.all(entries.slice(this.backupLimit).map((name) => unlink(join(this.backupDirectory, name))));
  }

  async appendAudit(event) {
    const audit = await open(this.auditPath, 'a', 0o600);
    try {
      await audit.writeFile(`${JSON.stringify(event)}\n`, 'utf8');
      await audit.sync();
    } finally {
      await audit.close();
    }
    await chmod(this.auditPath, 0o600);
  }

  async mutate({ actor, action, target, expectedRevision, transform }) {
    const lock = await this.acquireLock();
    let temporaryPath;
    try {
      const remainingCooldown = this.lastWriteAt + this.minimumWriteIntervalMs - Date.now();
      if (remainingCooldown > 0) await delay(remainingCooldown);
      const beforeSource = await this.readSource();
      const beforeHash = hashSource(beforeSource);
      if (expectedRevision !== undefined && expectedRevision !== beforeHash) {
        throw new AdminError(409, 'stale_revision', '사용자 목록이 변경되었습니다. 새로고침 후 다시 시도하세요.');
      }
      const database = parseUserDatabase(beforeSource);
      const result = await transform(database);
      const candidate = serializeUserDatabase(database);
      if (Buffer.byteLength(candidate, 'utf8') > 1024 * 1024) {
        throw new AdminError(413, 'database_too_large', '사용자 데이터베이스가 너무 큽니다.');
      }

      const currentSource = await this.readSource();
      if (!timingSafeEqual(Buffer.from(beforeHash), Buffer.from(hashSource(currentSource)))) {
        throw new AdminError(409, 'database_changed', '사용자 정보가 동시에 변경되었습니다. 다시 시도하세요.');
      }

      try {
        const auditMetadata = await lstat(this.auditPath);
        if (
          !auditMetadata.isFile() ||
          auditMetadata.isSymbolicLink() ||
          auditMetadata.size > 16 * 1024 * 1024 ||
          (auditMetadata.mode & 0o077) !== 0
        ) {
          throw new AdminError(500, 'unsafe_audit', '사용자 감사 로그가 안전하지 않습니다.');
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }

      await mkdir(this.backupDirectory, { recursive: true, mode: 0o700 });
      const backupDirectoryMetadata = await lstat(this.backupDirectory);
      if (
        !backupDirectoryMetadata.isDirectory() ||
        backupDirectoryMetadata.isSymbolicLink() ||
        (backupDirectoryMetadata.mode & 0o077) !== 0
      ) {
        throw new AdminError(500, 'unsafe_backup', '사용자 백업 디렉터리가 안전하지 않습니다.');
      }
      await chmod(this.backupDirectory, 0o700);
      const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 17);
      const backupPath = join(this.backupDirectory, `${stamp}-${beforeHash.slice(0, 12)}.yml`);
      await copyFile(this.path, backupPath, fileConstants.COPYFILE_EXCL);
      await chmod(backupPath, 0o600);
      const backup = await open(backupPath, 'r');
      try {
        await backup.sync();
      } finally {
        await backup.close();
      }

      temporaryPath = join(this.directory, `.users_database.${process.pid}.${randomBytes(8).toString('hex')}.tmp`);
      const temporary = await open(temporaryPath, 'wx', 0o600);
      try {
        await temporary.writeFile(candidate, 'utf8');
        await temporary.sync();
      } finally {
        await temporary.close();
      }
      const auditBase = { id: randomBytes(16).toString('hex'), at: new Date().toISOString(), actor, action, target };
      await this.appendAudit({ ...auditBase, phase: 'prepared' });

      await rename(temporaryPath, this.path);
      temporaryPath = undefined;
      this.lastWriteAt = Date.now();
      try {
        const directory = await open(this.directory, 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
        await this.appendAudit({ ...auditBase, at: new Date().toISOString(), phase: 'committed' });
      } catch {
        // The atomic rename is the commit point. Never report failure after a
        // credential has changed and thereby lose its one-time plaintext.
        console.error('SSO admin post-commit durability warning');
      }
      await this.pruneBackups().catch(() => console.error('SSO admin backup-prune warning'));
      return result;
    } finally {
      if (temporaryPath) await unlink(temporaryPath).catch(() => undefined);
      await this.releaseLock(lock);
    }
  }
}

export function generateTemporaryCredential(
  binary = process.env.AUTHELIA_BINARY ?? '/usr/local/bin/authelia',
) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      [
        'crypto',
        'hash',
        'generate',
        'argon2',
        '--random',
        '--random.length',
        '24',
        '--random.charset',
        'rfc3986',
        '--variant',
        'argon2id',
        '--iterations',
        '3',
        '--memory',
        '65536',
        '--parallelism',
        '4',
        '--key-size',
        '32',
        '--salt-size',
        '16',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk).slice(-8192);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-8192);
    });
    child.on('error', () => reject(new AdminError(500, 'hash_failed', '임시 비밀번호를 만들 수 없습니다.')));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new AdminError(500, 'hash_failed', '임시 비밀번호를 만들 수 없습니다.'));
        return;
      }
      const password = stdout.match(/^Random Password:\s*(\S+)\s*$/m)?.[1];
      const digest = stdout.match(/^Digest:\s*(\S+)\s*$/m)?.[1];
      if (!password || !digest || !ARGON2ID.test(digest) || stderr.trim()) {
        reject(new AdminError(500, 'hash_failed', '임시 비밀번호 결과를 검증할 수 없습니다.'));
        return;
      }
      resolve({ password, digest });
    });
  });
}

export function groupsForOwner(owner) {
  return owner ? ['owners', 'users'] : ['users'];
}
