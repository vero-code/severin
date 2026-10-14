/**
 * Unified Swiss Multilingual Text Normalizer & Diacritic Folder.
 * 
 * Handles:
 * - Unicode canonical composition (NFC).
 * - Swiss language characters (German ä, ö, ü; French é, è, ê, ë, à, â, ç, î, ï, ô, ù, û, ü, œ, æ; Italian; Romansh).
 * - Common European minority surnames (Slavic/Balkan š, č, ć, ž, đ).
 * - Typographic ligatures (fi, fl, ff, ffi, ffl, oe, ae).
 * - Legacy PDF Type 1 embedded font glyph offsets (\u0011 -> š, \u0012 -> č, etc.).
 * - Removal of unprintable control characters and zero-width spaces.
 * - Diacritic-folding for resilient fallback provenance matching.
 */

export const normalizeSwissText = (text?: string | null): string => {
  if (!text) return '';

  // 1. Unicode NFC composition
  let s = text.normalize('NFC');

  // 2. Expand typographic ligatures
  s = s
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE');

  // 3. Map legacy PDF Type 1 and Windows-1252 / CP1252 embedded font glyph artifacts
  s = s
    .replace(/\u0011/g, 'š')
    .replace(/\u0012/g, 'č')
    .replace(/\u0013/g, 'ć')
    .replace(/\u0014/g, 'ž')
    .replace(/\u0015/g, 'đ')
    .replace(/\u008a/g, 'Š')
    .replace(/\u008c/g, 'Œ')
    .replace(/\u008e/g, 'Ž')
    .replace(/\u009a/g, 'š')
    .replace(/\u009c/g, 'œ')
    .replace(/\u009e/g, 'ž')
    .replace(/\u009f/g, 'Ÿ');

  // 4. Strip unprintable ASCII C0 control characters, zero-width spaces, and replacement glyphs
  // (Preserves standard whitespace: space, newline, tab, and avoids wiping CP1252 letters)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\ufeff\ufffd]/g, '');

  return s;
};

/**
 * Strips all diacritics / accents for fallback search matching.
 * Preserves character positions 1-to-1 with precomposed NFC text.
 */
export const foldDiacritics = (text?: string | null): string => {
  if (!text) return '';
  const normalized = normalizeSwissText(text);
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

/**
 * Builds a regex pattern for a word that allows optional hyphenation across linebreaks.
 * Handles soft hyphen (\u00ad), hyphen-minus (-), and unicode dashes (\u2010, \u2011) followed by whitespace.
 */
export const buildWordPattern = (word: string): string => {
  if (!word) return '';
  const chars = Array.from(word).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return chars.join('(?:[-\\u00ad\\u2010\\u2011]\\s*)?');
};

