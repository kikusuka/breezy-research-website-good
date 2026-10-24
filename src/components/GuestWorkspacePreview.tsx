import React from 'react';
import { ActiveTab, TITLES } from '../lib/nav';
import { Icon } from '../shell/Icon';

const DESCRIPTIONS: Record<ActiveTab, string> = {
  research: 'Investigate a question using web search, bounded source retrieval, and one configured research model.',
  chat: 'A focused workspace for conversations with your chosen model.',
  build: 'Edit and preview projects. Connecting GitHub is optional and only needed for GitHub-specific actions.',
  canvas: 'Organize ideas, findings and code into a visual board.',
  notes: 'Keep a personal Markdown scratchpad alongside your work.',
  models: 'Configure your own providers and choose the model Breezy should use.',
  history: 'Review your previous conversations and research sessions.',
  docs: 'Learn how the Breezy workspaces fit together.',
  settings: 'Adjust research behavior and workspace preferences.',
  profile: 'Manage your Breezy account and external integrations.',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-4 sm:p-5">
    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">{title}</h3>
    {children}
  </section>
);

const DisabledLine = ({ label }: { label: string }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-outline-variant/20 last:border-0">
    <span className="font-body-md text-body-md text-on-surface-variant">{label}</span>
    <span className="font-label-sm text-label-sm text-outline rounded-lg bg-surface-container-high px-2 py-1">Preview</span>
  </div>
);

export const GuestWorkspacePreview: React.FC<{ tab: ActiveTab }> = ({ tab }) => (
  <div className="min-h-full max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="min-w-0">
        <div className="font-label-sm text-label-sm uppercase tracking-widest text-outline mb-2">Workspace preview</div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{TITLES[tab]}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-2xl">{DESCRIPTIONS[tab]}</p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
        <Icon name="visibility" className="text-[16px]" /> Guest preview
      </span>
    </div>

    {tab === 'chat' && <div className="min-h-[420px] rounded-3xl border border-outline-variant/35 bg-surface-container-low flex flex-col items-center justify-center p-6 text-center">
      <span className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-4"><Icon name="chat_bubble_outline" className="text-[28px]" /></span>
      <h2 className="font-headline-md text-headline-md text-on-surface">A clear space to think</h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-md">Your conversations will appear here after you sign in and start using Breezy.</p>
      <div className="w-full max-w-2xl mt-10 rounded-2xl border border-outline-variant/40 bg-surface px-4 py-3 flex items-center gap-3 text-left">
        <span className="flex-1 font-body-md text-body-md text-outline">Message Breezy…</span><Icon name="arrow_upward" className="text-[20px] text-outline" />
      </div>
    </div>}

    {tab === 'research' && <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
      <Section title="Research question"><div className="min-h-28 rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-outline">Enter a question to investigate…</div><div className="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container p-4"><div className="flex items-center gap-2 font-label-md text-label-md text-on-surface"><Icon name="psychology" className="text-[18px] text-primary" /> One configured research model</div><p className="font-body-sm text-body-sm text-on-surface-variant mt-2">Breezy creates a local research plan, gathers web results, retrieves a small number of readable pages, then makes one answer-generation call with the available evidence. Search and page retrieval are grounding steps, not extra model calls.</p></div></Section>
      <Section title="Research workflow"><DisabledLine label="Source discovery" /><DisabledLine label="Evidence review" /><DisabledLine label="Synthesis" /><p className="font-body-sm text-body-sm text-outline mt-3">No research is running in preview mode.</p></Section>
    </div>}

    {tab === 'build' && <div className="grid lg:grid-cols-[220px_1fr] gap-4 min-h-[380px]">
      <Section title="Project files"><div className="flex flex-col items-center text-center py-8"><Icon name="folder_open" className="text-[28px] text-outline" /><p className="font-body-sm text-body-sm text-on-surface-variant mt-3">Connect or create a project after signing in.</p></div></Section>
      <Section title="Editor"><div className="min-h-64 rounded-xl bg-surface px-4 py-4 font-code-sm text-code-sm text-outline"><div>/* Your editor opens here. */</div><div className="mt-2">/* GitHub sign-in is not required for local IDE use. */</div></div></Section>
    </div>}

    {tab === 'canvas' && <Section title="Your board"><div className="min-h-64 flex flex-col items-center justify-center text-center"><Icon name="dashboard" className="text-[30px] text-outline" /><p className="font-body-md text-body-md text-on-surface-variant mt-3">Your board starts empty. Add cards when you’re signed in.</p></div></Section>}

    {tab === 'notes' && <div className="grid sm:grid-cols-[220px_1fr] gap-4 min-h-[340px]"><Section title="Notes"><p className="font-body-sm text-body-sm text-on-surface-variant">No guest notes are created.</p></Section><Section title="Markdown editor"><div className="min-h-56 rounded-xl bg-surface px-4 py-3 font-code-sm text-code-sm text-outline">Your note preview appears here.</div></Section></div>}

    {tab === 'models' && <div className="grid sm:grid-cols-2 gap-4"><Section title="Model providers"><DisabledLine label="Google Gemini" /><DisabledLine label="Anthropic" /><DisabledLine label="Groq" /><DisabledLine label="OpenRouter" /></Section><Section title="Default model"><p className="font-body-md text-body-md text-on-surface-variant">No model is selected in this preview. Sign in to connect a provider and choose a model.</p></Section></div>}

    {tab === 'history' && <Section title="Saved history"><div className="min-h-56 flex flex-col items-center justify-center text-center"><Icon name="history" className="text-[30px] text-outline" /><p className="font-body-md text-body-md text-on-surface-variant mt-3">Your own history appears here after sign-in.</p></div></Section>}

    {tab === 'docs' && <Section title="Breezy documentation"><p className="font-body-md text-body-md text-on-surface-variant">Workspace guides explain Chat, Research, Build, Canvas, Notes and model configuration.</p><div className="mt-3"><DisabledLine label="Workspace guides" /><DisabledLine label="Provider setup" /><DisabledLine label="Privacy and data" /></div></Section>}

    {tab === 'settings' && <div className="grid sm:grid-cols-2 gap-4"><Section title="Research behavior"><DisabledLine label="Search engine" /><DisabledLine label="Research method" /><DisabledLine label="Keep-alive interval" /></Section><Section title="Workspace preferences"><DisabledLine label="Model defaults" /><DisabledLine label="Storage preferences" /><p className="font-body-sm text-body-sm text-outline mt-3">Settings are not loaded or changed in preview mode.</p></Section></div>}

    {tab === 'profile' && <Section title="Breezy account"><div className="flex items-center gap-3"><span className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary"><Icon name="person_outline" className="text-[24px]" /></span><div><p className="font-headline-sm text-headline-sm text-on-surface">Not signed in</p><p className="font-body-sm text-body-sm text-on-surface-variant">Your account details stay hidden in guest preview.</p></div></div></Section>}
  </div>
);
