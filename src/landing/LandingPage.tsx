import React from 'react';
import { PublicLayout } from './PublicLayout';
import { Icon } from '../shell/Icon';

const Pillar: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6">
    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-primary"><Icon name={icon} className="text-[24px]" /></span>
    <h3 className="font-headline-sm text-headline-sm">{title}</h3>
    <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{children}</p>
  </div>
);

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <li className="flex gap-4">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 font-code-sm text-code-sm text-primary">{n}</span>
    <div><div className="font-headline-sm text-headline-sm">{title}</div><p className="font-body-md text-body-md text-on-surface-variant">{children}</p></div>
  </li>
);

export const LandingPage: React.FC = () => (
  <PublicLayout>
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
      <p className="mb-4 font-code-sm text-code-sm uppercase tracking-wider text-primary">AI chat and research you control</p>
      <h1 className="max-w-3xl font-headline-lg text-4xl leading-tight sm:text-5xl">Complicated inside. Calm outside.</h1>
      <p className="mt-5 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
        Breezy is an AI workspace for chat and web research. Bring your own model, keep your data where you choose, and see exactly which sources a research run found.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="/app" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-label-md text-label-md text-on-primary hover:brightness-105 transition">Open Breezy</a>
        <a href="#features" className="inline-flex min-h-12 items-center rounded-xl border border-outline-variant/60 px-6 font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition">See how it works</a>
      </div>
    </section>

    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
      <h2 className="font-headline-md text-headline-md">What you get</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Pillar icon="travel_explore" title="Research with visible sources">Each run searches the web, reads a bounded set of pages and lists what it found. Sources are labelled as found, not as proof that a claim is true, so you can check them yourself.</Pillar>
        <Pillar icon="hub" title="Bring your own model">Use your own API keys for supported providers, any OpenAI-compatible endpoint, or Puter. Models are shown as configured, never invented.</Pillar>
        <Pillar icon="lock" title="Private by design">Chats you keep on your device stay there. Server history, as it rolls out, has a clear per-account limit, and you can delete what is stored whenever you like.</Pillar>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="font-headline-md text-headline-md">How a research run works</h2>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">You ask one question. Breezy does the legwork and shows its work.</p>
        </div>
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Search">Your question goes to the search provider you chose.</Step>
          <Step n={2} title="Read">A limited number of result pages are fetched and cleaned up.</Step>
          <Step n={3} title="Answer">Your configured model writes the answer from what was retrieved.</Step>
          <Step n={4} title="Check">The sources list stays next to the answer so you can open and verify them.</Step>
        </ol>
      </div>
    </section>

    <section id="data" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-outline-variant/40 bg-surface-container-low p-6 sm:p-10">
        <h2 className="font-headline-md text-headline-md">Your data, your storage</h2>
        <p className="mt-3 max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Breezy keeps your work on your device by default. Server history is rolling out: when it is on, each account gets a small allowance that is shown in Settings. When it fills up, Breezy tells you plainly. Delete conversations to make room, or use your own storage such as Google Drive.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3 font-body-md text-body-md">
          <li className="flex gap-2"><Icon name="check_circle" className="text-[20px] text-primary" /> Allowance and real usage shown in Settings</li>
          <li className="flex gap-2"><Icon name="check_circle" className="text-[20px] text-primary" /> Deleting removes the data for good</li>
          <li className="flex gap-2"><Icon name="check_circle" className="text-[20px] text-primary" /> Your Google Drive is connected only if you choose</li>
        </ul>
        <a href="/privacy" className="mt-6 inline-block text-primary underline underline-offset-4">Read the privacy details</a>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
      <h2 className="font-headline-md text-headline-md">On the way</h2>
      <p className="mt-2 max-w-2xl font-body-md text-body-md text-on-surface-variant">
        A Breezy language model is in development and is not available yet. When it is released it will appear in the model list like any other provider. Build and Canvas workspaces are in early access and still changing.
      </p>
      <a href="/app" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-label-md text-label-md text-on-primary hover:brightness-105 transition">Open Breezy</a>
    </section>
  </PublicLayout>
);
