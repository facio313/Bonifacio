export const SELF_SERVICE_ACCOUNT_NAVIGATION = Object.freeze({
  href: '/sso/user/',
  label: '내 정보',
  ariaLabel: '내 정보 열기',
});

const CHIEF_ADMIN_ACCOUNT_NAVIGATION = Object.freeze({
  href: '/sso/admin/',
  label: 'SSO ADMIN',
  ariaLabel: 'SSO 관리 콘솔 열기',
});

export function accountNavigationForRole(role) {
  if (role === 'chief-admin') return CHIEF_ADMIN_ACCOUNT_NAVIGATION;
  if (role === 'user' || role === 'admin') return SELF_SERVICE_ACCOUNT_NAVIGATION;
  return null;
}

export function accountNavigationFromSession(payload) {
  if (!payload || typeof payload !== 'object' || !('profile' in payload)) return null;
  const profile = payload.profile;
  if (!profile || typeof profile !== 'object' || !('role' in profile)) return null;
  return accountNavigationForRole(profile.role);
}
