/**
 * Configuration Manager
 * 
 * Manages user-configurable settings stored in userData directory.
 * Handles API keys and optional service credentials.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

let configPath;
let config = null;

/**
 * Initialize config manager
 * @param {string} userDataPath - Electron's userData path
 */
export function initConfig(userDataPath) {
  // Ensure userDataPath exists
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }
  
  configPath = join(userDataPath, 'config.json');
  
  // Load existing config or create default
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf8');
      config = JSON.parse(raw);
      console.log('[Config] Loaded user configuration');
    } catch (err) {
      console.error('[Config] Failed to parse config.json, using defaults:', err);
      config = getDefaultConfig();
    }
  } else {
    config = getDefaultConfig();
    saveConfig();
    console.log('[Config] Created default configuration');
  }
  
  return config;
}

/**
 * Get default configuration
 */
function getDefaultConfig() {
  return {
    version: 1,
    firstRunComplete: false,
    
    // Optional API keys (features disabled if not set)
    apiKeys: {
      brave: null,        // Research scanner
      anthropic: null,    // AI meal analysis
    },
    
    // Cloud sync (optional)
    cloudSync: {
      enabled: false,
      supabaseUrl: null,
      supabaseAnonKey: null,
    },
    
    // Research scanner settings
    researchScanner: {
      enabled: false,
      schedule: '2:00 AM',  // Default time
      categories: ['conventional', 'pipeline', 'integrative', 'trials']
    },
    
    // App preferences
    preferences: {
      theme: 'auto',
      notifications: true,
    }
  };
}

/**
 * Get current configuration
 */
export function getConfig() {
  if (!config) {
    throw new Error('Config not initialized. Call initConfig() first.');
  }
  return config;
}

/**
 * Update configuration
 * @param {Object} updates - Partial config updates
 */
export function updateConfig(updates) {
  if (!config) {
    throw new Error('Config not initialized');
  }
  
  // Deep merge updates
  config = deepMerge(config, updates);
  saveConfig();
  
  console.log('[Config] Configuration updated');
  return config;
}

/**
 * Save configuration to disk
 */
function saveConfig() {
  if (!configPath) {
    throw new Error('Config path not set');
  }
  
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[Config] Saved to:', configPath);
  } catch (err) {
    console.error('[Config] Failed to save:', err);
    throw err;
  }
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  
  return output;
}

/**
 * Check if first run is complete
 */
export function isFirstRunComplete() {
  return config?.firstRunComplete || false;
}

/**
 * Mark first run as complete
 */
export function completeFirstRun() {
  updateConfig({ firstRunComplete: true });
}

/**
 * Get API key for a service
 * @param {string} service - Service name ('brave', 'anthropic')
 */
export function getApiKey(service) {
  return config?.apiKeys?.[service] || null;
}

/**
 * Check if research scanner is enabled
 */
export function isResearchScannerEnabled() {
  return config?.researchScanner?.enabled && !!getApiKey('brave');
}

/**
 * Check if cloud sync is enabled
 */
export function isCloudSyncEnabled() {
  return config?.cloudSync?.enabled && 
         !!config?.cloudSync?.supabaseUrl && 
         !!config?.cloudSync?.supabaseAnonKey;
}

/**
 * Export config as environment variables (for legacy code)
 */
export function getConfigAsEnv() {
  const env = {};
  
  if (config?.apiKeys?.brave) {
    env.BRAVE_API_KEY = config.apiKeys.brave;
  }
  
  if (config?.apiKeys?.anthropic) {
    env.ANTHROPIC_API_KEY = config.apiKeys.anthropic;
  }
  
  if (config?.cloudSync?.enabled) {
    env.SUPABASE_URL = config.cloudSync.supabaseUrl;
    env.SUPABASE_ANON_KEY = config.cloudSync.supabaseAnonKey;
  }
  
  return env;
}
