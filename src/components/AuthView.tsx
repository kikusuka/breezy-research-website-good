import React, { FormEvent, useState } from 'react';
import { Icon } from '../shell/Icon';
import { authService, isFirebaseConfigured } from '../services/authService';

type Mode = 'signin' | 'create' | 'reset';

function readableAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'That email and password do not match an account.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account already exists with this email. Try signing in.',
    'auth/weak-password': 'Use a stronger password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before it finished.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow popups and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled for Breezy yet.',
    'auth/unauthorized-domain': 'This website domain is not authorized for sign-in yet.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/account-exists-with-different-credential': 'This email is already linked to another sign-in method. Sign in with that method first.',
    'auth/invalid-api-key': 'Firebase sign-in is misconfigured for this deployment. The site administrator needs to check the Firebase client settings.',
    'auth/configuration-not-found': 'Firebase Authentication is not fully configured for this project yet.',
    'auth/invalid-oauth-provider': 'This OAuth provider is not configured for Breezy’s Firebase project yet.',
    'auth/invalid-oauth-client-id': 'This OAuth provider has an invalid client ID in Firebase configuration.',
    'auth/cancelled-popup-request': 'Another sign-in window is already open. Finish it or close it before trying again.',
    'auth/credential-already-in-use': 'This sign-in credential is linked to another Breezy account. Sign in to that account first.',
    'auth/provider-already-linked': 'This sign-in provider is already linked to your Breezy account.',
    'auth/user-disabled': 'This account has been disabled. Contact the Breezy administrator.',
    'auth/invalid-tenant-id': 'This sign-in request points to an invalid Firebase tenant configuration.',
  };
  return messages[code] || (error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
}

export const AuthView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await action();
      if (mode === 'reset') setNotice('If an account exists for that address, a password reset email has been sent.');
    } catch (e) {
      setError(readableAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'reset') return void run(() => authService.sendPasswordReset(email));
    if (mode === 'create') return void run(() => authService.createAccountWithEmail(email, password));
    return void run(() => authService.signInWithEmail(email, password));
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-surface/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="w-full max-w-[440px] relative">
        <button type="button" onClick={onClose} aria-label="Return to guest preview" title="Return to preview" className="absolute -top-12 right-0 w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
          <Icon name="close" className="text-[22px]" />
        </button>
        <div className="rounded-[28px] border border-outline-variant/50 bg-surface-container-low p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="w-11 h-11 rounded-2xl bg-surface-container-high flex items-center justify-center"><Icon name="lock" className="text-[22px] text-primary" /></span>
            <div><div className="font-headline-sm text-headline-sm text-on-surface">Breezy</div><div className="font-body-sm text-body-sm text-on-surface-variant">Your workspace starts here</div></div>
          </div>

          <h1 id="auth-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{mode === 'create' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 mb-6">{mode === 'create' ? 'One account for your research, chat and build work.' : mode === 'reset' ? 'We’ll send a reset link if the email belongs to an account.' : 'Sign in to use Breezy. You can explore the guest preview without an account.'}</p>

          {!isFirebaseConfigured ? (
            <div className="rounded-xl border border-error/30 bg-error-container/20 p-4 text-error font-body-sm text-body-sm" role="alert">
              Authentication is not configured for this deployment yet. Sign-in is unavailable until the Firebase project settings are supplied.
            </div>
          ) : (
            <>
              {mode !== 'reset' && <div className="flex flex-col gap-3 mb-5">
                <button type="button" disabled={busy} onClick={() => void run(() => authService.signInWithGoogle())} className="min-h-12 w-full rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-3 hover:brightness-105 disabled:opacity-50 transition">
                  <span className="w-5 h-5 rounded-full bg-white text-[#4285F4] font-bold flex items-center justify-center text-sm">G</span>
                  Continue with Google
                </button>
                <button type="button" disabled={busy} onClick={() => void run(() => authService.signInWithDiscord())} className="min-h-12 w-full rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-3 hover:bg-surface-container-highest disabled:opacity-50 transition">
                  <Icon name="forum" className="text-[20px]" /> Continue with Discord
                </button>
              </div>}

              {mode !== 'reset' && <div className="flex items-center gap-3 mb-5"><span className="h-px flex-1 bg-outline-variant/50" /><span className="font-label-sm text-label-sm text-outline">OR WITH EMAIL</span><span className="h-px flex-1 bg-outline-variant/50" /></div>}

              <form onSubmit={submit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5"><span className="font-label-md text-label-md text-on-surface-variant">Email address</span>
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full min-h-12 rounded-xl border border-outline-variant/60 bg-surface px-4 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50" /></label>
                {mode !== 'reset' && <label className="flex flex-col gap-1.5"><span className="font-label-md text-label-md text-on-surface-variant">Password</span>
                  <input type="password" required minLength={6} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full min-h-12 rounded-xl border border-outline-variant/60 bg-surface px-4 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50" /></label>}
                {error && <p role="alert" className="rounded-xl border border-error/30 bg-error-container/20 px-3 py-2.5 text-error font-body-sm text-body-sm">{error}</p>}
                {notice && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-on-surface font-body-sm text-body-sm">{notice}</p>}
                <button type="submit" disabled={busy || !email.trim() || (mode !== 'reset' && !password)} className="w-full min-h-12 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md hover:bg-surface-container-high disabled:opacity-50 transition">
                  {busy ? 'Please wait…' : mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in with email'}
                </button>
              </form>
              <div className="mt-5 flex flex-col items-center gap-3 font-body-sm text-body-sm text-on-surface-variant">
                {mode === 'signin' && <><button type="button" onClick={() => { setMode('reset'); setError(null); setNotice(null); }} className="hover:text-primary underline underline-offset-4">Forgot password?</button><p>New to Breezy? <button type="button" onClick={() => { setMode('create'); setError(null); setNotice(null); }} className="text-primary hover:underline underline-offset-4">Create an account</button></p></>}
                {mode === 'create' && <p>Already have an account? <button type="button" onClick={() => { setMode('signin'); setError(null); setNotice(null); }} className="text-primary hover:underline underline-offset-4">Sign in</button></p>}
                {mode === 'reset' && <button type="button" onClick={() => { setMode('signin'); setError(null); setNotice(null); }} className="text-primary hover:underline underline-offset-4">Back to sign in</button>}
              </div>
            </>
          )}
        </div>
        <p className="text-center font-body-sm text-body-sm text-outline mt-5">Google Workspace and GitHub integrations are authorized separately when you choose to use them.</p>
      </div>
    </div>
  );
};
