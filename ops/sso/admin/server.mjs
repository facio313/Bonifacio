import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  closeSync,
  constants as fileConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  ADMIN_ROLE,
  APPLICATIONS,
  CHIEF_ADMIN_ROLE,
  ROLE_NAMES,
  AdminError,
  UserStore,
  assertAdminMayCreate,
  assertAdminMayResetPassword,
  assertAdminMutationAllowed,
  assertAuthorizedAdmin,
  assignmentFromWireGroups,
  generateTemporaryCredential,
  groupsForAssignment,
  hashPassword,
  normalizeDisplayName,
  normalizeEmail,
  normalizePassword,
  normalizeApplications,
  normalizeRole,
  normalizeUsername,
  publicUsers,
  verifyPassword,
} from './lib.mjs';

const BASE = '/sso/admin';
const directory = dirname(fileURLToPath(import.meta.url));
const staticDirectory = join(directory, 'public');
const origin = process.env.ADMIN_ORIGIN ?? 'https://bonifacio.work';
const port = Number.parseInt(process.env.ADMIN_PORT ?? '9092', 10);
const defaultStore = new UserStore(
  process.env.USERS_DATABASE_PATH ?? '/data/users/users_database.yml',
);
let cachedEdgeSecret;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function responseHeaders(type = 'application/json; charset=utf-8') {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Content-Type': type,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { ...responseHeaders(), ...extraHeaders });
  response.end(JSON.stringify(body));
}

function header(request, name) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value ?? '';
}

export function identity(request) {
  const invalidIdentity = () => new AdminError(
    401,
    'invalid_identity',
    '중앙 로그인 정보를 확인할 수 없습니다.',
  );
  const rawUsername = header(request, 'remote-user').trim();
  if (!rawUsername) {
    throw new AdminError(401, 'authentication_required', '중앙 로그인이 필요합니다.');
  }
  let username;
  let email;
  let groups;
  try {
    username = normalizeUsername(rawUsername);
    email = normalizeEmail(header(request, 'remote-email'));
    const rawGroups = header(request, 'remote-groups');
    groups = assignmentFromWireGroups(rawGroups.split(','), {
      status: 401,
      code: 'invalid_identity',
      message: '중앙 로그인 역할과 앱 권한을 확인할 수 없습니다.',
    });
    if (rawGroups !== groups.wireGroups.join(',')) throw invalidIdentity();
  } catch (error) {
    if (error instanceof AdminError && error.code === 'invalid_identity') throw error;
    throw invalidIdentity();
  }
  if (username !== rawUsername || email !== header(request, 'remote-email')) {
    throw invalidIdentity();
  }
  const displayName = header(request, 'remote-name').trim();
  if (displayName.length > 120 || /[\u0000-\u001f\u007f]/.test(displayName)) {
    throw invalidIdentity();
  }
  if (!groups.groups.includes(ADMIN_ROLE)) {
    throw new AdminError(403, 'admin_required', '사용자 관리 권한이 없습니다.');
  }
  return {
    username,
    displayName,
    email,
    groups: groups.groups,
    role: groups.role,
    applications: groups.role === CHIEF_ADMIN_ROLE
      ? APPLICATIONS.map((application) => application.id)
      : groups.applications,
  };
}

async function authorizedIdentity(request, store) {
  const actor = identity(request);
  assertAuthorizedAdmin(await store.read(), actor);
  return actor;
}

function cookies(request) {
  const parsed = {};
  for (const part of header(request, 'cookie').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    parsed[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return parsed;
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left ?? '');
  const rightBuffer = Buffer.from(right ?? '');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function loadEdgeSecret() {
  if (cachedEdgeSecret) return cachedEdgeSecret;
  const inline = process.env.ADMIN_EDGE_SECRET;
  const path = process.env.ADMIN_EDGE_SECRET_FILE ?? '/run/secrets/bonifacio_sso_admin_edge_secret';
  let secret;
  try {
    if (inline !== undefined) {
      secret = inline;
    } else {
      const before = lstatSync(path);
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        before.size < 32 ||
        before.size > 4096 ||
        (before.mode & 0o077) !== 0 ||
        before.uid !== process.geteuid()
      ) {
        throw new Error('unsafe edge secret file');
      }
      const descriptor = openSync(path, fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW);
      try {
        const opened = fstatSync(descriptor);
        if (before.dev !== opened.dev || before.ino !== opened.ino || opened.size > 4096) {
          throw new Error('edge secret changed');
        }
        secret = readFileSync(descriptor, 'utf8').replace(/[\r\n]+$/, '');
      } finally {
        closeSync(descriptor);
      }
    }
  } catch {
    throw new AdminError(503, 'edge_secret_unavailable', '관리자 인증 경계를 사용할 수 없습니다.');
  }
  return validateEdgeSecret(secret);
}

export function validateEdgeSecret(secret) {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret, 'utf8') < 32 ||
    Buffer.byteLength(secret, 'utf8') > 4096 ||
    !/^[!-~]+$/.test(secret) ||
    /change|replace/i.test(secret)
  ) {
    throw new AdminError(503, 'edge_secret_invalid', '관리자 인증 경계를 사용할 수 없습니다.');
  }
  cachedEdgeSecret = secret;
  return secret;
}

function requiredRevision(request) {
  const revision = header(request, 'if-match');
  if (!/^[a-f0-9]{64}$/.test(revision)) {
    throw new AdminError(428, 'revision_required', '사용자 목록을 새로고침한 뒤 다시 시도하세요.');
  }
  return revision;
}

export function requireTrustedEdge(request, expectedSecret = loadEdgeSecret()) {
  if (!secureEqual(header(request, 'x-portfolio-edge-secret'), expectedSecret)) {
    throw new AdminError(401, 'untrusted_edge', '신뢰할 수 있는 로그인 경로가 아닙니다.');
  }
}

export function requireMutationProtection(request) {
  if (header(request, 'origin') !== origin) {
    throw new AdminError(403, 'invalid_origin', '요청 출처를 확인할 수 없습니다.');
  }
  const cookie = cookies(request).bonifacio_admin_csrf;
  const token = header(request, 'x-csrf-token');
  if (!cookie || !token || !secureEqual(cookie, token)) {
    throw new AdminError(403, 'invalid_csrf', '관리자 요청 검증에 실패했습니다. 새로고침 후 다시 시도하세요.');
  }
}

async function jsonBody(request) {
  if (!header(request, 'content-type').toLowerCase().startsWith('application/json')) {
    throw new AdminError(415, 'content_type_required', 'JSON 요청만 허용됩니다.');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16384) throw new AdminError(413, 'body_too_large', '요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
    return value;
  } catch {
    throw new AdminError(400, 'invalid_json', '요청 내용을 읽을 수 없습니다.');
  }
}

function requireExactBody(body, fields) {
  const expected = [...fields].sort();
  const actual = Object.keys(body).sort();
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    throw new AdminError(400, 'invalid_input', '요청 필드가 올바르지 않습니다.');
  }
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new AdminError(400, 'invalid_input', `${field} 형식이 올바르지 않습니다.`);
  }
  return value;
}

async function serveStatic(response, filename) {
  const extension = filename.slice(filename.lastIndexOf('.'));
  const body = await readFile(join(staticDirectory, filename));
  response.writeHead(200, responseHeaders(contentTypes[extension]));
  response.end(body);
}

async function handleApi(request, response, url, dependencies) {
  requireTrustedEdge(request, dependencies.edgeSecret);
  const actor = await authorizedIdentity(request, dependencies.store);
  if (request.method === 'GET' && url.pathname === `${BASE}/api/editor-access`) {
    sendJson(response, 200, { canEditContent: true, subject: actor.username });
    return;
  }
  if (request.method === 'GET' && url.pathname === `${BASE}/api/session`) {
    const csrfToken = randomBytes(32).toString('base64url');
    sendJson(
      response,
      200,
      {
        actor,
        csrfToken,
        authorization: {
          roles: ROLE_NAMES,
          applications: APPLICATIONS,
          chiefAdminRole: CHIEF_ADMIN_ROLE,
        },
      },
      {
        'Set-Cookie': `bonifacio_admin_csrf=${encodeURIComponent(csrfToken)}; Path=${BASE}/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600`,
      },
    );
    return;
  }
  if (request.method === 'GET' && url.pathname === `${BASE}/api/users`) {
    const current = await dependencies.store.readVersioned();
    sendJson(response, 200, {
      users: publicUsers(current.database),
      revision: current.revision,
    });
    return;
  }

  requireMutationProtection(request);
  if (request.method === 'POST' && url.pathname === `${BASE}/api/account/password`) {
    const expectedRevision = requiredRevision(request);
    const body = await jsonBody(request);
    requireExactBody(body, ['currentPassword', 'newPassword', 'confirmPassword']);
    const currentPassword = normalizePassword(body.currentPassword, '현재 비밀번호', 1);
    const newPassword = normalizePassword(body.newPassword);
    const confirmPassword = normalizePassword(body.confirmPassword, '새 비밀번호 확인');
    if (newPassword !== confirmPassword) {
      throw new AdminError(400, 'password_confirmation_mismatch', '새 비밀번호 확인이 일치하지 않습니다.');
    }
    await dependencies.store.mutate({
      actor: actor.username,
      action: 'change_own_password',
      target: actor.username,
      expectedRevision,
      transform: async (database) => {
        assertAuthorizedAdmin(database, actor);
        const current = database.users[actor.username];
        if (!await dependencies.verifyCredential(currentPassword, current.password)) {
          throw new AdminError(400, 'current_password_invalid', '현재 비밀번호가 맞지 않습니다.');
        }
        current.password = await dependencies.hashCredential(newPassword);
      },
    });
    const current = await dependencies.store.readVersioned();
    sendJson(response, 200, {
      changed: true,
      logoutUrl: `/sso/logout?rd=${encodeURIComponent(`${origin}${BASE}/`)}`,
      revision: current.revision,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === `${BASE}/api/users`) {
    const expectedRevision = requiredRevision(request);
    const body = await jsonBody(request);
    requireExactBody(body, ['username', 'displayName', 'email', 'role', 'applications']);
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const displayName = normalizeDisplayName(body.displayName);
    const role = normalizeRole(body.role);
    const applications = normalizeApplications(body.applications, role);
    const groups = groupsForAssignment(role, applications);
    let credential;
    await dependencies.store.mutate({
      actor: actor.username,
      action: 'create_user',
      target: username,
      expectedRevision,
      transform: async (database) => {
        assertAuthorizedAdmin(database, actor);
        assertAdminMayCreate(database, actor, role);
        if (database.users[username]) throw new AdminError(409, 'username_exists', '이미 사용 중인 아이디입니다.');
        if (Object.values(database.users).some((user) => user.email === email)) {
          throw new AdminError(409, 'email_exists', '이미 사용 중인 이메일입니다.');
        }
        credential = await dependencies.generateCredential();
        database.users[username] = {
          disabled: false,
          displayname: displayName,
          password: credential.digest,
          email,
          groups,
        };
      },
    });
    if (!credential) throw new AdminError(500, 'hash_failed', '임시 비밀번호를 만들 수 없습니다.');
    const current = await dependencies.store.readVersioned();
    sendJson(response, 201, {
      user: publicUsers(current.database).find((user) => user.username === username),
      temporaryPassword: credential.password,
      revision: current.revision,
    });
    return;
  }

  const userMatch = url.pathname.match(new RegExp(`^${BASE}/api/users/([a-z0-9][a-z0-9_-]{0,63})$`));
  if (request.method === 'PATCH' && userMatch) {
    const expectedRevision = requiredRevision(request);
    const username = userMatch[1];
    const body = await jsonBody(request);
    requireExactBody(body, ['displayName', 'role', 'applications', 'disabled']);
    const displayName = normalizeDisplayName(body.displayName);
    const role = normalizeRole(body.role);
    const applications = normalizeApplications(body.applications, role);
    const groups = groupsForAssignment(role, applications);
    const disabled = requireBoolean(body.disabled, '로그인 비활성화');
    await dependencies.store.mutate({
      actor: actor.username,
      action: 'update_user',
      target: username,
      expectedRevision,
      transform: async (database) => {
        assertAuthorizedAdmin(database, actor);
        const current = database.users[username];
        if (!current) throw new AdminError(404, 'user_not_found', '사용자를 찾을 수 없습니다.');
        const next = {
          ...current,
          displayname: displayName,
          disabled,
          groups,
        };
        assertAdminMutationAllowed(database, actor, username, next);
        database.users[username] = next;
      },
    });
    const current = await dependencies.store.readVersioned();
    sendJson(response, 200, {
      user: publicUsers(current.database).find((user) => user.username === username),
      revision: current.revision,
    });
    return;
  }

  const resetMatch = url.pathname.match(
    new RegExp(`^${BASE}/api/users/([a-z0-9][a-z0-9_-]{0,63})/reset-password$`),
  );
  if (request.method === 'POST' && resetMatch) {
    const expectedRevision = requiredRevision(request);
    const username = resetMatch[1];
    let credential;
    await dependencies.store.mutate({
      actor: actor.username,
      action: 'reset_password',
      target: username,
      expectedRevision,
      transform: async (database) => {
        assertAuthorizedAdmin(database, actor);
        assertAdminMayResetPassword(database, actor, username);
        const user = database.users[username];
        credential = await dependencies.generateCredential();
        user.password = credential.digest;
      },
    });
    if (!credential) throw new AdminError(500, 'hash_failed', '임시 비밀번호를 만들 수 없습니다.');
    const current = await dependencies.store.readVersioned();
    sendJson(response, 200, {
      temporaryPassword: credential.password,
      revision: current.revision,
    });
    return;
  }

  throw new AdminError(404, 'not_found', '관리자 API 경로를 찾을 수 없습니다.');
}

export function createHandler({
  store = defaultStore,
  generateCredential = generateTemporaryCredential,
  hashCredential = hashPassword,
  verifyCredential = verifyPassword,
  edgeSecret,
} = {}) {
  return async function handler(request, response) {
    try {
      const url = new URL(request.url ?? '/', origin);
      const trustedEdgeSecret = edgeSecret ?? loadEdgeSecret();
      if (request.method === 'GET' && url.pathname === '/healthz') {
        await store.read();
        await access(process.env.SSO_AUTHELIA_BINARY ?? '/usr/local/bin/authelia', fileConstants.X_OK);
        sendJson(response, 200, { ok: true });
        return;
      }
      if (url.pathname.startsWith(`${BASE}/api/`)) {
        await handleApi(request, response, url, {
          store,
          generateCredential,
          hashCredential,
          verifyCredential,
          edgeSecret: trustedEdgeSecret,
        });
        return;
      }
      requireTrustedEdge(request, trustedEdgeSecret);
      await authorizedIdentity(request, store);
      if (request.method === 'GET' && (url.pathname === `${BASE}/` || url.pathname === `${BASE}/index.html`)) {
        await serveStatic(response, 'index.html');
        return;
      }
      if (request.method === 'GET' && url.pathname === `${BASE}/admin.js`) {
        await serveStatic(response, 'admin.js');
        return;
      }
      if (request.method === 'GET' && url.pathname === `${BASE}/admin.css`) {
        await serveStatic(response, 'admin.css');
        return;
      }
      throw new AdminError(404, 'not_found', '페이지를 찾을 수 없습니다.');
    } catch (error) {
      const status = error instanceof AdminError ? error.status : 500;
      const code = error instanceof AdminError ? error.code : 'internal_error';
      const message = error instanceof AdminError ? error.message : '관리자 서비스에서 오류가 발생했습니다.';
      sendJson(response, status, { error: code, message });
      if (!(error instanceof AdminError)) console.error(error);
    }
  };
}

export const handler = createHandler();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer(handler);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Bonifacio SSO admin listening on ${port}`);
  });
}
