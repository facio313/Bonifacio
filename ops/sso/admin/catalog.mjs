import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export class CatalogError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.code = 'catalog_error';
  }
}

const baseline = JSON.parse(readFileSync(new URL('../role-contract.json', import.meta.url), 'utf8')).applications;
const reserved = new Set([...baseline.map(({ id }) => id), 'sso', 'api', 'assets', 'internal', 'blog', 'wgang', 'index.html']);
const defaults = [{ id: 'pongdang', title: 'Pongdang', href: '/pongdang/', description: 'Collector 문서와 수집 데이터를 조회합니다.' }];
export const catalogPath = () => process.env.APPLICATION_CATALOG_PATH ?? '/data/applications/catalog.json';

export function normalizeEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'description,href,id,title') {
    throw new CatalogError(400, '앱 이름, 식별자, URL, 설명을 입력하세요.');
  }
  const { id, title, href, description } = input;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(id) || reserved.has(id)) {
    throw new CatalogError(400, '이미 사용 중이거나 사용할 수 없는 앱 식별자입니다.');
  }
  if (typeof title !== 'string' || !title.trim() || title.length > 80
    || typeof description !== 'string' || description.length > 500
    || /[\x00-\x1f\x7f]/.test(title + description)) {
    throw new CatalogError(400, '앱 이름은 80자, 설명은 500자 이내로 입력하세요.');
  }
  if (typeof href !== 'string' || href.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(href)) {
    throw new CatalogError(400, '올바른 URL을 입력하세요.');
  }
  let url;
  try { url = new URL(href, 'https://bonifacio.work'); } catch { throw new CatalogError(400, '올바른 URL을 입력하세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || (!href.startsWith('/') && !href.startsWith('https://')) || href.startsWith('//')
    || /(^|\.)wgang\.(art|work)$/.test(url.hostname)) {
    throw new CatalogError(400, 'HTTPS URL 또는 /앱/ 형태의 경로를 입력하세요.');
  }
  const internal = ['bonifacio.work', 'www.bonifacio.work'].includes(url.hostname);
  if (internal && (!/^\/[a-z][a-z0-9-]{0,47}\/$/.test(url.pathname)
    || reserved.has(url.pathname.split('/')[1]) || url.search || url.hash)) {
    throw new CatalogError(400, '내부 앱 URL은 다른 앱과 겹치지 않는 /앱/ 형태여야 합니다.');
  }
  return { id, title: title.trim(), href: internal ? url.pathname : url.href, description: description.trim() };
}

export function readCatalog(path = catalogPath()) {
  let entries;
  try {
    const source = readFileSync(path, 'utf8');
    if (Buffer.byteLength(source) > 256 * 1024) throw new Error('oversized catalog');
    entries = JSON.parse(source);
  } catch (error) {
    if (error.code === 'ENOENT') entries = defaults;
    else throw new CatalogError(503, '앱 목록을 읽을 수 없습니다.');
  }
  if (!Array.isArray(entries) || entries.length > 100) throw new CatalogError(503, '앱 목록이 올바르지 않습니다.');
  try {
    entries = entries.map(normalizeEntry);
    if (new Set(entries.map(({ id }) => id)).size !== entries.length
      || new Set(entries.map(({ href }) => href)).size !== entries.length
      || !entries.some(({ id, href }) => id === 'pongdang' && href === '/pongdang/')) throw new Error('invalid catalog');
  } catch { throw new CatalogError(503, '앱 목록이 올바르지 않습니다.'); }
  return { entries, revision: createHash('sha256').update(JSON.stringify(entries)).digest('hex') };
}

export function catalogApplications() {
  return readCatalog().entries.filter(({ href }) => href.startsWith('/'))
    .map(({ id, title, href }) => ({ id, label: title, group: `access-${id}`, href }));
}

// Caller holds the same lock as account writes and revalidates the actor there.
export async function saveCatalogEntry(input, revision, path = catalogPath()) {
  const current = readCatalog(path);
  if (revision !== current.revision) throw new CatalogError(409, '앱 목록이 변경됐습니다. 새로고침 후 다시 시도하세요.');
  const entry = normalizeEntry(input);
  if (current.entries.some(({ id, href }) => id === entry.id || href === entry.href)) {
    throw new CatalogError(409, '같은 식별자 또는 URL의 앱이 이미 등록되어 있습니다.');
  }
  if (current.entries.length >= 100) throw new CatalogError(400, '앱은 최대 100개까지 등록할 수 있습니다.');
  const next = [...current.entries, entry];
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const backup = await open(join(directory, `catalog-${current.revision}.json.bak`), 'a', 0o600);
  try { if ((await backup.stat()).size === 0) await backup.writeFile(JSON.stringify(current.entries)); await backup.sync(); }
  finally { await backup.close(); }
  const temporary = `${path}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(next, null, 2) + '\n'); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
    try {
      const parent = await open(directory, 'r');
      try { await parent.sync(); } finally { await parent.close(); }
    } catch { console.error('Catalog post-commit durability warning'); }
  } finally { await unlink(temporary).catch(() => undefined); }
  return readCatalog(path);
}
