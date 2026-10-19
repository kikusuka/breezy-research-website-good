import React, { useState } from 'react';
import { Icon } from '../shell/Icon';
import { BreezyLogo } from './BreezyLogo';

interface LandingViewProps { onStartSearchWithQuery: (query: string) => void; }
const go = (tab: string) => { window.location.hash = `#${tab}`; };
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const PILLARS = [
  { n: '01', icon: 'hub', tone: 'text-primary', title: 'Multi-angle exploration', seat: 'Analyst', body: 'The analyst seat drafts a first proposal and, when search is on, works from sources retrieved for your question rather than from memory alone.' },
  { n: '02', icon: 'gavel', tone: 'text-secondary', title: 'Adversarial challenge', seat: 'Critic', body: 'A second model is asked to attack the proposal: unstated assumptions, weak evidence, counterexamples. Disagreement stays visible instead of being averaged away.' },
  { n: '03', icon: 'verified', tone: 'text-tertiary', title: 'Evidence check', seat: 'Verifier · Deep mode', body: 'In Deep mode an independent verifier checks the claims against the retrieved sources. Each claim is marked supported, contradicted or unresolved.' },
  { n: '04', icon: 'auto_stories', tone: 'text-primary', title: 'Calm synthesis', seat: 'Synthesizer', body: 'The final seat writes an answer-first brief that says what is settled, what is contested and what remains uncertain.' },
];
const COMPARE = [
  ['Reasoning', 'One model, one monologue', 'Separate seats propose, challenge, verify and synthesize'],
  ['Sources', 'Usually none, or unchecked links', 'Web search results are retrieved and listed with the answer (research mode)'],
  ['Disagreement', 'Smoothed into one confident voice', 'Critic objections and contradicted claims are shown'],
  ['Models', 'Whatever the product ships', 'Your own keys, per seat, including local Ollama'],
  ['Output', 'A chat transcript', 'Markdown or PDF export, Google Docs, pin to Canvas'],
];
const STAGES = [
  ['01 · Proposal', 'Hypotheses drafted'], ['02 · Challenge', 'Assumptions flagged'], ['03 · Evidence', 'Claims checked'], ['04 · Synthesis', 'Brief written'],
];

export const LandingView: React.FC<LandingViewProps> = ({ onStartSearchWithQuery }) => {
  const [q, setQ] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); onStartSearchWithQuery(q.trim()); };
  return (
    <div className="relative min-h-screen bg-surface text-on-surface overflow-x-hidden splatter">
      {/* ───────── Nav ───────── */}
      <header className="fixed top-0 inset-x-0 z-50 pt-safe bg-surface/75 backdrop-blur-xl shadow-[0_1px_0_rgba(61,73,77,0.35)]">
        <div className="max-w-7xl mx-auto h-16 px-gutter lg:px-space-xl flex items-center justify-between gap-space-md">
          <a href="#landing" className="flex items-center gap-space-sm"><BreezyLogo size={30} /><span className="font-headline-sm text-headline-sm tracking-tight">Breezy</span><span className="hidden sm:inline font-code-sm text-code-sm text-primary bg-surface-container-highest px-space-xs py-0.5 rounded">v3.0</span></a>
          <nav className="hidden md:flex items-center gap-space-xl font-label-md text-label-md text-on-surface-variant" aria-label="Sections">
            {[['Product', 'product'], ['Methodology', 'method'], ['Compare', 'compare'], ['Your keys', 'keys']].map(([l, id]) => <button key={id} type="button" onClick={() => scrollTo(id)} className="hover:text-on-surface transition-colors">{l}</button>)}
            <button type="button" onClick={() => go('docs')} className="hover:text-on-surface transition-colors">Docs</button>
          </nav>
          <button type="button" onClick={() => go('research')} className="flex items-center gap-space-xs bg-primary hover:bg-primary-fixed text-on-primary font-label-md text-label-md px-space-md min-h-[40px] rounded-xl transition-colors">Open workspace<Icon name="arrow_forward" className="text-[16px]" /></button>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative pt-36 pb-space-xl px-gutter lg:px-space-xl text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] [background:radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(0,180,216,0.22),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto flex flex-col items-center gap-space-lg">
          <span className="inline-flex items-center gap-space-sm px-space-md py-1 rounded-full bg-surface-container hairline font-code-sm text-code-sm text-on-surface-variant"><span className="w-1.5 h-1.5 rounded-circle bg-primary" />Multi-model research workspace</span>
          <h1 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-[56px] md:leading-[60px] lg:text-[64px] lg:leading-[68px] font-bold tracking-tight">Research that <span className="text-primary">thinks deeper.</span></h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">Several models explore your question, challenge each other and check claims against sources, then hand you one calm synthesis. Bring your own keys. Complicated inside, calm outside.</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md w-full sm:w-auto">
            <button type="button" onClick={() => go('research')} className="flex items-center justify-center gap-space-sm bg-primary hover:bg-primary-fixed text-on-primary font-headline-sm text-headline-sm px-space-xl min-h-[48px] rounded-2xl glow-primary transition-all active:scale-[0.98]">Start an investigation<Icon name="arrow_forward" className="text-[20px]" /></button>
            <button type="button" onClick={() => scrollTo('sample')} className="flex items-center justify-center gap-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm px-space-xl min-h-[48px] rounded-2xl hairline transition-colors"><Icon name="play_circle" className="text-[20px] text-primary" />See a sample</button>
          </div>
          <p className="font-code-sm text-code-sm text-outline">Your own API keys · stored in this browser · local Ollama supported</p>
        </div>

        {/* Sample window — clearly labelled, never presented as a live run */}
        <div id="sample" className="relative max-w-5xl mx-auto mt-space-xl text-left scroll-mt-24">
          <div className="rounded-3xl bg-surface-container-low coat overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,180,216,0.35)]">
            <div className="flex items-center justify-between gap-space-sm px-space-lg h-11 bg-surface-container-lowest/70">
              <div className="flex items-center gap-space-xs" aria-hidden><span className="w-2.5 h-2.5 rounded-circle bg-surface-container-highest" /><span className="w-2.5 h-2.5 rounded-circle bg-surface-container-highest" /><span className="w-2.5 h-2.5 rounded-circle bg-surface-container-highest" /></div>
              <span className="font-code-sm text-code-sm text-outline truncate">sample.illustration — not a live run</span>
              <span className="font-code-sm text-code-sm text-[#F59E0B] bg-[#F59E0B]/10 px-space-sm py-0.5 rounded">SAMPLE</span>
            </div>
            <div className="p-space-lg lg:p-space-xl flex flex-col gap-space-lg">
              <div><div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">Question</div><p className="font-headline-md text-headline-md mt-1">Does adversarial review make multi-model answers more reliable?</p></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm">{STAGES.map(([t, b], i) => (
                <div key={t} className={`rounded-2xl p-space-md ${i === 3 ? 'bg-surface-container-high ring-1 ring-primary/40' : 'bg-surface-container'}`}><div className={`font-code-sm text-code-sm ${i === 3 ? 'text-primary' : 'text-outline'}`}>{t}</div><div className="font-headline-sm text-headline-sm mt-1">{b}</div></div>))}</div>
              <div className="rounded-2xl bg-surface-container p-space-lg"><div className="font-code-sm text-code-sm text-tertiary uppercase tracking-wider mb-space-xs">Example synthesis shape</div>
                <p className="font-body-md text-body-md text-on-surface-variant">A real run ends with an answer-first brief: what is settled, what is contested, which claims were supported, contradicted or left unresolved, and the sources behind each. This card only shows the shape. Run a real inquiry to see actual results.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Creed ───────── */}
      <section className="px-gutter lg:px-space-xl py-space-xl"><div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-space-xl items-center">
        <div><div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">Our engineering creed</div><h2 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl mt-space-sm">Complicated inside.<br />Calm outside.</h2></div>
        <p className="font-body-lg text-body-lg text-on-surface-variant">We do not hide disagreement to sound confident. Breezy lets models propose, object and verify behind the scenes, then shows you the result with its evidence and its uncertainty, in one quiet workspace.</p>
      </div></section>

      {/* ───────── Product tour ───────── */}
      <section id="product" className="px-gutter lg:px-space-xl py-space-xl scroll-mt-20"><div className="max-w-6xl mx-auto">
        <div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">The workspace</div><h2 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl mt-space-xs mb-space-lg">One place to think, research and build</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-space-md">{[
          ['research', 'psychology', 'Research', 'Question, plan, challenge, verify, synthesize. Streams live with sources and claims.'],
          ['chat', 'chat_bubble', 'Chat', 'A fast conversation with any model you have connected. No sources are claimed.'],
          ['build', 'terminal', 'Build', 'Open a GitHub repository, edit and commit files, run Python or JavaScript in the browser.'],
          ['canvas', 'draw', 'Canvas', 'Pin findings, ideas and tasks as cards. Stored on this device, exportable to Markdown.'],
        ].map(([id, ic, t, b]) => (
          <button key={id} type="button" onClick={() => go(id)} className="group text-left bg-surface-container hover:bg-surface-container-high rounded-3xl p-space-lg transition-colors coat">
            <span className="w-10 h-10 rounded-xl bg-surface-container-high group-hover:bg-surface-container-highest text-primary flex items-center justify-center"><Icon name={ic} className="text-[22px]" /></span>
            <div className="font-headline-sm text-headline-sm mt-space-md flex items-center gap-space-xs">{t}<Icon name="north_east" className="text-[16px] text-outline group-hover:text-primary transition-colors" /></div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{b}</p></button>))}</div>
      </div></section>

      {/* ───────── Methodology ───────── */}
      <section id="method" className="px-gutter lg:px-space-xl py-space-xl scroll-mt-20"><div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-space-xl"><div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">The architecture</div><h2 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl mt-space-xs">The four-seat methodology</h2><p className="font-body-md text-body-md text-on-surface-variant mt-space-sm">A single model gives you a plausible answer. Breezy gives each stage of the reasoning its own seat, and its own model if you want one.</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-space-md">{PILLARS.map((p) => (
          <div key={p.n} className="bg-surface-container rounded-3xl p-space-lg coat flex flex-col gap-space-sm">
            <div className="flex items-center justify-between"><span className={`w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center ${p.tone}`}><Icon name={p.icon} className="text-[20px]" /></span><span className="font-code-sm text-code-sm text-outline">{p.n}</span></div>
            <h3 className="font-headline-sm text-headline-sm">{p.title}</h3><p className="font-body-sm text-body-sm text-on-surface-variant flex-1">{p.body}</p>
            <span className="font-code-sm text-code-sm text-outline-variant">{p.seat}</span></div>))}</div>
      </div></section>

      {/* ───────── Compare ───────── */}
      <section id="compare" className="px-gutter lg:px-space-xl py-space-xl scroll-mt-20"><div className="max-w-6xl mx-auto">
        <div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">Architectural audit</div><h2 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl mt-space-xs mb-space-lg">Breezy vs a conventional AI chat</h2>
        <div className="overflow-x-auto rounded-3xl bg-surface-container-low coat"><table className="w-full min-w-[640px] text-left">
          <thead><tr className="font-label-md text-label-md uppercase tracking-wider text-outline"><th className="p-space-lg w-[18%]">Dimension</th><th className="p-space-lg">Conventional chat</th><th className="p-space-lg bg-surface-container-high/60 text-primary">Breezy</th></tr></thead>
          <tbody className="font-body-sm text-body-sm">{COMPARE.map(([d, a, b]) => (<tr key={d} className="border-t border-outline-variant/25"><td className="p-space-lg font-label-md text-label-md text-on-surface">{d}</td><td className="p-space-lg text-on-surface-variant">{a}</td><td className="p-space-lg bg-surface-container-high/60 text-on-surface">{b}</td></tr>))}</tbody>
        </table></div>
      </div></section>

      {/* ───────── Your keys ───────── */}
      <section id="keys" className="px-gutter lg:px-space-xl py-space-xl scroll-mt-20"><div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-space-xl"><div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">Your keys, your models</div><h2 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl mt-space-xs">Plain about where things live</h2></div>
        <div className="grid md:grid-cols-3 gap-space-md">{[
          ['key', 'Keys stay in your browser', 'API keys are saved in this browser’s local storage and sent with each request to the model provider you chose. There is no server-side key vault.'],
          ['dns', 'Local models supported', 'Point Breezy at a local Ollama server to run models on your own machine. Nothing leaves it for those seats.'],
          ['ios_share', 'Results you can take with you', 'Sessions are saved on this device. Export to Markdown or PDF, send to Google Docs, or pin to Canvas.'],
        ].map(([ic, t, b]) => (<div key={t} className="bg-surface-container rounded-3xl p-space-lg coat"><span className="w-10 h-10 rounded-xl bg-surface-container-high text-tertiary flex items-center justify-center"><Icon name={ic} className="text-[22px]" /></span><h3 className="font-headline-sm text-headline-sm mt-space-md">{t}</h3><p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{b}</p></div>))}</div>
      </div></section>

      {/* ───────── CTA ───────── */}
      <section className="px-gutter lg:px-space-xl py-space-xl"><div className="max-w-3xl mx-auto text-center bg-surface-container-low coat rounded-[2rem] p-space-xl relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_70%_80%_at_50%_0%,rgba(0,180,216,0.16),transparent_70%)]" />
        <div className="relative"><div className="font-code-sm text-code-sm text-primary uppercase tracking-wider">Begin your research</div><h2 className="font-headline-xl-mobile md:font-headline-xl text-headline-xl-mobile md:text-headline-xl mt-space-xs">Bring intellectual rigor to your inquiries</h2>
          <form onSubmit={submit} className="mt-space-lg flex flex-col sm:flex-row gap-space-sm"><label className="flex-1 flex items-center gap-space-sm bg-surface-container-lowest rounded-2xl px-space-md min-h-[52px] hairline focus-within:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]"><Icon name="search" className="text-outline" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Research question" placeholder="Ask a research question…" className="flex-1 bg-transparent font-body-md text-body-md focus:outline-none placeholder:text-outline min-w-0" /></label>
            <button type="submit" className="bg-primary hover:bg-primary-fixed text-on-primary font-headline-sm text-headline-sm px-space-xl min-h-[52px] rounded-2xl transition-colors">Investigate</button></form></div>
      </div></section>

      {/* ───────── Footer ───────── */}
      <footer className="px-gutter lg:px-space-xl pt-space-xl pb-[calc(2rem+env(safe-area-inset-bottom,0px))] bg-surface-container-lowest/60"><div className="max-w-6xl mx-auto grid gap-space-xl md:grid-cols-4">
        <div className="md:col-span-2"><div className="flex items-center gap-space-sm"><BreezyLogo size={28} /><span className="font-headline-sm text-headline-sm">Breezy</span></div><p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm max-w-sm">A multi-model research workspace. Complicated inside, calm outside.</p></div>
        {[['Workspace', [['Research', 'research'], ['Chat', 'chat'], ['Build', 'build'], ['Canvas', 'canvas']]], ['Resources', [['Docs', 'docs'], ['Models', 'models'], ['History', 'history'], ['Settings', 'settings']]]].map(([h, links]) => (
          <div key={h as string}><div className="font-label-sm text-label-sm uppercase tracking-wider text-outline mb-space-sm">{h as string}</div><ul className="flex flex-col gap-space-xs">{(links as string[][]).map(([l, id]) => <li key={id}><button type="button" onClick={() => go(id)} className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors min-h-[32px]">{l}</button></li>)}</ul></div>))}
      </div></footer>
    </div>
  );
};
