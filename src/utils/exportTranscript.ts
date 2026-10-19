import { DebateStep } from '../types';

export interface ExportableDebate {
  id?: string;
  prompt: string;
  protocol: string;
  createdAt?: number;
  steps: DebateStep[];
  finalOutput?: string;
  metrics?: {
    durationMs?: number;
    contentionLevel?: string;
    resolvedPointsCount?: number;
  };
}

/**
 * Convert markdown text into structured clean HTML for print/PDF export
 */
function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md
    // Escape standard HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks ```code```
    .replace(/```([\s\S]*?)```/g, (_match, code) => {
      return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
    })
    // Inline code `code`
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gim, '<hr class="divider"/>');

  // Wrap consecutive <li> into <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/gims, '<ul>$1</ul>');

  // Paragraphs (lines that don't start with tags)
  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h1') ||
        trimmed.startsWith('<h2') ||
        trimmed.startsWith('<h3') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * Generate formatted Markdown for the final Breezy Research result only.
 */
export function generateSynthexisMarkdown(debate: ExportableDebate): string {
  const dateStr = debate.createdAt
    ? new Date(debate.createdAt).toISOString()
    : new Date().toISOString();
  const humanDate = debate.createdAt
    ? new Date(debate.createdAt).toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'medium',
      })
    : new Date().toLocaleString();

  let md = `# Breezy Research — Analysis Report\n\n`;
  md += `> **Status:** Final Analysis Response\n`;
  md += `> **Inquiry:** ${debate.prompt}\n`;
  md += `> **Date:** ${humanDate} (${dateStr})\n`;
  md += `> **Protocol:** ${debate.protocol.toUpperCase()} Model Analysis\n\n`;

  if (debate.metrics) {
    md += `### Analysis Summary\n\n`;
        md += `| Metric | Value | Description |\n`;
    md += `| :--- | :--- | :--- |\n`;
    
    md += `| **Review Intensity** | **${debate.metrics.contentionLevel ?? 'Moderate'}** | Scrutiny level |\n`;
    if (debate.metrics.resolvedPointsCount) {
      md += `| **Points Resolved** | **${debate.metrics.resolvedPointsCount}** | Edge-case vulnerabilities neutralized |\n`;
    }
    if (debate.metrics.durationMs) {
      md += `| **Analysis Duration** | **${(debate.metrics.durationMs / 1000).toFixed(2)}s** | Multi-turn analysis time |\n`;
    }
    md += `\n---\n\n`;
  }

  md += `## Synthesized Answer\n\n`;
  md += `${(debate.finalOutput || 'No output recorded.').trim()}\n\n`;
  md += `---\n\n`;
  md += `*Produced by Breezy Research from the recorded multi-model run.*\n`;

  return md;
}

/**
 * Generate formatted Markdown for the complete debate transcript.
 */
export function generateMarkdownTranscript(debate: ExportableDebate): string {
  const dateStr = debate.createdAt
    ? new Date(debate.createdAt).toISOString()
    : new Date().toISOString();
  const humanDate = debate.createdAt
    ? new Date(debate.createdAt).toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'medium',
      })
    : new Date().toLocaleString();

  let md = `# Breezy Research — Analysis Transcript\n\n`;
  md += `**Inquiry:** ${debate.prompt}\n`;
  md += `**Protocol:** ${debate.protocol.toUpperCase()}\n`;
  md += `**Timestamp:** ${humanDate} (${dateStr})\n`;

  if (debate.metrics) {
    md += `\n### Analysis Telemetry\n`;

    md += `- **Review Intensity:** ${debate.metrics.contentionLevel ?? 'Moderate'}\n`;
    if (debate.metrics.resolvedPointsCount) {
      md += `- **Points Resolved:** ${debate.metrics.resolvedPointsCount} items addressed\n`;
    }
    if (debate.metrics.durationMs) {
      md += `- **Analysis Duration:** ${(debate.metrics.durationMs / 1000).toFixed(2)}s\n`;
    }
  }

  md += `\n---\n\n## Analysis Turns\n\n`;

  debate.steps.forEach((step, idx) => {
    const roleLabel = step.agentName || step.role.toUpperCase();
    const duration = step.durationMs ? ` (${(step.durationMs / 1000).toFixed(2)}s)` : '';
    md += `### Round ${idx + 1}: ${roleLabel}\n`;
    md += `*Provider: ${step.provider} | Model: ${step.model}${duration}*\n\n`;
    md += `${step.content.trim()}\n\n`;
    md += `---\n\n`;
  });

  if (debate.finalOutput) {
    md += `## Final Synthesized Answer\n\n`;
    md += `${debate.finalOutput.trim()}\n\n`;
    md += `---\n*Generated by Breezy Research*\n`;
  }

  return md;
}

/**
 * Generate formatted plain text for the debate transcript.
 */
export function generatePlainTextTranscript(debate: ExportableDebate): string {
  const humanDate = debate.createdAt
    ? new Date(debate.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const divider = '='.repeat(72);
  const subDivider = '-'.repeat(72);

  let txt = `${divider}\n`;
  txt += `BREEZY RESEARCH - ANALYSIS TRANSCRIPT\n`;
  txt += `${divider}\n\n`;
  txt += `INQUIRY: ${debate.prompt}\n`;
  txt += `PROTOCOL: ${debate.protocol.toUpperCase()}\n`;
  txt += `DATE: ${humanDate}\n`;

  if (debate.metrics) {
    txt += `\nANALYSIS METRICS:\n`;

    txt += `  - Scrutiny Level: ${debate.metrics.contentionLevel ?? 'Moderate'}\n`;
    if (debate.metrics.resolvedPointsCount) {
      txt += `  - Points Resolved: ${debate.metrics.resolvedPointsCount}\n`;
    }
  }

  txt += `\n${divider}\nANALYSIS TURNS\n${divider}\n\n`;

  debate.steps.forEach((step, idx) => {
    txt += `[ROUND ${idx + 1}] ${step.agentName.toUpperCase()} (${step.role.toUpperCase()})\n`;
    txt += `Model: ${step.provider}/${step.model}\n`;
    txt += `${subDivider}\n`;
    txt += `${step.content.trim()}\n\n\n`;
  });

  if (debate.finalOutput) {
    txt += `${divider}\nFINAL RESEARCH RESULT\n${divider}\n\n`;
    txt += `${debate.finalOutput.trim()}\n\n`;
  }

  txt += `${divider}\nEnd of Analysis Transcript\n`;

  return txt;
}

/**
 * Helper to download content as a file with standard browser blob.
 */
function downloadBlob(content: string, filename: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(prompt: string): string {
  const clean = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
  const dateTag = new Date().toISOString().slice(0, 10);
  return `synthexis-${clean || 'resolution'}-${dateTag}`;
}

/**
 * Export Final Synthexis Resolution as Markdown (.md)
 */
export function exportSynthexisAsMarkdown(debate: ExportableDebate): void {
  const content = generateSynthexisMarkdown(debate);
  const filename = `${sanitizeFilename(debate.prompt)}.md`;
  downloadBlob(content, filename, 'text/markdown;charset=utf-8');
}

/**
 * Export Complete Transcript as Markdown (.md)
 */
export function exportTranscriptAsMarkdown(debate: ExportableDebate): void {
  const content = generateMarkdownTranscript(debate);
  const filename = `synthexis-transcript-${sanitizeFilename(debate.prompt)}.md`;
  downloadBlob(content, filename, 'text/markdown;charset=utf-8');
}

/**
 * Export Complete Transcript as Plain Text (.txt)
 */
export function exportTranscriptAsText(debate: ExportableDebate): void {
  const content = generatePlainTextTranscript(debate);
  const filename = `synthexis-transcript-${sanitizeFilename(debate.prompt)}.txt`;
  downloadBlob(content, filename, 'text/plain;charset=utf-8');
}

/**
 * Export Complete Transcript as JSON (.json)
 */
export function exportTranscriptAsJson(debate: ExportableDebate): void {
  const exportPayload = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    inquiry: debate.prompt,
    protocol: debate.protocol,
    createdAt: debate.createdAt ? new Date(debate.createdAt).toISOString() : new Date().toISOString(),
    metrics: debate.metrics,
    steps: debate.steps.map((s, idx) => ({
      round: idx + 1,
      role: s.role,
      agentName: s.agentName,
      provider: s.provider,
      model: s.model,
      durationMs: s.durationMs,
      content: s.content,
    })),
    synthexisOutput: debate.finalOutput || null,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const filename = `${sanitizeFilename(debate.prompt)}.json`;
  downloadBlob(jsonStr, filename, 'application/json;charset=utf-8');
}

/**
 * Trigger high-definition printable PDF generation for Final Synthexis or Full Transcript.
 */
function renderPrintableDocument(title: string, htmlBody: string): void {
  const printWindow = window.open('', '_blank');
  
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4 portrait;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Newsreader', Georgia, serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1a1e29;
      background: #ffffff;
      margin: 0;
      padding: 24px;
    }

    .header-seal {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #1c2438;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }

    .seal-brand {
      font-family: 'Cinzel', serif;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #0f172a;
      text-transform: uppercase;
    }

    .seal-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: #0f172a;
      color: #ffffff;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .inquiry-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #d97706;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }

    .inquiry-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .inquiry-text {
      font-size: 12pt;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 24px;
      font-family: 'JetBrains Mono', monospace;
    }

    .metric-item {
      border-right: 1px solid #cbd5e1;
      padding-right: 8px;
    }
    .metric-item:last-child {
      border-right: none;
    }

    .metric-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }

    .metric-val {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
    }

    h1, h2, h3 {
      font-family: 'Newsreader', Georgia, serif;
      color: #0f172a;
      font-weight: 600;
      margin-top: 18px;
      margin-bottom: 8px;
    }

    h1 { font-size: 16pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    h2 { font-size: 14pt; color: #1e293b; }
    h3 { font-size: 12pt; color: #334155; }

    p {
      margin-top: 6px;
      margin-bottom: 10px;
    }

    ul, ol {
      margin-top: 4px;
      margin-bottom: 12px;
      padding-left: 24px;
    }

    li {
      margin-bottom: 4px;
    }

    blockquote {
      border-left: 3px solid #cbd5e1;
      padding-left: 12px;
      margin: 12px 0;
      color: #475569;
      font-style: italic;
    }

    .code-block {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      overflow-x: auto;
      margin: 12px 0;
    }

    .inline-code {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #0f172a;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      padding: 1px 4px;
      border-radius: 3px;
    }

    .step-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 6px;
      margin-bottom: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      color: #64748b;
    }

    .footer-seal {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
    }

    .print-bar {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #0f172a;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: sans-serif;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
    }

    @media print {
      .print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar" onclick="window.print()">🖨️ Save as PDF / Print Document</div>
  ${htmlBody}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  } else {
    // Fallback: render hidden iframe for print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 3000);
      }, 500);
    }
  }
}

/**
 * Export Final Synthexis Resolution as formatted Archival PDF
 */
export function exportSynthexisAsPdf(debate: ExportableDebate): void {
  const humanDate = debate.createdAt
    ? new Date(debate.createdAt).toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : new Date().toLocaleString();

  const metricsHtml = debate.metrics
    ? `<div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-label">Review intensity</div>
          <div class="metric-val" style="color: #d97706;">${debate.metrics.contentionLevel ?? 'Moderate'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Flaws Fortified</div>
          <div class="metric-val">${debate.metrics.resolvedPointsCount ?? 0} points</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Duration</div>
          <div class="metric-val">${debate.metrics.durationMs ? (debate.metrics.durationMs / 1000).toFixed(1) + 's' : 'Realtime'}</div>
        </div>
      </div>`
    : '';

  const resolutionHtml = markdownToHtml(debate.finalOutput || 'No resolution recorded.');

  const bodyHtml = `
    <div class="header-seal">
      <div class="seal-brand">Breezy Research</div>
      <div class="seal-tag">Research result • Archived report</div>
    </div>

    <div class="inquiry-box">
      <div class="inquiry-label">Deliberation Inquiry</div>
      <div class="inquiry-text">${debate.prompt}</div>
    </div>

    ${metricsHtml}

    <h1>Research result</h1>
    <div class="resolution-content">
      ${resolutionHtml}
    </div>

    <div class="footer-seal">
      <div>Protocol: ${debate.protocol.toUpperCase()} research</div>
      <div>Created ${humanDate} • Breezy Research</div>
    </div>
  `;

  renderPrintableDocument(`Breezy Research - ${debate.prompt.slice(0, 30)}`, bodyHtml);
}

/**
 * Export Full Multi-Agent Debate Transcript as Archival PDF
 */
export function exportFullTranscriptAsPdf(debate: ExportableDebate): void {
  const humanDate = debate.createdAt
    ? new Date(debate.createdAt).toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : new Date().toLocaleString();

  const metricsHtml = debate.metrics
    ? `<div class="metrics-grid">
         <div class="metric-item">
           <div class="metric-label">Review intensity</div>
           <div class="metric-val" style="color: #d97706;">${debate.metrics.contentionLevel ?? 'Moderate'}</div>
         </div>
         <div class="metric-item">
           <div class="metric-label">Points resolved</div>
           <div class="metric-val">${debate.metrics.resolvedPointsCount ?? 0} points</div>
         </div>
         <div class="metric-item">
           <div class="metric-label">Total Time</div>
           <div class="metric-val">${debate.metrics.durationMs ? (debate.metrics.durationMs / 1000).toFixed(1) + 's' : 'Realtime'}</div>
         </div>
       </div>`
    : '';

  let stepsHtml = '';
  debate.steps.forEach((step, idx) => {
    const roleLabel = step.agentName || step.role.toUpperCase();
    const duration = step.durationMs ? ` (${(step.durationMs / 1000).toFixed(1)}s)` : '';
    stepsHtml += `
      <div class="step-card">
        <div class="step-header">
          <strong>ROUND ${idx + 1}: ${roleLabel}</strong>
          <span>${step.provider} / ${step.model}${duration}</span>
        </div>
        <div class="step-body">
          ${markdownToHtml(step.content)}
        </div>
      </div>
    `;
  });

  const finalSynthexisHtml = debate.finalOutput
    ? `<h1>Final research result</h1>
       <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-top: 12px;">
         ${markdownToHtml(debate.finalOutput)}
       </div>`
    : '';

  const bodyHtml = `
    <div class="header-seal">
      <div class="seal-brand">Breezy Research</div>
      <div class="seal-tag">Complete research transcript</div>
    </div>

    <div class="inquiry-box">
      <div class="inquiry-label">Research question</div>
      <div class="inquiry-text">${debate.prompt}</div>
    </div>

    ${metricsHtml}

    <h1>Breezy Research record</h1>
    ${stepsHtml}

    ${finalSynthexisHtml}

    <div class="footer-seal">
      <div>Protocol: ${debate.protocol.toUpperCase()} research</div>
      <div>Created ${humanDate} • Breezy Research</div>
    </div>
  `;

  renderPrintableDocument(`Breezy Research Transcript - ${debate.prompt.slice(0, 30)}`, bodyHtml);
}
