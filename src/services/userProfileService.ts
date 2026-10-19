/**
 * User Profile & Authorization Service
 * Manages user identity, display name, research role, and authorization credentials.
 */

export interface UserProfile {
  displayName: string;
  email: string;
  roleTitle: string;
  organization: string;
  photoURL?: string;
  authorizationType: 'google_oauth' | 'github_oauth' | 'session_enclave' | 'guest';
  autoSaveToDrive: boolean;
}

const PROFILE_STORAGE_KEY = 'breezy_user_profile';

export const userProfileService = {
  getProfile(): UserProfile {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          displayName: parsed.displayName || '',
          email: parsed.email || '',
          roleTitle: parsed.roleTitle || '',
          organization: parsed.organization || '',
          photoURL: parsed.photoURL || undefined,
          authorizationType: parsed.authorizationType || 'guest',
          autoSaveToDrive: Boolean(parsed.autoSaveToDrive),
        };
      }
    } catch {}

    return {
      displayName: '',
      email: '',
      roleTitle: '',
      organization: '',
      authorizationType: 'guest',
      autoSaveToDrive: false,
    };
  },

  saveProfile(profile: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const updated: UserProfile = { ...current, ...profile };
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save user profile:', e);
    }
    return updated;
  },
};
