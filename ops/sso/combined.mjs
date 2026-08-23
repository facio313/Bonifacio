import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const terminationSignals = ['SIGTERM', 'SIGINT', 'SIGHUP'];

export function combinedProcessSpecs({
  environment = process.env,
  nodeBinary = process.execPath,
  runtimeDirectory = directory,
} = {}) {
  return [
    {
      name: 'authentication',
      command: environment.SSO_AUTHELIA_BINARY ?? '/usr/local/bin/authelia',
      args: [
        '--config',
        environment.AUTHELIA_CONFIG ?? '/config/configuration.yml',
      ],
    },
    {
      name: 'administration',
      command: nodeBinary,
      args: [join(runtimeDirectory, 'admin/server.mjs')],
    },
  ];
}

function outcome(name, child) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.once('error', (error) => finish({ kind: 'error', name, error }));
    child.once('exit', (code, signal) => finish({
      kind: 'exit',
      name,
      code,
      signal,
    }));
  });
}

function signalPromise(processReference) {
  const listeners = new Map();
  const promise = new Promise((resolve) => {
    for (const signal of terminationSignals) {
      const listener = () => resolve({ kind: 'signal', signal });
      listeners.set(signal, listener);
      processReference.once(signal, listener);
    }
  });
  return {
    promise,
    remove() {
      for (const [signal, listener] of listeners) {
        processReference.removeListener(signal, listener);
      }
    },
  };
}

function terminateRunning(children, signal) {
  for (const { child } of children) {
    if (child.exitCode != null || child.signalCode != null) continue;
    try {
      child.kill(signal);
    } catch {
      // A concurrently exiting child needs no further action.
    }
  }
}

async function waitUntilSettled(outcomes, timeoutMs) {
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = Promise.all(outcomes).then(() => true);
  const result = await Promise.race([settled, timedOut]);
  clearTimeout(timer);
  return result;
}

export async function superviseCombinedProcesses(specs = combinedProcessSpecs(), {
  spawnProcess = spawn,
  processReference = process,
  shutdownTimeoutMs = 10_000,
  logger = console,
} = {}) {
  if (!Array.isArray(specs) || specs.length !== 2) {
    throw new TypeError('the combined SSO runtime requires exactly two processes');
  }
  if (!Number.isSafeInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 1) {
    throw new TypeError('shutdownTimeoutMs must be a positive integer');
  }

  const requestedSignal = signalPromise(processReference);
  const children = [];
  const outcomes = [];
  try {
    for (const spec of specs) {
      if (!spec?.name || !spec.command || !Array.isArray(spec.args)) {
        throw new TypeError('invalid combined SSO process specification');
      }
      const child = spawnProcess(spec.command, spec.args, {
        stdio: 'inherit',
      });
      children.push({ name: spec.name, child });
      outcomes.push(outcome(spec.name, child));
    }
  } catch (error) {
    requestedSignal.remove();
    logger.error('Combined SSO failed to start a required process');
    terminateRunning(children, 'SIGTERM');
    if (!await waitUntilSettled(outcomes, shutdownTimeoutMs)) {
      terminateRunning(children, 'SIGKILL');
    }
    return 1;
  }

  const first = await Promise.race([...outcomes, requestedSignal.promise]);
  requestedSignal.remove();

  let exitCode;
  if (first.kind === 'signal') {
    logger.log(`Combined SSO received ${first.signal}; stopping both processes`);
    exitCode = 0;
  } else {
    logger.error(`Combined SSO ${first.name} process exited unexpectedly`);
    exitCode = 1;
  }

  terminateRunning(children, 'SIGTERM');
  if (!await waitUntilSettled(outcomes, shutdownTimeoutMs)) {
    logger.error('Combined SSO shutdown timed out; forcing remaining processes to stop');
    terminateRunning(children, 'SIGKILL');
    await waitUntilSettled(outcomes, 1_000);
  }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  superviseCombinedProcesses()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error('Combined SSO supervisor failed', error);
      process.exitCode = 1;
    });
}
