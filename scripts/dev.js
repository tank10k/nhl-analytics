'use strict';
// Starts the API server (auto-restarts on change) and the Vite dev server together.
// Ctrl+C stops both. Open http://localhost:5173 while developing.
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const procs = [
  ['api', [
    '--watch', '--disable-warning=ExperimentalWarning', 'server.js',
  ]],
  ['web', [path.join('node_modules', 'vite', 'bin', 'vite.js')]],
].map(([name, args]) => {
  const p = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
  p.on('exit', (code) => {
    if (code) console.log(`[${name}] exited with code ${code}`);
    shutdown();
  });
  return p;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (p.exitCode === null) p.kill();
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
