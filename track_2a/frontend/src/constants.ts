import type { DocumentItem } from './types';

// Prevalent Swiss parliamentary bodies for fast selection
export const PRESET_BODIES = [
  { key: 'ZH', label: 'ZH — Zürich' },
  { key: 'GR', label: 'GR — Graubünden' },
  { key: 'GE', label: 'GE — Genève' },
  { key: 'BE', label: 'BE — Bern' },
  { key: 'BS', label: 'BS — Basel-Stadt' },
  { key: 'GL', label: 'GL — Glarus' },
  { key: 'CHE', label: 'CHE — Federal Assembly' },
];

export const PRESET_BODY_OPTIONS = PRESET_BODIES.map((b) => ({ value: b.key, label: b.label }));

export const MATCH_MODES = [
  { value: 'partial', label: 'Partial' },
  { value: 'exact', label: 'Exact' },
  { value: 'natural', label: 'Natural' },
  { value: 'boolean', label: 'Boolean' },
];

/**
 * Safely extract text from OpenParlData fields that can be either
 * a plain string or a multilingual dictionary { de: '...', fr: '...' }.
 */
export function getText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.de || val.fr || val.it || val.rm || val.en || Object.values(val)[0] || '';
  }
  return String(val);
}

/**
 * Normalizes documents from an affair into a clean array
 */
export function getAffairDocs(affair: any): DocumentItem[] {
  if (!affair || !affair.docs) return [];
  const rawList = Array.isArray(affair.docs)
    ? affair.docs
    : (Array.isArray(affair.docs?.data) ? affair.docs.data : []);

  return rawList
    .map((d: any) => ({
      id: d.id,
      title: d.name || d.title || `Doc #${d.id}`,
      url: d.url_oparl || d.url || '',
      type: d.type || 'pdf',
      date: d.date,
    }))
    .filter((d: any) => Boolean(d.url));
}
