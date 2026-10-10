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

export interface TelemetryHistoryItem {
  timestamp: string;
  model: string;
  task?: string;
  canton?: string;
  provenance_score?: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_sec: number;
  status: string;
}

export interface TelemetryStats {
  model: string;
  status: string;
  endpoint?: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  average_latency_seconds: number;
  total_latency_seconds?: number;
  last_request_at?: string;
  history?: TelemetryHistoryItem[];
}


