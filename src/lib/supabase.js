import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing configuration. Cloud features disabled.');
}

// Create Supabase client (handles auth, database, storage)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Helper: Check if cloud features are available
export const isCloudEnabled = () => {
  return supabase !== null && navigator.onLine;
};

// Helper: Get current user
export const getCurrentUser = async () => {
  if (!supabase) return null;
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper: Check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return user !== null;
};

export default supabase;
