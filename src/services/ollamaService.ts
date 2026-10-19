/**
 * Ollama Service for Offline AI Support
 * Handles local model inference via Ollama API
 */

import type { ChatMessage, ModelConfig } from '../types';

const DEFAULT_OLLAMA_BASE_URL = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '/api/ollama' : 'http://localhost:11434';

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaService {
  private baseUrl: string = DEFAULT_OLLAMA_BASE_URL;
  private isConnected: boolean = false;
  private connectionCheckPromise: Promise<boolean> | null = null;

  constructor() {
    // Check if we're in a secure context for localhost access
    if (window.location.protocol !== 'https:' && 
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1') {
      console.warn('Ollama may not be accessible from non-localhost domains without HTTPS');
    }
  }

  /**
   * Set custom base URL for Ollama
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Check connection to Ollama server
   */
  async checkConnection(): Promise<boolean> {
    if (this.connectionCheckPromise) {
      return this.connectionCheckPromise;
    }

    this.connectionCheckPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${this.baseUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Ollama returned status ${response.status}`);
        }
        
        this.isConnected = true;
        return true;
      } catch (error) {
        console.error('Ollama connection failed:', error);
        this.isConnected = false;
        return false;
      } finally {
        this.connectionCheckPromise = null;
      }
    })();

    return this.connectionCheckPromise;
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<OllamaModel[]> {
    const connected = await this.checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Ollama server. Make sure Ollama is running.');
    }

    const response = await fetch(`${this.baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.models || [];
  }

  /**
   * Generate completion using Ollama
   */
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      stream?: boolean;
      onChunk?: (chunk: string) => void;
    }
  ): Promise<string> {
    const connected = await this.checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Ollama server.');
    }

    const payload: any = {
      model: model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: options?.stream ?? false,
      options: {
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 0.9,
        num_predict: options?.maxTokens ?? 2048,
      },
    };

    if (options?.stream && options?.onChunk) {
      return this.streamCompletion(payload, options.onChunk);
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${errorText}`);
    }

    const data: OllamaGenerateResponse = await response.json();
    return data.response;
  }

  /**
   * Stream completion with chunk callbacks
   */
  private async streamCompletion(
    payload: any,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            onChunk(data.message.content);
            fullResponse += data.message.content;
          }
        } catch (e) {
          console.warn('Failed to parse Ollama chunk:', e);
        }
      }
    }

    return fullResponse;
  }

  /**
   * Pull a model from Ollama library
   */
  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    const connected = await this.checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Ollama server.');
    }

    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: modelName,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pull model: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.status === 'success') {
            onProgress?.(100);
            return;
          }
          if (data.completed && data.total) {
            const progress = Math.round((data.completed / data.total) * 100);
            onProgress?.(progress);
          }
        } catch (e) {
          console.warn('Failed to parse pull progress:', e);
        }
      }
    }
  }

  /**
   * Delete a local model
   */
  async deleteModel(modelName: string): Promise<void> {
    const connected = await this.checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Ollama server.');
    }

    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete model: ${errorText}`);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const ollamaService = new OllamaService();
