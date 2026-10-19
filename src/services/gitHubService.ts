/**
 * GitHub Service for Breezy
 * Handles calling real GitHub REST API endpoints with User Personal Access Tokens
 */

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url?: string;
}

export const gitHubService = {
  /**
   * Fetch authenticated user's repositories
   */
  async listRepositories(token: string): Promise<GitHubRepository[]> {
    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=30&sort=updated', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (!response.ok) {
        throw new Error(`GitHub repos request failed with status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('Error fetching GitHub repos:', err);
      return [];
    }
  },

  /**
   * List files/directories in a repo path
   */
  async listRepoContents(token: string, repoFullName: string, path: string = ''): Promise<GitHubContent[]> {
    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (!response.ok) {
        throw new Error(`GitHub contents request failed: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('Error fetching GitHub contents:', err);
      return [];
    }
  },

  /**
   * Fetch raw file contents and SHA from GitHub
   */
  async fetchFileDetails(token: string, repoFullName: string, path: string): Promise<{ content: string; sha: string }> {
    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (!response.ok) {
        throw new Error(`GitHub file detail read failed: ${response.status}`);
      }
      const data = await response.json();
      let decoded = '';
      if (data.content && data.encoding === 'base64') {
        decoded = atob(data.content.replace(/\s/g, ''));
      }
      return { content: decoded, sha: data.sha || '' };
    } catch (err) {
      console.error('Error fetching file details:', err);
      throw err;
    }
  },

  /**
   * Commit and write/update a file on GitHub
   */
  async updateFileContent(
    token: string,
    repoFullName: string,
    path: string,
    content: string,
    sha: string = '',
    message: string = 'Update file via Breezy Research'
  ): Promise<any> {
    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          content: base64Content,
          ...(sha ? { sha } : {})
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to commit file to GitHub (${response.status}): ${errText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('Error committing file content to GitHub:', err);
      throw err;
    }
  },

  /**
   * Fetch raw file contents from GitHub
   */
  async fetchFileContent(token: string, repoFullName: string, path: string): Promise<string> {
    try {
      const details = await this.fetchFileDetails(token, repoFullName, path);
      return details.content;
    } catch (err) {
      console.error('Error reading GitHub file:', err);
      return 'Failed to retrieve GitHub file content.';
    }
  }
};
