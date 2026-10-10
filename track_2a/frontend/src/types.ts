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
  cached_tokens?: number;
  total_tokens: number;
  cost_chf?: number;
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
  total_cached_tokens?: number;
  total_tokens: number;
  total_cost_chf?: number;
  average_latency_seconds: number;
  total_latency_seconds?: number;
  last_request_at?: string;
  history?: TelemetryHistoryItem[];
}

export interface ProvenanceItem {
  page_number: number;
  source_text_snippet: string;
  char_start?: number | null;
  char_end?: number | null;
  status: 'extracted' | 'inferred' | 'not_found' | string;
}

export interface ActorItem {
  name: string;
  role: string;
  party_or_fraction?: string | null;
  canton_or_municipality?: string | null;
  provenance?: ProvenanceItem | null;
}

export interface QuestionItem {
  number?: string | null;
  text: string;
  provenance?: ProvenanceItem | null;
}

export interface AnswerItem {
  question_reference?: string | null;
  text: string;
  provenance?: ProvenanceItem | null;
}

export interface QuestionAnswerPairItem {
  question: QuestionItem;
  answer?: AnswerItem | null;
}

export interface FinancialDetailItem {
  amount_chf?: number | null;
  purpose: string;
  credit_type?: string | null;
  fiscal_year?: number | null;
  provenance?: ProvenanceItem | null;
}

export interface ProceduralEventItem {
  date?: string | null;
  event_type: string;
  decision?: string | null;
  provenance?: ProvenanceItem | null;
}

export interface ExtractedAffair {
  affair_id?: number | null;
  short_id?: string | null;
  title: string;
  canton_or_body: string;
  level: string;
  affair_type: string;
  language: string;
  submission_date?: string | null;
  authors: ActorItem[];
  addressed_to?: string | null;
  background_and_rationale?: string | null;
  questions_and_answers: QuestionAnswerPairItem[];
  financial_details: FinancialDetailItem[];
  procedural_events: ProceduralEventItem[];
  title_provenance?: ProvenanceItem | null;
  rationale_provenance?: ProvenanceItem | null;
}

export interface ProvenanceDetailItem {
  field: string;
  page: number | null;
  status: string;
  verified: boolean;
  snippet_preview: string;
}

export interface ProvenanceReport {
  total_citations: number;
  verified_citations: number;
  failed_citations: number;
  provenance_score: number;
  details: ProvenanceDetailItem[];
}

export interface ExtractionResponse {
  affair: ExtractedAffair;
  provenance_report: ProvenanceReport;
  telemetry?: TelemetryStats;
}

export interface SamplePdfItem {
  file_name: string;
  affair_id: number;
  short_id?: string | null;
  title: MultilingualText;
  body_key: string;
  level: string;
  language: string;
  doc_id: number;
  doc_name: string;
  url: string;
  size_bytes: number;
}



