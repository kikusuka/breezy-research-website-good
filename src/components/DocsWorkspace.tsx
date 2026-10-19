import React, { useState } from 'react';
import { Page } from '../ui/Page';
import { Icon } from '../shell/Icon';

const DOCS: Array<{ id: string; icon: string; title: string; blurb: string; body: React.ReactNode }> = [
  { id: 'start', icon: 'rocket_launch', title: 'Getting started', blurb: 'Connect a model and run your first inquiry', body: (<><p>Breezy needs at least one model. Open <a href="#models">Models</a>, paste a provider key (or point to a local Ollama server) and test it.</p><ol><li>Add a key for any provider, or set up Ollama.</li><li>Open <a href="#research">Research</a>, write a question and press Initiate Synthesis.</li><li>Watch the stages fill in as the models work. The result is saved to <a href="#history">History</a> on this device.</li></ol><p>For a quick back-and-forth without the multi-step pipeline, use <a href="#chat">Chat</a>.</p></>) },
  { id: 'depth', icon: 'account_tree', title: 'Depth and seats', blurb: 'Solo, Standard and Deep', body: (<><p>Each research run assigns work to seats. You choose the depth:</p><ul><li><b>Solo</b>: one model answers in a single pass.</li><li><b>Standard</b>: analyst proposes, critic challenges, synthesizer writes the brief.</li><li><b>Deep</b>: adds an independent verifier that checks claims against retrieved sources before the synthesis.</li></ul><p>Seats can use different models. Assign them in Models, or use the Fast, Balanced and Deep presets.</p></>) },
  { id: 'evidence', icon: 'verified', title: 'Sources and claims', blurb: 'What “evidence” means here', body: (<><p>When web search is on, Breezy retrieves sources for your question and lists them with the answer. Claims are marked <b>supported</b>, <b>contradicted</b> or <b>unresolved</b> with a confidence value from the verifying model.</p><p>This is model-assisted checking, not proof. A “supported” claim means the retrieved material backed it up, not that it is true. Open the sources and read them for anything important.</p><p>Breezy does not resolve DOIs or parse arXiv papers on its own. PDFs and text files you attach are read and passed to the models.</p></>) },
  { id: 'models', icon: 'hub', title: 'Models and keys', blurb: 'Providers, Ollama, custom model IDs', body: (<><p>Supported providers: Google Gemini, Anthropic, Groq, SambaNova, OpenRouter, any OpenAI-compatible endpoint, and local Ollama.</p><p>The built-in model list can go out of date. In Models, choose “Custom model ID” for a seat to type any model name your provider accepts.</p><p>Keys are saved in this browser’s local storage and sent with your requests to the provider you picked. There is no server-side key vault. Do not enter keys on a shared computer.</p></>) },
  { id: 'build', icon: 'terminal', title: 'Build (IDE)', blurb: 'GitHub repositories in the browser', body: (<><p>Build connects to a GitHub repository with a personal access token, shows its files, and lets you edit and commit. It can run Python (downloaded on first use) and JavaScript in the browser, preview HTML, and ask your model to propose edits.</p><ul><li>The output panel is a console, not a shell. There is no terminal.</li><li>Commits go to the repository’s default branch.</li><li>Long-running Python can freeze the tab.</li></ul></>) },
  { id: 'data', icon: 'shield', title: 'Your data', blurb: 'Where things are stored', body: (<><p>Research sessions, chat history, Canvas cards, Notes, settings and keys live in this browser’s local storage. Clearing site data erases them. Export anything you want to keep from History, or save to Google Docs.</p><p>Prompts and attached text are sent to the model providers you configure through this app’s server in order to get answers. Review each provider’s data policy. Breezy does not promise zero retention on their side.</p></>) },
];

export const DocsWorkspace: React.FC = () => {
  const [id, setId] = useState(DOCS[0].id); const cur = DOCS.find((d) => d.id === id)!;
  return (
    <Page crumb="Docs" title="Docs" subtitle="How Breezy works and where its limits are.">
      <div className="grid lg:grid-cols-[260px_1fr] gap-space-lg items-start">
        <nav aria-label="Docs sections" className="flex lg:flex-col gap-space-xs overflow-x-auto no-scrollbar -mx-gutter px-gutter lg:mx-0 lg:px-0 lg:sticky lg:top-space-lg">
          {DOCS.map((d) => { const on = d.id === id; return (
            <button key={d.id} type="button" aria-current={on ? 'page' : undefined} onClick={() => setId(d.id)} className={`shrink-0 flex items-center gap-space-sm text-left rounded-2xl px-space-md min-h-[48px] transition-colors ${on ? 'bg-surface-container-high text-primary' : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
              <Icon name={d.icon} className="text-[20px]" fill={on} /><span className="font-label-md text-label-md whitespace-nowrap lg:whitespace-normal">{d.title}</span></button>); })}
        </nav>
        <article className="bg-surface-container rounded-3xl coat p-space-lg lg:p-space-xl min-h-[320px]">
          <div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">{cur.blurb}</div>
          <h2 className="font-headline-lg text-headline-lg mt-1 mb-space-md">{cur.title}</h2>
          <div className="font-body-md text-body-md text-on-surface-variant leading-[1.7] max-w-2xl [&_p]:mb-space-md [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-space-lg [&_ol]:pl-space-lg [&_li]:mb-space-xs [&_b]:text-on-surface [&_a]:text-secondary [&_a:hover]:text-primary [&_a]:underline [&_a]:underline-offset-2">{cur.body}</div>
        </article>
      </div>
    </Page>
  );
};
