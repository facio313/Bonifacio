export const PAGE_SIZE = 30;

export const ROLE_LABELS = Object.freeze({
  user: '일반 사용자',
  admin: '관리자',
  'chief-admin': '최고 관리자',
});

export const ROLE_DESCRIPTIONS = Object.freeze({
  user: '선택한 서비스만 이용할 수 있습니다.',
  admin: '일반 사용자 계정과 선택한 서비스 권한을 관리합니다.',
  'chief-admin': '모든 서비스와 관리자 계정을 관리합니다.',
});

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}

export function userMetrics(users) {
  return users.reduce(
    (metrics, user) => {
      metrics.total += 1;
      if (user.disabled) metrics.disabled += 1;
      else metrics.active += 1;
      if (user.role === 'admin' || user.role === 'chief-admin') metrics.administrators += 1;
      return metrics;
    },
    { total: 0, active: 0, administrators: 0, disabled: 0 },
  );
}

export function applicationSummary(user, applications, limit = 2) {
  const labels = user.role === 'chief-admin'
    ? ['모든 서비스']
    : user.applications.map((id) => (
      applications.find((application) => application.id === id)?.label ?? id
    ));
  return {
    labels: labels.slice(0, limit),
    overflow: Math.max(0, labels.length - limit),
    total: labels.length,
  };
}

export function filterUsers(
  users,
  { query = '', role = 'all', status = 'all', application = 'all' } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  return users
    .filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (status === 'active' && user.disabled) return false;
      if (status === 'disabled' && !user.disabled) return false;
      if (
        application !== 'all'
        && user.role !== 'chief-admin'
        && !user.applications.includes(application)
      ) return false;
      if (!normalizedQuery) return true;
      return [user.username, user.displayName, user.email]
        .some((value) => value.toLocaleLowerCase('ko-KR').includes(normalizedQuery));
    })
    .sort((left, right) => {
      if (left.disabled !== right.disabled) return Number(left.disabled) - Number(right.disabled);
      return (left.displayName || left.username).localeCompare(
        right.displayName || right.username,
        'ko-KR',
      );
    });
}

export function paginateUsers(users, requestedPage, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const page = Math.min(Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1), pageCount);
  const start = (page - 1) * pageSize;
  return {
    page,
    pageCount,
    start,
    end: Math.min(start + pageSize, users.length),
    users: users.slice(start, start + pageSize),
  };
}
