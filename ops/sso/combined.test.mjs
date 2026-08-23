import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

import {
  combinedProcessSpecs,
  superviseCombinedProcesses,
} from './combined.mjs';

class FakeChild extends EventEmitter {
  exitCode = null;

  signalCode = null;

  signals = [];

  kill(signal) {
    this.signals.push(signal);
    queueMicrotask(() => this.finish(null, signal));
    return true;
  }

  finish(code, signal = null) {
    if (this.exitCode != null || this.signalCode != null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('exit', code, signal);
  }
}

class StubbornFakeChild extends FakeChild {
  kill(signal) {
    this.signals.push(signal);
    if (signal === 'SIGKILL') queueMicrotask(() => this.finish(null, signal));
    return true;
  }
}

class FakeProcess extends EventEmitter {}

const silentLogger = {
  log() {},
  error() {},
};

function startSupervisor() {
  const children = [];
  const commands = [];
  const processReference = new FakeProcess();
  const promise = superviseCombinedProcesses(
    [
      { name: 'authentication', command: '/auth', args: ['--config', '/config'] },
      { name: 'administration', command: '/node', args: ['/admin'] },
    ],
    {
      spawnProcess(command, args, options) {
        commands.push({ command, args, options });
        const child = new FakeChild();
        children.push(child);
        return child;
      },
      processReference,
      shutdownTimeoutMs: 50,
      logger: silentLogger,
    },
  );
  return { children, commands, processReference, promise };
}

test('combined runtime starts fixed authentication and administration commands without a shell', () => {
  const specs = combinedProcessSpecs({
    environment: {
      SSO_AUTHELIA_BINARY: '/custom/authelia',
      AUTHELIA_CONFIG: '/custom/configuration.yml',
    },
    nodeBinary: '/custom/node',
    runtimeDirectory: '/runtime',
  });

  assert.deepEqual(specs, [
    {
      name: 'authentication',
      command: '/custom/authelia',
      args: ['--config', '/custom/configuration.yml'],
    },
    {
      name: 'administration',
      command: '/custom/node',
      args: ['/runtime/admin/server.mjs'],
    },
  ]);
});

test('an unexpected child exit stops its sibling and fails the container', async () => {
  const runtime = startSupervisor();
  assert.equal(runtime.children.length, 2);
  assert.deepEqual(runtime.commands.map(({ options }) => options), [
    { stdio: 'inherit' },
    { stdio: 'inherit' },
  ]);

  runtime.children[0].finish(0);

  assert.equal(await runtime.promise, 1);
  assert.deepEqual(runtime.children[1].signals, ['SIGTERM']);
});

test('a parent termination signal is forwarded to both children', async () => {
  const runtime = startSupervisor();
  runtime.processReference.emit('SIGTERM');

  assert.equal(await runtime.promise, 0);
  assert.deepEqual(runtime.children[0].signals, ['SIGTERM']);
  assert.deepEqual(runtime.children[1].signals, ['SIGTERM']);
});

test('a child startup error stops its sibling and fails the container', async () => {
  const runtime = startSupervisor();
  runtime.children[1].emit('error', new Error('startup failed'));

  assert.equal(await runtime.promise, 1);
  assert.deepEqual(runtime.children[0].signals, ['SIGTERM']);
});

test('shutdown timeout force-kills children that ignore termination', async () => {
  const children = [];
  const processReference = new FakeProcess();
  const promise = superviseCombinedProcesses(
    [
      { name: 'authentication', command: '/auth', args: [] },
      { name: 'administration', command: '/node', args: [] },
    ],
    {
      spawnProcess() {
        const child = new StubbornFakeChild();
        children.push(child);
        return child;
      },
      processReference,
      shutdownTimeoutMs: 5,
      logger: silentLogger,
    },
  );

  processReference.emit('SIGTERM');

  assert.equal(await promise, 0);
  assert.deepEqual(children[0].signals, ['SIGTERM', 'SIGKILL']);
  assert.deepEqual(children[1].signals, ['SIGTERM', 'SIGKILL']);
});
