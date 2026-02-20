// API client that works in both development and production (Electron)

const API_BASE_URL = window.location.protocol === 'file:' 
  ? 'http://localhost:3000'  // Electron production
  : '';  // Development (Vite proxy handles /api)

// Wrapper for fetch that automatically adds the base URL
export async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
  
  console.log(`[API] ${options.method || 'GET'} ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      credentials: options.credentials || 'include',
    });
    
    return response;
  } catch (error) {
    console.error(`[API] Request failed: ${error.message}`);
    throw error;
  }
}

// Export base URL for direct use if needed
export { API_BASE_URL };
