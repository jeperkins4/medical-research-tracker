import { supabase, isCloudEnabled } from '../lib/supabase';

/**
 * Cloud Authentication Service
 * 
 * Hybrid approach:
 * - Local auth is primary (always works offline)
 * - Cloud auth is optional (enables multi-device sync)
 * 
 * Strategy:
 * 1. User logs in locally (existing bcrypt check)
 * 2. If online + Supabase configured, sync to cloud
 * 3. Create/update cloud session for settings sync
 */

class CloudAuthService {
  constructor() {
    this.syncEnabled = false;
    this.currentUser = null;
  }

  /**
   * Initialize cloud auth (check for existing session)
   */
  async initialize() {
    if (!isCloudEnabled()) {
      console.log('[CloudAuth] Disabled (offline or not configured)');
      return { enabled: false };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        this.currentUser = session.user;
        this.syncEnabled = true;
        console.log('[CloudAuth] Session restored:', session.user.email);
        return { enabled: true, user: session.user };
      }

      console.log('[CloudAuth] No active session');
      return { enabled: true, user: null };
    } catch (error) {
      console.error('[CloudAuth] Initialize failed:', error);
      return { enabled: false, error };
    }
  }

  /**
   * Sync local login to cloud (after successful local auth)
   * 
   * @param {string} email - User email (from local username)
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async syncLoginToCloud(email, password) {
    if (!isCloudEnabled()) {
      return { success: false, reason: 'offline' };
    }

    try {
      // Attempt to sign in
      let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // If user doesn't exist in cloud yet, create account
      if (error?.message?.includes('Invalid login credentials')) {
        console.log('[CloudAuth] User not in cloud, creating account...');
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              created_from: 'mytreatmentpath_desktop',
              created_at: new Date().toISOString()
            }
          }
        });

        if (signUpError) {
          console.error('[CloudAuth] Signup failed:', signUpError);
          return { success: false, error: signUpError.message };
        }

        data = signUpData;
        console.log('[CloudAuth] Account created');
      } else if (error) {
        console.error('[CloudAuth] Login failed:', error);
        return { success: false, error: error.message };
      }

      this.currentUser = data.user;
      this.syncEnabled = true;

      console.log('[CloudAuth] Synced to cloud:', data.user.email);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('[CloudAuth] Sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out from cloud (keeps local auth intact)
   */
  async signOutCloud() {
    if (!isCloudEnabled()) return;

    try {
      await supabase.auth.signOut();
      this.currentUser = null;
      this.syncEnabled = false;
      console.log('[CloudAuth] Signed out from cloud');
    } catch (error) {
      console.error('[CloudAuth] Sign out failed:', error);
    }
  }

  /**
   * Get current cloud user
   */
  async getCurrentUser() {
    if (!isCloudEnabled()) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('[CloudAuth] Get user failed:', error);
      return null;
    }
  }

  /**
   * Check if cloud sync is enabled
   */
  isSyncEnabled() {
    return this.syncEnabled && isCloudEnabled();
  }

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback) {
    if (!isCloudEnabled()) return () => {};

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[CloudAuth] State change:', event);
      
      this.currentUser = session?.user || null;
      this.syncEnabled = !!session;
      
      callback(event, session);
    });

    return () => subscription.unsubscribe();
  }

  /**
   * Update user metadata
   */
  async updateUserMetadata(metadata) {
    if (!this.isSyncEnabled()) return { success: false };

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata
      });

      if (error) throw error;

      console.log('[CloudAuth] Metadata updated');
      return { success: true, user: data.user };
    } catch (error) {
      console.error('[CloudAuth] Update metadata failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Request password reset email
   */
  async requestPasswordReset(email) {
    if (!isCloudEnabled()) return { success: false };

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      console.log('[CloudAuth] Password reset email sent');
      return { success: true };
    } catch (error) {
      console.error('[CloudAuth] Password reset failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
export const cloudAuth = new CloudAuthService();

export default cloudAuth;
