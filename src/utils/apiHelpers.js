/**
 * Robust API Helper with Retries and Error Handling
 */

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with automatic retry on failures
 */
export async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      // If we got a response, return it (even if it's an error status)
      return response;
      
    } catch (error) {
      lastError = error;
      console.warn(`Fetch attempt ${attempt}/${retries} failed for ${url}:`, error.message);
      
      // Don't retry on the last attempt
      if (attempt < retries) {
        const delay = RETRY_DELAY * attempt; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  // All retries failed
  throw new Error(`Failed after ${retries} attempts: ${lastError.message}`);
}

/**
 * Make authenticated API call with retry
 */
export async function apiFetch(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  
  // Check if response is OK
  if (!response.ok) {
    // Try to get error message from response
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status} ${response.statusText}`;
    }
    
    // Special handling for auth errors
    if (response.status === 401) {
      console.error('Authentication required - redirecting to login');
      // Could trigger logout here
      throw new Error('Authentication required. Please log in again.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response;
}

/**
 * Fetch JSON data with retry
 */
export async function fetchJSON(url, options = {}) {
  const response = await apiFetch(url, options);
  const data = await response.json();
  return data;
}

/**
 * Cached fetch - stores result in memory for X seconds
 */
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

export async function fetchCached(url, options = {}, ttl = CACHE_TTL) {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    console.log(`Using cached data for ${url}`);
    return cached.data;
  }
  
  const data = await fetchJSON(url, options);
  
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries
  setTimeout(() => cache.delete(cacheKey), ttl);
  
  return data;
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear();
  console.log('API cache cleared');
}

/**
 * Batch fetch multiple endpoints
 */
export async function fetchBatch(urls, options = {}) {
  const promises = urls.map(url => 
    fetchJSON(url, options).catch(error => ({
      error: true,
      message: error.message,
      url
    }))
  );
  
  return Promise.all(promises);
}

/**
 * Poll an endpoint until condition is met
 */
export async function pollUntil(url, conditionFn, maxAttempts = 10, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const data = await fetchJSON(url);
      if (conditionFn(data)) {
        return data;
      }
    } catch (error) {
      console.warn(`Poll attempt ${i + 1} failed:`, error.message);
    }
    
    if (i < maxAttempts - 1) {
      await sleep(interval);
    }
  }
  
  throw new Error(`Polling failed after ${maxAttempts} attempts`);
}
