/**
 * Authentication E2E Tests
 * Tests login, setup, and auth flows
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testUser = {
    username: `test-user-${Date.now()}`,
    password: 'TestPassword123!@#'
  };

  test('should complete setup and login flow', async ({ request }) => {
    // Check if needs setup
    const setupCheck = await request.get('/api/auth/needs-setup');
    expect(setupCheck.status()).toBe(200);
    const setupData = await setupCheck.json();
    
    if (setupData.needs_setup) {
      // Setup user
      const setupResponse = await request.post('/api/auth/setup', {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });
      
      expect(setupResponse.status()).toBe(200);
      const setupResult = await setupResponse.json();
      expect(setupResult.success).toBe(true);
      expect(setupResult.username).toBe(testUser.username);
    }

    // Login
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        username: testUser.username,
        password: testUser.password
      }
    });

    expect(loginResponse.status()).toBe(200);
    const loginResult = await loginResponse.json();
    expect(loginResult.authenticated).toBe(true);
  });

  test('should reject invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'nonexistent',
        password: 'wrongpassword'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('should require password of minimum length', async ({ request }) => {
    const response = await request.post('/api/auth/setup', {
      data: {
        username: `test-user-${Date.now()}`,
        password: 'short'
      }
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toBeDefined();
  });
});

test.describe('Protected Routes', () => {
  test('should return 401 without authentication', async ({ request }) => {
    const routes = [
      '/api/profile',
      '/api/conditions',
      '/api/vitals',
      '/api/medications'
    ];

    for (const route of routes) {
      const response = await request.get(route);
      expect(response.status()).toBe(401);
    }
  });
});
