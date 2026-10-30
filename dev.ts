import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const bin = (name: string) => path.join(root, 'node_modules', '.bin', name);
const children: ChildProcess[] = [];

function start(command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  children.push(child);
  child.on('exit', code => {
    if (code && !process.exitCode) process.exitCode = code;
  });
}

start(bin('tsx'), ['server.ts']);
start(bin('vite'), ['--open']);

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
