/**
 * CancerProfileContext
 * Provides the selected cancer profile throughout the app.
 * Selection is persisted to localStorage under the key `mrt_cancer_profile_id`.
 * Backward compatible: defaults to 'urothelial_carcinoma' when no value is stored.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CANCER_PROFILES, getCancerProfile, listCancerProfiles } from '../models/cancerProfiles';

const LS_KEY = 'mrt_cancer_profile_id';
const DEFAULT_PROFILE = 'urothelial_carcinoma';

const CancerProfileContext = createContext(null);

export function CancerProfileProvider({ children }) {
  const [profileId, setProfileId] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) || DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const profile = getCancerProfile(profileId) || getCancerProfile(DEFAULT_PROFILE);

  const selectProfile = useCallback((id) => {
    if (!CANCER_PROFILES[id]) return;
    setProfileId(id);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch (e) {
      console.warn('[CancerProfileContext] localStorage write failed:', e);
    }
  }, []);

  const value = {
    profileId,
    profile,
    profiles: listCancerProfiles(),
    selectProfile,
  };

  return (
    <CancerProfileContext.Provider value={value}>
      {children}
    </CancerProfileContext.Provider>
  );
}

export function useCancerProfile() {
  const ctx = useContext(CancerProfileContext);
  if (!ctx) throw new Error('useCancerProfile must be used inside CancerProfileProvider');
  return ctx;
}
