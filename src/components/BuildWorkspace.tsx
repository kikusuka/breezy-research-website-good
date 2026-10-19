import React, { useState, useEffect, useRef } from 'react';
import {
  GitHubIde,
  IdeWorkspace,
  runPython,
  runJavaScript,
  buildPreviewDoc,
  askIdeAgent,
  languageOf,
  isRunnable,
  getGitHubToken,
  setGitHubToken,
  TreeEntry,
  OpenFile,
  RunResult,
  AgentEdit,
  pythonRuntimeState,
} from '../services/ideService';

type TabView = 'files' | 'editor' | 'output' | 'agent';

export const BuildWorkspace: React.FC = () => {
  // Authentication & Repository State
  const [token, setToken] = useState<string>(getGitHubToken());
  const [tokenInput, setTokenInput] = useState<string>(getGitHubToken());
  const [repoInput, setRepoInput] = useState<string>(() => { try { return localStorage.getItem('breezy:ide:last-repo') || ''; } catch { return ''; } });
  const [connectedRepo, setConnectedRepo] = useState<string | null>(null);
  const [defaultBranch, setDefaultBranch] = useState<string>('main');
  const [treeEntries, setTreeEntries] = useState<TreeEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState<boolean>(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Workspace & Buffers State
  const [workspace] = useState<IdeWorkspace>(() => new IdeWorkspace());
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [, setDirtyTick] = useState<number>(0);

  // Responsive Layout Mobile View: 'files' | 'editor' | 'output' | 'agent'
  const [mobileTab, setMobileTab] = useState<TabView>('editor');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false); // file drawer below the xl breakpoint
  const [panelOpen, setPanelOpen] = useState<boolean>(false); // Console/Preview/Agent bottom panel below the 2xl breakpoint

  // Console & Preview State
  const [consoleTab, setConsoleTab] = useState<'console' | 'preview' | 'agent'>('console');
  const [consoleLogs, setConsoleLogs] = useState<string>('Console ready. Run .py or .js files to inspect standard output.\n');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [htmlPreviewDoc, setHtmlPreviewDoc] = useState<string | null>(null);

  // Agent State
  const [agentInstruction, setAgentInstruction] = useState<string>('');
  const [agentThinking, setAgentThinking] = useState<boolean>(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentReplyText, setAgentReplyText] = useState<string | null>(null);
  const [agentEdits, setAgentEdits] = useState<AgentEdit[]>([]);

  // Dialogs
  const [newFilePathInput, setNewFilePathInput] = useState<string>('');
  const [showNewFileDialog, setShowNewFileDialog] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncWorkspaceState = () => {
    setOpenFiles([...workspace.list()]);
    setActivePath(workspace.active);
    setDirtyTick((t) => t + 1);
  };

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    setGitHubToken(trimmed);
    setToken(trimmed);
  };

  const loadRepository = async (repoName: string) => {
    if (!token) {
      setTreeError('Please enter a GitHub Personal Access Token first.');
      return;
    }
    setTreeLoading(true);
    setTreeError(null);
    try {
      const { entries, branch } = await GitHubIde.getTree(token, repoName);
      setTreeEntries(entries);
      setDefaultBranch(branch);
      setConnectedRepo(repoName);
      try { localStorage.setItem('breezy:ide:last-repo', repoName); } catch { /* ignore */ }
      // Auto-open README.md or first file if available
      const readme = entries.find((e) => e.type === 'file' && /readme\.md$/i.test(e.path));
      const firstFile = readme || entries.find((e) => e.type === 'file');
      if (firstFile) {
        await handleOpenFile(firstFile.path);
      }
    } catch (err: any) {
      setTreeError(err.message || 'Failed to fetch repository tree');
      setConnectedRepo(null);
    } finally {
      setTreeLoading(false);
    }
  };

  const handleOpenFile = async (path: string) => {
    const existing = workspace.get(path);
    if (existing) {
      workspace.active = path;
      syncWorkspaceState();
      setMobileTab('editor');
      setDrawerOpen(false);
      return;
    }
    if (!token || !connectedRepo) return;
    try {
      const details = await GitHubIde.readFile(token, connectedRepo, path);
      workspace.open(path, details.content, details.sha);
      syncWorkspaceState();
      setMobileTab('editor');
      setDrawerOpen(false);
    } catch (err: any) {
      setConsoleLogs((prev) => `${prev}\n[Error opening ${path}]: ${err.message}`);
    }
  };

  const handleCreateNewFile = () => {
    const p = newFilePathInput.trim().replace(/^\/+/, '');
    if (!p) return;
    try {
      workspace.create(p, '');
      syncWorkspaceState();
      setNewFilePathInput('');
      setShowNewFileDialog(false);
      setMobileTab('editor');
      setDrawerOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteFile = async (path: string) => {
    const confirmed = window.confirm(`Permanently delete "${path}" on branch ${defaultBranch}?`);
    if (!confirmed) return;
    const file = workspace.get(path);
    if (file?.isNew) {
      workspace.close(path);
      syncWorkspaceState();
      return;
    }
    if (!token || !connectedRepo || !file?.sha) {
      alert('Cannot delete: missing file metadata or SHA.');
      return;
    }
    try {
      await GitHubIde.deleteFile(token, connectedRepo, path, file.sha);
      workspace.close(path);
      syncWorkspaceState();
      setConsoleLogs((prev) => `${prev}\n[Deleted]: ${path} on branch ${defaultBranch}`);
      await loadRepository(connectedRepo);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSaveActiveFile = async () => {
    if (!activePath || !token || !connectedRepo) return;
    setSaveStatus('Saving to GitHub default branch...');
    try {
      await workspace.save(token, connectedRepo, activePath);
      syncWorkspaceState();
      setSaveStatus('Saved and committed successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
      setConsoleLogs((prev) => `${prev}\n[Committed]: ${activePath} to branch ${defaultBranch}`);
    } catch (err: any) {
      setSaveStatus(null);
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activePath) return;
    workspace.edit(activePath, e.target.value);
    syncWorkspaceState();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const nextVal = val.substring(0, start) + '  ' + val.substring(end);
      if (activePath) {
        workspace.edit(activePath, nextVal);
        syncWorkspaceState();
      }
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleRunCode = async () => {
    if (!activePath) return;
    setPanelOpen(true);
    const lang = languageOf(activePath);
    const activeFile = workspace.get(activePath);
    if (!activeFile) return;

    if (lang === 'html') {
      const filesMap: Record<string, string> = {};
      openFiles.forEach((f) => {
        filesMap[f.path] = f.content;
      });
      try {
        const doc = buildPreviewDoc(activePath, filesMap);
        setHtmlPreviewDoc(doc);
        setConsoleTab('preview');
        setMobileTab('output');
      } catch (err: any) {
        setConsoleLogs((prev) => `${prev}\n[Preview Error]: ${err.message}`);
        setConsoleTab('console');
        setMobileTab('output');
      }
      return;
    }

    if (lang !== 'python' && lang !== 'javascript') {
      alert(`Execution not supported for language: ${lang}. Supported: python, javascript, html preview.`);
      return;
    }

    setIsRunning(true);
    setConsoleTab('console');
    setMobileTab('output');
    setConsoleLogs((prev) => `${prev}\n--- Running ${activePath} (${lang}) ---`);

    try {
      let res: RunResult;
      if (lang === 'python') {
        setConsoleLogs((prev) => `${prev}\n[Pyodide]: Initializing Python runtime (may take a few seconds on first run)...`);
        res = await runPython(activeFile.content);
      } else {
        res = await runJavaScript(activeFile.content, 5000);
      }

      let logOut = `Execution completed in ${res.durationMs}ms\n`;
      if (res.stdout) logOut += `[stdout]\n${res.stdout}\n`;
      if (res.stderr) logOut += `[stderr]\n${res.stderr}\n`;
      if (res.error) logOut += `[error]\n${res.error}\n`;
      setConsoleLogs((prev) => `${prev}\n${logOut}`);
    } catch (err: any) {
      setConsoleLogs((prev) => `${prev}\n[Runtime Failure]: ${err.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleAskAgent = async () => {
    if (!agentInstruction.trim()) return;
    setAgentThinking(true);
    setAgentError(null);
    setAgentReplyText(null);
    setAgentEdits([]);
    setConsoleTab('agent');

    const filesMap: Record<string, string> = {};
    openFiles.slice(0, 8).forEach((f) => {
      filesMap[f.path] = f.content;
    });

    try {
      const result = await askIdeAgent({
        instruction: agentInstruction.trim(),
        activePath: activePath || undefined,
        files: filesMap,
      });
      setAgentReplyText(result.text);
      setAgentEdits(result.edits);
    } catch (err: any) {
      setAgentError(err.message || 'Failed to get agent suggestions.');
    } finally {
      setAgentThinking(false);
    }
  };

  const handleApplyAgentEdit = (edit: AgentEdit) => {
    const existing = workspace.get(edit.path);
    if (existing) {
      workspace.edit(edit.path, edit.content);
      workspace.active = edit.path;
    } else {
      workspace.create(edit.path, edit.content);
    }
    syncWorkspaceState();
    setConsoleLogs((prev) => `${prev}\n[Agent Applied]: Updated buffer for ${edit.path} (press Save to commit).`);
  };

  const currentActiveFile = activePath ? workspace.get(activePath) : null;
  const isRunnableFile = activePath ? isRunnable(activePath) : false;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest text-on-surface overflow-hidden">
      {/* Top IDE Toolbar */}
      <div className="h-14 bg-surface-container-low border-b border-outline-variant/30 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-outline-variant/30">
            <span className="material-symbols-outlined text-sm text-primary">terminal</span>
            <span className="font-mono text-xs font-semibold text-on-surface">Build IDE</span>
          </div>

          {connectedRepo ? (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono truncate">
              <span className="text-outline">/</span>
              <span className="text-primary font-medium truncate">{connectedRepo}</span>
              <span className="text-[10px] text-outline">({defaultBranch})</span>
            </div>
          ) : (
            <span className="text-xs text-outline truncate hidden sm:inline">No repository loaded</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs font-mono text-tertiary truncate hidden md:inline">
              {saveStatus}
            </span>
          )}

          {activePath && (
            <button
              onClick={handleSaveActiveFile}
              disabled={!workspace.isDirty(activePath)}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface border border-outline-variant/40 disabled:opacity-40 transition-colors"
              title="Commit file changes to GitHub default branch"
            >
              <span className="material-symbols-outlined text-sm text-primary">save</span>
              <span className="hidden sm:inline">Save</span>
              {workspace.isDirty(activePath) && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>}
            </button>
          )}

          {isRunnableFile && (
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary hover:bg-secondary text-on-primary text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm font-bold">
                {languageOf(activePath!) === 'html' ? 'visibility' : 'play_arrow'}
              </span>
              <span>{languageOf(activePath!) === 'html' ? 'Preview' : isRunning ? 'Running...' : 'Run'}</span>
            </button>
          )}

          {/* 768-1279px File Drawer Toggle */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="hidden md:flex xl:hidden items-center gap-1 px-2.5 py-1.5 rounded bg-surface-container text-xs text-on-surface-variant border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-sm">folder</span>
            <span>Files</span>
          </button>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            aria-pressed={panelOpen}
            className={`hidden md:flex 2xl:hidden items-center gap-1 px-2.5 py-1.5 rounded text-xs border border-outline-variant/30 ${panelOpen ? 'bg-surface-container-high text-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-sm">terminal</span>
            <span>Output</span>
          </button>
        </div>
      </div>

      {/* Mobile-Only Segmented Control (<768px) */}
      <div className="md:hidden flex items-center bg-surface-container-low border-b border-outline-variant/30 p-1 gap-1">
        {(['files', 'editor', 'output', 'agent'] as TabView[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-1.5 text-xs font-medium rounded capitalize transition-colors ${
              mobileTab === tab
                ? 'bg-surface-container-high text-primary font-semibold shadow-sm'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            {tab === 'output' ? 'Console' : tab}
          </button>
        ))}
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ============================================================== */}
        {/* COLUMN 1: File Tree (Desktop >=1280px or Drawer 768-1279px or Mobile tab) */}
        {/* ============================================================== */}
        <div
          className={`
            ${drawerOpen ? 'flex absolute inset-y-0 left-0 z-40 w-72 shadow-2xl bg-surface-container-low' : 'hidden'}
            xl:flex xl:static xl:w-64 xl:shadow-none xl:!bg-surface
            ${mobileTab === 'files' ? '!flex absolute inset-0 z-30 w-full' : ''}
            flex-col bg-surface border-r border-outline-variant/30 shrink-0 overflow-hidden
          `}
        >
          {/* GitHub Connection Box */}
          <div className="p-3 border-b border-outline-variant/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-primary uppercase tracking-wider font-semibold">
                GitHub Repository
              </span>
              {drawerOpen && (
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="xl:hidden text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="GitHub PAT (repo scope)"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded px-2.5 py-1 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="owner/repo"
                  className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant/30 rounded px-2.5 py-1 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => {
                    handleSaveToken();
                    loadRepository(repoInput.trim());
                  }}
                  disabled={treeLoading || !repoInput.trim()}
                  className="shrink-0 px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-primary border border-outline-variant/40 disabled:opacity-40"
                >
                  {treeLoading ? '...' : 'Load'}
                </button>
              </div>
            </div>

            {treeError && <p className="text-[11px] text-error leading-snug">{treeError}</p>}
          </div>

          {/* File Operations Bar */}
          <div className="px-3 py-1.5 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-mono text-[11px] uppercase tracking-wider">Tree Explorer</span>
            <button
              onClick={() => setShowNewFileDialog(true)}
              className="p-1 rounded hover:bg-surface-container-high text-primary flex items-center gap-1 text-[11px]"
              title="New File"
            >
              <span className="material-symbols-outlined text-sm">note_add</span>
              <span>New</span>
            </button>
          </div>

          {/* New File Input Overlay */}
          {showNewFileDialog && (
            <div className="p-2.5 bg-surface-container border-b border-outline-variant/30 space-y-1.5">
              <span className="text-[10px] text-on-surface-variant font-mono">Create new file:</span>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newFilePathInput}
                  onChange={(e) => setNewFilePathInput(e.target.value)}
                  placeholder="e.g. src/utils.py"
                  className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-1 text-xs text-on-surface"
                />
                <button
                  onClick={handleCreateNewFile}
                  className="px-2 py-1 rounded bg-primary text-on-primary text-xs font-bold"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowNewFileDialog(false)}
                  className="px-2 py-1 rounded bg-surface-container-high text-xs text-on-surface-variant"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Files List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs font-mono">
            {treeEntries.length === 0 && !treeLoading && (
              <p className="p-3 text-[11px] text-outline text-center font-sans">
                Connect your GitHub repository to inspect and edit code.
              </p>
            )}

            {treeEntries.map((entry) => {
              const isDir = entry.type === 'dir';
              const isOpen = openFiles.some((f) => f.path === entry.path);
              const isActive = activePath === entry.path;
              const isDirty = workspace.isDirty(entry.path);

              return (
                <div
                  key={entry.path}
                  onClick={() => !isDir && handleOpenFile(entry.path)}
                  className={`
                    group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors
                    ${isActive ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}
                    ${isDir ? 'opacity-60 cursor-default' : ''}
                  `}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-[15px] text-outline">
                      {isDir ? 'folder' : 'description'}
                    </span>
                    <span className="truncate">{entry.path}</span>
                  </div>

                  {!isDir && (
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                      {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>}
                      {isOpen && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(entry.path);
                          }}
                          className="text-outline hover:text-error p-0.5"
                          title="Delete file"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUMN 2: Editor Center Column */}
        {/* ============================================================== */}
        <div
          className={`
            ${mobileTab === 'editor' ? 'flex' : 'hidden md:flex'}
            flex-1 flex-col overflow-hidden bg-surface min-w-0
          `}
        >
          {/* Open Tabs Strip */}
          <div className="h-10 bg-surface-container-low border-b border-outline-variant/30 flex items-center overflow-x-auto px-2 gap-1 shrink-0">
            {openFiles.length === 0 ? (
              <span className="text-xs text-outline px-2 font-mono">No files open</span>
            ) : (
              openFiles.map((file) => {
                const isActive = file.path === activePath;
                const dirty = workspace.isDirty(file.path);
                return (
                  <div
                    key={file.path}
                    onClick={() => {
                      workspace.active = file.path;
                      syncWorkspaceState();
                    }}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-mono cursor-pointer border-t-2 shrink-0
                      ${
                        isActive
                          ? 'bg-surface-container-low text-primary border-primary'
                          : 'bg-surface text-outline border-transparent hover:text-on-surface'
                      }
                    `}
                  >
                    <span>{file.path.split('/').pop()}</span>
                    {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        workspace.close(file.path);
                        syncWorkspaceState();
                      }}
                      className="text-outline hover:text-on-surface text-xs ml-1"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Plain Textarea Editor (Monospace, Tab space insertion, text-base 16px min for mobile) */}
          <div className="flex-1 relative overflow-hidden bg-surface-container-lowest">
            {currentActiveFile ? (
              <textarea
                ref={textareaRef}
                value={currentActiveFile.content}
                onChange={handleEditorChange}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="w-full h-full p-4 bg-transparent text-on-surface font-mono text-base sm:text-sm leading-relaxed resize-none focus:outline-none selection:bg-on-primary-container selection:text-secondary"
                placeholder="Write code here..."
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-outline">
                <span className="material-symbols-outlined text-4xl mb-2 text-outline-variant">code</span>
                <p className="text-sm font-sans">Select a file from the explorer or create a new file to start editing.</p>
                <p className="text-xs font-mono text-primary mt-2">Commits will be committed directly to default branch ({defaultBranch})</p>
              </div>
            )}
          </div>

          {/* Active File Metadata Bar */}
          {currentActiveFile && (
            <div className="h-7 bg-surface-container-low border-t border-outline-variant/30 px-3 flex items-center justify-between text-[11px] font-mono text-outline shrink-0">
              <div className="flex items-center gap-2">
                <span>{currentActiveFile.path}</span>
                <span>·</span>
                <span className="text-primary uppercase">{languageOf(currentActiveFile.path)}</span>
              </div>
              <div>
                <span>{currentActiveFile.content.split('\n').length} lines</span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* COLUMN 3: Console / Preview / Agent Panel */}
        {/* (Desktop >=1280px = right column; 768-1279px = toggleable bottom panel; <768px = mobileTab) */}
        {/* ============================================================== */}
        <div
          className={`
            ${mobileTab === 'output' || mobileTab === 'agent' ? '!flex absolute inset-0 z-30 w-full' : panelOpen ? 'flex absolute inset-x-0 bottom-0 h-[50%] z-20 border-t border-outline-variant/40 shadow-[0_-16px_32px_-12px_rgba(0,0,0,0.7)]' : 'hidden'}
            2xl:!flex 2xl:!static 2xl:!w-96 2xl:!h-auto 2xl:!inset-auto 2xl:border-t-0 2xl:shadow-none
            flex-col bg-surface border-l border-outline-variant/30 shrink-0 overflow-hidden
          `}
        >
          {/* Subtabs for Panel */}
          <div className="h-10 bg-surface-container-low border-b border-outline-variant/30 px-2 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setConsoleTab('console')}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize flex items-center gap-1.5 ${
                consoleTab === 'console'
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">terminal</span>
              <span>Console</span>
            </button>
            <button
              onClick={() => setConsoleTab('preview')}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize flex items-center gap-1.5 ${
                consoleTab === 'preview'
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span>HTML Preview</span>
            </button>
            <button
              onClick={() => setConsoleTab('agent')}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize flex items-center gap-1.5 ${
                consoleTab === 'agent'
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">smart_toy</span>
              <span>Coding Agent</span>
            </button>
          </div>

          {/* Tab 1: Console Output */}
          {consoleTab === 'console' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden bg-surface-container-lowest">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/30 text-[11px] font-mono text-outline">
                <span>Pyodide & Worker Runtime</span>
                <button
                  onClick={() => setConsoleLogs('Console cleared.\n')}
                  className="hover:text-on-surface"
                >
                  Clear
                </button>
              </div>
              <pre className="flex-1 overflow-y-auto font-mono text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap selection:bg-on-primary-container">
                {consoleLogs}
              </pre>
              <div className="pt-2 border-t border-outline-variant/30 text-[10px] text-outline font-mono">
                Note: Browser sandbox only. Python downloads on first run and long loops may freeze the tab.
              </div>
            </div>
          )}

          {/* Tab 2: HTML Sandboxed Preview */}
          {consoleTab === 'preview' && (
            <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
              {htmlPreviewDoc ? (
                <iframe
                  title="HTML Preview Sandbox"
                  sandbox="allow-scripts"
                  srcDoc={htmlPreviewDoc}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 font-sans text-xs">
                  Open an .html file and click "Preview" to inspect rendered HTML with inlined assets.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Coding Agent */}
          {consoleTab === 'agent' && (
            <div className="flex-1 flex flex-col p-3 bg-surface overflow-hidden space-y-3">
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-primary uppercase font-semibold">
                  Breezy AI Agent (askIdeAgent)
                </span>
                <p className="text-xs text-on-surface-variant leading-snug">
                  Ask configured frontier models to inspect open buffers and suggest complete file replacements.
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  value={agentInstruction}
                  onChange={(e) => setAgentInstruction(e.target.value)}
                  placeholder="e.g. Add input validation and error handling to this script..."
                  rows={3}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded p-2 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary resize-none"
                />
                <button
                  onClick={handleAskAgent}
                  disabled={agentThinking || !agentInstruction.trim()}
                  className="w-full py-2 rounded bg-primary text-on-primary font-semibold text-xs hover:bg-secondary disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  <span>{agentThinking ? 'Synthesizing Edits...' : 'Propose Changes'}</span>
                </button>
              </div>

              {agentError && (
                <div className="p-2.5 rounded bg-error-container/20 border border-error/30 text-on-error-container text-xs">
                  {agentError}
                </div>
              )}

              {/* Agent Reply & Diff Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 pt-2">
                {agentReplyText && (
                  <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface leading-relaxed">
                    <p className="font-semibold text-primary mb-1">Agent Rationale:</p>
                    <p className="whitespace-pre-wrap">{agentReplyText.replace(/```file:[^\n`]+\n[\s\S]*?\n```/g, '').trim()}</p>
                  </div>
                )}

                {agentEdits.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-mono text-[10px] text-tertiary uppercase font-semibold">
                      Proposed File Blocks ({agentEdits.length})
                    </span>
                    {agentEdits.map((edit, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-surface-container-low border border-outline-variant/30 space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="text-primary truncate">{edit.path}</span>
                          <button
                            onClick={() => handleApplyAgentEdit(edit)}
                            className="px-2 py-0.5 rounded bg-tertiary text-[#003822] text-[11px] font-bold hover:bg-[#6cf2b6]"
                          >
                            Apply to Buffer
                          </button>
                        </div>
                        <pre className="p-2 rounded bg-surface-container-lowest font-mono text-[11px] text-on-surface-variant max-h-36 overflow-y-auto whitespace-pre-wrap">
                          {edit.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
