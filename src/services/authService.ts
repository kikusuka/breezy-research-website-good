import { accountStorage } from './accountStorage';
/**
 * Firebase Authentication Service
 * Provides real Google and GitHub OAuth authentication with incremental and narrow scopes
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithPopup,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

let firebaseConfig: any = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// If no environment variables are set, fallback to imported JSON if available
if (!firebaseConfig.apiKey) {
  try {
    // @ts-ignore
    const fileConfig = (await import('../../firebase-applet-config.json')).default;
    firebaseConfig = { ...firebaseConfig, ...fileConfig };
  } catch (e) {
    // Left unconfigured (empty strings) rather than loading faked placeholders
    firebaseConfig = {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };
  }
}

// Ensure clean check of whether Firebase config is real and fully initialized
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId &&
  !firebaseConfig.apiKey.includes('Placeholder') &&
  !firebaseConfig.apiKey.includes('MockKey')
);

// Initialize Firebase only if config is real and available
let app: any = null;
let auth: any = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  // Safe mock auth interface to prevent crashes when other pages/scripts import/reference auth
  auth = {
    currentUser: null,
    onAuthStateChanged: (callback: any) => {
      callback(null);
      return () => {};
    },
    signOut: async () => {}
  };
}

// Google provider with profile and drive.file scopes
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId?: string | null;
}

// In-memory token cache with timestamp
let cachedAccessToken: string | null = null;
let tokenIssuedAt: number = 0;
let cachedTokenUid: string | null = null;
const googleTokenKey = (uid: string) => `synthexis_g_token:${uid}`;
const googleTokenTimeKey = (uid: string) => `synthexis_g_token_time:${uid}`;
const TOKEN_TTL_MS = 3500 * 1000; // 3500s (~58 mins, safety buffer before 3600s Google expiry)

export const authService = {
  /**
   * Check if token is expired or close to expiration
   */
  isTokenExpired(): boolean {
    if (!cachedAccessToken) return true;
    if (!tokenIssuedAt) return false;
    return Date.now() - tokenIssuedAt > TOKEN_TTL_MS;
  },

  /**
   * Sign in to Breezy with Google. Workspace permissions are requested separately when needed.
   */
  async signInWithGoogle(): Promise<{ user: AuthUser; accessToken: string } | null> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase Authentication is unconfigured.');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      // Account sign-in must not silently double as Google Workspace authorization.
      // Workspace access tokens are acquired separately through requestWorkspaceScopes().
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accountAccessToken = credential?.accessToken || '';

      return {
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          providerId: user.providerData[0]?.providerId || null
        },
        accessToken: accountAccessToken
      };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  },

  /** Sign in with email and password. */
  async signInWithEmail(email: string, password: string): Promise<void> {
    if (!isFirebaseConfigured) throw new Error('Firebase Authentication is unconfigured.');
    await signInWithEmailAndPassword(auth, email.trim(), password);
  },

  /** Create a Breezy account with email and password. */
  async createAccountWithEmail(email: string, password: string): Promise<void> {
    if (!isFirebaseConfigured) throw new Error('Firebase Authentication is unconfigured.');
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  },

  /** Send a password reset email. */
  async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured) throw new Error('Firebase Authentication is unconfigured.');
    await sendPasswordResetEmail(auth, email.trim());
  },

  /** Sign in with Discord through a Firebase Authentication OIDC provider. */
  async signInWithDiscord(): Promise<void> {
    if (!isFirebaseConfigured) throw new Error('Firebase Authentication is unconfigured.');
    // Configure provider ID oidc.discord in Firebase Authentication / Identity Platform.
    const provider = new OAuthProvider('oidc.discord');
    provider.addScope('identify');
    provider.addScope('email');
    await signInWithPopup(auth, provider);
  },
  /**
   * Request incremental Google Workspace scopes (Drive, Gmail, Calendar, Docs, Sheets) when the user opens the feature
   */
  async requestWorkspaceScopes(scopes: string[]): Promise<string | null> {
    if (!isFirebaseConfigured) {
      return null;
    }
    try {
      const incrementalProvider = new GoogleAuthProvider();
      for (const scope of scopes) {
        incrementalProvider.addScope(scope);
      }
      incrementalProvider.setCustomParameters({ prompt: 'consent' });

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Sign in to Breezy before connecting Google Workspace.');
      const googleAlreadyLinked = currentUser.providerData.some((provider: { providerId: string }) => provider.providerId === 'google.com');
      // Link Google to the existing Breezy account or reauthenticate the existing Google account.
      // Never call signInWithPopup here: that could silently replace an email/Discord Breezy session.
      const result = googleAlreadyLinked
        ? await reauthenticateWithPopup(currentUser, incrementalProvider)
        : await linkWithPopup(currentUser, incrementalProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        cachedAccessToken = token;
        tokenIssuedAt = Date.now();
        cachedTokenUid = auth.currentUser?.uid || null;
        if (cachedTokenUid) {
          sessionStorage.setItem(googleTokenKey(cachedTokenUid), token);
          sessionStorage.setItem(googleTokenTimeKey(cachedTokenUid), String(tokenIssuedAt));
        }
      }
      return token;
    } catch (error: any) {
      console.error('Incremental scope request error:', error);
      return null;
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    if (!isFirebaseConfigured) {
      cachedAccessToken = null;
      tokenIssuedAt = 0;
      cachedTokenUid = null;
      sessionStorage.clear();
      return;
    }
    try {
      await signOut(auth);
      cachedAccessToken = null;
      tokenIssuedAt = 0;
      cachedTokenUid = null;
      sessionStorage.clear();
    } catch (error: any) {
      console.error('Sign-out error:', error);
      throw new Error('Failed to sign out');
    }
  },

  /**
   * Listen for auth state changes
   */
  onAuthChange(callback: (user: AuthUser | null, token: string | null) => void): () => void {
    if (!isFirebaseConfigured) {
      callback(null, null);
      return () => {};
    }
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        if (cachedTokenUid !== firebaseUser.uid) {
          cachedAccessToken = sessionStorage.getItem(googleTokenKey(firebaseUser.uid));
          const storedTime = sessionStorage.getItem(googleTokenTimeKey(firebaseUser.uid));
          tokenIssuedAt = storedTime ? Number(storedTime) : 0;
          cachedTokenUid = firebaseUser.uid;
        }
        // Discard pre-account tokens written by older builds.
        sessionStorage.removeItem('synthexis_g_token');
        sessionStorage.removeItem('synthexis_g_token_time');
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          providerId: firebaseUser.providerData[0]?.providerId || null
        }, cachedAccessToken);
      } else {
        cachedAccessToken = null;
        tokenIssuedAt = 0;
        cachedTokenUid = null;
        callback(null, null);
      }
    });
  },

  /**
   * Get cached access token
   */
  getAccessToken(): string | null {
    const uid = auth.currentUser?.uid || null;
    if (!uid) {
      cachedAccessToken = null;
      tokenIssuedAt = 0;
      cachedTokenUid = null;
      return null;
    }
    if (cachedTokenUid !== uid) {
      cachedAccessToken = sessionStorage.getItem(googleTokenKey(uid));
      const storedTime = sessionStorage.getItem(googleTokenTimeKey(uid));
      tokenIssuedAt = storedTime ? Number(storedTime) : 0;
      cachedTokenUid = uid;
    }
    return cachedAccessToken;
  },

  /**
   * Manually set access token
   */
  setAccessToken(token: string | null) {
    const uid = auth.currentUser?.uid || null;
    cachedAccessToken = uid ? token : null;
    tokenIssuedAt = token ? Date.now() : 0;
    cachedTokenUid = uid;
    if (uid && token) {
      sessionStorage.setItem(googleTokenKey(uid), token);
      sessionStorage.setItem(googleTokenTimeKey(uid), String(tokenIssuedAt));
    } else if (uid) {
      sessionStorage.removeItem(googleTokenKey(uid));
      sessionStorage.removeItem(googleTokenTimeKey(uid));
    }
  },

  /** Get a fresh Firebase ID token for authenticated backend requests. */
  async getIdToken(): Promise<string | null> {
    if (!isFirebaseConfigured || !auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  },

  /**
   * Get current user synchronously
   */
  getCurrentUser(): AuthUser | null {
    if (!isFirebaseConfigured) {
      return null;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified
    };
  },

  /**
   * Sign in with GitHub popup using the narrowest scope (public_repo instead of full repo)
   */
  async signInWithGithub(): Promise<{ user: AuthUser; accessToken: string } | null> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase Authentication is unconfigured.');
    }
    try {
      const githubProvider = new GithubAuthProvider();
      githubProvider.addScope('public_repo');
      githubProvider.addScope('read:user');
      
      const result = await signInWithPopup(auth, githubProvider);
      const user = result.user;
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      
      if (token) {
        accountStorage.setItem('breezy_github_token', token);
      }

      return {
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          providerId: user.providerData[0]?.providerId || null
        },
        accessToken: token || ''
      };
    } catch (error: any) {
      console.error('GitHub sign-in error:', error);
      throw new Error(error.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled'
        : 'Failed to sign in with GitHub OAuth');
    }
  }
};

export { auth };
