/**
 * Global Error Handler & Process Hardening
 * 
 * Prevents server crashes from unhandled errors
 * Logs all errors for debugging
 * Graceful shutdown on critical failures
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logsDir = join(__dirname, '..', 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const errorLogPath = join(logsDir, 'errors.log');
const crashLogPath = join(logsDir, 'crashes.log');

/**
 * Log error to file
 */
function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    },
    context,
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  };
  
  try {
    appendFileSync(errorLogPath, JSON.stringify(logEntry) + '\n');
  } catch (writeErr) {
    console.error('[Error Logger] Failed to write to log file:', writeErr.message);
  }
}

/**
 * Log crash event
 */
function logCrash(error, origin) {
  const timestamp = new Date().toISOString();
  const crashEntry = {
    timestamp,
    origin,
    error: {
      message: error?.message || String(error),
      stack: error?.stack,
      name: error?.name,
      code: error?.code
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    }
  };
  
  try {
    appendFileSync(crashLogPath, JSON.stringify(crashEntry) + '\n');
  } catch (writeErr) {
    console.error('[Crash Logger] Failed to write to crash log:', writeErr.message);
  }
}

/**
 * Handle uncaught exceptions
 */
export function handleUncaughtException(error) {
  console.error('\n❌ UNCAUGHT EXCEPTION - Server will attempt recovery\n');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  
  logCrash(error, 'uncaughtException');
  
  // Don't exit immediately - try to recover
  console.error('\n⚠️  Process continuing... Monitor for stability issues.\n');
}

/**
 * Handle unhandled promise rejections
 */
export function handleUnhandledRejection(reason, promise) {
  console.error('\n❌ UNHANDLED PROMISE REJECTION - Server will attempt recovery\n');
  console.error('Reason:', reason);
  
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logCrash(error, 'unhandledRejection');
  
  console.error('\n⚠️  Process continuing... Monitor for stability issues.\n');
}

/**
 * Handle SIGTERM (graceful shutdown)
 */
export function handleSIGTERM(server) {
  console.log('\n⚠️  SIGTERM received - Starting graceful shutdown...\n');
  
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

/**
 * Handle SIGINT (Ctrl+C)
 */
export function handleSIGINT(server) {
  console.log('\n⚠️  SIGINT received (Ctrl+C) - Shutting down gracefully...\n');
  
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
  
  // Force shutdown after 5 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

/**
 * Handle memory warnings
 */
export function monitorMemory() {
  const MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500 MB
  const MEMORY_CRITICAL_THRESHOLD = 1024 * 1024 * 1024; // 1 GB
  
  setInterval(() => {
    const usage = process.memoryUsage();
    
    if (usage.heapUsed > MEMORY_CRITICAL_THRESHOLD) {
      console.error('❌ CRITICAL: Memory usage exceeded 1GB:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
      logError(new Error('Critical memory usage'), { memory: usage });
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('🔄 Running garbage collection...');
        global.gc();
      }
    } else if (usage.heapUsed > MEMORY_WARNING_THRESHOLD) {
      console.warn('⚠️  WARNING: Memory usage exceeded 500MB:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
    }
  }, 60000); // Check every minute
}

/**
 * Express error handling middleware
 */
export function expressErrorHandler(err, req, res, next) {
  console.error('\n❌ Express Error Handler Caught:\n');
  console.error('URL:', req.method, req.originalUrl);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Don't expose stack traces to client in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs = 30000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error('⏱️  Request timeout:', req.method, req.originalUrl);
        logError(new Error('Request timeout'), {
          url: req.originalUrl,
          method: req.method,
          timeout: timeoutMs
        });
        res.status(408).json({ error: 'Request timeout' });
      }
    }, timeoutMs);
    
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}

/**
 * Initialize all error handlers
 */
export function initializeErrorHandlers(server) {
  // Uncaught exceptions
  process.on('uncaughtException', handleUncaughtException);
  
  // Unhandled promise rejections
  process.on('unhandledRejection', handleUnhandledRejection);
  
  // Graceful shutdown signals
  process.on('SIGTERM', () => handleSIGTERM(server));
  process.on('SIGINT', () => handleSIGINT(server));
  
  // Memory monitoring
  monitorMemory();
  
  console.log('✅ Global error handlers initialized');
  console.log(`   Error log: ${errorLogPath}`);
  console.log(`   Crash log: ${crashLogPath}`);
}

/**
 * Get recent errors
 */
export function getRecentErrors(count = 10) {
  try {
    if (!existsSync(errorLogPath)) {
      return [];
    }
    
    const content = readFileSync(errorLogPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const errors = lines
      .slice(-count)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    
    return errors;
  } catch (error) {
    console.error('Failed to read error log:', error.message);
    return [];
  }
}
