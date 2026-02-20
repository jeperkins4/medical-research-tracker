// API configuration for Electron app
export const API_BASE_URL = window.location.protocol === 'file:' 
  ? 'http://localhost:3000'  // Electron production
  : '';  // Development (Vite proxy)

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
