import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

test('dev is validated while production publication and deployment require main', () => {
  const workflow = parse(fs.readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main', 'dev']);
  const steps = workflow.jobs['build-and-deploy'].steps;
  const validate = steps.find((step) => step.name === 'Validate landing page and SSO contracts');
  assert.ok(validate);
  assert.equal(validate.if, undefined);
  for (const name of [
    'Sign in to GitHub Container Registry',
    'Set up Docker Buildx',
    'Build and publish ARM64 image',
    'Request restricted server deployment',
  ]) {
    const step = steps.find((candidate) => candidate.name === name);
    assert.ok(step, name);
    assert.equal(step.if, "github.ref_name == 'main'", name);
  }
});
