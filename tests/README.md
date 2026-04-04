# Medical Research Tracker — Test Suite

## Structure

### Unit Tests (`/unit`)

- **`fhir-auth.test.js`** — FHIR OAuth2 auth module tests
  - PKCE challenge generation
  - Authorization flow initialization
  - Token validation and refresh flows
  - Auth status tracking

- **`fhir-routes.test.js`** — FHIR API routes contract tests
  - Endpoint signatures (parameters, responses)
  - Auth/authz requirements
  - Error handling

### E2E Tests (`/e2e`)

- **`auth.spec.js`** — User authentication flow
  - User setup and registration
  - Login / logout
  - Protected route access
  - Invalid credential handling

- **`fhir-auth.spec.js`** — FHIR OAuth2 integration
  - Authorization flow initiation
  - Callback handling
  - Token refresh
  - Status checking
  - Error scenarios

## Running Tests

### Unit Tests (Vitest)

```bash
npm test                # Run all tests once
npm run test:watch     # Run in watch mode
npm run test:ui        # Open Vitest UI
```

### E2E Tests (Playwright)

```bash
npm run test:e2e       # Run Playwright tests
```

**Requirements:** Server must be running on `http://localhost:3000`

## Test Coverage Goals

| Component | Unit | E2E | Status |
|-----------|------|-----|--------|
| FHIR Auth (PKCE) | ✅ | 🔄 | Implemented |
| Token Refresh | ✅ | 🔄 | Implemented |
| API Routes | ✅ | 🔄 | Scaffolded |
| Portal Sync Data Ingestion | ❌ | ❌ | TODO |
| Multi-Cancer Profiles | ❌ | ❌ | TODO |
| Portal CredentialManager UX | ❌ | ❌ | TODO |

## Next Steps

1. **Complete callback handling** — Store state/verifier securely (Redis or JWT session)
2. **Portal sync tests** — Data ingestion, validation, schema mapping
3. **Multi-cancer support** — Test genomic profile detection and reporting
4. **QA hardening** — Add edge cases, malformed input, error recovery
5. **Coverage expansion** — Target 80%+ coverage on auth paths

## Key Test Scenarios

### FHIR Authentication

- ✅ PKCE flow with proper code_challenge
- ✅ OAuth state generation
- ✅ Token storage and retrieval
- 🔄 Callback state verification (CSRF protection)
- 🔄 Token refresh on expiry
- ❌ Concurrent token refresh (race condition handling)

### Portal Sync

- ❌ Data ingestion without errors
- ❌ Schema validation (FHIR → internal)
- ❌ Duplicate detection
- ❌ Retry logic on transient failures
- ❌ Audit logging

### Multi-Cancer Support

- ❌ ARID1A / FGFR3 / PIK3CA mutation detection
- ❌ Bladder cancer profile assignment
- ❌ Treatment recommendation mapping
- ❌ Genomic report generation

---

## CI/CD Integration

Tests should run in CI/CD pipeline:

```yaml
test:
  - npm ci
  - npm test
  - npm run test:e2e (requires server in background)
```
