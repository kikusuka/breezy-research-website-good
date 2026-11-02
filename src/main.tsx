import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { initTheme } from './lib/theme';
import { LandingPage } from './landing/LandingPage';
import { PrivacyPage } from './landing/PrivacyPage';
import { PublicLayout } from './landing/PublicLayout';

initTheme();

// The workspace (Firebase, PDF tools, editors) loads only on /app, so the public pages stay light.
const App = lazy(() => import('./App'));

const NotFound = () => (
  <PublicLayout>
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-headline-lg text-4xl">Page not found</h1>
      <p className="mt-3 font-body-md text-body-md text-on-surface-variant">That page does not exist.</p>
      <a href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-label-md text-label-md text-on-primary">Back to Breezy</a>
    </div>
  </PublicLayout>
);

const path = window.location.pathname.replace(/\/+$/, '') || '/';

function Route() {
  if (path === '/app' || path.startsWith('/app/')) {
    return (
      <Suspense fallback={<div className="min-h-[100dvh] grid place-items-center bg-background text-on-surface-variant" role="status">Loading Breezy…</div>}>
        <App />
      </Suspense>
    );
  }
  if (path === '/') return <LandingPage />;
  if (path === '/privacy') return <PrivacyPage />;
  return <NotFound />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Route />);
