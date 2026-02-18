/**
 * Test analytics endpoint with authentication
 */

import 'dotenv/config';
import fetch from 'node-fetch';

async function testAnalytics() {
  try {
    // Login first
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: 'jeperkins4', 
        password: process.env.TEST_PASSWORD || 'password'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    
    // Extract cookie
    const cookies = loginRes.headers.get('set-cookie');
    console.log('\nCookies:', cookies);
    
    // Try analytics endpoint
    const analyticsRes = await fetch('http://localhost:3000/api/analytics/dashboard', {
      headers: {
        'Cookie': cookies || ''
      }
    });
    
    console.log('\nAnalytics status:', analyticsRes.status);
    const analyticsData = await analyticsRes.json();
    console.log('Analytics response:', JSON.stringify(analyticsData, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAnalytics();
