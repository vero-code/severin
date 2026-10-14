import React from 'react';
import type { ExtractedAffair, ActiveProvenance } from '../../types';

interface ExtractionHeaderCardProps {
  extractedAffair: ExtractedAffair;
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

export const ExtractionHeaderCard: React.FC<ExtractionHeaderCardProps> = ({
  extractedAffair,
  onHoverProvenance,
}) => {
  const isTitleInteractive = Boolean(extractedAffair.title_provenance);

  return (
    <div className="extracted-card">
      <div
        className={`affair-title-text ${isTitleInteractive ? 'interactive-title' : ''}`}
        onMouseEnter={
          isTitleInteractive
            ? () =>
                onHoverProvenance?.({
                  field: 'title',
                  page_number: extractedAffair.title_provenance!.page_number,
                  snippet: extractedAffair.title_provenance!.source_text_snippet,
                  char_start: extractedAffair.title_provenance!.char_start,
                  char_end: extractedAffair.title_provenance!.char_end,
                })
            : undefined
        }
        onMouseLeave={isTitleInteractive ? () => onHoverProvenance?.(null) : undefined}
        title={isTitleInteractive ? 'Hover to inspect title citation in text' : undefined}
      >
        {extractedAffair.title}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="meta-tag">{extractedAffair.canton_or_body}</span>
        <span className="meta-tag">{extractedAffair.level}</span>
        <span className="meta-tag">{extractedAffair.affair_type}</span>
        <span className="meta-tag">{extractedAffair.language.toUpperCase()}</span>
      </div>

      {extractedAffair.questions_and_answers.length === 0 && !extractedAffair.background_and_rationale && (
        <div className="document-nature-notice">
          <svg
            className="notice-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="notice-content">
            <strong>Administrative Annex / Consultation Document:</strong> Contains official addressee rosters and
            procedure metadata. No parliamentary questions or debate motions present in source.
          </div>
        </div>
      )}

      {(extractedAffair.submission_date || extractedAffair.addressed_to) && (
        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            marginTop: '0.75rem',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          {extractedAffair.submission_date && (
            <span>
              Submitted: <strong>{extractedAffair.submission_date}</strong>
            </span>
          )}
          {extractedAffair.addressed_to && (
            <span>
              Addressed to: <strong>{extractedAffair.addressed_to}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
