import assert from 'node:assert/strict';
import test from 'node:test';

import {
  landingRedirect,
  singleApplicationRedirect,
} from './landing-redirect.mjs';

test('a canonical account with one application is sent directly to it', () => {
  assert.equal(
    landingRedirect('GET', '/', 'user,portfolio-v2,access-multtara'),
    '/multtara/',
  );
  assert.equal(
    landingRedirect('HEAD', '/index.html', 'user,admin,portfolio-v2,access-monitor'),
    '/monitor/',
  );
});

test('landing keeps accounts with zero, multiple, or implicit application access', () => {
  for (const groups of [
    'user,portfolio-v2',
    'user,portfolio-v2,access-react,access-multtara',
    'user,admin,chief-admin,portfolio-v2',
    'user',
    'user,developer',
    'user,developer,admin',
  ]) {
    assert.equal(singleApplicationRedirect(groups), null);
  }
});

test('landing redirect fails closed for malformed identity or non-landing requests', () => {
  for (const groups of [
    undefined,
    null,
    '',
    ['user,portfolio-v2,access-multtara'],
    'user, portfolio-v2,access-multtara',
    'user,portfolio-v2,access-multtara,',
    'user,portfolio-v2,access-unknown',
  ]) {
    assert.equal(singleApplicationRedirect(groups), null);
  }
  assert.equal(
    landingRedirect('POST', '/', 'user,portfolio-v2,access-multtara'),
    null,
  );
  assert.equal(
    landingRedirect('GET', '/assets/app.js', 'user,portfolio-v2,access-multtara'),
    null,
  );
});
