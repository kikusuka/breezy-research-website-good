/**
 * PDF Processing Service
 * Handles PDF parsing, text extraction, and analysis
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFPage {
  pageNumber: number;
  text: string;
}

export interface PDFDocument {
  fileName: string;
  totalPages: number;
  pages: PDFPage[];
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
}

export class PDFService {
  /**
   * Load PDF from file input
   */
  async loadFromFile(file: File): Promise<PDFDocument> {
    const arrayBuffer = await this.fileToArrayBuffer(file);
    return this.loadFromArrayBuffer(arrayBuffer, file.name);
  }

  /**
   * Load PDF from URL
   */
  async loadFromUrl(url: string): Promise<PDFDocument> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return this.loadFromArrayBuffer(arrayBuffer, url.split('/').pop() || 'document.pdf');
  }

  /**
   * Load PDF from ArrayBuffer
   */
  private async loadFromArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): Promise<PDFDocument> {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;
      const pages: PDFPage[] = [];

      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Combine text items with proper spacing
        let lastY: number | null = null;
        let text = '';
        
        for (const item of textContent.items as any[]) {
          const y = item.transform[5];
          
          // Add line break if Y position changes significantly
          if (lastY !== null && Math.abs(lastY - y) > 5) {
            text += '\n';
          }
          
          text += item.str;
          lastY = y;
        }
        
        pages.push({
          pageNumber: i,
          text: text.trim(),
        });
      }

      // Extract metadata
      const metadata = await this.extractMetadata(pdf);

      return {
        fileName,
        totalPages: pdf.numPages,
        pages,
        metadata,
      };
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error(`Failed to parse PDF: ${(error as Error).message}`);
    }
  }

  /**
   * Extract metadata from PDF
   */
  private async extractMetadata(pdf: any): Promise<PDFDocument['metadata']> {
    try {
      const meta = await pdf.getMetadata();
      
      return {
        title: meta.info?.Title,
        author: meta.info?.Author,
        subject: meta.info?.Subject,
        keywords: meta.info?.Keywords,
        creator: meta.info?.Creator,
        producer: meta.info?.Producer,
        creationDate: meta.info?.CreationDate,
        modificationDate: meta.info?.ModDate,
      };
    } catch (error) {
      console.warn('Failed to extract PDF metadata:', error);
      return {};
    }
  }

  /**
   * Convert file to ArrayBuffer
   */
  private fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extract text from specific pages
   */
  extractTextFromPages(document: PDFDocument, startPage: number, endPage: number): string {
    const startIndex = Math.max(0, startPage - 1);
    const endIndex = Math.min(document.pages.length, endPage);
    
    return document.pages
      .slice(startIndex, endIndex)
      .map(page => page.text)
      .join('\n\n--- Page Break ---\n\n');
  }

  /**
   * Search text in PDF
   */
  searchInPDF(document: PDFDocument, query: string, caseSensitive: boolean = false): Array<{
    pageNumber: number;
    matches: Array<{
      text: string;
      context: string;
    }>;
  }> {
    const results: Array<{
      pageNumber: number;
      matches: Array<{
        text: string;
        context: string;
      }>;
    }> = [];

    const searchText = caseSensitive ? query : query.toLowerCase();

    document.pages.forEach(page => {
      const pageText = caseSensitive ? page.text : page.text.toLowerCase();
      const matches: Array<{ text: string; context: string }> = [];
      
      let index = pageText.indexOf(searchText);
      while (index !== -1) {
        // Extract context (50 chars before and after)
        const start = Math.max(0, index - 50);
        const end = Math.min(page.text.length, index + searchText.length + 50);
        
        matches.push({
          text: page.text.substring(index, index + searchText.length),
          context: page.text.substring(start, end),
        });
        
        index = pageText.indexOf(searchText, index + 1);
      }
      
      if (matches.length > 0) {
        results.push({
          pageNumber: page.pageNumber,
          matches,
        });
      }
    });

    return results;
  }

  /**
   * Get summary of PDF (first page + metadata)
   */
  getSummary(document: PDFDocument): string {
    const firstPageText = document.pages[0]?.text || '';
    const truncated = firstPageText.length > 1000 
      ? firstPageText.substring(0, 1000) + '...' 
      : firstPageText;

    let summary = `PDF: ${document.fileName}\n`;
    summary += `Total Pages: ${document.totalPages}\n`;
    
    if (document.metadata?.title) {
      summary += `Title: ${document.metadata.title}\n`;
    }
    if (document.metadata?.author) {
      summary += `Author: ${document.metadata.author}\n`;
    }
    
    summary += `\nFirst Page Preview:\n${truncated}`;
    
    return summary;
  }

  /**
   * Convert PDF pages to markdown-friendly text
   */
  toMarkdown(document: PDFDocument): string {
    let markdown = `# ${document.fileName}\n\n`;
    
    if (document.metadata?.title) {
      markdown += `**Title:** ${document.metadata.title}\n`;
    }
    if (document.metadata?.author) {
      markdown += `**Author:** ${document.metadata.author}\n`;
    }
    if (document.metadata?.creationDate) {
      markdown += `**Date:** ${document.metadata.creationDate}\n`;
    }
    
    markdown += `\n---\n\n`;
    
    document.pages.forEach(page => {
      markdown += `## Page ${page.pageNumber}\n\n`;
      markdown += page.text;
      markdown += `\n\n---\n\n`;
    });
    
    return markdown;
  }
}

export const pdfService = new PDFService();
