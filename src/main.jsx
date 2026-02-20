import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Fix API calls in Electron production mode
// In development, Vite proxies /api to localhost:3000
// In production (file:// protocol), we need to explicitly call localhost:3000
if (window.location.protocol === 'file:') {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    // If URL starts with /api, prepend localhost:3000
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `http://localhost:3000${url}`;
      console.log('[Fetch Interceptor] Redirecting to:', url);
    }
    return originalFetch(url, options);
  };
  console.log('[App] Fetch interceptor installed for Electron');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
