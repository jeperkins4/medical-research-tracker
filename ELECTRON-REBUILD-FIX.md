# Electron Native Module Fix

## Problem
Electron v40.4.1 embeds Node.js v24.13.0 (MODULE_VERSION 143), but `better-sqlite3` was being compiled for system Node v25.5.0 (MODULE_VERSION 141). This caused the backend server to crash with:

```
Error: The module '.../better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 141. This version of Node.js requires NODE_MODULE_VERSION 143.
```

## Solution
Rebuild `better-sqlite3` native module for Electron's embedded Node using `@electron/rebuild`:

```bash
npx @electron/rebuild -f -m ./node_modules/better-sqlite3 -v 40.4.1
```

## Automatic Rebuild
Added to `package.json`:

```json
{
  "scripts": {
    "postinstall": "npx @electron/rebuild -f -m ./node_modules/better-sqlite3"
  }
}
```

This ensures native modules are rebuilt automatically after `npm install`.

## Changes Made (v0.1.8)
1. ✅ Switched from `better-sqlite3-multiple-ciphers` to regular `better-sqlite3`
   - Reason: `better-sqlite3-multiple-ciphers` had compilation issues with Electron
   - Trade-off: Lost SQLCipher encryption (can add application-level encryption later)

2. ✅ Added `postinstall` script to run `@electron/rebuild` automatically
   - Rebuilds `better-sqlite3` for Electron's Node version after install

3. ✅ Updated `electron-builder.yml` to unpack `better-sqlite3` instead of `better-sqlite3-multiple-ciphers`

4. ✅ Removed SQLCipher encryption from `server/db-secure.js` (TODO: Add back later)

## Production Build
For production builds, `electron-builder` with `npmRebuild: false` uses the module as-is from `node_modules` (already rebuilt by postinstall hook).

## Testing
```bash
# Start Electron in dev mode
npm run electron:dev

# Test backend health
curl http://localhost:3000/api/health

# Test account creation
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"testpass123"}'
```

All tests passing! ✅
