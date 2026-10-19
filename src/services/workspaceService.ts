/**
 * Workspace Service for Synthexis
 * Handles calling real Google Workspace REST endpoints
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject?: string;
  from?: string;
  date?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export const workspaceService = {
  /**
   * Fetch recent files from Google Drive
   */
  async listDriveFiles(token: string): Promise<GoogleDriveFile[]> {
    try {
      const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/pdf' or mimeType='text/plain' and trashed=false");
      const url = `https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,mimeType,webViewLink,modifiedTime)&q=${q}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Drive files request failed with status: ${response.status}`);
      }
      const data = await response.json();
      return data.files || [];
    } catch (err) {
      console.error('Error fetching Google Drive files:', err);
      return [];
    }
  },

  /**
   * Read the body of a Google Document
   */
  async fetchDocumentContent(token: string, documentId: string): Promise<string> {
    try {
      const url = `https://docs.googleapis.com/v1/documents/${documentId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Docs API failed with status: ${response.status}`);
      }
      const doc = await response.json();
      
      // Parse Document structure into readable plain text
      let text = '';
      if (doc.body && doc.body.content) {
        for (const element of doc.body.content) {
          if (element.paragraph && element.paragraph.elements) {
            for (const item of element.paragraph.elements) {
              if (item.textRun && item.textRun.content) {
                text += item.textRun.content;
              }
            }
          }
        }
      }
      return text;
    } catch (err) {
      console.error('Error reading Google Doc:', err);
      return 'Failed to extract Google Doc content.';
    }
  },

  /**
   * Fetch recent Gmail message snippets
   */
  async listGmailMessages(token: string): Promise<GmailMessage[]> {
    try {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Gmail API failed with status: ${response.status}`);
      }
      const data = await response.json();
      const messagesList = data.messages || [];
      
      // Fetch details (subject, snippet, from) for each message
      const detailedMessages: GmailMessage[] = [];
      for (const msg of messagesList.slice(0, 5)) {
        try {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const headers = detail.payload?.headers || [];
            const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
            const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
            const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
            
            detailedMessages.push({
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet || '',
              subject,
              from,
              date
            });
          }
        } catch (e) {
          console.warn(`Failed to fetch detail for email ${msg.id}`, e);
        }
      }
      return detailedMessages;
    } catch (err) {
      console.error('Error fetching Gmail:', err);
      return [];
    }
  },

  /**
   * Fetch upcoming primary calendar events
   */
  async listCalendarEvents(token: string): Promise<CalendarEvent[]> {
    try {
      const now = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&timeMin=${encodeURIComponent(now)}&orderBy=startTime&singleEvents=true`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Calendar API failed with status: ${response.status}`);
      }
      const data = await response.json();
      return (data.items || []).map((item: any) => ({
        id: item.id,
        summary: item.summary || 'Untitled Event',
        description: item.description,
        start: item.start,
        end: item.end
      }));
    } catch (err) {
      console.error('Error fetching Calendar:', err);
      return [];
    }
  }
};
