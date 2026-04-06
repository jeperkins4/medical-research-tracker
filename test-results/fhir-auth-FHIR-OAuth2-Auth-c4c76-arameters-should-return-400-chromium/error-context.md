# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fhir-auth.spec.js >> FHIR OAuth2 Authentication >> missing required parameters should return 400
- Location: tests/e2e/fhir-auth.spec.js:106:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 401
```

# Test source

```ts
  14  |     // Ensure a test user exists
  15  |     const setupRes = await request.post('/api/auth/setup', {
  16  |       data: {
  17  |         username: 'testuser',
  18  |         password: 'testpass123'
  19  |       }
  20  |     });
  21  |     
  22  |     // If setup fails (user already exists), login instead
  23  |     if (!setupRes.ok()) {
  24  |       const loginRes = await request.post('/api/auth/login', {
  25  |         data: {
  26  |           username: 'testuser',
  27  |           password: 'testpass123'
  28  |         }
  29  |       });
  30  |       
  31  |       if (loginRes.ok()) {
  32  |         const loginData = await loginRes.json();
  33  |         authToken = loginData.token; // Store for context if needed
  34  |       }
  35  |     } else {
  36  |       const setupData = await setupRes.json();
  37  |       authToken = setupData.token; // Store for context if needed
  38  |     }
  39  |   });
  40  | 
  41  |   test('POST /api/fhir/auth/init should initiate OAuth flow', async ({ request }) => {
  42  |     const response = await request.post('/api/fhir/auth/init', {
  43  |       data: {
  44  |         credentialId: 1,
  45  |         fhirServerUrl: 'https://r4.smarthealthit.org/api',
  46  |         clientId: 'test-client-id',
  47  |         redirectUri: 'http://localhost:3000/api/fhir/auth/callback'
  48  |       }
  49  |     });
  50  | 
  51  |     expect(response.status()).toBeGreaterThanOrEqual(200);
  52  |     expect(response.status()).toBeLessThan(500);
  53  |     
  54  |     if (response.status() === 200) {
  55  |       const data = await response.json();
  56  |       expect(data).toHaveProperty('authorizationUrl');
  57  |       expect(data).toHaveProperty('codeVerifier');
  58  |       expect(data).toHaveProperty('state');
  59  |       expect(data.authorizationUrl).toContain('oauth2/authorize');
  60  |     }
  61  |   });
  62  | 
  63  |   test('GET /api/fhir/auth/callback should handle OAuth callback', async ({ request }) => {
  64  |     const response = await request.get('/api/fhir/auth/callback?code=test-code&state=test-state&credentialId=1');
  65  | 
  66  |     expect(response.status()).toBeGreaterThanOrEqual(200);
  67  |     expect(response.status()).toBeLessThan(500);
  68  |     
  69  |     const data = await response.json();
  70  |     expect(data).toHaveProperty('status');
  71  |   });
  72  | 
  73  |   test('GET /api/fhir/status should return auth status', async ({ request }) => {
  74  |     const response = await request.get('/api/fhir/status?credentialId=1');
  75  | 
  76  |     expect(response.status()).toBeGreaterThanOrEqual(200);
  77  |     expect(response.status()).toBeLessThan(500);
  78  |     
  79  |     const data = await response.json();
  80  |     expect(data).toHaveProperty('status');
  81  |   });
  82  | 
  83  |   test('POST /api/fhir/token/refresh should refresh access token', async ({ request }) => {
  84  |     const response = await request.post('/api/fhir/token/refresh', {
  85  |       data: {
  86  |         credentialId: 1
  87  |       }
  88  |     });
  89  | 
  90  |     // May return 500 if credential doesn't have refresh token (expected)
  91  |     expect(response.status()).toBeGreaterThanOrEqual(200);
  92  |     expect(response.status()).toBeLessThan(600);
  93  |   });
  94  | 
  95  |   test('POST /api/fhir/token/validate should validate and refresh if needed', async ({ request }) => {
  96  |     const response = await request.post('/api/fhir/token/validate', {
  97  |       data: {
  98  |         credentialId: 1
  99  |       }
  100 |     });
  101 | 
  102 |     expect(response.status()).toBeGreaterThanOrEqual(200);
  103 |     expect(response.status()).toBeLessThan(600);
  104 |   });
  105 | 
  106 |   test('missing required parameters should return 400', async ({ request }) => {
  107 |     const response = await request.post('/api/fhir/auth/init', {
  108 |       data: {
  109 |         credentialId: 1
  110 |         // missing other required fields
  111 |       }
  112 |     });
  113 | 
> 114 |     expect(response.status()).toBe(400);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  115 |     const error = await response.json();
  116 |     expect(error).toHaveProperty('error');
  117 |   });
  118 | 
  119 |   test('invalid credentialId should return appropriate error', async ({ request }) => {
  120 |     const response = await request.get('/api/fhir/status?credentialId=invalid');
  121 | 
  122 |     expect(response.status()).toBeGreaterThanOrEqual(200);
  123 |     expect(response.status()).toBeLessThan(500);
  124 |     const data = await response.json();
  125 |     expect(data).toHaveProperty('status');
  126 |   });
  127 | });
  128 | 
  129 | test.describe('FHIR Credential Management', () => {
  130 |   test('portal credentials should be encrypted at rest', async () => {
  131 |     // This test documents the security requirement
  132 |     // In implementation, verify that FHIR tokens are stored encrypted
  133 |     expect(true).toBe(true);
  134 |   });
  135 | 
  136 |   test('FHIR auth status should track token expiration', async () => {
  137 |     // This test documents the requirement to track token expiry
  138 |     // Implementation should check expiresAt and isExpired fields
  139 |     expect(true).toBe(true);
  140 |   });
  141 | });
  142 | 
```