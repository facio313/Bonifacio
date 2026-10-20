import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAGE_SIZE,
  applicationSummary,
  filterUsers,
  paginateUsers,
  roleLabel,
  userMetrics,
} from './public/ui-model.js';

const applications = [
  { id: 'react', label: 'React' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'garak', label: 'Garak' },
];

const users = [
  {
    username: 'chief',
    displayName: '최고 관리자',
    email: 'chief@example.com',
    role: 'chief-admin',
    applications: ['react', 'monitor', 'garak'],
    disabled: false,
  },
  {
    username: 'member',
    displayName: '일반 회원',
    email: 'member@example.com',
    role: 'user',
    applications: ['react', 'monitor', 'garak'],
    disabled: false,
  },
  {
    username: 'sleeping',
    displayName: '휴면 회원',
    email: 'sleeping@example.com',
    role: 'user',
    applications: [],
    disabled: true,
  },
];

test('admin directory metrics and role labels stay compact', () => {
  assert.deepEqual(userMetrics(users), {
    total: 3,
    active: 2,
    administrators: 1,
    disabled: 1,
  });
  assert.equal(roleLabel('chief-admin'), '최고 관리자');
  assert.equal(roleLabel('user'), '일반 사용자');
});

test('application summary exposes at most two labels and an overflow count', () => {
  assert.deepEqual(applicationSummary(users[1], applications), {
    labels: ['React', 'Monitor'],
    overflow: 1,
    total: 3,
  });
  assert.deepEqual(applicationSummary(users[0], applications), {
    labels: ['모든 서비스'],
    overflow: 0,
    total: 1,
  });
});

test('directory filtering covers identity, role, state, and implicit chief access', () => {
  assert.deepEqual(filterUsers(users, { query: 'MEMBER' }).map(({ username }) => username), ['member']);
  assert.deepEqual(filterUsers(users, { role: 'chief-admin' }).map(({ username }) => username), ['chief']);
  assert.deepEqual(filterUsers(users, { status: 'disabled' }).map(({ username }) => username), ['sleeping']);
  assert.deepEqual(
    filterUsers(users, { application: 'garak' }).map(({ username }) => username),
    ['member', 'chief'],
  );
});

test('pagination bounds rendered users even for a large directory', () => {
  const manyUsers = Array.from({ length: 103 }, (_, index) => ({
    ...users[1],
    username: `member-${String(index).padStart(3, '0')}`,
    displayName: `회원 ${String(index).padStart(3, '0')}`,
  }));
  const first = paginateUsers(manyUsers, 1);
  const last = paginateUsers(manyUsers, 99);
  assert.equal(first.users.length, PAGE_SIZE);
  assert.equal(last.page, 4);
  assert.equal(last.users.length, 13);
  assert.equal(last.end, 103);
});
