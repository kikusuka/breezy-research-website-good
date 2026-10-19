/**
 * Storage Quota Manager
 * 
 * Handles storage limits for Google Drive integration.
 * Allows users to set custom limits and get warnings when approaching them.
 */

import { googleDriveService } from './googleDriveService';

export interface StorageQuota {
  limitMB: number;
  usedMB: number;
  availableMB: number;
  percentageUsed: number;
  isNearLimit: boolean;
  warningThreshold: number; // Percentage at which to warn (default 80%)
}

export const DEFAULT_QUOTA_LIMIT_MB = 100; // 100MB default
export const WARNING_THRESHOLD_PERCENT = 80;

/**
 * Calculate current storage usage and status
 */
export async function getStorageQuotaStatus(limitMB: number = DEFAULT_QUOTA_LIMIT_MB): Promise<StorageQuota> {
  try {
    // Get actual Drive usage for Synthexis folder
    const driveUsage = await googleDriveService.getStorageUsage();
    
    const usedMB = driveUsage.usedMB;
    const availableMB = Math.max(0, limitMB - usedMB);
    const percentageUsed = limitMB > 0 ? (usedMB / limitMB) * 100 : 0;
    const isNearLimit = percentageUsed >= WARNING_THRESHOLD_PERCENT;

    return {
      limitMB,
      usedMB: parseFloat(usedMB.toFixed(2)),
      availableMB: parseFloat(availableMB.toFixed(2)),
      percentageUsed: parseFloat(percentageUsed.toFixed(1)),
      isNearLimit,
      warningThreshold: WARNING_THRESHOLD_PERCENT
    };
  } catch (error) {
    console.error('Error getting storage quota:', error);
    // Return safe defaults if Drive API fails
    return {
      limitMB,
      usedMB: 0,
      availableMB: limitMB,
      percentageUsed: 0,
      isNearLimit: false,
      warningThreshold: WARNING_THRESHOLD_PERCENT
    };
  }
}

/**
 * Check if adding a new session would exceed the limit
 */
export async function willExceedQuota(sessionSizeMB: number, limitMB: number = DEFAULT_QUOTA_LIMIT_MB): Promise<boolean> {
  const status = await getStorageQuotaStatus(limitMB);
  return (status.usedMB + sessionSizeMB) > limitMB;
}

/**
 * Estimate size of a session object in MB
 */
export function estimateSessionSize(session: any): number {
  try {
    const json = JSON.stringify(session);
    // Approximate: 1 character ≈ 1 byte, then convert to MB
    const bytes = new Blob([json]).size;
    return bytes / (1024 * 1024);
  } catch (error) {
    console.error('Error estimating session size:', error);
    return 0.1; // Default estimate if calculation fails
  }
}

/**
 * Get sessions sorted by size (largest first) to help user decide what to delete
 */
export async function getSessionsBySize(limitMB: number = DEFAULT_QUOTA_LIMIT_MB): Promise<Array<{
  id: string;
  title: string;
  sizeMB: number;
  createdAt: string;
  lastModified: string;
}>> {
  try {
    const sessions = await googleDriveService.listSessions();
    
    const sessionsWithSize = await Promise.all(
      sessions.map(async (session: any) => {
        const sizeMB = estimateSessionSize(session);
        return {
          id: session.id,
          title: session.title || `Session ${session.id.slice(0, 8)}`,
          sizeMB: parseFloat(sizeMB.toFixed(2)),
          createdAt: session.createdAt,
          lastModified: session.lastModified
        };
      })
    );

    // Sort by size (largest first)
    return sessionsWithSize.sort((a: any, b: any) => b.sizeMB - a.sizeMB);
  } catch (error) {
    console.error('Error getting sessions by size:', error);
    return [];
  }
}

/**
 * Get recommended sessions to delete based on size and age
 */
export async function getRecommendedDeletions(limitMB: number = DEFAULT_QUOTA_LIMIT_MB, count: number = 5): Promise<Array<{
  id: string;
  title: string;
  sizeMB: number;
  reason: string;
}>> {
  const sessions = await getSessionsBySize(limitMB);
  
  if (sessions.length === 0) return [];

  const recommendations = [];
  
  // Recommend largest sessions
  for (let i = 0; i < Math.min(count, sessions.length); i++) {
    const session = sessions[i];
    let reason = 'Largest session';
    
    if (session.sizeMB > 1) {
      reason = `Very large (${session.sizeMB} MB)`;
    } else if (session.sizeMB > 0.5) {
      reason = 'Large session';
    }

    recommendations.push({
      id: session.id,
      title: session.title,
      sizeMB: session.sizeMB,
      reason
    });
  }

  return recommendations;
}

/**
 * Save quota limit to localStorage
 */
export function saveQuotaLimit(limitMB: number): void {
  localStorage.setItem('synthexis_quota_limit', limitMB.toString());
}

/**
 * Load quota limit from localStorage
 */
export function loadQuotaLimit(): number {
  const saved = localStorage.getItem('synthexis_quota_limit');
  return saved ? parseInt(saved, 10) : DEFAULT_QUOTA_LIMIT_MB;
}

/**
 * Format storage size for display
 */
export function formatStorageSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}
