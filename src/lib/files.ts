import type { Attachment } from '../types';
import { pdfService } from '../services/pdfService';
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|c|h|cpp|sh|sql|toml|ini|log|bib|tex)$/i;
const CODE_EXT = /\.(js|jsx|ts|tsx|py|rb|go|rs|java|c|h|cpp|sh|sql|css|html?)$/i;
export const MAX_ATTACH_BYTES = 8 * 1024 * 1024;
export async function readAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACH_BYTES) throw new Error(`${file.name} is larger than 8 MB.`);
  const base = { id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, fileName: file.name, size: file.size, uploadedAt: Date.now() };
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') { const doc = await pdfService.loadFromFile(file); return { ...base, fileType: 'pdf', content: doc.pages.map((p) => p.text).join('\n\n') }; }
  if (file.type.startsWith('text/') || TEXT_EXT.test(file.name)) return { ...base, fileType: CODE_EXT.test(file.name) ? 'code' : 'text', content: await file.text() };
  throw new Error(`${file.name}: only PDF and text-based files can be attached.`);
}
export const attachmentsToPromptContext = (atts: Attachment[], limit = 20000) =>
  atts.length ? '\n\n' + atts.map((a) => `--- Attached file: ${a.fileName} ---\n${(a.content || '').slice(0, limit)}`).join('\n\n') : '';
