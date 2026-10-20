import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SELF_SERVICE_ACCOUNT_NAVIGATION,
  accountNavigationFromSession,
  accountNavigationForRole,
} from '../../src/accountNavigation.mjs';

test('landing account navigation follows only the exact central role', () => {
  assert.deepEqual(accountNavigationForRole('chief-admin'), {
    href: '/sso/admin/',
    label: 'SSO ADMIN',
    ariaLabel: 'SSO 관리 콘솔 열기',
  });
  for (const role of ['user', 'admin']) {
    assert.equal(accountNavigationForRole(role), SELF_SERVICE_ACCOUNT_NAVIGATION);
  }
  for (const role of [
    undefined,
    null,
    '',
    'developer',
    'chief-admin ',
    'Chief-Admin',
    ['chief-admin'],
  ]) {
    assert.equal(accountNavigationForRole(role), null);
  }
});

test('landing navigation reads the exact role and never infers it from management capability', () => {
  assert.equal(
    accountNavigationFromSession({ profile: { role: 'admin' }, canManageUsers: true }),
    SELF_SERVICE_ACCOUNT_NAVIGATION,
  );
  assert.deepEqual(accountNavigationFromSession({ profile: { role: 'chief-admin' } }), {
    href: '/sso/admin/',
    label: 'SSO ADMIN',
    ariaLabel: 'SSO 관리 콘솔 열기',
  });
  for (const payload of [
    undefined,
    null,
    {},
    { profile: null },
    { profile: {} },
    { profile: { role: 'developer' }, canManageUsers: true },
    { role: 'chief-admin' },
  ]) {
    assert.equal(accountNavigationFromSession(payload), null);
  }
});

test('landing self-service fallback is immutable and least privileged', () => {
  assert.deepEqual(SELF_SERVICE_ACCOUNT_NAVIGATION, {
    href: '/sso/user/',
    label: '내 정보',
    ariaLabel: '내 정보 열기',
  });
  assert.equal(Object.isFrozen(SELF_SERVICE_ACCOUNT_NAVIGATION), true);
});
