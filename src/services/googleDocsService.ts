import { authService } from './authService';
import { DebateSession } from '../types';

const DOC_ID_KEY = 'breezy_google_research_doc_id';
const DOC_TITLE = 'Breezy Research Archive';

function toPlainResearchText(session: DebateSession): string {
  const lines: string[] = [
    '============================================================',
    session.prompt,
    '============================================================',
    '',
    `Method: ${session.researchMethod || 'adaptive'}`,
    `Protocol: ${session.protocol}`,
    `Date: ${new Date(session.createdAt).toLocaleString()}`,
    '',
    session.finalOutput || 'No final synthesis was recorded.',
    '',
  ];

  const graph = session.evidenceGraph;
  if (graph?.claims?.length) {
    lines.push('EVIDENCE CLAIMS', '');
    graph.claims.forEach((claim, index) => {
      lines.push(`${index + 1}. [${claim.status}, ${claim.confidence}%] ${claim.claim}`);
    });
    lines.push('');
  }

  if (graph?.sourcesConsulted?.length) {
    lines.push('SOURCES', '');
    graph.sourcesConsulted.forEach((source, index) => {
      lines.push(`[${index + 1}] ${source.title} — ${source.url}`);
    });
    lines.push('');
  }

  if (graph?.contradictions?.length) {
    lines.push('CONTRADICTIONS', '');
    graph.contradictions.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.description} [${item.resolutionStatus}]`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

async function getAccessToken(): Promise<string> {
  const token = authService.getAccessToken();
  if (token && !authService.isTokenExpired()) return token;

  const freshToken = await authService.requestWorkspaceScopes([
    'https://www.googleapis.com/auth/drive.file',
  ]);
  if (!freshToken) {
    throw new Error('Google authorization was not granted. Connect Google Drive/Docs first.');
  }
  return freshToken;
}

async function createDocument(token: string): Promise<{ id: string; url: string }> {
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: DOC_TITLE }),
  });

  if (!response.ok) {
    throw new Error(`Google Docs create failed (${response.status}).`);
  }

  const doc = await response.json();
  return {
    id: doc.documentId,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

async function appendToDocument(token: string, documentId: string, text: string): Promise<void> {
  const readResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!readResponse.ok) {
    throw new Error(`Google Docs read failed (${readResponse.status}).`);
  }

  const doc = await readResponse.json();
  const body = doc.body?.content || [];
  const lastEndIndex = body.length ? body[body.length - 1]?.endIndex : 1;
  const insertionIndex = Math.max(1, Number(lastEndIndex || 1) - 1);

  const updateResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: insertionIndex }, text } }],
      }),
    }
  );

  if (!updateResponse.ok) {
    throw new Error(`Google Docs update failed (${updateResponse.status}).`);
  }
}

export const googleDocsService = {
  async saveResearchSession(session: DebateSession): Promise<string> {
    const token = await getAccessToken();
    let documentId = localStorage.getItem(DOC_ID_KEY);
    let url = '';

    if (!documentId) {
      const created = await createDocument(token);
      documentId = created.id;
      url = created.url;
      localStorage.setItem(DOC_ID_KEY, documentId);
    } else {
      url = `https://docs.google.com/document/d/${documentId}/edit`;
    }

    try {
      await appendToDocument(token, documentId, `\n${toPlainResearchText(session)}`);
    } catch (error) {
      // A deleted/moved document should not permanently break future saves.
      localStorage.removeItem(DOC_ID_KEY);
      const created = await createDocument(token);
      localStorage.setItem(DOC_ID_KEY, created.id);
      url = created.url;
      await appendToDocument(token, created.id, `\n${toPlainResearchText(session)}`);
    }

    return url;
  },

  getArchiveUrl(): string | null {
    const documentId = localStorage.getItem(DOC_ID_KEY);
    return documentId ? `https://docs.google.com/document/d/${documentId}/edit` : null;
  },

  clearArchiveLink(): void {
    localStorage.removeItem(DOC_ID_KEY);
  },
};
