import { readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const PID_FILE = join(tmpdir(), 'mrt-test-server.pid');

export default async function globalTeardown() {
  try {
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, 'utf8'));
      if (!isNaN(pid)) {
        try { process.kill(pid, 'SIGTERM'); } catch {}
      }
      rmSync(PID_FILE, { force: true });
    }
  } catch {}
  console.log('🧹 Test environment cleaned up');
}
