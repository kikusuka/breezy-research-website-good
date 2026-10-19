/** Neutral prompt suggestions for the composer. These are examples to type, never presented as live data. */
export const RESEARCH_STARTERS = [
  { id: 's1', title: 'Four-day work week', blurb: 'What the published trials show, and where the evidence is thin.', icon: 'science', prompt: 'What does the published evidence say about four-day work weeks? Separate controlled trials from surveys and note the limitations of each.' },
  { id: 's2', title: 'Solid-state batteries', blurb: 'Safety, cost, and manufacturing against lithium-ion today.', icon: 'battery_charging_full', prompt: 'Compare solid-state batteries with current lithium-ion cells on safety, energy density, cost, and manufacturing readiness. Flag claims that are still unproven.' },
  { id: 's3', title: 'Eventual consistency', blurb: 'Where it breaks in real systems and how teams mitigate it.', icon: 'hub', prompt: 'What are the most common failure modes of eventually consistent databases in production, and what patterns do teams use to mitigate them?' },
];
export const CHAT_STARTERS = [
  { id: 'c1', title: 'Explain a concept plainly', meta: 'Start from what you already know', icon: 'lightbulb', prompt: 'Explain how public-key cryptography works, assuming I know basic algebra but no security background.' },
  { id: 'c2', title: 'Compare two approaches', meta: 'Trade-offs, not verdicts', icon: 'compare_arrows', prompt: 'Compare event sourcing with a conventional CRUD design for an order-management system. Where does each one hurt?' },
  { id: 'c3', title: 'Stress-test my reasoning', meta: 'Paste an argument to review', icon: 'rule', prompt: 'I will paste an argument. Identify its weakest assumptions and what evidence would change your mind.' },
];
