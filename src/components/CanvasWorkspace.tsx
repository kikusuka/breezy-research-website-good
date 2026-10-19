import React, { useState, useEffect } from 'react';
import { loadSessions } from '../services/sessionStorage';
import { DebateSession } from '../types';

export type CardType = 'idea' | 'research' | 'code' | 'task';

export interface CanvasCard {
  id: string;
  type: CardType;
  title: string;
  content: string;
  tags: string[];
  completed?: boolean;
  createdAt: number;
  sourceSessionId?: string;
}

const STORAGE_KEY = 'breezy_canvas_cards_v1';

export const CanvasWorkspace: React.FC = () => {
  const [cards, setCards] = useState<CanvasCard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return (JSON.parse(saved) as CanvasCard[]).filter((c) => c.id !== 'default-1' && c.id !== 'default-2');
    } catch {}
    return [];
  });

  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingCard, setEditingCard] = useState<CanvasCard | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [historySessions, setHistorySessions] = useState<DebateSession[]>([]);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);

  // New/Edit Card Form State
  const [formType, setFormType] = useState<CardType>('idea');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch {}
  }, [cards]);

  useEffect(() => {
    const list = loadSessions();
    setHistorySessions(list);
  }, [showPinModal]);

  const handleOpenCreate = () => {
    setFormType('idea');
    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setEditingCard(null);
    setIsCreating(true);
  };

  const handleOpenEdit = (c: CanvasCard) => {
    setEditingCard(c);
    setFormType(c.type);
    setFormTitle(c.title);
    setFormContent(c.content);
    setFormTags(c.tags.join(', '));
    setIsCreating(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingCard) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === editingCard.id
            ? {
                ...c,
                type: formType,
                title: formTitle.trim(),
                content: formContent.trim(),
                tags: parsedTags,
              }
            : c
        )
      );
    } else {
      const newCard: CanvasCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: formType,
        title: formTitle.trim(),
        content: formContent.trim(),
        tags: parsedTags,
        completed: formType === 'task' ? false : undefined,
        createdAt: Date.now(),
      };
      setCards((prev) => [newCard, ...prev]);
    }

    setIsCreating(false);
    setEditingCard(null);
  };

  const handleDeleteCard = (id: string) => {
    if (window.confirm('Delete this card?')) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleToggleTask = (id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  };

  const handlePinFromHistory = (s: DebateSession) => {
    const brief = s.finalOutput || (s as any).synthesis?.finalAnswer || 'Research session';
    const newCard: CanvasCard = {
      id: `pin-${s.id}-${Date.now()}`,
      type: 'research',
      title: s.prompt || 'Untitled Research',
      content: brief.slice(0, 1500),
      tags: ['Pinned-History', s.protocol || 'research'],
      sourceSessionId: s.id,
      createdAt: Date.now(),
    };
    setCards((prev) => [newCard, ...prev]);
    setShowPinModal(false);
  };

  const handleExportMarkdown = () => {
    let md = `# Breezy Research Canvas Export\nGenerated on ${new Date().toLocaleString()}\n\n`;
    cards.forEach((c) => {
      md += `## [${c.type.toUpperCase()}] ${c.title}\n`;
      if (c.tags.length > 0) md += `**Tags:** ${c.tags.join(', ')}\n\n`;
      if (c.type === 'task') md += `**Status:** ${c.completed ? 'Completed [x]' : 'Pending [ ]'}\n\n`;
      md += `${c.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breezy-canvas-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCards = cards.filter((c) => {
    const matchesType = filterType === 'all' || c.type === filterType;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const getTypeColor = (type: CardType) => {
    switch (type) {
      case 'idea':
        return 'text-primary border-primary/40 bg-primary/10';
      case 'research':
        return 'text-tertiary border-tertiary/40 bg-tertiary/10';
      case 'code':
        return 'text-[#f59e0b] border-[#f59e0b]/40 bg-[#f59e0b]/10';
      case 'task':
        return 'text-secondary border-secondary/40 bg-secondary/10';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface text-on-surface overflow-hidden">
      {/* Top Controls Bar */}
      <div className="h-14 bg-surface-container-low border-b border-outline-variant/30 px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">dashboard</span>
          <span className="font-bold text-sm text-on-surface">Research Canvas</span>
          <span className="text-xs font-mono text-outline hidden sm:inline">
            ({cards.length} cards)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPinModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface-variant border border-outline-variant/30 transition-colors"
            title="Pin a research debate from history"
          >
            <span className="material-symbols-outlined text-sm text-tertiary">push_pin</span>
            <span className="hidden sm:inline">Pin from History</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface-variant border border-outline-variant/30 transition-colors"
            title="Export canvas as Markdown"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded bg-primary hover:bg-secondary text-on-primary text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            <span>New Card</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-low/60 border-b border-outline-variant/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {(['all', 'idea', 'research', 'code', 'task'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded capitalize font-medium transition-colors ${
                filterType === t
                  ? 'bg-surface-container-high text-primary border border-outline-variant/50'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/30 rounded px-2.5 py-1 text-xs w-full sm:w-64">
          <span className="material-symbols-outlined text-sm text-outline">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards and tags..."
            className="bg-transparent text-on-surface placeholder-outline focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Cards Masonry / Grid Display */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-outline">
            <span className="material-symbols-outlined text-4xl mb-2 text-outline-variant">space_dashboard</span>
            <p className="text-sm font-medium text-on-surface-variant">No canvas cards found</p>
            <p className="text-xs text-outline mt-1 max-w-sm">
              Create ideas, research summaries, code snippets, or task checklists, or pin directly from your research history.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 rounded bg-surface-container-high text-primary border border-outline-variant/40 text-xs font-semibold hover:bg-surface-container-highest"
            >
              Create First Card
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-outline-variant/60 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getTypeColor(
                        card.type
                      )}`}
                    >
                      {card.type}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(card)}
                        className="text-outline hover:text-on-surface p-1"
                        title="Edit Card"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="text-outline hover:text-error p-1"
                        title="Delete Card"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  <h3
                    className={`font-semibold text-sm text-on-surface leading-snug mb-2 ${
                      card.completed ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {card.title}
                  </h3>

                  <p
                    className={`text-xs text-on-surface-variant whitespace-pre-wrap leading-relaxed line-clamp-6 ${
                      card.completed ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {card.content}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1">
                    {card.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-surface text-outline font-mono text-[10px] border border-outline-variant/30"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Task Toggle or Timestamp */}
                  {card.type === 'task' ? (
                    <label className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(card.completed)}
                        onChange={() => handleToggleTask(card.id)}
                        className="rounded border-outline-variant/30 text-primary focus:ring-0"
                      />
                      <span>{card.completed ? 'Completed' : 'Pending'}</span>
                    </label>
                  ) : (
                    <span className="text-[10px] text-outline font-mono">
                      {new Date(card.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Card Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCard}
            className="w-full max-w-lg bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <span className="font-bold text-sm text-on-surface">
                {editingCard ? 'Edit Canvas Card' : 'Create New Canvas Card'}
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-on-surface-variant mb-1 font-medium">Card Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['idea', 'research', 'code', 'task'] as CardType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={`py-1.5 rounded font-mono text-xs uppercase border capitalize transition-colors ${
                        formType === t ? getTypeColor(t) : 'bg-surface text-outline border-outline-variant/30'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-on-surface-variant mb-1 font-medium">Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Lithium-Sulfur Degradation Hypothesis"
                  className="w-full bg-surface border border-outline-variant/30 rounded px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant mb-1 font-medium">Content / Details</label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Elaborate key points, equations, tasks, or code..."
                  className="w-full bg-surface border border-outline-variant/30 rounded p-3 text-xs text-on-surface focus:outline-none focus:border-primary resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant mb-1 font-medium">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="e.g. Battery, DOI, Critical"
                  className="w-full bg-surface border border-outline-variant/30 rounded px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded bg-surface text-xs font-medium text-on-surface-variant hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-secondary"
              >
                {editingCard ? 'Save Changes' : 'Create Card'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pin from History Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <span className="font-bold text-sm text-on-surface">Pin Research from History</span>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {historySessions.length === 0 ? (
                <p className="text-xs text-outline text-center py-6">
                  No saved research sessions found in history. Run an investigation first!
                </p>
              ) : (
                historySessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg bg-surface border border-outline-variant/30 hover:border-primary/50 transition-colors flex items-center justify-between gap-3 text-left"
                  >
                    <div className="truncate">
                      <p className="text-xs font-semibold text-on-surface truncate">
                        {s.prompt || 'Untitled Session'}
                      </p>
                      <p className="text-[10px] text-outline font-mono mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString()} · Protocol: {s.protocol || 'trio'}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePinFromHistory(s)}
                      className="px-3 py-1 rounded bg-surface-container-high hover:bg-tertiary hover:text-[#003822] text-tertiary text-xs font-semibold transition-colors shrink-0"
                    >
                      Pin Card
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
