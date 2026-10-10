/**
 * TypeScript type definitions for SEVERIN.
 * Mirrors OpenParlData API responses and unified representation schema.
 */

export type MultilingualText = string | Record<string, string>;

export interface DocumentItem {
  id: number;
  title?: MultilingualText;
  url: string;
  type?: string;
  date?: string;
}

export interface ParliamentaryAffairItem {
  id: number;
  short_id?: string;
  title: MultilingualText;
  body_key: string;
  begin_date?: string;
  end_date?: string;
  state?: string;
  affair_type?: string;
  author_names?: string[];
  docs?: DocumentItem[];
}

export interface BodyItem {
  key: string;
  name: string;
  canton?: string;
  level?: string;
  indexed?: boolean;
}

export interface AffairsApiResponse {
  data: ParliamentaryAffairItem[];
  meta?: {
    total_records?: number;
    limit?: number;
    offset?: number;
  };
}

export interface PdfPageItem {
  page_number: number;
  text: string;
  char_count: number;
}

export interface ParsePdfResponse {
  url: string;
  total_pages: number;
  total_chars: number;
  pages: PdfPageItem[];
}

