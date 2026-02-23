/**
 * Bundle the server into a single file for production
 * This eliminates all module resolution issues in packaged apps
 */

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist-server/server.bundle.js',
  external: [
    'better-sqlite3', // Native module
    'playwright-core', // Optional, not used
    'chromium-bidi', // Optional, not used
  ],
  banner: {
    js: '// Bundled server - no external dependencies\n'
  }
});

console.log('✅ Server bundled to dist-server/server.bundle.js');
