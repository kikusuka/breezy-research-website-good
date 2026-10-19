/**
 * Google Drive Direct REST API Service
 * 100% Web Standard Fetch with OAuth Bearer Authentication
 * No external GAPI script dependency required
 */

const APP_FOLDER_NAME = 'Breezy_Synthexis_Data';
const CHATS_FOLDER_NAME = 'chats';
const RESEARCH_FOLDER_NAME = 'research';

export class GoogleDriveService {
  private accessToken: string | null = null;

  /**
   * Initialize Drive service with valid Google OAuth Access Token
   */
  async initialize(accessToken: string): Promise<void> {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Valid Google OAuth access token is required.');
    }
    this.accessToken = accessToken;
  }

  private getHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new Error('Google Drive access token not set. Please authorize via Google Workspace in Settings.');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Ensure folder structure exists
   */
  async ensureFolderStructure(): Promise<{ appFolderId: string; chatsFolderId: string; researchFolderId: string }> {
    const appFolder = await this.findOrCreateFolder(APP_FOLDER_NAME, 'root');
    const chatsFolder = await this.findOrCreateFolder(CHATS_FOLDER_NAME, appFolder.id);
    const researchFolder = await this.findOrCreateFolder(RESEARCH_FOLDER_NAME, appFolder.id);

    return {
      appFolderId: appFolder.id,
      chatsFolderId: chatsFolder.id,
      researchFolderId: researchFolder.id,
    };
  }

  private async findOrCreateFolder(name: string, parentId: string): Promise<{ id: string; name: string }> {
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`);
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`, {
      headers: this.getHeaders(),
    });

    if (listRes.ok) {
      const data = await listRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0];
      }
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      throw new Error(`Failed to create Drive folder "${name}" (${createRes.status}): ${errText}`);
    }

    return await createRes.json();
  }

  /**
   * Save JSON file to Google Drive using multipart upload or update
   */
  async saveFile(name: string, data: any, folderId: string): Promise<any> {
    const existingFile = await this.findFileByName(name, folderId);
    const fileContent = JSON.stringify(data, null, 2);

    if (existingFile) {
      // Update content via upload
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: fileContent,
        }
      );

      if (!updateRes.ok) {
        throw new Error(`Failed to update file in Drive (${updateRes.status})`);
      }
      return await updateRes.json();
    } else {
      // Create metadata and content via multipart
      const boundary = '-------BreezyDriveUploadBoundary' + Math.random().toString(36).slice(2);
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata = {
        name,
        parents: [folderId],
        mimeType: 'application/json',
      };

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelim;

      const createRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body: multipartBody,
        }
      );

      if (!createRes.ok) {
        const err = await createRes.text().catch(() => '');
        throw new Error(`Failed to upload file to Drive (${createRes.status}): ${err}`);
      }

      return await createRes.json();
    }
  }

  private async findFileByName(name: string, folderId: string): Promise<{ id: string; name: string } | null> {
    const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`, {
      headers: this.getHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0];
      }
    }
    return null;
  }

  /**
   * Save a chat session specifically
   */
  async saveChat(chat: any): Promise<void> {
    const { chatsFolderId } = await this.ensureFolderStructure();
    await this.saveFile(`chat_${chat.id}.json`, chat, chatsFolderId);
  }

  /**
   * Save a research session specifically
   */
  async saveResearch(session: any): Promise<void> {
    const { researchFolderId } = await this.ensureFolderStructure();
    await this.saveFile(`research_${session.id}.json`, session, researchFolderId);
  }

  /**
   * Compatibility alias for saveSession
   */
  async saveSession(session: any, folderId?: string): Promise<any> {
    if (folderId) {
      return await this.saveFile(`research_${session.id}.json`, session, folderId);
    }
    return await this.saveResearch(session);
  }

  /**
   * List sessions from Drive
   */
  async listSessions(): Promise<any[]> {
    try {
      const { researchFolderId } = await this.ensureFolderStructure();
      const q = encodeURIComponent(`'${researchFolderId}' in parents and trashed=false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime)&spaces=drive`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.files || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get approximate storage usage in MB
   */
  async getStorageUsage(): Promise<{ usedMB: number }> {
    try {
      const files = await this.listSessions();
      const totalBytes = files.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0);
      return { usedMB: totalBytes / (1024 * 1024) };
    } catch {
      return { usedMB: 0 };
    }
  }

  /**
   * Compatibility alias for listing all session files
   */
  async listAllSessions(folderIdOrName?: string): Promise<any[]> {
    return await this.listSessions();
  }

  /**
   * Delete session file by ID from Drive
   */
  async deleteSessionById(sessionId: string): Promise<void> {
    try {
      const { researchFolderId } = await this.ensureFolderStructure();
      const existing = await this.findFileByName(`research_${sessionId}.json`, researchFolderId);
      if (existing) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${existing.id}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
        });
      }
    } catch (e) {
      console.warn('Failed to delete session from Drive:', e);
    }
  }

  /**
   * Compatibility method for ensuring folder structure
   */
  async ensureAppFolderStructure(): Promise<{ appFolderId: string; sessionsFolderId: string }> {
    const { appFolderId, researchFolderId } = await this.ensureFolderStructure();
    return {
      appFolderId,
      sessionsFolderId: researchFolderId,
    };
  }
}

export const googleDriveService = new GoogleDriveService();
export const driveService = googleDriveService;

